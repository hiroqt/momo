from datetime import datetime, timezone
from app.schemas.folder import FolderCreateRequest, FolderResponse, FolderUpdateRequest
from app.schemas.study import StudySetUpdateRequest, StudySetResponse

def test_folder_create_schema_valid():
    req = FolderCreateRequest(name="Biology 101", color="#4F46E5")
    assert req.name == "Biology 101"
    assert req.color == "#4F46E5"

def test_folder_response_schema():
    now = datetime.now(timezone.utc)
    res = FolderResponse(
        id="folder-1",
        user_id="user-1",
        name="Chemistry",
        color=None,
        reviewer_count=3,
        created_at=now,
        updated_at=now
    )
    assert res.id == "folder-1"
    assert res.reviewer_count == 3

def test_studyset_update_with_folder_id():
    req = StudySetUpdateRequest(title="Exam 1", folder_id="folder-1")
    assert req.folder_id == "folder-1"
