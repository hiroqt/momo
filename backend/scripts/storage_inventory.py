"""Read-only reconciliation of documents-bucket metadata and upload records."""
import argparse
import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any, cast

from app.config import STAGING_PROJECT_REF, settings
from app.db.session import supabase_session

PAGE_SIZE = 100
MAX_ROWS = 100_000


def write_report(path: Path, counts: dict[str, Any], details: dict[str, Any]) -> None:
    descriptor, temporary_name = tempfile.mkstemp(prefix=".storage-inventory-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as report:
            json.dump({"counts": counts, "details": details}, report, indent=2)
            report.write("\n")
            report.flush()
            os.fsync(report.fileno())
        os.link(temporary_name, path)
    finally:
        os.unlink(temporary_name)


def reconcile(objects: list[str], tickets: list[dict[str, Any]], documents: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
    if any(not isinstance(key, str) or not key for key in objects):
        raise ValueError("Invalid storage object key")
    if len(objects) != len(set(objects)):
        raise ValueError("Duplicate storage object keys")
    raw_ticket_keys = [row.get("object_key") for row in tickets]
    raw_document_keys = [row.get("s3_object_key") for row in documents]
    if any(not isinstance(key, str) or not key for key in raw_ticket_keys + raw_document_keys):
        raise ValueError("Invalid inventory key")
    ticket_keys = cast(list[str], raw_ticket_keys)
    document_keys = cast(list[str], raw_document_keys)
    if len(ticket_keys) != len(set(ticket_keys)) or len(document_keys) != len(set(document_keys)):
        raise ValueError("Duplicate inventory record keys")

    object_set, ticket_set, document_set = set(objects), set(ticket_keys), set(document_keys)
    destination_mismatch = sum(
        row.get("provider") != "supabase" or row.get("bucket") != "documents"
        for row in tickets if row.get("provider") is not None or row.get("bucket") is not None
    )
    counts = {
        "storage_metadata_rows": len(objects),
        "ticket_rows": len(tickets),
        "document_rows": len(documents),
        "unregistered_storage_objects": len(object_set - ticket_set - document_set),
        "documents_without_ticket": len(document_set - ticket_set),
        "documents_without_storage_row": len(document_set - object_set),
        "tickets_without_storage_row": len(ticket_set - object_set),
        "tickets_without_document": len(ticket_set - document_set),
        "legacy_tickets": sum(bool(row.get("legacy")) for row in tickets),
        "legacy_destination_unresolved": sum(
            bool(row.get("legacy")) and (not row.get("provider") or not row.get("bucket"))
            for row in tickets
        ),
        "ticket_destination_mismatch": destination_mismatch,
    }
    details = {
        "unregistered_storage_objects": sorted(object_set - ticket_set - document_set),
        "documents_without_ticket": sorted(document_set - ticket_set),
        "documents_without_storage_row": sorted(document_set - object_set),
        "tickets_without_storage_row": sorted(ticket_set - object_set),
        "tickets_without_document": sorted(ticket_set - document_set),
        "legacy_destination_unresolved": sorted(
            row["object_key"] for row in tickets
            if row.get("legacy") and (not row.get("provider") or not row.get("bucket"))
        ),
        "ticket_destination_mismatch": sorted(
            row["object_key"] for row in tickets
            if (row.get("provider") is not None or row.get("bucket") is not None)
            and (row.get("provider") != "supabase" or row.get("bucket") != "documents")
        ),
    }
    return counts, details


async def _all_pages(client: Any, rpc: str, key: str, max_rows: int, *, documents: bool = False) -> list[Any]:
    result: list[Any] = []
    cursor = None
    while len(result) < max_rows:
        limit = min(PAGE_SIZE, max_rows - len(result))
        if documents:
            query = client.table("documents").select("id,s3_object_key").order("id")
            if cursor is not None:
                query = query.gt("id", cursor)
            page = await supabase_session.execute(query.limit(limit))
        else:
            page = await supabase_session.execute(client.rpc(rpc, {"p_limit": limit, key: cursor}))
        rows = page.data
        if not isinstance(rows, list) or len(rows) > limit:
            raise ValueError("Invalid inventory page")
        if not rows:
            return result
        next_cursor = rows[-1].get("id" if documents else ("name" if rpc == "list_document_storage_objects" else "object_key"))
        if not isinstance(next_cursor, str) or (cursor is not None and next_cursor <= cursor):
            raise ValueError("Invalid inventory cursor")
        result.extend(rows)
        cursor = next_cursor
    # A full last page may hide more rows; request one row to detect truncation.
    if len(result) == max_rows:
        if documents:
            query = client.table("documents").select("id").order("id").gt("id", cursor)
            page = await supabase_session.execute(query.limit(1))
        else:
            page = await supabase_session.execute(client.rpc(rpc, {"p_limit": 1, key: cursor}))
        if not isinstance(page.data, list) or len(page.data) > 1:
            raise ValueError("Invalid inventory page")
        if page.data:
            raise ValueError("Inventory row limit exceeded")
    return result


async def run(max_rows: int) -> tuple[dict[str, Any], dict[str, Any]]:
    if settings.APP_ENV != "staging" or settings.SUPABASE_PROJECT_REF != STAGING_PROJECT_REF:
        raise RuntimeError("Inventory is restricted to the pinned staging project")
    client = supabase_session.require_client()
    objects = await _all_pages(client, "list_document_storage_objects", "p_after_name", max_rows)
    tickets = await _all_pages(client, "list_upload_object_inventory", "p_after_object_key", max_rows)
    documents = await _all_pages(client, "", "", max_rows, documents=True)
    return reconcile([row["name"] for row in objects], tickets, documents)


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-rows", type=int, default=10_000, help="maximum rows per source (1-100000)")
    parser.add_argument("--report", type=Path, help="write complete unresolved exact keys to a new mode-0600 JSON file")
    args = parser.parse_args()
    if not 1 <= args.max_rows <= MAX_ROWS:
        parser.error("--max-rows must be between 1 and 100000")
    try:
        counts, details = await run(args.max_rows)
        if args.report:
            write_report(args.report, counts, details)
    except Exception as exc:  # noqa: BLE001 - operator boundary; never print provider data
        logging.error("Storage inventory failed (%s); no complete report produced", type(exc).__name__)
        return 1
    print(" ".join(f"{key}={value}" for key, value in counts.items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
