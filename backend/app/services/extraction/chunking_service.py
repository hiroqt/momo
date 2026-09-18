import uuid
from typing import List
from app.domain.documents.models import DocumentContent, DocumentChunk

class ChunkingService:
    def __init__(self, target_chunk_size: int = 800, overlap: int = 150):
        self.target_chunk_size = target_chunk_size
        self.overlap = overlap

    def chunk_document(self, content: DocumentContent) -> List[DocumentChunk]:
        chunks: List[DocumentChunk] = []
        chunk_index = 0

        for page in content.pages:
            page_text = page.text.strip()
            if not page_text:
                continue

            # First, check if page has structured sections
            if page.sections:
                for section in page.sections:
                    sec_text = section.content.strip()
                    if not sec_text:
                        continue
                    sec_chunks = self._split_text(sec_text)
                    for sc in sec_chunks:
                        chunks.append(
                            DocumentChunk(
                                chunk_id=str(uuid.uuid4()),
                                document_id=content.document_id,
                                chunk_index=chunk_index,
                                content=sc,
                                page_start=page.page_number,
                                page_end=page.page_number,
                                section=section.title,
                                source_type=content.source_type,
                                metadata={"is_ocr": page.is_ocr}
                            )
                        )
                        chunk_index += 1
            else:
                # Page level chunking
                page_chunks = self._split_text(page_text)
                for pc in page_chunks:
                    chunks.append(
                        DocumentChunk(
                            chunk_id=str(uuid.uuid4()),
                            document_id=content.document_id,
                            chunk_index=chunk_index,
                            content=pc,
                            page_start=page.page_number,
                            page_end=page.page_number,
                            section="General",
                            source_type=content.source_type,
                            metadata={"is_ocr": page.is_ocr}
                        )
                    )
                    chunk_index += 1

        return chunks

    def _split_text(self, text: str) -> List[str]:
        words = text.split()
        if not words:
            return []

        chunks: List[str] = []
        i = 0
        while i < len(words):
            end = min(i + self.target_chunk_size, len(words))
            chunk_str = " ".join(words[i:end])
            chunks.append(chunk_str)
            if end == len(words):
                break
            i += max(1, self.target_chunk_size - self.overlap)

        return chunks

chunking_service = ChunkingService()
