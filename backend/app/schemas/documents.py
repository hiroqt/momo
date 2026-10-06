from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field, field_validator, model_validator


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
    document_id: str = Field(validation_alias=AliasChoices("id", "document_id"), pattern=r"^[0-9a-fA-F-]{36}$")
    original_filename: str = Field(min_length=1, max_length=255)
    file_type: str
    mime_type: str
    file_size: int = Field(gt=0, le=15*1024*1024)
    s3_object_key: str

    @model_validator(mode="before")
    @classmethod
    def reject_conflicting_identifiers(cls, data: Any) -> Any:
        if isinstance(data, dict) and "id" in data and "document_id" in data:
            try:
                canonical_id = UUID(str(data["id"]))
                legacy_id = UUID(str(data["document_id"]))
            except (ValueError, TypeError, AttributeError):
                raise ValueError("Invalid document identifier.") from None
            if canonical_id != legacy_id:
                raise ValueError("Document identifiers must agree.")
        return data

    @field_validator("document_id")
    @classmethod
    def validate_identifier(cls, value: str) -> str:
        return str(UUID(value))

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
    page_count: int | None = None
