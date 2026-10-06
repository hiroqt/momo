import logging
import uuid
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any

from app.db.session import supabase_session
from app.schemas.study import StudyItemResponse

logger = logging.getLogger(__name__)

class GenerationRepository:
    def __init__(self) -> None:
        self._jobs: dict[str, dict[str, Any]] = {}

    async def create_job(self, data: dict[str, Any]) -> dict[str, Any]:
        job_id = data.get("id") or str(uuid.uuid4())
        data["id"] = job_id
        now = datetime.now(UTC).isoformat()
        data["created_at"] = now
        data["updated_at"] = now

        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("generation_jobs").insert(data))
            return resp.data[0] if resp.data else data

        self._jobs[job_id] = data
        return data

    async def get_job(self, job_id: str, user_id: str) -> dict[str, Any] | None:
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("generation_jobs").select("*").eq("id", job_id).eq("user_id", user_id))
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
        study_set_id: str | None = None,
        error: str | None = None
    ) -> dict[str, Any] | None:
        updates: dict[str, Any] = {
            "status": status,
            "stage": stage,
            "progress": progress,
            "message": message,
            "updated_at": datetime.now(UTC).isoformat()
        }
        if study_set_id:
            updates["study_set_id"] = study_set_id
        if error:
            updates["error"] = error

        if supabase_session.is_configured and supabase_session.client:
            query = supabase_session.client.table("generation_jobs").update(updates).eq("id", job_id).neq("status", "COMPLETED")
            if status != "COMPLETED":
                query = query.is_("study_set_id", "null")
            resp = await supabase_session.execute(query)
            return resp.data[0] if resp.data else None

        if job_id in self._jobs:
            if self._jobs[job_id].get("status") == "COMPLETED" or self._jobs[job_id].get("study_set_id"):
                return self._jobs[job_id]
            self._jobs[job_id].update(updates)
            return self._jobs[job_id]
        return None

    async def complete_with_study_set(
        self, job_id: str, user_id: str, set_payload: dict[str, Any], items: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Commit reviewer contents and job completion together; retries reuse the result."""
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("persist_generated_study_set", {
                "p_job_id": job_id, "p_user_id": user_id, "p_set": set_payload, "p_items": items,
            }))
            return resp.data

        from app.db.repositories.documents_repo import documents_repo
        from app.db.repositories.study_repo import study_repo

        job = self._jobs.get(job_id)
        if not job or job.get("user_id") != user_id:
            raise ValueError("Generation job unavailable")
        existing_id = job.get("study_set_id")
        if existing_id:
            existing = study_repo._study_sets.get(existing_id)
            if not existing or existing.get("user_id") != user_id:
                raise ValueError("Study set unavailable")
            return existing
        if not 1 <= len(items) <= 100 or set_payload.get("user_id", user_id) != user_id:
            raise ValueError("Invalid generated reviewer")
        document_id = set_payload.get("document_id")
        if document_id != job.get("document_id") or documents_repo._store.get(str(document_id), {}).get("user_id") != user_id:
            raise ValueError("Source document unavailable")
        config = set_payload.get("generation_config", {})
        if not isinstance(config, dict) or config.get("source_only", True) is not True:
            raise ValueError("Source-only generation required")
        if set_payload.get("item_count", len(items)) != len(items):
            raise ValueError("Invalid study item count")
        title = set_payload.get("title")
        if not isinstance(title, str) or not title.strip():
            raise ValueError("Reviewer title required")
        set_id = set_payload.get("id") or str(uuid.uuid4())
        if set_id in study_repo._study_sets:
            raise ValueError("Study set already exists")
        now = datetime.now(UTC).isoformat()
        saved_items = []
        used_ids = {item["id"] for saved in study_repo._study_items.values() for item in saved}
        for index, item in enumerate(items):
            if item.get("user_id", user_id) != user_id or item.get("study_set_id", set_id) != set_id:
                raise ValueError("Invalid item ownership")
            record = deepcopy(item)
            record.update({"id": item.get("id") or str(uuid.uuid4()), "study_set_id": set_id,
                           "user_id": user_id, "order_index": index, "created_at": now})
            if record["id"] in used_ids:
                raise ValueError("Study item already exists")
            used_ids.add(record["id"])
            StudyItemResponse.model_validate(record)
            if not all(isinstance(record.get(field), str) and record[field].strip() for field in ("type", "question", "answer")) or record.get("difficulty", "medium") not in {"easy", "medium", "hard"}:
                raise ValueError("Invalid study item")
            metadata = record["source_metadata"]
            if not ("page" in metadata or "section" in metadata):
                raise ValueError("Study item source required")
            evidence_id = metadata.get("document_id")
            if evidence_id and documents_repo._store.get(evidence_id, {}).get("user_id") != user_id:
                raise ValueError("Study item source unavailable")
            saved_items.append(record)
        saved_set = deepcopy(set_payload)
        saved_set.update({"id": set_id, "user_id": user_id, "title": title, "item_count": len(saved_items),
                          "generation_status": "COMPLETED", "created_at": now, "updated_at": now})
        # Validation finishes before these local writes; no await splits the commit.
        study_repo._study_sets[set_id] = saved_set
        study_repo._study_items[set_id] = saved_items
        job.update({"study_set_id": set_id, "status": "COMPLETED", "progress": 100,
                    "stage": "Completed", "message": "Your reviewer is ready.", "error": None, "updated_at": now})
        return saved_set

    async def retry_failed(self, job_id: str, user_id: str) -> dict[str, Any] | None:
        updates = {"status": "PENDING", "stage": "Restarting reviewer generation", "progress": 5,
                   "message": "Retrying generation...", "error": None, "updated_at": datetime.now(UTC).isoformat()}
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("generation_jobs").update(updates).eq("id", job_id).eq("user_id", user_id).eq("status", "FAILED"))
            return resp.data[0] if resp.data else None
        job = self._jobs.get(job_id)
        if job and job.get("user_id") == user_id and job.get("status") == "FAILED":
            job.update(updates)
            return job
        return None

generation_repo = GenerationRepository()
