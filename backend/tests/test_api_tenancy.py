"""Local ASGI transport exercises routing, validation, ownership and persistence."""

from uuid import uuid4

import httpx
import pytest
from fastapi import Header

from app.db.repositories.study_repo import study_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.main import app


@pytest.fixture
async def tenant_client():
    alice, bob = str(uuid4()), str(uuid4())

    async def identity(x_test_user: str = Header()):
        assert x_test_user in {alice, bob}
        return AuthenticatedUser(x_test_user)

    app.dependency_overrides[get_current_user] = identity
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test.local"
    ) as client:
        yield client, alice, bob
    app.dependency_overrides.pop(get_current_user, None)


async def test_two_users_cannot_read_mutate_or_start_sessions_for_each_other(tenant_client):
    client, alice, bob = tenant_client
    own = await study_repo.create_study_set({"user_id": alice, "title": "Private deck"})
    await study_repo.create_study_set({"user_id": bob, "title": "Bob deck"})
    await study_repo.save_study_items(own["id"], [{
        "question": "Private question", "answer": "Private answer",
        "type": "flashcard", "source_metadata": {},
    }])
    bob_headers = {"x-test-user": bob}
    listed = await client.get("/api/study-sets", headers=bob_headers)
    assert listed.status_code == 200
    assert all(row["user_id"] == bob for row in listed.json())
    for method, suffix, payload in [
        ("GET", "", None), ("GET", "/items", None),
        ("PATCH", "", {"title": "Stolen"}), ("DELETE", "", None),
    ]:
        response = await client.request(
            method, f"/api/study-sets/{own['id']}{suffix}",
            headers=bob_headers, json=payload,
        )
        assert response.status_code == 404
        assert "Private" not in response.text
    session = await client.post("/api/study-sets/sessions", headers=bob_headers,
                                json={"study_set_id": own["id"], "mode": "quiz"})
    assert session.status_code == 404
    unchanged = await study_repo.get_study_set(own["id"], alice)
    assert unchanged["title"] == "Private deck"


async def test_owner_updates_reviews_and_deletes_deck(tenant_client):
    client, alice, _ = tenant_client
    headers = {"x-test-user": alice}
    own = await study_repo.create_study_set({"user_id": alice, "title": "Original"})
    item = {"question": "Q", "answer": "A", "type": "flashcard", "source_metadata": {}}
    await study_repo.save_study_items(own["id"], [item])
    updated = await client.patch(f"/api/study-sets/{own['id']}", headers=headers,
                                 json={"title": "Renamed"})
    assert updated.status_code == 200
    assert updated.json()["title"] == "Renamed"
    items = await client.get(f"/api/study-sets/{own['id']}/items", headers=headers)
    assert items.status_code == 200 and len(items.json()) == 1
    session = await client.post("/api/study-sets/sessions", headers=headers,
                                json={"study_set_id": own["id"], "mode": "quiz"})
    assert session.status_code == 200
    assert session.json()["total_items"] == 1
    assert session.json()["user_id"] == alice
    deleted = await client.delete(f"/api/study-sets/{own['id']}", headers=headers)
    assert deleted.status_code == 200
    assert (await client.get(f"/api/study-sets/{own['id']}", headers=headers)).status_code == 404


async def test_validation_error_does_not_echo_untrusted_values(tenant_client):
    client, alice, _ = tenant_client
    private_value = "private-sensitive-value" * 30
    response = await client.patch(f"/api/study-sets/{uuid4()}",
                                  headers={"x-test-user": alice}, json={"title": private_value})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert private_value not in response.text


async def test_authentication_required_without_override():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                                base_url="http://test.local") as client:
        for path in ["/api/documents", "/api/study-sets", "/api/folders", "/api/stats/streak"]:
            result = await client.get(path)
            assert result.status_code == 401
            assert "error" in result.json()


async def test_sync_retries_do_not_duplicate_learning_side_effects(tenant_client, monkeypatch):
    client, alice, bob = tenant_client
    from unittest.mock import AsyncMock

    from app.db.repositories.learning_repo import learning_repo
    record = AsyncMock()
    monkeypatch.setattr(learning_repo, "record_study_event", record)
    event = {"event_id": str(uuid4()), "result": "correct", "occurred_at": "2026-10-06T00:00:00Z"}
    body = {"events": [event, event]}
    first = await client.post("/api/sync", headers={"x-test-user": alice}, json=body)
    assert first.status_code == 200
    assert first.json()["accepted_count"] == 1
    assert first.json()["ignored_duplicates_count"] == 1
    replay = await client.post("/api/sync", headers={"x-test-user": alice}, json=body)
    assert replay.status_code == 200 and replay.json()["accepted_count"] == 0
    assert record.await_count == 1
    other = await client.post("/api/sync", headers={"x-test-user": bob}, json={"events": [event]})
    assert other.status_code == 200 and other.json()["accepted_count"] == 1
    assert record.await_count == 2


async def test_sync_invalid_batch_never_partially_commits(tenant_client):
    client, alice, bob = tenant_client
    deck = await study_repo.create_study_set({"user_id": alice, "title": "Private"})
    saved = await study_repo.save_study_items(deck["id"], [
        {"type": "flashcard", "question": "Q", "answer": "A", "source_metadata": {}}
    ])
    event = {"event_id": str(uuid4()), "result": "correct", "occurred_at": "2026-10-06T00:00:00Z"}
    invalid = {**event, "event_id": str(uuid4()), "study_item_id": saved[0]["id"]}
    response = await client.post("/api/sync", headers={"x-test-user": bob},
                                 json={"events": [event, invalid]})
    assert response.status_code == 404
    retry = await client.post("/api/sync", headers={"x-test-user": bob}, json={"events": [event]})
    assert retry.status_code == 200 and retry.json()["accepted_count"] == 1
