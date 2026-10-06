"""Separate worker process for durable background jobs (WORK-01) and retention.

Run with ``python -m app.workers.runner``. Each worker claims a bounded number
of jobs, renews its lease while a handler runs, and records a sanitized result.
A crashed worker's lease expires and the job is reclaimed by the next poll; a
worker that loses its lease cancels its handler instead of finishing it.
The same process schedules retention cleanup and orphaned-work recovery.
"""

import asyncio
import contextlib
import logging
import os
import signal
import socket
import uuid
from collections.abc import Callable, Coroutine
from typing import Any

from app.config import settings
from app.workers.errors import PermanentJobError, TransientJobError
from app.workers.job_queue import JOB_KINDS, JobQueue, job_queue

__all__ = ["JobRunner", "PermanentJobError", "TransientJobError", "job_runner"]

logger = logging.getLogger(__name__)

Handler = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]


def default_worker_id() -> str:
    host = "".join(c for c in socket.gethostname() if c.isalnum() or c in ".-")[:48] or "worker"
    return f"{host}:{os.getpid()}:{uuid.uuid4().hex[:8]}"


class JobRunner:
    def __init__(self, queue: JobQueue, handlers: dict[str, Handler], *, worker_id: str | None = None,
                 concurrency: int | None = None, lease_seconds: int | None = None,
                 heartbeat_seconds: float | None = None, retry_delay_seconds: int | None = None) -> None:
        self.queue = queue
        self.handlers = handlers
        self.worker_id = worker_id or default_worker_id()
        self.concurrency = concurrency or settings.WORKER_CONCURRENCY
        self.lease_seconds = lease_seconds or settings.JOB_LEASE_SECONDS
        self.heartbeat_seconds = heartbeat_seconds or settings.JOB_HEARTBEAT_SECONDS
        self.retry_delay_seconds = (settings.JOB_RETRY_DELAY_SECONDS if retry_delay_seconds is None
                                    else retry_delay_seconds)
        self._in_flight: set[asyncio.Task[str]] = set()

    @property
    def kinds(self) -> tuple[str, ...]:
        return tuple(kind for kind in JOB_KINDS if kind in self.handlers)

    async def run_job(self, job: dict[str, Any]) -> str:
        """Execute one claimed job. Returns succeeded/queued/dead/lease_lost."""
        handler = self.handlers[job["kind"]]
        work: asyncio.Task[None] = asyncio.create_task(handler(job))
        lease_lost = asyncio.Event()
        beat = asyncio.create_task(self._heartbeat(job["id"], work, lease_lost))
        try:
            await work
        except asyncio.CancelledError:
            if lease_lost.is_set():
                logger.warning("Job %s lease lost; handler cancelled", job["id"])
                return "lease_lost"
            raise
        except PermanentJobError as exc:
            return await self._record_failure(job, exc.code, permanent=True)
        except TransientJobError as exc:
            return await self._record_failure(job, exc.code)
        except Exception as exc:  # noqa: BLE001 - worker boundary records a sanitized failure
            logger.error("Job %s handler failed (%s)", job["id"], type(exc).__name__)
            return await self._record_failure(job, "HANDLER_FAILED")
        finally:
            beat.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await beat
        if await self.queue.complete(job["id"], self.worker_id):
            return "succeeded"
        logger.warning("Job %s completed after its lease moved", job["id"])
        return "lease_lost"

    async def _record_failure(self, job: dict[str, Any], code: str, *, permanent: bool = False) -> str:
        status = await self.queue.fail(job["id"], self.worker_id, code,
                                       retry_delay_seconds=self.retry_delay_seconds, permanent=permanent)
        return status or "lease_lost"

    async def _heartbeat(self, job_id: str, work: asyncio.Task[None], lease_lost: asyncio.Event) -> None:
        while not work.done():
            await asyncio.sleep(self.heartbeat_seconds)
            try:
                renewed = await self.queue.heartbeat(job_id, self.worker_id, self.lease_seconds)
            except Exception as exc:  # noqa: BLE001 - keep working; lease expiry is the backstop
                logger.warning("Job %s heartbeat failed (%s)", job_id, type(exc).__name__)
                continue
            if not renewed:
                lease_lost.set()
                work.cancel()
                return

    async def run_once(self) -> int:
        """Claim up to the free concurrency slots and run them to completion."""
        jobs = await self.queue.claim(self.worker_id, self.kinds, limit=self.concurrency,
                                      lease_seconds=self.lease_seconds)
        if jobs:
            await asyncio.gather(*(self.run_job(job) for job in jobs))
        return len(jobs)

    async def run_now(self, job_id: str) -> str | None:
        """Inline local/test execution of one specific queued job via the same lease path."""
        jobs = await self.queue.claim(self.worker_id, self.kinds, limit=1,
                                      lease_seconds=self.lease_seconds, job_id=job_id)
        return await self.run_job(jobs[0]) if jobs else None

    async def maintain(self) -> None:
        """Recover orphaned work and enforce original-document retention."""
        from app.workers.cleanup_worker import (
            cleanup_expired_originals,
            report_retention_backlog,
        )
        try:
            recovered = await self.queue.recover_orphans(settings.JOB_RECOVERY_GRACE_SECONDS,
                                                         max_attempts=settings.JOB_MAX_ATTEMPTS)
            if recovered:
                logger.warning("Recovered %s orphaned background jobs", recovered)
        except Exception as exc:  # noqa: BLE001 - maintenance must not stop job processing
            logger.error("Orphaned-work recovery failed (%s)", type(exc).__name__)
        try:
            await cleanup_expired_originals()
        except Exception as exc:  # noqa: BLE001 - retried on the next interval
            logger.error("Retention cleanup failed (%s)", type(exc).__name__)
        await report_retention_backlog()

    async def serve(self, stop: asyncio.Event) -> None:
        loop = asyncio.get_running_loop()
        next_maintenance = loop.time()
        while not stop.is_set():
            if loop.time() >= next_maintenance:
                await self.maintain()
                next_maintenance = loop.time() + settings.CLEANUP_INTERVAL_SECONDS
            free = self.concurrency - len(self._in_flight)
            claimed: list[dict[str, Any]] = []
            if free > 0:
                try:
                    claimed = await self.queue.claim(self.worker_id, self.kinds, limit=free,
                                                     lease_seconds=self.lease_seconds)
                except Exception as exc:  # noqa: BLE001 - back off and retry the poll
                    logger.error("Job claim failed (%s)", type(exc).__name__)
            for job in claimed:
                task = asyncio.create_task(self.run_job(job))
                self._in_flight.add(task)
                task.add_done_callback(self._in_flight.discard)
            if not claimed:
                with contextlib.suppress(TimeoutError):
                    await asyncio.wait_for(stop.wait(), timeout=settings.WORKER_POLL_SECONDS)
        await self.drain()

    async def drain(self) -> None:
        """Let in-flight jobs finish; cancel stragglers so their leases expire safely."""
        if not self._in_flight:
            return
        _, pending = await asyncio.wait(set(self._in_flight), timeout=settings.WORKER_DRAIN_SECONDS)
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)


async def handle_document_ingestion(job: dict[str, Any]) -> None:
    from app.db.repositories.documents_repo import documents_repo
    from app.workers.document_worker import document_worker
    doc = await documents_repo.get_by_id(job["subject_id"], job["user_id"])
    # Deleted, expired, finished or terminally failed sources are not reprocessed.
    if not doc or doc.get("processing_status") in {"READY", "EXPIRED", "FAILED"}:
        return
    await document_worker.process_document(
        document_id=doc["id"], user_id=job["user_id"], s3_object_key=doc["s3_object_key"],
        filename=doc["original_filename"], file_type=doc["file_type"],
        final_attempt=job["attempts"] >= job["max_attempts"],
    )


async def handle_study_generation(job: dict[str, Any]) -> None:
    """Narrow interface to Team A's GenerationWorker; its signature is unchanged."""
    from app.db.repositories.generation_repo import generation_repo
    from app.workers.generation_worker import generation_worker
    generation = await generation_repo.get_job(job["subject_id"], job["user_id"])
    if not generation or generation.get("status") == "COMPLETED" or generation.get("study_set_id"):
        return
    await generation_worker.process_generation(
        job_id=generation["id"], user_id=job["user_id"], document_id=generation["document_id"],
        generation_spec=generation.get("generation_config") or {},
    )


HANDLERS: dict[str, Handler] = {
    "document_ingestion": handle_document_ingestion,
    "study_generation": handle_study_generation,
}

job_runner = JobRunner(job_queue, HANDLERS)


async def main() -> None:
    from app.db.session import supabase_session
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    if supabase_session.use_memory:
        raise RuntimeError("Separate workers require a database-backed queue")
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    logger.info("Worker %s started", job_runner.worker_id)
    try:
        await job_runner.serve(stop)
    finally:
        supabase_session.close()


if __name__ == "__main__":
    asyncio.run(main())
