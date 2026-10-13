from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from app.config import settings


class StorageUnavailableError(RuntimeError):
    """A storage operation could not be completed safely."""


class ObjectAlreadyExistsError(StorageUnavailableError):
    """Conditional creation denied an overwrite of an existing original."""


class ObjectNotFoundError(StorageUnavailableError):
    """The provider confirmed this object is absent; outages are not absence."""


@dataclass(frozen=True)
class ObjectMetadata:
    size: int
    uploaded_at: datetime
    identity: str | None = None
    version: str | None = None
    etag: str | None = None


def validated_metadata(size: Any, uploaded_at: Any, *, identity: Any = None,
                       version: Any = None, etag: Any = None, for_cleanup: bool = False) -> ObjectMetadata:
    """Accept provider timestamps only; never substitute registration/signing time."""
    max_size = 5 * 1024**4 if for_cleanup else settings.MAX_FILE_SIZE_MB * 1024 * 1024
    min_size = 0 if for_cleanup else 1
    if type(size) is not int or not min_size <= size <= max_size:
        raise StorageUnavailableError("Uploaded document metadata is invalid")
    try:
        timestamp = datetime.fromisoformat(uploaded_at.replace("Z", "+00:00")) if isinstance(uploaded_at, str) else uploaded_at
        if not isinstance(timestamp, datetime) or timestamp.tzinfo is None or timestamp.utcoffset() is None:
            raise ValueError("Aware timestamp required")
        timestamp = timestamp.astimezone(UTC)
        # Permit bounded provider/server clock skew, never an unbounded future
        # timestamp that would indefinitely postpone retention cleanup.
        if timestamp > datetime.now(UTC) + timedelta(minutes=5):
            raise ValueError("Provider timestamp is in the future")
    except (ValueError, TypeError, OverflowError):
        raise StorageUnavailableError("Uploaded document metadata is invalid") from None
    for value in (identity, version, etag):
        if value is not None and (not isinstance(value, str) or not value or len(value) > 1024 or any(ord(char) < 32 for char in value)):
            raise StorageUnavailableError("Uploaded document metadata is invalid")
    return ObjectMetadata(size=size, uploaded_at=timestamp, identity=identity, version=version, etag=etag)

class BaseStorageService(ABC):
    provider: str
    bucket: str

    def get_upload_headers(self, mime_type: str) -> dict[str, str]:
        if not isinstance(mime_type, str) or not mime_type or len(mime_type) > 255 or any(ord(char) < 32 for char in mime_type):
            raise StorageUnavailableError("Upload content type is invalid")
        return {"Content-Type": mime_type}

    def get_object_metadata(self, object_key: str, *, for_cleanup: bool = False) -> ObjectMetadata:
        """Validated authoritative object time; unsupported/missing metadata fails closed."""
        raise StorageUnavailableError("Uploaded document metadata is unavailable")

    def build_object_key(self, user_id: str, document_id: str, extension: str) -> str:
        """Construct standard storage path: documents/{user_id}/{document_id}/original.{ext}"""
        clean_ext = extension.lower().lstrip(".")
        if clean_ext not in {"pdf", "docx", "txt", "pptx"}:
            raise ValueError("Unsupported document type")
        UUID(user_id)
        UUID(document_id)
        return f"documents/{user_id}/{document_id}/original.{clean_ext}"

    def calculate_expiration(self, from_time: datetime | None = None) -> datetime:
        """Calculate document expiration (default 3 days per PRD Rule 33)."""
        base = from_time or datetime.now(UTC)
        return base + timedelta(days=settings.DOCUMENT_RETENTION_DAYS)

    def get_object_size(self, object_key: str) -> int:
        """Read storage metadata before accepting an uploaded document."""
        raise NotImplementedError

    @abstractmethod
    def generate_presigned_upload_url(
        self,
        object_key: str,
        mime_type: str,
        expires_in: int = 3600
    ) -> str:
        """Generate a direct upload URL for the mobile client."""
        pass

    def generate_upload_url(
        self,
        object_key: str,
        mime_type: str,
        expires_in: int = 3600
    ) -> str:
        """Convenience alias for generate_presigned_upload_url."""
        return self.generate_presigned_upload_url(object_key, mime_type, expires_in)

    @abstractmethod
    def get_object_bytes(self, object_key: str) -> bytes:
        """Retrieve raw file bytes for document worker extraction."""
        pass

    def delete_observed_object(self, object_key: str, metadata: ObjectMetadata) -> bool:
        """Remove only the observed generation; path-only deletion is unsafe for expiry."""
        raise StorageUnavailableError("Conditional object deletion is unavailable")

    @abstractmethod
    def delete_object(self, object_key: str) -> bool:
        """Delete an object from storage."""
        pass

    @abstractmethod
    def save_mock_object(self, object_key: str, data: bytes) -> None:
        """Save raw bytes for local/mock fallback."""
        pass
