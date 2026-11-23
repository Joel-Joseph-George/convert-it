"""Integration tests for YouTube endpoints (/api/youtube/info and /api/jobs/youtube)."""

import time
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.jobs.queue import MemoryJobQueue
from app.jobs.runner import JobRunner
from app.jobs.store import MemoryJobStore
from app.main import app


@pytest.fixture
async def test_app(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> AsyncGenerator[FastAPI, None]:
    monkeypatch.setattr(settings, "TMP_DIR", str(tmp_path))
    store = MemoryJobStore()
    queue = MemoryJobQueue()
    runner = JobRunner(store, queue)
    await runner.start()

    app.state.store = store
    app.state.queue = queue
    app.state.runner = runner
    app.state.is_draining = False
    app.state.startup_time = time.time()

    yield app

    await runner.stop(grace_period_sec=2.0)
    await queue.close()
    await store.close()


@pytest.mark.asyncio
async def test_youtube_info_mocked(test_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    # Mock extract_video_info to avoid live network during unit/CI testing
    async def mock_extract(_url: str) -> dict[str, Any]:
        return {
            "id": "jNQXAC9IVRw",
            "title": "Me at the zoo",
            "channel": "jawed",
            "durationSec": 19,
            "durationFormatted": "00:19",
            "thumbnailUrl": "https://i.ytimg.com/vi/jNQXAC9IVRw/default.jpg",
            "viewCount": 300000000,
            "uploadDate": "20050423",
            "tooLong": False,
            "maxDurationMin": 60,
            "videoFormats": [
                {
                    "formatId": "18",
                    "height": 360,
                    "note": "360p",
                    "ext": "mp4",
                    "filesizeApproxMB": 1.2,
                }
            ],
            "audioFormats": [
                {"format": "mp3", "bitrates": [128, 192, 256, 320]},
                {"format": "m4a", "bitrates": [128, 192, 256]},
            ],
        }

    monkeypatch.setattr("app.api.youtube.extract_video_info", mock_extract)

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/youtube/info",
            json={"url": "https://www.youtube.com/watch?v=jNQXAC9IVRw"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "jNQXAC9IVRw"
        assert data["title"] == "Me at the zoo"
        assert data["durationFormatted"] == "00:19"
        assert len(data["videoFormats"]) == 1


@pytest.mark.asyncio
async def test_youtube_create_job(test_app: FastAPI) -> None:
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/jobs/youtube",
            json={
                "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
                "mode": "video",
                "format": "mp4",
                "quality": 720,
            },
        )
        assert resp.status_code == 202
        data = resp.json()
        assert "jobId" in data
        job_id = data["jobId"]

        # Check snapshot
        snap_resp = await client.get(f"/api/jobs/{job_id}")
        assert snap_resp.status_code == 200
        snap = snap_resp.json()
        assert snap["type"] == "youtube"


@pytest.mark.asyncio
async def test_youtube_disabled_feature_flag(
    test_app: FastAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ENABLE_YOUTUBE", False)

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        info_resp = await client.post(
            "/api/youtube/info",
            json={"url": "https://www.youtube.com/watch?v=jNQXAC9IVRw"},
        )
        assert info_resp.status_code == 503
        assert info_resp.json()["error"]["code"] == "TOOL_DISABLED"

        job_resp = await client.post(
            "/api/jobs/youtube",
            json={"url": "https://www.youtube.com/watch?v=jNQXAC9IVRw"},
        )
        assert job_resp.status_code == 503
        assert job_resp.json()["error"]["code"] == "TOOL_DISABLED"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "overrides",
    [
        {"mode": "video", "format": "opus"},
        {"mode": "audio", "format": "mp4"},
        {"trimStart": "2:00", "trimEnd": "1:00"},
        {"trimStart": "not-a-time"},
        {"quality": 99999},
    ],
)
async def test_youtube_create_job_rejects_bad_options(
    test_app: FastAPI, overrides: dict[str, Any]
) -> None:
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload: dict[str, Any] = {
            "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
            "mode": "video",
            "format": "mp4",
            **overrides,
        }
        resp = await client.post("/api/jobs/youtube", json=payload)
        assert resp.status_code == 422
