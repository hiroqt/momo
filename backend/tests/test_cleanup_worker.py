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


async def test_retention_backlog_alerts_when_oldest_overdue_exceeds_threshold(monkeypatch, caplog):
    from app.workers.cleanup_worker import report_retention_backlog
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    monkeypatch.setattr(supabase_session, "client", Query([]))
    monkeypatch.setattr(settings, "CLEANUP_OVERDUE_ALERT_SECONDS", 60)
    monkeypatch.setattr(supabase_session, "execute", AsyncMock(
        return_value=SimpleNamespace(data={"overdue_count": 4, "oldest_overdue_seconds": 7200})))
    assert await report_retention_backlog() == {"overdue_count": 4, "oldest_overdue_seconds": 7200}
    assert "RETENTION_OVERDUE" in caplog.text


async def test_retention_backlog_failure_is_reported_without_details(monkeypatch, caplog):
    from app.workers.cleanup_worker import report_retention_backlog
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    monkeypatch.setattr(supabase_session, "client", Query([]))
    monkeypatch.setattr(supabase_session, "execute", AsyncMock(side_effect=RuntimeError("db password leak")))
    assert (await report_retention_backlog())["overdue_count"] == 0
    assert "Retention backlog check failed" in caplog.text and "leak" not in caplog.text


async def test_worker_maintenance_schedules_cleanup_and_recovery(monkeypatch):
    from app.workers import cleanup_worker
    from app.workers.job_queue import JobQueue
    from app.workers.runner import JobRunner
    cleanup = AsyncMock(side_effect=RuntimeError("storage outage"))
    backlog = AsyncMock(return_value={})
    monkeypatch.setattr(cleanup_worker, "cleanup_expired_originals", cleanup)
    monkeypatch.setattr(cleanup_worker, "report_retention_backlog", backlog)
    queue = JobQueue()
    recover = AsyncMock(return_value=2)
    monkeypatch.setattr(queue, "recover_orphans", recover)
    await JobRunner(queue, {}, worker_id="maint").maintain()  # failures do not stop the worker
    cleanup.assert_awaited_once()
    backlog.assert_awaited_once()
    recover.assert_awaited_once()


async def test_cleanup_rejects_unbounded_batches():
    for size in (0, 101):
        with pytest.raises(ValueError):
            await cleanup_expired_originals(size)


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
