import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from app.db.session import page_range, supabase_session

logger = logging.getLogger(__name__)

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
        from fastapi import HTTPException

        from app.config import settings
        from app.db.repositories.usage_repo import usage_repo
        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = await supabase_session.execute(supabase_session.client.rpc("register_document", {"p_document": doc_data, "p_monthly_limit": settings.MONTHLY_DOCUMENT_LIMIT}))
                return resp.data
            except Exception as exc:
                if getattr(exc, "message", "") == "MONTHLY_DOCUMENT_LIMIT":
                    raise HTTPException(429, detail={"code": "QUOTA_EXCEEDED", "message": "Monthly document limit reached."}) from None
                raise
        # No await between the quota check and increment: one event-loop transaction.
        key = f"{doc_data['user_id']}:{usage_repo._get_year_month()}"
        existing = self._store.get(doc_data["id"])
        if existing:
            if existing["user_id"] != doc_data["user_id"]:
                raise HTTPException(404, detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found."})
            return existing
        if usage_repo._counts.get(key, 0) >= settings.MONTHLY_DOCUMENT_LIMIT:
            raise HTTPException(429, detail={"code": "QUOTA_EXCEEDED", "message": "Monthly document limit reached."})
        usage_repo._counts[key] = usage_repo._counts.get(key, 0) + 1
        return await self.create(doc_data)

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
