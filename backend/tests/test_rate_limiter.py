
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.security.rate_limiter import rate_limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    rate_limiter.reset()
    yield
    rate_limiter.reset()

@pytest.mark.asyncio
async def test_rate_limiter_allows_under_limit():
    for _ in range(5):
        allowed, retry_after, remaining, limit = await rate_limiter.check_limit(
            identifier="user-limit-1",
            category="test",
            limit=5,
            window_seconds=60
        )
        assert allowed is True
        assert retry_after == 0
    assert remaining == 0

@pytest.mark.asyncio
async def test_rate_limiter_blocks_on_excess():
    for _ in range(5):
        await rate_limiter.check_limit(
            identifier="user-limit-2",
            category="test",
            limit=5,
            window_seconds=60
        )

    # 6th request should be blocked
    allowed, retry_after, remaining, limit = await rate_limiter.check_limit(
        identifier="user-limit-2",
        category="test",
        limit=5,
        window_seconds=60
    )
    assert allowed is False
    assert retry_after > 0
    assert remaining == 0
    assert limit == 5

@pytest.mark.asyncio
async def test_rate_limiter_independent_users():
    # User A uses 3 requests
    for _ in range(3):
        allowed, _, _, _ = await rate_limiter.check_limit("user-a", "chat", limit=3, window_seconds=60)
        assert allowed is True

    # User A is now blocked
    allowed, _, _, _ = await rate_limiter.check_limit("user-a", "chat", limit=3, window_seconds=60)
    assert allowed is False

    # User B is unaffected
    allowed, _, _, _ = await rate_limiter.check_limit("user-b", "chat", limit=3, window_seconds=60)
    assert allowed is True

@pytest.mark.asyncio
async def test_rate_limiter_http_429_response():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-rate-limit-user"}

        # Exhaust chat limit by calling quick endpoint
        # Default chat limit is 20 per minute
        for _ in range(20):
            allowed, _, _, _ = await rate_limiter.check_limit("rate-limit-user", "chat", limit=20, window_seconds=60)
            assert allowed is True

        # Next call through API should return 429
        resp = await ac.post(
            "/api/chat",
            json={"content": "Should be rate limited"},
            headers=headers
        )
        assert resp.status_code == 429
        data = resp.json()
        assert "RATE_LIMIT_EXCEEDED" in data["error"]["code"]
        assert "Retry-After" in resp.headers
        assert int(resp.headers["Retry-After"]) > 0
