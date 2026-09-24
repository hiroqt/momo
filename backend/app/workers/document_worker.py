import asyncio
from typing import Optional
from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.chunks_repo import chunks_repo
from app.services.storage import storage_service
from app.services.extraction.extractor_service import extractor_service
from app.services.extraction.chunking_service import chunking_service
from app.services.embeddings.embedding_service import embedding_service
import logging

logger = logging.getLogger(__name__)

class DocumentWorker:
    async def process_document(
        self,
        document_id: str,
        user_id: str,
        s3_object_key: str,
        filename: str,
        file_type: str
    ):
        try:
            logger.info(f"Starting document processing: {document_id}")
            # 1. Status: VALIDATING
            await documents_repo.update_status(document_id, "VALIDATING")
            await asyncio.sleep(0.05)

            # 2. Fetch object bytes from storage
            file_bytes = storage_service.get_object_bytes(s3_object_key)

            # 3. Status: EXTRACTING
            await documents_repo.update_status(document_id, "EXTRACTING")
            doc_content = await extractor_service.extract_document(
                document_id=document_id,
                filename=filename,
                file_type=file_type,
                file_bytes=file_bytes
            )

            # 4. Status: CHUNKING
            await documents_repo.update_status(document_id, "CHUNKING", page_count=doc_content.total_pages)
            chunks = chunking_service.chunk_document(doc_content)
            logger.info(f"Document {document_id} chunked into {len(chunks)} chunks")

            # 5. Status: EMBEDDING
            await documents_repo.update_status(document_id, "EMBEDDING")
            chunk_texts = [c.content for c in chunks]
            embeddings = await embedding_service.embed_texts(chunk_texts)

            for chunk, emb in zip(chunks, embeddings):
                chunk.embedding = emb

            # 6. Status: INDEXING
            await documents_repo.update_status(document_id, "INDEXING")
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

        except Exception as e:
            logger.error(f"Error processing document {document_id}: {e}", exc_info=True)
            await documents_repo.update_status(document_id, "FAILED", error=str(e))

document_worker = DocumentWorker()
