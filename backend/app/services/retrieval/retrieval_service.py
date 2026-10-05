import logging
from typing import Any

from app.db.repositories.chunks_repo import chunks_repo
from app.services.embeddings.embedding_service import embedding_service

logger = logging.getLogger(__name__)

class RetrievalService:
    def build_search_query(self, topic: str, custom_instruction: str | None = None) -> str:
        base_topic = (topic or "").strip()
        if custom_instruction and custom_instruction.strip():
            instruction = custom_instruction.strip()
            return f"{base_topic}. Focus and key aspects: {instruction}"
        return base_topic or "General Overview"

    async def retrieve_evidence(
        self,
        document_id: str,
        query: str,
        user_id: str,
        top_k: int = 12,
        section_filter: list[str] | None = None,
        document_ids: list[str] | None = None
    ) -> list[dict[str, Any]]:
        # 1. Embed query
        query_embedding = await embedding_service.embed_query(query)

        # 2. Vector search via repository
        all_doc_ids = list(set([document_id] + (document_ids or [])))
        raw_chunks = []
        for d_id in all_doc_ids:
            if not d_id:
                continue
            doc_chunks = await chunks_repo.search_similar(
                document_id=d_id,
                user_id=user_id,
                query_embedding=query_embedding,
                top_k=max(top_k * 2, 16),
                section_filter=section_filter
            )
            raw_chunks.extend(doc_chunks)

        # 3. Informational diversity filter & topic keyword relevance prioritization
        query_keywords = [
            w.lower()
            for w in query.split()
            if len(w) > 3 and w.lower() not in {"focus", "aspects", "general", "overview", "core", "study", "concepts", "material"}
        ]

        if query_keywords:
            def keyword_score(chunk: dict[str, Any]) -> int:
                text = (chunk.get("content", "") + " " + chunk.get("section", "")).lower()
                return sum(1 for kw in query_keywords if kw in text)

            # Stable sort prioritizing chunks with topic keyword matches
            raw_chunks.sort(key=keyword_score, reverse=True)

        selected_chunks: list[dict[str, Any]] = []
        seen_snippets: set = set()

        for c in raw_chunks:
            content = c.get("content", "").strip()
            if not content:
                continue
            # Simple fingerprint of initial 80 chars to detect near-duplicates
            fingerprint = content[:80].lower()
            if fingerprint in seen_snippets:
                continue
            seen_snippets.add(fingerprint)
            selected_chunks.append(c)

            if len(selected_chunks) >= top_k:
                break

        return selected_chunks

    async def retrieve_evidence_for_chat(
        self,
        user_id: str,
        query: str,
        document_id: str | None = None,
        top_k: int = 8
    ) -> list[dict[str, Any]]:
        from app.db.repositories.documents_repo import documents_repo

        # 1. Embed query
        query_embedding = await embedding_service.embed_query(query)

        # 2. Vector search for user
        chunks = await chunks_repo.search_similar_for_user(
            user_id=user_id,
            query_embedding=query_embedding,
            top_k=top_k,
            document_id=document_id
        )

        doc_name_cache: dict[str, str] = {}
        enriched_results: list[dict[str, Any]] = []

        for c in chunks:
            doc_id = c.get("document_id", "")
            if doc_id and doc_id not in doc_name_cache:
                doc = await documents_repo.get_by_id(doc_id, user_id)
                doc_name_cache[doc_id] = doc.get("original_filename") if doc else "Document"

            enriched_results.append({
                "document_id": doc_id,
                "document_name": doc_name_cache.get(doc_id, "Document"),
                "page_start": c.get("page_start"),
                "page_end": c.get("page_end"),
                "section": c.get("section") or "General",
                "content": c.get("content", "")
            })

        return enriched_results

retrieval_service = RetrievalService()
