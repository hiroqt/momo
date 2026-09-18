import pytest
from datetime import datetime, timezone, timedelta
from app.db.repositories.usage_repo import usage_repo
from app.db.repositories.study_repo import study_repo
from app.db.repositories.documents_repo import documents_repo
from app.services.storage.s3_service import s3_service
from app.config import settings

@pytest.mark.asyncio
async def test_monthly_quota_enforcement():
    test_user = "quota-test-user-01"
    # Should start at 0
    usage = await usage_repo.get_monthly_usage(test_user)
    assert usage == 0
    assert await usage_repo.can_upload_document(test_user)

    # Increment up to limit
    for _ in range(settings.MONTHLY_DOCUMENT_LIMIT):
        await usage_repo.increment_usage(test_user)

    assert await usage_repo.get_monthly_usage(test_user) == settings.MONTHLY_DOCUMENT_LIMIT
    # Cannot upload 11th
    assert not await usage_repo.can_upload_document(test_user)

def test_s3_retention_days():
    now = datetime.now(timezone.utc)
    expires = s3_service.calculate_expiration(now)
    diff = expires - now
    assert diff.days == 3

@pytest.mark.asyncio
async def test_study_set_persists_after_document_delete():
    user_id = "test-retention-user"
    # 1. Create document
    doc = await documents_repo.create({
        "user_id": user_id,
        "original_filename": "test.pdf",
        "file_type": "pdf",
        "mime_type": "application/pdf",
        "file_size": 1024,
        "s3_object_key": "documents/test/key.pdf",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        "processing_status": "READY"
    })

    # 2. Create study set referencing document
    study_set = await study_repo.create_study_set({
        "user_id": user_id,
        "document_id": doc["id"],
        "title": "Persistent Reviewer",
        "item_count": 10
    })

    # 3. Simulate 3-day expiration: Delete document
    deleted = await documents_repo.delete(doc["id"], user_id)
    assert deleted

    # 4. Verify study set remains intact!
    retrieved_set = await study_repo.get_study_set(study_set["id"], user_id)
    assert retrieved_set is not None
    assert retrieved_set["title"] == "Persistent Reviewer"
