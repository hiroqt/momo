"""CI-01 guard scripts: skipped integration fails, exclusions only shrink."""

import importlib.util
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[2] / "scripts/testing"


def load(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def junit(tmp_path, body, tests, skipped=0):
    path = tmp_path / "junit.xml"
    path.write_text(f'<testsuites><testsuite tests="{tests}" skipped="{skipped}" errors="0" failures="0">{body}</testsuite></testsuites>')
    return str(path)


def test_skipped_postgres_integration_fails_ci(tmp_path):
    guard = load("assert_no_skips")
    report = junit(tmp_path, '<testcase classname="test_postgres_rls" name="x"><skipped message="no db"/></testcase>', 1, 1)
    assert guard.main(report) == 1


def test_clean_report_passes_and_minimum_count_is_enforced(tmp_path):
    guard = load("assert_no_skips")
    report = junit(tmp_path, '<testcase classname="a" name="b"/>', 1)
    assert guard.main(report) == 0
    assert guard.main(report, minimum=2) == 1


def test_static_check_exclusions_reference_existing_files_only():
    checks = load("static_checks")
    backend = Path(__file__).parents[1]
    sections = checks.exclusions()
    assert set(sections) == {"ruff", "mypy"}
    assert all((backend / path).is_file() for paths in sections.values() for path in paths)


def test_pg_fixture_requires_database_when_ci_demands_it():
    import os
    import subprocess
    import sys

    backend = Path(__file__).parents[1]
    env = {k: v for k, v in os.environ.items() if k != "LOCAL_TEST_DATABASE_URL"}
    env["REQUIRE_PG_INTEGRATION"] = "1"
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider",
         "tests/test_postgres_rls.py::test_rls_covers_every_application_table"],
        cwd=backend, env=env, capture_output=True, text=True, timeout=120, check=False)
    assert result.returncode != 0
    assert "REQUIRE_PG_INTEGRATION=1" in result.stdout and "skipped" not in result.stdout


@pytest.mark.parametrize("url", [
    "postgresql://postgres:pw@db.zkouryrzhsgaeqyiwwyb.supabase.co:5432/momo_security_test",
    "postgresql://postgres:pw@localhost:55435/momo_security_test",
    "postgresql://postgres:pw@10.0.0.4:55435/momo_security_test",
    "postgresql://postgres:pw@127.0.0.1:55435/momo_security_test?host=remote.example",
])
def test_database_targets_must_be_loopback(url):
    local_only = load("local_only")
    with pytest.raises(ValueError):
        local_only.require_loopback_url(url, ("postgres", "postgresql"))


@pytest.mark.parametrize("port", [55432, 55433, 55434, 55435])
def test_any_loopback_port_is_accepted_for_parallel_stacks(port):
    local_only = load("local_only")
    url = f"postgresql://postgres:pw@127.0.0.1:{port}/momo_security_test"
    assert local_only.require_loopback_url(url, ("postgresql",)) == url
