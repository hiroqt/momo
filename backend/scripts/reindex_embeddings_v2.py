"""Re-embed READY, unexpired documents into the additive 2048-dimension index."""
import argparse
import asyncio
import logging
from datetime import UTC, datetime

from app.config import EMBEDDING_MODEL_V2, is_placeholder, settings
from app.db.repositories.chunks_repo import chunks_repo
from app.db.session import supabase_session

PAGE_SIZE = 50


async def run(max_documents: int, execute: bool) -> tuple[int, int]:
    if not supabase_session.is_configured or supabase_session.client is None:
        raise RuntimeError("A pinned Supabase service-role configuration is required")
    if execute and (settings.APP_ENV != "staging"
                    or settings.EMBEDDING_PROVIDER != "openrouter"
                    or settings.EMBEDDING_MODEL != EMBEDDING_MODEL_V2
                    or is_placeholder(settings.OPENROUTER_API_KEY)):
        raise RuntimeError("Execution requires staging and the approved OpenRouter embedding configuration")

    client = supabase_session.client
    now = datetime.now(UTC).isoformat()
    cursor = None
    scanned = completed = 0
    while scanned < max_documents:
        query = (client.table("documents").select("id,user_id")
            .eq("processing_status", "READY").eq("embedding_version", 1)
            .gt("expires_at", now).order("id"))
        if cursor is not None:
            query = query.gt("id", cursor)
        page = await supabase_session.execute(query.limit(min(PAGE_SIZE, max_documents - scanned)))
        documents = page.data or []
        if not documents:
            break
        for document in documents:
            cursor = document["id"]
            scanned += 1
            if execute:
                completed += await chunks_repo.reindex_document_embeddings_v2(
                    document["id"], document["user_id"])
    return scanned, completed


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true",
                        help="send chunk text to the configured embedding provider and write v2 vectors")
    parser.add_argument("--max-documents", type=int, default=100,
                        help="maximum documents per run (1-10000; default 100)")
    args = parser.parse_args()
    if not 1 <= args.max_documents <= 10_000:
        parser.error("--max-documents must be between 1 and 10000")
    try:
        scanned, completed = await run(args.max_documents, args.execute)
    except Exception as exc:  # noqa: BLE001 - operator boundary; avoid logging data or secrets
        logging.error("Embedding v2 reindex failed (%s)", type(exc).__name__)
        return 1
    if args.execute:
        print(f"scanned={scanned} completed={completed}")
    else:
        print(f"scanned={scanned} would_reindex={scanned}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
