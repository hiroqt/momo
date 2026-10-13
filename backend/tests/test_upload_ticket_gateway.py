"""Real SDK/PostgREST ticket RPC contracts on the isolated loopback gateway."""
import os
import subprocess
import sys
from pathlib import Path

import pytest
from test_postgres_rls import database as database
from test_postgres_rls import users as users


def test_upload_ticket_lifecycle_through_actual_sdk_gateway(database, users, tmp_path):
    url = os.environ.get("LOCAL_TEST_GATEWAY_URL")
    if not url:
        if os.environ.get("REQUIRE_GATEWAY_INTEGRATION") == "1":
            pytest.fail("Required local gateway is unavailable")
        pytest.skip("Set LOCAL_TEST_GATEWAY_URL for dedicated SDK/PostgREST verification")
    owner, _ = users
    helper = Path(__file__).with_name("worker_process_fixture.py")
    env = {key: value for key, value in os.environ.items() if not key.startswith("PG")}
    env["PYTHONPATH"] = str(Path(__file__).parents[1])
    env["WORKER_TEST_GATEWAY_URL"] = url
    result = subprocess.run([sys.executable, str(helper), owner, str(tmp_path / "unused-barrier"), "ticket-gateway"],
                            text=True, capture_output=True, timeout=20, env=env)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "ticket-gateway-passed"
