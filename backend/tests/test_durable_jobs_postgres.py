"""Real PostgreSQL checks for migration 006: durable jobs and shared rate limits.

Runs only against the dedicated loopback `momo_security_test` database (see
scripts/testing/README.md). Concurrent `psql` processes stand in for separate
API replicas and worker processes; killed processes model crashes.
"""

import json
import os
import shutil
import signal
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from test_postgres_rls import database as database
from test_postgres_rls import document, register_sql
from test_postgres_rls import users as users

SERVICE = "service_role"


def enqueue(database, kind, user, subject, max_attempts=3, requeue=False):
    return json.loads(database(
        f"SELECT public.enqueue_background_job('{kind}','{user}','{subject}','{{}}'::jsonb,{max_attempts},{str(requeue).lower()});",
        role=SERVICE))


def claim(database, worker, limit=1, lease=60, job_id=None):
    target = f"'{job_id}'" if job_id else "NULL"
    out = database(f"SELECT public.claim_background_jobs('{worker}',ARRAY['document_ingestion','study_generation'],{limit},{lease},{target});",
                   role=SERVICE)
    return [json.loads(line) for line in out.splitlines() if line]


def expire_lease(database, job_id):
    database(f"UPDATE internal.background_jobs SET lease_expires_at=now()-interval '1 second' WHERE id='{job_id}';")


def job_row(database, job_id):
    return json.loads(database(f"SELECT to_jsonb(j) FROM internal.background_jobs j WHERE id='{job_id}';"))


def registered(database, owner):
    doc = document(owner)
    database(register_sql(doc), role=SERVICE)
    return doc["id"]


def test_internal_state_is_not_client_accessible(database):
    assert database("SELECT has_schema_privilege('anon','internal','USAGE') OR has_schema_privilege('authenticated','internal','USAGE');") == "f"
    assert database("SELECT has_schema_privilege('service_role','internal','USAGE');") == "t"
    rls = database("SELECT string_agg(relname||':'||relrowsecurity||relforcerowsecurity, ',' ORDER BY relname) FROM pg_class WHERE relnamespace='internal'::regnamespace AND relkind='r';")
    assert rls == "background_jobs:truetrue,rate_limit_events:truetrue"
    functions = ["enqueue_background_job(text,uuid,uuid,jsonb,integer,boolean)",
                 "claim_background_jobs(text,text[],integer,integer,uuid)", "heartbeat_background_job(uuid,text,integer)",
                 "complete_background_job(uuid,text)", "fail_background_job(uuid,text,text,integer,boolean)",
                 "recover_orphaned_work(integer,integer,integer)", "consume_rate_limit(text,integer,integer)",
                 "retention_backlog()", "fail_background_job_subject(text,uuid,uuid)"]
    for fn in functions:
        privileges = database(f"SELECT has_function_privilege('anon','public.{fn}','EXECUTE')::text||has_function_privilege('authenticated','public.{fn}','EXECUTE')::text||has_function_privilege('service_role','public.{fn}','EXECUTE')::text;")
        assert privileges == "falsefalsetrue", fn
        config = database(f"SELECT 'search_path=pg_catalog, public'=ANY(proconfig) FROM pg_proc WHERE oid='public.{fn}'::regprocedure;")
        assert config == "t", fn
    database("SELECT public.claim_background_jobs('w',ARRAY['document_ingestion'],1,60,NULL);", success=False, role="authenticated")
    database("SELECT public.consume_rate_limit('chat:' || repeat('a',64),5,60);", success=False, role="anon")


def test_concurrent_enqueue_creates_one_logical_job(database, users):
    alice, bob = users
    doc_id = registered(database, alice)
    with ThreadPoolExecutor(max_workers=10) as pool:
        jobs = list(pool.map(lambda _: enqueue(database, "document_ingestion", alice, doc_id), range(10)))
    assert len({job["id"] for job in jobs}) == 1
    assert database(f"SELECT count(*) FROM internal.background_jobs WHERE subject_id='{doc_id}';") == "1"
    assert enqueue(database, "document_ingestion", bob, doc_id)["id"] != jobs[0]["id"]


@pytest.mark.parametrize("statement", [
    "SELECT public.enqueue_background_job('shell','{u}','{s}','{{}}'::jsonb,3,false);",
    "SELECT public.enqueue_background_job('document_ingestion','{u}','{s}','[]'::jsonb,3,false);",
    "SELECT public.enqueue_background_job('document_ingestion','{u}','{s}','{{}}'::jsonb,11,false);",
    "SELECT public.claim_background_jobs('bad worker',ARRAY['document_ingestion'],1,60,NULL);",
    "SELECT public.claim_background_jobs('w',ARRAY['document_ingestion'],51,60,NULL);",
    "SELECT public.claim_background_jobs('w',ARRAY['document_ingestion'],1,5,NULL);",
    "SELECT public.fail_background_job('{s}','w','raw sql error text',30,false);",
    "SELECT public.recover_orphaned_work(1,100,3);",
])
def test_queue_rpcs_reject_invalid_or_unbounded_input(database, users, statement):
    database(statement.format(u=users[0], s=uuid4()), success=False, role=SERVICE)


def test_skip_locked_claims_are_exclusive_across_concurrent_workers(database, users):
    alice, _ = users
    subjects = [registered(database, alice) for _ in range(6)] + [str(uuid4()) for _ in range(24)]
    for subject in subjects:
        enqueue(database, "document_ingestion", alice, subject)
    with ThreadPoolExecutor(max_workers=8) as pool:
        batches = list(pool.map(lambda i: claim(database, f"worker-{i}", limit=5), range(8)))
    claimed = [job["id"] for batch in batches for job in batch if job["user_id"] == alice]
    assert len(claimed) == len(set(claimed)) == 30
    owners = {job["lease_owner"] for batch in batches for job in batch}
    assert len(owners) > 1


def test_crashed_worker_holding_claim_lock_does_not_block_or_lose_jobs(database, users):
    alice, _ = users
    job = enqueue(database, "study_generation", alice, str(uuid4()))
    url = os.environ["LOCAL_TEST_DATABASE_URL"]
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
    # A worker locks the queued row mid-claim and is then killed (SIGKILL).
    holder = subprocess.Popen([shutil.which("psql"), "-X", "-q", "--dbname", url], stdin=subprocess.PIPE,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, text=True, env=env)
    holder.stdin.write(f"BEGIN; SELECT id FROM internal.background_jobs WHERE id='{job['id']}' FOR UPDATE; SELECT pg_sleep(30);\n")
    holder.stdin.flush()
    deadline = time.time() + 10
    while database("SELECT count(*) FROM pg_locks l JOIN pg_class c ON c.oid=l.relation WHERE c.relname='background_jobs' AND l.pid<>pg_backend_pid();") == "0":
        assert time.time() < deadline
        time.sleep(0.1)
    assert [j for j in claim(database, "other-worker", limit=50) if j["id"] == job["id"]] == []  # skipped, not blocked
    holder.send_signal(signal.SIGKILL)
    holder.wait(timeout=10)
    deadline = time.time() + 10
    while True:  # server notices the dead client and releases its row lock
        reclaimed = [j for j in claim(database, "other-worker", limit=50) if j["id"] == job["id"]]
        if reclaimed or time.time() > deadline:
            break
        database("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query LIKE '%pg_sleep(30)%' AND pid<>pg_backend_pid();")
        time.sleep(0.2)
    assert reclaimed and reclaimed[0]["attempts"] == 1


def test_expired_lease_is_recovered_retried_and_dead_lettered_with_controlled_failure(database, users):
    alice, _ = users
    doc_id = registered(database, alice)
    database(f"UPDATE public.documents SET processing_status='EMBEDDING' WHERE id='{doc_id}';")
    job = enqueue(database, "document_ingestion", alice, doc_id, max_attempts=2)
    [first] = claim(database, "worker-a", job_id=job["id"])
    assert first["attempts"] == 1
    expire_lease(database, job["id"])  # worker-a crashed: no heartbeat
    assert database(f"SELECT public.complete_background_job('{job['id']}','worker-b');", role=SERVICE) == "f"
    [second] = claim(database, "worker-b", job_id=job["id"])
    assert second["attempts"] == 2 and second["lease_owner"] == "worker-b"
    # The crashed worker comes back late: it can neither renew nor finish.
    assert database(f"SELECT public.heartbeat_background_job('{job['id']}','worker-a',60);", role=SERVICE) == "f"
    assert database(f"SELECT public.complete_background_job('{job['id']}','worker-a');", role=SERVICE) == "f"
    expire_lease(database, job["id"])
    assert claim(database, "worker-c", job_id=job["id"]) == []
    row = job_row(database, job["id"])
    assert row["status"] == "dead" and row["last_error"] == "LEASE_EXPIRED" and row["lease_owner"] is None
    status = database(f"SELECT processing_status||'|'||processing_error FROM public.documents WHERE id='{doc_id}';")
    assert status == "FAILED|The uploaded document could not be processed."


def test_heartbeat_extends_lease_and_complete_is_single_shot(database, users):
    alice, _ = users
    job = enqueue(database, "study_generation", alice, str(uuid4()))
    [claimed] = claim(database, "worker-a", lease=15, job_id=job["id"])
    assert database(f"SELECT public.heartbeat_background_job('{job['id']}','worker-a',900);", role=SERVICE) == "t"
    assert database(f"SELECT lease_expires_at > now() + interval '800 seconds' FROM internal.background_jobs WHERE id='{job['id']}';") == "t"
    assert database(f"SELECT public.complete_background_job('{job['id']}','worker-a');", role=SERVICE) == "t"
    assert database(f"SELECT public.complete_background_job('{job['id']}','worker-a');", role=SERVICE) == "f"
    assert job_row(database, claimed["id"])["status"] == "succeeded"


def test_retry_limits_and_permanent_failures(database, users):
    alice, _ = users
    gen_id = str(uuid4())
    database(f"INSERT INTO public.generation_jobs(id,user_id,status) VALUES ('{gen_id}','{alice}','PROCESSING');")
    job = enqueue(database, "study_generation", alice, gen_id, max_attempts=2)
    claim(database, "w", job_id=job["id"])
    assert database(f"SELECT public.fail_background_job('{job['id']}','w','TRANSIENT_FAILURE',0,false);", role=SERVICE) == "queued"
    claim(database, "w", job_id=job["id"])
    assert database(f"SELECT public.fail_background_job('{job['id']}','w','TRANSIENT_FAILURE',0,false);", role=SERVICE) == "dead"
    assert database(f"SELECT status||'|'||error FROM public.generation_jobs WHERE id='{gen_id}';") == "FAILED|Reviewer generation failed. Please retry."
    other = enqueue(database, "study_generation", alice, str(uuid4()), max_attempts=5)
    claim(database, "w", job_id=other["id"])
    assert database(f"SELECT public.fail_background_job('{other['id']}','w','PERMANENT_FAILURE',0,true);", role=SERVICE) == "dead"
    assert database(f"SELECT public.fail_background_job('{other['id']}','w','PERMANENT_FAILURE',0,true);", role=SERVICE) == ""


def test_dead_letter_never_downgrades_completed_generation(database, users):
    alice, _ = users
    gen_id = str(uuid4())
    database(f"INSERT INTO public.generation_jobs(id,user_id,status,progress) VALUES ('{gen_id}','{alice}','COMPLETED',100);")
    job = enqueue(database, "study_generation", alice, gen_id, max_attempts=1)
    claim(database, "w", job_id=job["id"])
    database(f"SELECT public.fail_background_job('{job['id']}','w','HANDLER_FAILED',0,false);", role=SERVICE)
    assert database(f"SELECT status FROM public.generation_jobs WHERE id='{gen_id}';") == "COMPLETED"


def test_requeue_restarts_only_finished_jobs(database, users):
    alice, _ = users
    subject = str(uuid4())
    job = enqueue(database, "study_generation", alice, subject)
    claim(database, "w", job_id=job["id"])
    assert enqueue(database, "study_generation", alice, subject, requeue=True)["status"] == "running"
    database(f"SELECT public.complete_background_job('{job['id']}','w');", role=SERVICE)
    assert enqueue(database, "study_generation", alice, subject)["status"] == "succeeded"
    again = enqueue(database, "study_generation", alice, subject, requeue=True)
    assert again["status"] == "queued" and again["attempts"] == 0 and again["id"] == job["id"]


def test_ready_and_expired_documents_cannot_be_downgraded(database, users):
    alice, _ = users
    ready, expired = registered(database, alice), registered(database, alice)
    database(f"UPDATE public.documents SET processing_status='READY' WHERE id='{ready}';")
    database(f"UPDATE public.documents SET processing_status='EXPIRED' WHERE id='{expired}';")
    database(f"UPDATE public.documents SET processing_status='FAILED',processing_error='late' WHERE id IN ('{ready}','{expired}');", role=SERVICE)
    database(f"UPDATE public.documents SET processing_status='VALIDATING' WHERE id='{ready}';", role=SERVICE)
    assert database(f"SELECT string_agg(processing_status||':'||coalesce(processing_error,''),',' ORDER BY processing_status) FROM public.documents WHERE id IN ('{ready}','{expired}');") == "EXPIRED:,READY:"
    database(f"UPDATE public.documents SET processing_status='EXPIRED' WHERE id='{ready}';", role=SERVICE)
    assert database(f"SELECT processing_status FROM public.documents WHERE id='{ready}';") == "EXPIRED"


def test_orphaned_work_is_recovered_once(database, users):
    alice, _ = users
    stuck, fresh = registered(database, alice), registered(database, alice)
    gen_id = str(uuid4())
    database(f"UPDATE public.documents SET updated_at=now()-interval '1 hour' WHERE id='{stuck}';")
    database(f"INSERT INTO public.generation_jobs(id,user_id,status,updated_at) VALUES ('{gen_id}','{alice}','PENDING',now()-interval '1 hour');")
    recovered = int(database("SELECT public.recover_orphaned_work(300,500,3);", role=SERVICE))
    assert recovered >= 2
    assert database("SELECT public.recover_orphaned_work(300,500,3);", role=SERVICE) == "0"
    rows = database(f"SELECT string_agg(kind,',' ORDER BY kind) FROM internal.background_jobs WHERE subject_id IN ('{stuck}','{fresh}','{gen_id}');")
    assert rows == "document_ingestion,study_generation"
    # A retried generation whose queue row already finished is requeued.
    job_id = database(f"SELECT id FROM internal.background_jobs WHERE subject_id='{gen_id}';")
    claim(database, "w", job_id=job_id)
    database(f"SELECT public.complete_background_job('{job_id}','w');", role=SERVICE)
    database(f"UPDATE public.generation_jobs SET updated_at=now()-interval '1 hour' WHERE id='{gen_id}';")
    database("SELECT public.recover_orphaned_work(300,500,3);", role=SERVICE)
    assert job_row(database, job_id)["status"] == "queued"


# ------------------------------------------------------------ rate limits
def consume(database, key, limit=5, window=60):
    return json.loads(database(f"SELECT public.consume_rate_limit('{key}',{limit},{window});", role=SERVICE))


def bucket(category="generation"):
    return f"{category}:{uuid4().hex}{uuid4().hex}"


def test_shared_limit_holds_across_concurrent_replicas(database):
    key = bucket()
    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(lambda _: consume(database, key, limit=5), range(24)))
    allowed = [r for r in results if r["allowed"]]
    assert len(allowed) == 5
    assert all(r["retry_after"] >= 1 and r["remaining"] == 0 for r in results if not r["allowed"])
    assert sorted(r["remaining"] for r in allowed) == [0, 1, 2, 3, 4]
    # Separate identities are independent and the state survives new connections (restart).
    assert consume(database, bucket())["allowed"]
    assert not consume(database, key)["allowed"]


def test_sliding_window_expires_and_prunes(database):
    key = bucket("chat")
    for _ in range(3):
        consume(database, key, limit=3, window=1)
    assert not consume(database, key, limit=3, window=1)["allowed"]
    time.sleep(1.2)
    assert consume(database, key, limit=3, window=1)["allowed"]
    stale = bucket("math")
    database(f"INSERT INTO internal.rate_limit_events(bucket_key,occurred_at) VALUES ('{stale}',now()-interval '2 hours');")
    consume(database, bucket("math"))
    assert database(f"SELECT count(*) FROM internal.rate_limit_events WHERE bucket_key='{stale}';") == "0"


@pytest.mark.parametrize("key,limit,window", [
    ("generation:not-a-digest", 5, 60), ("Generation:" + "a" * 64, 5, 60),
    ("generation:" + "a" * 64, 0, 60), ("generation:" + "a" * 64, 1001, 60), ("generation:" + "a" * 64, 5, 3601),
])
def test_rate_limit_rejects_raw_identifiers_and_unbounded_limits(database, key, limit, window):
    database(f"SELECT public.consume_rate_limit('{key}',{limit},{window});", success=False, role=SERVICE)


def test_retention_backlog_reports_oldest_overdue_original(database, users):
    alice, _ = users
    overdue = registered(database, alice)
    database(f"UPDATE public.documents SET uploaded_at=now()-interval '5 days',expires_at=now()-interval '2 days' WHERE id='{overdue}';")
    backlog = json.loads(database("SELECT public.retention_backlog();", role=SERVICE))
    assert backlog["overdue_count"] >= 1 and backlog["oldest_overdue_seconds"] >= 2 * 86400 - 60
    database(f"UPDATE public.documents SET processing_status='EXPIRED' WHERE id='{overdue}';")
    after = json.loads(database("SELECT public.retention_backlog();", role=SERVICE))
    assert after["overdue_count"] == backlog["overdue_count"] - 1
