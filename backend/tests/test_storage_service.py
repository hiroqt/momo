from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.config import settings
from app.services.storage import (
    BaseStorageService,
    S3Service,
    SupabaseStorageService,
    get_storage_service,
    storage_service,
)
from app.services.storage.base import StorageUnavailableError


def test_storage_service_implements_base():
    assert isinstance(storage_service, BaseStorageService)

def test_supabase_storage_key_building():
    service = SupabaseStorageService()
    user_id, document_id = str(uuid4()), str(uuid4())
    key = service.build_object_key(user_id, document_id, "pdf")
    assert key == f"documents/{user_id}/{document_id}/original.pdf"

    # Also test leading dot in extension
    key_dot = service.build_object_key(user_id, document_id, ".docx")
    assert key_dot == f"documents/{user_id}/{document_id}/original.docx"

def test_storage_expiration_calculation():
    service = SupabaseStorageService()
    now = datetime.now(UTC)
    expires = service.calculate_expiration(now)
    assert (expires - now).days == settings.DOCUMENT_RETENTION_DAYS

def test_supabase_storage_mock_upload_and_bytes():
    service = SupabaseStorageService()
    test_key = "documents/test-user/test-doc/original.txt"
    test_data = b"Hello Supabase Storage Unit Test"

    # Save mock object
    service.save_mock_object(test_key, test_data)

    # Retrieve object bytes
    retrieved = service.get_object_bytes(test_key)
    assert retrieved == test_data

    # Generate upload url returns mock route when unconfigured
    url = service.generate_presigned_upload_url(test_key, "text/plain")
    assert test_key in url

    # Delete object
    assert service.delete_object(test_key)
    with pytest.raises(StorageUnavailableError):
        service.get_object_bytes(test_key)

def test_s3_service_backward_compatibility():
    service = S3Service()
    test_key = "documents/test-user/test-doc/original.pdf"
    test_data = b"Sample S3 Test Content"
    service.save_mock_object(test_key, test_data)
    assert service.get_object_bytes(test_key) == test_data
    assert service.delete_object(test_key)

def test_get_storage_service_factory(monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_PROVIDER", "supabase")
    service = get_storage_service()
    assert isinstance(service, SupabaseStorageService)

    monkeypatch.setattr(settings, "STORAGE_PROVIDER", "s3")
    service_s3 = get_storage_service()
    assert isinstance(service_s3, S3Service)
