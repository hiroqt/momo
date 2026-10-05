from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest

from app.dependencies import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.parametrize("route,body", [
    ("/api/images/generate", {"prompt": "Explain mitosis", "mode": "diagram"}),
    ("/api/math/solve", {"equation_text": "2 + 2"}),
])
async def test_provider_exception_payload_never_reaches_client_or_logs(
    monkeypatch, caplog, route, body
):
    from app.services.ai.ai_provider import ai_provider
    from app.services.ai.image_service import (
        ImageProviderUnavailableError,
        image_service,
    )

    secret = "private-provider-token-and-student-content"
    error = ImageProviderUnavailableError(secret) if "images" in route else RuntimeError(secret)
    monkeypatch.setattr(image_service, "generate_image", AsyncMock(side_effect=error))
    monkeypatch.setattr(ai_provider, "solve_math", AsyncMock(side_effect=error))
    owner = str(uuid4())

    async def identity():
        return AuthenticatedUser(owner)

    app.dependency_overrides[get_current_user] = identity
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test.local"
        ) as client:
            response = await client.post(route, json=body)
        assert response.status_code in {500, 503}
        assert secret not in response.text
        assert secret not in caplog.text
    finally:
        app.dependency_overrides.pop(get_current_user, None)
