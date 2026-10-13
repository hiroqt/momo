"""Durable upload responsibility; memory implementation is local/test only."""

from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException

from app.db.session import supabase_session
from app.services.storage.base import ObjectMetadata, validated_metadata

ERRORS = {
    "UPLOAD_TICKET_REQUIRED": (409, "Request a new upload destination before registering this document."),
    "UPLOAD_UNAVAILABLE": (409, "This upload is no longer available."),
    "UPLOAD_BUSY": (409, "This upload is being checked. Please retry shortly."),
    "INVALID_UPLOAD_METADATA": (422, "The uploaded document metadata is invalid."),
    "MONTHLY_DOCUMENT_LIMIT": (429, "Monthly document limit reached."),
}


def ticket_error(code: str) -> HTTPException:
    status, message = ERRORS[code]
    public_code = "QUOTA_EXCEEDED" if code == "MONTHLY_DOCUMENT_LIMIT" else code
    return HTTPException(status, detail={"code": public_code, "message": message})


def map_ticket_error(exc: Exception) -> None:
    code = getattr(exc, "message", None)
    if isinstance(code, str) and code in ERRORS:
        raise ticket_error(code) from None


def timestamp(value: Any) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value
        if not isinstance(parsed, datetime) or parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError("Aware timestamp required")
        return parsed.astimezone(UTC)
    except (ValueError, TypeError, OverflowError):
        raise ticket_error("INVALID_UPLOAD_METADATA") from None


class UploadTicketRepository:
    def __init__(self) -> None:
        self._tickets: dict[str, dict[str, Any]] = {}

    async def _rpc(self, name: str, data: dict[str, Any]) -> Any:
        try:
            response = await supabase_session.execute(supabase_session.require_client().rpc(name, data))
            return response.data
        except Exception as exc:
            map_ticket_error(exc)
            raise

    async def issue(self, data: dict[str, Any]) -> dict[str, Any]:
        if supabase_session.is_configured:
            return await self._rpc("issue_upload_ticket", {"p_ticket": data})
        now = datetime.now(UTC)
        try:
            identity, owner = str(UUID(data["id"])), str(UUID(data["user_id"]))
            deadline = timestamp(data["signed_until"])
            size = data["file_size"]
            if data["file_type"] not in {"pdf", "docx", "txt", "pptx"} or data["provider"] not in {"supabase", "s3"}:
                raise ValueError("Unsupported upload")
            if data["object_key"] != f"documents/{owner}/{identity}/original.{data['file_type']}":
                raise ValueError("Invalid destination")
            if type(size) is not int or not 1 <= size <= 15 * 1024 * 1024 or not now < deadline <= now+timedelta(hours=72):
                raise ValueError("Invalid upload bounds")
            if not isinstance(data["mime_type"], str) or not 1 <= len(data["mime_type"]) <= 255 or any(ord(char)<32 for char in data["mime_type"]):
                raise ValueError("Invalid content type")
            bucket = data["bucket"]
            if not isinstance(bucket, str) or not 1 <= len(bucket) <= 63 or not bucket[0].isalnum() or any(not (char.isascii() and (char.isalnum() or char in "_.-")) for char in bucket):
                raise ValueError("Invalid bucket")
        except (ValueError, TypeError, KeyError):
            raise ticket_error("INVALID_UPLOAD_METADATA") from None
        if identity in self._tickets:
            raise ticket_error("UPLOAD_UNAVAILABLE")
        ticket = {**deepcopy(data), "id": identity, "user_id": owner, "auth_ref": owner, "issued_at": now.isoformat(),
                  "signed_until": deadline.isoformat(), "status": "issued", "legacy": False,
                  "uploaded_at": None, "expires_at": None, "physical_expires_at": None, "identity": None, "version": None, "etag": None,
                  "next_check_at": now.isoformat(), "lease_token": None, "lease_until": None,
                  "delete_required": False, "last_deleted_at": None}
        self._tickets[identity] = ticket
        return deepcopy(ticket)

    async def get(self, ticket_id: str, user_id: str) -> dict[str, Any] | None:
        if supabase_session.is_configured:
            return await self._rpc("get_upload_ticket", {"p_id": ticket_id, "p_user_id": user_id})
        ticket = self._tickets.get(ticket_id)
        return deepcopy(ticket) if ticket and ticket["user_id"] == user_id and ticket["auth_ref"] == user_id else None

    async def claim_cleanup(self, limit: int = 100, *, provider: str | None = None, bucket: str | None = None) -> list[dict[str, Any]]:
        if not 1 <= limit <= 100 or provider not in {None, "s3", "supabase"}:
            raise ValueError("Invalid cleanup claim")
        if supabase_session.is_configured:
            return await self._rpc("claim_upload_cleanup", {"p_limit": limit, "p_provider": provider, "p_bucket": bucket})
        now = datetime.now(UTC)
        rows = [ticket for ticket in self._tickets.values() if (not ticket["legacy"] or ticket["status"] == "retired")
                and timestamp(ticket["next_check_at"]) <= now
                and (ticket["lease_until"] is None or timestamp(ticket["lease_until"]) <= now)
                and (provider is None or ticket["provider"] == provider) and (bucket is None or ticket["bucket"] == bucket)]
        rows.sort(key=lambda ticket: (ticket["next_check_at"], ticket["id"]))
        for ticket in rows[:limit]:
            ticket.update(lease_token=str(uuid4()), lease_until=(now+timedelta(seconds=120)).isoformat(), delete_required=False)
        return deepcopy(rows[:limit])

    def _validate(self, ticket: dict[str, Any], metadata: ObjectMetadata, *, match_size: bool = False) -> None:
        try:
            validated_metadata(metadata.size, metadata.uploaded_at, identity=metadata.identity, version=metadata.version, etag=metadata.etag, for_cleanup=not match_size)
            if (not (ticket["legacy"] and ticket["status"] == "retired") and metadata.uploaded_at < timestamp(ticket["issued_at"])-timedelta(minutes=5)) or (match_size and metadata.size != ticket["file_size"]):
                raise ValueError("Invalid observation")
        except (ValueError, TypeError, RuntimeError):
            raise ticket_error("INVALID_UPLOAD_METADATA") from None

    @staticmethod
    def _observation(metadata: ObjectMetadata) -> dict[str, Any]:
        return {"size": metadata.size, "uploaded_at": metadata.uploaded_at.isoformat(),
                "identity": metadata.identity, "version": metadata.version, "etag": metadata.etag}

    @staticmethod
    def _changed(ticket: dict[str, Any], metadata: ObjectMetadata) -> bool:
        return ticket["uploaded_at"] is not None and (timestamp(ticket["uploaded_at"]) != metadata.uploaded_at
            or any(ticket[field] != getattr(metadata, field) for field in ("identity", "version", "etag")))

    @staticmethod
    def _expire_document(ticket: dict[str, Any]) -> None:
        from app.db.repositories.documents_repo import documents_repo
        document = documents_repo._store.get(ticket["id"])
        if document and document["user_id"] == ticket["user_id"]:
            document.update(processing_status="EXPIRED", updated_at=datetime.now(UTC).isoformat())

    async def prepare_cleanup(self, ticket_id: str, token: str, metadata: ObjectMetadata | None) -> bool:
        if supabase_session.is_configured:
            return bool(await self._rpc("prepare_upload_cleanup", {"p_id": ticket_id, "p_token": token,
                "p_metadata": self._observation(metadata) if metadata else None}))
        ticket, now = self._tickets.get(ticket_id), datetime.now(UTC)
        if not ticket or (ticket["legacy"] and ticket["status"] != "retired") or not token or ticket["lease_token"] != token or ticket["lease_until"] is None or timestamp(ticket["lease_until"]) <= now:
            return False
        if metadata is None:
            if ticket["status"] == "retired" or ticket["auth_ref"] is None:
                ticket.update(delete_required=True, physical_expires_at=now.isoformat(), last_deleted_at=None)
                self._expire_document(ticket)
                return True
            ticket.update(next_check_at=(now+timedelta(minutes=15)).isoformat(), lease_token=None, lease_until=None, delete_required=False, last_deleted_at=now.isoformat())
            if ticket["expires_at"] is not None and timestamp(ticket["expires_at"]) <= now:
                if ticket["status"] != "retired":
                    ticket["status"] = "expired"
                self._expire_document(ticket)
            return False
        self._validate(ticket, metadata)
        cutoff = now if ticket["auth_ref"] is None or ticket["status"] == "retired" else metadata.uploaded_at+timedelta(hours=72)
        ticket.update(physical_expires_at=cutoff.isoformat(), last_deleted_at=None)
        if ticket["uploaded_at"] is None:
            ticket.update(uploaded_at=metadata.uploaded_at.isoformat(), expires_at=(metadata.uploaded_at+timedelta(hours=72)).isoformat(),
                          identity=metadata.identity, version=metadata.version, etag=metadata.etag)
        elif self._changed(ticket, metadata):
            if ticket["status"] != "retired":
                ticket["status"] = "expired"
            self._expire_document(ticket)
        if cutoff > now:
            ticket.update(next_check_at=cutoff.isoformat(), lease_token=None, lease_until=None, delete_required=False)
            return False
        ticket.update(status="retired" if ticket["status"] == "retired" or ticket["auth_ref"] is None else "expired", delete_required=True)
        self._expire_document(ticket)
        return True

    async def finish_cleanup(self, ticket_id: str, token: str) -> bool:
        if supabase_session.is_configured:
            return bool(await self._rpc("finish_upload_cleanup", {"p_id": ticket_id, "p_token": token}))
        ticket, now = self._tickets.get(ticket_id), datetime.now(UTC)
        if not ticket or not token or ticket["lease_token"] != token or ticket["lease_until"] is None or timestamp(ticket["lease_until"]) <= now or not ticket["delete_required"]:
            return False
        ticket.update(lease_token=None, lease_until=None, delete_required=False, last_deleted_at=now.isoformat(), next_check_at=(now+timedelta(minutes=15)).isoformat())
        return True

    async def retire(self, ticket_id: str, user_id: str) -> bool:
        if supabase_session.is_configured:
            return bool(await self._rpc("retire_upload_ticket", {"p_id": ticket_id, "p_user_id": user_id}))
        ticket = self._tickets.get(ticket_id)
        if not ticket or ticket["user_id"] != user_id or ticket["auth_ref"] != user_id:
            return False
        ticket.update(status="retired", next_check_at=datetime.now(UTC).isoformat())
        if ticket["uploaded_at"] is not None:
            ticket["physical_expires_at"] = datetime.now(UTC).isoformat()
        self._expire_document(ticket)
        return True

    def register_memory(self, data: dict[str, Any], monthly_limit: int) -> dict[str, Any]:
        """No await separates quota/document/ticket writes in the local event loop."""
        from app.db.repositories.documents_repo import documents_repo
        from app.db.repositories.usage_repo import usage_repo
        ticket = self._tickets.get(data["id"])
        if not ticket:
            raise ticket_error("UPLOAD_TICKET_REQUIRED")
        if ticket["user_id"] != data["user_id"] or ticket["auth_ref"] != data["user_id"] or ticket["status"] not in {"issued", "registered"}:
            raise ticket_error("UPLOAD_UNAVAILABLE")
        if ticket["lease_until"] is not None and timestamp(ticket["lease_until"]) > datetime.now(UTC):
            raise ticket_error("UPLOAD_BUSY")
        existing = documents_repo._store.get(data["id"])
        if existing:
            if existing["user_id"] != data["user_id"] or existing["processing_status"] == "EXPIRED" or timestamp(existing["expires_at"]) <= datetime.now(UTC):
                raise ticket_error("UPLOAD_UNAVAILABLE")
            return existing
        if ticket["legacy"] or ticket["status"] != "issued":
            raise ticket_error("UPLOAD_UNAVAILABLE")
        if any(data.get(field) != ticket[other] for field, other in (("s3_object_key", "object_key"), ("file_type", "file_type"), ("mime_type", "mime_type"), ("file_size", "file_size"))):
            raise ticket_error("INVALID_UPLOAD_METADATA")
        try:
            metadata = validated_metadata(data["file_size"], data["uploaded_at"], identity=data.get("object_identity"), version=data.get("object_version"), etag=data.get("object_etag"))
        except (KeyError, ValueError, TypeError, RuntimeError):
            raise ticket_error("INVALID_UPLOAD_METADATA") from None
        self._validate(ticket, metadata, match_size=True)
        if self._changed(ticket, metadata):
            raise ticket_error("INVALID_UPLOAD_METADATA")
        if metadata.uploaded_at+timedelta(hours=72) <= datetime.now(UTC):
            raise ticket_error("UPLOAD_UNAVAILABLE")
        if not isinstance(data.get("original_filename"), str) or not 1 <= len(data["original_filename"]) <= 255:
            raise ticket_error("INVALID_UPLOAD_METADATA")
        key = f"{data['user_id']}:{usage_repo._get_year_month()}"
        if usage_repo._counts.get(key, 0) >= monthly_limit:
            raise ticket_error("MONTHLY_DOCUMENT_LIMIT")
        now = datetime.now(UTC).isoformat()
        saved = {**deepcopy(data), "uploaded_at": metadata.uploaded_at.isoformat(),
                 "expires_at": (metadata.uploaded_at+timedelta(hours=72)).isoformat(), "processing_status": "UPLOADED",
                 "created_at": now, "updated_at": now}
        usage_repo._counts[key] = usage_repo._counts.get(key, 0)+1
        documents_repo._store[saved["id"]] = saved
        ticket.update(status="registered", uploaded_at=saved["uploaded_at"], expires_at=saved["expires_at"],
                      physical_expires_at=saved["expires_at"],
                      identity=metadata.identity, version=metadata.version, etag=metadata.etag, next_check_at=saved["expires_at"], lease_token=None, lease_until=None)
        return saved


upload_ticket_repo = UploadTicketRepository()
