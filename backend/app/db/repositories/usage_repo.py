import logging
from datetime import UTC, datetime

from app.config import settings
from app.db.session import supabase_session

logger = logging.getLogger(__name__)

class UsageRepository:
    def __init__(self) -> None:
        # key: (user_id, year_month) -> int count
        self._counts: dict[str, int] = {}

    def _get_year_month(self) -> str:
        now = datetime.now(UTC)
        return now.strftime("%Y-%m")

    async def get_monthly_usage(self, user_id: str) -> int:
        ym = self._get_year_month()
        key = f"{user_id}:{ym}"

        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("usage_records").select("documents_count").eq("user_id", user_id).eq("year_month", ym))
            if resp.data:
                return resp.data[0]["documents_count"]
            return 0

        return self._counts.get(key, 0)

    async def can_upload_document(self, user_id: str) -> bool:
        used = await self.get_monthly_usage(user_id)
        return used < settings.MONTHLY_DOCUMENT_LIMIT

    async def increment_usage(self, user_id: str) -> int:
        ym = self._get_year_month()
        key = f"{user_id}:{ym}"

        if supabase_session.is_configured and supabase_session.client:
            raise RuntimeError("Use atomic document registration to consume quota")

        current = self._counts.get(key, 0)
        self._counts[key] = current + 1
        return self._counts[key]

usage_repo = UsageRepository()
