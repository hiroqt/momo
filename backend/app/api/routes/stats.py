from fastapi import APIRouter, Depends
from datetime import datetime, date, timedelta, timezone
from app.dependencies import get_current_user, AuthenticatedUser
from app.db.repositories.stats_repo import stats_repo
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/stats", tags=["Stats"])

class StreakResponse(BaseModel):
    active_dates: List[str]
    current_streak: int

@router.get("/streak", response_model=StreakResponse)
async def get_streak(user: AuthenticatedUser = Depends(get_current_user)):
    dates_str = await stats_repo.get_user_activity_dates(user.id)
    
    # Calculate streak
    if not dates_str:
        return StreakResponse(active_dates=[], current_streak=0)
        
    dates = sorted([datetime.strptime(d, "%Y-%m-%d").date() for d in dates_str], reverse=True)
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    
    current_streak = 0
    if dates and (dates[0] == today or dates[0] == yesterday):
        current_streak = 1
        curr_date = dates[0]
        for i in range(1, len(dates)):
            if dates[i] == curr_date - timedelta(days=1):
                current_streak += 1
                curr_date = dates[i]
            else:
                break
                
    return StreakResponse(
        active_dates=dates_str,
        current_streak=current_streak
    )
