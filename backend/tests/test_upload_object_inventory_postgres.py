"""RET-01 read-only inventory RPC checks on dedicated local PostgreSQL."""

import pytest
from test_postgres_rls import database as database


def test_inventory_rpcs_are_service_only_invokers_with_fixed_search_path(database):
    for name in ("list_document_storage_objects", "list_upload_object_inventory"):
        signature = f"public.{name}(integer,text)"
        for role in ("anon", "authenticated"):
            assert database(f"SELECT has_function_privilege('{role}','{signature}','EXECUTE');") == "f"
        assert database(f"SELECT has_function_privilege('service_role','{signature}','EXECUTE');") == "t"
        assert database(
            f"SELECT prosecdef::text||'|'||provolatile::text||'|'||"
            f"('search_path=pg_catalog, public'=ANY(proconfig))::text "
            f"FROM pg_proc WHERE oid='{signature}'::regprocedure;"
        ) == "false|s|true"


def test_document_storage_inventory_is_fixed_to_documents_bucket_and_keyset_paged(database):
    prefix = "ret-inventory-test/"
    database(
        "INSERT INTO storage.objects(bucket_id,name) VALUES "
        f"('documents','{prefix}a'),('documents','{prefix}b'),('avatars','{prefix}c');"
    )
    assert database(
        f"SELECT name FROM public.list_document_storage_objects(1,'{prefix}');",
        role="service_role",
    ) == f"{prefix}a"
    assert database(
        f"SELECT name FROM public.list_document_storage_objects(1,'{prefix}a');",
        role="service_role",
    ) == f"{prefix}b"
    assert database(
        f"SELECT count(*) FROM public.list_document_storage_objects(100,'{prefix}b');",
        role="service_role",
    ) == "0"


def test_upload_object_inventory_keyset_pages_exact_reconciliation_fields(database):
    owner = "00000000-0000-4000-8000-000000000099"
    ids = ["00000000-0000-4000-8000-000000000101", "00000000-0000-4000-8000-000000000102"]
    database(f"INSERT INTO auth.users(id,email) VALUES ('{owner}','inventory@test.local');")
    rows = []
    for ticket_id, provider, bucket, status, legacy in (
        (ids[0], "supabase", "documents", "registered", "false"),
        (ids[1], None, None, "retired", "true"),
    ):
        key = f"documents/{owner}/{ticket_id}/original.txt"
        provider_sql = "NULL" if provider is None else f"'{provider}'"
        bucket_sql = "NULL" if bucket is None else f"'{bucket}'"
        database(
            "INSERT INTO internal.upload_tickets(id,user_id,auth_ref,object_key,file_type,mime_type,file_size,"
            "signed_until,provider,bucket,status,legacy) VALUES "
            f"('{ticket_id}','{owner}','{owner}','{key}','txt','text/plain',100,now(),"
            f"{provider_sql},{bucket_sql},'{status}',{legacy});"
        )
        rows.append((key, provider or "", bucket or "", status, legacy))

    first_key, second_key = sorted(row[0] for row in rows)
    before_first = f"documents/{owner}/00000000-0000-4000-8000-000000000100/original.txt"
    page1 = database(
        "SELECT object_key||'|'||coalesce(provider,'')||'|'||coalesce(bucket,'')||'|'||status||'|'||legacy "
        f"FROM public.list_upload_object_inventory(1,'{before_first}');",
        role="service_role",
    )
    page2 = database(
        "SELECT object_key||'|'||coalesce(provider,'')||'|'||coalesce(bucket,'')||'|'||status||'|'||legacy "
        f"FROM public.list_upload_object_inventory(1,'{first_key}');",
        role="service_role",
    )
    expected1 = next(row for row in rows if row[0] == first_key)
    expected2 = next(row for row in rows if row[0] == second_key)
    assert page1 == "|".join(expected1)
    assert page2 == "|".join(expected2)


@pytest.mark.parametrize("page_size", (0, 101, -1))
def test_upload_object_inventory_rejects_unbounded_page_sizes(database, page_size):
    database(
        f"SELECT * FROM public.list_upload_object_inventory({page_size},NULL);",
        role="service_role",
        success=False,
    )
    database(
        f"SELECT * FROM public.list_document_storage_objects({page_size},NULL);",
        role="service_role",
        success=False,
    )


def test_upload_object_inventory_does_not_write_tickets(database):
    before = database("SELECT count(*) FROM internal.upload_tickets;")
    database("SELECT * FROM public.list_upload_object_inventory(100,NULL);", role="service_role")
    assert database("SELECT count(*) FROM internal.upload_tickets;") == before


def test_document_storage_inventory_does_not_write_objects(database):
    before = database("SELECT count(*) FROM storage.objects;")
    database("SELECT * FROM public.list_document_storage_objects(100,NULL);", role="service_role")
    assert database("SELECT count(*) FROM storage.objects;") == before


def test_inventory_rpcs_reject_null_page_size(database):
    database("SELECT * FROM public.list_upload_object_inventory(NULL,NULL);", role="service_role", success=False)
    database("SELECT * FROM public.list_document_storage_objects(NULL,NULL);", role="service_role", success=False)
