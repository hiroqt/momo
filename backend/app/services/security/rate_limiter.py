import time
import asyncio
from typing import Dict, List, Tuple, Optional, Callable
from collections import defaultdict
import logging
from fastapi import Request, HTTPException, status, Depends

from app.config import settings
from app.dependencies import get_current_user, AuthenticatedUser

logger = logging.getLogger(__name__)

class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter.
    Tracks request timestamps per unique key (user_id/ip + category).
    Automatically expires stale timestamps to prevent unbounded memory growth.
    """
    def __init__(self):
        self._history: Dict[str, List[float]] = defaultdict(list)
        self._lock = asyncio.Lock()
        self._last_prune = time.time()

    async def check_limit(
        self,
        identifier: str,
        category: str,
        limit: int,
        window_seconds: int = 60
    ) -> Tuple[bool, int, int, int]:
        """
        Check if the identifier is within the rate limit.
        Returns:
            allowed (bool): True if allowed, False if exceeded.
            retry_after (int): Seconds to wait before next allowed request (0 if allowed).
            remaining (int): Remaining requests allowed in this window.
            limit (int): Max requests allowed in the window.
        """
        key = f"{category}:{identifier}"
        now = time.time()
        window_start = now - window_seconds

        async with self._lock:
            # Periodic pruning of expired buckets every 5 minutes or 1000 keys
            if now - self._last_prune > 300 or len(self._history) > 1000:
                self._prune_expired_buckets(window_start)
                self._last_prune = now

            timestamps = self._history[key]
            # Prune timestamps older than window
            valid_timestamps = [t for t in timestamps if t > window_start]

            if len(valid_timestamps) >= limit:
                earliest = valid_timestamps[0]
                retry_after = max(1, int(earliest + window_seconds - now))
                self._history[key] = valid_timestamps
                logger.warning(
                    f"Rate limit exceeded for '{key}'. Limit: {limit}/{window_seconds}s, Retry-After: {retry_after}s"
                )
                return False, retry_after, 0, limit

            # Record this request
            valid_timestamps.append(now)
            self._history[key] = valid_timestamps
            remaining = max(0, limit - len(valid_timestamps))
            return True, 0, remaining, limit

    def _prune_expired_buckets(self, threshold: float):
        keys_to_remove = []
        for key, timestamps in self._history.items():
            valid = [t for t in timestamps if t > threshold]
            if not valid:
                keys_to_remove.append(key)
            else:
                self._history[key] = valid
        for k in keys_to_remove:
            del self._history[k]

    def reset(self):
        """Reset all rate limiter state (useful for test isolation)."""
        self._history.clear()
        self._last_prune = time.time()

rate_limiter = SlidingWindowRateLimiter()

def get_default_limit_for_category(category: str) -> int:
    if category == "chat":
        return settings.RATE_LIMIT_CHAT_PER_MINUTE
    elif category in ["generation", "generations"]:
        return settings.RATE_LIMIT_GENERATION_PER_MINUTE
    elif category == "math":
        return settings.RATE_LIMIT_MATH_PER_MINUTE
    return settings.RATE_LIMIT_GLOBAL_PER_MINUTE

def require_rate_limit(
    category: str,
    limit_override: Optional[int] = None,
    window_seconds: int = 60
) -> Callable:
    """
    FastAPI dependency factory to enforce rate limiting on specific endpoints.
    Enforces limits per authenticated user (falling back to client IP for unauthenticated routes).
    """
    async def _rate_limit_dependency(
        request: Request,
        user: AuthenticatedUser = Depends(get_current_user)
    ):
        identifier = user.id if user and user.id else (request.client.host if request.client else "unknown")
        limit = limit_override or get_default_limit_for_category(category)

        allowed, retry_after, remaining, max_limit = await rate_limiter.check_limit(
            identifier=identifier,
            category=category,
            limit=limit,
            window_seconds=window_seconds
        )

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Too many requests for {category}. Please wait {retry_after} second(s) before trying again.",
                    "retry_after": retry_after
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(max_limit),
                    "X-RateLimit-Remaining": str(remaining),
                    "X-RateLimit-Reset": str(int(time.time() + retry_after))
                }
            )

    return _rate_limit_dependency
