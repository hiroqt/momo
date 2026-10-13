"""Atomic publication, rollback and lifecycle exclusion on local PostgreSQL."""
import json
from concurrent.futures import ThreadPoolExecutor
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
            "chunk_index": index, "content": content, "embedding": [1.0] + [0.0] * 1535}


def publish(owner, source, rows):
    return (f"SELECT public.publish_document_index('{source}','{owner}',"
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
    vector = "[" + ",".join(["1"] + ["0"] * 1535) + "]"
    database(f"INSERT INTO document_chunks(document_id,user_id,chunk_index,content,embedding) VALUES ('{source}','{owner}',0,'Partial evidence','{vector}'::extensions.vector);")
    query = f"SELECT count(*) FROM match_document_chunks('{owner}','{vector}'::extensions.vector,NULL,10,NULL);"
    assert database(query, role="service_role") == "0"
    database(f"UPDATE documents SET processing_status='FAILED' WHERE id='{source}';")
    assert database(query, role="service_role") == "0"
    database(f"UPDATE documents SET processing_status='INDEXING' WHERE id='{source}';")
    database(publish(owner, source, [chunk(owner, source)]), role="service_role")
    assert database(query, role="service_role") == "1"
    database(f"UPDATE documents SET processing_status='EXPIRED' WHERE id='{source}';")
    assert database(query, role="service_role") == "0"


@pytest.mark.asyncio
async def test_memory_publication_retains_ready_index_and_excludes_expired():
    owner, source = str(uuid4()), str(uuid4())
    repo = ChunksRepository()
    documents_repo._store[source] = {"id": source, "user_id": owner,
                                    "processing_status": "INDEXING", "expires_at": "2099-01-01T00:00:00Z"}
    rows = [DocumentChunk(chunk_id=str(uuid4()), document_id=source, user_id=owner,
                          chunk_index=0, page_start=1, page_end=1, source_type="text",
                          content="Complete source evidence", embedding=[1.0] + [0.0] * 1535)]
    try:
        assert await repo.search_similar(source, [1.0] + [0.0] * 1535, owner) == []
        assert await repo.publish_index(source, owner, rows, 1, [])
        original = repo._store[source]
        await documents_repo.update_status(source, "INDEXING")
        await documents_repo.update_status(source, "FAILED", error="Late worker")
        assert documents_repo._store[source]["processing_status"] == "READY"
        assert documents_repo._store[source]["processing_error"] is None
        assert not await repo.publish_index(source, owner, rows, 1, [])
        assert repo._store[source] is original
        assert len(await repo.search_similar_for_user(owner, [1.0] + [0.0] * 1535)) == 1
        documents_repo._store[source]["expires_at"] = "2000-01-01T00:00:00Z"
        assert await repo.search_similar_for_user(owner, [1.0] + [0.0] * 1535) == []
        with pytest.raises(ValueError, match="unavailable"):
            await repo.publish_index(source, owner, rows, 1, [])
    finally:
        documents_repo._store.pop(source, None)
