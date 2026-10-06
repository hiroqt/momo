from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends

from app.config import settings
from app.db.repositories.profile_repo import profile_repo
from app.db.repositories.usage_repo import usage_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.schemas.auth import UserProfileResponse

router = APIRouter(prefix="/api", tags=["Auth"])


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
