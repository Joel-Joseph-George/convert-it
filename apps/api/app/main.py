"""ConvertIt FastAPI Application Main Module."""

import time
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.api.limits import router as limits_router
from app.api.youtube import router as youtube_router
from app.core.config import settings
from app.core.errors import AppError, app_error_handler
from app.core.logging import logger, setup_logging
from app.core.security import get_client_ip
from app.engines.echo import echo_engine
from app.engines.libreoffice import convert_with_libreoffice
from app.engines.pdf_to_excel import convert_pdf_to_excel
from app.engines.pdf_to_word import convert_pdf_to_word
from app.engines.youtube import download_youtube
from app.jobs.cleanup import run_cleanup_loop, wipe_temp_directory
from app.jobs.queue import JobQueue, MemoryJobQueue, RedisJobQueue
from app.jobs.runner import JobRunner
from app.jobs.store import JobStore, MemoryJobStore, RedisJobStore


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan managing state initialization, workers, and graceful shutdown."""
    # 1. Validation & Logging
    settings.validate_production()
    setup_logging(settings.ENVIRONMENT)

    # 2. Ephemeral Storage Initialization
    wipe_temp_directory(settings.TMP_DIR)

    # 3. Store and Queue Backends
    redis_client: aioredis.Redis | None = None
    store: JobStore
    queue: JobQueue

    if settings.QUEUE_BACKEND == "redis":
        logger.info("initializing_redis_backend", url=settings.REDIS_URL)
        redis_client = aioredis.from_url(settings.REDIS_URL)
        store = RedisJobStore(
            redis_client=redis_client,
            ttl_seconds=settings.JOB_RECORD_TTL_MIN * 60,
        )
        queue = RedisJobQueue(redis_client=redis_client)
    else:
        logger.info("initializing_memory_backend")
        store = MemoryJobStore()
        queue = MemoryJobQueue()

    # 4. Job Runner
    runner = JobRunner(store, queue)
    # Register engines for conversion tools
    runner.register_engine("echo-convert", echo_engine)
    runner.register_engine("test-convert", echo_engine)
    runner.register_engine("youtube-download", download_youtube)
    runner.register_engine("pdf-to-word", convert_pdf_to_word)
    runner.register_engine("pdf-to-excel", convert_pdf_to_excel)
    runner.register_engine("word-to-pdf", convert_with_libreoffice)
    runner.register_engine("excel-to-pdf", convert_with_libreoffice)
    runner.register_engine("powerpoint-to-pdf", convert_with_libreoffice)
    await runner.start()

    # 5. Background Cleanup Task
    cleanup_task = import_asyncio().create_task(run_cleanup_loop(store, interval_sec=60.0))

    # Set application state
    app.state.startup_time = time.time()
    app.state.is_draining = False
    app.state.store = store
    app.state.queue = queue
    app.state.runner = runner
    app.state.redis_client = redis_client

    logger.info("app_startup_complete", backend=settings.QUEUE_BACKEND)

    yield

    # Shutdown sequence
    logger.info("app_shutdown_initiating")
    app.state.is_draining = True
    cleanup_task.cancel()

    # Drain runner up to grace period
    await runner.stop(grace_period_sec=float(settings.SHUTDOWN_GRACE_SEC))

    # Close storage backends
    await queue.close()
    await store.close()
    if redis_client:
        await redis_client.aclose()

    logger.info("app_shutdown_complete")


def import_asyncio() -> Any:
    import asyncio

    return asyncio


app = FastAPI(
    title="ConvertIt API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)


# Security and Request ID Middleware
class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Assign or preserve X-Request-Id
        req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = req_id

        # General per-IP request rate limit check
        if hasattr(request.app.state, "store"):
            store: JobStore = request.app.state.store
            client_ip = get_client_ip(request)
            allowed, _count, retry_after = await store.check_rate_limit(
                client_ip, window_seconds=60, max_requests=settings.RATE_LIMIT_PER_MIN
            )
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "code": "RATE_LIMITED",
                            "message": "Too many requests. Please slow down.",
                            "retryable": True,
                            "retryAfterSec": retry_after,
                            "details": {},
                        }
                    },
                    headers={
                        "Retry-After": str(retry_after),
                        "X-Request-Id": req_id,
                    },
                )

        response = await call_next(request)
        response.headers["X-Request-Id"] = req_id

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        if request.url.path.startswith("/api/jobs"):
            response.headers["Cache-Control"] = "no-store"

        return response


app.add_middleware(RequestContextMiddleware)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handlers
app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    if request.url.path == "/api/chat":
        return AppError(
            "INVALID_OPTIONS", "Invalid chat question, excerpts, or history."
        ).to_response()
    return await request_validation_exception_handler(request, exc)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all unhandled exception handler logging server-side and returning INTERNAL code."""
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.error("unhandled_server_exception", error=str(exc), request_id=req_id, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL",
                "message": "An internal server error occurred.",
                "retryable": True,
                "retryAfterSec": None,
                "details": {"requestId": req_id},
            }
        },
        headers={"X-Request-Id": req_id},
    )


# Include API Routers
app.include_router(health_router, prefix="/api")
app.include_router(limits_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(youtube_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
