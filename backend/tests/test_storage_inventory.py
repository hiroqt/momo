"""Pure reconciliation checks for the read-only RET-01 operator command."""

import stat

import pytest

from scripts import storage_inventory
from scripts.storage_inventory import reconcile


def test_reconcile_reports_exact_unresolved_keys_and_ticket_destinations():
    counts, details = reconcile(
        ["matched", "unregistered"],
        [
            {"object_key": "matched", "provider": "supabase", "bucket": "documents", "legacy": False},
            {"object_key": "missing", "provider": None, "bucket": None, "legacy": True},
            {"object_key": "wrong-target", "provider": "s3", "bucket": "old", "legacy": False},
        ],
        [{"id": "d1", "s3_object_key": "matched"}, {"id": "d2", "s3_object_key": "document-only"}],
    )
    assert counts == {
        "storage_metadata_rows": 2,
        "ticket_rows": 3,
        "document_rows": 2,
        "unregistered_storage_objects": 1,
        "documents_without_ticket": 1,
        "documents_without_storage_row": 1,
        "tickets_without_storage_row": 2,
        "tickets_without_document": 2,
        "legacy_tickets": 1,
        "legacy_destination_unresolved": 1,
        "ticket_destination_mismatch": 1,
    }
    assert details["unregistered_storage_objects"] == ["unregistered"]
    assert details["legacy_destination_unresolved"] == ["missing"]
    assert details["ticket_destination_mismatch"] == ["wrong-target"]


@pytest.mark.parametrize(
    ("objects", "tickets", "documents"),
    [
        (["duplicate", "duplicate"], [], []),
        ([None], [], []),
        ([], [{"object_key": "duplicate"}, {"object_key": "duplicate"}], []),
        ([], [], [{"s3_object_key": "duplicate"}, {"s3_object_key": "duplicate"}]),
        ([], [{"object_key": None}], []),
    ],
)
def test_reconcile_rejects_duplicate_or_invalid_keys(objects, tickets, documents):
    with pytest.raises(ValueError):
        reconcile(objects, tickets, documents)


def test_report_is_private_complete_and_never_overwrites(tmp_path):
    path = tmp_path / "inventory.json"
    counts, details = reconcile(["orphan"], [], [])
    storage_inventory.write_report(path, counts, details)
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert '"orphan"' in path.read_text()
    with pytest.raises(FileExistsError):
        storage_inventory.write_report(path, counts, details)
    assert not list(tmp_path.glob(".storage-inventory-*"))


@pytest.mark.asyncio
async def test_object_inventory_uses_keyset_pages_and_fails_when_row_cap_truncates(monkeypatch):
    monkeypatch.setattr(storage_inventory, "PAGE_SIZE", 1)
    class Query:
        def __init__(self, cursor, limit):
            self.cursor, self.limit = cursor, limit

    class Client:
        def rpc(self, _name, params):
            return Query(params["p_after_name"], params["p_limit"])

    calls = []

    async def execute(query):
        calls.append(query)
        rows = [{"name": key} for key in ("a", "b", "c") if query.cursor is None or key > query.cursor]
        return type("Result", (), {"data": rows[:query.limit]})()

    monkeypatch.setattr(storage_inventory.supabase_session, "execute", execute)
    rows = await storage_inventory._all_pages(Client(), "list_document_storage_objects", "p_after_name", 3)
    assert [row["name"] for row in rows] == ["a", "b", "c"]
    assert [call.cursor for call in calls] == [None, "a", "b", "c"]
    with pytest.raises(ValueError, match="row limit"):
        await storage_inventory._all_pages(Client(), "list_document_storage_objects", "p_after_name", 2)

    async def execute_missing_probe_data(query):
        rows = [{"name": key} for key in ("a", "b", "c") if query.cursor is None or key > query.cursor]
        return type("Result", (), {"data": rows[:query.limit] if query.limit > 1 else None})()

    monkeypatch.setattr(storage_inventory.supabase_session, "execute", execute_missing_probe_data)
    with pytest.raises(ValueError, match="Invalid inventory page"):
        await storage_inventory._all_pages(Client(), "list_document_storage_objects", "p_after_name", 2)


@pytest.mark.asyncio
async def test_object_inventory_rejects_missing_page_data(monkeypatch):
    class Client:
        def rpc(self, _name, _params):
            return object()

    async def execute(_query):
        return type("Result", (), {"data": None})()

    monkeypatch.setattr(storage_inventory.supabase_session, "execute", execute)
    with pytest.raises(ValueError, match="Invalid inventory page"):
        await storage_inventory._all_pages(Client(), "list_document_storage_objects", "p_after_name", 10)
