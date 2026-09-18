from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    documents_used_this_month: int
    monthly_limit: int
    quota_resets_at: datetime
