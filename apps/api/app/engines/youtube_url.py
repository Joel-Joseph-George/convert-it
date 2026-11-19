"""YouTube URL Validation, Canonicalization, and SSRF Prevention according to Section 9.1."""

import re
from urllib.parse import parse_qs, urlparse

from app.core.errors import AppError

# Strict 11-character YouTube video ID regex
YOUTUBE_VIDEO_ID_REGEX = re.compile(r"^[a-zA-Z0-9_-]{11}$")

ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
}


def parse_canonical_youtube_url(raw_url: str) -> tuple[str, str]:
    """Parse, strictly validate, and canonicalize a YouTube URL.

    Returns:
        tuple[canonical_url, video_id]

    Raises:
        AppError: with code INVALID_URL or UNSUPPORTED_URL.
    """
    if not raw_url or not isinstance(raw_url, str):
        raise AppError(
            code="INVALID_URL",
            message="Please provide a valid YouTube link.",
            status_code=400,
        )

    raw_url = raw_url.strip()

    # Prepend https:// if protocol is missing
    if not raw_url.startswith(("http://", "https://")):
        raw_url = f"https://{raw_url}"

    try:
        parsed = urlparse(raw_url)
    except Exception as err:
        raise AppError(
            code="INVALID_URL",
            message="That doesn't look like a YouTube link.",
            status_code=400,
        ) from err

    # Hostname normalization (lowercase, strip port if any)
    hostname = (parsed.hostname or "").lower()

    if hostname not in ALLOWED_HOSTS:
        raise AppError(
            code="UNSUPPORTED_URL",
            message="Only YouTube links (youtube.com, youtu.be, music.youtube.com) are supported.",
            status_code=400,
        )

    # Reject URLs with userinfo credentials (e.g. user:pass@youtube.com)
    if parsed.username or parsed.password:
        raise AppError(
            code="INVALID_URL",
            message="Invalid credentials in YouTube URL.",
            status_code=400,
        )

    path = parsed.path or ""
    video_id: str | None = None

    if hostname == "youtu.be":
        # e.g. https://youtu.be/jNQXAC9IVRw
        parts = [p for p in path.split("/") if p]
        if parts:
            video_id = parts[0]
    else:
        # Check for playlists or channels which are not supported
        if path.startswith(("/playlist", "/channel", "/c/", "/user/", "/feed/")):
            raise AppError(
                code="UNSUPPORTED_URL",
                message="Playlists, channels, and feeds are not supported. Please link a single video.",
                status_code=400,
            )

        if path.startswith("/shorts/"):
            # e.g. https://www.youtube.com/shorts/jNQXAC9IVRw
            parts = [p for p in path.split("/") if p]
            if len(parts) >= 2:
                video_id = parts[1]
        elif path.startswith(("/watch", "/live")):
            # e.g. https://www.youtube.com/watch?v=jNQXAC9IVRw
            qs = parse_qs(parsed.query)
            v_list = qs.get("v")
            if v_list and len(v_list) > 0:
                video_id = v_list[0]
            elif path.startswith("/live/"):
                parts = [p for p in path.split("/") if p]
                if len(parts) >= 2:
                    video_id = parts[1]

    if not video_id or not YOUTUBE_VIDEO_ID_REGEX.match(video_id):
        raise AppError(
            code="INVALID_URL",
            message="That doesn't look like a valid YouTube video link.",
            status_code=400,
        )

    canonical_url = f"https://www.youtube.com/watch?v={video_id}"
    return canonical_url, video_id
