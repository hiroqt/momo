import asyncio
import time
from uuid import uuid4

import jwt
import pytest
from fastapi import HTTPException

from app.config import Settings, settings
from app.db.repositories.chat_repo import ChatRepository
from app.db.repositories.chunks_repo import ChunksRepository
from app.db.repositories.sync_repo import SyncRepository
from app.db.session import SupabaseSession
from app.dependencies import get_current_user


@pytest.fixture
def secure_auth(monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEV_AUTH", False)
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "test-signing-key-with-at-least-32-characters")
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example.supabase.co")


def token(**updates):
    payload = {"sub": str(uuid4()), "exp": int(time.time()) + 60, "iat": int(time.time()),
               "aud": "authenticated", "iss": "https://example.supabase.co/auth/v1", "role": "authenticated"}
    payload.update(updates)
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


@pytest.mark.parametrize("value", [None, "Bearer test-token-victim", "Bearer invalid", "Basic token"])
async def test_auth_rejects_implicit_bypasses(secure_auth, value):
    with pytest.raises(HTTPException) as exc:
        await get_current_user(value)
    assert exc.value.status_code == 401
    assert "signing" not in str(exc.value.detail)


@pytest.mark.parametrize("updates", [{"aud": "wrong"}, {"iss": "wrong"}, {"exp": 1}, {"sub": "victim"}, {"role": "service_role"}])
async def test_auth_claim_constraints(secure_auth, updates):
    with pytest.raises(HTTPException):
        await get_current_user("Bearer " + token(**updates))


async def test_verified_user_and_unsigned_rejection(secure_auth):
    subject = str(uuid4())
    assert (await get_current_user("Bearer " + token(sub=subject))).id == subject
    with pytest.raises(HTTPException):
        await get_current_user("Bearer " + jwt.encode({"sub": subject}, "", algorithm="none"))


def test_production_disallows_mock_modes():
    with pytest.raises(ValueError):
        Settings(_env_file=None, ENVIRONMENT="production", DATABASE_BACKEND="memory")
    with pytest.raises(ValueError):
        Settings(_env_file=None, ENVIRONMENT="production", ENABLE_DEV_AUTH=True)


@pytest.mark.parametrize("overrides", [{"DOCUMENT_RETENTION_DAYS": 4}, {"MAX_FILE_SIZE_MB": 16},
    {"MAX_PAGE_COUNT": 51}, {"MONTHLY_DOCUMENT_LIMIT": 11}, {"STORAGE_PROVIDER": "unknown"},
    {"SUPABASE_STORAGE_BUCKET": "public"}])
def test_product_security_constraints(overrides):
    with pytest.raises(ValueError):
        Settings(_env_file=None, **overrides)


def test_sync_rejects_naive_time_and_invalid_reference():
    from pydantic import ValidationError

    from app.schemas.sync import SyncEventItem
    with pytest.raises(ValidationError):
        SyncEventItem(event_id="x", result="correct", occurred_at="2026-01-01T12:00:00")
    with pytest.raises(ValidationError):
        SyncEventItem(event_id="x", result="correct", occurred_at="2026-01-01T12:00:00Z", study_item_id="not-uuid")


async def test_generation_retry_claim_allows_one_caller():
    from app.db.repositories.generation_repo import GenerationRepository
    repo = GenerationRepository()
    job = await repo.create_job({"user_id": "alice", "status": "FAILED"})
    outcomes = await asyncio.gather(*(repo.retry_failed(job["id"], "alice") for _ in range(10)))
    assert sum(result is not None for result in outcomes) == 1
    assert await repo.retry_failed(job["id"], "bob") is None


async def test_generation_finalization_is_idempotent_and_terminal():
    from app.db.repositories.documents_repo import documents_repo
    from app.db.repositories.generation_repo import GenerationRepository
    from app.db.repositories.study_repo import study_repo
    repo = GenerationRepository()
    doc = await documents_repo.create({"user_id": "alice"})
    job = await repo.create_job({"user_id": "alice", "document_id": doc["id"], "status": "VALIDATING"})
    payload = {"user_id": "alice", "document_id": doc["id"], "title": "Reviewer", "generation_config": {"source_only": True}}
    items = [{"type": "flashcard", "question": "What is ATP?", "answer": "Adenosine triphosphate", "source_metadata": {"document_id": doc["id"], "page": 1}}]
    results = await asyncio.gather(*(repo.complete_with_study_set(job["id"], "alice", payload, items) for _ in range(10)))
    assert len({row["id"] for row in results}) == 1
    result = results[0]
    assert len(study_repo._study_items[result["id"]]) == 1
    assert job["status"] == "COMPLETED" and job["study_set_id"] == result["id"]
    await repo.update_job(job["id"], "FAILED", "Failed", 100, "Late worker failure")
    assert job["status"] == "COMPLETED"
    assert "id" not in payload and "id" not in items[0]


async def test_generation_finalization_rolls_back_invalid_items():
    from pydantic import ValidationError

    from app.db.repositories.documents_repo import documents_repo
    from app.db.repositories.generation_repo import GenerationRepository
    from app.db.repositories.study_repo import study_repo
    repo = GenerationRepository()
    doc = await documents_repo.create({"user_id": "alice"})
    job = await repo.create_job({"user_id": "alice", "document_id": doc["id"], "status": "VALIDATING"})
    count = len(study_repo._study_sets)
    with pytest.raises(ValidationError):
        await repo.complete_with_study_set(job["id"], "alice", {"document_id": doc["id"], "title": "Reviewer"}, [{"type": "flashcard", "source_metadata": {}}])
    assert len(study_repo._study_sets) == count and not job.get("study_set_id")
    assert job["status"] == "VALIDATING"


async def test_folder_uniqueness_checks_beyond_first_page():
    from app.db.repositories.folder_repo import FolderRepository
    repo = FolderRepository()
    for index in range(102):
        await repo.create_folder({"user_id": "alice", "name": f"Folder {index}"})
    with pytest.raises(HTTPException) as exc:
        await repo.create_folder({"user_id": "alice", "name": " folder 101 "})
    assert exc.value.status_code == 409
    assert (await repo.create_folder({"user_id": "bob", "name": "Folder 101"}))["user_id"] == "bob"


async def test_chat_delete_and_insert_require_owner():
    repo = ChatRepository()
    session = await repo.create_session("alice")
    await repo.add_message(session["id"], "alice", "user", "private")
    assert not await repo.delete_session(session["id"], "bob")
    assert await repo.get_messages(session["id"], "bob") == []
    with pytest.raises(ValueError):
        await repo.add_message(session["id"], "bob", "user", "overwrite")
    assert len(await repo.get_messages(session["id"], "alice")) == 1


async def test_document_specific_retrieval_requires_owner():
    repo = ChunksRepository()
    repo._store["doc"] = [{"user_id": "alice", "content": "private", "embedding": [1.0]}]
    assert await repo.search_similar_for_user("bob", [1.0], document_id="doc") == []


async def test_sync_idempotency_is_owner_scoped():
    repo = SyncRepository()
    events = [{"event_id": "same", "result": "correct"}]
    assert (await repo.process_batch("alice", events))[0:2] == (1, 0)
    assert (await repo.process_batch("alice", events))[0:2] == (0, 1)
    assert (await repo.process_batch("bob", events))[0:2] == (1, 0)


async def test_query_io_does_not_block_event_loop():
    session = SupabaseSession()
    class SlowQuery:
        def execute(self):
            time.sleep(0.05)
            return "done"
    task = asyncio.create_task(session.execute(SlowQuery()))
    await asyncio.sleep(0.005)
    assert not task.done()
    assert await task == "done"


async def test_cancelled_query_holds_concurrency_permit(monkeypatch):
    import threading
    monkeypatch.setattr(settings, "DATABASE_MAX_CONCURRENT_QUERIES", 1)
    session = SupabaseSession()
    started = threading.Event()
    release = threading.Event()
    class BlockingQuery:
        def execute(self):
            started.set()
            release.wait(2)
            return "first"
    class FastQuery:
        def execute(self):
            return "second"
    first = asyncio.create_task(session.execute(BlockingQuery()))
    while not started.is_set():
        await asyncio.sleep(0.001)
    first.cancel()
    with pytest.raises(asyncio.CancelledError):
        await first
    second = asyncio.create_task(session.execute(FastQuery()))
    try:
        await asyncio.sleep(0.01)
        assert not second.done()
    finally:
        release.set()
    assert await second == "second"


async def test_completed_generation_worker_skips_ai(monkeypatch):
    from app.db.repositories.generation_repo import generation_repo
    from app.services.retrieval.retrieval_service import retrieval_service
    from app.workers.generation_worker import generation_worker
    async def forbidden_retrieval(**kwargs):
        raise AssertionError("Completed reviewer must not invoke retrieval")
    monkeypatch.setattr(retrieval_service, "retrieve_evidence", forbidden_retrieval)
    job = await generation_repo.create_job({"user_id": "alice", "status": "COMPLETED"})
    await generation_worker.process_generation(job["id"], "alice", "doc", {})
    assert job["status"] == "COMPLETED"
