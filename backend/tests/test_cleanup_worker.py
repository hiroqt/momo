from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.config import settings
from app.db.session import supabase_session
from app.workers.cleanup_worker import cleanup_expired_originals


class Query:
    def __init__(self, updates):
        self.updates = updates

    def __getattr__(self, name):
        def call(*args, **kwargs):
            if name == "update":
                self.updates.append(args[0])
            return self
        return call


async def test_cleanup_marks_expired_only_after_storage_deletion(monkeypatch):
    from app.workers.cleanup_worker import storage_service
    user, doc = str(uuid4()), str(uuid4())
    record = {"id": doc, "user_id": user, "file_type": "txt",
              "s3_object_key": f"documents/{user}/{doc}/original.txt"}
    updates = []
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    monkeypatch.setattr(supabase_session, "client", Query(updates))
    execute = AsyncMock(side_effect=[SimpleNamespace(data=[record]), SimpleNamespace(data=[])])
    monkeypatch.setattr(supabase_session, "execute", execute)
    monkeypatch.setattr(storage_service, "delete_object", lambda key: True)
    assert await cleanup_expired_originals() == 1
    assert updates[0]["processing_status"] == "EXPIRED"
    assert execute.await_count == 2


async def test_cleanup_failure_keeps_record_retryable(monkeypatch):
    from app.workers.cleanup_worker import storage_service
    user, doc = str(uuid4()), str(uuid4())
    record = {"id": doc, "user_id": user, "file_type": "txt",
              "s3_object_key": f"documents/{user}/{doc}/original.txt"}
    updates = []
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    monkeypatch.setattr(supabase_session, "client", Query(updates))
    monkeypatch.setattr(supabase_session, "execute", AsyncMock(return_value=SimpleNamespace(data=[record])))
    monkeypatch.setattr(storage_service, "delete_object", lambda key: False)
    with pytest.raises(RuntimeError):
        await cleanup_expired_originals()
    assert updates == []
