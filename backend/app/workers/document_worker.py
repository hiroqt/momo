import asyncio
import hashlib
import io
import logging
import zipfile

import httpx
from postgrest.exceptions import APIError

from app.config import settings
from app.db.repositories.chunks_repo import chunks_repo
from app.db.repositories.documents_repo import documents_repo
from app.services.embeddings.embedding_service import embedding_service
from app.services.extraction.chunking_service import chunking_service
from app.services.extraction.extractor_service import extractor_service
from app.services.storage import storage_service
from app.services.storage.base import StorageUnavailableError
from app.workers.errors import TransientJobError

logger = logging.getLogger(__name__)

TRANSIENT_FAILURES: tuple[type[BaseException], ...] = (
    StorageUnavailableError, APIError, TimeoutError, ConnectionError, httpx.TransportError,
)
FINISHED_STATES = {"READY", "EXPIRED"}


class DocumentWorker:
    async def process_document(
        self,
        document_id: str,
        user_id: str,
        s3_object_key: str,
        filename: str,
        file_type: str,
        *,
        final_attempt: bool = True,
    ):
        """Ingest one document. Re-running is safe: finished documents are reused,
        partial chunk indexes are replaced, and a transient failure on a
        non-final attempt is raised for the durable queue to retry."""
        try:
            logger.info(f"Starting document processing: {document_id}")
            current = await documents_repo.get_by_id(document_id, user_id)
            if current and current.get("processing_status") in FINISHED_STATES:
                return
            # 1. Status: VALIDATING
            await documents_repo.update_status(document_id, "VALIDATING")

            # 2. Fetch object bytes from storage
            expected_key = storage_service.build_object_key(user_id, document_id, file_type)
            if s3_object_key != expected_key:
                raise ValueError("Invalid storage key")
            file_bytes = await asyncio.to_thread(storage_service.get_object_bytes, s3_object_key)
            document = await documents_repo.get_by_id(document_id, user_id)
            if not document:
                raise ValueError("Document was not found")
            validate_document_bytes(file_bytes, file_type, document["file_size"])
            await documents_repo.set_content_hash(
                document_id, user_id, hashlib.sha256(file_bytes).hexdigest()
            )

            # 3. Status: EXTRACTING
            await documents_repo.update_status(document_id, "EXTRACTING")
            doc_content = await extractor_service.extract_document(
                document_id=document_id,
                filename=filename,
                file_type=file_type,
                file_bytes=file_bytes
            )
            if doc_content.total_pages > settings.MAX_PAGE_COUNT:
                raise ValueError("Document exceeds page limit")

            # 4. Status: CHUNKING
            await documents_repo.update_status(document_id, "CHUNKING", page_count=doc_content.total_pages)
            chunks = chunking_service.chunk_document(doc_content)
            logger.info(f"Document {document_id} chunked into {len(chunks)} chunks")

            # 5. Status: EMBEDDING
            await documents_repo.update_status(document_id, "EMBEDDING")
            chunk_texts = [c.content for c in chunks]
            embeddings = await embedding_service.embed_texts(chunk_texts)

            for chunk, emb in zip(chunks, embeddings, strict=True):
                chunk.embedding = emb

            # 6. Status: INDEXING
            await documents_repo.update_status(document_id, "INDEXING")
            # A retried attempt replaces any partial index instead of duplicating it.
            await chunks_repo.delete_by_document_id(document_id, user_id)
            await chunks_repo.save_chunks(document_id=document_id, user_id=user_id, chunks=chunks)

            # 7. Status: READY
            topics = doc_content.metadata.get("suggested_topics", [])
            await documents_repo.update_status(
                document_id,
                "READY",
                page_count=doc_content.total_pages,
                topics=topics
            )
            logger.info(f"Document {document_id} successfully processed and indexed with {len(topics)} suggested topics.")

        except Exception as exc:  # noqa: BLE001 - persist a safe terminal failure for any pipeline stage
            if not final_attempt and isinstance(exc, TRANSIENT_FAILURES):
                logger.warning("Document processing interrupted for %s (%s); retry scheduled",
                               document_id, type(exc).__name__)
                raise TransientJobError("Document processing will be retried") from None
            logger.error("Document processing failed for %s", document_id)
            latest = await documents_repo.get_by_id(document_id, user_id)
            # A duplicate/late attempt never downgrades a finished document
            # (also enforced by the migration 006 trigger).
            if latest and latest.get("processing_status") in FINISHED_STATES:
                return
            await documents_repo.update_status(
                document_id, "FAILED", error="The uploaded document could not be processed."
            )


def validate_document_bytes(data: bytes, file_type: str, expected_size: int) -> None:
    if not data or len(data) != expected_size or len(data) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise ValueError("Invalid document size")
    kind = file_type.lower().lstrip(".")
    if kind == "pdf":
        if not data.startswith(b"%PDF-"):
            raise ValueError("Invalid PDF")
    elif kind == "txt":
        text = data.decode("utf-8-sig")
        if "\x00" in text:
            raise ValueError("Invalid text document")
    elif kind in {"docx", "pptx"}:
        expected_member = "word/document.xml" if kind == "docx" else "ppt/presentation.xml"
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            members = archive.infolist()
            # Bound decompression before the downstream XML extractor opens entries.
            if len(members) > 5000 or sum(m.file_size for m in members) > 100 * 1024 * 1024:
                raise ValueError("Document expands beyond the allowed size")
            if expected_member not in archive.namelist() or "[Content_Types].xml" not in archive.namelist():
                raise ValueError("Invalid Office document")
            if any(m.flag_bits & 1 for m in members):
                raise ValueError("Encrypted documents are unsupported")
    else:
        raise ValueError("Unsupported document type")

document_worker = DocumentWorker()
