from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

class GenerationCreateRequest(BaseModel):
    document_id: str
    topic: Optional[str] = "General Review"
    count: int = Field(default=20, ge=1, le=50)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    question_types: List[str] = Field(default=["flashcard", "multiple_choice"])
    source_only: bool = True
    custom_instruction: Optional[str] = None
    academic_level: Optional[Literal["Grade 9", "Grade 10", "Grade 11", "Grade 12", "1st Year", "2nd Year", "3rd Year", "4th Year", "Grad"]] = None
    learner_focus: Optional[str] = Field(default=None, max_length=80)
    title: Optional[str] = None
    focus_sections: Optional[List[str]] = None
    time_limit_per_question: Optional[int] = None

class GenerationJobResponse(BaseModel):
    generation_id: str
    document_id: str
    status: str
    stage: str
    progress: int
    message: str
    study_set_id: Optional[str] = None
    generation_config: Optional[dict] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class InsufficientSourceResponse(BaseModel):
    status: str = "insufficient_source"
    message: str = "The uploaded material does not contain enough information about the requested topic."
