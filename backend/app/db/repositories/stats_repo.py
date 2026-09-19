from typing import List, Dict, Any
from app.db.session import supabase_session
import logging

logger = logging.getLogger(__name__)

class StatsRepository:
    async def get_user_activity_dates(self, user_id: str) -> List[str]:
        if not supabase_session.is_configured or not supabase_session.client:
            return []
        
        try:
            # We want to select distinct dates from occurred_at
            response = supabase_session.client.table("sync_events").select("occurred_at").eq("user_id", user_id).execute()
            
            active_dates = set()
            for record in response.data:
                occurred_at = record.get("occurred_at")
                if occurred_at:
                    # occurred_at is typically an ISO string, e.g. '2026-09-19T10:00:00Z'
                    # Extract just the date part
                    date_part = occurred_at.split('T')[0]
                    active_dates.add(date_part)
                    
            return sorted(list(active_dates))
        except Exception as e:
            logger.error(f"Error fetching activity dates for user {user_id}: {e}")
            return []

stats_repo = StatsRepository()
