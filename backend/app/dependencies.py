"""Verify Supabase access tokens before deriving ownership identity."""
import asyncio
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Header, HTTPException

from app.config import settings


class AuthenticatedUser:
    def __init__(self, user_id: str, email: str = ""):
        self.id = user_id
        self.email = email

@lru_cache(maxsize=4)
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_jwk_set=True, lifespan=300, timeout=5)

def _verify_token(token: str) -> dict:
    algorithm = jwt.get_unverified_header(token).get("alg")
    if algorithm == "HS256":
        key = settings.SUPABASE_JWT_SECRET
        if not key or key == "mock-jwt-secret":
            raise ValueError("Signing key unavailable")
    elif algorithm in {"RS256", "ES256"}:
        key = _jwks_client(f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json").get_signing_key_from_jwt(token).key
    else:
        raise ValueError("Unsupported signing algorithm")
    payload = jwt.decode(token, key, algorithms=[algorithm],
        audience=settings.SUPABASE_JWT_AUDIENCE,
        issuer=f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        options={"require": ["sub", "exp", "iat", "aud", "iss"]})
    UUID(payload["sub"])
    if payload.get("role") != "authenticated":
        raise ValueError("User access token required")
    return payload

async def get_current_user(authorization: str | None = Header(None)) -> AuthenticatedUser:
    local_auth = settings.ENABLE_DEV_AUTH and settings.DATABASE_BACKEND == "memory" and settings.ENVIRONMENT in {"development", "test"}
    if not authorization:
        if local_auth:
            return AuthenticatedUser("dev-user-001", "dev@example.com")
        raise HTTPException(401, detail={"code": "AUTH_REQUIRED", "message": "Authentication is required."})
    if len(authorization) > 16384:
        raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Invalid authentication token."})
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(401, detail={"code": "INVALID_TOKEN_FORMAT", "message": "Invalid authentication token."})
    token = parts[1]
    if local_auth and token.startswith("test-token-") and token[11:]:
        return AuthenticatedUser(token[11:])
    try:
        payload = await asyncio.to_thread(_verify_token, token)
        return AuthenticatedUser(payload["sub"], payload.get("email", ""))
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Authentication token is invalid or expired."}) from None
