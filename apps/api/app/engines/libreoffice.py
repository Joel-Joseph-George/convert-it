"""Server Engine: LibreOffice Headless Document Conversions (Section 11)."""

import asyncio
import os
import shutil
import signal
import sys
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import logger
from app.core.security import sanitize_filename
from app.jobs.models import JobRecord, JobResult


def find_libreoffice_binary() -> str | None:
    """Detect available headless LibreOffice binary in system PATH."""
    for binary in ("soffice", "libreoffice"):
        path = shutil.which(binary)
        if path:
            return path
    return None


async def convert_with_libreoffice(
    job: JobRecord,
    update_progress: Callable[[int, str | None], Any],
) -> JobResult:
    """Convert office documents (.docx, .xlsx, .pptx) to PDF via headless LibreOffice."""
    if not job.inputPath or not os.path.exists(job.inputPath):
        raise AppError(
            code="FILE_CORRUPT",
            message="Input document was not found on disk.",
            status_code=422,
        )

    binary = find_libreoffice_binary()
    if not binary:
        raise AppError(
            code="TOOL_DISABLED",
            message="LibreOffice is not installed or enabled on this server instance.",
            status_code=503,
            retryable=False,
        )

    input_path = job.inputPath
    job_dir = os.path.dirname(input_path)
    base_name, _ = os.path.splitext(sanitize_filename(job.originalFilename or "document"))
    expected_output_filename = f"{base_name}.pdf"
    expected_output_path = os.path.join(job_dir, expected_output_filename)

    # Unique profile directory per job to prevent concurrent instance profile locks (Section 11)
    profile_dir = os.path.join(job_dir, "lo_profile")
    os.makedirs(profile_dir, exist_ok=True)
    profile_uri = f"file://{os.path.abspath(profile_dir)}"

    await update_progress(15, "converting")

    cmd = [
        binary,
        "--headless",
        f"-env:UserInstallation={profile_uri}",
        "--convert-to",
        "pdf",
        "--outdir",
        job_dir,
        input_path,
    ]

    preexec_fn = os.setsid if sys.platform != "win32" else None

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        preexec_fn=preexec_fn,
    )

    try:
        await update_progress(45, "converting")
        _stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=float(settings.JOB_TIMEOUT_HEAVY_SEC),
        )
    except TimeoutError as err:
        logger.error("libreoffice_timeout", job_id=job.id)
        if proc.returncode is None:
            try:
                if sys.platform != "win32":
                    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                else:
                    proc.terminate()
            except Exception:
                pass
        raise AppError(
            code="CONVERSION_TIMEOUT",
            message="Document conversion exceeded the 180s timeout limit.",
            status_code=504,
        ) from err

    if proc.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="replace")
        logger.error(
            "libreoffice_failed", job_id=job.id, returncode=proc.returncode, stderr=err_msg
        )
        raise AppError(
            code="CONVERSION_FAILED",
            message="LibreOffice conversion failed.",
            status_code=500,
        )

    await update_progress(90, "finalizing")

    # Locate generated .pdf file in job_dir
    actual_output_path: str | None = None
    if os.path.exists(expected_output_path) and os.path.getsize(expected_output_path) > 0:
        actual_output_path = expected_output_path
    else:
        for f in os.listdir(job_dir):
            if f.endswith(".pdf") and os.path.isfile(os.path.join(job_dir, f)):
                actual_output_path = os.path.join(job_dir, f)
                break

    if not actual_output_path or os.path.getsize(actual_output_path) == 0:
        raise AppError(
            code="CONVERSION_FAILED",
            message="LibreOffice conversion completed but produced an empty or missing PDF file.",
            status_code=500,
        )

    final_name = os.path.basename(actual_output_path)
    size_bytes = os.path.getsize(actual_output_path)
    job.outputPath = actual_output_path
    expires_at = (datetime.now(UTC) + timedelta(minutes=settings.JOB_RESULT_TTL_MIN)).isoformat()

    return JobResult(
        filename=final_name,
        sizeBytes=size_bytes,
        mime="application/pdf",
        expiresAt=expires_at,
    )
