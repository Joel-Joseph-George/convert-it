"""Admission Control for Server Jobs according to Section 8.3."""

import os
import shutil

from fastapi import Request

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import get_client_ip, verify_access_code
from app.jobs.queue import JobQueue
from app.jobs.store import JobStore


async def check_admission(
    request: Request,
    store: JobStore,
    queue: JobQueue,
    is_draining: bool = False,
) -> str:
    """Perform admission control checks in strict order (Section 8.3). Returns client IP if accepted."""
    # 0. Check if server is currently draining for shutdown
    if is_draining:
        raise AppError(
            code="SERVER_BUSY",
            message="Server is shutting down and not accepting new jobs.",
            status_code=503,
            retryable=True,
            retry_after_sec=15,
        )

    # 1. Access code (if enabled) -> AUTH_REQUIRED
    verify_access_code(request)

    client_ip = get_client_ip(request)

    # 2. Per-IP request rate & job create rate -> RATE_LIMITED + Retry-After
    allowed, _count, retry_after = await store.check_job_creation_limit(
        client_ip, window_seconds=600, max_creates=settings.JOB_CREATES_PER_10MIN
    )
    if not allowed:
        raise AppError(
            code="RATE_LIMITED",
            message="Too many job requests. Please try again later.",
            status_code=429,
            retryable=True,
            retry_after_sec=retry_after,
        )

    # 3. Per-IP active jobs (default 2) -> RATE_LIMITED
    active_ip_jobs = await store.get_active_jobs_for_ip(client_ip)
    if active_ip_jobs >= settings.MAX_ACTIVE_JOBS_PER_IP:
        raise AppError(
            code="RATE_LIMITED",
            message=f"You already have {active_ip_jobs} active job(s) in progress.",
            status_code=429,
            retryable=True,
            retry_after_sec=10,
        )

    # 4. Global queue length (default 20) -> QUEUE_FULL + Retry-After
    total_queued = await queue.get_total_queued()
    if total_queued >= settings.MAX_QUEUE_LENGTH:
        raise AppError(
            code="QUEUE_FULL",
            message="The server conversion queue is full. Please try again in a moment.",
            status_code=503,
            retryable=True,
            retry_after_sec=15,
        )

    # 5. Free temp disk space vs MAX_TMP_DISK_MB -> SERVER_BUSY
    os.makedirs(settings.TMP_DIR, exist_ok=True)
    usage = shutil.disk_usage(settings.TMP_DIR)
    free_mb = usage.free / (1024 * 1024)
    # If free disk space is less than 50MB or less than required threshold
    if free_mb < 50:
        raise AppError(
            code="SERVER_BUSY",
            message="Server disk space is temporarily exhausted.",
            status_code=503,
            retryable=True,
            retry_after_sec=30,
        )

    return client_ip
