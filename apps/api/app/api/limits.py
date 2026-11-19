"""Limits and Server Capabilities Endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

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


@router.get("/limits", response_model=LimitsResponse)
async def get_limits() -> LimitsResponse:
    """Public limits endpoint exposing active server quotas and feature flags."""
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
    )
