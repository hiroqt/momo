"""Local pgvector relocation preserves retrieval, dimension and owner isolation."""

from pathlib import Path

from test_postgres_rls import database as database
from test_postgres_rls import document, register_sql
from test_postgres_rls import users as users


def test_vector_is_private_and_dimension_preserved(database):
    assert (
        database(
            "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace=n.oid WHERE e.extname='vector';"
        )
        == "extensions"
    )
    assert (
        database(
            "SELECT format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid='public.document_chunks'::regclass AND attname='embedding';"
        )
        == "vector(1536)"
    )
    assert database("SELECT to_regtype('public.vector') IS NULL;") == "t"
    assert (
        database(
            "SELECT 'search_path=pg_catalog, public'=ANY(proconfig) FROM pg_proc WHERE oid='public.match_document_chunks(uuid,extensions.vector,uuid,integer,text[])'::regprocedure;"
        )
        == "t"
    )


def test_relocated_vector_rpc_keeps_service_only_grants(database):
    signature = (
        "public.match_document_chunks(uuid,extensions.vector,uuid,integer,text[])"
    )
    for role in ("anon", "authenticated"):
        assert (
            database(
                f"SELECT has_function_privilege('{role}','{signature}','EXECUTE');"
            )
            == "f"
        )
    assert (
        database(
            f"SELECT has_function_privilege('service_role','{signature}','EXECUTE');"
        )
        == "t"
    )


def test_relocated_cosine_retrieval_owned_expiry_filters_and_bound(database, users):
    alice, bob = users
    owned, foreign = document(alice), document(bob)
    expired = document(alice)
    for source in (owned, foreign, expired):
        database(register_sql(source), role="service_role")
    database(
        f"UPDATE public.documents SET uploaded_at=now()-interval '4 days',expires_at=now()-interval '1 day' WHERE id='{expired['id']}';"
    )
    vector = "[" + ",".join(["1"] + ["0"] * 1535) + "]"
    for source in (owned, foreign, expired):
        database(
            f"INSERT INTO public.document_chunks(document_id,user_id,chunk_index,content,section,embedding) SELECT '{source['id']}','{source['user_id']}',n,'Evidence','Biology','{vector}'::extensions.vector FROM generate_series(0,59) n;"
        )
    result = database(
        f"SELECT count(*),min(similarity),bool_and(user_id='{alice}') FROM public.match_document_chunks('{alice}','{vector}'::extensions.vector,NULL,999,NULL);",
        role="service_role",
    )
    assert result == "50|1|t"
    assert (
        database(
            f"SELECT count(*) FROM public.match_document_chunks('{alice}','{vector}'::extensions.vector,'{foreign['id']}',10,NULL);",
            role="service_role",
        )
        == "0"
    )
    assert (
        database(
            f"SELECT count(*) FROM public.match_document_chunks('{alice}','{vector}'::extensions.vector,'{expired['id']}',10,NULL);",
            role="service_role",
        )
        == "0"
    )
    assert (
        database(
            f"SELECT count(*) FROM public.match_document_chunks('{alice}','{vector}'::extensions.vector,NULL,10,ARRAY['Chemistry']);",
            role="service_role",
        )
        == "0"
    )


def test_relocation_reapplication_preserves_existing_embeddings(database, users):
    owner, _ = users
    source = document(owner)
    database(register_sql(source), role="service_role")
    vector = "[" + ",".join(["1"] + ["0"] * 1535) + "]"
    database(
        f"INSERT INTO public.document_chunks(document_id,user_id,chunk_index,content,embedding) VALUES ('{source['id']}','{owner}',0,'Existing evidence','{vector}'::extensions.vector);"
    )
    migration = Path(__file__).parents[1] / "migrations/004_vector_extension_schema.sql"
    database(migration.read_text())
    assert (
        database(
            f"SELECT count(*) FROM public.match_document_chunks('{owner}','{vector}'::extensions.vector,'{source['id']}',10,NULL);",
            role="service_role",
        )
        == "1"
    )
