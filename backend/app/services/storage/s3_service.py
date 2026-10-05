import logging

import boto3
from botocore.config import Config

from app.config import settings
from app.services.storage.base import BaseStorageService, StorageUnavailableError

logger = logging.getLogger(__name__)


class S3Service(BaseStorageService):
    def __init__(self):
        self.bucket = settings.AWS_S3_BUCKET
        self.region = settings.AWS_REGION
        self._mock_storage: dict[str, bytes] = {}
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
        self._mock_storage[object_key] = data

    def generate_presigned_upload_url(
        self, object_key: str, mime_type: str, expires_in: int = 3600
    ) -> str:
        if self.is_mock:
            return f"/api/documents/mock-upload/{object_key}"
        try:
            return self._get_client().generate_presigned_url(
                ClientMethod="put_object",
                Params={"Bucket": self.bucket, "Key": object_key, "ContentType": mime_type},
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

    def delete_object(self, object_key: str) -> bool:
        if self.is_mock:
            self._mock_storage.pop(object_key, None)
            return True
        try:
            self._get_client().delete_object(Bucket=self.bucket, Key=object_key)
            return True
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
