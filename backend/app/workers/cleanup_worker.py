"""Run as a scheduled server task; never delete generated study material."""

import asyncio
import logging
from datetime import UTC, datetime

from app.db.session import supabase_session
from app.services.storage import storage_service

logger = logging.getLogger(__name__)


async def cleanup_expired_originals(batch_size: int = 100) -> int:
    if not 1 <= batch_size <= 100:
        raise ValueError("Cleanup batch size must be between 1 and 100")
    if not supabase_session.is_configured:
        return 0
    query = (
        supabase_session.client.table("documents")
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
            supabase_session.client.table("documents")
            .update({"processing_status": "EXPIRED", "updated_at": datetime.now(UTC).isoformat()})
            .eq("id", record["id"]).eq("user_id", record["user_id"])
        )
        removed += 1
    return removed


async def main() -> None:
    try:
        removed = await cleanup_expired_originals()
        logger.info("Removed %s expired originals", removed)
    finally:
        supabase_session.close()


if __name__ == "__main__":
    asyncio.run(main())
