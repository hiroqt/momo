from typing import Dict
from datetime import datetime, timezone
from app.config import settings
from app.db.session import supabase_session
import logging

logger = logging.getLogger(__name__)

class UsageRepository:
    def __init__(self):
        # key: (user_id, year_month) -> int count
        self._counts: Dict[str, int] = {}

    def _get_year_month(self) -> str:
        now = datetime.now(timezone.utc)
        return now.strftime("%Y-%m")

    async def get_monthly_usage(self, user_id: str) -> int:
        ym = self._get_year_month()
        key = f"{user_id}:{ym}"

        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("usage_records").select("documents_count").eq("user_id", user_id).eq("year_month", ym).execute()
                if resp.data:
                    return resp.data[0]["documents_count"]
                return 0
            except Exception as e:
                logger.error(f"Error getting usage from Supabase: {e}")

        return self._counts.get(key, 0)

    async def can_upload_document(self, user_id: str) -> bool:
        used = await self.get_monthly_usage(user_id)
        return used < settings.MONTHLY_DOCUMENT_LIMIT

    async def increment_usage(self, user_id: str) -> int:
        ym = self._get_year_month()
        key = f"{user_id}:{ym}"

        if supabase_session.is_configured and supabase_session.client:
            try:
                # Upsert usage record
                current = await self.get_monthly_usage(user_id)
                new_count = current + 1
                supabase_session.client.table("usage_records").upsert({
                    "user_id": user_id,
                    "year_month": ym,
                    "documents_count": new_count,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }, on_conflict="user_id,year_month").execute()
                return new_count
            except Exception as e:
                logger.error(f"Error incrementing usage in Supabase: {e}")

        current = self._counts.get(key, 0)
        self._counts[key] = current + 1
        return self._counts[key]

usage_repo = UsageRepository()
