from fastapi import Header, HTTPException, status, Depends
from typing import Optional
import jwt
from app.config import settings

class AuthenticatedUser:
    def __init__(self, user_id: str, email: str = ""):
        self.id = user_id
        self.email = email

async def get_current_user(
    authorization: Optional[str] = Header(None)
) -> AuthenticatedUser:
    if not authorization:
        # Development fallback only if configured
        if settings.ENVIRONMENT == "development":
            return AuthenticatedUser(user_id="dev-user-001", email="dev@example.com")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_REQUIRED", "message": "Missing Authorization header"}
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN_FORMAT", "message": "Invalid Bearer token format"}
        )

    token = parts[1]

    # In dev/test, support dummy test tokens like 'bearer test-token-user-123'
    if settings.ENVIRONMENT == "development" and token.startswith("test-token-"):
        user_id = token.replace("test-token-", "")
        return AuthenticatedUser(user_id=user_id, email=f"{user_id}@test.com")

    try:
        # Verify Supabase JWT
        # If secret provided, decode and verify signature
        if settings.SUPABASE_JWT_SECRET and settings.SUPABASE_JWT_SECRET != "mock-jwt-secret":
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
        else:
            # Fallback decode payload unverified for local development mock
            payload = jwt.decode(token, options={"verify_signature": False})

        user_id = payload.get("sub") or payload.get("id")
        email = payload.get("email", "")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_TOKEN", "message": "Token has no user subject"}
            )
        return AuthenticatedUser(user_id=str(user_id), email=email)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": f"Token verification failed: {str(e)}"}
        )
