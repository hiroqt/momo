"""Assemble retrieved, owner-scoped chunks into delimited untrusted evidence blocks."""

import logging
from html import escape
from typing import Any

logger = logging.getLogger(__name__)


class SynthesizedEvidence:
    def __init__(
        self,
        context_text: str,
        sources: list[dict[str, Any]],
        is_sufficient: bool = True,
        evidence_texts: dict[str, str] | None = None,
    ):
        self.context_text = context_text
        # Persistable provenance (no full chunk text).
        self.sources = sources
        self.is_sufficient = is_sufficient
        # Full retrieved chunk text keyed by chunk_id, used only for support validation.
        self.evidence_texts = evidence_texts or {}


class SynthesisService:
    def synthesize_context(
        self,
        chunks: list[dict[str, Any]],
        min_total_chars: int = 40
    ) -> SynthesizedEvidence:
        if not chunks:
            return SynthesizedEvidence(context_text="", sources=[], is_sufficient=False)

        usable = [c for c in chunks if isinstance(c.get("content"), str) and c["content"].strip()]
        total_length = sum(len(c["content"].strip()) for c in usable)
        if not usable or total_length < min_total_chars:
            return SynthesizedEvidence(context_text="", sources=[], is_sufficient=False)

        context_blocks = []
        sources = []
        evidence_texts: dict[str, str] = {}

        for idx, c in enumerate(usable):
            source_id = idx + 1
            doc_id = c.get("document_id")
            page = c.get("page_start", 1)
            section = c.get("section") or "General"
            content = c["content"].strip()
            chunk_id = c.get("id") or c.get("chunk_id")

            sources.append({
                "source_id": source_id,
                "chunk_id": chunk_id,
                "document_id": doc_id,
                "page": page,
                "section": section,
                "snippet": content[:200]
            })
            if chunk_id:
                evidence_texts[str(chunk_id)] = content

            # Escape document text so it cannot close or forge evidence delimiters.
            context_blocks.append(
                f'<evidence source_id="{source_id}" page="{escape(str(page))}" '
                f'section="{escape(str(section))}">\n{escape(content, quote=False)}\n</evidence>'
            )

        return SynthesizedEvidence(
            context_text="\n".join(context_blocks),
            sources=sources,
            is_sufficient=True,
            evidence_texts=evidence_texts,
        )


synthesis_service = SynthesisService()
