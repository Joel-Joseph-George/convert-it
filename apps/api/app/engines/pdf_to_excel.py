"""Server Engine: PDF to Excel (.xlsx) using pdfplumber and openpyxl (Section 11)."""

import asyncio
import os
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import openpyxl
import pdfplumber

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import sanitize_filename
from app.jobs.models import JobRecord, JobResult


async def convert_pdf_to_excel(
    job: JobRecord,
    update_progress: Callable[[int, str | None], Any],
) -> JobResult:
    """Extract tables from PDF into an Excel workbook with one sheet per page containing tables."""
    if not job.inputPath or not os.path.exists(job.inputPath):
        raise AppError(
            code="FILE_CORRUPT",
            message="Input PDF file was not found on disk.",
            status_code=422,
        )

    input_path = job.inputPath
    job_dir = os.path.dirname(input_path)
    base_name, _ = os.path.splitext(sanitize_filename(job.originalFilename or "spreadsheet.pdf"))
    output_filename = f"{base_name}.xlsx"
    output_path = os.path.join(job_dir, output_filename)

    await update_progress(10, "converting")

    def _sync_extract() -> bool:
        wb = openpyxl.Workbook()
        # Remove default sheet
        if wb.active is not None:
            wb.remove(wb.active)
        sheets_created = 0

        with pdfplumber.open(input_path) as pdf:
            for page_idx, page in enumerate(pdf.pages, start=1):
                tables = page.extract_tables()
                if not tables:
                    continue

                ws = wb.create_sheet(title=f"Page {page_idx}")
                sheets_created += 1

                for table in tables:
                    for row in table:
                        # Clean cell values
                        cleaned_row = [
                            cell.strip() if isinstance(cell, str) else cell for cell in row
                        ]
                        ws.append(cleaned_row)
                    # Add blank line between multiple tables on same page
                    ws.append([])

        if sheets_created == 0:
            return False

        wb.save(output_path)
        return True

    try:
        await update_progress(40, "converting")
        tables_found = await asyncio.to_thread(_sync_extract)
    except Exception as exc:
        raise AppError(
            code="CONVERSION_FAILED",
            message="An error occurred while extracting tables from PDF.",
            status_code=500,
        ) from exc

    if not tables_found:
        raise AppError(
            code="NO_TABLES_FOUND",
            message="No tables found. Scanned PDFs may need OCR.",
            status_code=422,
            retryable=False,
        )

    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        raise AppError(
            code="CONVERSION_FAILED",
            message="PDF conversion produced an empty or missing Excel workbook.",
            status_code=500,
        )

    await update_progress(95, "finalizing")

    size_bytes = os.path.getsize(output_path)
    job.outputPath = output_path
    expires_at = (datetime.now(UTC) + timedelta(minutes=settings.JOB_RESULT_TTL_MIN)).isoformat()

    return JobResult(
        filename=output_filename,
        sizeBytes=size_bytes,
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        expiresAt=expires_at,
    )
