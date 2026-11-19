"""yt-dlp exception message mapping to standardized AppError shapes according to Section 10.3."""

from app.core.errors import AppError


def map_ytdlp_error(exc: Exception) -> AppError:
    """Map any yt-dlp exception or error message to a clean, user-safe AppError."""
    err_str = str(exc).lower()

    # 1. Bot check / Sign-in required
    if any(
        term in err_str
        for term in (
            "sign in to confirm you're not a bot",
            "confirm you're not a bot",
            "bot detection",
            "automated queries",
            "sign in to confirm your age",
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
        for term in ("age-restricted", "age restricted", "inappropriate for some users")
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
