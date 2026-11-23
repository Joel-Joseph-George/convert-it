"""YouTube Extraction and Transcoding Engine backed by yt-dlp and ffmpeg."""

import asyncio
import os
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import yt_dlp

from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import logger
from app.engines.youtube_errors import map_ytdlp_error
from app.engines.youtube_options import (
    merge_container,
    mime_for,
    validate_format,
    validate_trim,
    video_format_selector,
)
from app.engines.youtube_url import parse_canonical_youtube_url
from app.jobs.cancellation import is_cancelled
from app.jobs.models import JobRecord, JobResult

TEMP_SUFFIXES = (".part", ".ytdl", ".temp", ".jpg", ".jpeg", ".png", ".webp", ".json", ".vtt")


def format_duration(seconds: int | float | None) -> str:
    """Format duration in seconds to mm:ss or hh:mm:ss."""
    if not seconds or seconds < 0:
        return "00:00"
    total_sec = int(seconds)
    hours = total_sec // 3600
    minutes = (total_sec % 3600) // 60
    secs = total_sec % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def base_ydl_options() -> dict[str, Any]:
    """Options shared by info extraction and downloads (auth cookies, proxy, quiet output)."""
    opts: dict[str, Any] = {
        "quiet": True,
        "noplaylist": True,
        "no_warnings": True,
    }
    if settings.YT_COOKIES_FILE:
        if os.path.exists(settings.YT_COOKIES_FILE):
            opts["cookiefile"] = settings.YT_COOKIES_FILE
        else:
            logger.warn("yt_cookies_file_missing", path=settings.YT_COOKIES_FILE)
    if settings.YT_PROXY:
        opts["proxy"] = settings.YT_PROXY
    return opts


async def extract_video_info(raw_url: str) -> dict[str, Any]:
    """Extract and summarize metadata and available stream formats from a YouTube URL."""
    canonical_url, video_id = parse_canonical_youtube_url(raw_url)

    ydl_opts: dict[str, Any] = {
        **base_ydl_options(),
        "extract_flat": False,
    }

    def _sync_extract() -> dict[str, Any]:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            res = ydl.extract_info(canonical_url, download=False)
            if not isinstance(res, dict):
                return {}
            return res

    try:
        info = await asyncio.to_thread(_sync_extract)
    except AppError:
        raise
    except Exception as exc:
        raise map_ytdlp_error(exc, stage="info") from exc

    if not info:
        raise AppError(
            code="VIDEO_UNAVAILABLE",
            message="Could not retrieve video information.",
            status_code=422,
        )

    duration_sec = info.get("duration", 0)
    max_duration_sec = settings.YT_MAX_DURATION_MIN * 60
    too_long = bool(duration_sec and duration_sec > max_duration_sec)

    # Process and summarize available video stream heights
    raw_formats = info.get("formats", [])
    video_formats: list[dict[str, Any]] = []
    seen_heights: set[int] = set()

    for fmt in raw_formats:
        vcodec = fmt.get("vcodec", "none")
        height = fmt.get("height")
        if (
            vcodec != "none"
            and height
            and height <= settings.YT_MAX_HEIGHT
            and height not in seen_heights
        ):
            seen_heights.add(height)
            # Approximate size in MB
            filesize = fmt.get("filesize") or fmt.get("filesize_approx")
            filesize_mb = round(filesize / (1024 * 1024), 1) if filesize else None
            video_formats.append(
                {
                    "formatId": fmt.get("format_id", ""),
                    "height": height,
                    "note": f"{height}p",
                    "ext": "mp4",
                    "filesizeApproxMB": filesize_mb,
                }
            )

    # Sort video formats descending by height (e.g. 1080p down to 360p)
    video_formats.sort(key=lambda x: x["height"], reverse=True)

    # Standard audio output profiles
    audio_formats = [
        {"format": "mp3", "bitrates": [128, 192, 256, 320]},
        {"format": "m4a", "bitrates": [128, 192, 256]},
        {"format": "opus", "bitrates": [128, 160]},
        {"format": "wav", "bitrates": []},
    ]

    return {
        "id": video_id,
        "title": info.get("title", "YouTube Video"),
        "channel": info.get("uploader") or info.get("channel", "Unknown Channel"),
        "durationSec": duration_sec,
        "durationFormatted": format_duration(duration_sec),
        "thumbnailUrl": info.get("thumbnail"),
        "viewCount": info.get("view_count"),
        "uploadDate": info.get("upload_date"),
        "tooLong": too_long,
        "maxDurationMin": settings.YT_MAX_DURATION_MIN,
        "videoFormats": video_formats,
        "audioFormats": audio_formats,
    }


async def download_youtube(
    job: JobRecord,
    update_progress: Callable[[int, str | None], Any],
) -> JobResult:
    """Download and transcode YouTube video/audio according to job options."""
    raw_url = str(job.options.get("url", ""))
    canonical_url, _video_id = parse_canonical_youtube_url(raw_url)

    mode = "audio" if job.options.get("mode") == "audio" else "video"
    target_format = validate_format(mode, str(job.options.get("format") or "mp4"))
    quality = job.options.get("quality")
    bitrate = job.options.get("bitrate")
    trim_start, trim_end = validate_trim(job.options.get("trimStart"), job.options.get("trimEnd"))
    embed_thumbnail = bool(job.options.get("embedThumbnail", False))
    embed_metadata = bool(job.options.get("embedMetadata", False))

    job_dir = os.path.join(settings.TMP_DIR, job.id)
    os.makedirs(job_dir, exist_ok=True)

    loop = asyncio.get_running_loop()
    max_bytes = settings.YT_MAX_FILESIZE_MB * 1024 * 1024
    max_duration_sec = settings.YT_MAX_DURATION_MIN * 60

    # Progress across all streams (video + audio are downloaded separately, then merged).
    progress_state = {"streams_total": 1, "streams_done": 0, "last_pct": -1}

    def report(pct: int, stage: str) -> None:
        asyncio.run_coroutine_threadsafe(update_progress(pct, stage), loop)

    def check_cancelled() -> None:
        if is_cancelled(job.id):
            raise yt_dlp.utils.DownloadCancelled("Job cancelled")

    def progress_hook(d: dict[str, Any]) -> None:
        check_cancelled()
        status = d.get("status")
        if status == "finished":
            progress_state["streams_done"] += 1
            return
        if status != "downloading":
            return
        total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
        if total <= 0:
            return
        fraction = min(1.0, d.get("downloaded_bytes", 0) / total)
        overall = (progress_state["streams_done"] + fraction) / progress_state["streams_total"]
        pct = min(85, max(5, int(overall * 85)))
        if pct != progress_state["last_pct"]:
            progress_state["last_pct"] = pct
            report(pct, "downloading")

    def postprocessor_hook(d: dict[str, Any]) -> None:
        check_cancelled()
        if d.get("status") == "started":
            report(88, "converting")

    ydl_opts: dict[str, Any] = {
        **base_ydl_options(),
        "outtmpl": os.path.join(job_dir, "%(title).100B.%(ext)s"),
        "progress_hooks": [progress_hook],
        "postprocessor_hooks": [postprocessor_hook],
        "max_filesize": max_bytes,
    }

    postprocessors: list[dict[str, Any]] = []

    if mode == "audio":
        ydl_opts["format"] = "bestaudio/best"
        extract: dict[str, Any] = {"key": "FFmpegExtractAudio", "preferredcodec": target_format}
        if target_format != "wav":
            extract["preferredquality"] = str(bitrate) if bitrate else "192"
        postprocessors.append(extract)
    else:
        max_h = min(int(quality), settings.YT_MAX_HEIGHT) if quality else settings.YT_MAX_HEIGHT
        ydl_opts["format"] = video_format_selector(max_h, target_format)
        ydl_opts["merge_output_format"] = merge_container(target_format)

    if embed_metadata:
        postprocessors.append({"key": "FFmpegMetadata"})

    if embed_thumbnail and target_format in ("mp4", "mp3", "m4a"):
        ydl_opts["writethumbnail"] = True
        postprocessors.append({"key": "FFmpegThumbnailsConvertor", "format": "jpg"})
        postprocessors.append({"key": "EmbedThumbnail"})

    if postprocessors:
        ydl_opts["postprocessors"] = postprocessors

    await update_progress(2, "downloading")

    def _sync_download() -> None:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Resolve formats first so limits are enforced before any bytes are downloaded.
            info = ydl.extract_info(canonical_url, download=False)
            if not isinstance(info, dict):
                raise AppError(
                    code="VIDEO_UNAVAILABLE",
                    message="Could not retrieve video information.",
                    status_code=422,
                )

            duration = float(info.get("duration") or 0)
            if trim_start is not None and duration and trim_start >= duration:
                raise AppError(
                    code="INVALID_OPTIONS",
                    message="Trim start is past the end of the video.",
                    status_code=422,
                )
            effective = (min(trim_end, duration) if trim_end and duration else duration) - (
                trim_start or 0
            )
            if mode == "video" and effective > max_duration_sec:
                raise AppError(
                    code="VIDEO_TOO_LONG",
                    message=(
                        f"Video downloads are limited to {settings.YT_MAX_DURATION_MIN} minutes. "
                        "Choose audio only or trim a shorter section."
                    ),
                    status_code=422,
                )

            requested = info.get("requested_formats")
            if isinstance(requested, list) and requested:
                progress_state["streams_total"] = len(requested)

            check_cancelled()
            ydl.process_ie_result(info, download=True)

    try:
        await asyncio.to_thread(_sync_download)
    except AppError:
        raise
    except Exception as exc:
        raise map_ytdlp_error(exc, stage="download") from exc

    await update_progress(90, "finalizing")

    # Locate the generated output (largest non-temporary file in the job dir).
    candidates = [
        os.path.join(job_dir, f)
        for f in os.listdir(job_dir)
        if os.path.isfile(os.path.join(job_dir, f)) and not f.lower().endswith(TEMP_SUFFIXES)
    ]
    if not candidates:
        raise AppError(
            code="CONVERSION_FAILED",
            message="Downloaded output file was not found.",
            status_code=500,
        )
    output_path = max(candidates, key=os.path.getsize)
    output_file_name = os.path.basename(output_path)

    if trim_start is not None or trim_end is not None:
        await update_progress(93, "finalizing")
        output_path, output_file_name = await _trim_media(
            output_path, job_dir, trim_start, trim_end
        )

    file_size = os.path.getsize(output_path)
    if file_size > max_bytes:
        raise AppError(
            code="FILE_TOO_LARGE",
            message=f"Downloaded file exceeds {settings.YT_MAX_FILESIZE_MB}MB limit.",
            status_code=413,
        )

    job.outputPath = output_path
    expires_at = (datetime.now(UTC) + timedelta(minutes=settings.JOB_RESULT_TTL_MIN)).isoformat()

    return JobResult(
        filename=output_file_name,
        sizeBytes=file_size,
        mime=mime_for(output_file_name, mode),
        expiresAt=expires_at,
    )


async def _trim_media(
    input_path: str,
    job_dir: str,
    trim_start: float | None,
    trim_end: float | None,
) -> tuple[str, str]:
    """Cut [trim_start, trim_end) out of the file with a stream copy (no re-encode)."""
    base, ext = os.path.splitext(os.path.basename(input_path))
    trimmed_name = f"{base} (trimmed){ext}"
    trimmed_path = os.path.join(job_dir, trimmed_name)

    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    if trim_start:
        # Input seeking resets timestamps to zero, so the end is expressed as a duration.
        cmd += ["-ss", f"{trim_start:.3f}"]
    cmd += ["-i", input_path]
    if trim_end is not None:
        cmd += ["-t", f"{trim_end - (trim_start or 0):.3f}"]
    cmd += ["-map_metadata", "0", "-c", "copy", "-avoid_negative_ts", "make_zero", trimmed_path]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if (
        proc.returncode != 0
        or not os.path.exists(trimmed_path)
        or os.path.getsize(trimmed_path) == 0
    ):
        logger.warn(
            "youtube_trim_failed",
            returncode=proc.returncode,
            detail=stderr.decode(errors="replace")[-500:],
        )
        raise AppError(
            code="CONVERSION_FAILED",
            message="Trimming the download failed. Check the trim times and try again.",
            status_code=500,
            retryable=False,
        )

    os.remove(input_path)
    return trimmed_path, trimmed_name
