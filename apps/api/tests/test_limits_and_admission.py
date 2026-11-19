"""Unit and integration tests for limits, admission control, and server capacity checks."""

import pytest
from fastapi import Request
from httpx import ASGITransport, AsyncClient

from app.core.admission import check_admission
from app.core.config import settings
from app.core.errors import AppError
from app.jobs.models import JobRecord
from app.jobs.queue import MemoryJobQueue
from app.jobs.store import MemoryJobStore
from app.main import app


@pytest.mark.asyncio
async def test_get_limits_endpoint() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/limits")
        assert resp.status_code == 200
        data = resp.json()
        assert data["maxUploadMB"] == settings.MAX_UPLOAD_MB
        assert data["ytMaxDurationMin"] == settings.YT_MAX_DURATION_MIN
        assert "concurrency" in data
        assert data["maxQueueLength"] == settings.MAX_QUEUE_LENGTH


@pytest.mark.asyncio
async def test_admission_control_active_jobs_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    store = MemoryJobStore()
    queue = MemoryJobQueue()

    ip = "192.168.1.100"
    monkeypatch.setattr(settings, "MAX_ACTIVE_JOBS_PER_IP", 2)

    # 1st job
    await store.create_job(
        JobRecord(id="job-1", type="convert", toolId="echo", clientIp=ip, status="queued")
    )
    # 2nd job
    await store.create_job(
        JobRecord(id="job-2", type="convert", toolId="echo", clientIp=ip, status="running")
    )

    scope = {
        "type": "http",
        "client": (ip, 12345),
        "headers": [],
    }
    req = Request(scope)

    # 3rd job must be rejected by admission control
    with pytest.raises(AppError) as exc_info:
        await check_admission(req, store, queue)
    assert exc_info.value.code == "RATE_LIMITED"
    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_admission_control_queue_full(monkeypatch: pytest.MonkeyPatch) -> None:
    store = MemoryJobStore()
    queue = MemoryJobQueue()

    monkeypatch.setattr(settings, "MAX_QUEUE_LENGTH", 2)
    await queue.enqueue("light", "q-job-1")
    await queue.enqueue("light", "q-job-2")

    scope = {
        "type": "http",
        "client": ("10.0.0.1", 12345),
        "headers": [],
    }
    req = Request(scope)

    with pytest.raises(AppError) as exc_info:
        await check_admission(req, store, queue)
    assert exc_info.value.code == "QUEUE_FULL"
    assert exc_info.value.status_code == 503
    assert exc_info.value.retry_after_sec is not None


@pytest.mark.asyncio
async def test_admission_control_draining() -> None:
    store = MemoryJobStore()
    queue = MemoryJobQueue()

    scope = {
        "type": "http",
        "client": ("10.0.0.1", 12345),
        "headers": [],
    }
    req = Request(scope)

    with pytest.raises(AppError) as exc_info:
        await check_admission(req, store, queue, is_draining=True)
    assert exc_info.value.code == "SERVER_BUSY"
    assert exc_info.value.status_code == 503
