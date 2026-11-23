"""Unit tests verifying mapping of yt-dlp exceptions to AppError shapes (Section 10.3)."""

from app.engines.youtube_errors import map_ytdlp_error, redact_ytdlp_message


def test_bot_detection_mapping() -> None:
    exc = Exception("Sign in to confirm you're not a bot. This helps protect our community.")
    app_err = map_ytdlp_error(exc)
    assert app_err.code == "UPSTREAM_BLOCKED"
    assert app_err.status_code == 502
    assert app_err.retryable is True


def test_age_restricted_mapping() -> None:
    exc = Exception("Sign in to confirm your age. This video may be inappropriate for some users.")
    app_err = map_ytdlp_error(exc)
    assert app_err.code == "AGE_RESTRICTED"
    assert app_err.status_code == 422


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


def test_bot_detection_with_typographic_apostrophe() -> None:
    # YouTube sends a curly apostrophe; this used to fall through to CONVERSION_FAILED.
    exc = Exception(
        "ERROR: [youtube] jNQXAC9IVRw: Sign in to confirm you\u2019re not a bot. "
        "Use --cookies-from-browser or --cookies for the authentication."
    )
    assert map_ytdlp_error(exc).code == "UPSTREAM_BLOCKED"


def test_age_gate_with_cookie_hint_is_not_bot_check() -> None:
    exc = Exception(
        "Sign in to confirm your age. This video may be inappropriate for some users. "
        "Use --cookies-from-browser or --cookies for the authentication."
    )
    assert map_ytdlp_error(exc).code == "AGE_RESTRICTED"


def test_requested_format_unavailable_mapping() -> None:
    exc = Exception("ERROR: [youtube] abc: Requested format is not available. Use --list-formats")
    err = map_ytdlp_error(exc)
    assert err.code == "FORMAT_UNAVAILABLE"
    assert err.status_code == 422


def test_redact_strips_video_ids_and_urls() -> None:
    msg = "ERROR: [youtube] jNQXAC9IVRw: failed, see https://www.youtube.com/watch?v=jNQXAC9IVRw"
    redacted = redact_ytdlp_message(msg)
    assert "jNQXAC9IVRw" not in redacted
    assert "<url>" in redacted


def test_this_video_is_unavailable_mapping() -> None:
    exc = Exception("ERROR: [youtube] aaaaaaaaaaa: This video is unavailable")
    assert map_ytdlp_error(exc).code == "VIDEO_UNAVAILABLE"
