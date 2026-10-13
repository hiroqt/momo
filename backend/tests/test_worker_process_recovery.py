"""Actual Python worker SIGKILL/restart with a durable local PostgreSQL queue."""
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import pytest
from test_durable_jobs_postgres import claim, enqueue, expire_lease, job_row
from test_postgres_rls import authenticated, seed_generation_job
from test_postgres_rls import database as database
from test_postgres_rls import users as users


@pytest.fixture(params=["psql", "gateway"])
def worker_transport(request):
    if request.param == "gateway":
        url = os.environ.get("LOCAL_TEST_GATEWAY_URL")
        if not url:
            if os.environ.get("REQUIRE_GATEWAY_INTEGRATION") == "1":
                pytest.fail("REQUIRE_GATEWAY_INTEGRATION=1 requires LOCAL_TEST_GATEWAY_URL")
            pytest.skip("Set LOCAL_TEST_GATEWAY_URL for real SDK/PostgREST process verification")
        return url
    return None


@pytest.mark.parametrize("stage", ["claimed", "published"])
def test_killed_python_runner_recovers_without_duplicate_publication(database, users, tmp_path, stage, worker_transport):
    owner, foreign = users
    generation, source = seed_generation_job(database, owner)
    queue = enqueue(database, "study_generation", owner, generation)
    barrier = tmp_path / "worker-stage"
    helper = Path(__file__).with_name("worker_process_fixture.py")
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
    env["PYTHONPATH"] = str(Path(__file__).parents[1])
    env.pop("WORKER_TEST_GATEWAY_URL", None)
    if worker_transport:
        env["WORKER_TEST_GATEWAY_URL"] = worker_transport
    process = subprocess.Popen([sys.executable, str(helper), queue["id"], str(barrier), stage],
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    try:
        deadline = time.monotonic() + 15
        while not barrier.exists():
            assert process.poll() is None, process.communicate(timeout=1)
            assert time.monotonic() < deadline, "Worker never reached the crash boundary"
            time.sleep(.05)
        assert barrier.read_text() == stage
        row = job_row(database, queue["id"])
        assert row["status"] == "running" and row["attempts"] == 1
        # A second worker cannot steal a live lease.
        assert claim(database, "contender", job_id=queue["id"]) == []
        process.send_signal(signal.SIGKILL)
        process.communicate(timeout=5)
        assert process.returncode == -signal.SIGKILL
    finally:
        if process.poll() is None:
            process.kill()
            process.communicate(timeout=5)
    # Advance the lease in this disposable DB only, avoiding a wall-clock delay.
    expire_lease(database, queue["id"])
    barrier.unlink()
    restarted = subprocess.run([sys.executable, str(helper), queue["id"], str(barrier), "restart"],
                               capture_output=True, text=True, timeout=15, env=env)
    assert restarted.returncode == 0, restarted.stderr
    assert restarted.stdout.strip() == "succeeded"
    assert barrier.exists() == (stage == "claimed")  # completed guard skips the processor
    row = job_row(database, queue["id"])
    assert row["status"] == "succeeded" and row["attempts"] == 2
    assert row["lease_owner"] is None
    assert database(f"SELECT status FROM generation_jobs WHERE id='{generation}';") == "COMPLETED"
    study_set = database(f"SELECT study_set_id FROM generation_jobs WHERE id='{generation}';")
    assert database(f"SELECT count(*) FROM study_sets WHERE user_id='{owner}';") == "1"
    assert database(f"SELECT count(*) FROM study_items WHERE study_set_id='{study_set}';") == "1"
    assert database(authenticated(foreign, f"SELECT count(*) FROM study_sets WHERE id='{study_set}'")) == "0"
    database(f"DELETE FROM documents WHERE id='{source}';", role="service_role")
    assert database(authenticated(owner, f"SELECT count(*) FROM study_sets WHERE id='{study_set}'")) == "1"
    assert database(authenticated(owner, f"SELECT count(*) FROM study_items WHERE study_set_id='{study_set}'")) == "1"


@pytest.mark.parametrize("stage", ["indexing", "indexed"])
@pytest.mark.parametrize("delete_source", [False, True])
def test_ingestion_pipeline_recovers_or_stops_after_source_deletion(database, users, tmp_path, stage, delete_source, worker_transport):
    import hashlib

    from test_postgres_rls import document, register_sql

    owner, foreign = users
    data = ("Biology\nCells contain genetic material. Cells use energy to grow.\n" * 30).encode()
    source_file = tmp_path / "synthetic.txt"
    source_file.write_bytes(data)
    doc = document(owner)
    doc["file_size"] = len(data)
    database(register_sql(doc), role="service_role")
    source = doc["id"]
    # An interrupted old index must be replaced as a whole, not appended to.
    database(f"INSERT INTO document_chunks(user_id,document_id,chunk_index,content) VALUES ('{owner}','{source}',0,'Stale partial index');", role="service_role")
    queue = enqueue(database, "document_ingestion", owner, source)
    barrier = tmp_path / "ingestion-stage"
    helper = Path(__file__).with_name("worker_process_fixture.py")
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
    env["PYTHONPATH"] = str(Path(__file__).parents[1])
    env.pop("WORKER_TEST_GATEWAY_URL", None)
    if worker_transport:
        env["WORKER_TEST_GATEWAY_URL"] = worker_transport
    args = [sys.executable, str(helper), queue["id"], str(barrier), stage, str(source_file)]
    child = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    try:
        deadline = time.monotonic() + 15
        while not barrier.exists():
            assert child.poll() is None, child.communicate(timeout=1)
            assert time.monotonic() < deadline, "Ingestion never reached crash boundary"
            time.sleep(.05)
        assert barrier.read_text() == stage
        expected = "INDEXING" if stage == "indexing" else "READY"
        assert database(f"SELECT processing_status FROM documents WHERE id='{source}';") == expected
        assert database(f"SELECT content_sha256 FROM documents WHERE id='{source}';") == hashlib.sha256(data).hexdigest()
        child.send_signal(signal.SIGKILL)
        child.communicate(timeout=5)
        assert child.returncode == -signal.SIGKILL
    finally:
        if child.poll() is None:
            child.kill()
            child.communicate(timeout=5)
    before = database(f"SELECT string_agg(id::text,',' ORDER BY chunk_index) FROM document_chunks WHERE document_id='{source}';")
    barrier.unlink()
    barrier.with_suffix(".reads").unlink()
    if delete_source:
        database(f"DELETE FROM documents WHERE id='{source}';", role="service_role")
    if stage == "indexed" or delete_source:
        source_file.unlink()  # completed/deleted handlers must not fetch storage again
    expire_lease(database, queue["id"])
    args[4] = "restart-ingestion"
    restart = subprocess.run(args, capture_output=True, text=True, timeout=15, env=env)
    assert restart.returncode == 0, restart.stderr
    assert restart.stdout.strip() == "succeeded"
    assert job_row(database, queue["id"])["status"] == "succeeded"
    assert job_row(database, queue["id"])["attempts"] == 2
    assert barrier.with_suffix(".reads").exists() == (stage == "indexing" and not delete_source)
    if delete_source:
        assert database(f"SELECT count(*) FROM documents WHERE id='{source}';") == "0"
        assert database(f"SELECT count(*) FROM document_chunks WHERE document_id='{source}';") == "0"
        return
    assert database(f"SELECT processing_status FROM documents WHERE id='{source}';") == "READY"
    count = int(database(f"SELECT count(*) FROM document_chunks WHERE document_id='{source}';"))
    assert count > 0
    assert database(f"SELECT count(DISTINCT chunk_index) FROM document_chunks WHERE document_id='{source}';") == str(count)
    assert database(f"SELECT count(*) FROM document_chunks WHERE document_id='{source}' AND content='Stale partial index';") == "0"
    if stage == "indexed":
        assert database(f"SELECT string_agg(id::text,',' ORDER BY chunk_index) FROM document_chunks WHERE document_id='{source}';") == before
    assert database(authenticated(foreign, f"SELECT count(*) FROM document_chunks WHERE document_id='{source}'")) == "0"
    assert database(authenticated(owner, f"SELECT count(*) FROM document_chunks WHERE document_id='{source}'")) == str(count)


@pytest.mark.parametrize("worker_transport", ["gateway"], indirect=True)
def test_real_gateway_jwt_owner_reads_and_client_grants(database, users, tmp_path, worker_transport):
    import json
    from uuid import uuid4

    owner, foreign = users
    set_id = str(uuid4())
    database(f"INSERT INTO study_sets(id,user_id,title) VALUES ('{set_id}','{owner}','Private');", role="service_role")
    identities = tmp_path / "synthetic-identities.json"
    identities.write_text(json.dumps({"owner": owner, "foreign": foreign}))
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
    env["PYTHONPATH"] = str(Path(__file__).parents[1])
    env["WORKER_TEST_GATEWAY_URL"] = worker_transport
    helper = Path(__file__).with_name("worker_process_fixture.py")
    result = subprocess.run([sys.executable, str(helper), set_id, str(identities), "gateway-security"],
                            capture_output=True, text=True, timeout=15, env=env)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "gateway-security-passed"
