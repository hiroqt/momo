from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CitationItem(BaseModel):
    document_id: str
    document_name: str
    page_start: int | None = None
    page_end: int | None = None
    section: str | None = None
    snippet: str

class CreatedDeckMetadata(BaseModel):
    study_set_id: str
    title: str
    item_count: int
    question_types: list[str] = Field(default_factory=list)
    status: str = "COMPLETED"

class StudyCardMetadata(BaseModel):
    id: str | None = None
    question: str
    answer: str
    explanation: str | None = None
    question_type: str = "flashcard"
    options: list[str] | None = None
    topic: str | None = None
    difficulty: str = "medium"
    source_metadata: dict[str, Any] | None = None
    image_base64: str | None = None
    diagram_prompt: str | None = None
    imported: bool = False
    study_set_id: str | None = None

class ImportCardRequest(BaseModel):
    # Untrusted client card; the server re-verifies provenance and support before saving.
    question: str = Field(min_length=1, max_length=2000)
    answer: str = Field(min_length=1, max_length=4000)
    explanation: str | None = Field(default=None, max_length=4000)
    question_type: str = Field(default="flashcard", max_length=40)
    options: list[str] | None = Field(default=None, max_length=10)
    topic: str | None = Field(default="Momo Study Cards", max_length=238)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    source_metadata: dict[str, Any] | None = None
    image_base64: str | None = None

class ToolCallRecord(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    result: Any | None = None

class ChatSessionCreate(BaseModel):
    title: str | None = None

class ChatSessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0

class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    document_id: str | None = None

class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    user_id: str
    role: str
    content: str
    citations: list[CitationItem] | None = None
    created_deck: CreatedDeckMetadata | None = None
    study_card: StudyCardMetadata | None = None
    image_base64: str | None = None
    quick_replies: list[str] | None = None
    tool_calls: list[ToolCallRecord] | None = None
    follow_up_message: ChatMessageResponse | None = None
    created_at: str

class ChatSessionDetailResponse(BaseModel):
    session: ChatSessionResponse
    messages: list[ChatMessageResponse]


class StudyToolArguments(BaseModel):
    """Model-provided tool arguments are a trust boundary, just like API requests."""
    model_config = ConfigDict(strict=True, extra="ignore")
    topic: str | None = Field(default=None, max_length=300)
    count: int = Field(default=10, ge=1, le=50)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    question_types: list[Literal["flashcard", "multiple_choice", "true_false", "identification", "fill_in_the_blank"]] | None = Field(default=None, min_length=1, max_length=5)
    document_id: str | None = Field(default=None, min_length=1, max_length=128)
    custom_instruction: str | None = Field(default=None, max_length=4000)
    allow_ai_generation: bool = False
    source_only: bool = True
