from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.config import settings
from app.db.session import supabase_session
from app.workers.cleanup_worker import cleanup_expired_originals


@pytest.fixture(autouse=True)
def isolated_ticket_cleanup(monkeypatch):
    from app.workers.cleanup_worker import storage_service, upload_ticket_repo
    monkeypatch.setattr(upload_ticket_repo, "claim_cleanup", AsyncMock(return_value=[]))
    monkeypatch.setattr(upload_ticket_repo, "get", AsyncMock(return_value={
        "legacy": True, "provider": storage_service.provider, "bucket": storage_service.bucket}))


class Query:
    def __init__(self, updates):
        self.updates = updates

    def __getattr__(self, name):
        def call(*args, **kwargs):
            if name == "update":
                self.updates.append(args[0])
            return self
        return call


async def test_cleanup_runs_fenced_outbox_only(monkeypatch):
    from app.workers import cleanup_worker
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    monkeypatch.setattr(supabase_session, "client", Query([]))
    cleanup = AsyncMock(return_value=2)
    monkeypatch.setattr(cleanup_worker, "cleanup_upload_tickets", cleanup)
    assert await cleanup_expired_originals(20) == 2
    cleanup.assert_awaited_once_with(20)


async def test_retention_backlog_alerts_when_oldest_overdue_exceeds_threshold(monkeypatch, caplog):
    from app.workers.cleanup_worker import report_retention_backlog
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "supabase")
    monkeypatch.setattr(supabase_session, "client", Query([]))
    monkeypatch.setattr(settings, "CLEANUP_OVERDUE_ALERT_SECONDS", 60)
    monkeypatch.setattr(supabase_session, "execute", AsyncMock(
        return_value=SimpleNamespace(data={"overdue_count": 4, "oldest_overdue_seconds": 7200})))
    assert await report_retention_backlog() == {"overdue_count": 4, "oldest_overdue_seconds": 7200,
                                               "unresolved_legacy_count": 0, "pending_probe_count": 0}
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
