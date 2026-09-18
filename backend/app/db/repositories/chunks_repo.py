from typing import List, Dict, Any, Optional
import numpy as np
from app.db.session import supabase_session
from app.domain.documents.models import DocumentChunk
import logging

logger = logging.getLogger(__name__)

class ChunksRepository:
    def __init__(self):
        # In-memory storage: doc_id -> list of chunk dicts
        self._store: Dict[str, List[Dict[str, Any]]] = {}

    async def save_chunks(self, document_id: str, user_id: str, chunks: List[DocumentChunk]):
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
            try:
                supabase_session.client.table("document_chunks").insert(chunk_dicts).execute()
                return
            except Exception as e:
                logger.error(f"Error saving chunks to Supabase: {e}")

        self._store[document_id] = chunk_dicts

    async def get_by_document_id(self, document_id: str) -> List[Dict[str, Any]]:
        if supabase_session.is_configured and supabase_session.client:
            resp = supabase_session.client.table("document_chunks").select("*").eq("document_id", document_id).execute()
            return resp.data or []
        return self._store.get(document_id, [])

    async def search_similar(
        self,
        document_id: str,
        query_embedding: List[float],
        top_k: int = 10,
        section_filter: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        chunks = await self.get_by_document_id(document_id)
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
            if not emb:
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

    async def delete_by_document_id(self, document_id: str, user_id: Optional[str] = None):
        if supabase_session.is_configured and supabase_session.client:
            try:
                query = supabase_session.client.table("document_chunks").delete().eq("document_id", document_id)
                if user_id:
                    query = query.eq("user_id", user_id)
                query.execute()
            except Exception as e:
                logger.warning(f"Supabase error deleting chunks: {e}")

        self._store.pop(document_id, None)

chunks_repo = ChunksRepository()

