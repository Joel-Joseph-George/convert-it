"""Job Runner and Worker Pool implementation."""

import asyncio
import os
import shutil
import signal
import sys
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import psutil

from app.core.config import settings
from app.core.errors import AppError, ErrorDetail
from app.core.logging import logger
from app.jobs.models import JobClass, JobRecord
from app.jobs.queue import JobQueue
from app.jobs.store import JobStore

# Engine execution callable type: (job: JobRecord, update_progress: Callable[[int, str | None], Awaitable[None]]) -> Awaitable[JobResult]
EngineHandler = Callable[[JobRecord, Callable[[int, str | None], Any]], Any]


class JobRunner:
    """Asyncio worker pool that pulls from JobQueue and executes engines with admission control."""

    def __init__(self, store: JobStore, queue: JobQueue) -> None:
        self.store = store
        self.queue = queue
        self.light_slots = asyncio.Semaphore(settings.CONCURRENCY_LIGHT)
        self._workers: list[asyncio.Task[None]] = []
        self._running = False
        self._active_jobs: dict[str, asyncio.Task[None]] = {}
        self._active_processes: dict[str, asyncio.subprocess.Process] = {}
        self._event_subscribers: dict[str, list[asyncio.Queue[dict[str, Any]]]] = {}
        self._engines: dict[str, EngineHandler] = {}

    def register_engine(self, tool_id: str, handler: EngineHandler) -> None:
        """Register an engine handler for a tool ID."""
        self._engines[tool_id] = handler

    async def start(self) -> None:
        """Start worker pools for each job class."""
        self._running = True

        # Heavy workers
        for _ in range(settings.CONCURRENCY_HEAVY):
            task = asyncio.create_task(self._worker_loop("heavy"))
            self._workers.append(task)

        # YouTube workers
        for _ in range(settings.CONCURRENCY_YOUTUBE):
            task = asyncio.create_task(self._worker_loop("youtube"))
            self._workers.append(task)

        # Light workers
        for _ in range(settings.CONCURRENCY_LIGHT):
            task = asyncio.create_task(self._worker_loop("light"))
            self._workers.append(task)

        logger.info(
            "job_runner_started",
            heavy_workers=settings.CONCURRENCY_HEAVY,
            youtube_workers=settings.CONCURRENCY_YOUTUBE,
            light_workers=settings.CONCURRENCY_LIGHT,
        )

    async def stop(self, grace_period_sec: float = 30.0) -> None:
        """Gracefully drain running jobs and stop workers."""
        self._running = False
        logger.info("job_runner_stopping", grace_period_sec=grace_period_sec)

        # Cancel idle workers wait
        for worker in self._workers:
            worker.cancel()

        # Wait for active tasks to complete up to grace period
        start_wait = time.time()
        while self._active_jobs and (time.time() - start_wait) < grace_period_sec:
            await asyncio.sleep(0.5)

        # Cancel any remaining running tasks
        for job_id, task in list(self._active_jobs.items()):
            logger.warn("cancelling_active_job_on_shutdown", job_id=job_id)
            task.cancel()

        # Terminate any external subprocesses
        for job_id, proc in list(self._active_processes.items()):
            try:
                if proc.returncode is None:
                    if sys.platform != "win32":
                        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                    else:
                        proc.terminate()
            except Exception as e:
                logger.error("error_terminating_process", job_id=job_id, error=str(e))

        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()

    async def subscribe_events(self, job_id: str) -> asyncio.Queue[dict[str, Any]]:
        """Subscribe an SSE client to receive real-time updates for a job."""
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        subscribers = self._event_subscribers.setdefault(job_id, [])
        subscribers.append(q)
        return q

    async def unsubscribe_events(self, job_id: str, q: asyncio.Queue[dict[str, Any]]) -> None:
        """Unsubscribe an SSE client."""
        subscribers = self._event_subscribers.get(job_id, [])
        if q in subscribers:
            subscribers.remove(q)
        if not subscribers:
            self._event_subscribers.pop(job_id, None)

    async def broadcast_event(self, job_id: str, event_type: str, data: dict[str, Any]) -> None:
        """Broadcast an event to all connected SSE clients."""
        subscribers = self._event_subscribers.get(job_id, [])
        payload = {"event": event_type, "data": data}
        for q in subscribers:
            await q.put(payload)

    def register_process(self, job_id: str, proc: asyncio.subprocess.Process) -> None:
        """Register active external process for cancellation."""
        self._active_processes[job_id] = proc

    def unregister_process(self, job_id: str) -> None:
        """Unregister completed external process."""
        self._active_processes.pop(job_id, None)

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running or queued job."""
        job = await self.store.get_job(job_id)
        if not job:
            return False

        if job.status == "queued":
            # Remove from queue
            await self.queue.cancel(job.jobClass, job_id)
            job.status = "cancelled"
            job.finishedAt = datetime.now(UTC).isoformat()
            await self.store.update_job(job)
            await self.broadcast_event(job_id, "status", {"status": "cancelled"})
            self._cleanup_job_dir(job_id)
            return True

        if job.status == "running":
            job.cancelRequested = True
            await self.store.update_job(job)

            # Terminate running process if any
            proc = self._active_processes.get(job_id)
            if proc and proc.returncode is None:
                try:
                    if sys.platform != "win32":
                        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                    else:
                        proc.terminate()
                except Exception as e:
                    logger.error("error_killing_process", job_id=job_id, error=str(e))

            # Cancel running asyncio task
            task = self._active_jobs.get(job_id)
            if task:
                task.cancel()

            job.status = "cancelled"
            job.finishedAt = datetime.now(UTC).isoformat()
            await self.store.update_job(job)
            await self.broadcast_event(job_id, "status", {"status": "cancelled"})
            self._cleanup_job_dir(job_id)
            return True

        return False

    def _cleanup_job_dir(self, job_id: str) -> None:
        """Safely remove ephemeral job directory."""
        job_dir = os.path.join(settings.TMP_DIR, job_id)
        if os.path.exists(job_dir):
            try:
                shutil.rmtree(job_dir, ignore_errors=True)
            except Exception as e:
                logger.error("cleanup_job_dir_failed", job_id=job_id, error=str(e))

    async def _worker_loop(self, job_class: JobClass) -> None:
        """Worker loop continuously dequeuing and executing jobs for its assigned class."""
        while self._running:
            try:
                job_id = await self.queue.dequeue(job_class, timeout_sec=1.0)
                if not job_id:
                    continue

                # Check memory guard for heavy class
                if job_class == "heavy":
                    mem = psutil.virtual_memory()
                    free_mb = mem.available / (1024 * 1024)
                    if free_mb < settings.MIN_FREE_MEM_MB:
                        logger.warn(
                            "memory_guard_delaying_heavy_job",
                            job_id=job_id,
                            available_mb=free_mb,
                            required_mb=settings.MIN_FREE_MEM_MB,
                        )
                        # Re-enqueue with short backoff
                        await asyncio.sleep(2.0)
                        await self.queue.enqueue(job_class, job_id)
                        continue

                # Run job execution in dedicated task
                task = asyncio.create_task(self._run_in_slot(job_class, job_id))
                self._active_jobs[job_id] = task
                try:
                    await task
                finally:
                    self._active_jobs.pop(job_id, None)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("worker_loop_error", job_class=job_class, error=str(e))
                await asyncio.sleep(1.0)

    async def _run_in_slot(self, job_class: JobClass, job_id: str) -> None:
        if job_class == "light":
            async with self.light_slots:
                await self._execute_job(job_id)
        else:
            await self._execute_job(job_id)

    async def _execute_job(self, job_id: str) -> None:
        """Execute single job lifecycle."""
        job = await self.store.get_job(job_id)
        if not job or job.status != "queued":
            return

        now_iso = datetime.now(UTC).isoformat()
        job.status = "running"
        job.startedAt = now_iso
        job.queuePosition = 0
        await self.store.update_job(job)
        await self.broadcast_event(job_id, "status", {"status": "running"})

        timeout_sec = (
            settings.JOB_TIMEOUT_YOUTUBE_SEC
            if job.jobClass == "youtube"
            else settings.JOB_TIMEOUT_HEAVY_SEC
        )

        last_progress_time = 0.0

        async def update_progress(prog: int, stage_name: str | None = None) -> None:
            nonlocal last_progress_time, job
            now = time.time()
            # Monotonic progress check
            prog = max(job.progress, min(100, prog))
            # Throttle to max 4 updates/sec unless 100 or stage changed
            if (
                (now - last_progress_time >= 0.25)
                or prog == 100
                or (stage_name and stage_name != job.stage)
            ):
                last_progress_time = now
                job.progress = prog
                if stage_name:
                    job.stage = stage_name  # type: ignore[assignment]
                await self.store.update_job(job)
                await self.broadcast_event(
                    job_id,
                    "progress",
                    {"progress": prog, "stage": job.stage},
                )

        engine = self._engines.get(job.toolId)
        if not engine:
            logger.error("tool_engine_not_found", tool_id=job.toolId)
            job.status = "failed"
            job.error = ErrorDetail(
                code="TOOL_NOT_FOUND",
                message=f"No engine registered for tool {job.toolId}",
            )
            job.finishedAt = datetime.now(UTC).isoformat()
            await self.store.update_job(job)
            await self.broadcast_event(job_id, "error", {"error": job.error.model_dump()})
            self._cleanup_job_dir(job_id)
            return

        try:
            result = await asyncio.wait_for(
                engine(job, update_progress),
                timeout=timeout_sec,
            )
            job.status = "succeeded"
            job.progress = 100
            job.stage = None
            job.result = result
            job.finishedAt = datetime.now(UTC).isoformat()
            # Set TTL timestamp for result expiration
            job.expiresAtTimestamp = time.time() + settings.JOB_RESULT_TTL_MIN * 60
            await self.store.update_job(job)
            await self.broadcast_event(job_id, "done", {"result": result.model_dump()})

        except TimeoutError:
            logger.warn("job_timed_out", job_id=job_id, timeout_sec=timeout_sec)
            job.status = "failed"
            job.error = ErrorDetail(
                code="CONVERSION_TIMEOUT",
                message="The conversion took too long and timed out.",
            )
            job.finishedAt = datetime.now(UTC).isoformat()
            await self.store.update_job(job)
            await self.broadcast_event(job_id, "error", {"error": job.error.model_dump()})
            self._cleanup_job_dir(job_id)

        except asyncio.CancelledError:
            logger.info("job_cancelled_during_exec", job_id=job_id)
            job.status = "cancelled"
            job.finishedAt = datetime.now(UTC).isoformat()
            await self.store.update_job(job)
            await self.broadcast_event(job_id, "status", {"status": "cancelled"})
            self._cleanup_job_dir(job_id)

        except AppError as e:
            logger.warn("job_failed_with_app_error", job_id=job_id, code=e.code, msg=e.message)
            job.status = "failed"
            job.error = ErrorDetail(
                code=e.code,
                message=e.message,
                retryable=e.retryable,
                retryAfterSec=e.retry_after_sec,
                details=e.details,
            )
            job.finishedAt = datetime.now(UTC).isoformat()
            await self.store.update_job(job)
            await self.broadcast_event(job_id, "error", {"error": job.error.model_dump()})
            self._cleanup_job_dir(job_id)

        except Exception as e:
            logger.error("job_failed_unexpected_error", job_id=job_id, error=str(e), exc_info=True)
            job.status = "failed"
            job.error = ErrorDetail(
                code="CONVERSION_FAILED",
                message="An unexpected error occurred during conversion.",
                retryable=True,
            )
            job.finishedAt = datetime.now(UTC).isoformat()
            await self.store.update_job(job)
            await self.broadcast_event(job_id, "error", {"error": job.error.model_dump()})
            self._cleanup_job_dir(job_id)
