"""Economy API contract (memory backend). Real PostgreSQL concurrency lives in test_economy_postgres.py."""
import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI, Header

from app.api.routes import economy
from app.db.repositories.economy_repo import economy_repo
from app.db.repositories.folder_repo import calculate_folder_credit_cost, folder_repo
from app.db.repositories.study_repo import study_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.domain.economy import MAX_HEARTS, EconomyPolicy, folder_credit_cost
from app.main import app as main_app


def _app(policy: EconomyPolicy | None = None, authenticated: bool = True) -> FastAPI:
    # main.py registration is owned by final integration; mount the router on an
    # isolated app that reuses the production exception handlers.
    test_app = FastAPI()
    test_app.exception_handlers.update(main_app.exception_handlers)
    test_app.include_router(economy.router)
    if authenticated:
        async def identity(x_test_user: str = Header()):
            return AuthenticatedUser(x_test_user)
        test_app.dependency_overrides[get_current_user] = identity
    if policy is not None:
        test_app.dependency_overrides[economy.get_economy_policy] = lambda: policy
    return test_app


def _client(test_app: FastAPI) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=test_app), base_url="http://test.local")


def _key() -> str:
    return str(uuid4())


def test_prd_folder_formula_matches_existing_helper():
    # PRD 6.6: folders 1-3 free, 4th = 50, 5th = 75, Nth (N >= 4) = 50 + (N - 4) * 25.
    assert [folder_credit_cost(n) for n in range(7)] == [0, 0, 0, 50, 75, 100, 125]
    for count in range(50):
        assert folder_credit_cost(count) == calculate_folder_credit_cost(count)
    for invalid in (-1, True, 1.5, "3"):
        with pytest.raises(ValueError):
            folder_credit_cost(invalid)  # type: ignore[arg-type]
    assert MAX_HEARTS == 5


@pytest.mark.parametrize("kwargs", [{"heart_regen_seconds": 59}, {"heart_regen_seconds": 604801},
                                    {"heart_refill_credit_price": 0}])
def test_policy_rejects_out_of_bounds_values(kwargs):
    with pytest.raises(ValueError):
        EconomyPolicy(**kwargs)


async def test_new_wallet_uses_prd_baseline_and_reports_pending_policy():
    user = str(uuid4())
    async with _client(_app()) as client:
        wallet = (await client.get("/api/economy/wallet", headers={"x-test-user": user})).json()
    assert wallet["hearts"] == wallet["max_hearts"] == 5
    assert wallet["credits"] == 0 and wallet["xp"] == 0
    assert wallet["folder_count"] == 0 and wallet["next_folder_cost"] == 0
    assert wallet["next_heart_at"] is None
    assert wallet["policy"] == {"heart_regen_seconds": None, "heart_refill_credit_price": None}


async def test_economy_routes_require_verified_identity():
    async with _client(_app(authenticated=False)) as client:
        assert (await client.get("/api/economy/wallet")).status_code == 401
        response = await client.post("/api/economy/hearts/consume", json={"idempotency_key": _key()})
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "AUTH_REQUIRED"


async def test_heart_consumption_is_replay_safe_and_key_scoped_per_user():
    alice, bob = str(uuid4()), str(uuid4())
    key = _key()
    async with _client(_app()) as client:
        first = await client.post("/api/economy/hearts/consume", headers={"x-test-user": alice}, json={"idempotency_key": key})
        replay = await client.post("/api/economy/hearts/consume", headers={"x-test-user": alice}, json={"idempotency_key": key})
        other = await client.post("/api/economy/hearts/consume", headers={"x-test-user": bob}, json={"idempotency_key": key})
        reused = await client.post("/api/economy/hearts/consume", headers={"x-test-user": alice},
                                   json={"idempotency_key": key, "study_item_id": str(uuid4())})
    assert first.status_code == 200 and first.json()["replayed"] is False
    assert first.json()["wallet"]["hearts"] == 4 and first.json()["entry"]["hearts_delta"] == -1
    assert replay.status_code == 200 and replay.json()["replayed"] is True
    assert replay.json()["wallet"]["hearts"] == 4
    assert replay.json()["entry"]["id"] == first.json()["entry"]["id"]
    # Same key from another account is an independent entry, not a replay oracle.
    assert other.json()["replayed"] is False and other.json()["wallet"]["hearts"] == 4
    assert reused.status_code == 409 and reused.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"


async def test_concurrent_heart_spend_never_goes_below_zero():
    user = str(uuid4())
    async with _client(_app()) as client:
        responses = await asyncio.gather(*[
            client.post("/api/economy/hearts/consume", headers={"x-test-user": user}, json={"idempotency_key": _key()})
            for _ in range(12)])
        wallet = (await client.get("/api/economy/wallet", headers={"x-test-user": user})).json()
    codes = sorted(r.status_code for r in responses)
    assert codes == [200] * 5 + [409] * 7
    assert {r.json()["error"]["code"] for r in responses if r.status_code == 409} == {"INSUFFICIENT_HEARTS"}
    assert wallet["hearts"] == 0


async def test_heart_reference_must_be_owned():
    owner, intruder = str(uuid4()), str(uuid4())
    study_set = await study_repo.create_study_set({"user_id": owner, "title": "Owned"})
    item = (await study_repo.save_study_items(study_set["id"], [{
        "id": str(uuid4()), "type": "flashcard", "question": "Q", "answer": "A", "source_metadata": {"page": 1}}]))[0]
    async with _client(_app()) as client:
        denied = await client.post("/api/economy/hearts/consume", headers={"x-test-user": intruder},
                                   json={"idempotency_key": _key(), "study_item_id": item["id"]})
        allowed = await client.post("/api/economy/hearts/consume", headers={"x-test-user": owner},
                                    json={"idempotency_key": _key(), "study_item_id": item["id"]})
        intruder_wallet = (await client.get("/api/economy/wallet", headers={"x-test-user": intruder})).json()
    assert denied.status_code == 404
    assert intruder_wallet["hearts"] == 5
    assert allowed.status_code == 200 and allowed.json()["entry"]["study_item_id"] == item["id"]


@pytest.mark.parametrize("payload", [
    {}, {"idempotency_key": "short"}, {"idempotency_key": "x" * 129}, {"idempotency_key": "bad key with spaces"},
    {"idempotency_key": str(uuid4()), "hearts_delta": -3},
    {"idempotency_key": str(uuid4()), "user_id": str(uuid4())},
    {"idempotency_key": str(uuid4()), "study_item_id": "not-a-uuid"},
])
async def test_clients_cannot_choose_amounts_or_identity(payload):
    async with _client(_app()) as client:
        response = await client.post("/api/economy/hearts/consume", headers={"x-test-user": str(uuid4())}, json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_refill_fails_closed_until_price_policy_is_approved():
    user = str(uuid4())
    async with _client(_app()) as client:
        response = await client.post("/api/economy/hearts/refill", headers={"x-test-user": user},
                                     json={"idempotency_key": _key(), "hearts": 1})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ECONOMY_POLICY_PENDING"


async def test_refill_with_configured_price_is_atomic_and_bounded():
    user = str(uuid4())
    policy = EconomyPolicy(heart_refill_credit_price=20)
    headers = {"x-test-user": user}
    await economy_repo.apply_entry(user, _key(), "credit_reward", policy=policy, credits_delta=30)
    async with _client(_app(policy)) as client:
        full = await client.post("/api/economy/hearts/refill", headers=headers, json={"idempotency_key": _key(), "hearts": 1})
        for _ in range(2):
            await client.post("/api/economy/hearts/consume", headers=headers, json={"idempotency_key": _key()})
        broke = await client.post("/api/economy/hearts/refill", headers=headers, json={"idempotency_key": _key(), "hearts": 2})
        ok = await client.post("/api/economy/hearts/refill", headers=headers, json={"idempotency_key": _key(), "hearts": 1})
        over = await client.post("/api/economy/hearts/refill", headers=headers, json={"idempotency_key": _key(), "hearts": 6})
    assert full.status_code == 409 and full.json()["error"]["code"] == "HEARTS_FULL"
    assert broke.status_code == 409 and broke.json()["error"]["code"] == "INSUFFICIENT_CREDITS"
    assert ok.status_code == 200
    assert ok.json()["wallet"]["hearts"] == 4 and ok.json()["wallet"]["credits"] == 10
    assert over.status_code == 422


async def test_regeneration_applies_only_with_configured_interval_and_caps_at_max():
    user = str(uuid4())
    pending, policy = EconomyPolicy(), EconomyPolicy(heart_regen_seconds=600)
    for _ in range(3):
        await economy_repo.apply_entry(user, _key(), "heart_loss", policy=pending, hearts_delta=-1)
    wallet = economy_repo._wallets[user]
    wallet["hearts_refreshed_at"] = datetime.now(UTC) - timedelta(seconds=1199)
    assert (await economy_repo.get_wallet(user, pending))["hearts"] == 2
    view = await economy_repo.get_wallet(user, policy)
    assert view["hearts"] == 3  # one complete interval only (time boundary)
    async with _client(_app(policy)) as client:
        body = (await client.get("/api/economy/wallet", headers={"x-test-user": user})).json()
    assert body["next_heart_at"] is not None
    wallet["hearts_refreshed_at"] = datetime.now(UTC) - timedelta(days=3)
    assert (await economy_repo.get_wallet(user, policy))["hearts"] == MAX_HEARTS


async def test_folder_purchase_charges_prd_price_atomically_and_replays():
    user = str(uuid4())
    policy = EconomyPolicy()
    await economy_repo.apply_entry(user, _key(), "credit_reward", policy=policy, credits_delta=125)
    results = []
    for index in range(5):
        results.append(await economy_repo.create_folder_with_charge(user, f"folder-key-{index}", f"F{index}", None, policy=policy))
    assert [-r["entry"]["credits_delta"] for r in results] == [0, 0, 0, 50, 75]
    assert results[-1]["wallet"]["credits"] == 0
    replay = await economy_repo.create_folder_with_charge(user, "folder-key-4", "f4", None, policy=policy)
    assert replay["replayed"] is True and replay["folder"]["id"] == results[-1]["folder"]["id"]
    with pytest.raises(Exception) as denied:
        await economy_repo.create_folder_with_charge(user, "folder-key-5", "F5", None, policy=policy)
    assert denied.value.detail["code"] == "INSUFFICIENT_CREDITS"
    assert sum(1 for row in folder_repo._folders.values() if row["user_id"] == user) == 5
