"""Owner-scoped idempotent sync with durable database-side conflict handling."""
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException

from app.db.session import supabase_session


class SyncRepository:
    def __init__(self) -> None:
        self._seen_events: set[tuple[str, str]] = set()
        self._events: list[dict[str, Any]] = []

    async def process_batch(self, user_id: str, events: list[dict[str, Any]]) -> tuple[int, int, list[dict[str, Any]]]:
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("process_sync_batch", {"p_user_id": user_id, "p_events": events}))
            result = resp.data
            accepted_ids = set(result["accepted_event_ids"])
            accepted_events = []
            for event in events:
                if event["event_id"] in accepted_ids:
                    accepted_events.append(event)
                    accepted_ids.remove(event["event_id"])
            return result["accepted_count"], result["ignored_duplicates_count"], accepted_events
        from app.db.repositories.study_repo import study_repo
        # Validate the entire batch before committing any event.
        for event in events:
            item_id = event.get("study_item_id")
            session_id = event.get("study_session_id")
            if item_id:
                owned = any(item.get("id") == item_id and study_repo._study_sets.get(set_id, {}).get("user_id") == user_id for set_id, items in study_repo._study_items.items() for item in items)
                if not owned:
                    raise HTTPException(404, detail={"code": "STUDY_ITEM_NOT_FOUND", "message": "Study item not found."})
            if session_id and study_repo._sessions.get(session_id, {}).get("user_id") != user_id:
                raise HTTPException(404, detail={"code": "STUDY_SESSION_NOT_FOUND", "message": "Study session not found."})
            if item_id and session_id:
                set_id = study_repo._sessions[session_id]["study_set_id"]
                if not any(item.get("id") == item_id for item in study_repo._study_items.get(set_id, [])):
                    raise HTTPException(404, detail={"code": "STUDY_ITEM_NOT_FOUND", "message": "Study item not found."})
        accepted_events = []
        ignored = 0
        for event in events:
            key = (user_id, event["event_id"])
            if key in self._seen_events:
                ignored += 1
                continue
            self._seen_events.add(key)
            self._events.append({**event, "user_id": user_id, "synced_at": datetime.now(UTC).isoformat()})
            accepted_events.append(event)
        return len(accepted_events), ignored, accepted_events

sync_repo = SyncRepository()
