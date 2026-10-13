import logging
from datetime import UTC, datetime
from threading import Lock
from uuid import uuid4

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import settings
from app.services.storage.base import (
    BaseStorageService,
    ObjectAlreadyExistsError,
    ObjectMetadata,
    ObjectNotFoundError,
    StorageUnavailableError,
    validated_metadata,
)

logger = logging.getLogger(__name__)


class S3Service(BaseStorageService):
    provider = "s3"
    def __init__(self):
        self.bucket = settings.AWS_S3_BUCKET
        self.region = settings.AWS_REGION
        self._mock_storage: dict[str, bytes] = {}
        self._mock_metadata: dict[str, ObjectMetadata] = {}
        self._mock_lock = Lock()
        self.client = None

    @property
    def is_mock(self) -> bool:
        return settings.DATABASE_BACKEND == "memory" and settings.ENVIRONMENT in {
            "development", "test"
        }

    def _get_client(self):
        if self.client is None:
            if settings.AWS_ACCESS_KEY_ID.startswith(("mock-", "your-")):
                raise StorageUnavailableError("Document storage is unavailable")
            self.client = boto3.client(
                "s3", region_name=self.region,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
                config=Config(
                    signature_version="s3v4", connect_timeout=5, read_timeout=30,
                    max_pool_connections=20, retries={"max_attempts": 2}
                ),
            )
        return self.client

    def save_mock_object(self, object_key: str, data: bytes) -> None:
        if not self.is_mock:
            raise StorageUnavailableError("Mock storage is disabled")
        if len(data) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
            raise ValueError("Document exceeds the allowed size")
        with self._mock_lock:
            if object_key in self._mock_storage:
                raise ObjectAlreadyExistsError("Uploaded document already exists")
            metadata = validated_metadata(len(data), datetime.now(UTC), identity=str(uuid4()))
            self._mock_storage[object_key] = data
            self._mock_metadata[object_key] = metadata

    def get_upload_headers(self, mime_type: str) -> dict[str, str]:
        return {**super().get_upload_headers(mime_type), "If-None-Match": "*"}

    def get_object_metadata(self, object_key: str, *, for_cleanup: bool = False) -> ObjectMetadata:
        if self.is_mock:
            with self._mock_lock:
                if object_key not in self._mock_storage:
                    raise ObjectNotFoundError("Uploaded document was not found")
                if object_key not in self._mock_metadata:
                    raise StorageUnavailableError("Uploaded document metadata is unavailable")
                return self._mock_metadata[object_key]
        try:
            response = self._get_client().head_object(Bucket=self.bucket, Key=object_key)
            # LastModified identifies this write, because application upload URLs
            # sign a conditional create. External privileged rewrites remain an
            # operational boundary; VersionId/ETag are retained for later fencing.
            version = response.get("VersionId")
            return validated_metadata(response.get("ContentLength"), response.get("LastModified"),
                version=None if version == "null" else version, etag=response.get("ETag"), for_cleanup=for_cleanup)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if status == 404 and code in {"404", "NoSuchKey", "NotFound"}:
                if for_cleanup:
                    # A delete marker may hide physical older versions. Missing
                    # current HEAD alone is not proof of physical absence.
                    try:
                        versions = self._get_client().list_object_versions(Bucket=self.bucket, Prefix=object_key, MaxKeys=100)
                    except Exception:  # noqa: BLE001 - absence cannot be established
                        raise StorageUnavailableError("Object version inventory is unavailable") from None
                    if versions.get("IsTruncated") or any(row.get("Key") == object_key for row in versions.get("Versions", [])):
                        raise StorageUnavailableError("Hidden object versions require inventory") from None
                raise ObjectNotFoundError("Uploaded document was not found") from None
            raise StorageUnavailableError("Uploaded document metadata is unavailable") from None
        except Exception:  # noqa: BLE001 - metadata/provider details are private
            raise StorageUnavailableError("Uploaded document metadata is unavailable") from None

    def generate_presigned_upload_url(
        self, object_key: str, mime_type: str, expires_in: int = 3600
    ) -> str:
        if self.is_mock:
            return f"/api/documents/mock-upload/{object_key}"
        try:
            return self._get_client().generate_presigned_url(
                ClientMethod="put_object",
                Params={"Bucket": self.bucket, "Key": object_key, "ContentType": mime_type, "IfNoneMatch": "*"},
                ExpiresIn=expires_in,
            )
        except Exception:  # noqa: BLE001 - redact all provider failures at the storage boundary
            logger.error("Document upload signing failed")
            raise StorageUnavailableError("Document storage is unavailable") from None

    def get_object_bytes(self, object_key: str) -> bytes:
        if self.is_mock:
            if object_key not in self._mock_storage:
                raise StorageUnavailableError("Uploaded document was not found")
            return self._mock_storage[object_key]
        try:
            response = self._get_client().get_object(Bucket=self.bucket, Key=object_key)
            stream = response["Body"]
            try:
                limit = settings.MAX_FILE_SIZE_MB * 1024 * 1024
                data = stream.read(limit + 1)
                if len(data) > limit:
                    raise StorageUnavailableError("Document exceeds the allowed size")
                return data
            finally:
                stream.close()
        except Exception:  # noqa: BLE001 - redact all provider failures at the storage boundary
            logger.error("Document download failed")
            raise StorageUnavailableError("Uploaded document could not be read") from None

    def delete_observed_object(self, object_key: str, metadata: ObjectMetadata) -> bool:
        if self.is_mock:
            with self._mock_lock:
                current = self._mock_metadata.get(object_key)
                if current is not None and current != metadata:
                    return False
                self._mock_storage.pop(object_key, None)
                self._mock_metadata.pop(object_key, None)
                return True
        # VersionId addresses the observed immutable generation, even when a
        # stale cleaner overlaps a newer upload. ETag alone cannot distinguish a
        # recreated object with identical bytes and a different upload clock.
        if not metadata.version or metadata.version == "null":
            raise StorageUnavailableError("Versioned storage is required for automatic retention")
        try:
            self._get_client().delete_object(Bucket=self.bucket, Key=object_key, VersionId=metadata.version)
            return True
        except Exception:  # noqa: BLE001 - redact provider failures
            raise StorageUnavailableError("Uploaded document could not be deleted") from None

    def delete_object(self, object_key: str) -> bool:
        if self.is_mock:
            with self._mock_lock:
                self._mock_storage.pop(object_key, None)
                self._mock_metadata.pop(object_key, None)
            return True
        try:
            # Explicit retirement removes physical versions, including versions
            # hidden by delete markers. One bounded inventory page per retry.
            client = self._get_client()
            inventory = client.list_object_versions(Bucket=self.bucket, Prefix=object_key, MaxKeys=100)
            for row in [*inventory.get("Versions", []), *inventory.get("DeleteMarkers", [])]:
                if row.get("Key") == object_key:
                    client.delete_object(Bucket=self.bucket, Key=object_key, VersionId=row["VersionId"])
            return not inventory.get("IsTruncated", False)
        except Exception:  # noqa: BLE001 - redact all provider failures at the storage boundary
            logger.error("Document deletion failed")
            raise StorageUnavailableError("Uploaded document could not be deleted") from None

    def get_object_size(self, object_key: str) -> int:
        if self.is_mock:
            if object_key not in self._mock_storage:
                raise StorageUnavailableError("Uploaded document was not found")
            return len(self._mock_storage[object_key])
        try:
            response = self._get_client().head_object(Bucket=self.bucket, Key=object_key)
            return int(response["ContentLength"])
        except Exception:  # noqa: BLE001 - redact all provider failures at the storage boundary
            raise StorageUnavailableError("Uploaded document metadata is unavailable") from None


s3_service = S3Service()
