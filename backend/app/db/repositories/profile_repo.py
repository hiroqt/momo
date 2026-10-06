"""Owner-scoped read of the persisted profile row (public.users)."""
from typing import Any

from app.db.session import supabase_session


class ProfileRepository:
    def __init__(self) -> None:
        # Development/test memory store; empty unless a test seeds a real profile.
        self._profiles: dict[str, dict[str, Any]] = {}

    async def get_profile(self, user_id: str) -> dict[str, Any] | None:
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(
                supabase_session.client.table("users").select("id,email,full_name,avatar_url").eq("id", user_id).limit(1))
            return resp.data[0] if resp.data else None
        return self._profiles.get(user_id)


profile_repo = ProfileRepository()
