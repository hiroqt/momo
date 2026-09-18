import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.chunks_repo import chunks_repo
from app.domain.documents.models import DocumentChunk
from app.workers.generation_worker import generation_worker

@pytest.mark.asyncio
async def test_end_to_end_generation_pipeline():
    user_id = "e2e-student-01"
    headers = {"Authorization": f"Bearer test-token-{user_id}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Register a document
        doc = await documents_repo.create({
            "id": "e2e-doc-123",
            "user_id": user_id,
            "original_filename": "anatomy.pdf",
            "file_type": "pdf",
            "mime_type": "application/pdf",
            "file_size": 2048,
            "s3_object_key": "documents/e2e/doc123.pdf",
            "processing_status": "READY" # Ready for reviewer generation
        })

        # 2. Seed realistic chunks with anatomy topics
        chunk1 = DocumentChunk(
            chunk_id="chk-1",
            document_id=doc["id"],
            chunk_index=0,
            content="The cardiovascular system consists of the heart, blood vessels, and blood. The left ventricle pumps oxygenated blood into the aorta.",
            page_start=12,
            page_end=12,
            section="Heart Anatomy",
            source_type="pdf",
            embedding=[0.05] * 1536
        )
        chunk2 = DocumentChunk(
            chunk_id="chk-2",
            document_id=doc["id"],
            chunk_index=1,
            content="Systemic circulation delivers oxygen to tissues throughout the body, returning deoxygenated blood through the vena cava.",
            page_start=14,
            page_end=14,
            section="Circulatory Circuits",
            source_type="pdf",
            embedding=[0.05] * 1536
        )
        await chunks_repo.save_chunks(doc["id"], user_id, [chunk1, chunk2])

        # 3. Request Generation
        gen_req = {
            "document_id": doc["id"],
            "topic": "Cardiovascular System",
            "count": 4,
            "difficulty": "hard",
            "question_types": ["flashcard", "multiple_choice"]
        }
        gen_res = await ac.post("/api/generations", json=gen_req, headers=headers)
        assert gen_res.status_code == 200
        gen_data = gen_res.json()
        job_id = gen_data["generation_id"]
        assert gen_data["status"] == "PENDING"

        # 4. Process generation directly with worker
        await generation_worker.process_generation(
            job_id=job_id,
            user_id=user_id,
            document_id=doc["id"],
            generation_spec=gen_req
        )

        # 5. Check generation status
        status_res = await ac.get(f"/api/generations/{job_id}", headers=headers)
        assert status_res.status_code == 200
        status_data = status_res.json()
        assert status_data["status"] == "COMPLETED"
        assert status_data["progress"] == 100
        assert status_data["study_set_id"] is not None
        study_set_id = status_data["study_set_id"]

        # 6. Fetch generated study set items
        items_res = await ac.get(f"/api/study-sets/{study_set_id}/items", headers=headers)
        assert items_res.status_code == 200
        items = items_res.json()
        assert len(items) >= 1

        first_item = items[0]
        assert "question" in first_item
        assert "answer" in first_item
        assert "source_metadata" in first_item
        assert first_item["source_metadata"]["page"] in [12, 14]

@pytest.mark.asyncio
async def test_retrieval_query_builder_with_custom_instruction():
    from app.services.retrieval.retrieval_service import retrieval_service
    # Without instruction
    q1 = retrieval_service.build_search_query("Cellular Respiration")
    assert q1 == "Cellular Respiration"

    # With custom instruction
    q2 = retrieval_service.build_search_query("Cellular Respiration", "Focus on Krebs cycle enzymes and ATP yield")
    assert "Cellular Respiration" in q2
    assert "Krebs cycle enzymes" in q2

@pytest.mark.asyncio
async def test_openrouter_nemotron_payload_and_parallel_batching(monkeypatch):
    from app.services.ai.ai_provider import OpenRouterNemotronProvider
    provider = OpenRouterNemotronProvider(api_key="test-sk-key", model="nvidia/nemotron-3-ultra-550b-a55b:free")

    recorded_payloads = []

    async def fake_call_nemotron(system_prompt: str, user_prompt: str, timeout: float = 35.0):
        # Record what was requested
        import json
        recorded_payloads.append({"system": system_prompt, "user": user_prompt})
        return {
            "items": [
                {
                    "type": "flashcard",
                    "question": "Which molecule initiates glycolysis?",
                    "answer": "Glucose",
                    "explanation": "Grounded in source evidence.",
                    "difficulty": "hard",
                    "source_ref_id": 1
                }
            ]
        }

    monkeypatch.setattr(provider, "_call_nemotron", fake_call_nemotron)

    generation_spec = {
        "topic": "Glycolysis",
        "count": 16, # Should trigger parallel batching (16 > 8)
        "difficulty": "hard",
        "question_types": ["flashcard", "multiple_choice"],
        "custom_instruction": "Focus on rate-limiting enzyme phosphofructokinase"
    }
    sources = [{"source_id": 1, "page": 4, "section": "Biochemistry", "snippet": "Glycolysis starts with glucose..."}]

    items = await provider.generate_study_material(
        system_instruction="Generate reviewer",
        generation_spec=generation_spec,
        source_evidence="[Source #1 | Page 4 | Section: Biochemistry]\nGlucose enters glycolysis.",
        sources_metadata=sources
    )

    # Verify that multiple batches were spawned in parallel for 16 items
    assert len(recorded_payloads) >= 2
    # Verify custom instruction was injected into prompt
    assert any("phosphofructokinase" in p["system"] for p in recorded_payloads)
    assert any("DIFFICULTY LEVEL - HARD" in p["system"] for p in recorded_payloads)
    # Verify items returned
    assert len(items) >= 2
    assert items[0]["answer"] == "Glucose"
    assert items[0]["source_metadata"]["page"] == 4

@pytest.mark.asyncio
async def test_multiple_choice_options_randomized():
    from app.services.ai.ai_provider import MockNemotronProvider
    mock_provider = MockNemotronProvider()
    spec = {
        "topic": "Cardiovascular",
        "count": 12,
        "difficulty": "medium",
        "question_types": ["multiple_choice"]
    }
    items = await mock_provider.generate_study_material("sys", spec, "The left ventricle pumps oxygenated blood into the aorta.", [])
    mcq_items = [i for i in items if i["type"] == "multiple_choice"]
    assert len(mcq_items) > 0
    indices = [item["options"].index(item["answer"]) for item in mcq_items if item["answer"] in item["options"]]
    assert len(indices) == len(mcq_items)
    # Over 12 items, positions must be distributed, not all at index 0
    assert any(idx != 0 for idx in indices), "Correct answer was always at index 0 (A)!"

@pytest.mark.asyncio
async def test_identification_hint_generated():
    from app.services.ai.ai_provider import MockNemotronProvider
    mock_provider = MockNemotronProvider()
    spec = {
        "topic": "Cardiovascular",
        "count": 4,
        "difficulty": "medium",
        "question_types": ["identification"]
    }
    items = await mock_provider.generate_study_material("sys", spec, "The left ventricle pumps oxygenated blood into the aorta.", [])
    id_items = [i for i in items if i["type"] == "identification"]
    assert len(id_items) > 0
    assert "hint" in id_items[0]
    assert len(id_items[0]["hint"]) > 0

@pytest.mark.asyncio
async def test_mock_provider_supports_high_item_count():
    from app.services.ai.ai_provider import MockNemotronProvider
    mock_provider = MockNemotronProvider()
    spec = {
        "topic": "Cardiovascular",
        "count": 35,
        "difficulty": "medium",
        "question_types": ["flashcard", "multiple_choice"]
    }
    items = await mock_provider.generate_study_material("sys", spec, "The left ventricle pumps oxygenated blood into the aorta. Systemic circulation delivers oxygen to tissues.", [])
    assert len(items) == 35
    flashcard_items = [i for i in items if i["type"] == "flashcard"]
    assert len(flashcard_items) > 0
