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


@pytest.mark.parametrize(
    ("source", "rpc", "cursor_key", "row_key"),
    [
        ("objects", "list_document_storage_objects", "p_after_name", "name"),
        ("tickets", "list_upload_object_inventory", "p_after_object_key", "object_key"),
        ("documents", "", "", "id"),
    ],
)
@pytest.mark.asyncio
async def test_each_inventory_source_pages_by_its_key_and_rejects_truncation(
    monkeypatch, source, rpc, cursor_key, row_key
):
    monkeypatch.setattr(storage_inventory, "PAGE_SIZE", 2)

    class Query:
        def __init__(self, cursor=None, page_limit=None, cursor_field=None):
            self.cursor, self.page_limit, self.cursor_field = cursor, page_limit, cursor_field
            self.order_field = None

        def limit(self, value):
            self.page_limit = value
            return self

        def select(self, _columns):
            return self

        def order(self, _key):
            self.order_field = _key
            return self

        def gt(self, field, value):
            self.cursor_field = field
            self.cursor = value
            return self

    class Client:
        def rpc(self, _name, params):
            return Query(params[cursor_key], params["p_limit"], cursor_key)

        def table(self, _name):
            return Query()

    keys = ["a", "b", "c"]
    calls = []

    async def execute(query):
        calls.append((query.cursor_field, query.order_field, query.cursor))
        rows = [{row_key: key} for key in keys if query.cursor is None or key > query.cursor]
        return type("Result", (), {"data": rows[:query.page_limit]})()

    monkeypatch.setattr(storage_inventory.supabase_session, "execute", execute)
    rows = await storage_inventory._all_pages(Client(), rpc, cursor_key, 3, documents=source == "documents")
    assert [row[row_key] for row in rows] == keys
    if source == "documents":
        assert calls == [(None, "id", None), ("id", "id", "b"), ("id", "id", "c")]
    else:
        assert calls == [(cursor_key, None, None), (cursor_key, None, "b"), (cursor_key, None, "c")]

    calls.clear()
    with pytest.raises(ValueError, match="row limit"):
        await storage_inventory._all_pages(Client(), rpc, cursor_key, 2, documents=source == "documents")
    assert len(calls) == 2
    assert calls[-1][2] == "b"


@pytest.mark.parametrize(
    ("source", "rpc", "cursor_key", "row_key", "pages"),
    [
        ("objects", "list_document_storage_objects", "p_after_name", "name", [[{}]]),
        ("objects", "list_document_storage_objects", "p_after_name", "name", [[{"name": "a"}], [{"name": "a"}]]),
        ("objects", "list_document_storage_objects", "p_after_name", "name", [[{"name": "b"}], [{"name": "a"}]]),
        ("tickets", "list_upload_object_inventory", "p_after_object_key", "object_key", [[{}]]),
        ("tickets", "list_upload_object_inventory", "p_after_object_key", "object_key", [[{"object_key": "a"}], [{"object_key": "a"}]]),
        ("tickets", "list_upload_object_inventory", "p_after_object_key", "object_key", [[{"object_key": "b"}], [{"object_key": "a"}]]),
        ("documents", "", "", "id", [[{}]]),
        ("documents", "", "", "id", [[{"id": "a"}], [{"id": "a"}]]),
        ("documents", "", "", "id", [[{"id": "b"}], [{"id": "a"}]]),
    ],
)
@pytest.mark.asyncio
async def test_each_inventory_source_rejects_malformed_or_nonincreasing_cursors(
    monkeypatch, source, rpc, cursor_key, row_key, pages
):
    monkeypatch.setattr(storage_inventory, "PAGE_SIZE", 1)

    class Query:
        def __init__(self, cursor=None, limit=None):
            self.cursor, self.page_limit = cursor, limit

        def select(self, _columns):
            return self

        def order(self, _key):
            return self

        def gt(self, _key, value):
            self.cursor = value
            return self

        def limit(self, value):
            self.page_limit = value
            return self

    class Client:
        def rpc(self, _name, params):
            return Query(params[cursor_key], params["p_limit"])

        def table(self, _name):
            return Query()

    async def execute(_query):
        page = pages.pop(0)
        return type("Result", (), {"data": page})()

    monkeypatch.setattr(storage_inventory.supabase_session, "execute", execute)
    with pytest.raises(ValueError, match="Invalid inventory cursor"):
        await storage_inventory._all_pages(Client(), rpc, cursor_key, 10, documents=source == "documents")
