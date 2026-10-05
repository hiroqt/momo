import hashlib
import io
import zipfile
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.config import settings
from app.db.session import supabase_session
from app.services.storage.base import StorageUnavailableError
from app.services.storage.s3_service import S3Service
from app.services.storage.supabase_storage_service import SupabaseStorageService
from app.workers.document_worker import validate_document_bytes


@pytest.fixture
def local_storage(monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "memory")
    monkeypatch.setattr(settings, "ENVIRONMENT", "test")
    monkeypatch.setattr(supabase_session, "client", None)


@pytest.mark.parametrize("provider", [S3Service, SupabaseStorageService])
def test_mock_storage_never_invents_missing_content(local_storage, provider):
    storage = provider()
    with pytest.raises(StorageUnavailableError):
        storage.get_object_bytes("missing.pdf")
    storage.save_mock_object("present.txt", b"lecture")
    assert storage.get_object_bytes("present.txt") == b"lecture"
    assert storage.get_object_size("present.txt") == 7
    storage.delete_object("present.txt")
    with pytest.raises(StorageUnavailableError):
        storage.get_object_bytes("present.txt")


@pytest.mark.parametrize("provider", [S3Service, SupabaseStorageService])
def test_mock_storage_disabled_in_production(monkeypatch, provider):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with pytest.raises(StorageUnavailableError):
        provider().save_mock_object("x", b"content")


def test_live_storage_failure_does_not_return_mock_url(monkeypatch):
    from types import SimpleNamespace
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    bucket = SimpleNamespace(create_signed_upload_url=lambda **kw: {})
    fake = SimpleNamespace(storage=SimpleNamespace(from_=lambda name: bucket))
    monkeypatch.setattr(supabase_session, "client", fake)
    with pytest.raises(StorageUnavailableError):
        SupabaseStorageService().generate_presigned_upload_url("key", "text/plain")


@pytest.mark.parametrize("content,kind,size", [
    (b"", "txt", 0), (b"hello", "txt", 4), (b"fake", "pdf", 4),
    (b"\x00binary", "txt", 7), (b"\xff", "txt", 1), (b"zip", "docx", 3),
    (b"file", "exe", 4),
])
def test_rejects_invalid_actual_file_bytes(content, kind, size):
    with pytest.raises((ValueError, zipfile.BadZipFile)):
        validate_document_bytes(content, kind, size)


def test_office_archive_structure_and_expansion_are_validated():
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "types")
        archive.writestr("word/document.xml", "document")
    data = stream.getvalue()
    validate_document_bytes(data, "docx", len(data))
    with pytest.raises(ValueError):
        validate_document_bytes(data, "pptx", len(data))
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", b"0" * (101 * 1024 * 1024))
    data = stream.getvalue()
    with pytest.raises(ValueError, match="expands"):
        validate_document_bytes(data, "docx", len(data))


def test_storage_key_rejects_path_injection(local_storage):
    storage = SupabaseStorageService()
    owner, doc = str(uuid4()), str(uuid4())
    assert storage.build_object_key(owner, doc, ".PDF") == f"documents/{owner}/{doc}/original.pdf"
    with pytest.raises(ValueError):
        storage.build_object_key("../other-user", doc, "pdf")
    with pytest.raises(ValueError):
        storage.build_object_key(owner, doc, "../pdf")


async def test_worker_records_actual_sha256_and_hides_failures(local_storage, monkeypatch):
    import app.workers.document_worker as module
    from app.workers.document_worker import DocumentWorker
    owner, doc = str(uuid4()), str(uuid4())
    payload = b"Private lecture"
    repo = module.documents_repo
    monkeypatch.setattr(repo, "get_by_id", AsyncMock(return_value={"file_size": len(payload)}))
    monkeypatch.setattr(repo, "update_status", AsyncMock())
    monkeypatch.setattr(repo, "set_content_hash", AsyncMock())
    monkeypatch.setattr(module.storage_service, "get_object_bytes", lambda key: payload)
    monkeypatch.setattr(module.extractor_service, "extract_document", AsyncMock(
        side_effect=RuntimeError("secret-provider-credentials")
    ))
    await DocumentWorker().process_document(
        doc, owner, f"documents/{owner}/{doc}/original.txt", "lecture.txt", "txt"
    )
    repo.set_content_hash.assert_awaited_once_with(doc, owner, hashlib.sha256(payload).hexdigest())
    assert repo.update_status.call_args.kwargs["error"] == "The uploaded document could not be processed."
