from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class SyncEventItem(BaseModel):
    event_id: str
    study_item_id: Optional[str] = None
    study_session_id: Optional[str] = None
    result: str # 'correct', 'incorrect', 'review_again', 'skipped'
    user_answer: Optional[str] = None
    occurred_at: datetime

class SyncBatchRequest(BaseModel):
    events: List[SyncEventItem]

class SyncBatchResponse(BaseModel):
    accepted_count: int
    ignored_duplicates_count: int
    processed_at: datetime
