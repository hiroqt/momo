from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
from app.db.session import supabase_session
import logging

logger = logging.getLogger(__name__)

class StudyRepository:
    def __init__(self):
        self._study_sets: Dict[str, Dict[str, Any]] = {}
        self._study_items: Dict[str, List[Dict[str, Any]]] = {} # set_id -> items
        self._sessions: Dict[str, Dict[str, Any]] = {}

    async def create_study_set(self, data: Dict[str, Any]) -> Dict[str, Any]:
        set_id = data.get("id") or str(uuid.uuid4())
        data["id"] = set_id
        now = datetime.now(timezone.utc).isoformat()
        data["created_at"] = data.get("created_at") or now
        data["updated_at"] = data.get("updated_at") or now

        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("study_sets").insert(data).execute()
                return resp.data[0] if resp.data else data
            except Exception as e:
                logger.error(f"Error creating study set in Supabase: {e}")

        self._study_sets[set_id] = data
        return data

    async def get_study_set(self, set_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        if supabase_session.is_configured and supabase_session.client:
            resp = supabase_session.client.table("study_sets").select("*").eq("id", set_id).eq("user_id", user_id).execute()
            return resp.data[0] if resp.data else None

        s = self._study_sets.get(set_id)
        if s and s.get("user_id") == user_id:
            return s
        return None

    async def update_study_set(self, set_id: str, user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc).isoformat()
        payload = {**updates, "updated_at": now}

        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = (
                    supabase_session.client.table("study_sets")
                    .update(payload)
                    .eq("id", set_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                return resp.data[0] if resp.data else None
            except Exception as e:
                logger.error(f"Error updating study set in Supabase: {e}")
                return None

        s = self._study_sets.get(set_id)
        if s and s.get("user_id") == user_id:
            s.update(payload)
            return s
        return None

    async def list_study_sets(self, user_id: str) -> List[Dict[str, Any]]:
        if supabase_session.is_configured and supabase_session.client:
            resp = supabase_session.client.table("study_sets").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
            return resp.data or []

        return [s for s in self._study_sets.values() if s.get("user_id") == user_id]

    async def delete_study_set(self, set_id: str, user_id: str) -> bool:
        if supabase_session.is_configured and supabase_session.client:
            supabase_session.client.table("study_sets").delete().eq("id", set_id).eq("user_id", user_id).execute()
            return True

        if set_id in self._study_sets and self._study_sets[set_id].get("user_id") == user_id:
            del self._study_sets[set_id]
            self._study_items.pop(set_id, None)
            return True
        return False

    async def save_study_items(self, set_id: str, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        saved = []
        for idx, item in enumerate(items):
            item_id = item.get("id") or str(uuid.uuid4())
            item["id"] = item_id
            item["study_set_id"] = set_id
            item["order_index"] = idx
            item["created_at"] = datetime.now(timezone.utc).isoformat()
            saved.append(item)

        if supabase_session.is_configured and supabase_session.client:
            try:
                supabase_session.client.table("study_items").insert(saved).execute()
                # Update item count in set
                supabase_session.client.table("study_sets").update({"item_count": len(saved)}).eq("id", set_id).execute()
                return saved
            except Exception as e:
                logger.error(f"Error saving study items in Supabase: {e}")

        self._study_items[set_id] = saved
        if set_id in self._study_sets:
            self._study_sets[set_id]["item_count"] = len(saved)
        return saved

    async def get_study_items(self, set_id: str) -> List[Dict[str, Any]]:
        if supabase_session.is_configured and supabase_session.client:
            resp = supabase_session.client.table("study_items").select("*").eq("study_set_id", set_id).order("order_index").execute()
            return resp.data or []

        return self._study_items.get(set_id, [])

    async def create_session(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        sess_id = session_data.get("id") or str(uuid.uuid4())
        session_data["id"] = sess_id
        session_data["started_at"] = datetime.now(timezone.utc).isoformat()

        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("study_sessions").insert(session_data).execute()
                return resp.data[0] if resp.data else session_data
            except Exception as e:
                logger.error(f"Error creating session in Supabase: {e}")

        self._sessions[sess_id] = session_data
        return session_data

study_repo = StudyRepository()
