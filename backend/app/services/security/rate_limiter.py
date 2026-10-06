"""Sliding-window limits for expensive operations (SEC-01).

Database-backed deployments share one sliding-window log across every API
replica and restart (`consume_rate_limit`, migration 006). The in-process store
is used only by explicit development/test memory mode. Identities are verified
user IDs from the JWT dependency; client-supplied forwarding headers are never
trusted, and stored keys are SHA-256 digests rather than raw identifiers. When
shared state is unavailable, expensive operations fail closed with 503.
"""

import asyncio
import hashlib
import logging
import re
import time
from collections import defaultdict
from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.config import settings
from app.db.session import supabase_session
from app.dependencies import AuthenticatedUser, get_current_user

logger = logging.getLogger(__name__)

CATEGORY = re.compile(r"^[a-z0-9_-]{1,32}$")
RateLimitResult = tuple[bool, int, int, int]


class RateLimitUnavailableError(RuntimeError):
    """Shared limiter state could not be consulted; callers must fail closed."""


class SlidingWindowRateLimiter:
    """In-process sliding window (development/test memory mode only)."""

    def __init__(self) -> None:
        self._history: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()
        self._last_prune = time.time()

    async def consume(self, key: str, limit: int, window_seconds: int) -> RateLimitResult:
        now = time.time()
        window_start = now - window_seconds
        async with self._lock:
            if now - self._last_prune > 300 or len(self._history) > 1000:
                self._prune_expired_buckets(window_start)
                self._last_prune = now
            valid = [t for t in self._history[key] if t > window_start]
            if len(valid) >= limit:
                self._history[key] = valid
                return False, max(1, int(valid[0] + window_seconds - now)), 0, limit
            valid.append(now)
            self._history[key] = valid
            return True, 0, max(0, limit - len(valid)), limit

    def _prune_expired_buckets(self, threshold: float) -> None:
        for key in list(self._history):
            valid = [t for t in self._history[key] if t > threshold]
            if valid:
                self._history[key] = valid
            else:
                del self._history[key]

    def reset(self) -> None:
        self._history.clear()
        self._last_prune = time.time()


class PostgresRateLimitStore:
    """Shared sliding-window log; one advisory-locked transaction per request."""

    async def consume(self, key: str, limit: int, window_seconds: int) -> RateLimitResult:
        try:
            resp = await supabase_session.execute(supabase_session.require_client().rpc("consume_rate_limit", {
                "p_bucket_key": key, "p_limit": limit, "p_window_seconds": window_seconds,
            }))
            data = resp.data
            return (bool(data["allowed"]), int(data["retry_after"]), int(data["remaining"]),
                    int(data["limit"]))
        except Exception as exc:  # noqa: BLE001 - never expose SQL/provider details; fail closed
            logger.error("Shared rate limit unavailable (%s)", type(exc).__name__)
            raise RateLimitUnavailableError("Rate limit state unavailable") from None


class RateLimiter:
    def __init__(self) -> None:
        self.memory = SlidingWindowRateLimiter()
        self.shared = PostgresRateLimitStore()

    @staticmethod
    def bucket_key(category: str, identifier: str) -> str:
        if not CATEGORY.fullmatch(category) or not identifier:
            raise ValueError("Invalid rate limit bucket")
        return f"{category}:{hashlib.sha256(identifier.encode()).hexdigest()}"

    async def check_limit(self, identifier: str, category: str, limit: int,
                          window_seconds: int = 60) -> RateLimitResult:
        """Return (allowed, retry_after, remaining, limit) and record the request if allowed."""
        if not 1 <= limit <= 1000 or not 1 <= window_seconds <= 3600:
            raise ValueError("Invalid rate limit")
        key = self.bucket_key(category, identifier)
        if supabase_session.use_memory:
            result = await self.memory.consume(key, limit, window_seconds)
        else:
            if not supabase_session.is_configured:
                raise RateLimitUnavailableError("Rate limit state unavailable")
            result = await self.shared.consume(key, limit, window_seconds)
        if not result[0]:
            logger.warning("Rate limit exceeded for category '%s'", category)
        return result

    def reset(self) -> None:
        """Reset in-process state (test isolation only)."""
        self.memory.reset()


rate_limiter = RateLimiter()


def get_default_limit_for_category(category: str) -> int:
    if category == "chat":
        return settings.RATE_LIMIT_CHAT_PER_MINUTE
    if category in {"generation", "generations"}:
        return settings.RATE_LIMIT_GENERATION_PER_MINUTE
    if category == "math":
        return settings.RATE_LIMIT_MATH_PER_MINUTE
    if category in {"upload", "registration"}:
        return settings.RATE_LIMIT_UPLOAD_PER_MINUTE
    return settings.RATE_LIMIT_GLOBAL_PER_MINUTE


def require_rate_limit(category: str, limit_override: int | None = None,
                       window_seconds: int = 60) -> Callable:
    """FastAPI dependency enforcing a per-verified-user limit for one category."""
    if not CATEGORY.fullmatch(category):
        raise ValueError("Invalid rate limit category")

    async def _rate_limit_dependency(user: AuthenticatedUser = Depends(get_current_user)) -> None:
        if not user or not user.id:
            raise HTTPException(401, detail={"code": "AUTH_REQUIRED", "message": "Authentication is required."})
        limit = limit_override or get_default_limit_for_category(category)
        try:
            allowed, retry_after, remaining, max_limit = await rate_limiter.check_limit(
                identifier=user.id, category=category, limit=limit, window_seconds=window_seconds)
        except RateLimitUnavailableError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "RATE_LIMIT_UNAVAILABLE",
                        "message": "This feature is temporarily unavailable. Please try again shortly."},
                headers={"Retry-After": "5"},
            ) from None
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Too many requests for {category}. Please wait {retry_after} second(s) before trying again.",
                    "retry_after": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(max_limit),
                    "X-RateLimit-Remaining": str(remaining),
                    "X-RateLimit-Reset": str(int(time.time() + retry_after)),
                },
            )

    return _rate_limit_dependency
