import logging
from typing import Any

import numpy as np

from app.db.session import supabase_session
from app.domain.documents.models import DocumentChunk

logger = logging.getLogger(__name__)

class ChunksRepository:
    def __init__(self) -> None:
        # In-memory storage: doc_id -> list of chunk dicts
        self._store: dict[str, list[dict[str, Any]]] = {}

    async def save_chunks(self, document_id: str, user_id: str, chunks: list[DocumentChunk]):
        chunk_dicts = []
        for c in chunks:
            cd = {
                "id": c.chunk_id,
                "document_id": document_id,
                "user_id": user_id,
                "chunk_index": c.chunk_index,
                "content": c.content,
                "page_start": c.page_start,
                "page_end": c.page_end,
                "section": c.section,
                "source_type": c.source_type,
                "embedding": c.embedding,
                "metadata": c.metadata
            }
            chunk_dicts.append(cd)

        if supabase_session.is_configured and supabase_session.client:
            await supabase_session.execute(supabase_session.client.table("document_chunks").insert(chunk_dicts))
            return

        self._store[document_id] = chunk_dicts

    async def get_by_document_id(self, document_id: str, user_id: str) -> list[dict[str, Any]]:
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("document_chunks").select("*").eq("document_id", document_id).eq("user_id", user_id))
            return resp.data or []
        return [c for c in self._store.get(document_id, []) if c.get("user_id") == user_id]

    async def search_similar(
        self,
        document_id: str,
        query_embedding: list[float],
        user_id: str,
        top_k: int = 10,
        section_filter: list[str] | None = None
    ) -> list[dict[str, Any]]:
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("match_document_chunks", {
                "p_user_id": user_id, "p_query_embedding": query_embedding,
                "p_document_id": document_id, "p_match_count": min(max(top_k, 1), 50),
                "p_sections": section_filter,
            }))
            return resp.data or []
        chunks = await self.get_by_document_id(document_id, user_id)
        if not chunks:
            return []

        if section_filter:
            filtered = [c for c in chunks if c.get("section") in section_filter]
            if filtered:
                chunks = filtered

        query_vec = np.array(query_embedding, dtype=np.float32)
        q_norm = np.linalg.norm(query_vec)
        if q_norm == 0:
            return chunks[:top_k]

        scored_chunks = []
        for c in chunks:
            emb = c.get("embedding")
            if not emb or len(emb) != len(query_vec):
                score = 0.0
            else:
                chunk_vec = np.array(emb, dtype=np.float32)
                c_norm = np.linalg.norm(chunk_vec)
                if c_norm > 0:
                    score = float(np.dot(query_vec, chunk_vec) / (q_norm * c_norm))
                else:
                    score = 0.0
            scored_chunks.append((score, c))

        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        return [c for score, c in scored_chunks[:top_k]]

    async def search_similar_for_user(
        self,
        user_id: str,
        query_embedding: list[float],
        top_k: int = 10,
        document_id: str | None = None
    ) -> list[dict[str, Any]]:
        if document_id:
            return await self.search_similar(
                document_id=document_id,
                user_id=user_id,
                query_embedding=query_embedding,
                top_k=top_k
            )

        all_chunks: list[dict[str, Any]] = []
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("match_document_chunks", {
                "p_user_id": user_id, "p_query_embedding": query_embedding,
                "p_document_id": None, "p_match_count": min(max(top_k, 1), 50), "p_sections": None,
            }))
            return resp.data or []

        if not all_chunks:
            for doc_chunks in self._store.values():
                for c in doc_chunks:
                    if c.get("user_id") == user_id:
                        all_chunks.append(c)

        if not all_chunks:
            return []

        query_vec = np.array(query_embedding, dtype=np.float32)
        q_norm = np.linalg.norm(query_vec)
        if q_norm == 0:
            return all_chunks[:top_k]

        scored = []
        for c in all_chunks:
            emb = c.get("embedding")
            if not emb or len(emb) != len(query_vec):
                score = 0.0
            else:
                c_vec = np.array(emb, dtype=np.float32)
                c_norm = np.linalg.norm(c_vec)
                score = float(np.dot(query_vec, c_vec) / (q_norm * c_norm)) if c_norm > 0 else 0.0
            scored.append((score, c))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [c for _, c in scored[:top_k]]

    async def delete_by_document_id(self, document_id: str, user_id: str | None = None):
        if supabase_session.is_configured and supabase_session.client:
            query = supabase_session.client.table("document_chunks").delete().eq("document_id", document_id)
            if user_id:
                query = query.eq("user_id", user_id)
            await supabase_session.execute(query)

        self._store.pop(document_id, None)

chunks_repo = ChunksRepository()
