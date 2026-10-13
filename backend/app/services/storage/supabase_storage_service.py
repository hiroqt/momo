import logging
from datetime import UTC, datetime
from threading import Lock
from uuid import uuid4

from storage3.exceptions import StorageApiError
from storage3.types import CreateSignedUploadUrlOptions

from app.config import settings
from app.db.session import supabase_session
from app.services.storage.base import (
    BaseStorageService,
    ObjectAlreadyExistsError,
    ObjectMetadata,
    ObjectNotFoundError,
    StorageUnavailableError,
    validated_metadata,
)

logger = logging.getLogger(__name__)


class SupabaseStorageService(BaseStorageService):
    provider = "supabase"
    def __init__(self):
        self.bucket = settings.SUPABASE_STORAGE_BUCKET
        self._mock_storage: dict[str, bytes] = {}
        self._mock_metadata: dict[str, ObjectMetadata] = {}
        self._mock_lock = Lock()

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
        with self._mock_lock:
            if object_key in self._mock_storage:
                raise ObjectAlreadyExistsError("Uploaded document already exists")
            metadata = validated_metadata(len(data), datetime.now(UTC), identity=str(uuid4()))
            self._mock_storage[object_key] = data
            self._mock_metadata[object_key] = metadata

    def get_object_metadata(self, object_key: str, *, for_cleanup: bool = False) -> ObjectMetadata:
        if not self.is_configured:
            self._require_mock()
            with self._mock_lock:
                if object_key not in self._mock_storage:
                    raise ObjectNotFoundError("Uploaded document was not found")
                if object_key not in self._mock_metadata:
                    raise StorageUnavailableError("Uploaded document metadata is unavailable")
                return self._mock_metadata[object_key]
        try:
            info = supabase_session.require_client().storage.from_(self.bucket).info(object_key)
            # Locked Python SDK returns the HTTP payload unchanged. Storage's
            # InfoRenderer exposes size/created_at/id/version/etag; updated_at or
            # last_modified must never stand in for creation time.
            return validated_metadata(info.get("size"), info.get("created_at"),
                identity=info.get("id"), version=info.get("version"), etag=info.get("etag"), for_cleanup=for_cleanup)
        except StorageApiError as exc:
            if exc.status in {404, "404"} and exc.code in {"404", "NoSuchKey", "ObjectNotFound", "NotFound", "not_found"}:
                raise ObjectNotFoundError("Uploaded document was not found") from None
            raise StorageUnavailableError("Uploaded document metadata is unavailable") from None
        except Exception:  # noqa: BLE001 - metadata/provider details are private
            raise StorageUnavailableError("Uploaded document metadata is unavailable") from None

    def generate_presigned_upload_url(
        self, object_key: str, mime_type: str, expires_in: int = 3600
    ) -> str:
        if not self.is_configured:
            self._require_mock()
            return f"/api/documents/mock-upload/{object_key}"
        try:
            result = supabase_session.require_client().storage.from_(self.bucket).create_signed_upload_url(
                path=object_key, options=CreateSignedUploadUrlOptions(upsert="false")
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

    def delete_observed_object(self, object_key: str, metadata: ObjectMetadata) -> bool:
        if not self.is_configured:
            self._require_mock()
            with self._mock_lock:
                current = self._mock_metadata.get(object_key)
                if current is not None and current != metadata:
                    return False
                self._mock_storage.pop(object_key, None)
                self._mock_metadata.pop(object_key, None)
                return True
        # Supabase remove addresses only a path, with no generation predicate.
        # Do not claim safe automatic retention until a conditional provider
        # operation or equivalent immutable-generation storage is available.
        raise StorageUnavailableError("Conditional object deletion is unavailable")

    def delete_object(self, object_key: str) -> bool:
        if not self.is_configured:
            self._require_mock()
            with self._mock_lock:
                self._mock_storage.pop(object_key, None)
                self._mock_metadata.pop(object_key, None)
            return True
        try:
            supabase_session.require_client().storage.from_(self.bucket).remove([object_key])
            return True
        except Exception:  # noqa: BLE001 - redact all provider failures at the storage boundary
            logger.error("Document deletion failed")
            raise StorageUnavailableError("Uploaded document could not be deleted") from None
