"""Job Queue Abstractions: Memory and Redis Backends."""

import abc
import asyncio

import redis.asyncio as aioredis

from app.jobs.models import JobClass


class JobQueue(abc.ABC):
    """Abstract JobQueue interface for job scheduling and admission queueing."""

    @abc.abstractmethod
    async def enqueue(self, job_class: JobClass, job_id: str) -> int:
        """Enqueue job and return its 1-indexed position in its class queue."""

    @abc.abstractmethod
    async def dequeue(self, job_class: JobClass, timeout_sec: float = 0.5) -> str | None:
        """Dequeue the next job_id for a given class or None on timeout."""

    @abc.abstractmethod
    async def get_position(self, job_class: JobClass, job_id: str) -> int:
        """Return 1-indexed position in queue, or 0 if not currently in queue."""

    @abc.abstractmethod
    async def cancel(self, job_class: JobClass, job_id: str) -> bool:
        """Remove a job from the queue before it runs. Returns True if found."""

    @abc.abstractmethod
    async def get_total_queued(self) -> int:
        """Return the sum of queued jobs across all classes."""

    @abc.abstractmethod
    async def close(self) -> None:
        """Release queue resources."""


class MemoryJobQueue(JobQueue):
    """In-memory asyncio queue supporting cancel and position lookup."""

    def __init__(self) -> None:
        self._queues: dict[JobClass, list[str]] = {
            "heavy": [],
            "youtube": [],
            "light": [],
        }
        self._events: dict[JobClass, asyncio.Event] = {
            "heavy": asyncio.Event(),
            "youtube": asyncio.Event(),
            "light": asyncio.Event(),
        }

    async def enqueue(self, job_class: JobClass, job_id: str) -> int:
        queue = self._queues[job_class]
        if job_id not in queue:
            queue.append(job_id)
        self._events[job_class].set()
        return queue.index(job_id) + 1

    async def dequeue(self, job_class: JobClass, timeout_sec: float = 0.5) -> str | None:
        queue = self._queues[job_class]
        if queue:
            return queue.pop(0)

        event = self._events[job_class]
        event.clear()
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout_sec)
            if queue:
                return queue.pop(0)
        except TimeoutError:
            pass
        return None

    async def get_position(self, job_class: JobClass, job_id: str) -> int:
        queue = self._queues[job_class]
        if job_id in queue:
            return queue.index(job_id) + 1
        return 0

    async def cancel(self, job_class: JobClass, job_id: str) -> bool:
        queue = self._queues[job_class]
        if job_id in queue:
            queue.remove(job_id)
            return True
        return False

    async def get_total_queued(self) -> int:
        return sum(len(q) for q in self._queues.values())

    async def close(self) -> None:
        for q in self._queues.values():
            q.clear()
        for ev in self._events.values():
            ev.set()


class RedisJobQueue(JobQueue):
    """Redis-backed queue using Redis lists."""

    def __init__(self, redis_client: aioredis.Redis) -> None:
        self.redis = redis_client
        self._prefix = "convertit:queue:"

    def _queue_key(self, job_class: JobClass) -> str:
        return f"{self._prefix}{job_class}"

    async def enqueue(self, job_class: JobClass, job_id: str) -> int:
        key = self._queue_key(job_class)
        # Append to right
        await self.redis.rpush(key, job_id)
        pos = await self.get_position(job_class, job_id)
        return pos

    async def dequeue(self, job_class: JobClass, timeout_sec: float = 0.5) -> str | None:
        key = self._queue_key(job_class)
        # Pop from left
        # blpop takes integer timeout in redis, so use lpop with sleep for sub-second precision
        try:
            val = await self.redis.lpop(key)
            if val:
                return val.decode("utf-8") if isinstance(val, bytes) else str(val)
            if timeout_sec > 0:
                await asyncio.sleep(min(timeout_sec, 0.1))
                val = await self.redis.lpop(key)
                if val:
                    return val.decode("utf-8") if isinstance(val, bytes) else str(val)
        except Exception:
            return None
        return None

    async def get_position(self, job_class: JobClass, job_id: str) -> int:
        key = self._queue_key(job_class)
        # Retrieve list items to calculate 1-indexed position
        items = await self.redis.lrange(key, 0, -1)
        for idx, item in enumerate(items):
            str_item = item.decode("utf-8") if isinstance(item, bytes) else str(item)
            if str_item == job_id:
                return idx + 1
        return 0

    async def cancel(self, job_class: JobClass, job_id: str) -> bool:
        key = self._queue_key(job_class)
        removed_count = await self.redis.lrem(key, 1, job_id)
        return bool(removed_count > 0)

    async def get_total_queued(self) -> int:
        total = 0
        classes: tuple[JobClass, ...] = ("heavy", "youtube", "light")
        for cls_name in classes:
            key = self._queue_key(cls_name)
            length = await self.redis.llen(key)
            total += length
        return total

    async def close(self) -> None:
        pass
