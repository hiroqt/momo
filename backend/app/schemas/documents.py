from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class UploadUrlRequest(BaseModel):
    filename: str
    file_type: str = Field(..., description="pdf, docx, txt, or pptx")
    file_size: int = Field(..., description="File size in bytes")
    mime_type: str

class UploadUrlResponse(BaseModel):
    upload_url: str
    s3_object_key: str
    document_id: str
    expires_in_seconds: int

class DocumentCreate(BaseModel):
    document_id: str
    original_filename: str
    file_type: str
    mime_type: str
    file_size: int
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
    processing_error: Optional[str] = None
    created_at: datetime
    suggested_topics: List[str] = Field(default_factory=list)

class DocumentStatusResponse(BaseModel):
    document_id: str
    status: str
    stage: str
    progress: int
    error: Optional[str] = None
    suggested_topics: List[str] = Field(default_factory=list)
