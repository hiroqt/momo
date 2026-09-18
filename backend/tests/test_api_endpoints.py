import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_api_me():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/me", headers={"Authorization": "Bearer test-token-user123"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "user123"
        assert data["monthly_limit"] == 10

@pytest.mark.asyncio
async def test_upload_url_and_document_registration():
    headers = {"Authorization": "Bearer test-token-user-upload"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Request upload URL
        req = {
            "filename": "cell_biology.pdf",
            "file_type": "pdf",
            "file_size": 1048576,
            "mime_type": "application/pdf"
        }
        res = await ac.post("/api/documents/upload-url", json=req, headers=headers)
        assert res.status_code == 200
        upload_data = res.json()
        assert "upload_url" in upload_data
        assert "document_id" in upload_data

        doc_id = upload_data["document_id"]
        s3_key = upload_data["s3_object_key"]

        # Register document
        create_req = {
            "document_id": doc_id,
            "original_filename": "cell_biology.pdf",
            "file_type": "pdf",
            "mime_type": "application/pdf",
            "file_size": 1048576,
            "s3_object_key": s3_key
        }
        create_res = await ac.post("/api/documents", json=create_req, headers=headers)
        assert create_res.status_code == 200
        assert create_res.json()["id"] == doc_id

        # Check document status
        st_res = await ac.get(f"/api/documents/{doc_id}/status", headers=headers)
        assert st_res.status_code == 200
        assert "status" in st_res.json()
        assert "suggested_topics" in st_res.json()

@pytest.mark.asyncio
async def test_offline_sync_idempotency():
    headers = {"Authorization": "Bearer test-token-user-sync"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        batch = {
            "events": [
                {
                    "event_id": "evt-uuid-1",
                    "study_item_id": "item-001",
                    "result": "correct",
                    "occurred_at": "2026-09-18T08:00:00Z"
                },
                {
                    "event_id": "evt-uuid-2",
                    "study_item_id": "item-002",
                    "result": "incorrect",
                    "occurred_at": "2026-09-18T08:01:00Z"
                }
            ]
        }

        # First sync call
        res1 = await ac.post("/api/sync", json=batch, headers=headers)
        assert res1.status_code == 200
        assert res1.json()["accepted_count"] == 2
        assert res1.json()["ignored_duplicates_count"] == 0

        # Resend exact same batch (e.g. mobile network retry)
        res2 = await ac.post("/api/sync", json=batch, headers=headers)
        assert res2.status_code == 200
        assert res2.json()["accepted_count"] == 0
        assert res2.json()["ignored_duplicates_count"] == 2

@pytest.mark.asyncio
async def test_error_response_structure():
    # Calling invalid endpoint or invalid payload returns structured error
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/nonexistent")
        assert resp.status_code == 404
        data = resp.json()
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]

@pytest.mark.asyncio
async def test_delete_document_and_study_set():
    headers = {"Authorization": "Bearer test-token-user-delete"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Register a document
        doc_id = "doc-del-test-123"
        create_req = {
            "document_id": doc_id,
            "original_filename": "to_delete.pdf",
            "file_type": "pdf",
            "mime_type": "application/pdf",
            "file_size": 2048,
            "s3_object_key": "documents/user-delete/doc-del-test-123/original.pdf"
        }
        res = await ac.post("/api/documents", json=create_req, headers=headers)
        assert res.status_code == 200

        # Verify document exists in list
        docs_res = await ac.get("/api/documents", headers=headers)
        assert docs_res.status_code == 200
        assert any(d["id"] == doc_id for d in docs_res.json())

        # Delete document
        del_res = await ac.delete(f"/api/documents/{doc_id}", headers=headers)
        assert del_res.status_code == 200
        assert del_res.json()["deleted"] is True

        # Verify document no longer in list
        docs_res2 = await ac.get("/api/documents", headers=headers)
        assert not any(d["id"] == doc_id for d in docs_res2.json())

        # 2. Test Study Set Deletion
        from app.db.repositories.study_repo import study_repo
        study_set = await study_repo.create_study_set({
            "id": "set-del-test-456",
            "user_id": "user-delete",
            "title": "Bio Flashcards",
            "description": "Test set",
            "item_count": 2
        })
        await study_repo.save_study_items("set-del-test-456", [
            {"id": "item-1", "type": "flashcard", "question": "Q1", "answer": "A1", "difficulty": "easy", "source_metadata": {}}
        ])

        sets_res = await ac.get("/api/study-sets", headers=headers)
        assert any(s["id"] == "set-del-test-456" for s in sets_res.json())

        # Delete study set
        del_set_res = await ac.delete("/api/study-sets/set-del-test-456", headers=headers)
        assert del_set_res.status_code == 200
        assert del_set_res.json()["deleted"] is True

        # Verify study set no longer exists
        sets_res2 = await ac.get("/api/study-sets", headers=headers)
        assert not any(s["id"] == "set-del-test-456" for s in sets_res2.json())

@pytest.mark.asyncio
async def test_rename_study_set_title():
    user_id = "user-rename-test"
    headers = {"Authorization": f"Bearer test-token-{user_id}"}
    other_headers = {"Authorization": "Bearer test-token-other-user"}

    from app.db.repositories.study_repo import study_repo
    set_id = "set-rename-123"
    await study_repo.create_study_set({
        "id": set_id,
        "user_id": user_id,
        "title": "Original Quiz Title",
        "description": "Original Description",
        "item_count": 5
    })

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Successful rename
        rename_res = await ac.patch(
            f"/api/study-sets/{set_id}",
            json={"title": "Updated Anatomy Quiz", "description": "Updated Description"},
            headers=headers
        )
        assert rename_res.status_code == 200
        data = rename_res.json()
        assert data["title"] == "Updated Anatomy Quiz"
        assert data["description"] == "Updated Description"

        # Verify via GET
        get_res = await ac.get(f"/api/study-sets/{set_id}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["title"] == "Updated Anatomy Quiz"

        # 2. Blank title should fail with 422
        blank_res = await ac.patch(
            f"/api/study-sets/{set_id}",
            json={"title": "   "},
            headers=headers
        )
        assert blank_res.status_code == 422

        # 3. Nonexistent study set should return 404
        nf_res = await ac.patch(
            "/api/study-sets/nonexistent-set",
            json={"title": "New Title"},
            headers=headers
        )
        assert nf_res.status_code == 404

        # 4. Another user cannot rename this study set
        unauth_res = await ac.patch(
            f"/api/study-sets/{set_id}",
            json={"title": "Hacked Title"},
            headers=other_headers
        )
        assert unauth_res.status_code == 404


