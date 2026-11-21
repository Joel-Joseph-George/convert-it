"""Limits and Server Capabilities Endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import settings
from app.engines.libreoffice import find_libreoffice_binary

router = APIRouter(tags=["limits"])


class ConcurrencyLimits(BaseModel):
    heavy: int
    youtube: int
    light: int


class LimitsResponse(BaseModel):
    maxUploadMB: int
    ytMaxDurationMin: int
    ytMaxFilesizeMB: int
    ytMaxHeight: int
    accessCodeRequired: bool
    youtubeEnabled: bool
    concurrency: ConcurrencyLimits
    maxQueueLength: int
    serverTools: dict[str, bool] = Field(default_factory=dict)


@router.get("/limits", response_model=LimitsResponse)
async def get_limits() -> LimitsResponse:
    """Public limits endpoint exposing active server quotas and feature flags."""
    has_lo = find_libreoffice_binary() is not None
    tools_map = {
        "pdf-to-word": True,
        "pdf-to-excel": True,
        "word-to-pdf": has_lo,
        "excel-to-pdf": has_lo,
        "powerpoint-to-pdf": has_lo,
        "chat-pdf": bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_key_here"),
    }

    return LimitsResponse(
        maxUploadMB=settings.MAX_UPLOAD_MB,
        ytMaxDurationMin=settings.YT_MAX_DURATION_MIN,
        ytMaxFilesizeMB=settings.YT_MAX_FILESIZE_MB,
        ytMaxHeight=settings.YT_MAX_HEIGHT,
        accessCodeRequired=bool(settings.ACCESS_CODE),
        youtubeEnabled=settings.ENABLE_YOUTUBE,
        concurrency=ConcurrencyLimits(
            heavy=settings.CONCURRENCY_HEAVY,
            youtube=settings.CONCURRENCY_YOUTUBE,
            light=settings.CONCURRENCY_LIGHT,
        ),
        maxQueueLength=settings.MAX_QUEUE_LENGTH,
        serverTools=tools_map,
    )
