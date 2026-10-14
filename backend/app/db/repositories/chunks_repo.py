import logging
from datetime import UTC, datetime
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

    async def publish_index(self, document_id: str, user_id: str,
                            chunks: list[DocumentChunk], page_count: int,
                            topics: list[str]) -> bool:
        """Publish a complete owned index and READY state in one transaction."""
        from app.db.repositories.documents_repo import documents_repo

        rows: list[dict[str, Any]] = [{"id": c.chunk_id, "document_id": document_id, "user_id": user_id,
                 "chunk_index": c.chunk_index, "content": c.content,
                 "page_start": c.page_start, "page_end": c.page_end, "section": c.section,
                 "source_type": c.source_type, "embedding": c.embedding, "metadata": c.metadata}
                for c in chunks]
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("publish_document_index_v2", {
                "p_document_id": document_id, "p_user_id": user_id, "p_chunks": rows,
                "p_page_count": page_count, "p_topics": topics,
            }))
            return bool(resp.data)
        # No await between validation and publication: one event-loop transaction.
        document = documents_repo._store.get(document_id)
        if not document or document.get("user_id") != user_id or not self._unexpired(document):
            raise ValueError("Document unavailable")
        if document.get("processing_status") == "READY":
            return False
        if (document.get("processing_status") != "INDEXING" or not 1 <= page_count <= 50
                or not 1 <= len(rows) <= 5000
                or len({r["chunk_index"] for r in rows}) != len(rows)
                or any(not r["content"].strip() or r["chunk_index"] < 0
                       or not r["embedding"] or len(r["embedding"]) != 2048 for r in rows)):
            raise ValueError("Invalid document index")
        self._store[document_id] = rows
        document.update({"processing_status": "READY", "processing_error": None,
                         "page_count": page_count, "suggested_topics": topics,
                         "embedding_version": 2,
                         "updated_at": datetime.now(UTC).isoformat()})
        return True

    @staticmethod
    def _unexpired(document: dict[str, Any]) -> bool:
        try:
            return (document.get("processing_status") != "EXPIRED"
                    and datetime.fromisoformat(document["expires_at"].replace("Z", "+00:00"))
                    > datetime.now(UTC))
        except (KeyError, TypeError, ValueError):
            return False

    async def _ready(self, document_id: str, user_id: str) -> bool:
        from app.db.repositories.documents_repo import documents_repo

        document = await documents_repo.get_by_id(document_id, user_id)
        return bool(document and document.get("processing_status") == "READY"
                    and document.get("embedding_version", 2) == 2
                    and self._unexpired(document))

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
            resp = await supabase_session.execute(supabase_session.client.rpc("match_document_chunks_v2", {
                "p_user_id": user_id, "p_query_embedding": query_embedding,
                "p_document_id": document_id, "p_match_count": min(max(top_k, 1), 50),
                "p_sections": section_filter,
            }))
            return resp.data or []
        if not await self._ready(document_id, user_id):
            return []
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
            resp = await supabase_session.execute(supabase_session.client.rpc("match_document_chunks_v2", {
                "p_user_id": user_id, "p_query_embedding": query_embedding,
                "p_document_id": None, "p_match_count": min(max(top_k, 1), 50), "p_sections": None,
            }))
            return resp.data or []

        if not all_chunks:
            for doc_id, doc_chunks in list(self._store.items()):
                if not await self._ready(doc_id, user_id):
                    continue
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

    async def reindex_document_embeddings_v2(self, document_id: str, user_id: str) -> bool:
        """Re-embed a legacy document; it stays hidden from v2 retrieval until finalize."""
        from app.services.embeddings.embedding_service import embedding_service

        if supabase_session.is_configured and supabase_session.client:
            rows: list[dict[str, Any]] = []
            for offset in range(0, 5100, 100):
                response = await supabase_session.execute(
                    supabase_session.client.table("document_chunks")
                    .select("chunk_index,content")
                    .eq("document_id", document_id)
                    .eq("user_id", user_id)
                    .order("chunk_index")
                    .range(offset, offset + 99)
                )
                page = response.data or []
                rows.extend(page)
                if len(page) < 100:
                    break
            if len(rows) > 5000:
                raise ValueError("Invalid document index")
        else:
            rows = await self.get_by_document_id(document_id, user_id)
        if not rows:
            return False
        for start in range(0, len(rows), 64):
            batch = rows[start:start + 64]
            vectors = await embedding_service.embed_texts([row["content"] for row in batch])
            payload = [{"chunk_index": row["chunk_index"], "embedding": vector}
                       for row, vector in zip(batch, vectors, strict=True)]
            if supabase_session.is_configured and supabase_session.client:
                await supabase_session.execute(supabase_session.client.rpc(
                    "reindex_document_chunk_embeddings_v2", {
                        "p_document_id": document_id, "p_user_id": user_id, "p_chunks": payload,
                    }))
            else:
                for row, vector in zip(batch, vectors, strict=True):
                    row["embedding"] = vector
                from app.db.repositories.documents_repo import documents_repo
                document = documents_repo._store.get(document_id)
                if not document or document.get("user_id") != user_id or not self._unexpired(document):
                    raise ValueError("Document unavailable")
        if supabase_session.is_configured and supabase_session.client:
            result = await supabase_session.execute(supabase_session.client.rpc(
                "finalize_document_embedding_v2", {
                    "p_document_id": document_id, "p_user_id": user_id,
                }))
            return bool(result.data)
        from app.db.repositories.documents_repo import documents_repo
        document = documents_repo._store.get(document_id)
        if not document or document.get("user_id") != user_id or not self._unexpired(document):
            raise ValueError("Document unavailable")
        document["embedding_version"] = 2
        return True

    async def delete_by_document_id(self, document_id: str, user_id: str | None = None):
        if supabase_session.is_configured and supabase_session.client:
            query = supabase_session.client.table("document_chunks").delete().eq("document_id", document_id)
            if user_id:
                query = query.eq("user_id", user_id)
            await supabase_session.execute(query)

        self._store.pop(document_id, None)

chunks_repo = ChunksRepository()
