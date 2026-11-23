"""YouTube Info and Download Job Endpoints."""

import secrets
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.core.admission import check_admission
from app.core.config import settings
from app.core.errors import AppError
from app.core.security import verify_access_code
from app.engines.youtube import extract_video_info
from app.engines.youtube_options import validate_format, validate_trim
from app.engines.youtube_url import parse_canonical_youtube_url
from app.jobs.models import JobRecord
from app.jobs.queue import JobQueue
from app.jobs.store import JobStore

router = APIRouter(tags=["youtube"])


class YouTubeInfoRequest(BaseModel):
    url: str = Field(max_length=2048)


class VideoFormatOption(BaseModel):
    formatId: str
    height: int
    note: str
    ext: str
    filesizeApproxMB: float | None = None


class AudioFormatOption(BaseModel):
    format: str
    bitrates: list[int]


class YouTubeInfoResponse(BaseModel):
    id: str
    title: str
    channel: str
    durationSec: int
    durationFormatted: str
    thumbnailUrl: str | None = None
    viewCount: int | None = None
    uploadDate: str | None = None
    tooLong: bool = False
    maxDurationMin: int
    videoFormats: list[VideoFormatOption]
    audioFormats: list[AudioFormatOption]


class YouTubeJobRequest(BaseModel):
    url: str = Field(max_length=2048)
    mode: Literal["video", "audio"] = "video"
    format: str = Field(default="mp4", max_length=10)
    quality: int | None = Field(default=None, ge=144, le=4320)
    bitrate: int | None = Field(default=None, ge=32, le=320)
    trimStart: str | None = Field(default=None, max_length=16)
    trimEnd: str | None = Field(default=None, max_length=16)
    embedThumbnail: bool = False
    embedMetadata: bool = False


class YouTubeJobResponse(BaseModel):
    jobId: str


@router.post("/youtube/info", response_model=YouTubeInfoResponse)
async def get_youtube_info(request: Request, body: YouTubeInfoRequest) -> YouTubeInfoResponse:
    """Fetch video metadata, formats, and durations for a given YouTube URL."""
    if not settings.ENABLE_YOUTUBE:
        raise AppError(
            code="TOOL_DISABLED",
            message="YouTube downloading is disabled on this server.",
            status_code=503,
        )

    verify_access_code(request)
    info = await extract_video_info(body.url)
    return YouTubeInfoResponse.model_validate(info)


@router.post("/jobs/youtube", response_model=YouTubeJobResponse, status_code=202)
async def create_youtube_job(request: Request, body: YouTubeJobRequest) -> YouTubeJobResponse:
    """Enqueue a YouTube video or audio conversion job."""
    if not settings.ENABLE_YOUTUBE:
        raise AppError(
            code="TOOL_DISABLED",
            message="YouTube downloading is disabled on this server.",
            status_code=503,
        )

    app_state = request.app.state
    store: JobStore = app_state.store
    queue: JobQueue = app_state.queue
    is_draining: bool = getattr(app_state, "is_draining", False)

    # Validate and canonicalize target URL and options before using a job slot
    canonical_url, video_id = parse_canonical_youtube_url(body.url)
    target_format = validate_format(body.mode, body.format)
    validate_trim(body.trimStart, body.trimEnd)

    # 1. Admission Control
    client_ip = await check_admission(request, store, queue, is_draining=is_draining)

    job_id = secrets.token_urlsafe(16)

    record = JobRecord(
        id=job_id,
        type="youtube",
        toolId="youtube-download",
        jobClass="youtube",
        clientIp=client_ip,
        originalFilename=f"youtube_{video_id}",
        options={
            "url": canonical_url,
            "mode": body.mode,
            "format": target_format,
            "quality": body.quality,
            "bitrate": body.bitrate,
            "trimStart": body.trimStart,
            "trimEnd": body.trimEnd,
            "embedThumbnail": body.embedThumbnail,
            "embedMetadata": body.embedMetadata,
        },
    )

    await store.create_job(record)
    pos = await queue.enqueue("youtube", job_id)
    record.queuePosition = pos
    await store.update_job(record)

    return YouTubeJobResponse(jobId=job_id)
