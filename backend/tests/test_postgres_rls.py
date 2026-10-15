"""Real PostgreSQL policy/RPC checks; enabled only for a dedicated loopback DB.

Requires psql and PostgreSQL with pgvector. No hosted Supabase connection is used.
"""

import importlib.util
import json
import os
import shutil
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest

ROOT = Path(__file__).parents[2]
spec = importlib.util.spec_from_file_location("local_only", ROOT / "scripts/testing/local_only.py")
local_only = importlib.util.module_from_spec(spec)
spec.loader.exec_module(local_only)


@pytest.fixture(scope="module")
def database():
    url = os.environ.get("LOCAL_TEST_DATABASE_URL")
    if not url:
        if os.environ.get("REQUIRE_PG_INTEGRATION") == "1":
            pytest.fail("REQUIRE_PG_INTEGRATION=1 but LOCAL_TEST_DATABASE_URL is not set")
        pytest.skip("Set LOCAL_TEST_DATABASE_URL for dedicated local PostgreSQL integration")
    local_only.require_loopback_url(url, ("postgres", "postgresql"))
    from urllib.parse import urlsplit
    if urlsplit(url).path != "/momo_security_test":
        pytest.fail("Integration resets schemas: database must be named momo_security_test")
    psql = shutil.which("psql")
    if not psql:
        pytest.fail("psql is required for PostgreSQL integration")

    def sql(statement, success=True, role=None):
        statement = "SET search_path=public,extensions; " + statement
        if role:
            assert role in {"anon", "authenticated", "service_role", "supabase_auth_admin"}
            statement = f"SET ROLE {role}; " + statement
        result = subprocess.run(
            [psql, "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "--dbname", url],
            input=statement, text=True, capture_output=True, timeout=30, check=False,
            env={key: value for key, value in os.environ.items() if not key.startswith("PG")},
        )
        if success:
            assert result.returncode == 0, result.stderr
        else:
            assert result.returncode != 0, "Expected database authorization/constraint rejection"
        return result.stdout.strip()

    sql("""
        DROP SCHEMA IF EXISTS public CASCADE;
        DROP SCHEMA IF EXISTS extensions CASCADE;
        DROP SCHEMA IF EXISTS auth CASCADE;
        DROP SCHEMA IF EXISTS storage CASCADE;
        DROP SCHEMA IF EXISTS internal CASCADE;
        CREATE SCHEMA public;
        CREATE SCHEMA auth;
        CREATE SCHEMA storage;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
        END $$;
        CREATE TABLE auth.users(
            id uuid PRIMARY KEY,
            email text,
            raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
            raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
        );
        GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
        GRANT SELECT,INSERT,UPDATE,DELETE ON auth.users TO supabase_auth_admin;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
          SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
            nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
        $$;
        GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
        GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
        CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,
            file_size_limit bigint,allowed_mime_types text[]);
        CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            bucket_id text NOT NULL,name text NOT NULL);
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
        GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
        GRANT ALL ON storage.objects,storage.buckets TO service_role;
        GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
        CREATE POLICY legacy_permissive_objects ON storage.objects FOR ALL
            TO anon,authenticated USING (true) WITH CHECK (true);
    """)
    for path in sorted((ROOT / "backend/migrations").glob("*.sql")):
        if path.name == "002_tenant_security.sql":
            # Seed an old Auth identity before tenant FKs and profile provisioning exist.
            sql(
                "INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data) "
                "VALUES ('00000000-0000-4000-8000-000000000014',"
                "'existing-google@example.test',"
                "'{\"provider\":\"google\",\"providers\":[\"google\"]}',"
                "'{\"full_name\":\"Existing Learner\"}');",
                role="supabase_auth_admin",
            )
        if path.name == "012_upload_tickets.sql":
            # This pre-ticket document verifies the legacy destination migration.
            sql("""
                INSERT INTO public.documents(id,user_id,original_filename,file_type,mime_type,file_size,
                    s3_object_key,uploaded_at,expires_at,processing_status)
                VALUES ('00000000-0000-4000-8000-000000000015',
                    '00000000-0000-4000-8000-000000000014','legacy.txt','txt','text/plain',64,
                    'documents/00000000-0000-4000-8000-000000000014/00000000-0000-4000-8000-000000000015/original.txt',
                    now()-interval '96 hours',now()-interval '24 hours','EXPIRED');
            """)
        sql(path.read_text())
    sql("NOTIFY pgrst, 'reload schema';")
    return sql


@pytest.fixture
def users(database):
    alice, bob = str(uuid4()), str(uuid4())
    database(f"INSERT INTO auth.users(id,email) VALUES ('{alice}','alice-{alice}@test.local'), ('{bob}','bob-{bob}@test.local');")
    return alice, bob


def authenticated(user_id, statement):
    return f"BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='{user_id}'; {statement}; ROLLBACK;"


def document(user_id, document_id=None):
    doc_id = document_id or str(uuid4())
    uploaded_at = datetime.now(UTC)
    return {"id": doc_id, "user_id": user_id, "original_filename": "notes.txt",
            "file_type": "txt", "mime_type": "text/plain", "file_size": 100,
            "s3_object_key": f"documents/{user_id}/{doc_id}/original.txt",
            "uploaded_at": uploaded_at.isoformat(),
            "expires_at": (uploaded_at + timedelta(hours=72)).isoformat()}


def register_sql(payload):
    """Issue one durable synthetic ticket before exercising real registration.

    The advisory lock makes concurrent fixture issuance idempotent without
    weakening the production RPC's refusal to reissue an existing object path.
    PERFORM keeps stdout limited to the final registration JSON.
    """
    ticket = {"id": payload["id"], "user_id": payload["user_id"],
              "object_key": payload["s3_object_key"], "file_type": payload["file_type"],
              "mime_type": payload["mime_type"], "file_size": payload["file_size"],
              "provider": "supabase", "bucket": "study-documents",
              "signed_until": (datetime.now(UTC) + timedelta(hours=1)).isoformat()}
    ticket_json = json.dumps(ticket)
    document_json = json.dumps(payload)
    return (
        "DO $fixture$ BEGIN "
        f"PERFORM pg_advisory_xact_lock(hashtextextended('{payload['id']}',0)); "
        f"IF NOT EXISTS (SELECT 1 FROM internal.upload_tickets WHERE id='{payload['id']}') THEN "
        f"PERFORM public.issue_upload_ticket($ticket${ticket_json}$ticket$::jsonb); "
        "END IF; END $fixture$; "
        f"SELECT public.register_document($document${document_json}$document$::jsonb,10);"
    )


def sync_sql(user_id, events):
    return f"SELECT public.process_sync_batch('{user_id}', '{json.dumps(events)}'::jsonb);"


def seed_sets(database, users):
    alice, bob = users
    a, b = str(uuid4()), str(uuid4())
    database(f"INSERT INTO study_sets(id,user_id,title) VALUES ('{a}','{alice}','Alice private'),('{b}','{bob}','Bob private');")
    return a, b


def seed_generation_job(database, user_id):
    source = document(user_id)
    database(register_sql(source), role="service_role")
    job_id = str(uuid4())
    database(f"INSERT INTO generation_jobs(id,user_id,document_id,status) VALUES ('{job_id}','{user_id}','{source['id']}','PROCESSING');", role="service_role")
    return job_id, source["id"]


def finalization_sql(job_id, owner_id, source_id, items=None, set_data=None):
    payload = set_data or {"id": str(uuid4()), "title": "Grounded reviewer",
                           "document_id": source_id, "generation_config": {"source_only": True}}
    generated = items if items is not None else [
        {"type": "flashcard", "question": "Q1", "answer": "A1", "difficulty": "medium",
         "source_metadata": {"document_id": source_id, "page": 1}},
        {"type": "flashcard", "question": "Q2", "answer": "A2", "difficulty": "easy",
         "source_metadata": {"document_id": source_id, "page": 2}},
    ]
    return f"SELECT persist_generated_study_set('{job_id}','{owner_id}','{json.dumps(payload)}'::jsonb,'{json.dumps(generated)}'::jsonb);"


def test_rls_covers_every_application_table(database):
    tables = database("SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;")
    assert tables == "", f"Unprotected application tables: {tables}"


def test_internal_tables_are_forced_rls_and_service_role_only(database):
    expected = "background_jobs,folder_requests,generation_requests,rate_limit_events,upload_tickets"
    tables = database("""
        SELECT string_agg(c.relname, ',' ORDER BY c.relname)
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='internal' AND c.relkind IN ('r','p');
    """)
    assert tables == expected, f"Unexpected internal tables: {tables}"

    violations = database("""
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='internal' AND c.relkind IN ('r','p') AND (
          NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR
          has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
          has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
          NOT has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        ) ORDER BY c.relname;
    """)
    assert violations == "", f"Unexpected internal table security: {violations}"
    assert database("""
        SELECT has_schema_privilege('anon','internal','USAGE')::text || '|' ||
            has_schema_privilege('authenticated','internal','USAGE')::text || '|' ||
            has_schema_privilege('service_role','internal','USAGE')::text;
    """) == "false|false|true"

    for role in ("anon", "authenticated"):
        database("SELECT * FROM internal.background_jobs LIMIT 0;", success=False, role=role)
        database("INSERT INTO internal.background_jobs(user_id,kind,subject_id) "
                 "VALUES (gen_random_uuid(),'study_generation',gen_random_uuid());",
                 success=False, role=role)


def test_two_user_read_isolation_and_anonymous_denial(database, users):
    a, _ = seed_sets(database, users)
    alice, bob = users
    assert database(authenticated(alice, f"SELECT count(*) FROM study_sets WHERE id='{a}'")) == "1"
    assert database(authenticated(bob, f"SELECT count(*) FROM study_sets WHERE id='{a}'")) == "0"
    database("BEGIN; SET LOCAL ROLE anon; SELECT * FROM study_sets; ROLLBACK;", success=False)


def test_authenticated_clients_cannot_write_or_call_elevated_rpcs(database, users):
    alice, _ = users
    database(authenticated(alice, f"INSERT INTO study_sets(user_id,title) VALUES ('{alice}','forged')"), success=False)
    database(authenticated(alice, register_sql(document(alice))), success=False)


def test_cross_tenant_parent_links_rejected_even_for_backend_role(database, users):
    a, _ = seed_sets(database, users)
    _, bob = users
    database(f"INSERT INTO study_sessions(user_id,study_set_id,mode) VALUES ('{bob}','{a}','quiz');", success=False, role="service_role")
    doc = document(users[0])
    database(register_sql(doc))
    database(f"INSERT INTO document_chunks(document_id,user_id,chunk_index,content) VALUES ('{doc['id']}','{bob}',0,'stolen');", success=False, role="service_role")


def test_document_deletion_preserves_generated_material(database, users):
    alice, _ = users
    doc = document(alice)
    database(register_sql(doc))
    set_id = str(uuid4())
    database(f"INSERT INTO study_sets(id,user_id,document_id,title) VALUES ('{set_id}','{alice}','{doc['id']}','Persistent'); INSERT INTO study_items(study_set_id,type,question,answer) VALUES ('{set_id}','flashcard','Q','A'); DELETE FROM documents WHERE id='{doc['id']}';")
    assert database(f"SELECT document_id IS NULL FROM study_sets WHERE id='{set_id}';") == "t"
    assert database(f"SELECT count(*) FROM study_items WHERE study_set_id='{set_id}';") == "1"


def test_atomic_quota_survives_concurrent_registration_and_retries(database, users):
    alice, _ = users
    payloads = [document(alice) for _ in range(20)]

    def attempt(payload):
        try:
            database(register_sql(payload), role="service_role")
            return True
        except AssertionError as exc:
            assert "MONTHLY_DOCUMENT_LIMIT" in str(exc)
            return False

    with ThreadPoolExecutor(max_workers=12) as executor:
        outcomes = list(executor.map(attempt, payloads))
    assert sum(outcomes) == 10
    assert database(f"SELECT documents_count FROM usage_records WHERE user_id='{alice}';") == "10"
    accepted = payloads[outcomes.index(True)]
    database(register_sql(accepted))
    assert database(f"SELECT documents_count FROM usage_records WHERE user_id='{alice}';") == "10"


def test_profiles_and_derived_item_ownership_are_tenant_scoped(database, users):
    alice, bob = users
    a, _ = seed_sets(database, users)
    item_id = str(uuid4())
    database(f"INSERT INTO users(id,email) VALUES ('{alice}','profile-{alice}@test.local'); INSERT INTO study_items(id,study_set_id,type,question,answer) VALUES ('{item_id}','{a}','flashcard','Q','A');")
    assert database(f"SELECT user_id FROM study_items WHERE id='{item_id}';") == alice
    assert database(authenticated(alice, f"SELECT count(*) FROM users WHERE id='{alice}'")) == "1"
    assert database(authenticated(bob, f"SELECT count(*) FROM users WHERE id='{alice}'")) == "0"
    assert database(authenticated(bob, f"SELECT count(*) FROM study_items WHERE id='{item_id}'")) == "0"


def test_google_auth_identity_provisions_and_updates_profile_then_cascades(database):
    user_id = str(uuid4())
    provider = "'" + json.dumps({"provider": "google", "providers": ["google"]}).replace("'", "''") + "'::jsonb"
    profile = "'" + json.dumps({
        "full_name": "  Ada O'Neil  ",
        "name": "Ignored Fallback",
        "picture": "https://lh3.googleusercontent.com/a/initial",
    }).replace("'", "''") + "'::jsonb"
    database(
        f"INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data) "
        f"VALUES ('{user_id}','ada@example.test',{provider},{profile});",
        role="supabase_auth_admin",
    )
    assert database(
        f"SELECT email||'|'||full_name||'|'||avatar_url FROM public.users WHERE id='{user_id}';"
    ) == "ada@example.test|Ada O'Neil|https://lh3.googleusercontent.com/a/initial"

    updated = "'" + json.dumps({
        "full_name": "Ada Learner",
        "picture": "https://profile.example.test/avatar.png",
    }).replace("'", "''") + "'::jsonb"
    database(
        f"UPDATE auth.users SET email='ada.updated@example.test',raw_user_meta_data={updated} "
        f"WHERE id='{user_id}';",
        role="supabase_auth_admin",
    )
    assert database(
        f"SELECT email||'|'||full_name||'|'||coalesce(avatar_url,'<null>') "
        f"FROM public.users WHERE id='{user_id}';"
    ) == "ada.updated@example.test|Ada Learner|<null>"

    database(f"DELETE FROM auth.users WHERE id='{user_id}';", role="supabase_auth_admin")
    assert database(f"SELECT count(*) FROM public.users WHERE id='{user_id}';") == "0"


def test_google_auth_profile_migration_backfills_existing_identity(database):
    assert database(
        "SELECT email||'|'||full_name FROM public.users "
        "WHERE id='00000000-0000-4000-8000-000000000014';"
    ) == "existing-google@example.test|Existing Learner"


def test_verified_legacy_storage_destination_is_queued_on_account_deletion(database):
    user_id = "00000000-0000-4000-8000-000000000014"
    document_id = "00000000-0000-4000-8000-000000000015"
    assert database(
        f"SELECT provider||'|'||bucket||'|'||legacy::text FROM internal.upload_tickets WHERE id='{document_id}';",
        role="service_role",
    ) == "supabase|documents|true"
    assert database(
        "SELECT indexdef LIKE '%WHERE (legacy AND (status = ''retired''::text))%' "
        "FROM pg_indexes WHERE schemaname='internal' AND indexname='upload_tickets_legacy_cleanup_idx';"
    ) == "t"
    assert database(
        "SELECT count(*) FROM claim_upload_cleanup(100,'supabase','documents');",
        role="service_role",
    ) == "0"
    database(f"DELETE FROM auth.users WHERE id='{user_id}';")
    assert database(f"SELECT count(*) FROM public.documents WHERE id='{document_id}';") == "0"
    claims = [json.loads(line) for line in database(
        "SELECT claim_upload_cleanup(100,'supabase','documents');", role="service_role"
    ).splitlines() if line]
    claim = next(row for row in claims if row["id"] == document_id)
    assert claim["status"] == "retired" and claim["auth_ref"] is None


def test_non_google_or_email_less_auth_identity_does_not_create_profile(database):
    password_user = str(uuid4())
    google_without_email = str(uuid4())
    password_metadata = "'" + json.dumps({"provider": "email", "providers": ["email"]}) + "'::jsonb"
    google_metadata = "'" + json.dumps({"provider": "google", "providers": ["google"]}) + "'::jsonb"
    database(
        f"INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES "
        f"('{password_user}','password@example.test',{password_metadata}),"
        f"('{google_without_email}',NULL,{google_metadata});",
        role="supabase_auth_admin",
    )
    assert database(
        f"SELECT count(*) FROM public.users WHERE id IN ('{password_user}','{google_without_email}');"
    ) == "0"


def test_profile_email_collision_never_associates_another_auth_identity(database):
    first_user, second_user = str(uuid4()), str(uuid4())
    google_metadata = "'" + json.dumps({"provider": "google", "providers": ["google"]}) + "'::jsonb"
    database(
        f"INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES "
        f"('{first_user}','collision@example.test',{google_metadata}),"
        f"('{second_user}','collision@example.test',{google_metadata});",
        role="supabase_auth_admin",
    )
    assert database(
        "SELECT id::text FROM public.users WHERE email='collision@example.test';"
    ) == first_user


def test_sync_is_owner_scoped_idempotent_and_preserves_original_event(database, users):
    alice, bob = users
    alice_set, bob_set = seed_sets(database, users)
    item_id = database(f"INSERT INTO study_items(study_set_id,type,question,answer) VALUES ('{alice_set}','flashcard','Q','A') RETURNING id;")
    bob_item_id = database(f"INSERT INTO study_items(study_set_id,type,question,answer) VALUES ('{bob_set}','flashcard','Q','A') RETURNING id;")
    event_id = str(uuid4())
    event = {"event_id": event_id, "study_item_id": item_id, "result": "correct", "occurred_at": "2026-10-06T00:00:00Z"}
    first = json.loads(database(sync_sql(alice, [event, event])))
    assert first["accepted_count"] == 1 and first["ignored_duplicates_count"] == 1
    replay = {**event, "result": "incorrect"}
    assert json.loads(database(sync_sql(alice, [replay])))["accepted_count"] == 0
    assert database(f"SELECT result FROM sync_events WHERE user_id='{alice}' AND event_id='{event_id}';") == "correct"
    assert json.loads(database(sync_sql(bob, [{**event, "study_item_id": bob_item_id}])))["accepted_count"] == 1
    assert database(f"SELECT count(*) FROM learning_events WHERE user_id='{alice}';") == "1"


def test_sync_rejects_cross_tenant_missing_and_mismatched_references_atomically(database, users):
    alice, bob = users
    a, _ = seed_sets(database, users)
    item_id, session_id = str(uuid4()), str(uuid4())
    other_set = str(uuid4())
    database(f"INSERT INTO study_items(id,study_set_id,type,question,answer) VALUES ('{item_id}','{a}','flashcard','Q','A'); INSERT INTO study_sets(id,user_id,title) VALUES ('{other_set}','{alice}','Other'); INSERT INTO study_sessions(id,user_id,study_set_id,mode) VALUES ('{session_id}','{alice}','{other_set}','quiz');")
    event = {"event_id": str(uuid4()), "result": "incorrect", "occurred_at": "2026-10-06T00:00:00Z"}
    for owner, invalid in [
        (bob, {**event, "study_item_id": item_id}),
        (alice, {**event, "study_item_id": str(uuid4())}),
        (alice, {**event, "study_item_id": item_id, "study_session_id": session_id}),
    ]:
        database(sync_sql(owner, [event, invalid]), success=False)
        assert database(f"SELECT count(*) FROM sync_events WHERE event_id='{event['event_id']}';") == "0"
    database(sync_sql(alice, [event] * 101), success=False)
    database("BEGIN; SET LOCAL ROLE anon; " + sync_sql(alice, [event]) + " ROLLBACK;", success=False)


def test_registration_validation_rolls_back_quota_and_hides_foreign_retries(database, users):
    alice, bob = users
    invalid = {**document(alice), "file_size": 15728641}
    database(register_sql(invalid), success=False)
    assert database(f"SELECT count(*) FROM usage_records WHERE user_id='{alice}';") == "0"
    valid = document(alice)
    database(register_sql(valid))
    database(register_sql({**valid, "user_id": bob}), success=False)
    database("SELECT register_document('" + json.dumps(document(bob)) + "'::jsonb,NULL);", success=False)
    assert database(f"SELECT count(*) FROM usage_records WHERE user_id='{bob}';") == "0"


def test_rag_query_is_bounded_filters_tenants_and_expired_sources(database, users):
    alice, bob = users
    own, foreign = document(alice), document(bob)
    database(register_sql(own))
    database(register_sql(foreign))
    database(f"UPDATE documents SET processing_status='READY' WHERE id IN ('{own['id']}','{foreign['id']}');")
    vector = "[" + ",".join(["1"] + ["0"] * 1535) + "]"
    for owner, source in [(alice, own), (bob, foreign)]:
        database(f"INSERT INTO document_chunks(document_id,user_id,chunk_index,content,section,embedding) SELECT '{source['id']}','{owner}',n,'Evidence','Biology','{vector}'::vector FROM generate_series(0,59) n;")
    query = f"SELECT count(*) FROM match_document_chunks('{alice}','{vector}'::vector,NULL,999,NULL);"
    assert database(query) == "50"
    assert database(f"SELECT count(*) FROM match_document_chunks('{alice}','{vector}'::vector,'{foreign['id']}',10,NULL);") == "0"
    assert database(f"SELECT count(*) FROM match_document_chunks('{alice}','{vector}'::vector,NULL,10,ARRAY['Chemistry']);") == "0"
    # Move both lifecycle timestamps together to keep the 72-hour invariant.
    database(f"UPDATE documents SET uploaded_at=now()-interval '4 days',expires_at=now()-interval '1 day' WHERE id='{own['id']}';")
    assert database(query) == "0"


def test_owner_listing_query_can_use_covering_order_index(database, users):
    alice, _ = users
    seed_sets(database, users)
    plan = database(f"BEGIN; SET LOCAL enable_seqscan=off; EXPLAIN (FORMAT JSON) SELECT id,title FROM study_sets WHERE user_id='{alice}' ORDER BY created_at DESC,id LIMIT 50; ROLLBACK;")
    assert "study_sets_owner_created_idx" in plan


def test_all_application_grants_are_select_only_for_users_and_deny_anonymous(database):
    violations = database("""
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND (
          NOT has_table_privilege('authenticated',c.oid,'SELECT') OR
          has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
          has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        );
    """)
    assert violations == "", f"Unexpected client grants: {violations}"
    policies = database("SELECT tablename FROM pg_policies WHERE schemaname='public' AND (cmd <> 'SELECT' OR roles::text <> '{authenticated}');")
    assert policies == "", f"Unexpected client policies: {policies}"


def test_storage_restrictive_boundaries_hold_despite_existing_broad_policies(database, users):
    alice, bob = users
    key = f"documents/{alice}/{uuid4()}/original.txt"
    database(f"INSERT INTO storage.objects(bucket_id,name) VALUES ('documents','{key}');")
    assert database("SELECT public,file_size_limit,array_length(allowed_mime_types,1) FROM storage.buckets WHERE id='documents';") == "f|15728640|4"
    assert database(authenticated(alice, f"SELECT count(*) FROM storage.objects WHERE name='{key}'")) == "1"
    assert database(authenticated(bob, f"SELECT count(*) FROM storage.objects WHERE name='{key}'")) == "0"
    assert database("SELECT count(*) FROM storage.objects WHERE bucket_id='documents';", role="anon") == "0"
    database(authenticated(alice, f"INSERT INTO storage.objects(bucket_id,name) VALUES ('documents','{key}')"), success=False)
    database(authenticated(alice, f"UPDATE storage.objects SET name='stolen' WHERE name='{key}'; DELETE FROM storage.objects WHERE name='{key}'"))
    assert database(f"SELECT count(*) FROM storage.objects WHERE name='{key}';") == "1"
    # Existing policies on unrelated buckets must remain usable.
    database(authenticated(alice, "INSERT INTO storage.objects(bucket_id,name) VALUES ('avatars','avatar.png')"))


def test_aggregate_queries_return_owner_scoped_exact_counts_and_dates(database, users):
    alice, bob = users
    a, _ = seed_sets(database, users)
    folder_id = str(uuid4())
    database(f"INSERT INTO folders(id,user_id,name) VALUES ('{folder_id}','{alice}','Biology'); UPDATE study_sets SET folder_id='{folder_id}' WHERE id='{a}';")
    assert database(f"SELECT reviewer_count FROM list_folders_with_counts('{alice}',100,0) WHERE id='{folder_id}';", role="service_role") == "1"
    assert database(f"SELECT count(*) FROM list_folders_with_counts('{bob}',100,0) WHERE id='{folder_id}';", role="service_role") == "0"
    event = {"event_id": str(uuid4()), "result": "incorrect", "occurred_at": "2026-10-06T00:00:00Z"}
    database(sync_sql(alice, [event]), role="service_role")
    database(sync_sql(alice, [event]), role="service_role")
    assert database(f"SELECT count(*) FROM learning_events WHERE user_id='{alice}';") == "1"
    assert "2026-10-06" in database(f"SELECT * FROM activity_dates('{alice}');", role="service_role")
    assert database(f"SELECT count(*) FROM activity_dates('{bob}');", role="service_role") == "0"


def test_rpcs_have_fixed_search_paths_and_no_public_execution(database):
    violations = database("""
        SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname IN (
          'register_document','process_sync_batch','match_document_chunks','match_document_chunks_v2',
          'publish_document_index_v2','reindex_document_chunk_embeddings_v2','finalize_document_embedding_v2',
          'list_folders_with_counts','learning_statistics','activity_dates','persist_generated_study_set')
        AND (p.proconfig IS NULL OR NOT 'search_path=pg_catalog, public'=ANY(p.proconfig)
          OR has_function_privilege('anon',p.oid,'EXECUTE')
          OR has_function_privilege('authenticated',p.oid,'EXECUTE')
          OR NOT has_function_privilege('service_role',p.oid,'EXECUTE'));
    """)
    assert violations == "", f"Unexpected RPC privileges/search path: {violations}"


def test_concurrent_generation_finalization_returns_one_persistent_study_set(database, users):
    alice, _ = users
    job_id, source_id = seed_generation_job(database, alice)

    def finalize(_):
        return json.loads(database(finalization_sql(job_id, alice, source_id), role="service_role"))

    with ThreadPoolExecutor(max_workers=8) as executor:
        completed = list(executor.map(finalize, range(12)))
    persisted_ids = {result["id"] for result in completed}
    assert len(persisted_ids) == 1
    set_id = persisted_ids.pop()
    assert database(f"SELECT count(*) FROM study_sets WHERE user_id='{alice}';") == "1"
    assert database(f"SELECT count(*) FROM study_items WHERE study_set_id='{set_id}';") == "2"
    assert database(f"SELECT status,progress,study_set_id FROM generation_jobs WHERE id='{job_id}';") == f"COMPLETED|100|{set_id}"
    # A resumed worker creates fresh payload IDs, but must reuse the committed set.
    replay = json.loads(database(finalization_sql(job_id, alice, source_id), role="service_role"))
    assert replay["id"] == set_id


def test_invalid_generated_item_rolls_back_set_items_and_job_completion(database, users):
    alice, _ = users
    job_id, source_id = seed_generation_job(database, alice)
    valid_item = {"type": "flashcard", "question": "Q", "answer": "A",
                  "source_metadata": {"document_id": source_id, "page": 1}}
    invalid_item = {**valid_item, "difficulty": "invalid-difficulty"}
    database(finalization_sql(job_id, alice, source_id, [valid_item, invalid_item]),
             role="service_role", success=False)
    assert database(f"SELECT count(*) FROM study_sets WHERE user_id='{alice}';") == "0"
    assert database(f"SELECT count(*) FROM study_items WHERE user_id='{alice}';") == "0"
    assert database(f"SELECT status,progress,study_set_id IS NULL FROM generation_jobs WHERE id='{job_id}';") == "PROCESSING|0|t"
    # A clean retry after a failed transaction succeeds without orphan sets.
    result = json.loads(database(finalization_sql(job_id, alice, source_id), role="service_role"))
    assert result["item_count"] == 2


def test_generation_finalization_rejects_foreign_owner_and_owner_injection(database, users):
    alice, bob = users
    job_id, source_id = seed_generation_job(database, alice)
    database(finalization_sql(job_id, bob, source_id), role="service_role", success=False)
    forged_set = {"id": str(uuid4()), "user_id": bob, "document_id": source_id, "title": "Forged"}
    database(finalization_sql(job_id, alice, source_id, set_data=forged_set),
             role="service_role", success=False)
    foreign_source = document(bob)
    database(register_sql(foreign_source), role="service_role")
    database(finalization_sql(job_id, alice, foreign_source["id"]),
             role="service_role", success=False)
    assert database(f"SELECT count(*) FROM study_sets WHERE user_id IN ('{alice}','{bob}');") == "0"
    assert database(f"SELECT status FROM generation_jobs WHERE id='{job_id}';") == "PROCESSING"


def test_generation_finalization_rpc_denies_direct_client_execution(database, users):
    alice, _ = users
    job_id, source_id = seed_generation_job(database, alice)
    call = finalization_sql(job_id, alice, source_id)
    database(call, role="anon", success=False)
    database(authenticated(alice, call), success=False)
    assert database(f"SELECT count(*) FROM study_sets WHERE user_id='{alice}';") == "0"


@pytest.mark.parametrize("requests,concurrency", [(100, 8), (300, 16)], ids=["sql-load", "sql-stress"])
def test_bounded_postgres_reads_under_load(database, users, requests, concurrency):
    alice, bob = users
    a, _ = seed_sets(database, users)
    latencies = []
    started = time.perf_counter()

    def read(index):
        before = time.perf_counter()
        owner = alice if index % 2 == 0 else bob
        count = database(authenticated(owner, f"SELECT count(*) FROM study_sets WHERE id='{a}'"))
        assert count == ("1" if owner == alice else "0")
        latencies.append((time.perf_counter() - before) * 1000)

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(read, index) for index in range(requests)]
        for future in futures:
            future.result(timeout=30)
    elapsed = time.perf_counter() - started
    assert elapsed < 30
    print({"transport": "local-PostgreSQL-psql", "requests": requests,
           "concurrency": concurrency, "seconds": round(elapsed, 3),
           "requests_per_second": round(requests / elapsed),
           "p95_ms": round(sorted(latencies)[int(requests * 0.95) - 1], 3)})
