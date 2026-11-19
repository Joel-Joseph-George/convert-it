"""Server Engine: PDF to Word (.docx) using pdf2docx (Section 11)."""

import asyncio
import os
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from pdf2docx import Converter

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import sanitize_filename
from app.jobs.models import JobRecord, JobResult


async def convert_pdf_to_word(
    job: JobRecord,
    update_progress: Callable[[int, str | None], Any],
) -> JobResult:
    """Convert input PDF document to Word .docx with staged progress."""
    if not job.inputPath or not os.path.exists(job.inputPath):
        raise AppError(
            code="FILE_CORRUPT",
            message="Input PDF file was not found on disk.",
            status_code=422,
        )

    input_path = job.inputPath
    job_dir = os.path.dirname(input_path)
    base_name, _ = os.path.splitext(sanitize_filename(job.originalFilename or "document.pdf"))
    output_filename = f"{base_name}.docx"
    output_path = os.path.join(job_dir, output_filename)

    await update_progress(10, "converting")

    def _sync_convert() -> None:
        cv = Converter(input_path)
        try:
            cv.convert(output_path, start=0, end=None)
        finally:
            cv.close()

    try:
        await update_progress(35, "converting")
        await asyncio.to_thread(_sync_convert)
        await update_progress(90, "finalizing")
    except Exception as exc:
        raise AppError(
            code="CONVERSION_FAILED",
            message="Failed to convert PDF document to Word format.",
            status_code=500,
        ) from exc

    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        raise AppError(
            code="CONVERSION_FAILED",
            message="PDF conversion produced an empty or missing Word document.",
            status_code=500,
        )

    size_bytes = os.path.getsize(output_path)
    job.outputPath = output_path
    expires_at = (datetime.now(UTC) + timedelta(minutes=settings.JOB_RESULT_TTL_MIN)).isoformat()

    return JobResult(
        filename=output_filename,
        sizeBytes=size_bytes,
        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        expiresAt=expires_at,
    )
