import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.config import settings
from app.services.storage.base import BaseStorageService
import logging

logger = logging.getLogger(__name__)

class S3Service(BaseStorageService):
    def __init__(self):
        self.bucket = settings.AWS_S3_BUCKET
        self.region = settings.AWS_REGION
        self._mock_storage: dict[str, bytes] = {}
        self.is_mock = (
            settings.AWS_ACCESS_KEY_ID in ("mock-access-key", "your-aws-access-key", "")
            or "your-aws" in settings.AWS_ACCESS_KEY_ID
            or settings.AWS_SECRET_ACCESS_KEY in ("your-aws-secret-key", "")
        )

        if not self.is_mock:
            self.client = boto3.client(
                "s3",
                region_name=self.region,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=Config(signature_version="s3v4")
            )
        else:
            self.client = None

    def save_mock_object(self, object_key: str, data: bytes) -> None:
        self._mock_storage[object_key] = data

    def build_object_key(self, user_id: str, document_id: str, extension: str) -> str:
        clean_ext = extension.lstrip(".")
        return f"documents/{user_id}/{document_id}/original.{clean_ext}"

    def calculate_expiration(self, from_time: Optional[datetime] = None) -> datetime:
        base = from_time or datetime.now(timezone.utc)
        return base + timedelta(days=settings.DOCUMENT_RETENTION_DAYS)

    def generate_presigned_upload_url(
        self,
        object_key: str,
        mime_type: str,
        expires_in: int = 3600
    ) -> str:
        if self.is_mock or not self.client:
            return f"/api/documents/mock-upload/{object_key}"

        try:
            url = self.client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": object_key,
                    "ContentType": mime_type
                },
                ExpiresIn=expires_in
            )
            return url
        except ClientError as e:
            logger.error(f"S3 presigned URL generation error: {e}")
            raise

    def get_object_bytes(self, object_key: str) -> bytes:
        if self.is_mock or not self.client:
            if object_key in self._mock_storage:
                return self._mock_storage[object_key]
            # Valid minimal PDF byte sequence if extension is pdf
            if object_key.endswith(".pdf"):
                return (
                    b"%PDF-1.4\n"
                    b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
                    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
                    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                    b"/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> "
                    b"/Contents 4 0 R >>\nendobj\n"
                    b"4 0 obj\n<< /Length 72 >>\nstream\n"
                    b"BT\n/F1 12 Tf\n72 700 Td\n"
                    b"(Sample mock study document text for offline testing and reviewer creation.) Tj\n"
                    b"ET\nendstream\nendobj\n"
                    b"xref\n0 5\n"
                    b"0000000000 65535 f \n"
                    b"0000000009 00000 n \n"
                    b"0000000058 00000 n \n"
                    b"0000000115 00000 n \n"
                    b"0000000299 00000 n \n"
                    b"trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n422\n%%EOF\n"
                )
            return b"Sample mock study document text for offline testing."

        try:
            response = self.client.get_object(Bucket=self.bucket, Key=object_key)
            return response["Body"].read()
        except ClientError as e:
            logger.error(f"S3 get_object error for {object_key}: {e}")
            raise

    def delete_object(self, object_key: str) -> bool:
        if self.is_mock or not self.client:
            return True

        try:
            self.client.delete_object(Bucket=self.bucket, Key=object_key)
            return True
        except ClientError as e:
            logger.error(f"S3 delete_object error for {object_key}: {e}")
            return False

s3_service = S3Service()
