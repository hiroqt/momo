"""Upload URL constraints and mock first-write behavior through local API routes."""
from test_api_tenancy import tenant_client as tenant_client

from app.api.routes import documents
from app.services.storage.s3_service import S3Service


async def test_signed_constraints_and_mock_upload_ownership_are_preserved(tenant_client, monkeypatch):
    client, owner, foreign = tenant_client
    storage = S3Service()
    monkeypatch.setattr(documents, "storage_service", storage)
    signed = await client.post("/api/documents/upload-url", headers={"x-test-user": owner}, json={
        "filename": "synthetic.txt", "file_type": "txt", "file_size": 3, "mime_type": "text/plain"})
    assert signed.status_code == 200
    result = signed.json()
    assert result["upload_headers"] == {"Content-Type": "text/plain", "If-None-Match": "*"}
    path = result["upload_url"]
    denied = await client.put(path, headers={"x-test-user": foreign}, content=b"bad")
    assert denied.status_code == 400
    assert result["s3_object_key"] not in storage._mock_storage
    empty = await client.put(path, headers={"x-test-user": owner}, content=b"")
    assert empty.status_code == 400
    uploaded = await client.put(path, headers={"x-test-user": owner, **result["upload_headers"]}, content=b"one")
    assert uploaded.status_code == 200
    metadata = storage.get_object_metadata(result["s3_object_key"])
    repeated = await client.put(path, headers={"x-test-user": owner}, content=b"two")
    assert repeated.status_code == 409
    assert repeated.json()["error"]["code"] == "UPLOAD_ALREADY_EXISTS"
    assert storage.get_object_bytes(result["s3_object_key"]) == b"one"
    assert storage.get_object_metadata(result["s3_object_key"]) == metadata


async def test_local_binary_upload_accepts_exact_file_limit_and_rejects_larger(tenant_client, monkeypatch):
    from uuid import uuid4

    from app.config import settings

    client, owner, _ = tenant_client
    storage = S3Service()
    monkeypatch.setattr(documents, "storage_service", storage)
    limit = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    signed = await client.post("/api/documents/upload-url", headers={"x-test-user": owner}, json={
        "filename": "large.txt", "file_type": "txt", "file_size": limit, "mime_type": "text/plain"})
    assert signed.status_code == 200
    key = signed.json()["s3_object_key"]
    response = await client.put('/api/documents/mock-upload/'+key,
                                headers={"x-test-user": owner}, content=b"a" * limit)
    assert response.status_code == 200
    assert storage.get_object_size(key) == limit
    other = storage.build_object_key(owner, str(uuid4()), "txt")
    response = await client.put('/api/documents/mock-upload/'+other,
        headers={"x-test-user": owner, "content-length": str(limit + 1)}, content=b"a")
    assert response.status_code == 413
    assert other not in storage._mock_storage


async def test_mock_put_requires_durable_ticket_and_rejects_retired_destination(tenant_client, monkeypatch):
    from uuid import uuid4

    from app.db.repositories.upload_ticket_repo import upload_ticket_repo
    client, owner, _ = tenant_client
    storage = S3Service()
    monkeypatch.setattr(documents, "storage_service", storage)
    unknown = storage.build_object_key(owner, str(uuid4()), "txt")
    denied = await client.put("/api/documents/mock-upload/" + unknown, headers={"x-test-user": owner}, content=b"abc")
    assert denied.status_code == 409 and unknown not in storage._mock_storage
    issued = (await client.post("/api/documents/upload-url", headers={"x-test-user": owner}, json={
        "filename": "a.txt", "file_type": "txt", "file_size": 3, "mime_type": "text/plain"})).json()
    assert await upload_ticket_repo.retire(issued["document_id"], owner)
    denied = await client.put(issued["upload_url"], headers={"x-test-user": owner}, content=b"abc")
    assert denied.status_code == 409 and issued["s3_object_key"] not in storage._mock_storage
