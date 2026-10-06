from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StudySetCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10000)
    folder_id: UUID | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty.")
        return value


class StudySetUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=10000)
    folder_id: str | None = Field(None, max_length=64)


class SourceMetadata(BaseModel):
    chunk_id: str | None = None
    source_id: int | None = None
    document_id: str | None = None
    document_name: str | None = None
    page: int | None = None
    section: str | None = None
    snippet: str | None = None

class StudyItemResponse(BaseModel):
    id: str
    study_set_id: str
    type: str

    @field_validator('type', mode='before')
    @classmethod
    def normalize_explanation_alias(cls, value: str) -> str:
        return 'topic_explanation' if value == 'explanation' else value

    question: str
    answer: str
    explanation: str | None = None
    hint: str | None = None
    options: list[str] | None = None
    difficulty: str = "medium"
    image_base64: str | None = None
    source_metadata: SourceMetadata
    order_index: int = 0
    created_at: datetime

class StudySetResponse(BaseModel):
    id: str
    user_id: str
    document_id: str | None = None
    folder_id: str | None = None
    title: str
    description: str | None = None
    item_count: int = 0
    generation_status: str | None = None
    generation_config: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

class StudySetDetailResponse(StudySetResponse):
    study_items: list[StudyItemResponse] = Field(default_factory=list)


class StudySessionCreate(BaseModel):
    study_set_id: str = Field(max_length=64)
    mode: Literal["flashcards", "quiz", "exam"] = "flashcards"

class StudySessionAnswer(BaseModel):
    study_item_id: str
    result: str # 'correct', 'incorrect', 'review_again'
    user_answer: str | None = None

class StudySessionResponse(BaseModel):
    id: str
    user_id: str
    study_set_id: str
    mode: str
    started_at: datetime
    completed_at: datetime | None = None
    total_items: int
    correct_count: int
    incorrect_count: int
    score_percent: float
