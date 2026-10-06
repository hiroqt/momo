from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# PRD 6.2 study formats plus the existing reviewer formats. "explanation" is a
# legacy alias that the validator canonicalizes to "topic_explanation".
QuestionType = Literal[
    "flashcard", "multiple_choice", "true_false", "identification", "fill_in_the_blank",
    "summary", "qa", "topic_explanation", "explanation",
]
ReviewerType = Literal[
    "glossary", "concept_outline", "cheat_sheet", "compare_contrast", "qa_study_sheet",
    "timeline_process", "summary", "qa", "topic_explanation", "explanation",
]


class GenerationCreateRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=128)
    document_ids: list[str] | None = Field(default=None, max_length=10)
    generation_mode: Literal["reviewer", "quiz", "both"] | None = "reviewer"
    content_level: Literal["light", "moderate", "detailed"] | None = "moderate"
    reviewer_types: list[ReviewerType] | None = Field(
        default=["glossary", "concept_outline", "cheat_sheet", "compare_contrast", "qa_study_sheet", "timeline_process"],
        max_length=10,
    )
    topic: str | None = Field(default="General Review", max_length=300)
    count: int = Field(default=20, ge=1, le=50)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    question_types: list[QuestionType] = Field(default=["flashcard", "multiple_choice"], max_length=9)
    source_only: Literal[True] = True
    custom_instruction: str | None = Field(default=None, max_length=4000)
    academic_level: Literal["Grade 9", "Grade 10", "Grade 11", "Grade 12", "1st Year", "2nd Year", "3rd Year", "4th Year", "Grad"] | None = None
    learner_focus: str | None = Field(default=None, max_length=80)
    title: str | None = Field(default=None, max_length=255)
    focus_sections: list[str] | None = Field(default=None, max_length=20)
    time_limit_per_question: int | None = Field(default=None, ge=1, le=3600)

class GenerationJobResponse(BaseModel):
    generation_id: str
    document_id: str
    status: str
    stage: str
    progress: int
    message: str
    study_set_id: str | None = None
    generation_config: dict | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime

class InsufficientSourceResponse(BaseModel):
    status: str = "insufficient_source"
    message: str = "The uploaded material does not contain enough information about the requested topic."
