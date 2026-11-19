"""YouTube Extraction and Transcoding Engine backed by yt-dlp and ffmpeg."""

import asyncio
import os
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import yt_dlp

from app.core.config import settings
from app.core.errors import AppError
from app.engines.youtube_errors import map_ytdlp_error
from app.engines.youtube_url import parse_canonical_youtube_url
from app.jobs.models import JobRecord, JobResult


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


async def extract_video_info(raw_url: str) -> dict[str, Any]:
    """Extract and summarize metadata and available stream formats from a YouTube URL."""
    canonical_url, video_id = parse_canonical_youtube_url(raw_url)

    ydl_opts: dict[str, Any] = {
        "quiet": True,
        "noplaylist": True,
        "extract_flat": False,
        "no_warnings": True,
    }

    if settings.YT_COOKIES_FILE and os.path.exists(settings.YT_COOKIES_FILE):
        ydl_opts["cookiefile"] = settings.YT_COOKIES_FILE

    if settings.YT_PROXY:
        ydl_opts["proxy"] = settings.YT_PROXY

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
        raise map_ytdlp_error(exc) from exc

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

    mode = str(job.options.get("mode", "video"))
    target_format = str(job.options.get("format", "mp4")).lower()
    quality = job.options.get("quality")
    bitrate = job.options.get("bitrate")
    trim_start = job.options.get("trimStart")
    trim_end = job.options.get("trimEnd")
    embed_thumbnail = bool(job.options.get("embedThumbnail", False))
    embed_metadata = bool(job.options.get("embedMetadata", False))

    job_dir = os.path.join(settings.TMP_DIR, job.id)
    os.makedirs(job_dir, exist_ok=True)

    # Base output template
    out_template = os.path.join(job_dir, "%(title).100s.%(ext)s")

    loop = asyncio.get_running_loop()

    def progress_hook(d: dict[str, Any]) -> None:
        if job.cancelRequested:
            raise Exception("Job cancelled by user")

        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes", 0)
            if total > 0:
                pct = int((downloaded / total) * 85)
                # Schedule progress update thread-safely
                asyncio.run_coroutine_threadsafe(
                    update_progress(min(85, max(1, pct)), "downloading"),
                    loop,
                )

    ydl_opts: dict[str, Any] = {
        "outtmpl": out_template,
        "quiet": True,
        "noplaylist": True,
        "no_warnings": True,
        "progress_hooks": [progress_hook],
        "max_filesize": settings.YT_MAX_FILESIZE_MB * 1024 * 1024,
    }

    if settings.YT_COOKIES_FILE and os.path.exists(settings.YT_COOKIES_FILE):
        ydl_opts["cookiefile"] = settings.YT_COOKIES_FILE

    if settings.YT_PROXY:
        ydl_opts["proxy"] = settings.YT_PROXY

    postprocessors: list[dict[str, Any]] = []

    if mode == "audio":
        ydl_opts["format"] = "bestaudio/best"
        postprocessors.append(
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": target_format,
                "preferredquality": str(bitrate) if bitrate else "192",
            }
        )
    else:
        # Video mode
        max_h = int(quality) if quality else settings.YT_MAX_HEIGHT
        ydl_opts["format"] = f"bestvideo[height<={max_h}]+bestaudio/best[height<={max_h}]/best"
        ydl_opts["merge_output_format"] = target_format

    if embed_thumbnail and target_format in ("mp4", "mp3", "m4a"):
        ydl_opts["writethumbnail"] = True
        postprocessors.append({"key": "FFmpegThumbnailsConvertor", "format": "jpg"})
        postprocessors.append({"key": "EmbedThumbnail"})

    if embed_metadata:
        postprocessors.append({"key": "FFmpegMetadata"})

    if postprocessors:
        ydl_opts["postprocessors"] = postprocessors

    await update_progress(5, "downloading")

    def _sync_download() -> None:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([canonical_url])

    try:
        await asyncio.to_thread(_sync_download)
    except AppError:
        raise
    except Exception as exc:
        raise map_ytdlp_error(exc) from exc

    # Finalizing stage
    await update_progress(88, "finalizing")

    # Locate generated output file in job_dir
    created_files = [
        f
        for f in os.listdir(job_dir)
        if os.path.isfile(os.path.join(job_dir, f))
        and not f.endswith((".part", ".ytdl", ".temp", ".jpg", ".png", ".webp"))
    ]

    if not created_files:
        raise AppError(
            code="CONVERSION_FAILED",
            message="Downloaded output file was not found.",
            status_code=500,
        )

    output_file_name = created_files[0]
    output_path = os.path.join(job_dir, output_file_name)

    # Apply trim if requested
    if trim_start or trim_end:
        await update_progress(92, "finalizing")
        trimmed_name = f"trimmed_{output_file_name}"
        trimmed_path = os.path.join(job_dir, trimmed_name)

        cmd = ["ffmpeg", "-y"]
        if trim_start:
            cmd.extend(["-ss", str(trim_start)])
        cmd.extend(["-i", output_path])
        if trim_end:
            cmd.extend(["-to", str(trim_end)])
        cmd.extend(["-c", "copy", trimmed_path])

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.communicate()

        if os.path.exists(trimmed_path) and os.path.getsize(trimmed_path) > 0:
            os.remove(output_path)
            output_path = trimmed_path
            output_file_name = trimmed_name

    file_size = os.path.getsize(output_path)
    if file_size > settings.YT_MAX_FILESIZE_MB * 1024 * 1024:
        raise AppError(
            code="FILE_TOO_LARGE",
            message=f"Downloaded file exceeds {settings.YT_MAX_FILESIZE_MB}MB limit.",
            status_code=413,
        )

    job.outputPath = output_path
    mime_type = "video/mp4" if mode == "video" else "audio/mpeg"
    if target_format == "webm":
        mime_type = "video/webm"
    elif target_format == "m4a":
        mime_type = "audio/mp4"
    elif target_format == "wav":
        mime_type = "audio/wav"
    elif target_format == "opus":
        mime_type = "audio/opus"

    expires_at = (datetime.now(UTC) + timedelta(minutes=settings.JOB_RESULT_TTL_MIN)).isoformat()

    return JobResult(
        filename=output_file_name,
        sizeBytes=file_size,
        mime=mime_type,
        expiresAt=expires_at,
    )
