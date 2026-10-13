"""Bound API request bodies before parsing or invoking application services."""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings

# Leaves room for the existing 8,000,000-character base64 math/image input and
# its JSON envelope. Local mock binary PUTs use the bounded document limit.
MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024


class RequestBodyLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int = MAX_REQUEST_BODY_BYTES):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        body_limit = self.max_bytes
        if (scope.get("method") == "PUT"
                and scope.get("path", "").startswith("/api/documents/mock-upload/")
                and settings.DATABASE_BACKEND == "memory"
                and settings.ENVIRONMENT in {"development", "test"}):
            body_limit = settings.MAX_FILE_SIZE_MB * 1024 * 1024

        async def reject() -> None:
            response = JSONResponse(
                {"error": {"code": "REQUEST_TOO_LARGE", "message": "The request exceeds the allowed size."}},
                status_code=413,
            )
            await response(scope, receive, send)

        for key, value in scope.get("headers", []):
            if key.lower() == b"content-length" and value.isdigit():
                # Compare text first to avoid converting an arbitrarily long integer.
                normalized = value.lstrip(b"0") or b"0"
                limit = str(body_limit).encode()
                if len(normalized) > len(limit) or (len(normalized) == len(limit) and normalized > limit):
                    await reject()
                    return

        # Buffer only up to the cap and replay once. This also protects against
        # chunked requests and dishonest lengths before any persistence/provider
        # work runs; raising from receive can otherwise be masked as a parse error.
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message["type"] != "http.request":
                continue
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > body_limit:
                await reject()
                return
            body.extend(chunk)
            if not message.get("more_body", False):
                break

        delivered = False

        async def replay() -> Message:
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
