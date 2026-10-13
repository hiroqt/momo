"""Creation replays preserve one logical generation through lost responses."""

import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import httpx
import pytest
from fastapi import Header
from test_postgres_rls import database as database
from test_postgres_rls import document, register_sql
from test_postgres_rls import users as users

from app.api.routes import generations
from app.config import settings
from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.generation_repo import generation_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.main import app
from app.workers.job_queue import job_queue


@pytest.fixture
async def client(monkeypatch):
    owner, other, doc = str(uuid4()), str(uuid4()), str(uuid4())
    documents_repo._store[doc] = {"id": doc, "user_id": owner, "processing_status": "READY", "expires_at": "2099-01-01T00:00:00Z"}
    monkeypatch.setattr(settings, "INLINE_JOB_EXECUTION", False)
    monkeypatch.setattr(settings, "RATE_LIMIT_GENERATION_PER_MINUTE", 100)

    async def identity(x_test_user: str = Header()):
        return AuthenticatedUser(x_test_user)

    app.dependency_overrides[get_current_user] = identity
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test.local") as http:
        yield http, owner, other, {"document_id": doc}, {"x-test-user": owner, "Idempotency-Key": "request-key-1"}
    app.dependency_overrides.pop(get_current_user, None)
    documents_repo._store.pop(doc, None)
    for key in [k for k in generation_repo._requests if k[0] in {owner, other}]:
        generation_repo._requests.pop(key)
    for jobs in (generation_repo._jobs, job_queue._jobs):
        for key in [k for k, job in jobs.items() if job.get("user_id") in {owner, other}]:
            jobs.pop(key)


async def test_concurrent_creates_and_lost_response_produce_one_job(client):
    http, owner, _, payload, headers = client
    replies = await asyncio.gather(*[http.post("/api/generations", json=payload, headers=headers) for _ in range(12)])
    assert all(reply.status_code == 200 for reply in replies)
    assert len({reply.json()["generation_id"] for reply in replies}) == 1
    assert len([job for job in generation_repo._jobs.values() if job["user_id"] == owner]) == 1
    assert len([job for job in job_queue._jobs.values() if job["user_id"] == owner]) == 1


async def test_enqueue_failure_is_recovered_using_original_job(client, monkeypatch):
    http, owner, _, payload, headers = client
    original = generations.dispatch_job

    async def failure(*args, **kwargs):
        raise RuntimeError("private dispatch failure")

    monkeypatch.setattr(generations, "dispatch_job", failure)
    failed = await http.post("/api/generations", json=payload, headers=headers)
    assert failed.status_code == 500
    assert "private dispatch failure" not in failed.text
    original_id = next(job["id"] for job in generation_repo._jobs.values() if job["user_id"] == owner)
    monkeypatch.setattr(generations, "dispatch_job", original)
    replay = await http.post("/api/generations", json=payload, headers=headers)
    assert replay.status_code == 200 and replay.json()["generation_id"] == original_id
    assert len([job for job in job_queue._jobs.values() if job["user_id"] == owner]) == 1


async def test_mismatch_and_foreign_owner_never_reveal_or_create_jobs(client):
    http, owner, other, payload, headers = client
    first = await http.post("/api/generations", json=payload, headers=headers)
    mismatch = await http.post("/api/generations", json={**payload, "count": 2}, headers=headers)
    assert mismatch.status_code == 409 and mismatch.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"
    foreign = await http.post("/api/generations", json=payload, headers={**headers, "x-test-user": other})
    assert foreign.status_code == 404
    assert first.json()["generation_id"] not in foreign.text
    assert len([job for job in generation_repo._jobs.values() if job["user_id"] == owner]) == 1


@pytest.mark.parametrize("state", ["COMPLETED", "FAILED", "GENERATING"])
async def test_replays_return_actual_state_without_dispatch(client, monkeypatch, state):
    http, _, _, payload, headers = client
    first = await http.post("/api/generations", json=payload, headers=headers)
    job = generation_repo._jobs[first.json()["generation_id"]]
    job.update(status=state, stage="Actual stage", progress=100, study_set_id=str(uuid4()) if state == "COMPLETED" else None)
    documents_repo._store[payload["document_id"]]["processing_status"] = "EXPIRED"

    async def forbidden(*args, **kwargs):
        pytest.fail("A replay must not dispatch terminal or running work")

    monkeypatch.setattr(generations, "dispatch_job", forbidden)
    replay = await http.post("/api/generations", json=payload, headers=headers)
    assert replay.status_code == 200
    assert replay.json()["status"] == state and replay.json()["stage"] == "Actual stage"
    assert replay.json()["study_set_id"] == job["study_set_id"]


async def test_without_key_preserves_independent_creations_and_invalid_key_denies(client):
    http, _, _, payload, headers = client
    unkeyed = {"x-test-user": headers["x-test-user"]}
    first = await http.post("/api/generations", json=payload, headers=unkeyed)
    second = await http.post("/api/generations", json=payload, headers=unkeyed)
    assert first.json()["generation_id"] != second.json()["generation_id"]
    invalid = await http.post("/api/generations", json=payload, headers={**headers, "Idempotency-Key": "bad"})
    assert invalid.status_code == 422


async def test_ready_but_expired_source_cannot_start_new_generation(client):
    http, owner, _, payload, headers = client
    documents_repo._store[payload["document_id"]]["expires_at"] = "2000-01-01T00:00:00Z"
    response = await http.post("/api/generations", json=payload, headers=headers)
    assert response.status_code == 400
    assert not any(job["user_id"] == owner for job in generation_repo._jobs.values())


@pytest.mark.parametrize("expiry", [None, "", "invalid-date", "2099-01-01T00:00:00"])
async def test_source_expiry_requires_valid_aware_timestamp(client, expiry):
    http, owner, _, payload, headers = client
    document = documents_repo._store[payload["document_id"]]
    if expiry is None:
        document.pop("expires_at")
    else:
        document["expires_at"] = expiry
    response = await http.post("/api/generations", json=payload, headers=headers)
    assert response.status_code == 400
    assert not any(job["user_id"] == owner for job in generation_repo._jobs.values())


async def test_retry_dispatch_failure_recovered_by_original_create_key(client, monkeypatch):
    http, _, _, payload, headers = client
    first = await http.post("/api/generations", json=payload, headers=headers)
    job_id = first.json()["generation_id"]
    generation_repo._jobs[job_id]["status"] = "FAILED"
    queue_job = next(job for job in job_queue._jobs.values() if job["subject_id"] == job_id)
    queue_job["status"] = "dead"
    original = generations.dispatch_generation_retry

    async def failure(*args, **kwargs):
        raise RuntimeError("dispatch unavailable")

    monkeypatch.setattr(generations, "dispatch_generation_retry", failure)
    assert (await http.post(f"/api/generations/{job_id}/retry", headers=headers)).status_code == 500
    monkeypatch.setattr(generations, "dispatch_generation_retry", original)
    replay = await http.post("/api/generations", json=payload, headers=headers)
    assert replay.status_code == 200 and replay.json()["generation_id"] == job_id
    assert queue_job["status"] == "queued"
    assert generation_repo._jobs[job_id]["retry_dispatch_pending"] is False


async def test_create_replay_cannot_reset_terminal_queue_or_recovery_budget(client):
    http, _, _, payload, headers = client
    first = await http.post("/api/generations", json=payload, headers=headers)
    job_id = first.json()["generation_id"]
    queue_job = next(job for job in job_queue._jobs.values() if job["subject_id"] == job_id)
    queue_job.update(status="dead", attempts=3, orphan_recoveries=3)
    replay = await http.post("/api/generations", json=payload, headers=headers)
    assert replay.status_code == 200 and replay.json()["generation_id"] == job_id
    assert queue_job["status"] == "dead"
    assert queue_job["attempts"] == 3 and queue_job["orphan_recoveries"] == 3


async def test_retry_acknowledgment_is_owner_and_revision_scoped(client):
    http, owner, other, payload, headers = client
    first = await http.post("/api/generations", json=payload, headers=headers)
    job_id = first.json()["generation_id"]
    job = generation_repo._jobs[job_id]
    job["status"] = "FAILED"
    await generation_repo.retry_failed(job_id, owner)
    revision = job["updated_at"]
    assert await job_queue.enqueue_generation_retry(other, job_id, revision) is None
    assert job["retry_dispatch_pending"] is True
    assert await job_queue.enqueue_generation_retry(owner, job_id, "old-revision") is None
    assert job["retry_dispatch_pending"] is True
    assert await job_queue.enqueue_generation_retry(owner, job_id, revision)
    assert job["retry_dispatch_pending"] is False


async def test_delayed_retry_snapshot_cannot_reset_finished_queue(client):
    http, owner, _, payload, headers = client
    first = await http.post("/api/generations", json=payload, headers=headers)
    job_id = first.json()["generation_id"]
    job = generation_repo._jobs[job_id]
    job["status"] = "FAILED"
    await generation_repo.retry_failed(job_id, owner)
    revision = job["updated_at"]
    queue_job = next(row for row in job_queue._jobs.values() if row["subject_id"] == job_id)
    queue_job["status"] = "dead"
    assert await job_queue.enqueue_generation_retry(owner, job_id, revision)
    # First request consumed the token. Worker dies before delayed replica B
    # dispatches its identical snapshot; B cannot reset lifetime recovery state.
    queue_job.update(status="dead", attempts=3, orphan_recoveries=3)
    assert await job_queue.enqueue_generation_retry(owner, job_id, revision) is None
    assert queue_job["status"] == "dead" and queue_job["orphan_recoveries"] == 3


async def test_retry_enqueue_failure_retains_authorization_and_queue(client, monkeypatch):
    http, owner, _, payload, headers = client
    first = await http.post("/api/generations", json=payload, headers=headers)
    job_id = first.json()["generation_id"]
    generation_repo._jobs[job_id]["status"] = "FAILED"
    await generation_repo.retry_failed(job_id, owner)
    job = generation_repo._jobs[job_id]
    queue_job = next(row for row in job_queue._jobs.values() if row["subject_id"] == job_id)
    queue_job.update(status="dead", orphan_recoveries=3)

    def failure(*args, **kwargs):
        raise RuntimeError("enqueue failed")

    monkeypatch.setattr(job_queue, "_enqueue_memory_locked", failure)
    with pytest.raises(RuntimeError):
        await job_queue.enqueue_generation_retry(owner, job_id, job["updated_at"])
    assert job["retry_dispatch_pending"] is True
    assert queue_job["status"] == "dead" and queue_job["orphan_recoveries"] == 3


def create_sql(owner, doc, key="generation-key-1", fingerprint="a" * 64):
    payload = {"id": str(uuid4()), "user_id": owner, "document_id": doc, "generation_config": {"source_only": True}}
    return f"SELECT public.create_generation_request('{owner}','{key}','{fingerprint}','{json.dumps(payload)}'::jsonb);"


def test_pg_concurrent_creation_replay_mismatch_and_role_denial(database, users):
    owner, other = users
    doc = document(owner)
    database(register_sql(doc), role="service_role")
    database(f"UPDATE documents SET processing_status='READY' WHERE id='{doc['id']}';")
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: json.loads(database(create_sql(owner, doc["id"]), role="service_role")), range(8)))
    job_id = results[0]["job"]["id"]
    assert {row["job"]["id"] for row in results} == {job_id}
    assert database(f"SELECT count(*) FROM generation_jobs WHERE user_id='{owner}';") == "1"
    assert json.loads(database(create_sql(owner, doc["id"], fingerprint="b" * 64), role="service_role")) == {"conflict": True}
    database(create_sql(other, doc["id"]), role="service_role", success=False)
    assert database(f"SELECT count(*) FROM internal.generation_requests WHERE user_id='{other}';") == "0"
    for role in ("anon", "authenticated"):
        database(create_sql(owner, doc["id"]), role=role, success=False)
        database("SELECT * FROM internal.generation_requests;", role=role, success=False)
    database(f"UPDATE generation_jobs SET status='COMPLETED',progress=100 WHERE id='{job_id}';")
    replay = json.loads(database(create_sql(owner, doc["id"]), role="service_role"))
    assert replay["job"]["status"] == "COMPLETED"


def test_pg_creation_transaction_rolls_back_when_job_invalid(database, users):
    owner, _ = users
    doc = document(owner)
    database(register_sql(doc), role="service_role")
    database(create_sql(owner, doc["id"]), role="service_role", success=False)
    assert database(f"SELECT count(*) FROM generation_jobs WHERE user_id='{owner}';") == "0"
    assert database(f"SELECT count(*) FROM internal.generation_requests WHERE user_id='{owner}';") == "0"
    database(f"UPDATE documents SET processing_status='READY',uploaded_at=now()-interval '4 days',created_at=now()-interval '4 days',expires_at=now()-interval '1 day' WHERE id='{doc['id']}';")
    database(create_sql(owner, doc["id"]), role="service_role", success=False)
    assert database(f"SELECT count(*) FROM internal.generation_requests WHERE user_id='{owner}';") == "0"


def test_pg_retry_authorization_consumed_with_queue_reset_and_rollback(database, users):
    owner, other = users
    doc = document(owner)
    database(register_sql(doc), role="service_role")
    database(f"UPDATE documents SET processing_status='READY' WHERE id='{doc['id']}';")
    job = json.loads(database(create_sql(owner, doc["id"]), role="service_role"))["job"]
    job_id = job["id"]
    queue = json.loads(database(f"SELECT enqueue_background_job('study_generation','{owner}','{job_id}');", role="service_role"))
    queue_id = queue["id"]
    database(f"UPDATE internal.background_jobs SET status='dead',orphan_recoveries=3 WHERE id='{queue_id}';")
    database(f"UPDATE generation_jobs SET retry_dispatch_pending=true,updated_at=clock_timestamp() WHERE id='{job_id}';")
    revision = database(f"SELECT updated_at FROM generation_jobs WHERE id='{job_id}';")

    def dispatch(user=owner, timestamp=revision, role="service_role", success=True):
        return database(f"SELECT enqueue_generation_retry('{user}','{job_id}','{timestamp}'::timestamptz,3);", role=role, success=success)

    assert json.loads(dispatch(user=other)) == {}
    assert json.loads(dispatch(timestamp="2000-01-01T00:00:00Z")) == {}
    for role in ("anon", "authenticated"):
        dispatch(role=role, success=False)
    # A failure after queue reset must roll back both changes, retaining token.
    database("CREATE FUNCTION public.reject_retry_ack() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.retry_dispatch_pending AND NOT NEW.retry_dispatch_pending THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_retry_ack BEFORE UPDATE ON generation_jobs FOR EACH ROW EXECUTE FUNCTION reject_retry_ack();")
    dispatch(success=False)
    assert database(f"SELECT status||':'||orphan_recoveries FROM internal.background_jobs WHERE id='{queue_id}';") == "dead:3"
    assert database(f"SELECT retry_dispatch_pending FROM generation_jobs WHERE id='{job_id}';") == "t"
    database("DROP TRIGGER reject_retry_ack ON generation_jobs; DROP FUNCTION reject_retry_ack();")
    with ThreadPoolExecutor(max_workers=2) as pool:
        outputs = list(pool.map(lambda _: json.loads(dispatch()), range(2)))
    assert sum(bool(result) for result in outputs) == 1
    assert database(f"SELECT retry_dispatch_pending FROM generation_jobs WHERE id='{job_id}';") == "f"
    database(f"UPDATE internal.background_jobs SET status='dead',orphan_recoveries=3 WHERE id='{queue_id}';")
    assert json.loads(dispatch()) == {}
    assert database(f"SELECT status||':'||orphan_recoveries FROM internal.background_jobs WHERE id='{queue_id}';") == "dead:3"


@pytest.mark.parametrize("mutation", ["complete", "delete"])
def test_pg_subject_changes_after_fast_precheck_leave_no_tentative_queue(database, users, mutation):
    owner, _ = users
    doc = document(owner)
    database(register_sql(doc), role="service_role")
    database(f"UPDATE documents SET processing_status='READY' WHERE id='{doc['id']}';")
    job = json.loads(database(create_sql(owner, doc["id"]), role="service_role"))["job"]
    job_id = job["id"]
    database(f"UPDATE generation_jobs SET retry_dispatch_pending=true WHERE id='{job_id}';")
    revision = database(f"SELECT updated_at FROM generation_jobs WHERE id='{job_id}';")
    # Deterministically mutate the subject between the optimistic authorization
    # precheck and the locked recheck, reproducing a competing worker/deletion.
    change = (f"DELETE FROM public.generation_jobs WHERE id='{job_id}';" if mutation == "delete"
              else f"UPDATE public.generation_jobs SET status='COMPLETED',progress=100 WHERE id='{job_id}';")
    database(f"CREATE FUNCTION public.change_retry_subject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.subject_id='{job_id}'::uuid THEN {change} END IF; RETURN NEW; END $$; CREATE TRIGGER change_retry_subject BEFORE INSERT ON internal.background_jobs FOR EACH ROW EXECUTE FUNCTION public.change_retry_subject();")
    try:
        result = json.loads(database(f"SELECT enqueue_generation_retry('{owner}','{job_id}','{revision}'::timestamptz,3);", role="service_role"))
        assert result == {}
        assert database(f"SELECT count(*) FROM internal.background_jobs WHERE subject_id='{job_id}';") == "0"
        if mutation == "complete":
            assert database(f"SELECT status||':'||retry_dispatch_pending FROM generation_jobs WHERE id='{job_id}';") == "COMPLETED:true"
    finally:
        database("DROP TRIGGER change_retry_subject ON internal.background_jobs; DROP FUNCTION public.change_retry_subject();")
