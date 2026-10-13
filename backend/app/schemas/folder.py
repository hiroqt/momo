from datetime import datetime

from pydantic import BaseModel, Field


class FolderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="Folder name")
    color: str | None = Field(None, max_length=64, description="Hex color or theme tag for folder")

class FolderCreateRequest(FolderBase):
    pass

class FolderUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    color: str | None = Field(default=None, max_length=64)

class FolderResponse(FolderBase):
    id: str
    user_id: str
    reviewer_count: int = 0
    created_at: datetime
    updated_at: datetime
