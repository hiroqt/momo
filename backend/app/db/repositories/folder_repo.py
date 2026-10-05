import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException

from app.db.repositories.study_repo import study_repo
from app.db.session import page_range, supabase_session

logger = logging.getLogger(__name__)

def calculate_folder_credit_cost(existing_count: int) -> int:
    """
    Calculates the credit cost for creating the next folder.
    First 3 folders (counts 0, 1, 2) are free (0 credits).
    4th folder (count 3) = 50 credits.
    5th folder (count 4) = 75 credits.
    Nth folder (count >= 3) = 50 + (count - 3) * 25 credits.
    """
    if existing_count < 3:
        return 0
    return 50 + (existing_count - 3) * 25

class FolderRepository:
    def __init__(self) -> None:
        self._folders: dict[str, dict[str, Any]] = {}

    def _validate_unique_name(self, user_id: str, name: str, exclude_id: str | None = None) -> None:
        if any(row.get("user_id") == user_id and row["id"] != exclude_id and row["name"].strip().lower() == name.strip().lower() for row in self._folders.values()):
            raise HTTPException(409, detail={"code": "FOLDER_NAME_EXISTS", "message": "A folder with this name already exists."})

    async def create_folder(self, data: dict[str, Any]) -> dict[str, Any]:
        if supabase_session.use_memory:
            self._validate_unique_name(data["user_id"], data["name"])
        folder_id = data.get("id") or str(uuid.uuid4())
        data["id"] = folder_id
        now = datetime.now(UTC).isoformat()
        data["created_at"] = data.get("created_at") or now
        data["updated_at"] = data.get("updated_at") or now
        data["reviewer_count"] = 0

        if supabase_session.is_configured and supabase_session.client:
            insert_payload = {k: v for k, v in data.items() if k != "reviewer_count"}
            resp = await supabase_session.execute(supabase_session.client.table("folders").insert(insert_payload))
            if resp.data:
                data = {**resp.data[0], "reviewer_count": 0}

        if supabase_session.use_memory:
            self._folders[folder_id] = data
        return data

    async def list_folders(self, user_id: str, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        start, end = page_range(limit, offset)
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("list_folders_with_counts", {"p_user_id": user_id, "p_limit": limit, "p_offset": offset}))
            return resp.data or []
        # Fetch all study sets for user to compute reviewer counts
        study_sets = [s for s in study_repo._study_sets.values() if s.get("user_id") == user_id]
        counts: dict[str, int] = {}
        for s in study_sets:
            f_id = s.get("folder_id")
            if f_id:
                counts[f_id] = counts.get(f_id, 0) + 1

        folders_list = []
        if supabase_session.is_configured and supabase_session.client:
            resp = (
                await supabase_session.execute(supabase_session.client.table("folders")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at"))
            )
            if resp.data:
                folders_list = resp.data

        if supabase_session.use_memory:
            folders_list = [f for f in self._folders.values() if f.get("user_id") == user_id]

        # Attach dynamic reviewer count
        result = []
        for f in folders_list:
            f_copy = dict(f)
            f_copy["reviewer_count"] = counts.get(f_copy["id"], 0)
            result.append(f_copy)

        return sorted(result, key=lambda row: (row["created_at"], row["id"]))[start:end + 1]

    async def get_folder(self, folder_id: str, user_id: str) -> dict[str, Any] | None:
        f = None
        if supabase_session.is_configured and supabase_session.client:
            resp = (
                await supabase_session.execute(supabase_session.client.table("folders")
                .select("*")
                .eq("id", folder_id)
                .eq("user_id", user_id))
            )
            if resp.data:
                f = resp.data[0]

        if not f and supabase_session.use_memory:
            stored = self._folders.get(folder_id)
            if stored and stored.get("user_id") == user_id:
                f = stored

        if not f:
            return None

        # Compute reviewer count
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("study_sets").select("id", count="exact", head=True).eq("folder_id", folder_id).eq("user_id", user_id))
            count = resp.count or 0
        else:
            study_sets = [s for s in study_repo._study_sets.values() if s.get("user_id") == user_id]
            count = sum(1 for s in study_sets if s.get("folder_id") == folder_id)
        result = dict(f)
        result["reviewer_count"] = count
        return result

    async def update_folder(self, folder_id: str, user_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        now = datetime.now(UTC).isoformat()
        payload = {**updates, "updated_at": now}

        if supabase_session.is_configured and supabase_session.client:
            resp = (
                await supabase_session.execute(supabase_session.client.table("folders")
                .update(payload)
                .eq("id", folder_id)
                .eq("user_id", user_id))
            )
            if resp.data:
                return await self.get_folder(folder_id, user_id)
            return None

        f = self._folders.get(folder_id)
        if f and f.get("user_id") == user_id:
            if "name" in updates:
                self._validate_unique_name(user_id, updates["name"], folder_id)
            f.update(payload)
            return await self.get_folder(folder_id, user_id)
        return None

    async def delete_folder(self, folder_id: str, user_id: str) -> bool:
        # 1. Safely unassign all study sets in this folder (never delete sets per AGENTS.md rule 33)
        await study_repo.detach_folder(folder_id, user_id)

        # 2. Delete folder entity
        if supabase_session.is_configured and supabase_session.client:
            await supabase_session.execute(supabase_session.client.table("folders").delete().eq("id", folder_id).eq("user_id", user_id))

        if folder_id in self._folders and self._folders[folder_id].get("user_id") == user_id:
            del self._folders[folder_id]
            return True

        return True

folder_repo = FolderRepository()
