"""Google-only Supabase JWT policy; Google OAuth itself is verified at sign-in."""
import time
from uuid import uuid4

import jwt
import pytest
from fastapi import HTTPException

from app.config import settings
from app.dependencies import get_current_user


@pytest.fixture
def signed_auth(monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEV_AUTH", False)
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "local-test-signing-key-at-least-32-characters")
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example.supabase.co")
    return {"sub": str(uuid4()), "exp": int(time.time()) + 60, "iat": int(time.time()),
            "iss": "https://example.supabase.co/auth/v1", "aud": "authenticated", "role": "authenticated",
            "is_anonymous": False, "app_metadata": {"provider": "google", "providers": ["google"]},
            "amr": [{"method": "oauth", "timestamp": int(time.time())}]}


@pytest.mark.parametrize("changes", [
    {"is_anonymous": True}, {"is_anonymous": None}, {"app_metadata": None},
    {"app_metadata": {"provider": "github", "providers": ["github"]}},
    {"app_metadata": {"provider": "google", "providers": ["google", "email"]}},
    {"app_metadata": {"provider": "google"}}, {"amr": None}, {"amr": []},
    {"amr": [{"method": "password"}]}, {"amr": [{"method": "token_refresh"}]},
    {"amr": [{"method": "oauth"}, {"method": "otp"}]}, {"amr": ["oauth"]},
    {"app_metadata": {}, "user_metadata": {"provider": "google", "providers": ["google"]}},
])
async def test_non_google_or_non_oauth_tokens_denied(signed_auth, changes):
    signed_auth.update(changes)
    token = jwt.encode(signed_auth, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
    with pytest.raises(HTTPException) as exc:
        await get_current_user("Bearer " + token)
    assert exc.value.status_code == 401


async def test_signed_google_oauth_token_derives_identity(signed_auth):
    signed_auth["amr"].append({"method": "token_refresh", "timestamp": int(time.time())})
    token = jwt.encode(signed_auth, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
    user = await get_current_user("Bearer " + token)
    assert user.id == signed_auth["sub"]
