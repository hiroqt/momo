"""Canonical PRD contracts retain compatibility without widening trust boundaries."""
from uuid import uuid4

import httpx
import pytest
from fastapi import Header
from pydantic import ValidationError

from app.db.repositories.folder_repo import folder_repo
from app.db.repositories.study_repo import study_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.main import app
from app.schemas.documents import DocumentCreate


@pytest.fixture
async def client_identity():
    owner, other = str(uuid4()), str(uuid4())

    async def identity(x_test_user: str = Header()):
        assert x_test_user in {owner, other}
        return AuthenticatedUser(x_test_user)

    app.dependency_overrides[get_current_user] = identity
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test.local") as client:
        yield client, owner, other
    app.dependency_overrides.pop(get_current_user, None)


async def test_owned_empty_container_and_embedded_detail(client_identity):
    client, owner, other = client_identity
    headers = {"x-test-user": owner}
    response = await client.post("/api/study-sets", headers=headers, json={"title": "  Biology  "})
    assert response.status_code == 201
    created = response.json()
    assert created["title"] == "Biology" and created["user_id"] == owner
    assert created["item_count"] == 0
    path = f"/api/study-sets/{created['id']}"
    assert (await client.get(path, headers=headers)).json()["study_items"] == []
    items = await study_repo.save_study_items(created["id"], [{
        "question": "What is a cell?", "answer": "A basic unit of life.",
        "type": "flashcard", "source_metadata": {"page": 1},
    }])
    detail = (await client.get(path, headers=headers)).json()
    separate = (await client.get(path + "/items", headers=headers)).json()
    assert detail["study_items"] == separate and separate[0]["id"] == items[0]["id"]
    assert (await client.get(path, headers={"x-test-user": other})).status_code == 404


@pytest.mark.parametrize("payload", [
    {"title": " "}, {"title": "x" * 256}, {"title": "T", "description": "x" * 10001},
    {"title": "T", "user_id": "forged"}, {"title": "T", "study_items": [{"answer": "fiction"}]},
    {"title": "T", "document_id": str(uuid4())}, {"title": "T", "folder_id": "invalid"},
])
async def test_custom_container_rejects_untrusted_or_unbounded_fields(client_identity, payload):
    client, owner, _ = client_identity
    response = await client.post("/api/study-sets", headers={"x-test-user": owner}, json=payload)
    assert response.status_code == 422


async def test_container_folder_ownership(client_identity):
    client, owner, other = client_identity
    folder = await folder_repo.create_folder({"user_id": other, "name": "Other's folder", "color": "#ffffff"})
    response = await client.post("/api/study-sets", headers={"x-test-user": owner},
                                 json={"title": "Private", "folder_id": folder["id"]})
    assert response.status_code == 404
    owned_folder = await folder_repo.create_folder({"user_id": owner, "name": str(uuid4()), "color": "#ffffff"})
    response = await client.post("/api/study-sets", headers={"x-test-user": owner},
                                 json={"title": "Private", "folder_id": owned_folder["id"]})
    assert response.status_code == 201 and response.json()["folder_id"] == owned_folder["id"]


async def test_sync_exact_acknowledgments_and_legacy_replay(client_identity):
    client, owner, _ = client_identity
    headers = {"x-test-user": owner}
    ids = [str(uuid4()), str(uuid4())]
    events = [{"event_id": event_id, "result": "correct", "occurred_at": "2026-10-06T00:00:00Z"} for event_id in ids]
    response = await client.post("/api/sync/events", headers=headers, json={"events": events + events[:1]})
    assert response.status_code == 200
    result = response.json()
    assert result["synced_ids"] == ids
    assert result["accepted_count"] == 2
    assert result["ignored_duplicates"] == result["ignored_duplicates_count"] == 1
    replay = (await client.post("/api/sync", headers=headers, json={"events": events})).json()
    assert replay["accepted_count"] == 0 and replay["synced_ids"] == ids
    assert replay["ignored_duplicates"] == 2
    empty = (await client.post("/api/sync/events", headers=headers, json={"events": []})).json()
    assert empty["synced_ids"] == []
    assert (await client.post("/api/sync/events", headers=headers, json={"events": events[:1] * 101})).status_code == 422


async def test_sync_invalid_reference_never_acknowledges_partial_batch(client_identity):
    client, owner, _ = client_identity
    event_id = str(uuid4())
    event = {"event_id": event_id, "result": "correct", "occurred_at": "2026-10-06T00:00:00Z"}
    response = await client.post("/api/sync/events", headers={"x-test-user": owner},
                                 json={"events": [event, {**event, "event_id": str(uuid4()), "study_item_id": str(uuid4())}]})
    assert response.status_code == 404
    retry = (await client.post("/api/sync/events", headers={"x-test-user": owner}, json={"events": [event]})).json()
    assert retry["accepted_count"] == 1 and retry["synced_ids"] == [event_id]


def test_document_registration_alias_and_conflict():
    doc_id = str(uuid4())
    payload = {"original_filename": "notes.txt", "file_type": "txt", "mime_type": "text/plain", "file_size": 10,
               "s3_object_key": "documents/private/notes.txt"}
    for identifiers in ({"id": doc_id}, {"document_id": doc_id}, {"id": doc_id, "document_id": doc_id}):
        assert DocumentCreate.model_validate({**payload, **identifiers}).document_id == doc_id
    with pytest.raises(ValidationError):
        DocumentCreate.model_validate({**payload, "id": doc_id, "document_id": str(uuid4())})


async def test_canonical_registration_end_to_end(client_identity, monkeypatch):
    from app.workers.document_worker import document_worker

    async def no_processing(document_id, user_id, s3_object_key, filename, file_type):
        return None

    monkeypatch.setattr(document_worker, "process_document", no_processing)
    client, owner, _ = client_identity
    headers = {"x-test-user": owner}
    content = b"Cells are the basic units of life."
    signed = await client.post("/api/documents/upload-url", headers=headers, json={
        "filename": "notes.txt", "file_type": "txt", "mime_type": "text/plain", "file_size": len(content),
    })
    assert signed.status_code == 200
    upload = signed.json()
    assert (await client.put(upload["upload_url"], headers=headers, content=content)).status_code == 200
    registered = await client.post("/api/documents", headers=headers, json={
        "id": upload["document_id"], "original_filename": "notes.txt", "file_type": "txt",
        "mime_type": "text/plain", "file_size": len(content), "s3_object_key": upload["s3_object_key"],
    })
    assert registered.status_code == 200
    assert registered.json()["id"] == upload["document_id"]


async def test_new_contract_routes_require_verified_identity():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test.local") as client:
        for path, payload in [("/api/study-sets", {"title": "T"}), ("/api/sync/events", {"events": []})]:
            assert (await client.post(path, json=payload)).status_code == 401


@pytest.mark.parametrize("identifiers", [
    {"id": None, "document_id": None}, {"id": None, "document_id": str(uuid4())},
    {"id": {}, "document_id": []}, {"id": "------------------------------------"},
])
def test_invalid_registration_identifiers_are_controlled(identifiers):
    with pytest.raises(ValidationError):
        DocumentCreate.model_validate({"original_filename": "n.txt", "file_type": "txt", "mime_type": "text/plain",
                                      "file_size": 1, "s3_object_key": "key", **identifiers})


# PRD section 8 endpoints (method, path). Extensions/aliases are documented in docs/API_CONTRACT_MATRIX.md.
PRD_ENDPOINTS = [
    ("GET", "/api/me"),
    ("POST", "/api/documents/upload-url"), ("POST", "/api/documents"), ("GET", "/api/documents"),
    ("GET", "/api/documents/{document_id}"), ("GET", "/api/documents/{document_id}/status"),
    ("DELETE", "/api/documents/{document_id}"),
    ("POST", "/api/generations"), ("GET", "/api/generations/{generation_id}"),
    ("POST", "/api/generations/{generation_id}/retry"),
    ("GET", "/api/study-sets"), ("POST", "/api/study-sets"), ("GET", "/api/study-sets/{study_set_id}"),
    ("PATCH", "/api/study-sets/{study_set_id}"), ("DELETE", "/api/study-sets/{study_set_id}"),
    ("POST", "/api/sync/events"),
    ("GET", "/api/folders"), ("POST", "/api/folders"), ("GET", "/api/folders/{folder_id}"),
    ("PATCH", "/api/folders/{folder_id}"), ("DELETE", "/api/folders/{folder_id}"),
    ("POST", "/api/math/solve"), ("GET", "/api/stats/streak"),
    ("GET", "/api/chat/sessions"), ("POST", "/api/chat/sessions"), ("GET", "/api/chat/sessions/{session_id}"),
    ("POST", "/api/chat/sessions/{session_id}/messages"), ("POST", "/api/chat/import-card"),
    ("POST", "/api/images/generate"),
]


def test_every_prd_endpoint_is_routed():
    # Use the generated OpenAPI document: it reflects included routers on every FastAPI version.
    paths = app.openapi()["paths"]
    routed = {(method.upper(), path) for path, operations in paths.items() for method in operations}
    missing = [endpoint for endpoint in PRD_ENDPOINTS if endpoint not in routed]
    assert missing == []
    # The legacy sync path remains as a documented, deprecated compatibility alias.
    assert ("POST", "/api/sync") in routed


def test_openapi_documents_canonical_shapes():
    spec = app.openapi()
    assert spec["paths"]["/api/sync"]["post"].get("deprecated") is True
    assert "deprecated" not in spec["paths"]["/api/sync/events"]["post"]
    sync = spec["components"]["schemas"]["SyncBatchResponse"]["properties"]
    assert {"synced_ids", "ignored_duplicates", "accepted_count", "ignored_duplicates_count"} <= set(sync)
    detail = spec["paths"]["/api/study-sets/{study_set_id}"]["get"]["responses"]["200"]["content"]
    assert detail["application/json"]["schema"]["$ref"].endswith("/StudySetDetailResponse")
    assert "study_items" in spec["components"]["schemas"]["StudySetDetailResponse"]["properties"]
    me = spec["components"]["schemas"]["UserProfileResponse"]
    assert "email" not in me.get("required", [])


async def test_profile_never_invents_account_facts(client_identity):
    from app.db.repositories.profile_repo import profile_repo
    client, owner, other = client_identity
    body = (await client.get("/api/me", headers={"x-test-user": owner})).json()
    assert body["id"] == owner
    assert body["email"] is None and body["full_name"] is None and body["avatar_url"] is None
    profile_repo._profiles[other] = {"id": other, "email": "learner@test.local", "full_name": "Real Learner",
                                     "avatar_url": None}
    try:
        seeded = (await client.get("/api/me", headers={"x-test-user": other})).json()
        assert (seeded["email"], seeded["full_name"], seeded["avatar_url"]) == ("learner@test.local", "Real Learner", None)
        # Another account's profile is never returned.
        assert (await client.get("/api/me", headers={"x-test-user": owner})).json()["full_name"] is None
    finally:
        profile_repo._profiles.pop(other, None)


async def test_profile_uses_verified_token_email_when_no_profile_row():
    async def identity():
        return AuthenticatedUser(str(uuid4()), "verified@test.local")
    app.dependency_overrides[get_current_user] = identity
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test.local") as client:
            body = (await client.get("/api/me")).json()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert body["email"] == "verified@test.local" and body["full_name"] is None
    assert body["quota_resets_at"].endswith(("T00:00:00Z", "T00:00:00+00:00"))


async def test_malformed_ids_never_reach_database_backend(client_identity, monkeypatch):
    from app.db.session import SupabaseSession
    monkeypatch.setattr(SupabaseSession, "use_memory", property(lambda self: False))
    async def unreachable(*args, **kwargs):
        raise AssertionError("repository must not be called with a malformed identifier")
    for name in ("get_study_set", "update_study_set", "delete_study_set", "get_study_items"):
        monkeypatch.setattr(study_repo, name, unreachable)
    client, owner, _ = client_identity
    headers = {"x-test-user": owner}
    for method, path in [("GET", "/api/study-sets/not-a-uuid"), ("GET", "/api/study-sets/not-a-uuid/items"),
                         ("DELETE", "/api/study-sets/1%20OR%201=1"), ("PATCH", "/api/study-sets/xyz")]:
        response = await client.request(method, path, headers=headers, json={"title": "T"} if method == "PATCH" else None)
        assert response.status_code == 404, path
        assert response.json()["error"]["code"] == "STUDY_SET_NOT_FOUND"
    response = await client.post("/api/study-sets/sessions", headers=headers, json={"study_set_id": "abc", "mode": "quiz"})
    assert response.status_code == 404


@pytest.mark.parametrize("payload", [
    {"mode": "speedrun"}, {"mode": "quiz", "study_set_id": "x" * 65},
])
async def test_session_creation_is_bounded(client_identity, payload):
    client, owner, _ = client_identity
    body = {"study_set_id": str(uuid4()), **payload}
    response = await client.post("/api/study-sets/sessions", headers={"x-test-user": owner}, json=body)
    assert response.status_code == 422


async def test_study_set_update_bounds(client_identity):
    client, owner, _ = client_identity
    headers = {"x-test-user": owner}
    created = (await client.post("/api/study-sets", headers=headers, json={"title": "Bounded"})).json()
    path = f"/api/study-sets/{created['id']}"
    assert (await client.patch(path, headers=headers, json={"description": "x" * 10001})).status_code == 422
    assert (await client.patch(path, headers=headers, json={"folder_id": str(uuid4())})).status_code == 404
    moved = await client.patch(path, headers=headers, json={"folder_id": "none", "description": " ok "})
    assert moved.status_code == 200 and moved.json()["folder_id"] is None and moved.json()["description"] == "ok"
