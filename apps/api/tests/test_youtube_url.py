"""Unit tests for YouTube URL parsing, canonicalization, and security rules (Section 9.1)."""

import pytest

from app.core.errors import AppError
from app.engines.youtube_url import parse_canonical_youtube_url


def test_valid_youtube_urls() -> None:
    expected_id = "jNQXAC9IVRw"
    expected_canonical = f"https://www.youtube.com/watch?v={expected_id}"

    valid_inputs = [
        "https://www.youtube.com/watch?v=jNQXAC9IVRw",
        "http://www.youtube.com/watch?v=jNQXAC9IVRw",
        "https://youtube.com/watch?v=jNQXAC9IVRw",
        "https://m.youtube.com/watch?v=jNQXAC9IVRw",
        "https://music.youtube.com/watch?v=jNQXAC9IVRw",
        "https://youtu.be/jNQXAC9IVRw",
        "https://www.youtube.com/shorts/jNQXAC9IVRw",
        "www.youtube.com/watch?v=jNQXAC9IVRw",
        "youtu.be/jNQXAC9IVRw",
        "https://www.youtube.com/watch?v=jNQXAC9IVRw&feature=share",
    ]

    for url in valid_inputs:
        canonical, vid = parse_canonical_youtube_url(url)
        assert vid == expected_id, f"Failed extracting video ID from {url}"
        assert canonical == expected_canonical, f"Failed canonicalizing {url}"


def test_hostile_and_unsupported_urls() -> None:
    # Attacker host mimicking youtube
    with pytest.raises(AppError) as exc:
        parse_canonical_youtube_url("https://youtube.com.attacker.com/watch?v=jNQXAC9IVRw")
    assert exc.value.code == "UNSUPPORTED_URL"

    # Non-YouTube domain
    with pytest.raises(AppError) as exc:
        parse_canonical_youtube_url("https://vimeo.com/123456789")
    assert exc.value.code == "UNSUPPORTED_URL"

    # Userinfo credentials in URL
    with pytest.raises(AppError) as exc:
        parse_canonical_youtube_url("https://admin:pass@www.youtube.com/watch?v=jNQXAC9IVRw")
    assert exc.value.code == "INVALID_URL"

    # Playlists
    with pytest.raises(AppError) as exc:
        parse_canonical_youtube_url("https://www.youtube.com/playlist?list=PL1234567890123456")
    assert exc.value.code == "UNSUPPORTED_URL"

    # Channels
    with pytest.raises(AppError) as exc:
        parse_canonical_youtube_url("https://www.youtube.com/channel/UC1234567890123456789012")
    assert exc.value.code == "UNSUPPORTED_URL"

    # Malformed video IDs
    with pytest.raises(AppError) as exc:
        parse_canonical_youtube_url("https://www.youtube.com/watch?v=short")
    assert exc.value.code == "INVALID_URL"

    with pytest.raises(AppError) as exc:
        parse_canonical_youtube_url("https://www.youtube.com/watch?v=123456789012345")
    assert exc.value.code == "INVALID_URL"

    with pytest.raises(AppError) as exc:
        parse_canonical_youtube_url("https://www.youtube.com/watch?v=invalid!@#$%")
    assert exc.value.code == "INVALID_URL"
