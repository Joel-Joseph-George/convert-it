"""Health and Diagnostic Endpoints."""

import time

from fastapi import APIRouter, Request
from pydantic import BaseModel

try:
    import yt_dlp.version

    YTDLP_VERSION: str | None = yt_dlp.version.__version__
except Exception:
    YTDLP_VERSION = None

router = APIRouter(tags=["health"])


class QueueStatus(BaseModel):
    running: int
    queued: int


class HealthResponse(BaseModel):
    status: str
    version: str
    uptimeSec: int
    ytdlpVersion: str | None
    queue: QueueStatus


@router.get("/health", response_model=HealthResponse)
async def get_health(request: Request) -> HealthResponse:
    """Public health check returning operational state and queue load."""
    app_state = request.app.state
    startup_time: float = getattr(app_state, "startup_time", time.time())
    is_draining: bool = getattr(app_state, "is_draining", False)
    runner = getattr(app_state, "runner", None)
    queue = getattr(app_state, "queue", None)

    running_count = len(runner._active_jobs) if runner else 0
    queued_count = await queue.get_total_queued() if queue else 0

    return HealthResponse(
        status="draining" if is_draining else "ok",
        version="0.1.0",
        uptimeSec=max(0, int(time.time() - startup_time)),
        ytdlpVersion=YTDLP_VERSION,
        queue=QueueStatus(running=running_count, queued=queued_count),
    )
