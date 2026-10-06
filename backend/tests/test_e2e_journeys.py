"""Local end-to-end journeys (never staging/production).

Two layers, both loopback-only with every provider mocked:

* HTTP: the real FastAPI app through HTTPX's ASGI transport with signed HS256
  access tokens verified by the production dependency. Repositories run in the
  memory backend because the harness has no local PostgREST.
* SQL: the same journey against the disposable PostgreSQL 16 + pgvector
  database (migrations 001-006, service-only RPCs, RLS) via psql.
"""
import json
import time
from uuid import uuid4

import httpx
import jwt
import pytest
from test_postgres_rls import authenticated, document, register_sql, sync_sql
from test_postgres_rls import database as database
from test_postgres_rls import users as users

from app.api.routes.economy import get_economy_policy
from app.config import settings
from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.economy_repo import economy_repo
from app.db.repositories.study_repo import study_repo
from app.db.session import supabase_session
from app.domain.economy import EconomyPolicy
from app.main import app
from app.services.storage import storage_service
from app.services.storage.base import StorageUnavailableError

SERVICE = "service_role"
NOTES = (
    "Cellular Respiration Notes\n\n"
    "Mitochondria produce most of the ATP used by eukaryotic cells. "
    "Glycolysis takes place in the cytoplasm and splits glucose into two pyruvate molecules. "
    "The Krebs cycle runs in the mitochondrial matrix and releases carbon dioxide. "
    "The electron transport chain uses oxygen as the final electron acceptor. "
    "Fermentation regenerates NAD+ when oxygen is unavailable.\n"
)


def access_token(user_id: str, **updates) -> str:
    """Signed exactly like a Supabase user access token for the test project."""
    now = int(time.time())
    claims = {"sub": user_id, "exp": now + 300, "iat": now, "aud": settings.SUPABASE_JWT_AUDIENCE,
              "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1", "role": "authenticated",
              "email": f"{user_id[:8]}@example.test"}
    claims.update(updates)
    return jwt.encode(claims, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


def bearer(user_id: str, **updates) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token(user_id, **updates)}"}


@pytest.fixture(autouse=True)
def local_memory_only():
    # Refuse anything but the loopback test configuration before any request.
    assert settings.ENVIRONMENT == "test" and supabase_session.use_memory
    assert settings.SUPABASE_URL.startswith("http://127.0.0.1")
    assert settings.INLINE_JOB_EXECUTION and not settings.is_managed
    yield


@pytest.fixture
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test.local") as c:
        yield c


async def upload_document(client, user_id: str, body: bytes, file_type: str = "txt",
                          mime: str = "text/plain", name: str = "respiration.txt") -> httpx.Response:
    """upload-url -> direct (mock signed) upload -> registration, as the mobile client does."""
    headers = bearer(user_id)
    url = await client.post("/api/documents/upload-url", headers=headers, json={
        "filename": name, "file_type": file_type, "mime_type": mime, "file_size": len(body)})
    assert url.status_code == 200, url.text
    issued = url.json()
    put = await client.put(issued["upload_url"], headers={**headers, "content-type": mime}, content=body)
    assert put.status_code == 200, put.text
    return await client.post("/api/documents", headers=headers, json={
        "document_id": issued["document_id"], "original_filename": name, "file_type": file_type,
        "mime_type": mime, "file_size": len(body), "s3_object_key": issued["s3_object_key"]})


async def ready_document(client, user_id: str, body: bytes = NOTES.encode()) -> str:
    registered = await upload_document(client, user_id, body)
    assert registered.status_code == 200, registered.text
    document_id = registered.json()["id"]
    status = await client.get(f"/api/documents/{document_id}/status", headers=bearer(user_id))
    assert status.status_code == 200
    assert status.json()["status"] == "READY", status.json()
    return document_id


async def generate(client, user_id: str, document_id: str, **spec) -> dict:
    body = {"document_id": document_id, "count": 4, "difficulty": "medium", "generation_mode": "quiz",
            "question_types": ["flashcard", "multiple_choice"], "source_only": True, **spec}
    created = await client.post("/api/generations", headers=bearer(user_id), json=body)
    assert created.status_code == 200, created.text
    status = await client.get(f"/api/generations/{created.json()['generation_id']}", headers=bearer(user_id))
    assert status.status_code == 200
    return status.json()


async def test_http_journey_upload_to_sync_economy_and_expiry(client):
    user = str(uuid4())
    headers = bearer(user)

    me = await client.get("/api/me", headers=headers)
    assert me.status_code == 200 and me.json()["id"] == user  # PRD user_id; matrix documents `id`
    assert me.json()["full_name"] is None  # never invented

    # Upload -> durable ingestion (mocked OCR/embeddings, inline local worker) -> READY.
    document_id = await ready_document(client, user)
    status = (await client.get(f"/api/documents/{document_id}/status", headers=headers)).json()
    assert status["progress"] == 100 and status["page_count"] >= 1

    # Grounded generation through the queue and the mocked Nemotron provider.
    job = await generate(client, user, document_id)
    assert job["status"] == "COMPLETED", job
    assert job["generation_config"]["source_only"] is True
    set_id = job["study_set_id"]

    detail = await client.get(f"/api/study-sets/{set_id}", headers=headers)
    assert detail.status_code == 200
    items = detail.json()["study_items"]
    assert items, "a grounded reviewer must contain items"
    for item in items:
        provenance = item["source_metadata"]
        assert provenance["document_id"] == document_id and provenance["page"] >= 1
        if item["type"] == "multiple_choice":
            assert len(item["options"]) == 4 and item["answer"] in item["options"]

    # Offline sync: 101 events need two bounded batches; replay is idempotent.
    item_ids = [i["id"] for i in items]
    events = [{"event_id": str(uuid4()), "study_item_id": item_ids[n % len(item_ids)],
               "result": "correct" if n % 3 else "incorrect",
               "occurred_at": "2026-10-06T08:00:00+00:00"} for n in range(101)]
    oversized = await client.post("/api/sync/events", headers=headers, json={"events": events})
    assert oversized.status_code == 422
    first = await client.post("/api/sync/events", headers=headers, json={"events": events[:100]})
    second = await client.post("/api/sync/events", headers=headers, json={"events": events[100:]})
    assert first.status_code == second.status_code == 200
    assert first.json()["accepted_count"] == 100 and second.json()["accepted_count"] == 1
    assert first.json()["synced_ids"] == [e["event_id"] for e in events[:100]]
    replay = await client.post("/api/sync/events", headers=headers, json={"events": events[:100]})
    assert replay.json()["accepted_count"] == 0 and replay.json()["ignored_duplicates"] == 100
    legacy = await client.post("/api/sync", headers=headers, json={"events": events[100:]})
    assert legacy.status_code == 200 and legacy.json()["ignored_duplicates"] == 1

    # Economy: heart spend and credit reward are idempotent and server-computed.
    spend = {"idempotency_key": f"session:{uuid4()}:0", "study_item_id": item_ids[0]}
    spent = await client.post("/api/economy/hearts/consume", headers=headers, json=spend)
    again = await client.post("/api/economy/hearts/consume", headers=headers, json=spend)
    assert spent.status_code == again.status_code == 200
    assert spent.json()["wallet"]["hearts"] == 4 and again.json()["replayed"] is True
    assert again.json()["wallet"]["hearts"] == 4
    policy = EconomyPolicy(heart_refill_credit_price=10)
    reward_key = f"reward:{uuid4()}"
    for _ in range(2):  # the reward path is server-side only (no client route)
        await economy_repo.apply_entry(user, reward_key, "credit_reward", policy=policy, credits_delta=25)
    app.dependency_overrides[get_economy_policy] = lambda: policy
    try:
        refill = {"idempotency_key": f"refill:{uuid4()}", "hearts": 1}
        bought = await client.post("/api/economy/hearts/refill", headers=headers, json=refill)
        rebought = await client.post("/api/economy/hearts/refill", headers=headers, json=refill)
    finally:
        app.dependency_overrides.pop(get_economy_policy, None)
    assert bought.status_code == 200, bought.text
    assert bought.json()["wallet"] == rebought.json()["wallet"]
    assert bought.json()["wallet"]["credits"] == 15 and bought.json()["wallet"]["hearts"] == 5
    pending = await client.post("/api/economy/hearts/refill", headers=headers,
                                json={"idempotency_key": f"refill:{uuid4()}", "hearts": 1})
    assert pending.status_code == 503 and pending.json()["error"]["code"] == "ECONOMY_POLICY_PENDING"

    # Source expiry (cleanup worker semantics): delete the original, then mark EXPIRED.
    record = documents_repo._store[document_id]
    assert storage_service.get_object_bytes(record["s3_object_key"])
    assert storage_service.delete_object(record["s3_object_key"]) is True
    await documents_repo.update_status(document_id, "EXPIRED")
    with pytest.raises(StorageUnavailableError):
        storage_service.get_object_bytes(record["s3_object_key"])
    expired = await client.get(f"/api/documents/{document_id}/status", headers=headers)
    assert expired.json()["status"] == "EXPIRED"
    regenerate = await client.post("/api/generations", headers=headers, json={
        "document_id": document_id, "count": 2, "source_only": True})
    assert regenerate.status_code == 400 and regenerate.json()["error"]["code"] == "DOCUMENT_NOT_READY"
    kept = await client.get(f"/api/study-sets/{set_id}", headers=headers)
    assert kept.status_code == 200 and len(kept.json()["study_items"]) == len(items)
    # Removing the metadata row too still keeps the reviewer.
    assert (await client.delete(f"/api/documents/{document_id}", headers=headers)).status_code == 200
    assert (await client.get(f"/api/documents/{document_id}", headers=headers)).status_code == 404
    kept = await client.get(f"/api/study-sets/{set_id}", headers=headers)
    assert kept.status_code == 200 and len(kept.json()["study_items"]) == len(items)


async def test_http_two_user_isolation_and_anonymous_denial(client):
    alice, bob = str(uuid4()), str(uuid4())
    document_id = await ready_document(client, alice)
    job = await generate(client, alice, document_id)
    set_id = job["study_set_id"]
    item_id = (await study_repo.get_study_items(set_id, alice))[0]["id"]

    for path in [f"/api/documents/{document_id}", f"/api/documents/{document_id}/status",
                 f"/api/generations/{job['generation_id']}", f"/api/study-sets/{set_id}",
                 f"/api/study-sets/{set_id}/items"]:
        foreign = await client.get(path, headers=bearer(bob))
        assert foreign.status_code == 404, path
        assert "Cellular" not in foreign.text and alice not in foreign.text
        assert (await client.get(path)).status_code == 401
    assert all(s["user_id"] == bob for s in (await client.get("/api/study-sets", headers=bearer(bob))).json())
    stolen = await client.post("/api/generations", headers=bearer(bob), json={
        "document_id": document_id, "count": 2, "source_only": True})
    assert stolen.status_code == 404
    patched = await client.patch(f"/api/study-sets/{set_id}", headers=bearer(bob), json={"title": "x"})
    assert patched.status_code == 404
    forged = await client.post("/api/sync/events", headers=bearer(bob), json={"events": [{
        "event_id": str(uuid4()), "study_item_id": item_id, "result": "correct",
        "occurred_at": "2026-10-06T08:00:00+00:00"}]})
    assert forged.status_code == 404 and forged.json()["error"]["code"] == "STUDY_ITEM_NOT_FOUND"
    assert (await client.get("/api/economy/wallet")).status_code == 401
    assert (await client.post("/api/sync/events", json={"events": []})).status_code == 401
    # A client-supplied user id never changes the identity.
    spoof = await client.get("/api/study-sets", headers={**bearer(bob), "x-user-id": alice})
    assert all(s["user_id"] == bob for s in spoof.json())
    assert (await study_repo.get_study_set(set_id, alice))["title"] != "x"


# --- Same journey against real local PostgreSQL ------------------------------------

def rpc(database, statement):
    return json.loads(database(statement, role=SERVICE))


def test_pg_journey_register_job_generate_sync_economy_expire(database, users):
    alice, bob = users
    doc = document(alice)
    registered = rpc(database, register_sql(doc))
    assert registered["id"] == doc["id"] and registered["processing_status"] == "UPLOADED"

    # Durable ingestion job: enqueue twice (lost response) -> one job, one claim.
    enqueue = (f"SELECT public.enqueue_background_job('document_ingestion','{alice}','{doc['id']}',"
               "'{}'::jsonb,3,false);")
    assert rpc(database, enqueue)["id"] == rpc(database, enqueue)["id"]
    claimed = database("SELECT public.claim_background_jobs('w1',ARRAY['document_ingestion'],5,60,NULL);",
                       role=SERVICE).splitlines()
    assert len(claimed) == 1
    job_id = json.loads(claimed[0])["id"]
    chunk_id = str(uuid4())
    database(f"""INSERT INTO document_chunks(id,document_id,user_id,chunk_index,content,page_start,section)
                 VALUES ('{chunk_id}','{doc['id']}','{alice}',0,'Mitochondria produce ATP.',3,'Respiration');
                 UPDATE documents SET processing_status='READY',page_count=3 WHERE id='{doc['id']}';""", role=SERVICE)
    assert database(f"SELECT public.complete_background_job('{job_id}','w1');", role=SERVICE) == "t"
    # READY cannot be downgraded by a late worker.
    database(f"UPDATE documents SET processing_status='FAILED' WHERE id='{doc['id']}';", role=SERVICE)
    assert database(f"SELECT processing_status FROM documents WHERE id='{doc['id']}';") == "READY"

    # Grounded generation finalized atomically and idempotently.
    gen_id = str(uuid4())
    database(f"INSERT INTO generation_jobs(id,user_id,document_id,status) VALUES "
             f"('{gen_id}','{alice}','{doc['id']}','PROCESSING');", role=SERVICE)
    set_payload = {"id": str(uuid4()), "title": "Respiration reviewer", "document_id": doc["id"],
                   "generation_config": {"source_only": True}}
    generated = [{"type": "flashcard", "question": "What produces most ATP?", "answer": "Mitochondria",
                  "difficulty": "medium", "source_metadata": {"document_id": doc["id"], "chunk_id": chunk_id,
                                                              "page": 3, "section": "Respiration"}}]
    finalize = (f"SELECT persist_generated_study_set('{gen_id}','{alice}','{json.dumps(set_payload)}'::jsonb,"
                f"'{json.dumps(generated)}'::jsonb);")
    first, again = rpc(database, finalize), rpc(database, finalize)
    set_id = first["id"]
    assert again["id"] == set_id
    assert database(f"SELECT status FROM generation_jobs WHERE id='{gen_id}';") == "COMPLETED"
    item_id = database(f"SELECT id FROM study_items WHERE study_set_id='{set_id}';")
    assert database(authenticated(alice, f"SELECT count(*) FROM study_items WHERE study_set_id='{set_id}'")) == "1"
    assert database(authenticated(bob, f"SELECT count(*) FROM study_items WHERE study_set_id='{set_id}'")) == "0"

    # 101 events -> batches of 100 + 1; replay ignored; >100 rejected; foreign refs rejected.
    events = [{"event_id": str(uuid4()), "study_item_id": item_id, "result": "correct",
               "occurred_at": "2026-10-06T08:00:00Z"} for _ in range(101)]
    database(sync_sql(alice, events), success=False, role=SERVICE)
    assert rpc(database, sync_sql(alice, events[:100]))["accepted_count"] == 100
    assert rpc(database, sync_sql(alice, events[100:]))["accepted_count"] == 1
    replay = rpc(database, sync_sql(alice, events[:100]))
    assert replay["accepted_count"] == 0 and replay["ignored_duplicates_count"] == 100
    database(sync_sql(bob, events[:1]), success=False, role=SERVICE)
    assert database(f"SELECT count(*) FROM sync_events WHERE user_id='{alice}';") == "101"

    # Economy spend + reward replay safety.
    def entry(key, kind, hearts=0, credits=0):
        return rpc(database, f"SELECT public.apply_economy_entry('{alice}','{key}','{kind}',{hearts},{credits},0,"
                             "NULL,NULL,NULL);")
    assert entry("spend-1", "heart_loss", hearts=-1)["wallet"]["hearts"] == 4
    assert entry("spend-1", "heart_loss", hearts=-1)["replayed"] is True
    assert entry("reward-1", "credit_reward", credits=40)["wallet"]["credits"] == 40
    assert entry("reward-1", "credit_reward", credits=40)["wallet"]["credits"] == 40
    assert database(f"SELECT count(*) FROM economy_ledger WHERE user_id='{alice}';") == "2"

    # Expiry cleanup: original marked EXPIRED then the document row removed; the set persists.
    database(f"UPDATE documents SET uploaded_at=now()-interval '72 hours 1 minute',"
             f"expires_at=now()-interval '1 minute' WHERE id='{doc['id']}';", role=SERVICE)
    overdue = rpc(database, "SELECT public.retention_backlog();")
    assert overdue["overdue_count"] >= 1
    database(f"UPDATE documents SET processing_status='EXPIRED' WHERE id='{doc['id']}';", role=SERVICE)
    database(f"UPDATE documents SET processing_status='READY' WHERE id='{doc['id']}';", role=SERVICE)
    assert database(f"SELECT processing_status FROM documents WHERE id='{doc['id']}';") == "EXPIRED"
    database(f"DELETE FROM documents WHERE id='{doc['id']}';", role=SERVICE)
    assert database(f"SELECT count(*) FROM study_items WHERE study_set_id='{set_id}';") == "1"
    assert database(f"SELECT document_id IS NULL FROM study_sets WHERE id='{set_id}';") == "t"
    assert database(f"SELECT count(*) FROM document_chunks WHERE document_id='{doc['id']}';") == "0"


def test_pg_anonymous_and_cross_tenant_denial(database, users):
    alice, bob = users
    doc = document(alice)
    rpc(database, register_sql(doc))
    for table in ["documents", "study_sets", "study_items", "sync_events", "economy_wallets", "economy_ledger"]:
        database(f"BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM {table}; ROLLBACK;", success=False)
    assert database(authenticated(bob, f"SELECT count(*) FROM documents WHERE id='{doc['id']}'")) == "0"
    assert database(authenticated(alice, f"SELECT count(*) FROM documents WHERE id='{doc['id']}'")) == "1"
    database(authenticated(alice, f"UPDATE documents SET original_filename='x' WHERE id='{doc['id']}'"), success=False)
    assert database(f"SELECT original_filename FROM documents WHERE id='{doc['id']}';") == "notes.txt"
    database(authenticated(bob, "SELECT public.enqueue_background_job('document_ingestion',"
                                f"'{bob}','{doc['id']}','{{}}'::jsonb,3,false)"), success=False)
    database(authenticated(bob, "SELECT count(*) FROM internal.background_jobs"), success=False)
