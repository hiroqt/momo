import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from app.db.session import page_range, supabase_session

logger = logging.getLogger(__name__)

def is_usable_document(document: dict[str, Any]) -> bool:
    """A source can only be used for new study work while ready and retained."""
    if document.get("processing_status") != "READY":
        return False
    try:
        expires = datetime.fromisoformat(str(document.get("expires_at") or "").replace("Z", "+00:00"))
    except ValueError:
        return False
    return expires.tzinfo is not None and expires > datetime.now(UTC)

class DocumentsRepository:
    def __init__(self) -> None:
        self._store: dict[str, dict[str, Any]] = {}

    async def create(self, doc_data: dict[str, Any]) -> dict[str, Any]:
        doc_id = doc_data.get("id") or str(uuid.uuid4())
        doc_data["id"] = doc_id
        if "created_at" not in doc_data:
            doc_data["created_at"] = datetime.now(UTC).isoformat()
        if "updated_at" not in doc_data:
            doc_data["updated_at"] = datetime.now(UTC).isoformat()

        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("documents").insert(doc_data))
            return resp.data[0] if resp.data else doc_data

        self._store[doc_id] = doc_data
        return doc_data

    async def register(self, doc_data: dict[str, Any]) -> dict[str, Any]:
        from app.config import settings
        from app.db.repositories.upload_ticket_repo import (
            map_ticket_error,
            upload_ticket_repo,
        )
        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = await supabase_session.execute(supabase_session.client.rpc("register_document", {"p_document": doc_data, "p_monthly_limit": settings.MONTHLY_DOCUMENT_LIMIT}))
                return resp.data
            except Exception as exc:
                map_ticket_error(exc)
                raise
        return upload_ticket_repo.register_memory(doc_data, settings.MONTHLY_DOCUMENT_LIMIT)

    async def get_by_id(self, doc_id: str, user_id: str) -> dict[str, Any] | None:
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("documents").select("*").eq("id", doc_id).eq("user_id", user_id))
            return resp.data[0] if resp.data else None

        doc = self._store.get(doc_id)
        if doc and doc.get("user_id") == user_id:
            return doc
        return None

    async def set_content_hash(self, doc_id: str, user_id: str, content_sha256: str) -> None:
        if len(content_sha256) != 64 or any(c not in "0123456789abcdef" for c in content_sha256):
            raise ValueError("Invalid content digest")
        if supabase_session.is_configured and supabase_session.client:
            await supabase_session.execute(supabase_session.client.table("documents").update({"content_sha256": content_sha256}).eq("id", doc_id).eq("user_id", user_id))
        elif doc_id in self._store and self._store[doc_id].get("user_id") == user_id:
            self._store[doc_id]["content_sha256"] = content_sha256

    async def list_by_user(self, user_id: str, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        start, end = page_range(limit, offset)
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("documents").select("*").eq("user_id", user_id).order("created_at", desc=True).order("id").range(start, end))
            return resp.data or []

        rows = sorted([d for d in self._store.values() if d.get("user_id") == user_id], key=lambda row: row["created_at"], reverse=True)
        return rows[start:end + 1]

    async def update_status(
        self,
        doc_id: str,
        status: str,
        page_count: int | None = None,
        error: str | None = None,
        topics: list[str] | None = None
    ) -> dict[str, Any] | None:
        updates: dict[str, Any] = {
            "processing_status": status,
            "updated_at": datetime.now(UTC).isoformat()
        }
        if page_count is not None:
            updates["page_count"] = page_count
        if error is not None:
            updates["processing_error"] = error
        if topics is not None:
            updates["suggested_topics"] = topics

        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("documents").update(updates).eq("id", doc_id))
            return resp.data[0] if resp.data else None

        if doc_id in self._store:
            current = self._store[doc_id].get("processing_status")
            if current == "EXPIRED" or (current == "READY" and status not in {"READY", "EXPIRED"}):
                updates.pop("processing_status")
                updates.pop("processing_error", None)
            self._store[doc_id].update(updates)
            return self._store[doc_id]
        return None

    async def delete(self, doc_id: str, user_id: str) -> bool:
        if supabase_session.is_configured and supabase_session.client:
            await supabase_session.execute(supabase_session.client.table("documents").delete().eq("id", doc_id).eq("user_id", user_id))
            return True

        if doc_id in self._store and self._store[doc_id].get("user_id") == user_id:
            del self._store[doc_id]
            return True
        return False

documents_repo = DocumentsRepository()
