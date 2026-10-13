"""Request limits deny work before parsing, persistence, or provider dispatch."""

import json

import httpx
import pytest
from pydantic import ValidationError

from app.main import app
from app.schemas.chat import ChatSessionCreate, ImportCardRequest
from app.schemas.folder import FolderCreateRequest, FolderUpdateRequest
from app.services.security.request_limits import RequestBodyLimitMiddleware


async def run_stream(chunks, headers=(), max_bytes=8):
    invoked = []
    outgoing = []
    messages = [{"type": "http.request", "body": chunk, "more_body": i < len(chunks) - 1}
                for i, chunk in enumerate(chunks)]

    async def receive():
        assert messages, "Unexpected extra body read"
        return messages.pop(0)

    async def send(message):
        outgoing.append(message)

    async def downstream(scope, receive, send):
        invoked.append(await receive())
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    middleware = RequestBodyLimitMiddleware(downstream, max_bytes=max_bytes)
    await middleware({"type": "http", "method": "POST", "headers": list(headers)}, receive, send)
    return invoked, outgoing, messages


@pytest.mark.parametrize("headers", [[], [(b"content-length", b"1")], [(b"transfer-encoding", b"chunked")]])
async def test_stream_cap_cannot_be_bypassed(headers):
    invoked, outgoing, _ = await run_stream([b"12345", b"6789"], headers)
    assert not invoked
    assert outgoing[0]["status"] == 413
    assert json.loads(outgoing[1]["body"])["error"]["code"] == "REQUEST_TOO_LARGE"
    assert b"12345" not in outgoing[1]["body"]


async def test_oversized_declared_length_rejects_without_receiving_body():
    invoked, outgoing, unread = await run_stream([b"private"], [(b"content-length", b"9" * 5000)])
    assert not invoked and unread
    assert outgoing[0]["status"] == 413


async def test_below_cap_and_exact_cap_streams_replay_complete_body():
    for chunks in ([b"12", b"34"], [b"1234", b"5678"]):
        invoked, outgoing, unread = await run_stream(chunks)
        assert outgoing[0]["status"] == 200
        assert invoked == [{"type": "http.request", "body": b"".join(chunks), "more_body": False}]
        assert not unread


async def test_application_wiring_denies_before_auth_or_provider():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test.local") as client:
        response = await client.post("/api/chat", content=b"{}", headers={"content-length": str(11 * 1024 * 1024)})
    assert response.status_code == 413
    assert response.json() == {"error": {"code": "REQUEST_TOO_LARGE", "message": "The request exceeds the allowed size."}}


@pytest.mark.parametrize("model,payload", [
    (ChatSessionCreate, {"title": "x" * 201}),
    (ImportCardRequest, {"question": "Q", "answer": "A", "options": ["x" * 2001]}),
    (ImportCardRequest, {"question": "Q", "answer": "A", "image_base64": "x" * 8_000_001}),
    (FolderCreateRequest, {"name": "Biology", "color": "x" * 65}),
    (FolderUpdateRequest, {"color": "x" * 65}),
])
def test_untrusted_text_fields_are_bounded(model, payload):
    with pytest.raises(ValidationError):
        model(**payload)


def test_existing_theme_tags_and_source_metadata_remain_compatible():
    assert FolderCreateRequest(name="Biology", color="lavender").color == "lavender"
    assert FolderUpdateRequest(color="#4F46E5").color == "#4F46E5"
    card = ImportCardRequest(question="Q", answer="A", options=["A"], source_metadata={"document_id": "id", "page": 1})
    assert card.source_metadata == {"document_id": "id", "page": 1}
