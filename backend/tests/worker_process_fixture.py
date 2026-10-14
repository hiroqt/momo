"""Local subprocess fixture: real runner/queue/repository, deterministic generation.

psql mode replaces PostgREST transport; gateway mode retains the real SDK/session.
Python sockets are denied except the selected gateway loopback port in that mode.
Hosted targets are denied; parent owns disposable schema and synthetic records.
"""
import asyncio
import json
import os
import shutil
import socket
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit
from uuid import uuid4

# Pin every provider/environment choice before imports; never read real settings.
os.environ.update({
    "APP_ENV": "test", "ENVIRONMENT": "test", "LOCAL_ONLY": "true",
    "DATABASE_BACKEND": "memory", "ENABLE_DEV_AUTH": "false",
    "SUPABASE_PROJECT_REF": "", "SUPABASE_URL": "http://127.0.0.1:54321",
    "SUPABASE_ANON_KEY": "mock-anon-key", "SUPABASE_SERVICE_ROLE_KEY": "mock-service-key",
    "OPENROUTER_API_KEY": "mock-openrouter-key", "EMBEDDING_PROVIDER": "local",
    "STORAGE_PROVIDER": "supabase", "AWS_EC2_METADATA_DISABLED": "true",
})



def denied(*args, **kwargs):
    raise RuntimeError("Network disabled in worker process fixture")


native_connect = socket.socket.connect

gateway_url = os.environ.get("WORKER_TEST_GATEWAY_URL")
if gateway_url:
    target = urlsplit(gateway_url)
    if (target.scheme != "http" or target.hostname != "127.0.0.1" or not target.port
            or target.path or target.query or target.fragment or target.username):
        raise RuntimeError("Explicit loopback gateway origin required")

    def gateway_connect(sock, address):
        if address != ("127.0.0.1", target.port):
            return denied()
        return native_connect(sock, address)

    socket.socket.connect = gateway_connect
else:
    socket.socket.connect = denied
socket.socket.connect_ex = denied
if not gateway_url:
    socket.create_connection = denied

url = os.environ["LOCAL_TEST_DATABASE_URL"]
parsed = urlsplit(url)
if (parsed.scheme not in {"postgresql", "postgres"} or parsed.hostname not in {"127.0.0.1", "::1"}
        or parsed.path != "/momo_security_test" or parsed.query or parsed.fragment):
    raise RuntimeError("Disposable loopback database required")


from app.db.repositories import chunks_repo as chunks_module  # noqa: E402
from app.db.repositories import documents_repo as documents_module  # noqa: E402
from app.db.repositories import generation_repo as repository_module  # noqa: E402
from app.workers import job_queue as queue_module  # noqa: E402
from app.workers import runner  # noqa: E402
from app.workers.generation_worker import generation_worker  # noqa: E402


def literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, int):
        return str(value)
    if isinstance(value, (dict, list)):
        return "'" + json.dumps(value).replace("'", "''") + "'::jsonb"
    return "'" + str(value).replace("'", "''") + "'"


def sql(statement):
    result = subprocess.run([shutil.which("psql"), "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "--dbname", url],
        input="SET ROLE service_role; SET search_path=public,extensions; " + statement,
        text=True, capture_output=True, timeout=10,
        env={k: v for k, v in os.environ.items() if not k.startswith("PG")})
    if result.returncode:
        raise RuntimeError("Local fixture SQL failed")
    return [json.loads(line) for line in result.stdout.splitlines() if line]


class Query:
    def __init__(self, statement, many=False):
        self.statement, self.many = statement, many

    def execute(self):
        rows = sql(self.statement)
        return SimpleNamespace(data=rows if self.many else (rows[0] if rows else None))


class Table:
    def __init__(self, name):
        self.name = name
        self.filters = []
        self.updates = None

    def select(self, columns):
        assert columns == "*"
        return self

    def update(self, values):
        assert self.name == "documents"
        assert set(values) <= {"processing_status", "updated_at", "page_count", "processing_error",
                               "suggested_topics", "content_sha256"}
        self.updates = values
        return self

    def eq(self, column, value):
        assert column in {"id", "user_id"}
        self.filters.append(f"{column}={literal(value)}")
        return self

    def execute(self):
        assert self.filters, "Unfiltered fixture table access forbidden"
        predicate = " AND ".join(self.filters)
        if self.updates is not None:
            assignments = ",".join(f"{k}={literal(v)}" for k, v in self.updates.items())
            return Query(f"UPDATE public.{self.name} j SET {assignments} WHERE {predicate} RETURNING to_jsonb(j);", True).execute()
        return Query(f"SELECT to_jsonb(j) FROM public.{self.name} j WHERE {predicate};", True).execute()


class Transport:
    is_configured = True

    @property
    def client(self):
        return self

    def rpc(self, name, arguments):
        assert name in {"claim_background_jobs", "heartbeat_background_job", "complete_background_job",
                        "fail_background_job", "persist_generated_study_set", "publish_document_index_v2"}
        values = []
        for key, value in arguments.items():
            assert key.startswith("p_") and key.replace("_", "").isalnum()
            rendered = ("ARRAY[" + ",".join(literal(v) for v in value) + "]::text[]"
                        if key == "p_kinds" else literal(value))
            values.append(f"{key}=>{rendered}")
        call = f"public.{name}({','.join(values)})"
        return Query(f"SELECT to_jsonb(j) FROM {call} j;" if name == "claim_background_jobs"
                     else f"SELECT to_jsonb({call});", name == "claim_background_jobs")

    def table(self, name):
        assert name in {"generation_jobs", "documents"}
        return Table(name)

    async def execute(self, query):
        return await asyncio.to_thread(query.execute)


if gateway_url:
    import jwt

    from app.config import settings
    from app.db.session import supabase_session

    # Synthetic service JWT is valid only at the isolated gateway test secret.
    settings.SUPABASE_URL = gateway_url
    settings.SUPABASE_SERVICE_ROLE_KEY = jwt.encode({"role": "service_role"},
        "local-gateway-test-secret-at-least-32-characters", algorithm="HS256")
    settings.DATABASE_BACKEND = "supabase"
    assert supabase_session.is_configured
else:
    transport = Transport()
    queue_module.supabase_session = transport
    repository_module.supabase_session = transport
    documents_module.supabase_session = transport
    chunks_module.supabase_session = transport
job_id, barrier_path, stage = sys.argv[1:4]
barrier = Path(barrier_path)


async def processor(*, job_id, user_id, document_id, generation_spec):
    if stage == "claimed":
        barrier.write_text("claimed")
        await asyncio.Event().wait()
    # No provider calls: exercise the actual repository/atomic SQL publication.
    await repository_module.generation_repo.complete_with_study_set(job_id, user_id,
        {"id": str(uuid4()), "title": "Synthetic reviewer", "document_id": document_id,
         "generation_config": {"source_only": True}},
        [{"type": "flashcard", "question": "Synthetic Q", "answer": "Synthetic A",
          "difficulty": "medium", "source_metadata": {"document_id": document_id, "page": 1}}])
    if stage == "published":
        barrier.write_text("published")
        await asyncio.Event().wait()
    else:
        barrier.write_text("processor-ran")


if stage == "ticket-gateway":
    from datetime import UTC, datetime, timedelta

    from app.db.repositories.documents_repo import documents_repo
    from app.db.repositories.upload_ticket_repo import upload_ticket_repo

    async def ticket_smoke():
        owner, identity = job_id, str(uuid4())
        now = datetime.now(UTC)
        data = {"id": identity, "user_id": owner, "object_key": f"documents/{owner}/{identity}/original.txt",
                "file_type": "txt", "mime_type": "text/plain", "file_size": 12,
                "provider": "s3", "bucket": "gateway-ticket-smoke", "signed_until": (now+timedelta(hours=1)).isoformat()}
        issued = await upload_ticket_repo.issue(data)
        assert issued["id"] == identity
        assert await upload_ticket_repo.get(identity, str(uuid4())) is None
        claimed = await upload_ticket_repo.claim_cleanup(provider="s3", bucket=data["bucket"])
        assert len(claimed) == 1
        assert not await upload_ticket_repo.prepare_cleanup(identity, claimed[0]["lease_token"], None)
        document = await documents_repo.register({"id": identity, "user_id": owner,
            "original_filename": "synthetic.txt", "file_type": "txt", "mime_type": "text/plain", "file_size": 12,
            "s3_object_key": data["object_key"], "uploaded_at": now.isoformat(), "object_version": "version-one"})
        assert document["id"] == identity
        assert datetime.fromisoformat(document["expires_at"]) == now+timedelta(hours=72)
        assert (await documents_repo.register({"id": identity, "user_id": owner}))["id"] == identity
        assert (await upload_ticket_repo.get(identity, owner))["version"] == "version-one"
        assert await upload_ticket_repo.retire(identity, owner)
        claimed = await upload_ticket_repo.claim_cleanup(provider="s3", bucket=data["bucket"])
        assert not claimed
        supabase_session.close()

    asyncio.run(ticket_smoke())
    print("ticket-gateway-passed", flush=True)
    sys.exit(0)


if stage == "gateway-security":
    assert gateway_url
    from postgrest.exceptions import APIError
    from supabase import create_client
    from supabase.lib.client_options import SyncClientOptions

    identities = json.loads(barrier.read_text())

    def client(role, subject=None):
        claims = {"role": role}
        if subject:
            claims.update({"sub": subject, "is_anonymous": False,
                "app_metadata": {"provider": "google", "providers": ["google"]},
                "amr": [{"method": "oauth"}]})
        token = jwt.encode(claims, "local-gateway-test-secret-at-least-32-characters", algorithm="HS256")
        return create_client(gateway_url, token,
            options=SyncClientOptions(auto_refresh_token=False, persist_session=False))

    def denied_query(query):
        try:
            query.execute()
        except APIError as error:
            assert error.code in {"42501", "PGRST202"}, error.code
        else:
            raise AssertionError("Client access unexpectedly accepted")

    owner_client = client("authenticated", identities["owner"])
    foreign_client = client("authenticated", identities["foreign"])
    anonymous = client("anon")
    assert owner_client.table("study_sets").select("id").eq("id", job_id).execute().data == [{"id": job_id}]
    assert foreign_client.table("study_sets").select("id").eq("id", job_id).execute().data == []
    denied_query(anonymous.table("study_sets").select("id"))
    denied_query(owner_client.table("study_sets").insert({"user_id": identities["owner"], "title": "Denied"}))
    denied_query(owner_client.rpc("heartbeat_background_job", {"p_job_id": str(uuid4()), "p_worker_id": "client", "p_lease_seconds": 15}))
    invalid_token = jwt.encode({"role": "authenticated", "sub": identities["owner"]},
                               "different-test-secret-with-invalid-signature", algorithm="HS256")
    invalid_client = create_client(gateway_url, invalid_token,
        options=SyncClientOptions(auto_refresh_token=False, persist_session=False))
    try:
        invalid_client.table("study_sets").select("id").execute()
    except APIError as error:
        assert error.code == "PGRST301", error.code
    else:
        raise AssertionError("Invalid signature accepted by local gateway")
    for private_client in [owner_client, foreign_client, anonymous, invalid_client]:
        private_client.postgrest.session.close()
        private_client.auth.close()
    supabase_session.close()
    print("gateway-security-passed", flush=True)
    sys.exit(0)


if len(sys.argv) == 5:
    # Real TXT validation/extraction/chunking/local embeddings/index publication;
    # only private object transport is replaced by a task-owned file fixture.
    from app.workers.document_worker import storage_service

    source = Path(sys.argv[4])

    def object_bytes(key):
        if not source.is_file():
            raise RuntimeError("Synthetic source missing")
        barrier.with_suffix(".reads").write_text("read")
        return source.read_bytes()

    storage_service.get_object_bytes = object_bytes
    original_publish = chunks_module.chunks_repo.publish_index

    async def publish(*args, **kwargs):
        if stage == "indexing":
            barrier.write_text("indexing")
            await asyncio.Event().wait()
        result = await original_publish(*args, **kwargs)
        if stage == "indexed":
            barrier.write_text("indexed")
            await asyncio.Event().wait()
        return result

    chunks_module.chunks_repo.publish_index = publish
    handlers = {"document_ingestion": runner.handle_document_ingestion}
else:
    generation_worker.process_generation = processor
    handlers = {"study_generation": runner.handle_study_generation}
worker = runner.JobRunner(queue_module.JobQueue(), handlers,
                          worker_id=f"process:{os.getpid()}", lease_seconds=15, heartbeat_seconds=1)
result = asyncio.run(worker.run_now(job_id))
assert result == "succeeded", result
print("succeeded", flush=True)
