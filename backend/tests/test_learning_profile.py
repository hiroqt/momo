import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.repositories.learning_repo import learning_repo
from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.chunks_repo import chunks_repo
from app.domain.documents.models import DocumentChunk
from app.services.embeddings.embedding_service import embedding_service

@pytest.mark.asyncio
async def test_learning_repo_analytics():
    user_id = "test-learner-1"
    # Record multiple study events
    await learning_repo.record_study_event(user_id, topic="Python Arrays", question="What is slice syntax?", result="correct")
    await learning_repo.record_study_event(user_id, topic="Python Arrays", question="What is array indexing?", result="correct")
    await learning_repo.record_study_event(user_id, topic="Python Arrays", question="What is array memory layout?", result="correct")
    await learning_repo.record_study_event(user_id, topic="Recursion", question="What is the base case?", result="incorrect", user_answer="Infinite loop")
    await learning_repo.record_study_event(user_id, topic="Recursion", question="What is call stack overflow?", result="incorrect", user_answer="Heap memory")

    profile = await learning_repo.get_learning_profile(user_id)
    assert profile["user_id"] == user_id
    assert profile["total_reviews"] == 5
    assert profile["accuracy_rate"] == 0.60
    assert profile["mastery_score"] == 60
    assert "Python Arrays" in profile["strong_topics"]
    assert "Recursion" in profile["weak_topics"]
    assert len(profile["recent_missed_questions"]) == 2
    assert any("Recursion" in r for r in profile["recommended_focus"])

@pytest.mark.asyncio
async def test_learning_adaptive_difficulty():
    user_id = "test-learner-2"
    # User with low accuracy gets easy difficulty
    await learning_repo.record_study_event(user_id, topic="Calculus", result="incorrect")
    await learning_repo.record_study_event(user_id, topic="Calculus", result="incorrect")
    await learning_repo.record_study_event(user_id, topic="Calculus", result="incorrect")
    diff = await learning_repo.get_adaptive_difficulty(user_id, "Calculus")
    assert diff == "easy"

    # User with high accuracy gets hard difficulty
    adv_user = "test-learner-3"
    for _ in range(5):
        await learning_repo.record_study_event(adv_user, topic="Linear Algebra", result="correct")
    diff_adv = await learning_repo.get_adaptive_difficulty(adv_user, "Linear Algebra")
    assert diff_adv == "hard"

@pytest.mark.asyncio
async def test_chat_learning_profile_intent():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-learner-chat-1"}

        # Populate some study events
        await learning_repo.record_study_event("learner-chat-1", topic="Biology", question="What is Mitochondria?", result="correct")
        await learning_repo.record_study_event("learner-chat-1", topic="Chemistry", question="What is covalent bond?", result="incorrect")

        # Create chat session
        session_resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = session_resp.json()["id"]

        # Ask learning progress
        chat_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "How am I doing in my studies? What are my weak spots?"},
            headers=headers
        )
        assert chat_resp.status_code == 200
        res = chat_resp.json()
        assert res["role"] == "assistant"
        content_lower = res["content"].lower()
        assert "learning profile" in content_lower or "mastery" in content_lower or "chemistry" in content_lower

@pytest.mark.asyncio
async def test_chat_weakness_review_generation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-learner-chat-2"}

        # Populate missed study event
        await learning_repo.record_study_event("learner-chat-2", topic="Binary Trees", question="What is binary tree depth?", result="incorrect")

        # Create session
        session_resp = await ac.post("/api/chat/sessions", json={}, headers=headers)
        session_id = session_resp.json()["id"]

        # Request weakness review
        rev_resp = await ac.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "Review what I missed and quiz me on my mistakes"},
            headers=headers
        )
        assert rev_resp.status_code == 200
        res = rev_resp.json()
        assert res["role"] == "assistant"
        assert res["created_deck"] is not None
        deck = res["created_deck"]
        assert deck["item_count"] >= 3
        assert "study_set_id" in deck
