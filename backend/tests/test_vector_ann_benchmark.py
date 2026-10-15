"""The experimental vector benchmark cannot target hosted or non-disposable databases."""

import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "run_vector_ann_probe", Path(__file__).parents[2] / "scripts/testing/run_vector_ann_probe.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


@pytest.mark.parametrize("url", [
    "postgresql://user:secret@project.supabase.co/momo_security_test",
    "postgresql://user:secret@127.0.0.1/production",
    "postgresql://user:secret@localhost/momo_security_test",
])
def test_vector_benchmark_rejects_non_disposable_targets_before_psql(monkeypatch, url):
    called = []

    def forbidden(*_args, **_kwargs):
        called.append(True)
        raise AssertionError("psql must not run for a rejected target")

    monkeypatch.setattr(module.subprocess, "run", forbidden)
    with pytest.raises(ValueError):
        module.run(url)
    assert called == []


def test_vector_benchmark_runs_only_the_fixed_local_sql(monkeypatch):
    calls = []

    def fake_run(args, **kwargs):
        calls.append((args, kwargs))
        return type("Completed", (), {"returncode": 0, "stdout": "synthetic results", "stderr": ""})()

    monkeypatch.setattr(module.subprocess, "run", fake_run)
    result = module.run("postgresql://postgres:local-test-only@127.0.0.1:55432/momo_security_test")
    assert result == "synthetic results"
    assert calls[0][0][0:3] == [
        "psql", "postgresql://postgres:local-test-only@127.0.0.1:55432/momo_security_test", "-X"
    ]
    assert calls[0][0][-1] == str(module.SQL_FILE)
