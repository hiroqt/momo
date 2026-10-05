import logging

from app.db.session import supabase_session

logger = logging.getLogger(__name__)

class StatsRepository:
    async def get_user_activity_dates(self, user_id: str) -> list[str]:
        if not supabase_session.is_configured or not supabase_session.client:
            return []

        response = await supabase_session.execute(supabase_session.client.rpc("activity_dates", {"p_user_id": user_id}))
        return sorted(record["activity_date"] for record in response.data or [])

stats_repo = StatsRepository()
