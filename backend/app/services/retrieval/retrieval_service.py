from typing import List, Dict, Any, Optional
from app.services.embeddings.embedding_service import embedding_service
from app.db.repositories.chunks_repo import chunks_repo
import logging

logger = logging.getLogger(__name__)

class RetrievalService:
    def build_search_query(self, topic: str, custom_instruction: Optional[str] = None) -> str:
        base_topic = (topic or "").strip()
        if custom_instruction and custom_instruction.strip():
            instruction = custom_instruction.strip()
            return f"{base_topic}. Focus and key aspects: {instruction}"
        return base_topic or "General Overview"

    async def retrieve_evidence(
        self,
        document_id: str,
        query: str,
        top_k: int = 12,
        section_filter: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        # 1. Embed query
        query_embedding = await embedding_service.embed_query(query)

        # 2. Vector search via repository
        raw_chunks = await chunks_repo.search_similar(
            document_id=document_id,
            query_embedding=query_embedding,
            top_k=max(top_k * 2, 16),
            section_filter=section_filter
        )

        # 3. Informational diversity filter & topic keyword relevance prioritization
        query_keywords = [
            w.lower()
            for w in query.split()
            if len(w) > 3 and w.lower() not in {"focus", "aspects", "general", "overview", "core", "study", "concepts", "material"}
        ]

        if query_keywords:
            def keyword_score(chunk: Dict[str, Any]) -> int:
                text = (chunk.get("content", "") + " " + chunk.get("section", "")).lower()
                return sum(1 for kw in query_keywords if kw in text)

            # Stable sort prioritizing chunks with topic keyword matches
            raw_chunks.sort(key=keyword_score, reverse=True)

        selected_chunks: List[Dict[str, Any]] = []
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

retrieval_service = RetrievalService()

