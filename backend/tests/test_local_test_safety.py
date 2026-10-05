import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "local_only", Path(__file__).parents[2] / "scripts/testing/local_only.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


@pytest.mark.parametrize("url", [
    "postgresql://user:password@project.supabase.co/postgres",
    "postgresql://localhost/postgres",
    "postgresql://127.0.0.1.attacker.test/postgres",
    "postgresql://127.0.0.1/postgres?host=project.supabase.co",
    "https://127.0.0.1/postgres",
])
def test_local_runner_rejects_external_or_ambiguous_targets(url):
    with pytest.raises(ValueError):
        module.require_loopback_url(url, ("postgresql", "postgres"))


@pytest.mark.parametrize("url", [
    "postgresql://postgres:test@127.0.0.1:55432/momo_security_test",
    "postgres://postgres:test@[::1]:55432/momo_security_test",
])
def test_local_runner_allows_explicit_loopback(url):
    assert module.require_loopback_url(url, ("postgresql", "postgres")) == url
