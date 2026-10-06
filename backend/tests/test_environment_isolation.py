"""Configuration and SDK isolation; no provider connection is allowed."""
import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from dotenv import dotenv_values
from pydantic import ValidationError

from app.config import PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF, Settings, settings
from app.db.session import SupabaseSession

STAGING = "zkouryrzhsgaeqyiwwyb"
PRODUCTION = "liyuyfqkbknxorzoekkq"
BACKEND = Path(__file__).parents[1]


def managed(**overrides):
    values = dict(
        APP_ENV="staging", LOCAL_ONLY=False, DATABASE_BACKEND="supabase", INLINE_JOB_EXECUTION=False,
        SUPABASE_URL=f"https://{STAGING}.supabase.co", SUPABASE_PROJECT_REF=STAGING,
        SUPABASE_ANON_KEY="test-public-configured", SUPABASE_SERVICE_ROLE_KEY="test-secret-configured",
        SUPABASE_JWT_SECRET=None, OPENROUTER_API_KEY="test-provider-configured",
        EMBEDDING_PROVIDER="openrouter", CORS_ORIGINS=["https://staging.momo.example"],
    )
    values.update(overrides)
    return Settings(_env_file=None, **values)


def production(**overrides):
    return managed(**{"APP_ENV": "production", "SUPABASE_PROJECT_REF": PRODUCTION,
                      "SUPABASE_URL": f"https://{PRODUCTION}.supabase.co", **overrides})


def template(name):
    values = dict(dotenv_values(BACKEND / name))
    values["CORS_ORIGINS"] = json.loads(values["CORS_ORIGINS"])
    return values


def test_pinned_refs_match_the_intended_projects():
    assert (STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF) == (STAGING, PRODUCTION)


def test_managed_environment_is_pinned():
    assert managed().SUPABASE_PROJECT_REF == STAGING
    assert managed().ENVIRONMENT == "staging"
    assert production().ENVIRONMENT == "production"


@pytest.mark.parametrize("app_env", [None, "", "prod", "development", "dev", "PRODUCTION"])
def test_app_env_must_be_explicit_and_known(monkeypatch, app_env):
    monkeypatch.delenv("APP_ENV", raising=False)
    values = {} if app_env is None else {"APP_ENV": app_env}
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)


def test_local_app_env_maps_to_development_mode():
    assert Settings(_env_file=None, APP_ENV="local").ENVIRONMENT == "development"
    assert Settings(_env_file=None, APP_ENV="test").ENVIRONMENT == "test"


@pytest.mark.parametrize("environment", ["production", "staging", "development"])
def test_conflicting_legacy_environment_is_rejected(environment):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, APP_ENV="test", ENVIRONMENT=environment)


@pytest.mark.parametrize("overrides", [
    # Staging config pointing at production (ref, URL or both) refuses to start.
    {"SUPABASE_PROJECT_REF": PRODUCTION},
    {"SUPABASE_URL": f"https://{PRODUCTION}.supabase.co"},
    {"SUPABASE_PROJECT_REF": PRODUCTION, "SUPABASE_URL": f"https://{PRODUCTION}.supabase.co"},
    {"SUPABASE_PROJECT_REF": "abcdefghijklmnopqrst", "SUPABASE_URL": "https://abcdefghijklmnopqrst.supabase.co"},
    {"LOCAL_ONLY": True}, {"DATABASE_BACKEND": "memory"}, {"ENABLE_DEV_AUTH": True},
    {"INLINE_JOB_EXECUTION": True}, {"SUPABASE_PROJECT_REF": ""},
    {"SUPABASE_URL": f"https://{STAGING}.supabase.co.attacker.test"},
    {"SUPABASE_URL": f"http://{STAGING}.supabase.co"},
    {"SUPABASE_URL": f"https://{STAGING}.supabase.co:8443"},
    {"SUPABASE_URL": "http://127.0.0.1:54321"},
    {"SUPABASE_SERVICE_ROLE_KEY": "mock-server-key"}, {"SUPABASE_ANON_KEY": ""},
    {"OPENROUTER_API_KEY": "your-api-key"}, {"SUPABASE_JWT_SECRET": "mock-jwt-secret"},
    {"EMBEDDING_PROVIDER": "local"}, {"EMBEDDING_PROVIDER": "supabase"},
    {"CORS_ORIGINS": ["*"]}, {"CORS_ORIGINS": ["http://localhost:3000"]},
    {"CORS_ORIGINS": ["https://staging.example/path"]}, {"CORS_ORIGINS": []},
    {"OPENROUTER_BASE_URL": "https://attacker.test/api/v1"},
    {"STORAGE_PROVIDER": "s3"},
])
def test_staging_rejects_cross_environment_or_mock_configuration(overrides):
    with pytest.raises(ValidationError):
        managed(**overrides)


@pytest.mark.parametrize("overrides", [
    # Production config pointing at staging refuses to start.
    {"SUPABASE_PROJECT_REF": STAGING},
    {"SUPABASE_URL": f"https://{STAGING}.supabase.co"},
    {"SUPABASE_PROJECT_REF": STAGING, "SUPABASE_URL": f"https://{STAGING}.supabase.co"},
    {"DATABASE_BACKEND": "memory"}, {"ENABLE_DEV_AUTH": True}, {"INLINE_JOB_EXECUTION": True},
    {"EMBEDDING_PROVIDER": "local"}, {"OPENROUTER_API_KEY": "mock-openrouter-key"},
    {"SUPABASE_SERVICE_ROLE_KEY": "replace-me"}, {"SUPABASE_ANON_KEY": "placeholder"},
    {"SUPABASE_JWT_SECRET": "changeme"},
])
def test_production_rejects_staging_dev_memory_mock_and_placeholders(overrides):
    with pytest.raises(ValidationError):
        production(**overrides)


@pytest.mark.parametrize("url", [
    "https://example.supabase.co", f"https://{STAGING}.supabase.co", f"https://{PRODUCTION}.supabase.co",
    "http://localhost:54321", "http://127.0.0.1.attacker.test",
    "http://127.0.0.1:54321?target=remote", "http://user:password@127.0.0.1:54321",
    "http://127.0.0.1:54321/rest/v1", "ftp://127.0.0.1:54321", "http://10.0.0.5:54321",
])
@pytest.mark.parametrize("app_env", ["local", "test"])
def test_local_config_rejects_hosted_or_ambiguous_supabase(url, app_env):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, APP_ENV=app_env, SUPABASE_URL=url)


@pytest.mark.parametrize("ref", [STAGING, PRODUCTION])
def test_local_config_cannot_select_a_hosted_project(ref):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, APP_ENV="local", SUPABASE_PROJECT_REF=ref)


@pytest.mark.parametrize("overrides", [
    {"LOCAL_ONLY": False}, {"OPENROUTER_API_KEY": "live-configured-key"},
    {"EMBEDDING_PROVIDER": "openrouter"}, {"STORAGE_PROVIDER": "s3"},
])
def test_local_config_rejects_external_provider_paths(overrides):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, APP_ENV="local", **overrides)


def test_job_heartbeat_must_renew_before_lease_expiry():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, APP_ENV="test", JOB_LEASE_SECONDS=30, JOB_HEARTBEAT_SECONDS=20)


@pytest.mark.parametrize("url", ["http://127.0.0.1:54321", "http://[::1]:54321"])
def test_local_supabase_sdk_supports_explicit_loopback(monkeypatch, url):
    local = Settings(_env_file=None, APP_ENV="local", SUPABASE_URL=url, DATABASE_BACKEND="supabase",
                     SUPABASE_SERVICE_ROLE_KEY="test-local-service-key")
    monkeypatch.setattr("app.db.session.settings", local)
    factory = MagicMock()
    monkeypatch.setattr("app.db.session.create_client", factory)
    assert SupabaseSession().is_configured
    assert factory.call_args.args[:2] == (url, "test-local-service-key")


@pytest.mark.parametrize("ref", [STAGING, PRODUCTION])
def test_runtime_sdk_rechecks_destination_before_client_creation(monkeypatch, ref):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "test-local-key")
    monkeypatch.setattr(settings, "SUPABASE_URL", f"https://{ref}.supabase.co")
    factory = MagicMock()
    monkeypatch.setattr("app.db.session.create_client", factory)
    with pytest.raises(ValueError):
        _ = SupabaseSession().is_configured
    factory.assert_not_called()


def test_startup_failure_never_echoes_secret_inputs(monkeypatch):
    from app import config

    constructor = config.Settings
    secret = "sensitive-provider-value-do-not-log"
    monkeypatch.setattr(config, "Settings", lambda: constructor(_env_file=None, APP_ENV="local",
                                                                  OPENROUTER_API_KEY=secret))
    with pytest.raises(RuntimeError) as failure:
        config.load_settings()
    assert secret not in str(failure.value)
    assert failure.value.__suppress_context__


def test_local_example_is_safe_without_credentials():
    local = Settings(_env_file=None, **template(".env.example"))
    assert local.APP_ENV == "local" and local.LOCAL_ONLY and local.DATABASE_BACKEND == "memory"
    assert not local.ENABLE_DEV_AUTH and not local.SUPABASE_PROJECT_REF


@pytest.mark.parametrize("environment,ref", [("staging", STAGING), ("production", PRODUCTION)])
def test_hosted_templates_are_pinned_and_fail_closed_until_secret_injection(environment, ref):
    values = template(f".env.{environment}.example")
    assert values["APP_ENV"] == environment
    assert values["SUPABASE_PROJECT_REF"] == ref and values["SUPABASE_URL"] == f"https://{ref}.supabase.co"
    other = PRODUCTION if ref == STAGING else STAGING
    assert other not in (BACKEND / f".env.{environment}.example").read_text()
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)
    # The template becomes valid only once real secrets/origins are injected.
    injected = {**values, "SUPABASE_ANON_KEY": "test-injected-public", "SUPABASE_SERVICE_ROLE_KEY": "test-injected-secret",
                "OPENROUTER_API_KEY": "test-injected-provider", "CORS_ORIGINS": [f"https://{environment}.momo.example"]}
    assert Settings(_env_file=None, **injected).SUPABASE_PROJECT_REF == ref


def test_templates_contain_no_secret_values():
    for name in (".env.example", ".env.staging.example", ".env.production.example"):
        for key, value in dotenv_values(BACKEND / name).items():
            if any(part in key for part in ("KEY", "SECRET", "PASSWORD", "TOKEN")):
                assert not value or value.startswith(("mock-", "your-", "replace-")), key
