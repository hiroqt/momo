from datetime import datetime
from typing import Literal

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


class AccountDeletionResponse(BaseModel):
    status: Literal["accepted"] = "accepted"
    message: str = "Account deletion was accepted. Original-file cleanup may take time; files missing from the upload inventory need separate cleanup."
