"""Job Storage Abstractions: Memory and Redis Backends."""

import abc
import json
import time
from typing import Any

import redis.asyncio as aioredis

from app.jobs.models import JobRecord


class JobStore(abc.ABC):
    """Abstract JobStore interface for job metadata persistence and rate counters."""

    @abc.abstractmethod
    async def create_job(self, record: JobRecord) -> None:
        """Store a new job record."""

    @abc.abstractmethod
    async def get_job(self, job_id: str) -> JobRecord | None:
        """Fetch job record by ID."""

    @abc.abstractmethod
    async def update_job(self, record: JobRecord) -> None:
        """Update an existing job record."""

    @abc.abstractmethod
    async def delete_job(self, job_id: str) -> None:
        """Delete a job record."""

    @abc.abstractmethod
    async def get_active_jobs_for_ip(self, ip: str) -> int:
        """Count jobs currently queued or running for a given client IP."""

    @abc.abstractmethod
    async def check_rate_limit(
        self, ip: str, window_seconds: int, max_requests: int
    ) -> tuple[bool, int, int]:
        """Check and increment general request rate limit. Returns (is_allowed, count, retry_after_sec)."""

    @abc.abstractmethod
    async def check_job_creation_limit(
        self, ip: str, window_seconds: int, max_creates: int
    ) -> tuple[bool, int, int]:
        """Check and increment job creation rate limit. Returns (is_allowed, count, retry_after_sec)."""

    @abc.abstractmethod
    async def get_all_jobs(self) -> list[JobRecord]:
        """List all active and recent jobs for maintenance."""

    @abc.abstractmethod
    async def close(self) -> None:
        """Release any underlying resources."""


class MemoryJobStore(JobStore):
    """In-memory JobStore implementation using standard dict and asyncio safety."""

    def __init__(self) -> None:
        self._jobs: dict[str, JobRecord] = {}
        # ip -> list of hit timestamps
        self._rate_hits: dict[str, list[float]] = {}
        # ip -> list of job create timestamps
        self._job_create_hits: dict[str, list[float]] = {}

    async def create_job(self, record: JobRecord) -> None:
        self._jobs[record.id] = record.model_copy(deep=True)

    async def get_job(self, job_id: str) -> JobRecord | None:
        record = self._jobs.get(job_id)
        if record is None:
            return None
        return record.model_copy(deep=True)

    async def update_job(self, record: JobRecord) -> None:
        if record.id in self._jobs:
            self._jobs[record.id] = record.model_copy(deep=True)

    async def delete_job(self, job_id: str) -> None:
        self._jobs.pop(job_id, None)

    async def get_active_jobs_for_ip(self, ip: str) -> int:
        count = 0
        for job in self._jobs.values():
            if job.clientIp == ip and job.status in ("queued", "running"):
                count += 1
        return count

    def _check_sliding_window(
        self, hits_map: dict[str, list[float]], key: str, window_sec: int, max_hits: int
    ) -> tuple[bool, int, int]:
        now = time.time()
        cutoff = now - window_sec
        hits = hits_map.get(key, [])
        valid_hits = [ts for ts in hits if ts > cutoff]

        if len(valid_hits) >= max_hits:
            oldest = valid_hits[0]
            retry_after = max(1, int(window_sec - (now - oldest)))
            hits_map[key] = valid_hits
            return False, len(valid_hits), retry_after

        valid_hits.append(now)
        hits_map[key] = valid_hits
        return True, len(valid_hits), 0

    async def check_rate_limit(
        self, ip: str, window_seconds: int, max_requests: int
    ) -> tuple[bool, int, int]:
        return self._check_sliding_window(self._rate_hits, ip, window_seconds, max_requests)

    async def check_job_creation_limit(
        self, ip: str, window_seconds: int, max_creates: int
    ) -> tuple[bool, int, int]:
        return self._check_sliding_window(self._job_create_hits, ip, window_seconds, max_creates)

    async def get_all_jobs(self) -> list[JobRecord]:
        return [job.model_copy(deep=True) for job in self._jobs.values()]

    async def close(self) -> None:
        self._jobs.clear()
        self._rate_hits.clear()
        self._job_create_hits.clear()


class RedisJobStore(JobStore):
    """Redis-backed JobStore implementation supporting multi-process durability and fakeredis."""

    def __init__(self, redis_client: aioredis.Redis, ttl_seconds: int = 3600) -> None:
        self.redis = redis_client
        self.ttl_seconds = ttl_seconds
        self._key_prefix = "convertit:job:"
        self._active_set_key = "convertit:jobs:active"

    def _job_key(self, job_id: str) -> str:
        return f"{self._key_prefix}{job_id}"

    async def create_job(self, record: JobRecord) -> None:
        key = self._job_key(record.id)
        data = record.model_dump_json()
        await self.redis.set(key, data, ex=self.ttl_seconds)
        if record.status in ("queued", "running"):
            await self.redis.sadd(self._active_set_key, record.id)

    async def get_job(self, job_id: str) -> JobRecord | None:
        key = self._job_key(job_id)
        data = await self.redis.get(key)
        if not data:
            return None
        parsed: dict[str, Any] = json.loads(data)
        return JobRecord.model_validate(parsed)

    async def update_job(self, record: JobRecord) -> None:
        key = self._job_key(record.id)
        # Check remaining TTL or reset
        ttl = await self.redis.ttl(key)
        expire_time = self.ttl_seconds if ttl < 0 else ttl
        data = record.model_dump_json()
        await self.redis.set(key, data, ex=expire_time)

        if record.status in ("queued", "running"):
            await self.redis.sadd(self._active_set_key, record.id)
        else:
            await self.redis.srem(self._active_set_key, record.id)

    async def delete_job(self, job_id: str) -> None:
        key = self._job_key(job_id)
        await self.redis.delete(key)
        await self.redis.srem(self._active_set_key, job_id)

    async def get_active_jobs_for_ip(self, ip: str) -> int:
        active_ids = await self.redis.smembers(self._active_set_key)
        if not active_ids:
            return 0

        count = 0
        for raw_id in active_ids:
            job_id = raw_id.decode("utf-8") if isinstance(raw_id, bytes) else str(raw_id)
            job = await self.get_job(job_id)
            if job and job.clientIp == ip and job.status in ("queued", "running"):
                count += 1
        return count

    async def _redis_sliding_rate_limit(
        self, prefix: str, ip: str, window_seconds: int, max_hits: int
    ) -> tuple[bool, int, int]:
        key = f"convertit:rl:{prefix}:{ip}"
        now = time.time()
        cutoff = now - window_seconds

        # Use sorted set for sliding window
        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(key, "-inf", cutoff)
        pipe.zcard(key)
        pipe.zrange(key, 0, 0, withscores=True)
        results = await pipe.execute()

        current_count: int = results[1]
        oldest_records: list[Any] = results[2]

        if current_count >= max_hits:
            retry_after = window_seconds
            if oldest_records:
                oldest_ts = float(oldest_records[0][1])
                retry_after = max(1, int(window_seconds - (now - oldest_ts)))
            return False, current_count, retry_after

        pipe = self.redis.pipeline()
        pipe.zadd(key, {f"{now}:{current_count}": now})
        pipe.expire(key, window_seconds * 2)
        await pipe.execute()

        return True, current_count + 1, 0

    async def check_rate_limit(
        self, ip: str, window_seconds: int, max_requests: int
    ) -> tuple[bool, int, int]:
        return await self._redis_sliding_rate_limit("req", ip, window_seconds, max_requests)

    async def check_job_creation_limit(
        self, ip: str, window_seconds: int, max_creates: int
    ) -> tuple[bool, int, int]:
        return await self._redis_sliding_rate_limit("job", ip, window_seconds, max_creates)

    async def get_all_jobs(self) -> list[JobRecord]:
        keys = await self.redis.keys(f"{self._key_prefix}*")
        jobs: list[JobRecord] = []
        for key in keys:
            data = await self.redis.get(key)
            if data:
                parsed = json.loads(data)
                jobs.append(JobRecord.model_validate(parsed))
        return jobs

    async def close(self) -> None:
        await self.redis.aclose()
