from abc import ABC, abstractmethod
from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.config import settings


class StorageUnavailableError(RuntimeError):
    """A storage operation could not be completed safely."""

class BaseStorageService(ABC):
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

    @abstractmethod
    def delete_object(self, object_key: str) -> bool:
        """Delete an object from storage."""
        pass

    @abstractmethod
    def save_mock_object(self, object_key: str, data: bytes) -> None:
        """Save raw bytes for local/mock fallback."""
        pass
