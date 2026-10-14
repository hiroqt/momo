"""Owner-scoped upload, quota/cleanup races, actual-age retention and outbox."""

import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from test_postgres_rls import database as database
from test_postgres_rls import users as users

from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.upload_ticket_repo import (
    UploadTicketRepository,
    upload_ticket_repo,
)
from app.db.repositories.usage_repo import usage_repo
from app.services.storage.base import ObjectMetadata


def issued(owner=None, identity=None):
    owner, identity = owner or str(uuid4()), identity or str(uuid4())
    return {"id": identity, "user_id": owner, "object_key": f"documents/{owner}/{identity}/original.txt",
            "file_type": "txt", "mime_type": "text/plain", "file_size": 12,
            "provider": "supabase", "bucket": "documents", "signed_until": (datetime.now(UTC)+timedelta(hours=1)).isoformat()}


def registration(ticket, uploaded_at=None):
    return {"id": ticket["id"], "user_id": ticket["user_id"], "original_filename": "notes.txt",
            "file_type": ticket["file_type"], "mime_type": ticket["mime_type"], "file_size": ticket["file_size"],
            "s3_object_key": ticket["object_key"], "uploaded_at": uploaded_at or datetime.now(UTC).isoformat(),
            "object_identity": "provider-object", "object_version": "initial-version", "object_etag": '"content-etag"', "page_count": 0}


def sql_json(value):
    return "'"+json.dumps(value).replace("'", "''")+"'::jsonb"


def issue_pg(database, owner):
    data = issued(owner)
    ticket = json.loads(database(f"SELECT issue_upload_ticket({sql_json(data)});", role="service_role"))
    return ticket


async def test_memory_ticket_registration_requires_issue_and_preserves_original_upload_clock():
    data = issued()
    try:
        with pytest.raises(HTTPException) as missing:
            await documents_repo.register(registration(data))
        assert missing.value.detail["code"] == "UPLOAD_TICKET_REQUIRED"
        ticket = await upload_ticket_repo.issue(data)
        stamp = datetime.now(UTC)-timedelta(minutes=2)
        document = await documents_repo.register(registration(ticket, stamp.isoformat()))
        assert document["uploaded_at"] == stamp.isoformat()
        assert document["expires_at"] == (stamp+timedelta(hours=72)).isoformat()
        assert (await upload_ticket_repo.get(ticket["id"], ticket["user_id"]))["identity"] == "provider-object"
        replay = await documents_repo.register({"id": ticket["id"], "user_id": ticket["user_id"]})
        assert replay["id"] == document["id"]
        assert usage_repo._counts[f"{ticket['user_id']}:{usage_repo._get_year_month()}"] == 1
        assert await upload_ticket_repo.get(ticket["id"], str(uuid4())) is None
    finally:
        documents_repo._store.pop(data["id"], None)
        upload_ticket_repo._tickets.pop(data["id"], None)
        usage_repo._counts.pop(f"{data['user_id']}:{usage_repo._get_year_month()}", None)


async def test_memory_claim_blocks_registration_missing_probe_releases_lease_without_abandoning_ticket():
    data = issued()
    try:
        await upload_ticket_repo.issue(data)
        claim = next(row for row in await upload_ticket_repo.claim_cleanup(100) if row["id"] == data["id"])
        with pytest.raises(HTTPException) as busy:
            await documents_repo.register(registration(data))
        assert busy.value.detail["code"] == "UPLOAD_BUSY"
        assert not await upload_ticket_repo.prepare_cleanup(data["id"], claim["lease_token"], None)
        stored = await upload_ticket_repo.get(data["id"], data["user_id"])
        assert stored["lease_token"] is None and stored["status"] == "issued"
        assert stored["next_check_at"] > datetime.now(UTC).isoformat()
        document = await documents_repo.register(registration(data))
        assert document["id"] == data["id"]
        assert not await upload_ticket_repo.finish_cleanup(data["id"], claim["lease_token"])
    finally:
        documents_repo._store.pop(data["id"], None)
        upload_ticket_repo._tickets.pop(data["id"], None)
        usage_repo._counts.pop(f"{data['user_id']}:{usage_repo._get_year_month()}", None)


async def test_memory_concurrent_claims_and_retire_do_not_delete_early_or_resurrect():
    repo = UploadTicketRepository()
    data = issued()
    ticket = await repo.issue(data)
    claims = await asyncio.gather(*[repo.claim_cleanup() for _ in range(8)])
    assert sum(len(rows) for rows in claims) == 1
    claim = next(rows[0] for rows in claims if rows)
    metadata = ObjectMetadata(12, datetime.now(UTC), identity="initial")
    assert not await repo.retire(ticket["id"], str(uuid4()))
    assert await repo.retire(ticket["id"], ticket["user_id"])
    assert not await repo.prepare_cleanup(ticket["id"], claim["lease_token"], metadata)
    assert not await repo.claim_cleanup()
    repo._tickets[ticket["id"]]["signed_until"] = (datetime.now(UTC)-timedelta(minutes=16)).isoformat()
    repo._tickets[ticket["id"]]["next_check_at"] = datetime.now(UTC).isoformat()
    retired = (await repo.claim_cleanup())[0]
    assert await repo.prepare_cleanup(ticket["id"], retired["lease_token"], metadata)
    assert not await repo.finish_cleanup(ticket["id"], str(uuid4()))
    assert await repo.finish_cleanup(ticket["id"], retired["lease_token"])
    assert not await repo.finish_cleanup(ticket["id"], retired["lease_token"])
    with pytest.raises(HTTPException):
        await repo.issue(data)


async def test_memory_verified_absence_clears_overdue_bookkeeping_and_reappearance_restores_it():
    repo = UploadTicketRepository()
    ticket = await repo.issue(issued())
    old = datetime.now(UTC)-timedelta(days=4)
    saved = repo._tickets[ticket["id"]]
    saved.update(issued_at=old.isoformat(), uploaded_at=old.isoformat(), expires_at=(old+timedelta(hours=72)).isoformat(),
                 physical_expires_at=(old+timedelta(hours=72)).isoformat(), identity="initial")
    claim = (await repo.claim_cleanup())[0]
    assert not await repo.prepare_cleanup(ticket["id"], claim["lease_token"], None)
    assert saved["last_deleted_at"] is not None and saved["status"] == "expired"
    saved["next_check_at"] = datetime.now(UTC).isoformat()
    claim = (await repo.claim_cleanup())[0]
    assert await repo.prepare_cleanup(ticket["id"], claim["lease_token"], ObjectMetadata(12, old, identity="initial"))
    assert saved["last_deleted_at"] is None


def test_pg_issue_registration_replay_quota_and_actual_upload_time(database, users):
    owner, other = users
    ticket = issue_pg(database, owner)
    payload = registration(ticket, (datetime.now(UTC)-timedelta(minutes=2)).isoformat())
    statement = f"SELECT register_document({sql_json(payload)},1);"
    with ThreadPoolExecutor(max_workers=6) as pool:
        rows = list(pool.map(lambda _: json.loads(database(statement, role="service_role")), range(6)))
    assert {row["id"] for row in rows} == {ticket["id"]}
    assert database(f"SELECT documents_count FROM usage_records WHERE user_id='{owner}';") == "1"
    assert database(f"SELECT extract(epoch FROM expires_at-uploaded_at)::integer FROM documents WHERE id='{ticket['id']}';") == str(72*3600)
    assert database(f"SELECT uploaded_at<created_at FROM documents WHERE id='{ticket['id']}';") == "t"
    assert database(f"SELECT get_upload_ticket('{ticket['id']}','{other}');", role="service_role") == ""
    second = issue_pg(database, owner)
    database(f"SELECT register_document({sql_json(registration(second))},1);", role="service_role", success=False)
    assert database(f"SELECT status FROM internal.upload_tickets WHERE id='{second['id']}';") == "issued"
    assert database(f"SELECT count(*) FROM documents WHERE user_id='{owner}';") == "1"
    foreign = {**payload, "user_id": other}
    database(f"SELECT register_document({sql_json(foreign)},10);", role="service_role", success=False)


def test_pg_unissued_metadata_validation_and_client_denial(database, users):
    owner, _ = users
    data = issued(owner)
    database(f"SELECT register_document({sql_json(registration(data))},10);", role="service_role", success=False)
    ticket = issue_pg(database, owner)
    for changed in [{"uploaded_at": "bad"}, {"uploaded_at": "2026-10-08T00:00:00"}, {"uploaded_at": (datetime.now(UTC)+timedelta(hours=1)).isoformat()},
                    {"uploaded_at": (datetime.now(UTC)-timedelta(hours=1)).isoformat()}, {"file_size": 11}, {"mime_type": "different"}]:
        database(f"SELECT register_document({sql_json({**registration(ticket), **changed})},10);", role="service_role", success=False)
    assert database(f"SELECT count(*) FROM usage_records WHERE user_id='{owner}';") == "0"
    for role in ("anon", "authenticated"):
        database(f"SELECT issue_upload_ticket({sql_json(issued(owner))});", role=role, success=False)
        database("SELECT * FROM internal.upload_tickets;", role=role, success=False)
        database("SELECT claim_upload_cleanup(1,NULL,NULL);", role=role, success=False)
    assert database("SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='internal.upload_tickets'::regclass;") == "t"


def test_pg_claim_registration_race_and_missing_observation_keeps_reprobe(database, users):
    owner, _ = users
    ticket = issue_pg(database, owner)
    with ThreadPoolExecutor(max_workers=8) as pool:
        rows = list(pool.map(lambda _: database("SELECT claim_upload_cleanup(100,'supabase','documents');", role="service_role"), range(8)))
    claims = [json.loads(line) for output in rows for line in output.splitlines() if line]
    own = [row for row in claims if row["id"] == ticket["id"]]
    assert len(own) == 1
    token = own[0]["lease_token"]
    database(f"SELECT register_document({sql_json(registration(ticket))},10);", role="service_role", success=False)
    assert database(f"SELECT prepare_upload_cleanup('{ticket['id']}','{token}',NULL);", role="service_role") == "f"
    assert database(f"SELECT lease_token IS NULL AND next_check_at>now() FROM internal.upload_tickets WHERE id='{ticket['id']}';") == "t"
    database(f"SELECT register_document({sql_json(registration(ticket))},10);", role="service_role")
    assert database(f"SELECT finish_upload_cleanup('{ticket['id']}','{token}');", role="service_role") == "f"


def test_pg_retire_expires_source_keeps_material_and_acknowledges_only_deletion(database, users):
    owner, other = users
    ticket = issue_pg(database, owner)
    payload = registration(ticket)
    database(f"SELECT register_document({sql_json(payload)},10);", role="service_role")
    set_id = str(uuid4())
    database(f"INSERT INTO study_sets(id,user_id,title,document_id) VALUES('{set_id}','{owner}','Persistent study','{ticket['id']}');")
    assert database(f"SELECT retire_upload_ticket('{ticket['id']}','{other}');", role="service_role") == "f"
    database(f"UPDATE internal.upload_tickets SET signed_until=now()-interval '16 minutes' WHERE id='{ticket['id']}';")
    assert database(f"SELECT retire_upload_ticket('{ticket['id']}','{owner}');", role="service_role") == "t"
    assert database(f"SELECT processing_status FROM documents WHERE id='{ticket['id']}';") == "EXPIRED"
    database(f"SELECT register_document({sql_json(payload)},10);", role="service_role", success=False)
    claims = [json.loads(line) for line in database("SELECT claim_upload_cleanup(100,'supabase','documents');", role="service_role").splitlines() if line]
    claim = next(row for row in claims if row["id"] == ticket["id"])
    observation = {"size": 12, "uploaded_at": payload["uploaded_at"], "identity": payload["object_identity"], "version": payload["object_version"], "etag": payload["object_etag"]}
    assert database(f"SELECT prepare_upload_cleanup('{ticket['id']}','{claim['lease_token']}',{sql_json(observation)});", role="service_role") == "t"
    assert database(f"SELECT finish_upload_cleanup('{ticket['id']}','{uuid4()}');", role="service_role") == "f"
    assert database(f"SELECT finish_upload_cleanup('{ticket['id']}','{claim['lease_token']}');", role="service_role") == "t"
    database(f"DELETE FROM documents WHERE id='{ticket['id']}';")
    assert database(f"SELECT document_id IS NULL FROM study_sets WHERE id='{set_id}';") == "t"
    assert database(f"SELECT count(*) FROM internal.upload_tickets WHERE id='{ticket['id']}';") == "1"


def test_pg_auth_deletion_retains_origin_and_manual_outbox(database, users):
    owner, _ = users
    ticket = issue_pg(database, owner)
    database(f"DELETE FROM auth.users WHERE id='{owner}';")
    assert database(f"SELECT user_id::text||':'||status||':'||(auth_ref IS NULL)::text FROM internal.upload_tickets WHERE id='{ticket['id']}';") == f"{owner}:retired:true"
    assert database(f"SELECT count(*) FROM claim_upload_cleanup(100,'supabase','documents') AS t WHERE t->>'id'='{ticket['id']}';", role="service_role") == "0"
    database(f"UPDATE internal.upload_tickets SET signed_until=now()-interval '16 minutes',next_check_at=now() WHERE id='{ticket['id']}';")
    assert database(f"SELECT count(*) FROM claim_upload_cleanup(100,'supabase','documents') AS t WHERE t->>'id'='{ticket['id']}';", role="service_role") == "1"
    assert database(f"SELECT get_upload_ticket('{ticket['id']}','{owner}');", role="service_role") == ""


def test_pg_recreated_newer_bytes_never_extend_source_or_delete_new_binary_early(database, users):
    owner, _ = users
    ticket = issue_pg(database, owner)
    payload = registration(ticket)
    database(f"SELECT register_document({sql_json(payload)},10);", role="service_role")
    old = (datetime.now(UTC)-timedelta(days=4)).isoformat()
    database(f"UPDATE internal.upload_tickets SET issued_at='{old}',uploaded_at='{old}',expires_at='{old}'::timestamptz+interval '72 hours',next_check_at=now() WHERE id='{ticket['id']}';")
    rows = [json.loads(line) for line in database("SELECT claim_upload_cleanup(100,'supabase','documents');", role="service_role").splitlines() if line]
    claim = next(row for row in rows if row["id"] == ticket["id"])
    fresh = {"size": 12, "uploaded_at": datetime.now(UTC).isoformat(), "identity": "recreated", "version": "new", "etag": '"new"'}
    assert database(f"SELECT prepare_upload_cleanup('{ticket['id']}','{claim['lease_token']}',{sql_json(fresh)});", role="service_role") == "f"
    assert database(f"SELECT status||':'||(uploaded_at<'{fresh['uploaded_at']}'::timestamptz)::text||':'||(next_check_at>now())::text FROM internal.upload_tickets WHERE id='{ticket['id']}';") == "expired:true:true"
    assert database(f"SELECT processing_status FROM documents WHERE id='{ticket['id']}';") == "EXPIRED"
    database(f"SELECT register_document({sql_json(payload)},10);", role="service_role", success=False)


def test_pg_verified_absence_removes_overdue_count_without_discarding_reprobe(database, users):
    owner, _ = users
    ticket = issue_pg(database, owner)
    old = datetime.now(UTC)-timedelta(days=4)
    database(f"UPDATE internal.upload_tickets SET issued_at='{old.isoformat()}',uploaded_at='{old.isoformat()}',expires_at='{old.isoformat()}'::timestamptz+interval '72 hours',physical_expires_at='{old.isoformat()}'::timestamptz+interval '72 hours',next_check_at=now() WHERE id='{ticket['id']}';")
    before = json.loads(database("SELECT retention_backlog();", role="service_role"))["overdue_count"]
    claim = next(json.loads(line) for line in database("SELECT claim_upload_cleanup(100,'supabase','documents');", role="service_role").splitlines() if json.loads(line)["id"] == ticket["id"])
    assert database(f"SELECT prepare_upload_cleanup('{ticket['id']}','{claim['lease_token']}',NULL);", role="service_role") == "f"
    assert json.loads(database("SELECT retention_backlog();", role="service_role"))["overdue_count"] == before-1
    assert database(f"SELECT next_check_at>now() AND last_deleted_at IS NOT NULL FROM internal.upload_tickets WHERE id='{ticket['id']}';") == "t"
    database(f"UPDATE internal.upload_tickets SET next_check_at=now() WHERE id='{ticket['id']}';")
    claim = next(json.loads(line) for line in database("SELECT claim_upload_cleanup(100,'supabase','documents');", role="service_role").splitlines() if json.loads(line)["id"] == ticket["id"])
    observation = {"size": 12, "uploaded_at": old.isoformat()}
    assert database(f"SELECT prepare_upload_cleanup('{ticket['id']}','{claim['lease_token']}',{sql_json(observation)});", role="service_role") == "t"
    assert json.loads(database("SELECT retention_backlog();", role="service_role"))["overdue_count"] == before


def test_pg_live_cleanup_lease_retired_replay_and_null_tokens_are_fenced(database, users):
    owner, _ = users
    ticket = issue_pg(database, owner)
    database(f"SELECT register_document({sql_json(registration(ticket))},10);", role="service_role")
    database(f"UPDATE internal.upload_tickets SET next_check_at=now() WHERE id='{ticket['id']}';")
    claim = next(json.loads(line) for line in database("SELECT claim_upload_cleanup(100,'supabase','documents');", role="service_role").splitlines() if json.loads(line)["id"] == ticket["id"])
    minimal = {"id": ticket["id"], "user_id": owner}
    database(f"SELECT register_document({sql_json(minimal)},10);", role="service_role", success=False)
    assert database(f"SELECT prepare_upload_cleanup('{ticket['id']}',NULL,NULL);", role="service_role") == "f"
    database(f"UPDATE internal.upload_tickets SET lease_until=now()-interval '1 second' WHERE id='{ticket['id']}';")
    assert database(f"SELECT prepare_upload_cleanup('{ticket['id']}','{claim['lease_token']}',NULL);", role="service_role") == "f"
    database(f"SELECT retire_upload_ticket('{ticket['id']}','{owner}');", role="service_role")
    database(f"SELECT register_document({sql_json(minimal)},10);", role="service_role", success=False)


def test_pg_retirement_revokes_live_cleanup_lease_until_signed_url_deadline(database, users):
    owner, _ = users
    ticket = issue_pg(database, owner)
    claim = next(json.loads(line) for line in database("SELECT claim_upload_cleanup(100,'supabase','documents');", role="service_role").splitlines() if json.loads(line)["id"] == ticket["id"])
    assert database(f"SELECT retire_upload_ticket('{ticket['id']}','{owner}');", role="service_role") == "t"
    assert database(f"SELECT lease_token IS NULL AND next_check_at>now() FROM internal.upload_tickets WHERE id='{ticket['id']}';") == "t"
    assert database(f"SELECT prepare_upload_cleanup('{ticket['id']}','{claim['lease_token']}',NULL);", role="service_role") == "f"
    assert database(f"SELECT count(*) FROM claim_upload_cleanup(100,'supabase','documents') AS t WHERE t->>'id'='{ticket['id']}';", role="service_role") == "0"
    database(f"UPDATE internal.upload_tickets SET signed_until=now()-interval '16 minutes',next_check_at=now() WHERE id='{ticket['id']}';")
    assert database(f"SELECT count(*) FROM claim_upload_cleanup(100,'supabase','documents') AS t WHERE t->>'id'='{ticket['id']}';", role="service_role") == "1"


def test_pg_registration_cleanup_compete_without_accepting_claimed_upload(database, users):
    owner, _ = users
    ticket = issue_pg(database, owner)
    payload = sql_json(registration(ticket))
    # Independent connections race the actual RPCs. Only UPLOAD_BUSY is an
    # expected registration failure, never a hidden SQL/ownership exception.
    register = f"DO $$ BEGIN PERFORM register_document({payload},10); EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'UPLOAD_BUSY' THEN RAISE; END IF; END $$; SELECT count(*) FROM documents WHERE id='{ticket['id']}';"
    with ThreadPoolExecutor(max_workers=2) as pool:
        registered = pool.submit(database, register, role="service_role")
        claimed = pool.submit(database, "SELECT claim_upload_cleanup(100,'supabase','documents');", role="service_role")
        assert registered.result() in {"0", "1"}
        claimed.result()
    outcome = database(f"SELECT status||':'||coalesce(lease_until>now(),false)::text FROM internal.upload_tickets WHERE id='{ticket['id']}';")
    assert outcome in {"registered:false", "issued:true"}


@pytest.mark.parametrize("size", [0, 16 * 1024 * 1024, 5 * 1024**4])
async def test_memory_empty_or_oversized_orphan_remains_deletable_but_cannot_register(size):
    repo = UploadTicketRepository()
    ticket = await repo.issue(issued())
    with pytest.raises(HTTPException) as invalid:
        repo.register_memory({**registration(ticket), "file_size": size}, 10)
    assert invalid.value.detail["code"] == "INVALID_UPLOAD_METADATA"
    old = datetime.now(UTC)-timedelta(days=4)
    repo._tickets[ticket["id"]]["issued_at"] = old.isoformat()
    claim = (await repo.claim_cleanup())[0]
    assert await repo.prepare_cleanup(ticket["id"], claim["lease_token"], ObjectMetadata(size, old))
    assert await repo.finish_cleanup(ticket["id"], claim["lease_token"])


async def test_memory_retired_missing_head_requires_provider_cleanup_before_ack():
    repo = UploadTicketRepository()
    ticket = await repo.issue(issued())
    assert await repo.retire(ticket["id"], ticket["user_id"])
    assert not await repo.claim_cleanup()
    repo._tickets[ticket["id"]]["signed_until"] = (datetime.now(UTC)-timedelta(minutes=16)).isoformat()
    repo._tickets[ticket["id"]]["next_check_at"] = datetime.now(UTC).isoformat()
    claim = (await repo.claim_cleanup())[0]
    assert await repo.prepare_cleanup(ticket["id"], claim["lease_token"], None)
    stored = repo._tickets[ticket["id"]]
    assert stored["lease_token"] == claim["lease_token"] and stored["last_deleted_at"] is None
    assert stored["delete_required"] is True
    assert await repo.finish_cleanup(ticket["id"], claim["lease_token"])


@pytest.mark.parametrize("size", [0, 16 * 1024 * 1024, 5 * 1024**4])
def test_pg_empty_oversized_orphan_can_be_deleted_without_accepting_upload(database, users, size):
    owner, _ = users
    ticket = issue_pg(database, owner)
    database(f"SELECT register_document({sql_json({**registration(ticket), 'file_size': size})},10);", role="service_role", success=False)
    old = (datetime.now(UTC)-timedelta(days=4)).isoformat()
    database(f"UPDATE internal.upload_tickets SET issued_at='{old}' WHERE id='{ticket['id']}';")
    claim = next(json.loads(line) for line in database("SELECT claim_upload_cleanup(100,'supabase','documents');", role="service_role").splitlines() if json.loads(line)["id"] == ticket["id"])
    observation = {"size": size, "uploaded_at": old}
    assert database(f"SELECT prepare_upload_cleanup('{ticket['id']}','{claim['lease_token']}',{sql_json(observation)});", role="service_role") == "t"
    assert database(f"SELECT finish_upload_cleanup('{ticket['id']}','{claim['lease_token']}');", role="service_role") == "t"
    assert database(f"SELECT count(*) FROM documents WHERE id='{ticket['id']}';") == "0"


def test_pg_retired_absent_current_object_does_not_ack_hidden_versions(database, users):
    owner, _ = users
    ticket = issue_pg(database, owner)
    database(f"UPDATE internal.upload_tickets SET signed_until=now()-interval '16 minutes' WHERE id='{ticket['id']}';")
    database(f"SELECT retire_upload_ticket('{ticket['id']}','{owner}');", role="service_role")
    claim = next(json.loads(line) for line in database("SELECT claim_upload_cleanup(100,'supabase','documents');", role="service_role").splitlines() if json.loads(line)["id"] == ticket["id"])
    assert database(f"SELECT prepare_upload_cleanup('{ticket['id']}','{claim['lease_token']}',NULL);", role="service_role") == "t"
    assert database(f"SELECT delete_required AND lease_token IS NOT NULL AND last_deleted_at IS NULL FROM internal.upload_tickets WHERE id='{ticket['id']}';") == "t"
    assert database(f"SELECT finish_upload_cleanup('{ticket['id']}','{claim['lease_token']}');", role="service_role") == "t"
