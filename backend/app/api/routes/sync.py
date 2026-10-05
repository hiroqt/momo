from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from app.db.repositories.learning_repo import learning_repo
from app.db.repositories.sync_repo import sync_repo
from app.db.session import supabase_session
from app.dependencies import AuthenticatedUser, get_current_user
from app.schemas.sync import SyncBatchRequest, SyncBatchResponse

router = APIRouter(prefix="/api/sync", tags=["Sync"])

@router.post("", response_model=SyncBatchResponse)
async def sync_offline_events(
    batch: SyncBatchRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    events_data = [e.model_dump(mode="json") for e in batch.events]
    accepted, ignored, accepted_events = await sync_repo.process_batch(user.id, events_data)

    # Feed accepted study results into the auto-learning mastery engine
    for ev in accepted_events if supabase_session.use_memory else []:
        if ev.get("result") == "skipped":
            continue
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
        processed_at=datetime.now(UTC)
    )
