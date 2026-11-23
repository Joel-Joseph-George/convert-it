"""Unit tests for YouTube option validation and cancellation flags."""

import pytest

from app.core.errors import AppError
from app.engines.youtube_options import (
    merge_container,
    mime_for,
    parse_timestamp,
    validate_format,
    validate_trim,
    video_format_selector,
)
from app.jobs.cancellation import discard, is_cancelled, request_cancel


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("90", 90.0),
        ("1:30", 90.0),
        ("00:01:30", 90.0),
        ("1:02:03", 3723.0),
        ("12.5", 12.5),
        ("", None),
        (None, None),
    ],
)
def test_parse_timestamp(value: str | None, expected: float | None) -> None:
    assert parse_timestamp(value, "Trim start") == expected


@pytest.mark.parametrize("value", ["abc", "1:75", "1:60:00", "-5", "1::2", "--ss"])
def test_parse_timestamp_rejects_bad_input(value: str) -> None:
    with pytest.raises(AppError) as exc:
        parse_timestamp(value, "Trim start")
    assert exc.value.code == "INVALID_OPTIONS"


def test_validate_trim_requires_end_after_start() -> None:
    assert validate_trim("1:00", "2:00") == (60.0, 120.0)
    with pytest.raises(AppError):
        validate_trim("2:00", "1:00")


def test_validate_format_matches_mode() -> None:
    assert validate_format("video", "MP4") == "mp4"
    assert validate_format("audio", "opus") == "opus"
    with pytest.raises(AppError):
        validate_format("video", "opus")
    with pytest.raises(AppError):
        validate_format("audio", "webm")


def test_format_selector_prefers_container_compatible_streams() -> None:
    mp4 = video_format_selector(720, "mp4")
    assert mp4.startswith("bv*[height<=720][vcodec^=avc1]+ba[ext=m4a]")
    assert mp4.endswith("/b")
    assert video_format_selector(480, "webm").startswith("bv*[height<=480][ext=webm]+ba[ext=webm]")
    assert merge_container("webm") == "webm/mkv"
    assert merge_container("mp4") == "mp4/mkv"


def test_mime_from_real_extension() -> None:
    assert mime_for("clip.mkv", "video") == "video/x-matroska"
    assert mime_for("song.m4a", "audio") == "audio/mp4"
    assert mime_for("noext", "audio") == "audio/mpeg"


def test_cancellation_flags() -> None:
    assert not is_cancelled("job-x")
    request_cancel("job-x")
    assert is_cancelled("job-x")
    discard("job-x")
    assert not is_cancelled("job-x")
