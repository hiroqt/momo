from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class FolderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="Folder name")
    color: Optional[str] = Field(None, description="Hex color or theme tag for folder")

class FolderCreateRequest(FolderBase):
    pass

class FolderUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = None

class FolderResponse(FolderBase):
    id: str
    user_id: str
    reviewer_count: int = 0
    created_at: datetime
    updated_at: datetime
