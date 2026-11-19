"""Rate Limiter implementation for general requests and job creations."""

import time
from typing import Protocol


class RateLimiterBackend(Protocol):
    """Protocol for rate limiter storage backends."""

    async def increment_counter(self, key: str, window_seconds: int) -> int: ...

    async def get_counter(self, key: str) -> int: ...


class InMemoryRateLimiterBackend:
    """In-memory sliding window / bucket rate limiter with automatic cleanup."""

    def __init__(self) -> None:
        # key -> list of timestamps
        self._hits: dict[str, list[float]] = {}

    async def record_hit(self, key: str, window_seconds: int) -> tuple[int, int]:
        """Record a hit and return (current_count, retry_after_seconds)."""
        now = time.time()
        cutoff = now - window_seconds

        timestamps = self._hits.get(key, [])
        # prune old hits
        valid = [ts for ts in timestamps if ts > cutoff]
        valid.append(now)
        self._hits[key] = valid

        retry_after = 0
        if valid:
            oldest = valid[0]
            retry_after = max(1, int(window_seconds - (now - oldest)))

        return len(valid), retry_after

    async def clear(self) -> None:
        self._hits.clear()
