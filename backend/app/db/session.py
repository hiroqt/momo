"""Pooled server client with bounded query I/O and explicit local storage."""
import asyncio
from typing import Any

from supabase import Client, create_client
from supabase.lib.client_options import ClientOptions

from app.config import settings


def page_range(limit: int, offset: int) -> tuple[int, int]:
    if not 1 <= limit <= 100 or not 0 <= offset <= 100000:
        raise ValueError("Invalid pagination bounds")
    return offset, offset + limit - 1


class SupabaseSession:
    def __init__(self) -> None:
        self.client: Client | None = None
        self._semaphore = asyncio.Semaphore(settings.DATABASE_MAX_CONCURRENT_QUERIES)

    @property
    def use_memory(self) -> bool:
        return settings.DATABASE_BACKEND == "memory" and settings.ENVIRONMENT in {"development", "test"}

    @property
    def is_configured(self) -> bool:
        if settings.DATABASE_BACKEND == "memory":
            if settings.ENVIRONMENT not in {"development", "test"}:
                raise RuntimeError("Local storage is disabled")
            return False
        if self.client is None:
            if not settings.SUPABASE_URL.startswith("https://") or not settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_SERVICE_ROLE_KEY.startswith(("mock-", "your-")):
                raise RuntimeError("Supabase server configuration is required")
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY,
                options=ClientOptions(auto_refresh_token=False, persist_session=False,
                    postgrest_client_timeout=settings.DATABASE_QUERY_TIMEOUT_SECONDS,
                    storage_client_timeout=settings.DATABASE_QUERY_TIMEOUT_SECONDS))
        return True

    async def execute(self, query: Any) -> Any:
        await self._semaphore.acquire()
        task = asyncio.create_task(asyncio.to_thread(query.execute))

        def finished(completed: asyncio.Task) -> None:
            self._semaphore.release()
            if not completed.cancelled():
                completed.exception()

        # SDK I/O continues after request cancellation; hold its permit until it finishes.
        task.add_done_callback(finished)
        return await asyncio.shield(task)

    def close(self) -> None:
        if self.client is not None:
            self.client.postgrest.session.close()
            self.client.auth.close()
            self.client = None

supabase_session = SupabaseSession()
