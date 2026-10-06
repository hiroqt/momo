"""Run as a scheduled server task; never delete generated study material."""

import asyncio
import logging
from datetime import UTC, datetime

from app.config import settings
from app.db.session import supabase_session
from app.services.storage import storage_service

logger = logging.getLogger(__name__)


async def cleanup_expired_originals(batch_size: int = 100) -> int:
    if not 1 <= batch_size <= 100:
        raise ValueError("Cleanup batch size must be between 1 and 100")
    if not supabase_session.is_configured:
        return 0
    query = (
        supabase_session.require_client().table("documents")
        .select("id,user_id,s3_object_key,file_type")
        .lte("expires_at", datetime.now(UTC).isoformat())
        .neq("processing_status", "EXPIRED")
        .order("expires_at")
        .limit(batch_size)
    )
    records = (await supabase_session.execute(query)).data or []
    removed = 0
    for record in records:
        expected = storage_service.build_object_key(
            record["user_id"], record["id"], record["file_type"]
        )
        if record["s3_object_key"] != expected:
            logger.error("Expired document has invalid storage destination")
            continue
        if not await asyncio.to_thread(storage_service.delete_object, expected):
            raise RuntimeError("Expired object deletion failed")
        # Mark only after deletion succeeds. Repeating removal after a crash is safe.
        await supabase_session.execute(
            supabase_session.require_client().table("documents")
            .update({"processing_status": "EXPIRED", "updated_at": datetime.now(UTC).isoformat()})
            .eq("id", record["id"]).eq("user_id", record["user_id"])
        )
        removed += 1
    return removed


async def report_retention_backlog() -> dict[str, int]:
    """Alert on originals overdue for physical deletion (monitoring signal)."""
    backlog = {"overdue_count": 0, "oldest_overdue_seconds": 0}
    try:
        if supabase_session.is_configured:
            data = (await supabase_session.execute(supabase_session.require_client().rpc("retention_backlog", {}))).data
            backlog = {key: int((data or {}).get(key, 0)) for key in backlog}
    except Exception as exc:  # noqa: BLE001 - monitoring failure is itself reported
        logger.error("Retention backlog check failed (%s)", type(exc).__name__)
        return backlog
    if backlog["oldest_overdue_seconds"] > settings.CLEANUP_OVERDUE_ALERT_SECONDS:
        logger.error("RETENTION_OVERDUE: %s originals overdue; oldest %ss past expiry",
                     backlog["overdue_count"], backlog["oldest_overdue_seconds"])
    return backlog


async def main() -> None:
    """One-shot cleanup for an external scheduler (cron); the worker runner also schedules it."""
    try:
        removed = await cleanup_expired_originals()
        logger.info("Removed %s expired originals", removed)
        await report_retention_backlog()
    finally:
        supabase_session.close()


if __name__ == "__main__":
    asyncio.run(main())
