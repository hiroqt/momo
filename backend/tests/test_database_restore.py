"""Synthetic local backup/restore drill into an exclusively created database.

Database roles/extension binaries share the disposable PostgreSQL cluster. This
is not a managed backup/new-cluster/RPO/RTO or application rollback qualification.
"""
import os
import shutil
import subprocess
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

from test_postgres_rls import authenticated, finalization_sql, seed_generation_job
from test_postgres_rls import database as database
from test_postgres_rls import users as users


def test_backup_restore_preserves_generated_material_and_owner_security(database, users, tmp_path):
    owner, foreign = users
    generation, source = seed_generation_job(database, owner)
    database(finalization_sql(generation, owner, source), role="service_role")
    set_id = database(f"SELECT study_set_id FROM generation_jobs WHERE id='{generation}';")
    # Expiration stays historical across restore, never reset to the restore time.
    database(f"UPDATE documents SET uploaded_at=now()-interval '4 days', expires_at=now()-interval '1 day', processing_status='EXPIRED' WHERE id='{source}';", role="service_role")
    expiry = database(f"SELECT expires_at::text FROM documents WHERE id='{source}';")
    source_url = os.environ["LOCAL_TEST_DATABASE_URL"]
    parsed = urlsplit(source_url)
    assert parsed.hostname in {"127.0.0.1", "::1"} and parsed.path == "/momo_security_test"
    assert not parsed.query and not parsed.fragment
    target_name = "momo_security_restore_" + uuid4().hex
    target_url = urlunsplit(parsed._replace(path="/" + target_name))
    archive = tmp_path / "synthetic-backup.dump"
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
    tools = {name: shutil.which(name) for name in ["psql", "pg_dump", "pg_restore"]}
    assert all(tools.values()), "psql/pg_dump/pg_restore are required"

    def command(name, args, input=None):
        result = subprocess.run([tools[name], *args], input=input, capture_output=True,
                                text=True, timeout=30, env=env)
        assert result.returncode == 0, result.stderr
        return result.stdout.strip()

    def restored(statement, success=True):
        result = subprocess.run([tools["psql"], "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "--dbname", target_url],
                                input="SET search_path=public,extensions; " + statement,
                                capture_output=True, text=True, timeout=10, env=env)
        assert (result.returncode == 0) == success, result.stderr
        return result.stdout.strip()

    # Exclusive CREATE fails if a target exists; do not reset/overwrite it.
    database(f'CREATE DATABASE "{target_name}";')
    try:
        archive.touch(mode=0o600, exist_ok=False)
        command("pg_dump", ["--dbname", source_url, "--format=custom", "--no-owner", "--file", str(archive)])
        command("pg_restore", ["--dbname", target_url, "--clean", "--if-exists", "--no-owner", "--exit-on-error", str(archive)])
        assert restored(f"SELECT status||'|'||study_set_id FROM generation_jobs WHERE id='{generation}';") == f"COMPLETED|{set_id}"
        assert restored(authenticated(owner, f"SELECT count(*) FROM study_sets WHERE id='{set_id}'")) == "1"
        assert restored(authenticated(owner, f"SELECT count(*) FROM study_items WHERE study_set_id='{set_id}'")) == "2"
        assert restored(authenticated(foreign, f"SELECT count(*) FROM study_sets WHERE id='{set_id}'")) == "0"
        assert restored(authenticated(foreign, f"SELECT count(*) FROM study_items WHERE study_set_id='{set_id}'")) == "0"
        restored("SET ROLE anon; SELECT * FROM study_sets;", success=False)
        restored(authenticated(owner, f"INSERT INTO study_sets(user_id,title) VALUES ('{owner}','Denied')"), success=False)
        assert restored("SELECT count(*) FROM pg_class WHERE relnamespace IN ('public'::regnamespace,'internal'::regnamespace) AND relkind='r' AND (NOT relrowsecurity OR NOT relforcerowsecurity);") == "0"
        assert restored("SELECT has_function_privilege('authenticated','public.persist_generated_study_set(uuid,uuid,jsonb,jsonb)','EXECUTE');") == "f"
        assert restored(f"SELECT expires_at::text FROM documents WHERE id='{source}';") == expiry
        assert restored(f"SELECT count(*) FROM documents WHERE id='{source}' AND expires_at>now();") == "0"
        # Atomic finalization replay after original expiry still returns the existing set.
        assert set_id in restored("SET ROLE service_role; " + finalization_sql(generation, owner, source))
        restored(f"SET ROLE service_role; DELETE FROM documents WHERE id='{source}';")
        assert restored(authenticated(owner, f"SELECT count(*) FROM study_items WHERE study_set_id='{set_id}'")) == "2"
        # The original database remains unaffected by restore/cleanup in the target.
        assert database(f"SELECT count(*) FROM documents WHERE id='{source}';") == "1"
    finally:
        # Target was created exclusively by this test; no user database is removed.
        database(f'DROP DATABASE "{target_name}" WITH (FORCE);')
        archive.unlink(missing_ok=True)
