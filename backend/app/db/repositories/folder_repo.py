from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import logging
from app.db.session import supabase_session
from app.db.repositories.study_repo import study_repo

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
    def __init__(self):
        self._folders: Dict[str, Dict[str, Any]] = {}

    async def create_folder(self, data: Dict[str, Any]) -> Dict[str, Any]:
        folder_id = data.get("id") or str(uuid.uuid4())
        data["id"] = folder_id
        now = datetime.now(timezone.utc).isoformat()
        data["created_at"] = data.get("created_at") or now
        data["updated_at"] = data.get("updated_at") or now
        data["reviewer_count"] = 0

        if supabase_session.is_configured and supabase_session.client:
            try:
                # Remove computed reviewer_count before inserting into Supabase
                insert_payload = {k: v for k, v in data.items() if k != "reviewer_count"}
                resp = supabase_session.client.table("folders").insert(insert_payload).execute()
                if resp.data:
                    data = {**resp.data[0], "reviewer_count": 0}
            except Exception as e:
                logger.error(f"Error creating folder in Supabase: {e}")

        self._folders[folder_id] = data
        return data

    async def list_folders(self, user_id: str) -> List[Dict[str, Any]]:
        # Fetch all study sets for user to compute reviewer counts
        study_sets = await study_repo.list_study_sets(user_id)
        counts: Dict[str, int] = {}
        for s in study_sets:
            f_id = s.get("folder_id")
            if f_id:
                counts[f_id] = counts.get(f_id, 0) + 1

        folders_list = []
        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = (
                    supabase_session.client.table("folders")
                    .select("*")
                    .eq("user_id", user_id)
                    .order("created_at")
                    .execute()
                )
                if resp.data:
                    folders_list = resp.data
            except Exception as e:
                logger.error(f"Error listing folders from Supabase: {e}")

        if not folders_list:
            folders_list = [f for f in self._folders.values() if f.get("user_id") == user_id]

        # Attach dynamic reviewer count
        result = []
        for f in folders_list:
            f_copy = dict(f)
            f_copy["reviewer_count"] = counts.get(f_copy["id"], 0)
            result.append(f_copy)

        return result

    async def get_folder(self, folder_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        f = None
        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = (
                    supabase_session.client.table("folders")
                    .select("*")
                    .eq("id", folder_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                if resp.data:
                    f = resp.data[0]
            except Exception as e:
                logger.error(f"Error fetching folder from Supabase: {e}")

        if not f:
            stored = self._folders.get(folder_id)
            if stored and stored.get("user_id") == user_id:
                f = stored

        if not f:
            return None

        # Compute reviewer count
        study_sets = await study_repo.list_study_sets(user_id)
        count = sum(1 for s in study_sets if s.get("folder_id") == folder_id)
        result = dict(f)
        result["reviewer_count"] = count
        return result

    async def update_folder(self, folder_id: str, user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc).isoformat()
        payload = {**updates, "updated_at": now}

        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = (
                    supabase_session.client.table("folders")
                    .update(payload)
                    .eq("id", folder_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                if resp.data:
                    return await self.get_folder(folder_id, user_id)
            except Exception as e:
                logger.error(f"Error updating folder in Supabase: {e}")

        f = self._folders.get(folder_id)
        if f and f.get("user_id") == user_id:
            f.update(payload)
            return await self.get_folder(folder_id, user_id)
        return None

    async def delete_folder(self, folder_id: str, user_id: str) -> bool:
        # 1. Safely unassign all study sets in this folder (never delete sets per AGENTS.md rule 33)
        await study_repo.detach_folder(folder_id, user_id)

        # 2. Delete folder entity
        if supabase_session.is_configured and supabase_session.client:
            try:
                supabase_session.client.table("folders").delete().eq("id", folder_id).eq("user_id", user_id).execute()
            except Exception as e:
                logger.error(f"Error deleting folder from Supabase: {e}")

        if folder_id in self._folders and self._folders[folder_id].get("user_id") == user_id:
            del self._folders[folder_id]
            return True

        return True

folder_repo = FolderRepository()
