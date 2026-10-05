import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.chunks_repo import chunks_repo
from app.domain.documents.models import DocumentChunk

@pytest.fixture(autouse=True)
async def setup_test_data():
    # Set up sample document and chunks for test user
    doc = await documents_repo.create({
        "id": "doc-chat-test-01",
        "user_id": "chat-user-1",
        "original_filename": "Cell_Biology_Notes.pdf",
        "storage_key": "docs/test/original.pdf",
        "mime_type": "application/pdf",
        "file_size_bytes": 1024,
        "page_count": 15,
        "processing_status": "READY",
        "suggested_topics": ["Mitochondria", "Cell Division", "Mitosis"]
    })

    from app.services.embeddings.embedding_service import embedding_service
    c1_text = "The mitochondrion is known as the powerhouse of the cell because it generates most of the chemical energy needed to power the cell's biochemical reactions through ATP synthesis."
    c2_text = "Mitosis is a process of cell duplication, in which one cell divides into two genetically identical daughter cells through prophase, metaphase, anaphase, and telophase."
    embeddings = await embedding_service.embed_texts([c1_text, c2_text])

    chunk1 = DocumentChunk(
        chunk_id="chunk-chat-1",
        document_id="doc-chat-test-01",
        chunk_index=0,
        content=c1_text,
        page_start=3,
        page_end=3,
        section="Mitochondria and Energy",
        source_type="text",
        embedding=embeddings[0],
        metadata={"document_id": "doc-chat-test-01"}
    )
    chunk2 = DocumentChunk(
        chunk_id="chunk-chat-2",
        document_id="doc-chat-test-01",
        chunk_index=1,
        content=c2_text,
        page_start=8,
        page_end=8,
        section="Cell Division",
        source_type="text",
        embedding=embeddings[1],
        metadata={"document_id": "doc-chat-test-01"}
    )
    await chunks_repo.save_chunks("doc-chat-test-01", "chat-user-1", [chunk1, chunk2])

@pytest.mark.asyncio
async def test_chat_session_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-chat-user-1"}

        # 1. Create Session
        resp = await ac.post("/api/chat/sessions", json={"title": "Biology Exam Prep"}, headers=headers)
        assert resp.status_code == 200
        session_data = resp.json()
        assert session_data["title"] == "Biology Exam Prep"
        session_id = session_data["id"]

        # 2. List Sessions
        resp = await ac.get("/api/chat/sessions", headers=headers)
        assert resp.status_code == 200
        sessions = resp.json()
        assert any(s["id"] == session_id for s in sessions)

        # 3. Get Session Detail
        resp = await ac.get(f"/api/chat/sessions/{session_id}", headers=headers)
        assert resp.status_code == 200
        detail = resp.json()
        assert detail["session"]["id"] == session_id
        assert detail["messages"] == []

        # 4. Delete Session
        del_resp = await ac.delete(f"/api/chat/sessions/{session_id}", headers=headers)
        assert del_resp.status_code == 200
        assert del_resp.json()["status"] == "deleted"

        # Verify not found after deletion
        get_again = await ac.get(f"/api/chat/sessions/{session_id}", headers=headers)
        assert get_again.status_code == 404

@pytest.mark.asyncio
async def test_chat_message_general_greeting():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-chat-user-1"}

        # Create session
        resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = resp.json()["id"]

        # Send greeting
        msg_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "Hey Momo, how are you today?"},
            headers=headers
        )
        assert msg_resp.status_code == 200
        res = msg_resp.json()
        assert res["role"] == "assistant"
        assert len(res["content"]) > 5

@pytest.mark.asyncio
async def test_chat_tool_list_user_documents():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-chat-user-1"}

        resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = resp.json()["id"]

        # Ask what documents are uploaded
        msg_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "What documents do I have uploaded?"},
            headers=headers
        )
        assert msg_resp.status_code == 200
        res = msg_resp.json()
        assert res["role"] == "assistant"
        assert "Cell_Biology_Notes.pdf" in res["content"]
        assert any(t["tool_name"] == "list_user_documents" for t in (res.get("tool_calls") or []))

@pytest.mark.asyncio
async def test_chat_tool_search_documents_grounding():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-chat-user-1"}

        resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = resp.json()["id"]

        # Ask question about mitochondria
        msg_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "Explain what the mitochondria does according to my notes"},
            headers=headers
        )
        assert msg_resp.status_code == 200
        res = msg_resp.json()
        assert res["role"] == "assistant"
        assert res["citations"] is not None
        assert len(res["citations"]) > 0
        assert res["citations"][0]["document_name"] == "Cell_Biology_Notes.pdf"
        assert any(t["tool_name"] == "search_documents" for t in (res.get("tool_calls") or []))

@pytest.mark.asyncio
async def test_chat_tool_create_study_deck():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-chat-user-1"}

        resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = resp.json()["id"]

        # Request Momo to build a deck
        msg_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "Build me a 5-question flashcard deck on Cell Division from my Biology notes"},
            headers=headers
        )
        assert msg_resp.status_code == 200
        res = msg_resp.json()
        assert res["role"] == "assistant"
        assert res["created_deck"] is not None
        deck = res["created_deck"]
        assert deck["item_count"] >= 3
        assert "study_set_id" in deck
        assert any(t["tool_name"] == "create_study_deck" for t in (res.get("tool_calls") or []))

        # Verify the created study set is actually accessible via study-sets API
        set_resp = await ac.get(f"/api/study-sets/{deck['study_set_id']}", headers=headers)
        assert set_resp.status_code == 200
        assert set_resp.json()["id"] == deck["study_set_id"]

@pytest.mark.asyncio
async def test_chat_quick_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-chat-user-2"}

        # Use quick endpoint directly
        resp = await ac.post(
            "/api/chat",
            json={"content": "Hello Momo, start a study chat!"},
            headers=headers
        )
        assert resp.status_code == 200
        res = resp.json()
        assert res["role"] == "assistant"
        assert res["session_id"] is not None

@pytest.mark.asyncio
async def test_chat_user_isolation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # User 1 creates session
        resp1 = await ac.post("/api/chat/sessions", json={"title": "Private Session"}, headers={"Authorization": "Bearer test-token-user-a"})
        session_a_id = resp1.json()["id"]

        # User 2 tries to access User 1's session
        resp2 = await ac.get(f"/api/chat/sessions/{session_a_id}", headers={"Authorization": "Bearer test-token-user-b"})
        assert resp2.status_code == 404

        # User 2 tries to send message in User 1's session
        resp3 = await ac.post(
            f"/api/chat/sessions/{session_a_id}/messages",
            json={"content": "Hacking into user A"},
            headers={"Authorization": "Bearer test-token-user-b"}
        )
        assert resp3.status_code == 404

@pytest.mark.asyncio
async def test_deck_request_without_topic_asks_source_options():
    """When user clicks 'Build a 10-card flashcard deck' without topic, Momo asks how to build it with topic chips."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-fresh-user-1"}

        resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = resp.json()["id"]

        msg_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "Build a 10-card flashcard deck"},
            headers=headers
        )
        assert msg_resp.status_code == 200
        res = msg_resp.json()
        assert res["role"] == "assistant"
        # Must not say "upload a document first"
        assert "first upload a document" not in res["content"].lower()
        assert "how would you like to build it" in res["content"].lower() or "topic" in res["content"].lower()
        assert res["quick_replies"] is not None
        assert len(res["quick_replies"]) >= 2
        assert any("Python Arrays" in qr for qr in res["quick_replies"])

@pytest.mark.asyncio
async def test_deck_request_with_topic_no_docs_asks_ai_build():
    """When user specifies 'create me 10 flashcards about arrays using Python' with no documents, Momo asks if AI should build it."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-fresh-user-2"}

        resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = resp.json()["id"]

        msg_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "create me 10 flashcards about arrays using Python"},
            headers=headers
        )
        assert msg_resp.status_code == 200
        res = msg_resp.json()
        assert res["role"] == "assistant"
        assert "arrays using python" in res["content"].lower() or "python" in res["content"].lower()
        # Must give option to build with Momo AI
        assert "build it with momo ai" in res["content"].lower() or "momo ai" in res["content"].lower()
        assert res["quick_replies"] is not None
        assert any("Let Momo build" in qr or "Momo AI" in qr for qr in res["quick_replies"])

@pytest.mark.asyncio
async def test_user_confirms_ai_build_creates_deck():
    """When user confirms 'Let the AI build', Momo generates the 10-card deck directly."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-fresh-user-3"}

        resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = resp.json()["id"]

        # Step 1: Prompt on arrays using Python
        await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "create me 10 flashcards about arrays using Python"},
            headers=headers
        )

        # Step 2: User confirms "Let the AI build"
        confirm_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "Let Momo build Arrays using Python deck"},
            headers=headers
        )
        assert confirm_resp.status_code == 200
        res = confirm_resp.json()
        assert res["role"] == "assistant"
        assert res["created_deck"] is not None
        deck = res["created_deck"]
        assert deck["item_count"] == 10
        assert "study_set_id" in deck
        assert "arrays using python" in deck["title"].lower()

        # Verify set and items in database
        set_resp = await ac.get(f"/api/study-sets/{deck['study_set_id']}", headers=headers)
        assert set_resp.status_code == 200
        assert set_resp.json()["item_count"] == 10

        items_resp = await ac.get(f"/api/study-sets/{deck['study_set_id']}/items", headers=headers)
        assert items_resp.status_code == 200
        items = items_resp.json()
        assert len(items) == 10

@pytest.mark.asyncio
async def test_deck_request_followed_by_custom_topic_generates_deck():
    """
    When user clicks 'Build a 10-card flashcard deck' (or 'Generate 10 flashcard decks for me'),
    and Momo asks for the topic, when the user inputs a custom topic not in the suggestions
    (e.g., 'Java arrays'), Momo immediately generates the 10-card deck without reprompting.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-fresh-user-4"}

        resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = resp.json()["id"]

        # Step 1: User says "Generate 10 flashcard decks for me"
        turn1 = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "Generate 10 flashcard decks for me"},
            headers=headers
        )
        assert turn1.status_code == 200
        res1 = turn1.json()
        assert res1["role"] == "assistant"
        assert res1["created_deck"] is None
        assert "topic" in res1["content"].lower() or "how would you like to build it" in res1["content"].lower()

        # Step 2: User provides custom topic "Java arrays"
        turn2 = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "Java arrays"},
            headers=headers
        )
        assert turn2.status_code == 200
        res2 = turn2.json()
        assert res2["role"] == "assistant"
        # Must NOT fallback to "I'd like to" or reprompt
        assert "i'd like to help you" not in res2["content"].lower()
        assert res2["created_deck"] is not None
        deck = res2["created_deck"]
        assert deck["item_count"] == 10
        assert "Java Arrays" in deck["title"] or "java arrays" in deck["title"].lower()

        # Step 3: Verify set in database
        set_resp = await ac.get(f"/api/study-sets/{deck['study_set_id']}", headers=headers)
        assert set_resp.status_code == 200
        assert set_resp.json()["item_count"] == 10

        items_resp = await ac.get(f"/api/study-sets/{deck['study_set_id']}/items", headers=headers)
        assert items_resp.status_code == 200
        assert len(items_resp.json()) == 10

@pytest.mark.asyncio
async def test_chat_generate_image_diagram():
    """User prompts 'generate me a image diagram of Photosynthesis' -> returns study card with visual diagram image_base64."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-fresh-user-5"}

        resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = resp.json()["id"]

        msg_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "generate me a image diagram of Photosynthesis"},
            headers=headers
        )
        assert msg_resp.status_code == 200
        res = msg_resp.json()
        assert res["role"] == "assistant"
        assert res["study_card"] is not None
        card = res["study_card"]
        assert "Photosynthesis" in card["topic"] or "Photosynthesis" in card["question"]
        assert card["image_base64"] is not None
        assert len(card["image_base64"]) > 20
        assert "Photosynthesis" in (card.get("diagram_prompt") or "")

@pytest.mark.asyncio
async def test_chat_diagram_follow_up_explanation():
    """Generating an image gives a concise image message, and follow-up provides the in-depth details in the next chat."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-fresh-user-7"}

        resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = resp.json()["id"]

        # 1. Ask for diagram -> concise image generation
        msg1_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "generate me a diagram of Human Heart"},
            headers=headers
        )
        assert msg1_resp.status_code == 200
        res1 = msg1_resp.json()
        assert res1["image_base64"] is not None
        assert "Visual concept diagram" in res1["content"]
        assert len(res1["content"]) < 150  # Concise, not dumping full lecture text
        assert res1["quick_replies"] is not None
        assert any("Explain" in qr for qr in res1["quick_replies"])

        # 2. Ask follow-up -> in-depth details in the follow-up chat
        msg2_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "Explain this diagram in detail"},
            headers=headers
        )
        assert msg2_resp.status_code == 200
        res2 = msg2_resp.json()
        # Follow-up should explain the diagram, NOT generate another diagram
        assert "In-Depth Breakdown" in res2["content"]
        assert "Core Mechanism" in res2["content"] or "Components" in res2["content"]
        assert res2.get("image_base64") is None or res2.get("tool_calls") is None

@pytest.mark.asyncio
async def test_chat_generate_educational_diagram_without_topic_sanitizes_cleanly():
    """When user requests 'can you generate me an educational diagram', it must not extract 'An Educational'."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-fresh-user-8"}

        resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = resp.json()["id"]

        msg_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "can you generate me an educational diagram"},
            headers=headers
        )
        assert msg_resp.status_code == 200
        res = msg_resp.json()
        assert res["role"] == "assistant"
        card = res.get("study_card")
        assert card is not None
        assert card["topic"] != "An Educational"
        assert "An Educational" not in card["question"]

        # Verify follow_up_message details
        follow_up = res.get("follow_up_message")
        assert follow_up is not None
        fu_content = follow_up.get("content", "")
        assert "An Educational" not in fu_content
        # Must not contain redundant numbered bullets like "- **1."
        assert "- **1." not in fu_content
        assert "- **2." not in fu_content


@pytest.mark.asyncio
async def test_chat_command_create_quiz_on_topic_direct():
    """When a user commands 'Create me a 10 items quiz regarding to polygons', Momo creates the study deck directly."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-poly-direct-user"}

        resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        assert resp.status_code == 200
        session_id = resp.json()["id"]

        msg_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "Create me a 10 items quiz regarding to polygons"},
            headers=headers
        )
        assert msg_resp.status_code == 200
        res = msg_resp.json()
        assert res["role"] == "assistant"

        # Verify created deck metadata
        deck = res.get("created_deck")
        assert deck is not None, f"Expected created_deck metadata in response, got: {res}"
        assert deck["status"] == "COMPLETED"
        assert deck["item_count"] == 10
        assert deck["question_types"] == ["multiple_choice"]
        assert "Polygons" in deck["title"]

        # Content must be clean, devoid of raw XML tags or emojis
        assert "<tool_call>" not in res["content"]
        assert "<function" not in res["content"]
        assert "</tool_call>" not in res["content"]

        # Quick replies should allow jumping right into studying
        assert res.get("quick_replies") is not None
        assert len(res["quick_replies"]) >= 2

        # Verify study items persisted in study repo
        items_resp = await ac.get(f"/api/study-sets/{deck['study_set_id']}/items", headers=headers)
        assert items_resp.status_code == 200
        items = items_resp.json()
        assert len(items) == 10
        assert all(it["type"] == "multiple_choice" for it in items)
        assert all(isinstance(it.get("options"), list) and len(it["options"]) >= 2 for it in items)


def test_chat_agent_parses_xml_tool_call():
    """Verify parse_tool_calls_from_text accurately extracts XML function calls emitted by Nemotron."""
    import json
    from app.services.ai.ai_provider import parse_tool_calls_from_text

    raw_xml = (
        "Here is what I will do:\n"
        "<tool_call><function=create_study_deck><topic>polygons</topic><count>10</count><allow_ai_generation>True</allow_ai_generation></function></tool_call>"
    )
    calls, cleaned = parse_tool_calls_from_text(raw_xml)
    assert len(calls) == 1
    call = calls[0]
    assert call["function"]["name"] == "create_study_deck"
    args = json.loads(call["function"]["arguments"])
    assert args["topic"] == "polygons"
    assert args["count"] == 10
    assert args["allow_ai_generation"] is True
    assert "<tool_call>" not in cleaned
    assert "<function=" not in cleaned
