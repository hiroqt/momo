"""Durable job queue/runner semantics (WORK-01/WORK-02) in local memory mode.

The PostgreSQL RPCs with identical semantics are exercised in
test_durable_jobs_postgres.py. No network or provider traffic is used.
"""

import asyncio
import time
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import pytest
from fastapi import Header

from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.generation_repo import generation_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.main import app
from app.workers import runner as runner_module
from app.workers.errors import PermanentJobError, TransientJobError
from app.workers.job_queue import JobQueue, JobQueueError, job_queue
from app.workers.runner import JobRunner


def make_runner(queue, handlers, **kwargs):
    kwargs.setdefault("lease_seconds", 15)
    kwargs.setdefault("heartbeat_seconds", 0.01)
    kwargs.setdefault("retry_delay_seconds", 0)
    return JobRunner(queue, handlers, worker_id=kwargs.pop("worker_id", f"test-{uuid4().hex[:6]}"), **kwargs)


async def noop(job):
    return None


async def test_enqueue_is_idempotent_per_subject_under_concurrency():
    queue, user, subject = JobQueue(), str(uuid4()), str(uuid4())
    jobs = await asyncio.gather(*(queue.enqueue("document_ingestion", user, subject) for _ in range(25)))
    assert len({job["id"] for job in jobs}) == 1
    other_user = await queue.enqueue("document_ingestion", str(uuid4()), subject)
    assert other_user["id"] != jobs[0]["id"]


@pytest.mark.parametrize("kind,max_attempts", [("unknown_kind", 3), ("document_ingestion", 0),
                                               ("document_ingestion", 11)])
async def test_enqueue_rejects_invalid_parameters(kind, max_attempts):
    with pytest.raises(JobQueueError):
        await JobQueue().enqueue(kind, str(uuid4()), str(uuid4()), max_attempts=max_attempts)


@pytest.mark.parametrize("worker,limit,lease", [("bad worker", 1, 60), ("w", 0, 60), ("w", 51, 60),
                                                ("w", 1, 5), ("w", 1, 901)])
async def test_claim_rejects_unbounded_parameters(worker, limit, lease):
    with pytest.raises(JobQueueError):
        await JobQueue().claim(worker, limit=limit, lease_seconds=lease)


async def test_concurrent_workers_claim_each_job_exactly_once():
    queue, user = JobQueue(), str(uuid4())
    for _ in range(40):
        await queue.enqueue("document_ingestion", user, str(uuid4()))
    batches = await asyncio.gather(*(queue.claim(f"worker-{i}", limit=7, lease_seconds=60) for i in range(8)))
    claimed = [job["id"] for batch in batches for job in batch]
    assert len(claimed) == len(set(claimed)) == 40
    assert await queue.claim("late-worker", lease_seconds=60) == []


async def test_stale_lease_is_recovered_and_retried_then_dead_lettered():
    queue, user, doc_id = JobQueue(), str(uuid4()), str(uuid4())
    await documents_repo.create({"id": doc_id, "user_id": user, "processing_status": "EXTRACTING"})
    await queue.enqueue("document_ingestion", user, doc_id, max_attempts=2)
    for attempt in (1, 2):
        [job] = await queue.claim("crashing-worker", lease_seconds=15)
        assert job["attempts"] == attempt
        queue._jobs[job["id"]]["lease_expires_at"] = time.time() - 1  # worker died; lease lapses
    assert await queue.claim("next-worker", lease_seconds=15) == []
    stored = queue._jobs[job["id"]]
    assert stored["status"] == "dead" and stored["last_error"] == "LEASE_EXPIRED"
    doc = await documents_repo.get_by_id(doc_id, user)
    assert doc["processing_status"] == "FAILED"
    assert doc["processing_error"] == "The uploaded document could not be processed."


async def test_dead_letter_never_downgrades_ready_document():
    queue, user, doc_id = JobQueue(), str(uuid4()), str(uuid4())
    await documents_repo.create({"id": doc_id, "user_id": user, "processing_status": "READY"})
    await queue.enqueue("document_ingestion", user, doc_id, max_attempts=1)
    [job] = await queue.claim("w1", lease_seconds=15)
    assert await queue.fail(job["id"], "w1", "HANDLER_FAILED") == "dead"
    assert (await documents_repo.get_by_id(doc_id, user))["processing_status"] == "READY"


async def test_only_lease_owner_can_heartbeat_complete_or_fail():
    queue = JobQueue()
    await queue.enqueue("study_generation", str(uuid4()), str(uuid4()))
    [job] = await queue.claim("owner", lease_seconds=15)
    assert not await queue.heartbeat(job["id"], "intruder", 15)
    assert not await queue.complete(job["id"], "intruder")
    assert await queue.fail(job["id"], "intruder", "HANDLER_FAILED") is None
    assert await queue.heartbeat(job["id"], "owner", 15)
    assert await queue.complete(job["id"], "owner")
    assert not await queue.complete(job["id"], "owner")  # idempotent; no double completion


@pytest.mark.parametrize("code", ["", "lower", "Has spaces", "X" * 65, "SQLSTATE 42501: secret"])
async def test_failure_codes_are_sanitized_machine_codes(code):
    queue = JobQueue()
    await queue.enqueue("study_generation", str(uuid4()), str(uuid4()))
    [job] = await queue.claim("owner", lease_seconds=15)
    with pytest.raises(JobQueueError):
        await queue.fail(job["id"], "owner", code)


async def test_runner_retries_transient_failures_until_success():
    queue, calls = JobQueue(), []

    async def flaky(job):
        calls.append(job["attempts"])
        if len(calls) < 3:
            raise TransientJobError("temporary")

    job = await queue.enqueue("document_ingestion", str(uuid4()), str(uuid4()), max_attempts=3)
    runner = make_runner(queue, {"document_ingestion": flaky})
    outcomes = [await runner.run_now(job["id"]) for _ in range(3)]
    assert outcomes == ["queued", "queued", "succeeded"] and calls == [1, 2, 3]


async def test_runner_dead_letters_permanent_and_exhausted_failures():
    queue = JobQueue()

    async def broken(job):
        raise PermanentJobError("bad input")

    async def crashes(job):
        raise RuntimeError("secret provider detail")

    permanent = await queue.enqueue("document_ingestion", str(uuid4()), str(uuid4()), max_attempts=5)
    exhausted = await queue.enqueue("study_generation", str(uuid4()), str(uuid4()), max_attempts=1)
    runner = make_runner(queue, {"document_ingestion": broken, "study_generation": crashes})
    assert await runner.run_now(permanent["id"]) == "dead"
    assert await runner.run_now(exhausted["id"]) == "dead"
    assert queue._jobs[exhausted["id"]]["last_error"] == "HANDLER_FAILED"


async def test_runner_cancels_handler_when_lease_is_lost():
    queue, cancelled = JobQueue(), asyncio.Event()

    async def slow(job):
        try:
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            cancelled.set()
            raise

    job = await queue.enqueue("study_generation", str(uuid4()), str(uuid4()))
    runner = make_runner(queue, {"study_generation": slow})
    [claimed] = await queue.claim(runner.worker_id, lease_seconds=15)
    queue._jobs[job["id"]]["lease_owner"] = "someone-else"  # lease reclaimed elsewhere
    assert await asyncio.wait_for(runner.run_job(claimed), timeout=2) == "lease_lost"
    assert cancelled.is_set()


async def test_runner_bounds_concurrency_and_heartbeats_long_jobs():
    queue, active, peak = JobQueue(), 0, 0

    async def work(job):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.05)
        active -= 1

    for _ in range(9):
        await queue.enqueue("document_ingestion", str(uuid4()), str(uuid4()))
    runner = make_runner(queue, {"document_ingestion": work}, concurrency=3)
    processed = 0
    while (count := await runner.run_once()):
        processed += count
    assert processed == 9 and peak == 3
    assert all(job["status"] == "succeeded" for job in queue._jobs.values())


async def test_serve_drains_in_flight_jobs_on_shutdown(monkeypatch):
    queue, finished = JobQueue(), []
    monkeypatch.setattr(runner_module.settings, "WORKER_POLL_SECONDS", 0.01)

    async def work(job):
        await asyncio.sleep(0.05)
        finished.append(job["id"])

    for _ in range(2):
        await queue.enqueue("document_ingestion", str(uuid4()), str(uuid4()))
    runner = make_runner(queue, {"document_ingestion": work}, concurrency=2)
    monkeypatch.setattr(runner, "maintain", lambda: asyncio.sleep(0))
    stop = asyncio.Event()
    server = asyncio.create_task(runner.serve(stop))
    await asyncio.sleep(0.02)
    stop.set()
    await asyncio.wait_for(server, timeout=2)
    assert len(finished) == 2


async def test_requeue_only_restarts_finished_jobs():
    queue = JobQueue()
    job = await queue.enqueue("study_generation", str(uuid4()), str(uuid4()))
    assert (await queue.enqueue("study_generation", job["user_id"], job["subject_id"], requeue=True))["status"] == "queued"
    [claimed] = await queue.claim("w", lease_seconds=15)
    running = await queue.enqueue("study_generation", job["user_id"], job["subject_id"], requeue=True)
    assert running["status"] == "running" and running["attempts"] == 1
    await queue.complete(claimed["id"], "w")
    again = await queue.enqueue("study_generation", job["user_id"], job["subject_id"], requeue=True)
    assert again["status"] == "queued" and again["attempts"] == 0 and again["id"] == job["id"]


async def test_orphaned_subjects_are_recovered_once():
    queue, user = JobQueue(), str(uuid4())
    old = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    doc_id, fresh_id, gen_id = str(uuid4()), str(uuid4()), str(uuid4())
    await documents_repo.create({"id": doc_id, "user_id": user, "processing_status": "UPLOADED",
                                 "created_at": old, "updated_at": old})
    await documents_repo.create({"id": fresh_id, "user_id": user, "processing_status": "UPLOADED"})
    await generation_repo.create_job({"id": gen_id, "user_id": user, "status": "PENDING"})
    generation_repo._jobs[gen_id]["updated_at"] = old
    assert await queue.recover_orphans(300) == 2
    assert await queue.recover_orphans(300) == 0
    subjects = {job["subject_id"] for job in queue._jobs.values()}
    assert {doc_id, gen_id} <= subjects and fresh_id not in subjects


# --------------------------------------------------------------- API flows
@pytest.fixture
async def api():
    owner = str(uuid4())

    async def identity(x_test_user: str = Header()):
        return AuthenticatedUser(x_test_user)

    app.dependency_overrides[get_current_user] = identity
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test.local") as client:
        yield client, {"x-test-user": owner}, owner
    app.dependency_overrides.pop(get_current_user, None)


async def upload(client, headers, content=b"Cells are the basic units of life. " * 20):
    signed = (await client.post("/api/documents/upload-url", headers=headers, json={
        "filename": "notes.txt", "file_type": "txt", "mime_type": "text/plain", "file_size": len(content),
    })).json()
    assert (await client.put(signed["upload_url"], headers=headers, content=content)).status_code == 200
    return {"id": signed["document_id"], "original_filename": "notes.txt", "file_type": "txt",
            "mime_type": "text/plain", "file_size": len(content), "s3_object_key": signed["s3_object_key"]}


async def test_registration_dispatches_one_durable_job_and_lost_response_retry_reuses_it(api, monkeypatch):
    client, headers, owner = api
    calls = []

    async def record(**kwargs):
        calls.append(kwargs["document_id"])
        await documents_repo.update_status(kwargs["document_id"], "READY")

    from app.workers.document_worker import document_worker
    monkeypatch.setattr(document_worker, "process_document", record)
    body = await upload(client, headers)
    responses = await asyncio.gather(*(client.post("/api/documents", headers=headers, json=body) for _ in range(5)))
    assert {r.status_code for r in responses} == {200}
    jobs = [j for j in job_queue._jobs.values() if j["subject_id"] == body["id"]]
    assert len(jobs) == 1 and jobs[0]["status"] == "succeeded" and jobs[0]["user_id"] == owner
    assert calls == [body["id"]]
    assert (await client.get(f"/api/documents/{body['id']}/status", headers=headers)).json()["status"] == "READY"


async def test_real_ingestion_pipeline_runs_through_queue(api):
    client, headers, _ = api
    body = await upload(client, headers)
    assert (await client.post("/api/documents", headers=headers, json=body)).status_code == 200
    status = (await client.get(f"/api/documents/{body['id']}/status", headers=headers)).json()
    assert status["status"] == "READY"
    job = next(j for j in job_queue._jobs.values() if j["subject_id"] == body["id"])
    assert job["status"] == "succeeded" and job["attempts"] == 1


async def test_reprocessing_replaces_partial_index_and_reuses_ready(api):
    from app.db.repositories.chunks_repo import chunks_repo
    from app.workers.document_worker import document_worker
    client, headers, owner = api
    body = await upload(client, headers)
    await client.post("/api/documents", headers=headers, json=body)
    first = await chunks_repo.get_by_document_id(body["id"], owner)
    await documents_repo.update_status(body["id"], "INDEXING")  # simulate crash before READY
    await document_worker.process_document(body["id"], owner, body["s3_object_key"], "notes.txt", "txt")
    second = await chunks_repo.get_by_document_id(body["id"], owner)
    assert len(second) == len(first) and {c["chunk_index"] for c in second} == set(range(len(first)))
    await document_worker.process_document(body["id"], owner, body["s3_object_key"], "notes.txt", "txt")
    assert await chunks_repo.get_by_document_id(body["id"], owner) == second  # READY reused


async def test_transient_storage_failure_retries_before_marking_failed(monkeypatch):
    from app.services.storage.base import StorageUnavailableError
    from app.workers import document_worker as module
    user, doc_id = str(uuid4()), str(uuid4())
    await documents_repo.create({"id": doc_id, "user_id": user, "processing_status": "UPLOADED", "file_size": 5})

    def unavailable(key):
        raise StorageUnavailableError("provider detail")

    monkeypatch.setattr(module.storage_service, "get_object_bytes", unavailable)
    key = f"documents/{user}/{doc_id}/original.txt"
    with pytest.raises(TransientJobError):
        await module.document_worker.process_document(doc_id, user, key, "a.txt", "txt", final_attempt=False)
    assert (await documents_repo.get_by_id(doc_id, user))["processing_status"] != "FAILED"
    await module.document_worker.process_document(doc_id, user, key, "a.txt", "txt", final_attempt=True)
    assert (await documents_repo.get_by_id(doc_id, user))["processing_status"] == "FAILED"


async def test_deleted_source_during_queue_wait_is_a_controlled_no_op():
    user, doc_id = str(uuid4()), str(uuid4())
    job = await job_queue.enqueue("document_ingestion", user, doc_id)
    assert await runner_module.job_runner.run_now(job["id"]) == "succeeded"
    assert await documents_repo.get_by_id(doc_id, user) is None


async def test_generation_handler_skips_completed_and_calls_worker_contract(monkeypatch):
    from app.workers.generation_worker import generation_worker
    user, calls = str(uuid4()), []

    async def record(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(generation_worker, "process_generation", record)
    done = await generation_repo.create_job({"user_id": user, "document_id": "d", "status": "COMPLETED"})
    todo = await generation_repo.create_job({"user_id": user, "document_id": "d", "status": "PENDING",
                                             "generation_config": {"count": 5, "source_only": True}})
    for gen in (done, todo):
        job = await job_queue.enqueue("study_generation", user, gen["id"])
        assert await runner_module.job_runner.run_now(job["id"]) == "succeeded"
    assert calls == [{"job_id": todo["id"], "user_id": user, "document_id": "d",
                      "generation_spec": {"count": 5, "source_only": True}}]


async def test_foreign_user_job_cannot_reach_another_users_subject(monkeypatch):
    from app.workers.generation_worker import generation_worker
    owner, intruder, calls = str(uuid4()), str(uuid4()), []

    async def record(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(generation_worker, "process_generation", record)
    gen = await generation_repo.create_job({"user_id": owner, "document_id": "d", "status": "PENDING"})
    job = await job_queue.enqueue("study_generation", intruder, gen["id"])
    await runner_module.job_runner.run_now(job["id"])
    assert calls == []


async def test_managed_dispatch_never_executes_inline(monkeypatch):
    from fastapi import BackgroundTasks

    from app.workers import dispatch
    monkeypatch.setattr(dispatch.settings, "APP_ENV", "staging")
    tasks = BackgroundTasks()
    await dispatch.dispatch_job("study_generation", str(uuid4()), str(uuid4()), tasks)
    assert tasks.tasks == []


async def test_worker_process_refuses_memory_queue():
    with pytest.raises(RuntimeError):
        await runner_module.main()
