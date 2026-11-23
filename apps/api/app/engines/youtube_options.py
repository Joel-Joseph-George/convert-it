"""Validation for YouTube download options: output formats, trim timestamps, and yt-dlp selectors."""

import re

from app.core.errors import AppError

VIDEO_FORMATS = frozenset({"mp4", "webm"})
AUDIO_FORMATS = frozenset({"mp3", "m4a", "opus", "wav"})

MIME_BY_EXTENSION = {
    "mp4": "video/mp4",
    "webm": "video/webm",
    "mkv": "video/x-matroska",
    "mp3": "audio/mpeg",
    "m4a": "audio/mp4",
    "opus": "audio/opus",
    "ogg": "audio/ogg",
    "wav": "audio/wav",
}

_TIMESTAMP_PATTERN = re.compile(r"^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$")


def _invalid(message: str) -> AppError:
    return AppError(code="INVALID_OPTIONS", message=message, status_code=422)


def parse_timestamp(value: str | None, field: str) -> float | None:
    """Parse "SS", "MM:SS" or "HH:MM:SS" (optionally with fractional seconds) into seconds."""
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None
    if not _TIMESTAMP_PATTERN.match(text):
        raise _invalid(f"{field} must look like 90, 1:30 or 00:01:30.")

    parts = text.split(":")
    seconds = float(parts[-1])
    minutes = int(parts[-2]) if len(parts) >= 2 else 0
    hours = int(parts[-3]) if len(parts) == 3 else 0
    if len(parts) >= 2 and seconds >= 60:
        raise _invalid(f"{field} has more than 59 seconds.")
    if len(parts) == 3 and minutes >= 60:
        raise _invalid(f"{field} has more than 59 minutes.")
    return hours * 3600 + minutes * 60 + seconds


def validate_trim(
    trim_start: str | None, trim_end: str | None
) -> tuple[float | None, float | None]:
    """Validate a trim range and return (start_sec, end_sec)."""
    start = parse_timestamp(trim_start, "Trim start")
    end = parse_timestamp(trim_end, "Trim end")
    if start is not None and end is not None and end <= start:
        raise _invalid("Trim end must be after trim start.")
    if end is not None and end <= 0:
        raise _invalid("Trim end must be greater than zero.")
    return start, end


def validate_format(mode: str, target_format: str) -> str:
    """Ensure the output format matches the download mode."""
    fmt = target_format.lower()
    allowed = VIDEO_FORMATS if mode == "video" else AUDIO_FORMATS
    if fmt not in allowed:
        raise _invalid(
            f"'{target_format}' isn't available for {mode} downloads. "
            f"Choose one of: {', '.join(sorted(allowed))}."
        )
    return fmt


def video_format_selector(max_height: int, container: str) -> str:
    """Build a yt-dlp format selector that prefers streams that fit the requested container."""
    h = f"[height<={max_height}]"
    if container == "webm":
        preferred = f"bv*{h}[ext=webm]+ba[ext=webm]"
    else:
        # H.264 + AAC plays everywhere; VP9/AV1 in MP4 trips up many players.
        preferred = f"bv*{h}[vcodec^=avc1]+ba[ext=m4a]/bv*{h}[ext=mp4]+ba[ext=m4a]"
    return f"{preferred}/bv*{h}+ba/b{h}/b"


def merge_container(container: str) -> str:
    """Containers yt-dlp may merge into, in preference order (mkv as a safe fallback)."""
    return "webm/mkv" if container == "webm" else "mp4/mkv"


def mime_for(filename: str, mode: str) -> str:
    """Pick a MIME type from the real output extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return MIME_BY_EXTENSION.get(ext, "video/mp4" if mode == "video" else "audio/mpeg")
