"""Atomic publication, rollback and lifecycle exclusion on local PostgreSQL."""
import json
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from uuid import uuid4

import pytest
from test_postgres_rls import database as database
from test_postgres_rls import document, register_sql
from test_postgres_rls import users as users

from app.db.repositories.chunks_repo import ChunksRepository
from app.db.repositories.documents_repo import documents_repo
from app.domain.documents.models import DocumentChunk


def chunk(owner, source, index=0, content="Complete source evidence"):
    return {"id": str(uuid4()), "document_id": source, "user_id": owner,
            "chunk_index": index, "content": content, "embedding": [1.0] + [0.0] * 2047}


def publish(owner, source, rows):
    return (f"SELECT public.publish_document_index_v2('{source}','{owner}',"
            f"'{json.dumps(rows)}'::jsonb,1,'[]'::jsonb);")


def seed(database, owner):
    source = document(owner)
    database(register_sql(source), role="service_role")
    database(f"UPDATE documents SET processing_status='INDEXING' WHERE id='{source['id']}';")
    return source["id"]


def test_publish_rejects_clients_and_wrong_owner(database, users):
    owner, other = users
    source = seed(database, owner)
    rows = [chunk(owner, source)]
    for role in ("anon", "authenticated"):
        database(publish(owner, source, rows), role=role, success=False)
    database(publish(other, source, rows), role="service_role", success=False)
    database(publish(owner, source, [chunk(other, source)]), role="service_role", success=False)
    assert database(f"SELECT count(*) FROM document_chunks WHERE document_id='{source}';") == "0"
    assert database(publish(owner, source, rows), role="service_role") == "t"


def test_invalid_replacement_rolls_back_existing_index_and_status(database, users):
    owner, _ = users
    source = seed(database, owner)
    old = chunk(owner, source, content="Previous intact index")
    database(f"INSERT INTO document_chunks(id,document_id,user_id,chunk_index,content) VALUES ('{old['id']}','{source}','{owner}',0,'Previous intact index');")
    invalid = chunk(owner, source, index=1)
    invalid["embedding"] = [1.0]
    database(publish(owner, source, [chunk(owner, source), invalid]), role="service_role", success=False)
    assert database(f"SELECT id FROM document_chunks WHERE document_id='{source}';") == old["id"]
    assert database(f"SELECT processing_status FROM documents WHERE id='{source}';") == "INDEXING"
    database(publish(owner, source, [chunk(owner, source), chunk(owner, source)]), role="service_role", success=False)
    assert database(f"SELECT id FROM document_chunks WHERE document_id='{source}';") == old["id"]


def test_concurrent_publications_commit_exactly_one_complete_index(database, users):
    owner, _ = users
    source = seed(database, owner)
    batches = [[chunk(owner, source, index=i, content=f"Attempt {attempt}") for i in range(3)]
               for attempt in range(8)]
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda rows: database(publish(owner, source, rows), role="service_role"), batches))
    assert results.count("t") == 1
    assert results.count("f") == 7
    assert database(f"SELECT count(*)||'|'||count(DISTINCT content) FROM document_chunks WHERE document_id='{source}';") == "3|1"
    assert database(f"SELECT processing_status FROM documents WHERE id='{source}';") == "READY"
    assert database(f"SELECT count(*) FROM document_chunks WHERE document_id='{source}' AND embedding IS NOT NULL;") == "0"
    assert database(f"SELECT embedding_version FROM documents WHERE id='{source}';") == "2"


def test_expired_or_wrong_status_cannot_publish(database, users):
    owner, _ = users
    for status in ("FAILED", "EXPIRED", "UPLOADED"):
        source = seed(database, owner)
        database(f"UPDATE documents SET processing_status='{status}' WHERE id='{source}';")
        database(publish(owner, source, [chunk(owner, source)]), role="service_role", success=False)
    source = seed(database, owner)
    database(f"UPDATE documents SET uploaded_at=now()-interval '4 days',expires_at=now()-interval '1 day' WHERE id='{source}';")
    database(publish(owner, source, [chunk(owner, source)]), role="service_role", success=False)


def test_rag_excludes_unpublished_failed_and_expired_sources(database, users):
    owner, _ = users
    source = seed(database, owner)
    vector = "[" + ",".join(["1"] + ["0"] * 2047) + "]"
    database(f"INSERT INTO document_chunks(document_id,user_id,chunk_index,content,embedding_v2) VALUES ('{source}','{owner}',0,'Partial evidence','{vector}'::extensions.vector);")
    query = f"SELECT count(*) FROM match_document_chunks_v2('{owner}','{vector}'::extensions.vector,NULL,10,NULL);"
    assert database(query, role="service_role") == "0"
    database(f"UPDATE documents SET processing_status='FAILED' WHERE id='{source}';")
    assert database(query, role="service_role") == "0"
    database(f"UPDATE documents SET processing_status='INDEXING' WHERE id='{source}';")
    database(publish(owner, source, [chunk(owner, source)]), role="service_role")
    assert database(query, role="service_role") == "1"
    database(f"UPDATE documents SET processing_status='EXPIRED' WHERE id='{source}';")
    assert database(query, role="service_role") == "0"


def test_legacy_reindex_hides_partial_v2_and_preserves_old_vectors(database, users):
    owner, other = users
    source = seed(database, owner)
    database(f"UPDATE documents SET processing_status='READY' WHERE id='{source}';")
    old_vector = "[" + ",".join(["1"] + ["0"] * 1535) + "]"
    new_vector = [1.0] + [0.0] * 2047
    database(f"INSERT INTO document_chunks(document_id,user_id,chunk_index,content,embedding) VALUES ('{source}','{owner}',0,'Legacy evidence','{old_vector}'::extensions.vector);")
    query = f"SELECT count(*) FROM match_document_chunks_v2('{owner}','{json.dumps(new_vector)}'::extensions.vector,NULL,10,NULL);"
    assert database(query, role="service_role") == "0"
    database(f"SELECT finalize_document_embedding_v2('{source}','{owner}');", role="service_role", success=False)
    payload = json.dumps([{"chunk_index": 0, "embedding": new_vector}])
    rpc = (f"SELECT reindex_document_chunk_embeddings_v2('{source}','{owner}',"
           f"'{payload}'::jsonb);")
    database(f"SELECT reindex_document_chunk_embeddings_v2('{source}','{other}',"
             f"'{payload}'::jsonb);", role="service_role", success=False)
    database(f"SELECT finalize_document_embedding_v2('{source}','{other}');",
             role="service_role", success=False)
    assert database(query, role="service_role") == "0"
    assert database(rpc, role="service_role") == "1"
    assert database(query, role="service_role") == "0"
    database(f"SELECT finalize_document_embedding_v2('{source}','{owner}');", role="service_role")
    assert database(query, role="service_role") == "1"
    assert database(f"SELECT vector_dims(embedding)||'|'||vector_dims(embedding_v2) FROM document_chunks WHERE document_id='{source}';") == "1536|2048"
    assert database(f"SELECT count(*) FROM match_document_chunks('{owner}','{old_vector}'::extensions.vector,NULL,10,NULL);", role="service_role") == "1"


@pytest.mark.asyncio
async def test_memory_publication_retains_ready_index_and_excludes_expired():
    owner, source = str(uuid4()), str(uuid4())
    repo = ChunksRepository()
    documents_repo._store[source] = {"id": source, "user_id": owner,
                                    "processing_status": "INDEXING", "expires_at": "2099-01-01T00:00:00Z"}
    rows = [DocumentChunk(chunk_id=str(uuid4()), document_id=source, user_id=owner,
                          chunk_index=0, page_start=1, page_end=1, source_type="text",
                          content="Complete source evidence", embedding=[1.0] + [0.0] * 2047)]
    try:
        assert await repo.search_similar(source, [1.0] + [0.0] * 2047, owner) == []
        assert await repo.publish_index(source, owner, rows, 1, [])
        original = repo._store[source]
        await documents_repo.update_status(source, "INDEXING")
        await documents_repo.update_status(source, "FAILED", error="Late worker")
        assert documents_repo._store[source]["processing_status"] == "READY"
        assert documents_repo._store[source]["processing_error"] is None
        assert not await repo.publish_index(source, owner, rows, 1, [])
        assert repo._store[source] is original
        assert len(await repo.search_similar_for_user(owner, [1.0] + [0.0] * 2047)) == 1
        documents_repo._store[source]["expires_at"] = "2000-01-01T00:00:00Z"
        assert await repo.search_similar_for_user(owner, [1.0] + [0.0] * 2047) == []
        with pytest.raises(ValueError, match="unavailable"):
            await repo.publish_index(source, owner, rows, 1, [])
    finally:
        documents_repo._store.pop(source, None)


@pytest.mark.asyncio
async def test_legacy_document_reindex_switches_only_after_all_batches(monkeypatch):
    from app.services.embeddings import embedding_service as embedding_module

    owner, source = str(uuid4()), str(uuid4())
    repo = ChunksRepository()
    documents_repo._store[source] = {"id": source, "user_id": owner,
        "processing_status": "READY", "embedding_version": 1,
        "expires_at": "2099-01-01T00:00:00Z"}
    repo._store[source] = [{"user_id": owner, "chunk_index": i, "content": f"chunk {i}",
                           "embedding": [0.0] * 2048} for i in range(65)]
    calls = []

    async def embed(texts):
        calls.append(len(texts))
        return [[1.0] * 2048 for _ in texts]

    monkeypatch.setattr(embedding_module.embedding_service, "embed_texts", embed)
    try:
        assert await repo.reindex_document_embeddings_v2(source, owner)
        assert calls == [64, 1]
        assert documents_repo._store[source]["embedding_version"] == 2
        assert all(len(row["embedding"]) == 2048 for row in repo._store[source])
        assert len(await repo.search_similar(source, [1.0] * 2048, owner)) == 10
    finally:
        documents_repo._store.pop(source, None)


@pytest.mark.asyncio
async def test_legacy_reindex_pages_more_than_postgrest_row_limit(monkeypatch):
    import app.db.repositories.chunks_repo as chunks_module
    from app.services.embeddings import embedding_service as embedding_module

    source, owner = str(uuid4()), str(uuid4())
    rows = [{"chunk_index": i, "content": f"chunk {i}"} for i in range(1001)]
    ranges, embedding_batches, rpc_calls = [], [], []

    class Query:
        def __init__(self, table=None, params=None):
            self.table = table
            self.params = params
            self.bounds = (0, 0)

        def __getattr__(self, _name):
            return lambda *args, **kwargs: self

        def range(self, start, end):
            self.bounds = start, end
            ranges.append(self.bounds)
            return self

        def execute(self):
            if self.table:
                start, end = self.bounds
                return SimpleNamespace(data=rows[start:end + 1])
            rpc_calls.append(self.params)
            return SimpleNamespace(data=True)

    class Client:
        def table(self, table):
            return Query(table=table)

        def rpc(self, name, params):
            assert name in {"reindex_document_chunk_embeddings_v2", "finalize_document_embedding_v2"}
            return Query(params=params)

    class Session:
        client = Client()
        is_configured = True

        async def execute(self, query):
            return query.execute()

    async def embed(texts):
        embedding_batches.append(len(texts))
        return [[1.0] * 2048 for _ in texts]

    monkeypatch.setattr(chunks_module, "supabase_session", Session())
    monkeypatch.setattr(embedding_module.embedding_service, "embed_texts", embed)
    assert await ChunksRepository().reindex_document_embeddings_v2(source, owner)
    assert ranges == [(start, start + 99) for start in range(0, 1100, 100)]
    assert embedding_batches == [64] * 15 + [41]
    assert len(rpc_calls) == 17
