"""Unit tests verifying mapping of yt-dlp exceptions to AppError shapes (Section 10.3)."""

from app.engines.youtube_errors import map_ytdlp_error


def test_bot_detection_mapping() -> None:
    exc = Exception("Sign in to confirm you're not a bot. This helps protect our community.")
    app_err = map_ytdlp_error(exc)
    assert app_err.code == "UPSTREAM_BLOCKED"
    assert app_err.status_code == 502
    assert app_err.retryable is True


def test_age_restricted_mapping() -> None:
    exc = Exception("Sign in to confirm your age. This video may be inappropriate for some users.")
    app_err = map_ytdlp_error(exc)
    assert app_err.code in ("AGE_RESTRICTED", "UPSTREAM_BLOCKED")
    assert app_err.status_code in (422, 502)


def test_live_stream_mapping() -> None:
    exc = Exception("This live stream recording is not available or is a live event.")
    app_err = map_ytdlp_error(exc)
    assert app_err.code == "LIVE_NOT_SUPPORTED"
    assert app_err.status_code == 422


def test_video_unavailable_mapping() -> None:
    exc = Exception("Video unavailable. This video has been removed by the uploader")
    app_err = map_ytdlp_error(exc)
    assert app_err.code == "VIDEO_UNAVAILABLE"
    assert app_err.status_code == 422


def test_network_timeout_mapping() -> None:
    exc = Exception("The read operation timed out after 30 seconds")
    app_err = map_ytdlp_error(exc)
    assert app_err.code == "UPSTREAM_ERROR"
    assert app_err.status_code == 502
    assert app_err.retryable is True


def test_generic_fallback_mapping() -> None:
    exc = Exception("Unrecognized internal processing glitch in extractor")
    app_err = map_ytdlp_error(exc)
    assert app_err.code == "CONVERSION_FAILED"
    assert app_err.status_code == 500
