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
