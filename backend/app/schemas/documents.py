from datetime import datetime

from pydantic import BaseModel, Field


class UploadUrlRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    file_type: str = Field(..., description="pdf, docx, txt, or pptx")
    file_size: int = Field(..., gt=0, le=15*1024*1024, description="File size in bytes")
    mime_type: str

class UploadUrlResponse(BaseModel):
    upload_url: str
    s3_object_key: str
    document_id: str
    expires_in_seconds: int

class DocumentCreate(BaseModel):
    document_id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")
    original_filename: str = Field(min_length=1, max_length=255)
    file_type: str
    mime_type: str
    file_size: int = Field(gt=0, le=15*1024*1024)
    s3_object_key: str

class DocumentResponse(BaseModel):
    id: str
    user_id: str
    original_filename: str
    file_type: str
    mime_type: str
    file_size: int
    page_count: int
    uploaded_at: datetime
    expires_at: datetime
    processing_status: str
    processing_error: str | None = None
    created_at: datetime
    suggested_topics: list[str] = Field(default_factory=list)

class DocumentStatusResponse(BaseModel):
    document_id: str
    status: str
    stage: str
    progress: int
    error: str | None = None
    suggested_topics: list[str] = Field(default_factory=list)
