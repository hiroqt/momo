"""Durable background job queue (WORK-01).

Managed and local-SDK deployments use the service-only PostgreSQL RPCs from
migration 006 (leases, heartbeats, retry limits, stale recovery with
``FOR UPDATE SKIP LOCKED``). Memory mode mirrors those semantics in-process for
development/test only; it is not durable and is rejected outside local/test.
"""

import asyncio
import re
import time
import uuid
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any, Literal

from app.db.session import supabase_session

JobKind = Literal["document_ingestion", "study_generation"]
JOB_KINDS: tuple[JobKind, ...] = ("document_ingestion", "study_generation")
ERROR_CODE = re.compile(r"^[A-Z][A-Z0-9_]{0,63}$")
WORKER_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
PROCESSING_DOCUMENT_STATES = {"UPLOADED", "PROCESSING", "VALIDATING", "EXTRACTING",
                              "CHUNKING", "EMBEDDING", "INDEXING"}
PROCESSING_GENERATION_STATES = {"PENDING", "PROCESSING", "GENERATING", "VALIDATING"}


class JobQueueError(ValueError):
    """Invalid queue parameters (mirrors SQL 22023 validation)."""


def _validate_worker(worker_id: str) -> None:
    if not isinstance(worker_id, str) or not WORKER_ID.fullmatch(worker_id):
        raise JobQueueError("Invalid worker identifier")


class JobQueue:
    def __init__(self) -> None:
        self._jobs: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------ API
    async def enqueue(self, kind: JobKind, user_id: str, subject_id: str,
                      payload: dict[str, Any] | None = None, *, max_attempts: int = 3,
                      requeue: bool = False) -> dict[str, Any]:
        if kind not in JOB_KINDS or not 1 <= max_attempts <= 10:
            raise JobQueueError("Invalid background job")
        payload = payload or {}
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("enqueue_background_job", {
                "p_kind": kind, "p_user_id": user_id, "p_subject_id": subject_id,
                "p_payload": payload, "p_max_attempts": max_attempts, "p_requeue": requeue,
            }))
            return resp.data
        async with self._lock:
            existing = self._find(kind, user_id, subject_id)
            if existing is None:
                now = time.time()
                job: dict[str, Any] = {"id": str(uuid.uuid4()), "kind": kind, "user_id": user_id,
                       "subject_id": subject_id, "payload": deepcopy(payload), "status": "queued",
                       "attempts": 0, "max_attempts": max_attempts, "run_after": now,
                       "lease_owner": None, "lease_expires_at": None, "last_error": None,
                       "created_at": now, "updated_at": now, "completed_at": None}
                self._jobs[job["id"]] = job
                return deepcopy(job)
            if requeue and existing["status"] in {"succeeded", "dead"}:
                existing.update({"status": "queued", "attempts": 0, "max_attempts": max_attempts,
                                 "payload": deepcopy(payload), "run_after": time.time(),
                                 "last_error": None, "completed_at": None, "updated_at": time.time()})
            return deepcopy(existing)

    async def claim(self, worker_id: str, kinds: tuple[str, ...] = JOB_KINDS, *, limit: int = 1,
                    lease_seconds: int = 120, job_id: str | None = None) -> list[dict[str, Any]]:
        _validate_worker(worker_id)
        if not kinds or not 1 <= limit <= 50 or not 15 <= lease_seconds <= 900:
            raise JobQueueError("Invalid job claim")
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("claim_background_jobs", {
                "p_worker_id": worker_id, "p_kinds": list(kinds), "p_limit": limit,
                "p_lease_seconds": lease_seconds, "p_job_id": job_id,
            }))
            return list(resp.data or [])
        dead: list[dict[str, Any]] = []
        async with self._lock:
            now = time.time()
            for job in self._jobs.values():
                if job["status"] == "running" and job["kind"] in kinds and job["lease_expires_at"] < now:
                    exhausted = job["attempts"] >= job["max_attempts"]
                    job.update({"status": "dead" if exhausted else "queued", "last_error": "LEASE_EXPIRED",
                                "lease_owner": None, "lease_expires_at": None, "run_after": now,
                                "completed_at": now if exhausted else None, "updated_at": now})
                    if exhausted:
                        dead.append(deepcopy(job))
            ready = sorted((j for j in self._jobs.values() if j["status"] == "queued"
                            and j["run_after"] <= now and j["kind"] in kinds
                            and (job_id is None or j["id"] == job_id)),
                           key=lambda j: (j["run_after"], j["created_at"], j["id"]))[:limit]
            for job in ready:
                job.update({"status": "running", "attempts": job["attempts"] + 1,
                            "lease_owner": worker_id, "lease_expires_at": now + lease_seconds,
                            "updated_at": now})
            claimed = [deepcopy(job) for job in ready]
        for job in dead:
            await _fail_subject_in_memory(job)
        return claimed

    async def heartbeat(self, job_id: str, worker_id: str, lease_seconds: int = 120) -> bool:
        if not 15 <= lease_seconds <= 900:
            raise JobQueueError("Invalid lease")
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("heartbeat_background_job", {
                "p_job_id": job_id, "p_worker_id": worker_id, "p_lease_seconds": lease_seconds,
            }))
            return bool(resp.data)
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job or job["status"] != "running" or job["lease_owner"] != worker_id:
                return False
            job.update({"lease_expires_at": time.time() + lease_seconds, "updated_at": time.time()})
            return True

    async def complete(self, job_id: str, worker_id: str) -> bool:
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("complete_background_job", {
                "p_job_id": job_id, "p_worker_id": worker_id,
            }))
            return bool(resp.data)
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job or job["status"] != "running" or job["lease_owner"] != worker_id:
                return False
            now = time.time()
            job.update({"status": "succeeded", "lease_owner": None, "lease_expires_at": None,
                        "last_error": None, "completed_at": now, "updated_at": now})
            return True

    async def fail(self, job_id: str, worker_id: str, error_code: str, *,
                   retry_delay_seconds: int = 30, permanent: bool = False) -> str | None:
        if not ERROR_CODE.fullmatch(error_code) or not 0 <= retry_delay_seconds <= 3600:
            raise JobQueueError("Invalid job failure")
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("fail_background_job", {
                "p_job_id": job_id, "p_worker_id": worker_id, "p_error_code": error_code,
                "p_retry_delay_seconds": retry_delay_seconds, "p_permanent": permanent,
            }))
            return resp.data
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job or job["status"] != "running" or job["lease_owner"] != worker_id:
                return None
            now = time.time()
            exhausted = permanent or job["attempts"] >= job["max_attempts"]
            job.update({"status": "dead" if exhausted else "queued", "last_error": error_code,
                        "run_after": now + retry_delay_seconds, "lease_owner": None,
                        "lease_expires_at": None, "completed_at": now if exhausted else None,
                        "updated_at": now})
            snapshot = deepcopy(job)
        if snapshot["status"] == "dead":
            await _fail_subject_in_memory(snapshot)
        return snapshot["status"]

    async def recover_orphans(self, grace_seconds: int = 300, limit: int = 100,
                              max_attempts: int = 3) -> int:
        if not 30 <= grace_seconds <= 86400 or not 1 <= limit <= 500 or not 1 <= max_attempts <= 10:
            raise JobQueueError("Invalid recovery parameters")
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("recover_orphaned_work", {
                "p_grace_seconds": grace_seconds, "p_limit": limit, "p_max_attempts": max_attempts,
            }))
            return int(resp.data or 0)
        from app.db.repositories.documents_repo import documents_repo
        from app.db.repositories.generation_repo import generation_repo
        cutoff = datetime.now(UTC).timestamp() - grace_seconds
        candidates: list[tuple[JobKind, str, str]] = []
        for doc in list(documents_repo._store.values()):
            if doc.get("processing_status") in PROCESSING_DOCUMENT_STATES and _older(doc, cutoff):
                candidates.append(("document_ingestion", doc["user_id"], doc["id"]))
        for gen in list(generation_repo._jobs.values()):
            if (gen.get("status") in PROCESSING_GENERATION_STATES and not gen.get("study_set_id")
                    and _older(gen, cutoff)):
                candidates.append(("study_generation", gen["user_id"], gen["id"]))
        recovered = 0
        for kind, user_id, subject_id in candidates[:limit]:
            existing = self._find(kind, user_id, subject_id)
            if existing and existing["status"] in {"queued", "running"}:
                continue
            await self.enqueue(kind, user_id, subject_id, max_attempts=max_attempts, requeue=True)
            recovered += 1
        return recovered

    # ------------------------------------------------------------ helpers
    def _find(self, kind: str, user_id: str, subject_id: str) -> dict[str, Any] | None:
        for job in self._jobs.values():
            if job["kind"] == kind and job["user_id"] == user_id and job["subject_id"] == subject_id:
                return job
        return None

    def reset(self) -> None:
        """Clear in-process state (test isolation only)."""
        self._jobs.clear()


def _older(record: dict[str, Any], cutoff: float) -> bool:
    stamp = record.get("updated_at") or record.get("created_at")
    try:
        return datetime.fromisoformat(str(stamp)).timestamp() < cutoff
    except ValueError:
        return False


async def _fail_subject_in_memory(job: dict[str, Any]) -> None:
    """Memory-mode equivalent of SQL fail_background_job_subject."""
    from app.db.repositories.documents_repo import documents_repo
    from app.db.repositories.generation_repo import generation_repo
    if job["kind"] == "document_ingestion":
        doc = await documents_repo.get_by_id(job["subject_id"], job["user_id"])
        if doc and doc.get("processing_status") not in {"READY", "EXPIRED", "FAILED"}:
            await documents_repo.update_status(job["subject_id"], "FAILED",
                                               error="The uploaded document could not be processed.")
    elif job["kind"] == "study_generation":
        # Mirror SQL: never downgrade a completed generation.
        current = await generation_repo.get_job(job["subject_id"], job["user_id"])
        if not current or current.get("status") == "COMPLETED" or current.get("study_set_id"):
            return
        await generation_repo.update_job(
            job_id=job["subject_id"], status="FAILED", stage="Failed", progress=100,
            message="An unexpected error occurred during reviewer generation.",
            error="Reviewer generation failed. Please retry.")


job_queue = JobQueue()
