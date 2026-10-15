"""Run the synthetic 2048-dimension retrieval probe on disposable local Postgres."""
import importlib.util
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
SQL_FILE = ROOT / "scripts/testing/vector_ann_probe.sql"
LOCAL_ONLY_SPEC = importlib.util.spec_from_file_location("local_only", Path(__file__).with_name("local_only.py"))
if LOCAL_ONLY_SPEC is None or LOCAL_ONLY_SPEC.loader is None:
    raise RuntimeError("Local test safety module is unavailable")
LOCAL_ONLY = importlib.util.module_from_spec(LOCAL_ONLY_SPEC)
LOCAL_ONLY_SPEC.loader.exec_module(LOCAL_ONLY)


def run(database_url: str) -> str:
    LOCAL_ONLY.require_loopback_url(database_url, ("postgresql", "postgres"))
    if urlsplit(database_url).path != "/momo_security_test":
        raise ValueError("Vector benchmark requires the disposable momo_security_test database")
    result = subprocess.run(
        ["psql", database_url, "-X", "-f", str(SQL_FILE)],
        check=False, capture_output=True, text=True,
    )
    if result.returncode:
        raise RuntimeError(f"Local vector benchmark failed (psql exit {result.returncode})")
    return result.stdout


def main() -> int:
    database_url = os.environ.get("LOCAL_TEST_DATABASE_URL", "")
    try:
        sys.stdout.write(run(database_url))
    except Exception as exc:  # noqa: BLE001 - never print a connection string or SQL/provider details
        print(f"Vector benchmark failed ({type(exc).__name__})", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
