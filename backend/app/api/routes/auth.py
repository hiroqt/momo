import asyncio
import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from supabase_auth.errors import AuthApiError

from app.config import settings
from app.db.repositories.profile_repo import profile_repo
from app.db.repositories.usage_repo import usage_repo
from app.db.session import supabase_session
from app.dependencies import AuthenticatedUser, get_current_user
from app.schemas.auth import AccountDeletionResponse, UserProfileResponse

router = APIRouter(prefix="/api", tags=["Auth"])
logger = logging.getLogger(__name__)


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(user: AuthenticatedUser = Depends(get_current_user)):
    """Return verified identity plus persisted profile facts; unknown facts are null, never invented."""
    used_count = await usage_repo.get_monthly_usage(user.id)
    profile = await profile_repo.get_profile(user.id) or {}
    now = datetime.now(UTC)
    next_month = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) + timedelta(days=32)).replace(day=1)
    return UserProfileResponse(
        id=user.id,
        email=profile.get("email") or user.email or None,
        full_name=profile.get("full_name") or None,
        avatar_url=profile.get("avatar_url") or None,
        documents_used_this_month=used_count,
        monthly_limit=settings.MONTHLY_DOCUMENT_LIMIT,
        quota_resets_at=next_month,
    )


@router.delete("/me", response_model=AccountDeletionResponse, status_code=status.HTTP_202_ACCEPTED)
async def delete_current_user_account(user: AuthenticatedUser = Depends(get_current_user)):
    """Delete only the authenticated account; upload tickets enqueue object cleanup."""
    try:
        client = supabase_session.require_client()
        await asyncio.to_thread(client.auth.admin.delete_user, user.id)
    except Exception as exc:  # noqa: BLE001 - Auth Admin boundary; redact provider failures
        if isinstance(exc, AuthApiError) and exc.status == 404 and exc.code == "user_not_found":
            # The first delete may have succeeded even when its HTTP response was lost.
            return AccountDeletionResponse()
        logger.warning("Account deletion failed (%s)", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ACCOUNT_DELETION_UNAVAILABLE", "message": "Account deletion is temporarily unavailable."},
        ) from None
    return AccountDeletionResponse()
