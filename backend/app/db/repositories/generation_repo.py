from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid
from app.db.session import supabase_session
import logging

logger = logging.getLogger(__name__)

class GenerationRepository:
    def __init__(self):
        self._jobs: Dict[str, Dict[str, Any]] = {}

    async def create_job(self, data: Dict[str, Any]) -> Dict[str, Any]:
        job_id = data.get("id") or str(uuid.uuid4())
        data["id"] = job_id
        now = datetime.now(timezone.utc).isoformat()
        data["created_at"] = now
        data["updated_at"] = now

        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("generation_jobs").insert(data).execute()
                return resp.data[0] if resp.data else data
            except Exception as e:
                logger.error(f"Error creating generation job in Supabase: {e}")

        self._jobs[job_id] = data
        return data

    async def get_job(self, job_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        if supabase_session.is_configured and supabase_session.client:
            resp = supabase_session.client.table("generation_jobs").select("*").eq("id", job_id).eq("user_id", user_id).execute()
            return resp.data[0] if resp.data else None

        job = self._jobs.get(job_id)
        if job and job.get("user_id") == user_id:
            return job
        return None

    async def update_job(
        self,
        job_id: str,
        status: str,
        stage: str,
        progress: int,
        message: str,
        study_set_id: Optional[str] = None,
        error: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        updates: Dict[str, Any] = {
            "status": status,
            "stage": stage,
            "progress": progress,
            "message": message,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        if study_set_id:
            updates["study_set_id"] = study_set_id
        if error:
            updates["error"] = error

        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("generation_jobs").update(updates).eq("id", job_id).execute()
                return resp.data[0] if resp.data else None
            except Exception as e:
                logger.error(f"Error updating generation job in Supabase: {e}")

        if job_id in self._jobs:
            self._jobs[job_id].update(updates)
            return self._jobs[job_id]
        return None

generation_repo = GenerationRepository()
