"""Fake Echo Engine for testing and validating the full job lifecycle."""

import asyncio
import os
import shutil
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.config import settings
from app.core.errors import AppError
from app.jobs.models import JobRecord, JobResult


async def echo_engine(
    job: JobRecord,
    update_progress: Callable[[int, str | None], Any],
) -> JobResult:
    """Fake echo conversion engine that reads input, reports staged progress, and produces output."""
    if not job.inputPath or not os.path.exists(job.inputPath):
        raise AppError(
            code="FILE_CORRUPT",
            message="Input file not found on disk for processing.",
            status_code=422,
        )

    # 1. Stage: downloading / ingestion
    await update_progress(15, "downloading")
    await asyncio.sleep(0.05)
    await update_progress(30, "downloading")

    # 2. Stage: converting
    await update_progress(50, "converting")
    await asyncio.sleep(0.05)
    await update_progress(80, "converting")

    # 3. Stage: finalizing
    await update_progress(95, "finalizing")

    job_dir = os.path.dirname(job.inputPath)
    orig_name = job.originalFilename or "result.bin"
    output_filename = f"converted_{orig_name}"
    output_path = os.path.join(job_dir, output_filename)

    # Copy input to output (echo conversion)
    shutil.copy2(job.inputPath, output_path)
    job.outputPath = output_path

    size_bytes = os.path.getsize(output_path)
    mime = "application/octet-stream"
    if output_filename.endswith(".txt"):
        mime = "text/plain"
    elif output_filename.endswith(".json"):
        mime = "application/json"
    elif output_filename.endswith(".pdf"):
        mime = "application/pdf"

    expires_at = (datetime.now(UTC) + timedelta(minutes=settings.JOB_RESULT_TTL_MIN)).isoformat()

    return JobResult(
        filename=output_filename,
        sizeBytes=size_bytes,
        mime=mime,
        expiresAt=expires_at,
    )
