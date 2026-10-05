import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from app.db.session import page_range, supabase_session

logger = logging.getLogger(__name__)

class StudyRepository:
    def __init__(self) -> None:
        self._study_sets: dict[str, dict[str, Any]] = {}
        self._study_items: dict[str, list[dict[str, Any]]] = {} # set_id -> items
        self._sessions: dict[str, dict[str, Any]] = {}

    async def create_study_set(self, data: dict[str, Any]) -> dict[str, Any]:
        set_id = data.get("id") or str(uuid.uuid4())
        data["id"] = set_id
        now = datetime.now(UTC).isoformat()
        data["created_at"] = data.get("created_at") or now
        data["updated_at"] = data.get("updated_at") or now
        data["item_count"] = data.get("item_count", 0)

        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("study_sets").insert(data))
            return resp.data[0] if resp.data else data

        self._study_sets[set_id] = data
        return data

    async def get_study_set(self, set_id: str, user_id: str) -> dict[str, Any] | None:
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("study_sets").select("*").eq("id", set_id).eq("user_id", user_id))
            return resp.data[0] if resp.data else None

        s = self._study_sets.get(set_id)
        if s and s.get("user_id") == user_id:
            return s
        return None

    async def get_by_title(self, title: str, user_id: str) -> dict[str, Any] | None:
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("study_sets").select("*").eq("user_id", user_id).eq("title", title).order("created_at").limit(1))
            return resp.data[0] if resp.data else None
        return next((row for row in self._study_sets.values() if row.get("user_id") == user_id and row.get("title") == title), None)

    async def update_study_set(self, set_id: str, user_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        now = datetime.now(UTC).isoformat()
        payload = {**updates, "updated_at": now}

        if supabase_session.is_configured and supabase_session.client:
            resp = (
                await supabase_session.execute(supabase_session.client.table("study_sets")
                .update(payload)
                .eq("id", set_id)
                .eq("user_id", user_id))
            )
            return resp.data[0] if resp.data else None

        s = self._study_sets.get(set_id)
        if s and s.get("user_id") == user_id:
            s.update(payload)
            return s
        return None

    async def list_study_sets(self, user_id: str, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        start, end = page_range(limit, offset)
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("study_sets").select("*").eq("user_id", user_id).order("created_at", desc=True).order("id").range(start, end))
            return resp.data or []

        rows = sorted([s for s in self._study_sets.values() if s.get("user_id") == user_id], key=lambda row: row["created_at"], reverse=True)
        return rows[start:end + 1]

    async def delete_study_set(self, set_id: str, user_id: str) -> bool:
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("study_sets").delete().eq("id", set_id).eq("user_id", user_id))
            return bool(resp.data)

        if set_id in self._study_sets and self._study_sets[set_id].get("user_id") == user_id:
            del self._study_sets[set_id]
            self._study_items.pop(set_id, None)
            return True
        return False

    async def detach_folder(self, folder_id: str, user_id: str) -> None:
        if supabase_session.is_configured and supabase_session.client:
            await supabase_session.execute(supabase_session.client.table("study_sets").update({"folder_id": None}).eq("folder_id", folder_id).eq("user_id", user_id))

        for s in self._study_sets.values():
            if s.get("user_id") == user_id and s.get("folder_id") == folder_id:
                s["folder_id"] = None

    async def save_study_items(self, set_id: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        saved = []
        for idx, item in enumerate(items):
            item_id = item.get("id") or str(uuid.uuid4())
            item["id"] = item_id
            item["study_set_id"] = set_id
            item["order_index"] = idx
            item["created_at"] = datetime.now(UTC).isoformat()
            saved.append(item)

        if supabase_session.is_configured and supabase_session.client:
            await supabase_session.execute(supabase_session.client.table("study_items").insert(saved))
            # Update item count in set
            await supabase_session.execute(supabase_session.client.table("study_sets").update({"item_count": len(saved)}).eq("id", set_id))
            return saved

        self._study_items[set_id] = saved
        if set_id in self._study_sets:
            self._study_sets[set_id]["item_count"] = len(saved)
        return saved

    async def get_study_items(self, set_id: str, user_id: str) -> list[dict[str, Any]]:
        if not await self.get_study_set(set_id, user_id):
            return []
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("study_items").select("*").eq("study_set_id", set_id).eq("user_id", user_id).order("order_index"))
            return resp.data or []

        return self._study_items.get(set_id, [])

    async def create_session(self, session_data: dict[str, Any]) -> dict[str, Any]:
        sess_id = session_data.get("id") or str(uuid.uuid4())
        session_data["id"] = sess_id
        session_data["started_at"] = datetime.now(UTC).isoformat()

        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("study_sessions").insert(session_data))
            return resp.data[0] if resp.data else session_data

        self._sessions[sess_id] = session_data
        return session_data

study_repo = StudyRepository()
