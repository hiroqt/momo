from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from app.dependencies import get_current_user, AuthenticatedUser
from app.schemas.sync import SyncBatchRequest, SyncBatchResponse
from app.db.repositories.sync_repo import sync_repo
from app.db.repositories.learning_repo import learning_repo

router = APIRouter(prefix="/api/sync", tags=["Sync"])

@router.post("", response_model=SyncBatchResponse)
async def sync_offline_events(
    batch: SyncBatchRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    events_data = [e.model_dump() for e in batch.events]
    accepted, ignored = await sync_repo.process_batch(user.id, events_data)

    # Feed accepted study results into the auto-learning mastery engine
    for ev in events_data:
        await learning_repo.record_study_event(
            user_id=user.id,
            item_id=ev.get("study_item_id"),
            result=ev.get("result"),
            user_answer=ev.get("user_answer"),
            occurred_at=ev.get("occurred_at")
        )

    return SyncBatchResponse(
        accepted_count=accepted,
        ignored_duplicates_count=ignored,
        processed_at=datetime.now(timezone.utc)
    )
