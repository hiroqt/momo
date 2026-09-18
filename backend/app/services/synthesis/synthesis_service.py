from typing import List, Dict, Any, Tuple
from app.domain.documents.models import DocumentChunk
import logging

logger = logging.getLogger(__name__)

class SynthesizedEvidence:
    def __init__(
        self,
        context_text: str,
        sources: List[Dict[str, Any]],
        is_sufficient: bool = True
    ):
        self.context_text = context_text
        self.sources = sources
        self.is_sufficient = is_sufficient

class SynthesisService:
    def synthesize_context(
        self,
        chunks: List[Dict[str, Any]],
        min_total_chars: int = 40
    ) -> SynthesizedEvidence:
        if not chunks:
            return SynthesizedEvidence(context_text="", sources=[], is_sufficient=False)

        total_length = sum(len(c.get("content", "")) for c in chunks)
        if total_length < min_total_chars:
            return SynthesizedEvidence(context_text="", sources=[], is_sufficient=False)

        context_blocks = []
        sources = []

        for idx, c in enumerate(chunks):
            doc_id = c.get("document_id")
            page = c.get("page_start", 1)
            section = c.get("section", "General")
            content = c.get("content", "").strip()

            source_ref = {
                "source_id": idx + 1,
                "document_id": doc_id,
                "page": page,
                "section": section,
                "snippet": content[:200]
            }
            sources.append(source_ref)

            block = (
                f"[Source #{idx + 1} | Page {page} | Section: {section}]\n"
                f"{content}\n"
            )
            context_blocks.append(block)

        full_context = "\n---\n".join(context_blocks)
        return SynthesizedEvidence(
            context_text=full_context,
            sources=sources,
            is_sufficient=True
        )

synthesis_service = SynthesisService()
