import logging

from app.config import settings
from app.db.session import supabase_session
from app.services.storage.base import BaseStorageService, StorageUnavailableError

logger = logging.getLogger(__name__)


class SupabaseStorageService(BaseStorageService):
    def __init__(self):
        self.bucket = settings.SUPABASE_STORAGE_BUCKET
        self._mock_storage: dict[str, bytes] = {}

    @property
    def is_configured(self) -> bool:
        return supabase_session.is_configured and supabase_session.client is not None

    def _require_mock(self) -> None:
        if not supabase_session.use_memory:
            raise StorageUnavailableError("Document storage is unavailable")

    def save_mock_object(self, object_key: str, data: bytes) -> None:
        self._require_mock()
        if len(data) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
            raise ValueError("Document exceeds the allowed size")
        self._mock_storage[object_key] = data

    def generate_presigned_upload_url(
        self, object_key: str, mime_type: str, expires_in: int = 3600
    ) -> str:
        if not self.is_configured:
            self._require_mock()
            return f"/api/documents/mock-upload/{object_key}"
        try:
            result = supabase_session.require_client().storage.from_(self.bucket).create_signed_upload_url(
                path=object_key
            )
            url = result.get("signed_url") or result.get("signedUrl")
            if not url:
                raise StorageUnavailableError("Document storage is unavailable")
            return str(url)
        except Exception:  # noqa: BLE001 - redact all provider failures at the storage boundary
            logger.error("Document upload signing failed")
            raise StorageUnavailableError("Document storage is unavailable") from None

    def get_object_bytes(self, object_key: str) -> bytes:
        if not self.is_configured:
            self._require_mock()
            if object_key not in self._mock_storage:
                raise StorageUnavailableError("Uploaded document was not found")
            return self._mock_storage[object_key]
        try:
            data = supabase_session.require_client().storage.from_(self.bucket).download(object_key)
            if len(data) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
                raise StorageUnavailableError("Document exceeds the allowed size")
            return data
        except Exception:  # noqa: BLE001 - redact all provider failures at the storage boundary
            logger.error("Document download failed")
            raise StorageUnavailableError("Uploaded document could not be read") from None

    def get_object_size(self, object_key: str) -> int:
        if not self.is_configured:
            self._require_mock()
            if object_key not in self._mock_storage:
                raise StorageUnavailableError("Uploaded document was not found")
            return len(self._mock_storage[object_key])
        try:
            info = supabase_session.require_client().storage.from_(self.bucket).info(object_key)
            size = info.get("size", info.get("metadata", {}).get("size"))
            if not isinstance(size, int) or size < 1:
                raise ValueError("Invalid object metadata")
            return size
        except Exception:  # noqa: BLE001 - redact all provider failures at the storage boundary
            raise StorageUnavailableError("Uploaded document metadata is unavailable") from None

    def delete_object(self, object_key: str) -> bool:
        if not self.is_configured:
            self._require_mock()
            self._mock_storage.pop(object_key, None)
            return True
        try:
            supabase_session.require_client().storage.from_(self.bucket).remove([object_key])
            return True
        except Exception:  # noqa: BLE001 - redact all provider failures at the storage boundary
            logger.error("Document deletion failed")
            raise StorageUnavailableError("Uploaded document could not be deleted") from None
