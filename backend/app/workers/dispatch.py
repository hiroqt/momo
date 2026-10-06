"""API-side job dispatch: persist durable work, never execute it in the request."""

from typing import Any

from fastapi import BackgroundTasks

from app.config import settings
from app.workers.job_queue import JobKind, job_queue


async def dispatch_job(kind: JobKind, user_id: str, subject_id: str, background_tasks: BackgroundTasks,
                       *, requeue: bool = False) -> dict[str, Any]:
    """Enqueue one logical job per subject (idempotent across retries/replicas).

    Managed environments rely on separate `app.workers.runner` processes. Local
    and test runs may opt into inline execution, which still claims the job
    through the same lease path after the response is sent.
    """
    job = await job_queue.enqueue(kind, user_id, subject_id, max_attempts=settings.JOB_MAX_ATTEMPTS,
                                  requeue=requeue)
    if settings.INLINE_JOB_EXECUTION and not settings.is_managed and job.get("status") == "queued":
        from app.workers.runner import job_runner
        background_tasks.add_task(job_runner.run_now, job["id"])
    return job
