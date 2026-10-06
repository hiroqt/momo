from datetime import datetime

from pydantic import BaseModel


class UserProfileResponse(BaseModel):
    id: str
    # Null when neither the persisted profile nor the verified token provides it.
    email: str | None = None
    full_name: str | None = None
    avatar_url: str | None = None
    documents_used_this_month: int
    monthly_limit: int
    quota_resets_at: datetime
