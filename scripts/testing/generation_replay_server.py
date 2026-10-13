"""Loopback-only real API fixture for the mobile durable generation replay smoke.

Writes ephemeral signed synthetic JWTs to a private configuration file, never
stdout. JWT cryptography remains real; only the synthetic local Auth account check is
replaced. No fixture routes, hosted I/O, or worker runs.
"""
import argparse
import asyncio
import json
import os
import secrets
import socket
import sys
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--port", type=int, default=58041)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("Use an unprivileged loopback port")
    signing_key = secrets.token_urlsafe(48)
    os.environ.update({
        "APP_ENV": "test", "ENVIRONMENT": "test", "LOCAL_ONLY": "true",
        "DATABASE_BACKEND": "memory", "ENABLE_DEV_AUTH": "false",
        "INLINE_JOB_EXECUTION": "false", "SUPABASE_URL": "http://127.0.0.1:54321",
        "SUPABASE_PROJECT_REF": "", "SUPABASE_ANON_KEY": "mock-anon-key",
        "SUPABASE_SERVICE_ROLE_KEY": "mock-service-role-key",
        "SUPABASE_JWT_SECRET": signing_key, "SUPABASE_JWT_AUDIENCE": "authenticated",
        "OPENROUTER_API_KEY": "mock-openrouter-key", "EMBEDDING_PROVIDER": "local",
        "AWS_ACCESS_KEY_ID": "mock-access-key", "AWS_SECRET_ACCESS_KEY": "mock-secret-key",
        "STORAGE_PROVIDER": "supabase",
    })
    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex

    def local_address(address):
        if not isinstance(address, tuple) or address[0] not in {"127.0.0.1", "::1"}:
            raise RuntimeError("External sockets are forbidden in the replay fixture")

    def connect(sock, address):
        local_address(address)
        return original_connect(sock, address)

    def connect_ex(sock, address):
        local_address(address)
        return original_connect_ex(sock, address)

    socket.socket.connect = connect
    socket.socket.connect_ex = connect_ex

    import jwt
    import uvicorn

    from app.db.repositories.documents_repo import documents_repo
    from app.main import app

    owner, other, source = str(uuid4()), str(uuid4()), str(uuid4())
    now = datetime.now(UTC)

    def token(subject):
        return jwt.encode({"sub": subject, "role": "authenticated", "aud": "authenticated",
                           "iss": "http://127.0.0.1:54321/auth/v1", "iat": int(now.timestamp()),
                           "exp": int((now + timedelta(minutes=10)).timestamp()),
                           "is_anonymous": False,
                           "app_metadata": {"provider": "google", "providers": ["google"]},
                           "amr": [{"method": "oauth", "timestamp": int(now.timestamp())}]}, signing_key,
                          algorithm="HS256")

    original_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def fixture_lifespan(application):
        async with original_lifespan(application):
            await documents_repo.create({"id": source, "user_id": owner,
                "original_filename": "synthetic-biology.txt", "file_type": "txt",
                "mime_type": "text/plain", "file_size": 50, "processing_status": "READY",
                "uploaded_at": now.isoformat(), "expires_at": (now + timedelta(days=3)).isoformat(),
                "page_count": 1, "s3_object_key": f"documents/{owner}/{source}/original.txt"})
            # Exclusive creation avoids overwriting an unrelated existing file.
            descriptor = os.open(args.config, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w") as stream:
                json.dump({"baseUrl": f"http://127.0.0.1:{args.port}", "owner": owner,
                           "other": other, "documentId": source, "tokenA": token(owner),
                           "tokenB": token(other)}, stream)
            try:
                yield
            finally:
                args.config.unlink(missing_ok=True)

    app.router.lifespan_context = fixture_lifespan
    asyncio.run(uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=args.port,
                access_log=False, log_level="warning")).serve())


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
