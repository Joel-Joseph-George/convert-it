"""Job Ingestion, Status, SSE Streaming, Cancellation, and Download Endpoints."""

import asyncio
import json
import os
import secrets
import shutil
import time
from collections.abc import AsyncGenerator
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, Request, Response, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.core.admission import check_admission
from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import logger
from app.core.security import sanitize_filename, sniff_magic_type, verify_access_code
from app.jobs.models import JobClass, JobRecord, JobSnapshot
from app.jobs.queue import JobQueue
from app.jobs.runner import JobRunner
from app.jobs.store import JobStore

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobCreatedResponse(BaseModel):
    jobId: str


@router.post("/convert", response_model=JobCreatedResponse, status_code=202)
async def create_convert_job(
    request: Request,
    toolId: Annotated[str, Form(...)],
    file: Annotated[UploadFile, File(...)],
    options: Annotated[str, Form()] = "{}",
) -> JobCreatedResponse:
    """Accept multipart file upload for conversion, streaming directly to disk with size and type checks."""
    app_state = request.app.state
    store: JobStore = app_state.store
    queue: JobQueue = app_state.queue
    is_draining: bool = getattr(app_state, "is_draining", False)

    # 1. Admission Control
    client_ip = await check_admission(request, store, queue, is_draining=is_draining)

    # Parse and validate options JSON
    try:
        parsed_options: dict[str, Any] = json.loads(options)
    except Exception as err:
        raise AppError(
            code="INVALID_OPTIONS",
            message="Invalid JSON options payload provided.",
            status_code=422,
        ) from err

    # Generate 128-bit unguessable job ID
    job_id = secrets.token_urlsafe(16)
    job_dir = os.path.join(settings.TMP_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    sanitized_name = sanitize_filename(file.filename or "uploaded_file")
    _, ext = os.path.splitext(sanitized_name)
    input_file_path = os.path.join(job_dir, f"input{ext}")

    # Stream to disk with hard size limit (do not trust Content-Length header)
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    bytes_written = 0
    header_bytes = b""

    try:
        with open(input_file_path, "wb") as out_file:
            while chunk := await file.read(64 * 1024):
                if not header_bytes:
                    header_bytes = chunk[:512]
                bytes_written += len(chunk)
                if bytes_written > max_bytes:
                    raise AppError(
                        code="FILE_TOO_LARGE",
                        message=f"File exceeds maximum upload limit of {settings.MAX_UPLOAD_MB}MB.",
                        status_code=413,
                    )
                out_file.write(chunk)
    except AppError:
        # Clean up partial upload immediately
        if os.path.exists(job_dir):
            shutil.rmtree(job_dir, ignore_errors=True)
        raise
    except Exception as e:
        logger.error("error_saving_upload_file", error=str(e))
        if os.path.exists(job_dir):
            shutil.rmtree(job_dir, ignore_errors=True)
        raise AppError(
            code="CONVERSION_FAILED",
            message="Failed to write uploaded file to disk.",
            status_code=500,
        ) from e

    # Sniff magic bytes if file non-empty
    if bytes_written == 0:
        if os.path.exists(job_dir):
            shutil.rmtree(job_dir, ignore_errors=True)
        raise AppError(
            code="FILE_CORRUPT",
            message="Uploaded file is empty (0 bytes).",
            status_code=422,
        )

    _sniffed_mime = sniff_magic_type(header_bytes)

    # Determine job class based on toolId
    job_class: JobClass = (
        "heavy"
        if toolId
        in (
            "pdf-to-word",
            "pdf-to-excel",
            "word-to-pdf",
            "excel-to-pdf",
            "powerpoint-to-pdf",
        )
        else "light"
    )

    record = JobRecord(
        id=job_id,
        type="convert",
        toolId=toolId,
        status="queued",
        jobClass=job_class,
        clientIp=client_ip,
        originalFilename=sanitized_name,
        options=parsed_options,
        inputPath=input_file_path,
    )

    await store.create_job(record)
    pos = await queue.enqueue(job_class, job_id)
    record.queuePosition = pos
    await store.update_job(record)

    logger.info(
        "job_enqueued",
        job_id=job_id,
        tool_id=toolId,
        job_class=job_class,
        pos=pos,
        client_ip=client_ip,
    )
    return JobCreatedResponse(jobId=job_id)


@router.get("/{job_id}", response_model=JobSnapshot)
async def get_job_status(request: Request, job_id: str) -> JobSnapshot:
    """Fetch current status and progress snapshot for a job."""
    verify_access_code(request)
    store: JobStore = request.app.state.store
    queue: JobQueue = request.app.state.queue

    job = await store.get_job(job_id)
    if not job:
        raise AppError(
            code="JOB_NOT_FOUND",
            message="Job not found.",
            status_code=404,
        )

    if job.status == "queued":
        job.queuePosition = await queue.get_position(job.jobClass, job.id)

    return job.to_snapshot()


@router.get("/{job_id}/events")
async def stream_job_events(request: Request, job_id: str) -> StreamingResponse:
    """SSE event stream pushing real-time job status and progress with 15s heartbeats."""
    verify_access_code(request)
    app_state = request.app.state
    store: JobStore = app_state.store
    runner: JobRunner = app_state.runner

    # Subscribe before reading the snapshot so an event fired in between isn't lost
    # (otherwise a job finishing at that moment leaves the stream waiting forever).
    event_queue = await runner.subscribe_events(job_id)
    job = await store.get_job(job_id)
    if not job:
        await runner.unsubscribe_events(job_id, event_queue)
        raise AppError(
            code="JOB_NOT_FOUND",
            message="Job not found.",
            status_code=404,
        )

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Yield initial snapshot immediately
            initial_data = json.dumps(job.to_snapshot().model_dump())
            yield f"event: status\ndata: {initial_data}\n\n"

            # If already finished, terminate
            if job.status in ("succeeded", "failed", "cancelled", "expired"):
                return

            while True:
                # 15s heartbeat comment
                try:
                    event = await asyncio.wait_for(event_queue.get(), timeout=15.0)
                    event_type = event.get("event", "message")
                    data_str = json.dumps(event.get("data", {}))
                    yield f"event: {event_type}\ndata: {data_str}\n\n"

                    if event_type in ("done", "error") or (
                        event_type == "status"
                        and event.get("data", {}).get("status") in ("cancelled", "expired")
                    ):
                        break

                except TimeoutError:
                    # SSE heartbeat comment
                    yield ": ping\n\n"

        except asyncio.CancelledError:
            pass
        finally:
            await runner.unsubscribe_events(job_id, event_queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/{job_id}")
async def cancel_job(request: Request, job_id: str) -> dict[str, str]:
    """Cancel a running or queued job and delete ephemeral files."""
    verify_access_code(request)
    runner: JobRunner = request.app.state.runner

    success = await runner.cancel_job(job_id)
    if not success:
        # Check if job exists at all
        store: JobStore = request.app.state.store
        job = await store.get_job(job_id)
        if not job:
            raise AppError(code="JOB_NOT_FOUND", message="Job not found.", status_code=404)
        return {"status": job.status}

    return {"status": "cancelled"}


@router.get("/{job_id}/download")
async def download_job_result(request: Request, job_id: str) -> Response:
    """Stream converted file result to client with safe Content-Disposition and cleanup timer."""
    verify_access_code(request)
    store: JobStore = request.app.state.store

    job = await store.get_job(job_id)
    if not job:
        raise AppError(code="JOB_NOT_FOUND", message="Job not found.", status_code=404)

    if job.status != "succeeded" or not job.result or not job.outputPath:
        raise AppError(
            code="JOB_NOT_FOUND",
            message="Result file not ready or job failed.",
            status_code=404,
        )

    if not os.path.exists(job.outputPath):
        raise AppError(
            code="JOB_EXPIRED",
            message="Result file has expired or was removed.",
            status_code=410,
        )

    # Record first download time for 60s cleanup grace
    if job.firstDownloadedAt is None:
        job.firstDownloadedAt = time.time()
    job.downloadCount += 1
    await store.update_job(job)

    safe_filename = sanitize_filename(job.result.filename)

    return FileResponse(
        path=job.outputPath,
        media_type=job.result.mime,
        filename=safe_filename,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
