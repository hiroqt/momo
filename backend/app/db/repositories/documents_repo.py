from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
from app.db.session import supabase_session
import logging

logger = logging.getLogger(__name__)

class DocumentsRepository:
    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}

    async def create(self, doc_data: Dict[str, Any]) -> Dict[str, Any]:
        doc_id = doc_data.get("id") or str(uuid.uuid4())
        doc_data["id"] = doc_id
        if "created_at" not in doc_data:
            doc_data["created_at"] = datetime.now(timezone.utc).isoformat()
        if "updated_at" not in doc_data:
            doc_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("documents").insert(doc_data).execute()
                return resp.data[0] if resp.data else doc_data
            except Exception as e:
                logger.warning(f"Supabase error in create document: {e}. Falling back to in-memory store.")

        self._store[doc_id] = doc_data
        return doc_data

    async def get_by_id(self, doc_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("documents").select("*").eq("id", doc_id).eq("user_id", user_id).execute()
                return resp.data[0] if resp.data else None
            except Exception as e:
                logger.warning(f"Supabase error in get_by_id: {e}")

        doc = self._store.get(doc_id)
        if doc and doc.get("user_id") == user_id:
            return doc
        return None

    async def list_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("documents").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
                return resp.data or []
            except Exception as e:
                logger.warning(f"Supabase error in list_by_user: {e}")

        return [d for d in self._store.values() if d.get("user_id") == user_id]

    async def update_status(
        self,
        doc_id: str,
        status: str,
        page_count: Optional[int] = None,
        error: Optional[str] = None,
        topics: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        updates: Dict[str, Any] = {
            "processing_status": status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        if page_count is not None:
            updates["page_count"] = page_count
        if error is not None:
            updates["processing_error"] = error
        if topics is not None:
            updates["suggested_topics"] = topics

        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("documents").update(updates).eq("id", doc_id).execute()
                return resp.data[0] if resp.data else None
            except Exception as e:
                logger.warning(f"Supabase error in update_status: {e}")

        if doc_id in self._store:
            self._store[doc_id].update(updates)
            return self._store[doc_id]
        return None

    async def delete(self, doc_id: str, user_id: str) -> bool:
        if supabase_session.is_configured and supabase_session.client:
            try:
                supabase_session.client.table("documents").delete().eq("id", doc_id).eq("user_id", user_id).execute()
                return True
            except Exception as e:
                logger.warning(f"Supabase error in delete document: {e}")

        if doc_id in self._store and self._store[doc_id].get("user_id") == user_id:
            del self._store[doc_id]
            return True
        return False

documents_repo = DocumentsRepository()
