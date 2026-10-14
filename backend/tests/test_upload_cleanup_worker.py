"""Physical deletion only follows a current lease and verified provider observation."""
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.db.repositories.upload_ticket_repo import upload_ticket_repo
from app.services.storage.base import (
    ObjectMetadata,
    ObjectNotFoundError,
    StorageUnavailableError,
)
from app.workers import cleanup_worker as module


@pytest.fixture
async def issued_ticket(monkeypatch):
    monkeypatch.setattr(upload_ticket_repo, "_tickets", {})
    owner, identity = str(uuid4()), str(uuid4())
    now = datetime.now(UTC)
    ticket = await upload_ticket_repo.issue({
        "id": identity, "user_id": owner, "object_key": f"documents/{owner}/{identity}/original.txt",
        "file_type": "txt", "mime_type": "text/plain", "file_size": 10,
        "provider": module.storage_service.provider, "bucket": module.storage_service.bucket,
        "signed_until": (now + timedelta(hours=1)).isoformat(),
    })
    # Isolate the one ticket rather than inspecting other tests' retained outboxes.
    original = upload_ticket_repo.claim_cleanup

    async def claim(limit, **filters):
        rows = await original(limit, **filters)
        return [row for row in rows if row["id"] == identity]

    return ticket, claim


async def test_orphan_expiry_uses_observed_upload_time_and_retains_tombstone(issued_ticket, monkeypatch):
    ticket, claim = issued_ticket
    stored = upload_ticket_repo._tickets[ticket["id"]]
    uploaded = datetime.now(UTC) - timedelta(hours=73)
    stored["issued_at"] = (uploaded - timedelta(minutes=1)).isoformat()
    monkeypatch.setattr(upload_ticket_repo, "claim_cleanup", claim)
    monkeypatch.setattr(module.storage_service, "get_object_metadata", lambda key, **kwargs: ObjectMetadata(10, uploaded, identity="original-object"))
    deletes = []
    monkeypatch.setattr(module.storage_service, "delete_object", lambda key: deletes.append(key) or True)
    monkeypatch.setattr(module.storage_service, "delete_observed_object", lambda key, metadata: deletes.append(key) or True)
    assert await module.cleanup_upload_tickets() == 1
    assert deletes == [ticket["object_key"]]
    assert stored["status"] == "expired" and stored["last_deleted_at"]
    assert datetime.fromisoformat(stored["expires_at"]) == uploaded + timedelta(hours=72)
    assert stored["lease_token"] is None and stored["next_check_at"]


async def test_missing_upload_is_reprobed_but_storage_outage_is_not_absence(issued_ticket, monkeypatch, caplog):
    ticket, claim = issued_ticket
    stored = upload_ticket_repo._tickets[ticket["id"]]
    monkeypatch.setattr(upload_ticket_repo, "claim_cleanup", claim)
    deletes = []
    monkeypatch.setattr(module.storage_service, "delete_object", lambda key: deletes.append(key) or True)
    monkeypatch.setattr(module.storage_service, "delete_observed_object", lambda key, metadata: deletes.append(key) or True)

    def missing(key, **kwargs):
        raise ObjectNotFoundError("confirmed missing")

    monkeypatch.setattr(module.storage_service, "get_object_metadata", missing)
    assert await module.cleanup_upload_tickets() == 0
    assert stored["lease_token"] is None and stored["status"] == "issued" and not deletes
    stored["next_check_at"] = datetime.now(UTC).isoformat()

    def outage(key, **kwargs):
        raise StorageUnavailableError("private detail")

    monkeypatch.setattr(module.storage_service, "get_object_metadata", outage)
    assert await module.cleanup_upload_tickets() == 0
    assert stored["lease_token"] is not None and not deletes
    assert "Upload cleanup failed (StorageUnavailableError)" in caplog.text
    assert "private detail" not in caplog.text


async def test_failed_delete_keeps_outbox_retryable(issued_ticket, monkeypatch, caplog):
    ticket, claim = issued_ticket
    stored = upload_ticket_repo._tickets[ticket["id"]]
    stored["signed_until"] = (datetime.now(UTC) - timedelta(minutes=16)).isoformat()
    await upload_ticket_repo.retire(ticket["id"], ticket["user_id"])
    claims = await claim(100)
    monkeypatch.setattr(upload_ticket_repo, "claim_cleanup", AsyncMock(return_value=claims))
    monkeypatch.setattr(module.storage_service, "get_object_metadata", lambda key, **kwargs: ObjectMetadata(10, datetime.now(UTC)))
    monkeypatch.setattr(module.storage_service, "delete_object", lambda key: False)
    assert await module.cleanup_upload_tickets() == 0
    assert stored["delete_required"] and stored["lease_token"] and stored["last_deleted_at"] is None
    assert "Upload cleanup failed (RuntimeError)" in caplog.text


async def test_retired_ticket_deletes_only_after_deadline_and_keeps_reprobing(issued_ticket, monkeypatch):
    ticket, claim = issued_ticket
    stored = upload_ticket_repo._tickets[ticket["id"]]
    stored["signed_until"] = (datetime.now(UTC) - timedelta(minutes=16)).isoformat()
    assert await upload_ticket_repo.retire(ticket["id"], ticket["user_id"])
    monkeypatch.setattr(upload_ticket_repo, "claim_cleanup", claim)
    metadata_calls = []
    deletes = []

    def unexpected_metadata(key, **kwargs):
        metadata_calls.append(key)
        raise AssertionError("retired ticket deletion should not use an observed generation")

    monkeypatch.setattr(module.storage_service, "get_object_metadata", unexpected_metadata)
    monkeypatch.setattr(module.storage_service, "delete_object", lambda key: deletes.append(key) or True)
    monkeypatch.setattr(module.storage_service, "delete_observed_object", lambda key, metadata: pytest.fail("unexpected generation delete"))

    assert await module.cleanup_upload_tickets() == 1
    assert deletes == [ticket["object_key"]]
    assert not metadata_calls
    assert stored["last_deleted_at"] and datetime.fromisoformat(stored["next_check_at"]) > datetime.now(UTC)

    stored["next_check_at"] = datetime.now(UTC).isoformat()
    assert await module.cleanup_upload_tickets() == 1
    assert deletes == [ticket["object_key"], ticket["object_key"]]


async def test_mismatched_destination_is_never_inspected_or_deleted(monkeypatch):
    ticket = {"id": str(uuid4()), "user_id": str(uuid4()), "file_type": "txt", "object_key": "wrong-path",
              "provider": module.storage_service.provider, "bucket": module.storage_service.bucket, "lease_token": str(uuid4())}
    monkeypatch.setattr(upload_ticket_repo, "claim_cleanup", AsyncMock(return_value=[ticket]))
    calls = []
    monkeypatch.setattr(module.storage_service, "get_object_metadata", lambda key: calls.append(key))
    monkeypatch.setattr(module.storage_service, "delete_object", lambda key: calls.append(key))
    assert await module.cleanup_upload_tickets() == 0
    assert not calls
