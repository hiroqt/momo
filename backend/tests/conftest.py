"""Tests are isolated from developer credentials and hosted provider traffic."""

import os
import socket

import pytest

# Set before application imports during collection. Never load local credentials.
# ENVIRONMENT is derived from APP_ENV; a stale shell value must not leak in.
os.environ.pop("ENVIRONMENT", None)
os.environ.update({
    "APP_ENV": "test",
    "SUPABASE_PROJECT_REF": "",
    "LOCAL_ONLY": "true",
    "DATABASE_BACKEND": "memory",
    "ENABLE_DEV_AUTH": "false",
    "SUPABASE_URL": "http://127.0.0.1:54321",
    "SUPABASE_ANON_KEY": "mock-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "mock-service-role-key",
    "SUPABASE_JWT_SECRET": "test-signing-key-only-not-a-production-secret",
    "OPENROUTER_API_KEY": "mock-openrouter-key",
    "AWS_ACCESS_KEY_ID": "mock-access-key",
    "AWS_SECRET_ACCESS_KEY": "mock-secret-key",
    "AWS_EC2_METADATA_DISABLED": "true",
})


@pytest.fixture(autouse=True)
def deny_provider_network(monkeypatch):
    """ASGI and mocks need no sockets; catch accidental real HTTP immediately."""
    def denied(*args, **kwargs):
        raise AssertionError("Network disabled in tests; use ASGI or a mocked provider")

    monkeypatch.setattr(socket.socket, "connect", denied)
    monkeypatch.setattr(socket.socket, "connect_ex", denied)
    monkeypatch.setattr(socket, "create_connection", denied)


@pytest.fixture(autouse=True)
def legacy_api_identity(request):
    """Legacy feature tests authenticate via injection, never application bypasses."""
    legacy_modules = {
        "test_api_endpoints.py", "test_chat_agent.py", "test_folders.py",
        "test_full_generation_pipeline.py", "test_guardrails.py", "test_image_service.py",
        "test_learning_profile.py", "test_math_solver.py", "test_rate_limiter.py",
    }
    if request.path.name not in legacy_modules:
        yield
        return
    from fastapi import Header, HTTPException

    from app.dependencies import AuthenticatedUser, get_current_user
    from app.main import app

    async def test_identity(authorization: str = Header("")):
        prefix = "Bearer test-token-"
        if not authorization.startswith(prefix):
            raise HTTPException(401, detail={"code": "AUTH_REQUIRED", "message": "Authentication required"})
        return AuthenticatedUser(authorization[len(prefix):])

    app.dependency_overrides[get_current_user] = test_identity
    yield
    app.dependency_overrides.pop(get_current_user, None)
