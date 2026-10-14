from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, field_validator, model_validator


class SyncEventItem(BaseModel):
    event_id: str = Field(min_length=1, max_length=128)
    study_item_id: str | None = None
    study_session_id: str | None = None
    result: Literal["correct", "incorrect", "review_again", "skipped", "mastered", "review_later"]
    user_answer: str | None = Field(default=None, max_length=10000)
    occurred_at: AwareDatetime

    @field_validator("study_item_id", "study_session_id")
    @classmethod
    def validate_reference_id(cls, value: str | None) -> str | None:
        return str(UUID(value)) if value is not None else None

    @model_validator(mode="after")
    def require_item_for_correct_result(self) -> SyncEventItem:
        if self.result == "correct" and self.study_item_id is None:
            raise ValueError("Correct-answer sync events require a study item.")
        return self

class SyncBatchRequest(BaseModel):
    events: list[SyncEventItem] = Field(max_length=100)

class SyncBatchResponse(BaseModel):
    accepted_count: int
    ignored_duplicates_count: int
    processed_at: datetime
    synced_ids: list[str] = Field(default_factory=list)
    ignored_duplicates: int = 0
    credits_balance: int | None = None
