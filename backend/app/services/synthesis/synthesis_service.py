"""Assemble retrieved, owner-scoped chunks into delimited untrusted evidence blocks."""

import logging
import re
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
        # Exact text sent to the model, keyed by chunk_id for support validation.
        self.evidence_texts = evidence_texts or {}


class SynthesisService:
    def synthesize_context(
        self,
        chunks: list[dict[str, Any]],
        min_total_chars: int = 40,
        max_context_bytes: int | None = None,
    ) -> SynthesizedEvidence:
        if not chunks:
            return SynthesizedEvidence(context_text="", sources=[], is_sufficient=False)

        usable = [c for c in chunks if isinstance(c.get("content"), str) and c["content"].strip()]
        if max_context_bytes is not None:
            usable = self._fit_ranked_chunks(usable, max_context_bytes)
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
            model_content = escape(content, quote=False)
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
                evidence_texts[str(chunk_id)] = model_content

            # Escape document text so it cannot close or forge evidence delimiters.
            context_blocks.append(
                f'<evidence source_id="{source_id}" page="{escape(str(page))}" '
                f'section="{escape(str(section))}">\n{model_content}\n</evidence>'
            )

        return SynthesizedEvidence(
            context_text="\n".join(context_blocks),
            sources=sources,
            is_sufficient=True,
            evidence_texts=evidence_texts,
        )

    @staticmethod
    def _fit_ranked_chunks(chunks: list[dict[str, Any]], max_context_bytes: int) -> list[dict[str, Any]]:
        """Keep top-ranked complete sentences that fit, and validate against those exact excerpts."""
        if max_context_bytes <= 0:
            return []

        selected: list[dict[str, Any]] = []
        used_bytes = 0

        def render(source_id: int, chunk: dict[str, Any], content: str) -> str:
            return (
                f'<evidence source_id="{source_id}" page="{escape(str(chunk.get("page_start", 1)))}" '
                f'section="{escape(str(chunk.get("section") or "General"))}">\n'
                f'{escape(content, quote=False)}\n</evidence>'
            )

        for chunk in chunks:
            content = chunk["content"].strip()
            sentences = []
            for line in content.splitlines():
                line = line.strip()
                if not line:
                    continue
                if re.match(r"^(?:[-*•]\s+|\d+[.)]\s+)", line):
                    sentences.append(line)
                else:
                    sentences.extend(re.split(r"(?<=[.!?])\s+", line))
            excerpt_parts: list[str] = []
            for sentence in sentences:
                sentence = sentence.strip()
                if not sentence:
                    continue
                is_bullet = bool(re.match(r"^(?:[-*•]\s+|\d+[.)]\s+)", sentence))
                if not is_bullet and not re.search(r"[.!?][\"')\]]?$", sentence):
                    continue
                candidate = " ".join([*excerpt_parts, sentence])
                source_id = len(selected) + 1
                separator_bytes = 1 if selected and not excerpt_parts else 0
                if used_bytes + separator_bytes + len(render(source_id, chunk, candidate).encode("utf-8")) <= max_context_bytes:
                    excerpt_parts.append(sentence)
                elif not excerpt_parts:
                    continue
                else:
                    break
            if excerpt_parts:
                excerpt = " ".join(excerpt_parts)
                selected.append({**chunk, "content": excerpt})
                used_bytes += (1 if len(selected) > 1 else 0) + len(
                    render(len(selected), chunk, excerpt).encode("utf-8")
                )
            if used_bytes >= max_context_bytes:
                break
        return selected


synthesis_service = SynthesisService()
