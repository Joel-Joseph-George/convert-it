"""Unit tests for JobStore and JobQueue backends (Memory and Redis)."""

import fakeredis.aioredis as fake_redis
import pytest

from app.jobs.models import JobRecord
from app.jobs.queue import JobQueue, MemoryJobQueue, RedisJobQueue
from app.jobs.store import JobStore, MemoryJobStore, RedisJobStore


@pytest.fixture
def memory_store() -> MemoryJobStore:
    return MemoryJobStore()


@pytest.fixture
def fake_redis_client() -> fake_redis.FakeRedis:
    return fake_redis.FakeRedis()


@pytest.fixture
def redis_store(fake_redis_client: fake_redis.FakeRedis) -> RedisJobStore:
    return RedisJobStore(redis_client=fake_redis_client, ttl_seconds=3600)


@pytest.mark.asyncio
async def test_job_store_crud(memory_store: JobStore) -> None:
    # 1. Create
    record = JobRecord(
        id="job-123",
        type="convert",
        toolId="echo-convert",
        clientIp="1.2.3.4",
        status="queued",
    )
    await memory_store.create_job(record)

    # 2. Get
    fetched = await memory_store.get_job("job-123")
    assert fetched is not None
    assert fetched.id == "job-123"
    assert fetched.toolId == "echo-convert"

    # 3. Active count
    active_count = await memory_store.get_active_jobs_for_ip("1.2.3.4")
    assert active_count == 1

    # 4. Update
    fetched.status = "succeeded"
    await memory_store.update_job(fetched)
    updated = await memory_store.get_job("job-123")
    assert updated is not None
    assert updated.status == "succeeded"
    assert await memory_store.get_active_jobs_for_ip("1.2.3.4") == 0

    # 5. Delete
    await memory_store.delete_job("job-123")
    assert await memory_store.get_job("job-123") is None


@pytest.mark.asyncio
async def test_redis_job_store_crud(redis_store: RedisJobStore) -> None:
    # Test identical CRUD behaviors on RedisJobStore
    record = JobRecord(
        id="redis-job-123",
        type="convert",
        toolId="echo-convert",
        clientIp="5.6.7.8",
        status="queued",
    )
    await redis_store.create_job(record)

    fetched = await redis_store.get_job("redis-job-123")
    assert fetched is not None
    assert fetched.id == "redis-job-123"

    active_count = await redis_store.get_active_jobs_for_ip("5.6.7.8")
    assert active_count == 1

    fetched.status = "running"
    await redis_store.update_job(fetched)
    assert await redis_store.get_active_jobs_for_ip("5.6.7.8") == 1

    fetched.status = "succeeded"
    await redis_store.update_job(fetched)
    assert await redis_store.get_active_jobs_for_ip("5.6.7.8") == 0

    await redis_store.delete_job("redis-job-123")
    assert await redis_store.get_job("redis-job-123") is None


@pytest.mark.asyncio
async def test_job_store_rate_limits(memory_store: JobStore) -> None:
    ip = "10.0.0.99"
    # Allow 3 requests in 10s
    allowed, count, retry = await memory_store.check_rate_limit(
        ip, window_seconds=10, max_requests=3
    )
    assert allowed is True
    assert count == 1

    allowed, count, retry = await memory_store.check_rate_limit(
        ip, window_seconds=10, max_requests=3
    )
    assert allowed is True
    assert count == 2

    allowed, count, retry = await memory_store.check_rate_limit(
        ip, window_seconds=10, max_requests=3
    )
    assert allowed is True
    assert count == 3

    # 4th request must be rejected
    allowed, count, retry = await memory_store.check_rate_limit(
        ip, window_seconds=10, max_requests=3
    )
    assert allowed is False
    assert retry > 0


@pytest.mark.asyncio
async def test_memory_job_queue() -> None:
    queue: JobQueue = MemoryJobQueue()

    pos1 = await queue.enqueue("light", "job-a")
    pos2 = await queue.enqueue("light", "job-b")
    assert pos1 == 1
    assert pos2 == 2

    assert await queue.get_position("light", "job-a") == 1
    assert await queue.get_position("light", "job-b") == 2
    assert await queue.get_total_queued() == 2

    # Dequeue first
    next_job = await queue.dequeue("light", timeout_sec=0.1)
    assert next_job == "job-a"
    assert await queue.get_position("light", "job-b") == 1

    # Cancel remaining
    cancelled = await queue.cancel("light", "job-b")
    assert cancelled is True
    assert await queue.get_total_queued() == 0


@pytest.mark.asyncio
async def test_redis_job_queue(fake_redis_client: fake_redis.FakeRedis) -> None:
    queue: JobQueue = RedisJobQueue(redis_client=fake_redis_client)

    pos1 = await queue.enqueue("heavy", "heavy-job-1")
    pos2 = await queue.enqueue("heavy", "heavy-job-2")
    assert pos1 == 1
    assert pos2 == 2

    assert await queue.get_position("heavy", "heavy-job-1") == 1
    assert await queue.get_position("heavy", "heavy-job-2") == 2
    assert await queue.get_total_queued() == 2

    next_job = await queue.dequeue("heavy", timeout_sec=0.1)
    assert next_job == "heavy-job-1"
    assert await queue.get_position("heavy", "heavy-job-2") == 1

    cancelled = await queue.cancel("heavy", "heavy-job-2")
    assert cancelled is True
    assert await queue.get_total_queued() == 0
