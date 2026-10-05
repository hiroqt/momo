"""Bounded ASGI load/stress smoke checks, with zero network or AI traffic."""

import asyncio
import time
from uuid import uuid4

import httpx
import pytest
from fastapi import Header

from app.db.repositories.study_repo import study_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.parametrize("requests,concurrency", [(500, 32), (1500, 128)],
                         ids=["load", "stress"])
async def test_bounded_concurrent_tenant_reads(requests, concurrency):
    alice, bob = str(uuid4()), str(uuid4())
    private = await study_repo.create_study_set({"user_id": alice, "title": "SECRET_ALICE_DECK"})

    async def identity(x_test_user: str = Header()):
        assert x_test_user in {alice, bob}
        return AuthenticatedUser(x_test_user)

    app.dependency_overrides[get_current_user] = identity
    latencies = []
    semaphore = asyncio.Semaphore(concurrency)
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                                    base_url="http://test.local") as client:
            async def request(index):
                async with semaphore:
                    before = time.perf_counter()
                    if index % 2:
                        response = await client.get(f"/api/study-sets/{private['id']}",
                                                    headers={"x-test-user": bob})
                        assert response.status_code == 404
                        assert "SECRET_ALICE_DECK" not in response.text
                    else:
                        response = await client.get(f"/api/study-sets/{private['id']}",
                                                    headers={"x-test-user": alice})
                        assert response.status_code == 200
                    latencies.append((time.perf_counter() - before) * 1000)

            await asyncio.wait_for(asyncio.gather(*(request(i) for i in range(requests))), timeout=30)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    elapsed = time.perf_counter() - started
    ordered = sorted(latencies)
    print({"transport": "ASGI-memory", "requests": requests, "concurrency": concurrency,
           "seconds": round(elapsed, 3), "requests_per_second": round(requests / elapsed),
           "p95_ms": round(ordered[int(len(ordered) * 0.95) - 1], 3)})


async def test_event_loop_remains_responsive_during_queries():
    user_id = str(uuid4())
    for index in range(100):
        await study_repo.create_study_set({"user_id": user_id, "title": f"Deck {index}"})
    ticks = 0

    async def heartbeat():
        nonlocal ticks
        for _ in range(10):
            await asyncio.sleep(0)
            ticks += 1

    await asyncio.wait_for(asyncio.gather(
        heartbeat(), *(study_repo.list_study_sets(user_id) for _ in range(100))
    ), timeout=5)
    assert ticks == 10
