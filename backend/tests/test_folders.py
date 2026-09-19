import pytest
from app.db.repositories.folder_repo import folder_repo, calculate_folder_credit_cost
from app.db.repositories.study_repo import study_repo

@pytest.mark.asyncio
async def test_calculate_folder_credit_cost():
    assert calculate_folder_credit_cost(0) == 0
    assert calculate_folder_credit_cost(1) == 0
    assert calculate_folder_credit_cost(2) == 0
    assert calculate_folder_credit_cost(3) == 50   # 4th folder costs 50
    assert calculate_folder_credit_cost(4) == 75   # 5th folder costs 75
    assert calculate_folder_credit_cost(5) == 100  # 6th folder costs 100
    assert calculate_folder_credit_cost(6) == 125  # 7th folder costs 125

@pytest.mark.asyncio
async def test_folder_crud_and_study_set_detach():
    user_id = "test-user-folders"
    # 1. Create Folder
    f = await folder_repo.create_folder({"user_id": user_id, "name": "Physics", "color": "#4F46E5"})
    assert f["name"] == "Physics"
    assert f["color"] == "#4F46E5"
    folder_id = f["id"]

    # 2. Create Study Set assigned to Folder
    s = await study_repo.create_study_set({
        "user_id": user_id,
        "title": "Quantum Mechanics",
        "folder_id": folder_id
    })
    assert s.get("folder_id") == folder_id

    # 3. List folders and verify reviewer count
    folders = await folder_repo.list_folders(user_id)
    target = next((x for x in folders if x["id"] == folder_id), None)
    assert target is not None
    assert target["reviewer_count"] == 1

    # 4. Update folder
    updated = await folder_repo.update_folder(folder_id, user_id, {"name": "Modern Physics"})
    assert updated is not None
    assert updated["name"] == "Modern Physics"

    # 5. Delete folder and ensure study set is NOT deleted, but unassigned
    deleted = await folder_repo.delete_folder(folder_id, user_id)
    assert deleted is True

    # Study set should still exist, with folder_id unassigned
    updated_s = await study_repo.get_study_set(s["id"], user_id)
    assert updated_s is not None
    assert updated_s.get("folder_id") is None

@pytest.mark.asyncio
async def test_folders_api_endpoints():
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    headers = {"Authorization": "Bearer test-token-folder-api-user"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Create a study set
        ss_resp = await study_repo.create_study_set({
            "user_id": "folder-api-user",
            "title": "Anatomy Quiz"
        })
        study_set_id = ss_resp["id"]

        # 2. List folders initially
        res = await ac.get("/api/folders", headers=headers)
        assert res.status_code == 200
        initial_folders = res.json()

        # 3. Create folder
        create_res = await ac.post("/api/folders", json={"name": "Medical School", "color": "#10B981"}, headers=headers)
        assert create_res.status_code == 201
        folder = create_res.json()
        assert folder["name"] == "Medical School"
        folder_id = folder["id"]

        # 4. Duplicate name fails with 400
        dup_res = await ac.post("/api/folders", json={"name": "medical school"}, headers=headers)
        assert dup_res.status_code == 400

        # 5. Assign study set to folder via PATCH /api/study-sets/{id}
        patch_ss = await ac.patch(f"/api/study-sets/{study_set_id}", json={"folder_id": folder_id}, headers=headers)
        assert patch_ss.status_code == 200
        assert patch_ss.json()["folder_id"] == folder_id

        # 6. Verify reviewer_count is 1
        get_res = await ac.get(f"/api/folders/{folder_id}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["reviewer_count"] == 1

        # 7. Rename folder
        rename_res = await ac.patch(f"/api/folders/{folder_id}", json={"name": "Medicine"}, headers=headers)
        assert rename_res.status_code == 200
        assert rename_res.json()["name"] == "Medicine"

        # 8. Unassign study set from folder
        unassign_ss = await ac.patch(f"/api/study-sets/{study_set_id}", json={"folder_id": ""}, headers=headers)
        assert unassign_ss.status_code == 200
        assert unassign_ss.json()["folder_id"] is None

        # 9. Delete folder
        del_res = await ac.delete(f"/api/folders/{folder_id}", headers=headers)
        assert del_res.status_code == 200
        assert del_res.json()["deleted"] is True
