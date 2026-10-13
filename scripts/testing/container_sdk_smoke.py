"""Network-isolated backend image regression for real Supabase SDK construction."""
import asyncio
import os
import socket

import jwt


def denied(*args, **kwargs):
    raise ConnectionError("Network disabled in SDK image fixture")


socket.socket.connect = denied
socket.socket.connect_ex = denied
socket.create_connection = denied

from app.config import settings  # noqa: E402
from app.db.session import SupabaseSession  # noqa: E402


async def main():
    assert os.getuid() == 10001
    settings.SUPABASE_URL = "http://127.0.0.1:1"
    settings.DATABASE_BACKEND = "supabase"
    settings.SUPABASE_SERVICE_ROLE_KEY = jwt.encode({"role": "service_role"},
        "synthetic-image-key-with-at-least-32-characters", algorithm="HS256")
    session = SupabaseSession()
    try:
        assert session.is_configured  # generic ClientOptions formerly failed here
        assert session.client is not None
        assert not session.client.options.auto_refresh_token
        assert not session.client.options.persist_session
        try:
            await session.execute(session.client.table("study_sets").select("id").limit(1))
        except (ConnectionError, OSError):
            pass
        except Exception as error:  # noqa: BLE001 - SDK wraps the denied socket
            import httpx
            assert isinstance(error, httpx.TransportError), type(error).__name__
        else:
            raise AssertionError("Network-isolated database query unexpectedly succeeded")
        assert not session.use_memory
        print("PASS: non-root real SDK construction; denied database I/O fails closed")
    finally:
        session.close()


asyncio.run(main())
