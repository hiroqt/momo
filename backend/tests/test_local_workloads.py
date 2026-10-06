"""Bounded ASGI load/stress smoke checks, with zero network or AI traffic."""

import asyncio
import time
from uuid import uuid4

import httpx
import pytest
from fastapi import Header
from test_postgres_rls import database as database
from test_postgres_rls import users as users

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


@pytest.mark.parametrize("jobs,workers", [(300, 8), (1200, 32)], ids=["load", "stress"])
async def test_durable_queue_processes_each_job_exactly_once_under_contention(jobs, workers):
    from app.workers.job_queue import JobQueue
    from app.workers.runner import JobRunner

    queue, seen = JobQueue(), []

    async def handler(job):
        seen.append(job["subject_id"])
        await asyncio.sleep(0)

    user = str(uuid4())
    subjects = [str(uuid4()) for _ in range(jobs)]
    # Duplicate deliveries of every subject still create one logical job each.
    await asyncio.gather(*(queue.enqueue("document_ingestion", user, s) for s in subjects * 2))
    runners = [JobRunner(queue, {"document_ingestion": handler}, worker_id=f"w{i}", concurrency=4,
                         lease_seconds=60, heartbeat_seconds=5) for i in range(workers)]
    started = time.perf_counter()

    async def drain(runner):
        while await runner.run_once():
            pass

    await asyncio.wait_for(asyncio.gather(*(drain(r) for r in runners)), timeout=30)
    assert sorted(seen) == sorted(subjects)
    assert all(job["status"] == "succeeded" and job["attempts"] == 1 for job in queue._jobs.values())
    print({"transport": "memory-queue", "jobs": jobs, "workers": workers,
           "seconds": round(time.perf_counter() - started, 3)})


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


# --- Integration stress (2026-10-06): mixed API journey + real PostgreSQL contention -------

async def test_mixed_api_stress_sync_economy_and_isolation():
    """1,500 signed-token requests at concurrency 128 over sync, economy and tenant reads."""
    from test_e2e_journeys import bearer
    users = [str(uuid4()) for _ in range(8)]
    sets = {}
    for user in users:
        deck = await study_repo.create_study_set({"user_id": user, "title": f"PRIVATE_{user[:8]}"})
        await study_repo.save_study_items(deck["id"], [{"question": "Q", "answer": "A", "type": "flashcard",
                                                        "source_metadata": {}}])
        sets[user] = (deck["id"], (await study_repo.get_study_items(deck["id"], user))[0]["id"])
    headers = {user: bearer(user) for user in users}
    events = {user: [{"event_id": str(uuid4()), "study_item_id": sets[user][1], "result": "correct",
                      "occurred_at": "2026-10-06T08:00:00+00:00"} for _ in range(20)] for user in users}
    semaphore, latencies = asyncio.Semaphore(128), []
    started = time.perf_counter()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test.local") as client:
        async def request(index):
            user, other = users[index % 8], users[(index + 1) % 8]
            async with semaphore:
                before = time.perf_counter()
                kind = index % 5
                if kind == 0:  # sync with heavy duplicate replay
                    start = (index // 40) % 4 * 5  # 4 non-overlapping batches, each replayed ~9x
                    batch = events[user][start:start + 5]
                    r = await client.post("/api/sync/events", headers=headers[user], json={"events": batch})
                    assert r.status_code == 200
                elif kind == 1:  # heart spends with replayed keys
                    r = await client.post("/api/economy/hearts/consume", headers=headers[user],
                                          json={"idempotency_key": f"answer-key-{(index // 40) % 12}"})
                    assert r.status_code in {200, 409}
                elif kind == 2:
                    r = await client.get("/api/economy/wallet", headers=headers[user])
                    assert r.status_code == 200 and 0 <= r.json()["hearts"] <= 5
                elif kind == 3:  # cross-tenant probe
                    r = await client.get(f"/api/study-sets/{sets[user][0]}", headers=headers[other])
                    assert r.status_code == 404 and "PRIVATE_" not in r.text
                else:
                    r = await client.get(f"/api/study-sets/{sets[user][0]}", headers=headers[user])
                    assert r.status_code == 200
                latencies.append((time.perf_counter() - before) * 1000)
        await asyncio.wait_for(asyncio.gather(*(request(i) for i in range(1500))), timeout=60)
        for user in users:
            wallet = (await client.get("/api/economy/wallet", headers=headers[user])).json()
            assert wallet["hearts"] == 0  # 12 distinct keys per user, exactly 5 applied
            replay = await client.post("/api/sync/events", headers=headers[user], json={"events": events[user]})
            assert replay.json()["accepted_count"] == 0  # every event already stored exactly once
    ordered = sorted(latencies)
    print({"transport": "ASGI-memory+HS256", "requests": 1500, "concurrency": 128,
           "seconds": round(time.perf_counter() - started, 3),
           "p95_ms": round(ordered[int(len(ordered) * 0.95) - 1], 3)})


def test_pg_concurrent_workers_claim_each_job_exactly_once(database, users):
    import json
    from concurrent.futures import ThreadPoolExecutor

    from test_postgres_rls import document, register_sql
    alice, _ = users
    subjects = []
    for _ in range(10):  # quota-bounded documents, 20 generation jobs each
        doc = document(alice)
        database(register_sql(doc), role="service_role")
        for _ in range(20):
            job = str(uuid4())
            database(f"INSERT INTO generation_jobs(id,user_id,document_id,status) VALUES "
                     f"('{job}','{alice}','{doc['id']}','PENDING');", role="service_role")
            subjects.append(job)
    for subject in subjects:
        database(f"SELECT public.enqueue_background_job('study_generation','{alice}','{subject}','{{}}'::jsonb,3,false);",
                 role="service_role")

    def worker(n):
        claimed = []
        while True:
            out = database(f"SELECT public.claim_background_jobs('stress-w{n}',ARRAY['study_generation'],5,60,NULL);",
                           role="service_role")
            rows = [json.loads(line) for line in out.splitlines() if line]
            if not rows:
                return claimed
            for row in rows:
                assert database(f"SELECT public.complete_background_job('{row['id']}','stress-w{n}');",
                                role="service_role") == "t"
                claimed.append(row["subject_id"])

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(worker, range(16)))
    flat = [s for r in results for s in r]
    assert sorted(flat) == sorted(subjects) and len(flat) == 200
    assert sum(1 for r in results if r) >= 2  # work was actually shared
    assert database("SELECT count(*) FROM internal.background_jobs WHERE status<>'succeeded' "
                    "AND kind='study_generation';") == "0"
    print({"transport": "psql-postgres16", "jobs": 200, "workers": 16,
           "seconds": round(time.perf_counter() - started, 3)})


def test_pg_concurrent_economy_spends_never_overdraft(database, users):
    import json
    from concurrent.futures import ThreadPoolExecutor
    alice, bob = users

    def apply(args):
        user, key, kind, hearts, credits = args
        try:
            return json.loads(database(
                f"SELECT public.apply_economy_entry('{user}','{key}','{kind}',{hearts},{credits},0,NULL,NULL,NULL);",
                role="service_role"))
        except AssertionError as exc:
            assert "INSUFFICIENT" in str(exc)
            return None

    apply((alice, "grant", "credit_reward", 0, 1000))
    spends = [(alice, f"buy-{n % 40}", "cosmetic_purchase", 0, -30) for n in range(80)]  # 40 keys, each twice
    hearts = [(bob, f"miss-{n % 16}", "heart_loss", -1, 0) for n in range(48)]  # 16 keys, 3x each
    with ThreadPoolExecutor(max_workers=32) as pool:
        list(pool.map(apply, spends + hearts))
    # 1000 credits / 30 = 33 purchases; replays never double-charge; balance never negative.
    assert database(f"SELECT credits FROM economy_wallets WHERE user_id='{alice}';") == "10"
    assert database(f"SELECT count(*) FROM economy_ledger WHERE user_id='{alice}' AND kind='cosmetic_purchase';") == "33"
    assert database(f"SELECT hearts FROM economy_wallets WHERE user_id='{bob}';") == "0"
    assert database(f"SELECT count(*) FROM economy_ledger WHERE user_id='{bob}' AND kind='heart_loss';") == "5"
