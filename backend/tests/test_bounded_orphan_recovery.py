"""Lifetime orphan-recovery budget, lifecycle guards and bounded scan fairness."""
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from test_postgres_rls import database as database
from test_postgres_rls import document, register_sql
from test_postgres_rls import users as users

from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.generation_repo import generation_repo
from app.workers.job_queue import JobQueue


@pytest.fixture(autouse=True)
def isolate_memory_repositories(monkeypatch):
    monkeypatch.setattr(documents_repo, "_store", {})
    monkeypatch.setattr(generation_repo, "_jobs", {})


def old():
    return (datetime.now(UTC) - timedelta(hours=1)).isoformat()


def orphan(database, owner, kind="document_ingestion"):
    if kind == "document_ingestion":
        source = document(owner)
        database(register_sql(source), role="service_role")
        subject = source["id"]
        table = "documents"
    else:
        subject = str(uuid4())
        database(f"INSERT INTO generation_jobs(id,user_id,status) VALUES ('{subject}','{owner}','PENDING');")
        table = "generation_jobs"
    database(f"UPDATE {table} SET updated_at=now()-interval '1 hour' WHERE id='{subject}';")
    return subject


def recover(database, limit=500, attempts=3):
    return int(database(f"SELECT recover_orphaned_work(300,{limit},{attempts});", role="service_role"))


def row(database, subject):
    return json.loads(database(f"SELECT to_jsonb(j) FROM internal.background_jobs j WHERE subject_id='{subject}';"))


@pytest.mark.parametrize("kind", ["document_ingestion", "study_generation"])
def test_sql_orphan_budget_and_intentional_manual_reset(database, users, kind):
    owner, _ = users
    subject = orphan(database, owner, kind)
    recover(database, attempts=2)
    assert row(database, subject)["orphan_recoveries"] == 1
    database(f"UPDATE internal.background_jobs SET status='succeeded' WHERE subject_id='{subject}';")
    recover(database, attempts=10)  # periodic arguments cannot expand this job's budget
    assert row(database, subject)["orphan_recoveries"] == 2
    assert row(database, subject)["max_attempts"] == 2
    database(f"UPDATE internal.background_jobs SET status='succeeded' WHERE subject_id='{subject}';")
    recover(database)
    job = row(database, subject)
    assert job["status"] == "dead" and job["last_error"] == "ORPHAN_RECOVERY_EXHAUSTED"
    table, field = ("documents", "processing_status") if kind == "document_ingestion" else ("generation_jobs", "status")
    assert database(f"SELECT {field} FROM {table} WHERE id='{subject}';") == "FAILED"
    recover(database)
    assert row(database, subject)["orphan_recoveries"] == 2
    manual = json.loads(database(f"SELECT enqueue_background_job('{kind}','{owner}','{subject}','{{}}',2,true);", role="service_role"))
    assert manual["orphan_recoveries"] == 0 and manual["status"] == "queued"


def test_sql_active_jobs_do_not_starve_or_reset_and_concurrent_recovery_is_once(database, users):
    owner, _ = users
    active = orphan(database, owner)
    recover(database)
    database(f"UPDATE internal.background_jobs SET status='running',attempts=2,lease_owner='worker',lease_expires_at=now()+interval '1 hour' WHERE subject_id='{active}';")
    database(f"UPDATE documents SET updated_at=now()-interval '2 hours' WHERE id='{active}';")
    target = orphan(database, owner)
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda _: recover(database, limit=1), range(8)))
    assert row(database, target)["orphan_recoveries"] == 1
    assert row(database, target)["user_id"] == owner
    active_row = row(database, active)
    assert active_row["attempts"] == 2 and active_row["lease_owner"] == "worker"
    assert active_row["orphan_recoveries"] == 1 and active_row["status"] == "running"


def test_sql_excludes_terminal_and_overdue_subjects(database, users):
    owner, _ = users
    subjects = []
    for status in ("READY", "FAILED", "EXPIRED"):
        subject = orphan(database, owner)
        database(f"UPDATE documents SET processing_status='{status}' WHERE id='{subject}';")
        subjects.append(subject)
    overdue = orphan(database, owner)
    database(f"UPDATE documents SET uploaded_at=now()-interval '4 days',expires_at=now()-interval '1 day' WHERE id='{overdue}';")
    subjects.append(overdue)
    for status in ("COMPLETED", "FAILED"):
        subject = orphan(database, owner, "study_generation")
        database(f"UPDATE generation_jobs SET status='{status}' WHERE id='{subject}';")
        subjects.append(subject)
    recover(database)
    for subject in subjects:
        assert database(f"SELECT count(*) FROM internal.background_jobs WHERE subject_id='{subject}';") == "0"


@pytest.mark.asyncio
async def test_memory_budget_fairness_expiry_and_manual_reset():
    queue = JobQueue()
    owner = str(uuid4())
    active, target, overdue = (str(uuid4()) for _ in range(3))
    for subject in (active, target, overdue):
        documents_repo._store[subject] = {"id": subject, "user_id": owner, "processing_status": "INDEXING",
                                          "updated_at": old(), "expires_at": "2099-01-01T00:00:00Z"}
    documents_repo._store[overdue]["expires_at"] = "2000-01-01T00:00:00Z"
    try:
        job = await queue.enqueue("document_ingestion", owner, active, max_attempts=2)
        claimed = await queue.claim("w", job_id=job["id"])
        assert claimed[0]["attempts"] == 1
        assert await queue.recover_orphans(limit=1, max_attempts=2) == 1
        current = queue._find("document_ingestion", owner, target)
        assert current and current["orphan_recoveries"] == 1
        current["status"] = "succeeded"
        assert await queue.recover_orphans(max_attempts=10) == 1
        assert current["orphan_recoveries"] == 2 and current["max_attempts"] == 2
        current["status"] = "succeeded"
        assert await queue.recover_orphans() == 0
        assert current["status"] == "dead" and documents_repo._store[target]["processing_status"] == "FAILED"
        assert queue._find("document_ingestion", owner, overdue) is None
        assert queue._jobs[job["id"]]["attempts"] == 1
        reset = await queue.enqueue("document_ingestion", owner, target, requeue=True)
        assert reset["orphan_recoveries"] == 0
    finally:
        for subject in (active, target, overdue):
            documents_repo._store.pop(subject, None)


@pytest.mark.asyncio
async def test_memory_failed_completed_and_owner_partitioned():
    queue = JobQueue()
    owner, other = str(uuid4()), str(uuid4())
    subject = str(uuid4())
    generation_repo._jobs[subject] = {"id": subject, "user_id": owner, "status": "PENDING", "updated_at": old()}
    try:
        foreign = await queue.enqueue("study_generation", other, subject)
        assert await queue.recover_orphans(max_attempts=1) == 1
        own = queue._find("study_generation", owner, subject)
        assert own and own["id"] != foreign["id"]
        own["status"] = "succeeded"
        assert await queue.recover_orphans() == 0
        assert generation_repo._jobs[subject]["status"] == "FAILED"
        generation_repo._jobs[subject]["status"] = "COMPLETED"
        assert await queue.recover_orphans() == 0
    finally:
        generation_repo._jobs.pop(subject, None)


def test_sql_recovery_and_failure_share_queue_then_subject_lock_order(database, users):
    import time

    owner, _ = users
    subject = orphan(database, owner)
    recover(database)
    job = row(database, subject)
    database(f"UPDATE internal.background_jobs SET status='succeeded' WHERE id='{job['id']}';")
    marker = "recovery-lock-order-" + uuid4().hex
    statement = (
        f"BEGIN; SET application_name='{marker}'; "
        f"UPDATE internal.background_jobs SET status='running',attempts=1,lease_owner='failing-worker',"
        f"lease_expires_at=now()+interval '1 minute' WHERE id='{job['id']}'; "
        "SELECT pg_sleep(1); "
        f"SELECT fail_background_job('{job['id']}','failing-worker','TEST_FAILURE',0,true); COMMIT;"
    )
    with ThreadPoolExecutor(max_workers=1) as pool:
        failure = pool.submit(database, statement, role="service_role")
        deadline = time.monotonic() + 3
        while database(f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{marker}' AND wait_event='PgSleep';") != "1":
            assert time.monotonic() < deadline, "Failing worker did not acquire its queue lock"
            time.sleep(0.02)
        # MVCC still sees the terminal row, so recovery competes for its lock.
        recover(database)
        failure.result(timeout=5)
    assert row(database, subject)["status"] == "dead"
    assert database(f"SELECT processing_status FROM documents WHERE id='{subject}';") == "FAILED"
