from types import SimpleNamespace

import pytest

from scripts import reindex_embeddings_v2


class FakeQuery:
    def __init__(self, pages):
        self.pages = pages
        self.filters = []

    def __getattr__(self, _name):
        return lambda *args, **kwargs: self

    def execute(self):
        return SimpleNamespace(data=self.pages.pop(0))


class FakeClient:
    def __init__(self, pages):
        self.query = FakeQuery(pages)

    def table(self, _name):
        return self.query


@pytest.mark.asyncio
async def test_reindex_cli_dry_run_pages_and_never_calls_provider(monkeypatch):
    client = FakeClient([[{"id": "doc-1", "user_id": "owner-1"}], []])

    class Session:
        is_configured = True

        def __init__(self):
            self.client = client

        async def execute(self, query):
            return query.execute()

    class Repository:
        async def reindex_document_embeddings_v2(self, *_args):
            raise AssertionError("dry run must not reindex")

    monkeypatch.setattr(reindex_embeddings_v2, "supabase_session", Session())
    monkeypatch.setattr(reindex_embeddings_v2, "chunks_repo", Repository())
    assert await reindex_embeddings_v2.run(10, execute=False) == (1, 0)


@pytest.mark.asyncio
async def test_reindex_cli_empty_queue_is_safe_noop(monkeypatch):
    client = FakeClient([[]])

    class Session:
        is_configured = True

        def __init__(self):
            self.client = client

        async def execute(self, query):
            return query.execute()

    monkeypatch.setattr(reindex_embeddings_v2, "supabase_session", Session())
    assert await reindex_embeddings_v2.run(10, execute=False) == (0, 0)


@pytest.mark.asyncio
async def test_reindex_cli_execution_is_staging_only(monkeypatch):
    client = FakeClient([[]])

    class Session:
        is_configured = True

        def __init__(self):
            self.client = client

        async def execute(self, query):
            return query.execute()

    monkeypatch.setattr(reindex_embeddings_v2, "supabase_session", Session())
    monkeypatch.setattr(reindex_embeddings_v2.settings, "APP_ENV", "production")
    monkeypatch.setattr(reindex_embeddings_v2.settings, "EMBEDDING_PROVIDER", "openrouter")
    monkeypatch.setattr(reindex_embeddings_v2.settings, "EMBEDDING_MODEL",
                        "nvidia/nemotron-3-embed-1b:free")
    monkeypatch.setattr(reindex_embeddings_v2.settings, "OPENROUTER_API_KEY", "configured-key")
    with pytest.raises(RuntimeError, match="staging"):
        await reindex_embeddings_v2.run(10, execute=True)


@pytest.mark.asyncio
async def test_reindex_cli_dry_run_summary(monkeypatch, capsys):
    import sys

    async def fake_run(_limit, execute):
        assert execute is False
        return 3, 0

    monkeypatch.setattr(reindex_embeddings_v2, "run", fake_run)
    monkeypatch.setattr(sys, "argv", ["reindex_embeddings_v2"])
    assert await reindex_embeddings_v2.main() == 0
    assert capsys.readouterr().out.strip() == "scanned=3 would_reindex=3"
