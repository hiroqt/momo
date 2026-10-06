"""Shared rate-limit behavior (SEC-01) with an in-process fake of the RPC.

Real cross-connection concurrency against PostgreSQL is covered in
test_durable_jobs_postgres.py. No network is used.
"""

import asyncio
import hashlib
import time
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from fastapi import Header

from app.config import settings
from app.db.session import supabase_session
from app.dependencies import AuthenticatedUser, get_current_user
from app.main import app
from app.services.security import rate_limiter as module
from app.services.security.rate_limiter import (
    RateLimiter,
    RateLimitUnavailableError,
    rate_limiter,
)


class FakeSharedDatabase:
    """Single sliding-window log standing in for consume_rate_limit()."""

    def __init__(self):
        self.events: dict[str, list[float]] = {}
        self.calls: list[dict] = []
        self.lock = asyncio.Lock()

    async def execute(self, query):
        name, params = query
        assert name == "consume_rate_limit"
        self.calls.append(params)
        async with self.lock:
            now = time.time()
            key, limit, window = params["p_bucket_key"], params["p_limit"], params["p_window_seconds"]
            log = [t for t in self.events.get(key, []) if t > now - window]
            if len(log) >= limit:
                self.events[key] = log
                return SimpleNamespace(data={"allowed": False, "limit": limit, "remaining": 0,
                                             "retry_after": max(1, int(log[0] + window - now))})
            log.append(now)
            self.events[key] = log
            return SimpleNamespace(data={"allowed": True, "limit": limit, "remaining": limit - len(log),
                                         "retry_after": 0})


class FakeClient:
    def rpc(self, name, params):
        return name, params


@pytest.fixture
def shared(monkeypatch):
    db = FakeSharedDatabase()
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    monkeypatch.setattr(supabase_session, "client", FakeClient())
    monkeypatch.setattr(supabase_session, "execute", db.execute)
    return db


@pytest.fixture(autouse=True)
def isolated_memory():
    rate_limiter.reset()
    yield
    rate_limiter.reset()


def test_bucket_keys_hash_identity_and_validate_category():
    user = str(uuid4())
    key = RateLimiter.bucket_key("generation", user)
    assert key == f"generation:{hashlib.sha256(user.encode()).hexdigest()}" and user not in key
    for category in ("", "Generation", "x" * 33, "chat:other", "../etc"):
        with pytest.raises(ValueError):
            RateLimiter.bucket_key(category, user)
    with pytest.raises(ValueError):
        RateLimiter.bucket_key("chat", "")


async def test_limit_holds_across_replicas_and_restarts(shared):
    replicas = [RateLimiter() for _ in range(4)]
    results = await asyncio.gather(*(replicas[i % 4].check_limit("user-1", "generation", 5) for i in range(20)))
    assert sum(allowed for allowed, *_ in results) == 5
    restarted = RateLimiter()  # new process: no in-memory history
    allowed, retry_after, remaining, limit = await restarted.check_limit("user-1", "generation", 5)
    assert (allowed, remaining, limit) == (False, 0, 5) and retry_after >= 1
    assert (await restarted.check_limit("user-2", "generation", 5))[0]
    assert all("user-1" not in call["p_bucket_key"] for call in shared.calls)


async def test_shared_state_failure_fails_closed(monkeypatch, shared):
    async def broken(query):
        raise RuntimeError("SQLSTATE 08006 connection to db.secret-host failed")

    monkeypatch.setattr(supabase_session, "execute", broken)
    with pytest.raises(RateLimitUnavailableError) as failure:
        await RateLimiter().check_limit("user-1", "chat", 5)
    assert "secret-host" not in str(failure.value)


@pytest.mark.parametrize("limit,window", [(0, 60), (1001, 60), (5, 0), (5, 3601)])
async def test_rejects_unbounded_limits(limit, window):
    with pytest.raises(ValueError):
        await RateLimiter().check_limit("user-1", "chat", limit, window)


@pytest.fixture
async def api():
    async def identity(x_test_user: str = Header()):
        return AuthenticatedUser(x_test_user)

    app.dependency_overrides[get_current_user] = identity
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test.local") as client:
        yield client
    app.dependency_overrides.pop(get_current_user, None)


async def test_dependency_unavailable_returns_safe_503(api, monkeypatch, caplog, shared):
    async def broken(query):
        raise RuntimeError("password=hunter2 host=db.internal")

    monkeypatch.setattr(supabase_session, "execute", broken)
    response = await api.post("/api/generations", headers={"x-test-user": str(uuid4())},
                              json={"document_id": str(uuid4())})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "RATE_LIMIT_UNAVAILABLE"
    assert response.headers["Retry-After"] == "5"
    assert "hunter2" not in response.text and "hunter2" not in caplog.text


@pytest.mark.parametrize("path,category", [("/api/documents/upload-url", "upload"),
                                           ("/api/documents", "registration")])
async def test_expensive_upload_paths_are_limited_per_verified_user(api, monkeypatch, path, category):
    monkeypatch.setattr(settings, "RATE_LIMIT_UPLOAD_PER_MINUTE", 3)
    user, other = str(uuid4()), str(uuid4())
    for _ in range(3):
        allowed, *_ = await rate_limiter.check_limit(user, category, 3)
        assert allowed
    response = await api.post(path, headers={"x-test-user": user}, json={})
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert int(response.headers["Retry-After"]) >= 1 and response.headers["X-RateLimit-Limit"] == "3"
    # Spoofed forwarding headers do not change the identity used for limits.
    spoofed = await api.post(path, headers={"x-test-user": user, "x-forwarded-for": "203.0.113.9"}, json={})
    assert spoofed.status_code == 429
    assert (await api.post(path, headers={"x-test-user": other}, json={})).status_code != 429


def test_upload_limit_preserves_monthly_quota_message():
    # Ten monthly documents need 20 calls (signed URL + registration) in separate buckets.
    assert module.get_default_limit_for_category("upload") >= settings.MONTHLY_DOCUMENT_LIMIT
    assert module.get_default_limit_for_category("registration") >= settings.MONTHLY_DOCUMENT_LIMIT


def test_dependency_requires_valid_category():
    with pytest.raises(ValueError):
        module.require_rate_limit("Not Valid")
