"""Run as a scheduled server task; never delete generated study material."""

import asyncio
import logging

from app.config import settings
from app.db.repositories.upload_ticket_repo import upload_ticket_repo
from app.db.session import supabase_session
from app.services.storage import storage_service
from app.services.storage.base import ObjectNotFoundError

logger = logging.getLogger(__name__)


async def cleanup_upload_tickets(batch_size: int = 100) -> int:
    """Fence registration before deleting; retain tombstones for late/recreated bytes."""
    records = await upload_ticket_repo.claim_cleanup(
        batch_size, provider=storage_service.provider, bucket=storage_service.bucket
    )
    removed = 0
    for record in records:
        try:
            expected = storage_service.build_object_key(record["user_id"], record["id"], record["file_type"])
            if (record["object_key"] != expected or record.get("provider") != storage_service.provider
                    or record.get("bucket") != storage_service.bucket):
                logger.error("Upload ticket has an unverified storage destination")
                continue
            retired = record.get("status") == "retired" or record.get("auth_ref") is None
            metadata = None
            if not retired:
                try:
                    metadata = await asyncio.to_thread(storage_service.get_object_metadata, expected, for_cleanup=True)
                except ObjectNotFoundError:
                    metadata = None
            if not await upload_ticket_repo.prepare_cleanup(record["id"], record["lease_token"], metadata):
                continue
            if retired:
                deleted = await asyncio.to_thread(storage_service.delete_object, expected)
            elif metadata is not None:
                deleted = await asyncio.to_thread(storage_service.delete_observed_object, expected, metadata)
            else:
                deleted = False
            if not deleted:
                raise RuntimeError("Expired object deletion failed")
            if await upload_ticket_repo.finish_cleanup(record["id"], record["lease_token"]):
                removed += 1
        except Exception as exc:  # noqa: BLE001 - retain the lease/outbox and continue bounded batch
            logger.error("Upload cleanup failed (%s)", type(exc).__name__)
    return removed


async def cleanup_expired_originals(batch_size: int = 100) -> int:
    if not 1 <= batch_size <= 100:
        raise ValueError("Cleanup batch size must be between 1 and 100")
    if not supabase_session.is_configured:
        return 0
    # Legacy origins must be inventoried before they can enter this outbox.
    # Never guess a provider/bucket from the current server configuration.
    return await cleanup_upload_tickets(batch_size)


async def report_retention_backlog() -> dict[str, int]:
    """Alert on originals overdue for physical deletion (monitoring signal)."""
    backlog = {"overdue_count": 0, "oldest_overdue_seconds": 0,
               "unresolved_legacy_count": 0, "pending_probe_count": 0}
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
    if backlog["unresolved_legacy_count"]:
        logger.error("RETENTION_LEGACY_UNVERIFIED: %s originals require storage inventory", backlog["unresolved_legacy_count"])
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
