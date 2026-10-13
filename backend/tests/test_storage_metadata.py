"""Provider creation timestamps and conditional upload contracts (no network)."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta, timezone
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import boto3
import httpx
import pytest
from botocore.config import Config
from botocore.exceptions import ClientError
from storage3 import SyncStorageClient
from storage3.exceptions import StorageApiError

from app.config import settings
from app.db.session import supabase_session
from app.services.storage.base import (
    ObjectAlreadyExistsError,
    ObjectNotFoundError,
    StorageUnavailableError,
    validated_metadata,
)
from app.services.storage.s3_service import S3Service
from app.services.storage.supabase_storage_service import SupabaseStorageService


@pytest.mark.parametrize("provider", [S3Service, SupabaseStorageService])
def test_memory_creation_time_is_stable_and_concurrent_overwrite_is_rejected(provider):
    service = provider()
    before = datetime.now(UTC)
    service.save_mock_object("original.txt", b"first")
    metadata = service.get_object_metadata("original.txt")
    assert before <= metadata.uploaded_at <= datetime.now(UTC)
    assert metadata.size == 5 and metadata.identity
    with pytest.raises(ObjectAlreadyExistsError):
        service.save_mock_object("original.txt", b"replacement")
    assert service.get_object_metadata("original.txt") == metadata
    assert service.get_object_bytes("original.txt") == b"first"

    def upload(_):
        try:
            service.save_mock_object("race.txt", b"same")
            return True
        except StorageUnavailableError:
            return False

    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(upload, range(8))) == 1
    service.delete_object("original.txt")
    with pytest.raises(ObjectNotFoundError):
        service.get_object_metadata("original.txt")


@pytest.mark.parametrize("timestamp", [None, "", "broken", "2026-10-08T10:00:00", datetime(2026, 10, 8), 123])
def test_missing_malformed_or_naive_timestamp_never_becomes_current_time(timestamp):
    with pytest.raises(StorageUnavailableError):
        validated_metadata(12, timestamp)


@pytest.mark.parametrize("size", [None, True, "12", 0, -1, 16 * 1024 * 1024])
def test_metadata_rejects_invalid_sizes(size):
    with pytest.raises(StorageUnavailableError):
        validated_metadata(size, datetime.now(UTC))


def test_aware_provider_timestamp_normalizes_to_utc_without_changing_instant():
    timestamp = datetime(2020, 10, 8, 10, tzinfo=timezone(timedelta(hours=8)))
    assert validated_metadata(12, timestamp).uploaded_at == datetime(2020, 10, 8, 2, tzinfo=UTC)
    with pytest.raises(StorageUnavailableError):
        validated_metadata(12, timestamp, version={"unexpected": "object"})


def test_s3_metadata_retains_write_timestamp_etag_and_version(monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    service = S3Service()
    stamp = datetime(2020, 10, 8, tzinfo=UTC)
    service.client = SimpleNamespace(head_object=lambda **kwargs: {"ContentLength": 12, "LastModified": stamp, "VersionId": "version-one", "ETag": '"etag"'})
    metadata = service.get_object_metadata("key")
    assert metadata.uploaded_at == stamp and metadata.size == 12
    assert metadata.version == "version-one" and metadata.etag == '"etag"'
    service.client = SimpleNamespace(head_object=lambda **kwargs: {"ContentLength": 12, "LastModified": "invalid-private-time"})
    with pytest.raises(StorageUnavailableError) as failure:
        service.get_object_metadata("key")
    assert "invalid-private-time" not in str(failure.value)


def test_locked_botocore_presigns_if_none_match_without_network(monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    service = S3Service()
    client = boto3.client("s3", region_name="us-east-1", aws_access_key_id="synthetic-" + "access",
        aws_secret_access_key="synthetic-" + "secret", config=Config(signature_version="s3v4"))
    try:
        assert "IfNoneMatch" in client.meta.service_model.operation_model("PutObject").input_shape.members
        service.client = client
        signed = service.generate_presigned_upload_url("key", "text/plain")
        headers = parse_qs(urlsplit(signed).query)["X-Amz-SignedHeaders"][0].split(";")
        assert "if-none-match" in headers and "content-type" in headers
        assert service.get_upload_headers("text/plain") == {"Content-Type": "text/plain", "If-None-Match": "*"}
    finally:
        client.close()


def test_locked_supabase_sdk_signs_no_upsert_and_info_uses_authoritative_created_at(monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    requests = []
    stamp = "2020-10-08T02:00:00.000Z"

    def respond(request):
        requests.append(request)
        if request.method == "POST":
            return httpx.Response(200, json={"url": "/object/upload/sign/documents/key?token=synthetic-token"})
        return httpx.Response(200, json={"id": "object-id", "version": "version-id", "size": 12,
            "created_at": stamp, "last_modified": "2099-01-01T00:00:00Z", "etag": '"e"'})

    with httpx.Client(transport=httpx.MockTransport(respond)) as transport:
        storage = SyncStorageClient("http://127.0.0.1:54321/storage/v1/", {}, http_client=transport)
        monkeypatch.setattr(supabase_session, "client", SimpleNamespace(storage=storage))
        service = SupabaseStorageService()
        service.generate_presigned_upload_url("key", "text/plain")
        assert requests[0].headers["x-upsert"] == "false"
        metadata = service.get_object_metadata("key")
        assert metadata.uploaded_at == datetime(2020, 10, 8, 2, tzinfo=UTC)
        assert metadata.identity == "object-id" and metadata.version == "version-id"
        assert service.get_upload_headers("text/plain") == {"Content-Type": "text/plain"}


def test_supabase_last_modified_alone_is_not_upload_creation_time(monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    bucket = SimpleNamespace(info=lambda _: {"size": 12, "last_modified": "2026-10-08T00:00:00Z"})
    monkeypatch.setattr(supabase_session, "client", SimpleNamespace(storage=SimpleNamespace(from_=lambda _: bucket)))
    with pytest.raises(StorageUnavailableError):
        SupabaseStorageService().get_object_metadata("key")


def test_provider_clock_skew_is_bounded_and_no_header_injection():
    assert validated_metadata(12, datetime.now(UTC) + timedelta(minutes=4)).uploaded_at.tzinfo == UTC
    with pytest.raises(StorageUnavailableError):
        validated_metadata(12, datetime.now(UTC) + timedelta(minutes=6))
    for service in (S3Service(), SupabaseStorageService()):
        with pytest.raises(StorageUnavailableError):
            service.get_upload_headers("text/plain\r\nAuthorization: private")


@pytest.mark.parametrize("status,code,missing", [(404, "404", True), (404, "NoSuchKey", True),
    (403, "AccessDenied", False), (404, "NoSuchBucket", False), (500, "InternalError", False)])
def test_s3_metadata_missing_object_is_distinct_from_outage_or_access_denial(monkeypatch, status, code, missing):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")

    def head(**kwargs):
        raise ClientError({"Error": {"Code": code, "Message": "private-provider-data"}, "ResponseMetadata": {"HTTPStatusCode": status}}, "HeadObject")

    service = S3Service()
    service.client = SimpleNamespace(head_object=head)
    with pytest.raises(StorageUnavailableError) as failure:
        service.get_object_metadata("key")
    assert isinstance(failure.value, ObjectNotFoundError) is missing
    assert "private-provider-data" not in str(failure.value)


@pytest.mark.parametrize("status,code,missing", [(404, "ObjectNotFound", True), ("404", "NoSuchKey", True),
    (403, "AccessDenied", False), (404, "NoSuchBucket", False), (404, "LibraryError", False), (500, "InternalError", False)])
def test_supabase_metadata_missing_object_is_distinct_from_malformed_error_or_outage(monkeypatch, status, code, missing):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")

    def info(_):
        raise StorageApiError("private-provider-data", code, status)

    monkeypatch.setattr(supabase_session, "client", SimpleNamespace(storage=SimpleNamespace(from_=lambda _: SimpleNamespace(info=info))))
    with pytest.raises(StorageUnavailableError) as failure:
        SupabaseStorageService().get_object_metadata("key")
    assert isinstance(failure.value, ObjectNotFoundError) is missing
    assert "private-provider-data" not in str(failure.value)


@pytest.mark.parametrize("provider", [S3Service, SupabaseStorageService])
def test_memory_object_with_corrupt_metadata_is_not_confirmed_absent(provider):
    service = provider()
    service.save_mock_object("key", b"data")
    service._mock_metadata.clear()
    with pytest.raises(StorageUnavailableError) as failure:
        service.get_object_metadata("key")
    assert not isinstance(failure.value, ObjectNotFoundError)


@pytest.mark.parametrize("provider", [S3Service, SupabaseStorageService])
def test_provider_timeout_never_counts_as_confirmed_absence(monkeypatch, provider):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")

    def unavailable(*args, **kwargs):
        raise TimeoutError("private-provider-data")

    service = provider()
    if isinstance(service, S3Service):
        service.client = SimpleNamespace(head_object=unavailable)
    else:
        monkeypatch.setattr(supabase_session, "client", SimpleNamespace(storage=SimpleNamespace(from_=lambda _: SimpleNamespace(info=unavailable))))
    with pytest.raises(StorageUnavailableError) as failure:
        service.get_object_metadata("key")
    assert not isinstance(failure.value, ObjectNotFoundError)
    assert "private-provider-data" not in str(failure.value)


@pytest.mark.parametrize("provider", [S3Service, SupabaseStorageService])
def test_stale_observation_cannot_delete_recreated_bytes(provider):
    service = provider()
    service.save_mock_object("original.txt", b"same")
    stale = service.get_object_metadata("original.txt")
    service.delete_object("original.txt")
    service.save_mock_object("original.txt", b"same")
    assert not service.delete_observed_object("original.txt", stale)
    assert service.get_object_bytes("original.txt") == b"same"
    current = service.get_object_metadata("original.txt")
    assert service.delete_observed_object("original.txt", current)
    with pytest.raises(ObjectNotFoundError):
        service.get_object_metadata("original.txt")


def test_s3_automatic_deletion_addresses_observed_version_only(monkeypatch):
    from app.services.storage.base import ObjectMetadata
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    service = S3Service()
    calls = []
    service.client = SimpleNamespace(delete_object=lambda **kwargs: calls.append(kwargs))
    metadata = ObjectMetadata(3, datetime.now(UTC), version="immutable-version", etag="same-bytes")
    assert service.delete_observed_object("original.txt", metadata)
    assert calls == [{"Bucket": service.bucket, "Key": "original.txt", "VersionId": "immutable-version"}]
    with pytest.raises(StorageUnavailableError):
        service.delete_observed_object("original.txt", ObjectMetadata(3, datetime.now(UTC), etag="same-bytes"))
    assert len(calls) == 1


def test_hosted_supabase_automatic_deletion_fails_closed_without_generation_predicate(monkeypatch):
    from app.services.storage.base import ObjectMetadata
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    monkeypatch.setattr(supabase_session, "client", object())
    service = SupabaseStorageService()
    with pytest.raises(StorageUnavailableError):
        service.delete_observed_object("original.txt", ObjectMetadata(3, datetime.now(UTC), identity="object-id"))


def test_s3_retirement_removes_bounded_versions_instead_of_creating_delete_marker(monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    service = S3Service()
    calls = []
    service.client = SimpleNamespace(
        list_object_versions=lambda **kwargs: {"Versions": [{"Key": "key", "VersionId": "one"},
            {"Key": "key-other", "VersionId": "unrelated"}], "DeleteMarkers": [{"Key": "key", "VersionId": "marker"}], "IsTruncated": True},
        delete_object=lambda **kwargs: calls.append(kwargs))
    assert not service.delete_object("key")  # another bounded batch remains
    assert calls == [{"Bucket": service.bucket, "Key": "key", "VersionId": "one"},
                     {"Bucket": service.bucket, "Key": "key", "VersionId": "marker"}]
    assert all("VersionId" in call for call in calls)


def test_s3_cleanup_absence_requires_no_hidden_physical_versions(monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    service = S3Service()

    def absent(**kwargs):
        raise ClientError({"Error": {"Code": "NoSuchKey"}, "ResponseMetadata": {"HTTPStatusCode": 404}}, "HeadObject")

    service.client = SimpleNamespace(head_object=absent, list_object_versions=lambda **kwargs: {
        "Versions": [{"Key": "key", "VersionId": "hidden"}]})
    with pytest.raises(StorageUnavailableError) as failure:
        service.get_object_metadata("key", for_cleanup=True)
    assert not isinstance(failure.value, ObjectNotFoundError)
    service.client = SimpleNamespace(head_object=absent, list_object_versions=lambda **kwargs: {"Versions": [], "IsTruncated": False})
    with pytest.raises(ObjectNotFoundError):
        service.get_object_metadata("key", for_cleanup=True)


@pytest.mark.parametrize("size", [0, 16 * 1024 * 1024, 5 * 1024**4])
def test_s3_janitor_can_inspect_rejected_upload_size_without_downloading(monkeypatch, size):
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    service = S3Service()
    service.client = SimpleNamespace(head_object=lambda **kwargs: {
        "ContentLength": size, "LastModified": datetime.now(UTC), "VersionId": "oversized-generation"})
    with pytest.raises(StorageUnavailableError):
        service.get_object_metadata("key")
    assert service.get_object_metadata("key", for_cleanup=True).size == size
