"""Application Error Types and HTTP Exception Handlers."""

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    """Normalized API error payload structure."""

    code: str
    message: str
    retryable: bool = False
    retryAfterSec: int | None = None
    details: dict[str, Any] = {}


class ErrorResponse(BaseModel):
    """Top-level error response container."""

    error: ErrorDetail


ERROR_STATUS_MAP: dict[str, tuple[int, bool]] = {
    "INVALID_URL": (400, False),
    "UNSUPPORTED_URL": (400, False),
    "VIDEO_UNAVAILABLE": (422, False),
    "AGE_RESTRICTED": (422, False),
    "LIVE_NOT_SUPPORTED": (422, False),
    "VIDEO_TOO_LONG": (422, False),
    "FILE_TOO_LARGE": (413, False),
    "UNSUPPORTED_FILE_TYPE": (415, False),
    "FILE_CORRUPT": (422, False),
    "TOOL_NOT_FOUND": (404, False),
    "TOOL_DISABLED": (503, False),
    "INVALID_OPTIONS": (422, False),
    "AUTH_REQUIRED": (401, False),
    "RATE_LIMITED": (429, True),
    "QUEUE_FULL": (503, True),
    "SERVER_BUSY": (503, True),
    "UPSTREAM_BLOCKED": (502, True),
    "UPSTREAM_ERROR": (502, True),
    "CONVERSION_FAILED": (500, False),
    "CONVERSION_TIMEOUT": (504, False),
    "JOB_NOT_FOUND": (404, False),
    "JOB_EXPIRED": (410, False),
    "JOB_CANCELLED": (409, False),
    "INTERNAL": (500, True),
}


class AppError(Exception):
    """Application-level exception mapping directly to standard API error responses."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int | None = None,
        retryable: bool | None = None,
        retry_after_sec: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.code = code
        self.message = message

        default_status, default_retryable = ERROR_STATUS_MAP.get(code, (500, False))
        self.status_code = status_code if status_code is not None else default_status
        self.retryable = retryable if retryable is not None else default_retryable
        self.retry_after_sec = retry_after_sec
        self.details = details or {}
        super().__init__(message)

    def to_response(self) -> JSONResponse:
        headers = {}
        if self.retry_after_sec is not None:
            headers["Retry-After"] = str(self.retry_after_sec)

        payload = {
            "error": {
                "code": self.code,
                "message": self.message,
                "retryable": self.retryable,
                "retryAfterSec": self.retry_after_sec,
                "details": self.details,
            }
        }
        return JSONResponse(status_code=self.status_code, content=payload, headers=headers)


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    """Handle custom AppError exceptions."""
    return exc.to_response()
