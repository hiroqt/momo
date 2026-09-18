from typing import List, Dict, Any, Tuple
from datetime import datetime, timezone
from app.db.session import supabase_session
import logging

logger = logging.getLogger(__name__)

class SyncRepository:
    def __init__(self):
        # Set of seen event IDs for idempotency
        self._seen_events: set = set()
        self._events: List[Dict[str, Any]] = []

    async def process_batch(self, user_id: str, events: List[Dict[str, Any]]) -> Tuple[int, int]:
        accepted = 0
        ignored = 0
        to_insert = []

        for ev in events:
            eid = ev.get("event_id")
            if not eid:
                continue

            # Idempotency check
            if eid in self._seen_events:
                ignored += 1
                continue

            self._seen_events.add(eid)
            ev_record = {
                "event_id": eid,
                "user_id": user_id,
                "study_item_id": ev.get("study_item_id"),
                "study_session_id": ev.get("study_session_id"),
                "result": ev.get("result"),
                "user_answer": ev.get("user_answer"),
                "occurred_at": ev.get("occurred_at"),
                "synced_at": datetime.now(timezone.utc).isoformat()
            }
            to_insert.append(ev_record)
            self._events.append(ev_record)
            accepted += 1

        if supabase_session.is_configured and supabase_session.client and to_insert:
            try:
                # Upsert or ignore on conflict
                supabase_session.client.table("sync_events").upsert(to_insert, on_conflict="event_id").execute()
            except Exception as e:
                logger.error(f"Error persisting sync events to Supabase: {e}")

        return accepted, ignored

sync_repo = SyncRepository()
