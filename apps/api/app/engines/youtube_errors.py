"""yt-dlp exception message mapping to standardized AppError shapes according to Section 10.3."""

import re

from app.core.errors import AppError
from app.core.logging import logger

# YouTube's own messages use typographic quotes ("you’re"), so normalise them before matching.
_QUOTE_TRANSLATION = str.maketrans({"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"'})
_VIDEO_ID_PATTERN = re.compile(r"\[youtube[^\]]*\]\s*[A-Za-z0-9_-]{11}")
_URL_PATTERN = re.compile(r"https?://\S+")


def redact_ytdlp_message(message: str, max_length: int = 500) -> str:
    """Strip video IDs and URLs from a yt-dlp message so it can be logged safely."""
    redacted = _VIDEO_ID_PATTERN.sub("[youtube] <id>", message)
    redacted = _URL_PATTERN.sub("<url>", redacted)
    return redacted[:max_length]


def map_ytdlp_error(exc: Exception, *, stage: str = "unknown") -> AppError:
    """Map any yt-dlp exception or error message to a clean, user-safe AppError."""
    raw = str(exc)
    err_str = raw.translate(_QUOTE_TRANSLATION).lower()
    app_error = _classify(err_str)
    # Log the underlying reason; without it every upstream failure looks the same.
    logger.warn(
        "ytdlp_error",
        stage=stage,
        mapped_code=app_error.code,
        error_type=type(exc).__name__,
        detail=redact_ytdlp_message(raw),
    )
    return app_error


def _classify(err_str: str) -> AppError:

    # 1. Bot check / Sign-in required
    if any(
        term in err_str
        for term in (
            "not a bot",
            "bot detection",
            "automated queries",
            "po token",
            "http error 429",
            "too many requests",
        )
    ):
        return AppError(
            code="UPSTREAM_BLOCKED",
            message="YouTube is requiring verification. The server couldn't reach YouTube right now.",
            status_code=502,
            retryable=True,
            retry_after_sec=60,
        )

    # 2. Age-restricted videos
    if any(
        term in err_str
        for term in (
            "age-restricted",
            "age restricted",
            "confirm your age",
            "inappropriate for some users",
        )
    ):
        return AppError(
            code="AGE_RESTRICTED",
            message="This video is age-restricted and cannot be downloaded without authentication.",
            status_code=422,
            retryable=False,
        )

    # 3. Live streams or Premieres
    if any(term in err_str for term in ("is a live event", "live stream", "premiere will begin")):
        return AppError(
            code="LIVE_NOT_SUPPORTED",
            message="Live streams and premieres cannot be converted.",
            status_code=422,
            retryable=False,
        )

    # 4. Private, removed, blocked, or region-restricted
    if any(
        term in err_str
        for term in (
            "private video",
            "video is private",
            "video unavailable",
            "video is unavailable",
            "video is no longer available",
            "this video has been removed",
            "account has been terminated",
            "not available in your country",
            "blocked it on copyright grounds",
            "video has been removed by the uploader",
        )
    ):
        return AppError(
            code="VIDEO_UNAVAILABLE",
            message="This video is private, removed, copyright-blocked, or unavailable.",
            status_code=422,
            retryable=False,
        )

    # 5. File or duration limit exceeded
    if "maximum duration" in err_str or "duration exceeds" in err_str:
        return AppError(
            code="VIDEO_TOO_LONG",
            message="Video duration exceeds server limits. Try choosing audio only.",
            status_code=422,
            retryable=False,
        )

    if "filesize exceeds" in err_str or "larger than max_filesize" in err_str:
        return AppError(
            code="FILE_TOO_LARGE",
            message="The requested format exceeds the server maximum download size.",
            status_code=413,
            retryable=False,
        )

    if "requested format is not available" in err_str or "no video formats found" in err_str:
        return AppError(
            code="FORMAT_UNAVAILABLE",
            message="YouTube didn't offer a stream in the requested quality or format. Try another option.",
            status_code=422,
            retryable=True,
        )

    # 6. Network connectivity or upstream timeouts
    if any(
        term in err_str
        for term in (
            "timed out",
            "timeout",
            "connection reset",
            "connection refused",
            "network is unreachable",
            "temporary failure in name resolution",
            "unable to download webpage",
        )
    ):
        return AppError(
            code="UPSTREAM_ERROR",
            message="The server encountered a network error while communicating with YouTube.",
            status_code=502,
            retryable=True,
            retry_after_sec=15,
        )

    # 7. Fallback generic failure
    return AppError(
        code="CONVERSION_FAILED",
        message="Failed to process or download the requested video.",
        status_code=500,
        retryable=True,
    )
