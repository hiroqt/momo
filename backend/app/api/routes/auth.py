from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from app.dependencies import get_current_user, AuthenticatedUser
from app.schemas.auth import UserProfileResponse
from app.db.repositories.usage_repo import usage_repo
from app.config import settings

router = APIRouter(prefix="/api", tags=["Auth"])

@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(user: AuthenticatedUser = Depends(get_current_user)):
    used_count = await usage_repo.get_monthly_usage(user.id)
    # Next month start for quota reset
    now = datetime.now(timezone.utc)
    next_month = (now.replace(day=1) + timedelta(days=32)).replace(day=1)

    return UserProfileResponse(
        id=user.id,
        email=user.email or f"{user.id}@example.com",
        full_name="Student Learner",
        avatar_url=None,
        documents_used_this_month=used_count,
        monthly_limit=settings.MONTHLY_DOCUMENT_LIMIT,
        quota_resets_at=next_month
    )
