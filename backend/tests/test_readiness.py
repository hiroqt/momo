import asyncio
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi import FastAPI

from app.api.routes import health


@pytest.fixture
def probe(monkeypatch):
    session = MagicMock(use_memory=False)
    monkeypatch.setattr(health, "supabase_session", session)
    app = FastAPI()
    app.include_router(health.router)
    return app, session


async def request(app):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local") as client:
        return await client.get("/ready")


async def test_readiness_checks_database_without_returning_data(probe):
    app, session = probe
    async def execute(query):
        return {"private": "never exposed"}
    session.execute = execute
    response = await request(app)
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "available"}
    session.require_client().table.assert_called_once_with("users")
    session.require_client().table().select.assert_called_once_with("id", head=True)


async def test_readiness_database_failure_is_safe(probe, caplog):
    app, session = probe
    async def execute(query):
        raise RuntimeError("private signed url and server key")
    session.execute = execute
    response = await request(app)
    assert response.status_code == 503
    assert response.json() == {"status": "not_ready", "database": "unavailable"}
    assert "private signed" not in response.text + caplog.text


async def test_readiness_timeout_is_bounded(probe, monkeypatch):
    app, session = probe
    cancelled = asyncio.Event()
    async def execute(query):
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()
    session.execute = execute
    monkeypatch.setattr(health, "READINESS_TIMEOUT_SECONDS", 0.01)
    response = await asyncio.wait_for(request(app), timeout=0.2)
    assert response.status_code == 503
    assert cancelled.is_set()


async def test_local_memory_readiness_is_explicit(probe):
    app, session = probe
    session.use_memory = True
    response = await request(app)
    assert response.json() == {"status": "ready", "database": "local_memory"}
    session.require_client.assert_not_called()
