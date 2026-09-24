import logging
from typing import Optional, Dict
from datetime import datetime, timezone, timedelta
from app.config import settings
from app.db.session import supabase_session
from app.services.storage.base import BaseStorageService

logger = logging.getLogger(__name__)

class SupabaseStorageService(BaseStorageService):
    def __init__(self):
        self.bucket = getattr(settings, "SUPABASE_STORAGE_BUCKET", "documents")
        self._mock_storage: Dict[str, bytes] = {}

    @property
    def is_configured(self) -> bool:
        return (
            supabase_session.is_configured
            and supabase_session.client is not None
        )

    def save_mock_object(self, object_key: str, data: bytes) -> None:
        self._mock_storage[object_key] = data

    def generate_presigned_upload_url(
        self,
        object_key: str,
        mime_type: str,
        expires_in: int = 3600
    ) -> str:
        """
        Generate a signed direct upload URL for the mobile client.
        If live Supabase is not configured or fails, falls back to the local mock endpoint.
        """
        if not self.is_configured:
            return f"/api/documents/mock-upload/{object_key}"

        try:
            res = supabase_session.client.storage.from_(self.bucket).create_signed_upload_url(
                path=object_key
            )
            # res is a dict like {'signed_url': '...', 'signedUrl': '...', 'token': '...', 'path': '...'}
            url = res.get("signed_url") or res.get("signedUrl")
            if url:
                return str(url)
            return f"/api/documents/mock-upload/{object_key}"
        except Exception as e:
            logger.warning(
                f"Failed to generate Supabase signed upload URL for {object_key}: {e}. "
                f"Falling back to local mock upload endpoint."
            )
            return f"/api/documents/mock-upload/{object_key}"

    def get_object_bytes(self, object_key: str) -> bytes:
        """
        Retrieve file bytes for processing.
        Falls back to local mock storage or sample PDF if unconfigured.
        """
        if not self.is_configured:
            if object_key in self._mock_storage:
                return self._mock_storage[object_key]
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
            data = supabase_session.client.storage.from_(self.bucket).download(object_key)
            return data
        except Exception as e:
            logger.error(f"Supabase Storage download error for {object_key}: {e}")
            if object_key in self._mock_storage:
                return self._mock_storage[object_key]
            raise

    def delete_object(self, object_key: str) -> bool:
        """
        Delete an object from Supabase Storage.
        """
        self._mock_storage.pop(object_key, None)
        if not self.is_configured:
            return True

        try:
            supabase_session.client.storage.from_(self.bucket).remove([object_key])
            return True
        except Exception as e:
            logger.error(f"Supabase Storage delete_object error for {object_key}: {e}")
            return False

    def cleanup_expired_documents(self, days: int = 3) -> int:
        """
        Delete objects older than `days` in the storage bucket.
        """
        if not self.is_configured:
            return 0
        try:
            # Query Supabase storage objects via SQL or storage listing
            # Objects older than retention threshold
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            # List files in the bucket
            files = supabase_session.client.storage.from_(self.bucket).list()
            expired_keys = []
            for f in files:
                created_at_str = f.get("created_at")
                if created_at_str:
                    try:
                        created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                        if created_at < cutoff:
                            expired_keys.append(f.get("name"))
                    except Exception:
                        pass
            if expired_keys:
                supabase_session.client.storage.from_(self.bucket).remove(expired_keys)
                logger.info(f"Cleaned up {len(expired_keys)} expired documents from Supabase Storage.")
            return len(expired_keys)
        except Exception as e:
            logger.error(f"Error during Supabase Storage expired cleanup: {e}")
            return 0
