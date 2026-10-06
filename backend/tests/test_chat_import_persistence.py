import asyncio
import copy
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.db.repositories.chat_import_repo import chat_import_repo
from app.db.repositories.chunks_repo import chunks_repo
from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.study_repo import study_repo


@pytest.fixture
def source():
    owner, document_id, chunk_id = (str(uuid4()) for _ in range(3))
    content = "Cells use ATP. Mitosis produces two daughter cells."
    documents_repo._store[document_id] = {"id": document_id, "user_id": owner,
        "processing_status": "READY", "expires_at": (datetime.now(UTC) + timedelta(hours=1)).isoformat()}
    chunks_repo._store[document_id] = [{"id": chunk_id, "user_id": owner, "content": content,
        "page_start": 1, "section": "Biology"}]
    item = {"type": "flashcard", "question": "What do cells use?", "answer": "ATP", "difficulty": "medium",
        "source_metadata": {"document_id": document_id, "chunk_id": chunk_id, "source_id": 1,
                            "page": 1, "section": "Biology", "snippet": content}}
    return owner, document_id, item


async def test_append_retry_and_concurrent_creation_preserve_cards(source):
    owner, document_id, item = source
    original = copy.deepcopy(item)
    results = await asyncio.gather(*(chat_import_repo.persist_card(owner, "Biology imports", item, document_id) for _ in range(20)))
    assert len({row["id"] for row in results}) == 1
    set_id = results[0]["id"]
    assert len(study_repo._study_items[set_id]) == 1
    second = {**item, "question": "What does mitosis produce?", "answer": "two daughter cells"}
    results = await asyncio.gather(*(chat_import_repo.persist_card(owner, "Biology imports", second, document_id) for _ in range(10)))
    assert results[-1]["item_count"] == 2
    assert [row["order_index"] for row in study_repo._study_items[set_id]] == [0, 1]
    assert study_repo._study_items[set_id][0]["question"] == item["question"]
    assert item == original


async def test_import_preserves_existing_same_title_cards(source):
    owner, document_id, item = source
    existing = await study_repo.create_study_set({"user_id": owner, "title": "Biology imports"})
    previous = {"id": str(uuid4()), "study_set_id": existing["id"], "question": "Original",
                "answer": "Original answer", "order_index": 7}
    study_repo._study_items[existing["id"]] = [previous]
    result = await chat_import_repo.persist_card(owner, "Biology imports", item, document_id)
    assert result["id"] == existing["id"] and result["item_count"] == 2
    assert study_repo._study_items[result["id"]][0] == previous
    assert study_repo._study_items[result["id"]][-1]["order_index"] == 8


@pytest.mark.parametrize("case", ["foreign_owner", "foreign_chunk", "expired", "missing_expiry", "tampered_metadata", "invalid_difficulty"])
async def test_invalid_import_changes_nothing(source, case):
    owner, document_id, item = source
    if case == "foreign_owner":
        owner = str(uuid4())
    elif case == "foreign_chunk":
        chunks_repo._store[document_id][0]["user_id"] = str(uuid4())
    elif case == "expired":
        documents_repo._store[document_id]["expires_at"] = (datetime.now(UTC) - timedelta(seconds=1)).isoformat()
    elif case == "missing_expiry":
        documents_repo._store[document_id].pop("expires_at")
    elif case == "tampered_metadata":
        item["source_metadata"]["snippet"] = "untrusted attribution"
    else:
        item["difficulty"] = "invalid"
    before = copy.deepcopy((study_repo._study_sets, study_repo._study_items))
    with pytest.raises((HTTPException, ValueError)):
        await chat_import_repo.persist_card(owner, "Biology imports", item, document_id)
    assert (study_repo._study_sets, study_repo._study_items) == before


async def test_database_failure_never_falls_back_to_local(source, monkeypatch):
    from types import SimpleNamespace

    owner, document_id, item = source
    before = copy.deepcopy((study_repo._study_sets, study_repo._study_items))
    async def fail(query):
        raise RuntimeError("sensitive provider SQL details")
    client = SimpleNamespace(rpc=lambda *args: object())
    monkeypatch.setattr("app.db.repositories.chat_import_repo.supabase_session",
                        SimpleNamespace(is_configured=True, client=client, execute=fail, use_memory=False))
    with pytest.raises(HTTPException) as failure:
        await chat_import_repo.persist_card(owner, "Biology imports", item, document_id)
    assert failure.value.status_code == 503 and "sensitive" not in str(failure.value.detail)
    assert (study_repo._study_sets, study_repo._study_items) == before


async def test_changed_display_source_label_and_whitespace_are_same_import(source):
    owner, document_id, item = source
    first = await chat_import_repo.persist_card(owner, "Chat import label", item, document_id)
    relabeled = {**item, "question": "  What   do cells use?  ", "answer": " ATP ",
                 "source_metadata": {**item["source_metadata"], "source_id": 99, "document_name": "Renamed notes"}}
    repeated = await chat_import_repo.persist_card(owner, "Chat import label", relabeled, document_id)
    assert repeated["id"] == first["id"] and repeated["item_count"] == 1
    assert study_repo._study_items[first["id"]][0]["source_metadata"]["source_id"] == 1
