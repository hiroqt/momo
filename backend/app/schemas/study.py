from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime

class StudySetUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    folder_id: Optional[str] = None


class SourceMetadata(BaseModel):
    document_id: Optional[str] = None
    document_name: Optional[str] = None
    page: Optional[int] = None
    section: Optional[str] = None
    snippet: Optional[str] = None

class StudyItemResponse(BaseModel):
    id: str
    study_set_id: str
    type: str
    question: str
    answer: str
    explanation: Optional[str] = None
    hint: Optional[str] = None
    options: Optional[List[str]] = None
    difficulty: str = "medium"
    image_base64: Optional[str] = None
    source_metadata: SourceMetadata
    order_index: int = 0
    created_at: datetime

class StudySetResponse(BaseModel):
    id: str
    user_id: str
    document_id: Optional[str] = None
    folder_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    item_count: int = 0
    generation_config: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

class StudySessionCreate(BaseModel):
    study_set_id: str
    mode: str = "flashcards" # 'flashcards', 'quiz', 'exam'

class StudySessionAnswer(BaseModel):
    study_item_id: str
    result: str # 'correct', 'incorrect', 'review_again'
    user_answer: Optional[str] = None

class StudySessionResponse(BaseModel):
    id: str
    user_id: str
    study_set_id: str
    mode: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    total_items: int
    correct_count: int
    incorrect_count: int
    score_percent: float
