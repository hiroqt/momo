from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class CitationItem(BaseModel):
    document_id: str
    document_name: str
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    section: Optional[str] = None
    snippet: str

class CreatedDeckMetadata(BaseModel):
    study_set_id: str
    title: str
    item_count: int
    question_types: List[str] = Field(default_factory=list)
    status: str = "COMPLETED"

class StudyCardMetadata(BaseModel):
    id: Optional[str] = None
    question: str
    answer: str
    explanation: Optional[str] = None
    question_type: str = "flashcard"
    options: Optional[List[str]] = None
    topic: Optional[str] = None
    difficulty: str = "medium"
    image_base64: Optional[str] = None
    diagram_prompt: Optional[str] = None
    imported: bool = False
    study_set_id: Optional[str] = None

class ImportCardRequest(BaseModel):
    question: str
    answer: str
    explanation: Optional[str] = None
    question_type: str = "flashcard"
    options: Optional[List[str]] = None
    topic: Optional[str] = "Momo Study Cards"
    difficulty: str = "medium"
    image_base64: Optional[str] = None

class ToolCallRecord(BaseModel):
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[Any] = None

class ChatSessionCreate(BaseModel):
    title: Optional[str] = None

class ChatSessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0

class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    document_id: Optional[str] = None

class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    user_id: str
    role: str
    content: str
    citations: Optional[List[CitationItem]] = None
    created_deck: Optional[CreatedDeckMetadata] = None
    study_card: Optional[StudyCardMetadata] = None
    quick_replies: Optional[List[str]] = None
    tool_calls: Optional[List[ToolCallRecord]] = None
    created_at: str

class ChatSessionDetailResponse(BaseModel):
    session: ChatSessionResponse
    messages: List[ChatMessageResponse]
