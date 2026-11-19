"""Integration tests for the complete job lifecycle (upload to download, SSE, cancel, both backends)."""

import asyncio
import io
import time
from collections.abc import AsyncGenerator

import fakeredis.aioredis as fake_redis
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.engines.echo import echo_engine
from app.jobs.queue import MemoryJobQueue, RedisJobQueue
from app.jobs.runner import JobRunner
from app.jobs.store import MemoryJobStore, RedisJobStore
from app.main import app


@pytest.fixture
async def memory_app() -> AsyncGenerator[FastAPI, None]:
    """Configure app with Memory backend and running JobRunner."""
    store = MemoryJobStore()
    queue = MemoryJobQueue()
    runner = JobRunner(store, queue)
    runner.register_engine("echo-convert", echo_engine)
    await runner.start()

    app.state.store = store
    app.state.queue = queue
    app.state.runner = runner
    app.state.is_draining = False
    app.state.startup_time = time.time()

    yield app

    await runner.stop(grace_period_sec=5.0)
    await queue.close()
    await store.close()


@pytest.fixture
async def redis_app() -> AsyncGenerator[FastAPI, None]:
    """Configure app with FakeRedis backend and running JobRunner."""
    redis_client = fake_redis.FakeRedis()
    store = RedisJobStore(redis_client=redis_client)
    queue = RedisJobQueue(redis_client=redis_client)
    runner = JobRunner(store, queue)
    runner.register_engine("echo-convert", echo_engine)
    await runner.start()

    app.state.store = store
    app.state.queue = queue
    app.state.runner = runner
    app.state.is_draining = False
    app.state.startup_time = time.time()

    yield app

    await runner.stop(grace_period_sec=5.0)
    await queue.close()
    await store.close()


@pytest.mark.asyncio
async def test_memory_upload_to_download_flow(memory_app: FastAPI) -> None:
    transport = ASGITransport(app=memory_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        file_content = b"Hello, ConvertIt in-memory backend!"
        files = {"file": ("test_doc.txt", io.BytesIO(file_content), "text/plain")}
        data = {"toolId": "echo-convert", "options": "{}"}

        # 1. Upload
        resp = await client.post("/api/jobs/convert", data=data, files=files)
        assert resp.status_code == 202
        job_id = resp.json()["jobId"]
        assert "X-Request-Id" in resp.headers

        # 2. Poll until succeeded
        job_snapshot = None
        for _ in range(30):
            status_resp = await client.get(f"/api/jobs/{job_id}")
            assert status_resp.status_code == 200
            snapshot = status_resp.json()
            if snapshot["status"] == "succeeded":
                job_snapshot = snapshot
                break
            await asyncio.sleep(0.05)

        assert job_snapshot is not None
        assert job_snapshot["status"] == "succeeded"
        assert job_snapshot["progress"] == 100
        assert job_snapshot["result"] is not None
        assert job_snapshot["result"]["filename"] == "converted_test_doc.txt"

        # 3. Download
        download_resp = await client.get(f"/api/jobs/{job_id}/download")
        assert download_resp.status_code == 200
        assert download_resp.content == file_content
        assert (
            download_resp.headers["content-disposition"]
            == 'attachment; filename="converted_test_doc.txt"'
        )
        assert download_resp.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_redis_upload_to_download_flow(redis_app: FastAPI) -> None:
    transport = ASGITransport(app=redis_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        file_content = b"Hello, ConvertIt Redis backend!"
        files = {"file": ("data.json", io.BytesIO(file_content), "application/json")}
        data = {"toolId": "echo-convert", "options": "{}"}

        # 1. Upload
        resp = await client.post("/api/jobs/convert", data=data, files=files)
        assert resp.status_code == 202
        job_id = resp.json()["jobId"]

        # 2. Poll until succeeded
        job_snapshot = None
        for _ in range(30):
            status_resp = await client.get(f"/api/jobs/{job_id}")
            assert status_resp.status_code == 200
            snapshot = status_resp.json()
            if snapshot["status"] == "succeeded":
                job_snapshot = snapshot
                break
            await asyncio.sleep(0.05)

        assert job_snapshot is not None
        assert job_snapshot["status"] == "succeeded"
        assert job_snapshot["result"]["filename"] == "converted_data.json"

        # 3. Download
        download_resp = await client.get(f"/api/jobs/{job_id}/download")
        assert download_resp.status_code == 200
        assert download_resp.content == file_content


@pytest.mark.asyncio
async def test_upload_file_too_large(memory_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)  # 1 MB limit
    transport = ASGITransport(app=memory_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create 1.5 MB payload
        large_content = b"X" * (1024 * 1024 + 500 * 1024)
        files = {"file": ("huge.bin", io.BytesIO(large_content), "application/octet-stream")}
        data = {"toolId": "echo-convert", "options": "{}"}

        resp = await client.post("/api/jobs/convert", data=data, files=files)
        assert resp.status_code == 413
        assert resp.json()["error"]["code"] == "FILE_TOO_LARGE"


@pytest.mark.asyncio
async def test_upload_empty_file(memory_app: FastAPI) -> None:
    transport = ASGITransport(app=memory_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
        data = {"toolId": "echo-convert", "options": "{}"}

        resp = await client.post("/api/jobs/convert", data=data, files=files)
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "FILE_CORRUPT"


@pytest.mark.asyncio
async def test_job_cancellation(memory_app: FastAPI) -> None:
    transport = ASGITransport(app=memory_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        file_content = b"Content to cancel"
        files = {"file": ("test.txt", io.BytesIO(file_content), "text/plain")}
        data = {"toolId": "echo-convert", "options": "{}"}

        resp = await client.post("/api/jobs/convert", data=data, files=files)
        job_id = resp.json()["jobId"]

        # Cancel
        del_resp = await client.delete(f"/api/jobs/{job_id}")
        assert del_resp.status_code == 200

        # Status check
        status_resp = await client.get(f"/api/jobs/{job_id}")
        assert status_resp.status_code == 200
        assert status_resp.json()["status"] in ("cancelled", "succeeded")


@pytest.mark.asyncio
async def test_server_draining_behavior(memory_app: FastAPI) -> None:
    memory_app.state.is_draining = True
    transport = ASGITransport(app=memory_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        health_resp = await client.get("/api/health")
        assert health_resp.status_code == 200
        assert health_resp.json()["status"] == "draining"

        # Refuses new jobs with 503 SERVER_BUSY
        files = {"file": ("test.txt", io.BytesIO(b"foo"), "text/plain")}
        resp = await client.post(
            "/api/jobs/convert",
            data={"toolId": "echo-convert"},
            files=files,
        )
        assert resp.status_code == 503
        assert resp.json()["error"]["code"] == "SERVER_BUSY"
