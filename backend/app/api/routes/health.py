"""Bounded database readiness; liveness remains independent at /health."""
import asyncio
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.db.session import supabase_session

router = APIRouter(tags=["Health"])
logger = logging.getLogger(__name__)
READINESS_TIMEOUT_SECONDS = 3


@router.get("/ready")
async def readiness():
    if supabase_session.use_memory:
        return {"status": "ready", "database": "local_memory"}
    try:
        client = supabase_session.require_client()
        # Metadata-only request: no profile fields or document bytes returned.
        await asyncio.wait_for(
            supabase_session.execute(client.table("users").select("id", head=True).limit(1)),
            timeout=READINESS_TIMEOUT_SECONDS,
        )
    except Exception as exc:  # noqa: BLE001 - probe must expose only controlled status
        logger.warning("Database readiness failed (%s)", type(exc).__name__)
        return JSONResponse(status_code=503, content={"status": "not_ready", "database": "unavailable"})
    return {"status": "ready", "database": "available"}
