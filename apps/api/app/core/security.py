"""Security, IP detection, Filename sanitization, and Magic-byte inspection."""

import hashlib
import hmac
import os
import re
import secrets
import time
import unicodedata

import filetype
from fastapi import Request

from app.core.config import settings
from app.core.errors import AppError


def get_client_ip(request: Request) -> str:
    """Resolve the client IP behind reverse proxies.

    Order: CLIENT_IP_HEADER (if configured and present), then X-Forwarded-For counted
    TRUSTED_PROXY_HOPS entries from the right (entries further left are client-supplied
    and spoofable), then the socket address.
    """
    if settings.CLIENT_IP_HEADER:
        value = request.headers.get(settings.CLIENT_IP_HEADER)
        if value:
            first = value.split(",")[0].strip()
            if first:
                return first

    if settings.TRUSTED_PROXY_HOPS > 0:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            hops = [ip.strip() for ip in forwarded_for.split(",") if ip.strip()]
            if len(hops) >= settings.TRUSTED_PROXY_HOPS:
                return hops[-settings.TRUSTED_PROXY_HOPS]
            if hops:
                return hops[0]

    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def verify_access_code(request: Request) -> None:
    """Verify X-Access-Code header against server settings if configured."""
    if not settings.ACCESS_CODE:
        return

    provided = request.headers.get("x-access-code")
    if not provided:
        raise AppError(
            code="AUTH_REQUIRED",
            message="An access code is required to use server tools.",
            status_code=401,
        )

    if not secrets.compare_digest(provided, settings.ACCESS_CODE):
        raise AppError(
            code="AUTH_REQUIRED",
            message="The provided access code is invalid.",
            status_code=401,
        )


def _download_signature(job_id: str, expires: int, key: str) -> str:
    message = f"{job_id}:{expires}".encode()
    return hmac.new(key.encode(), message, hashlib.sha256).hexdigest()


def make_download_token(job_id: str, expires_at: float) -> str | None:
    """Create a download token valid until `expires_at` (None when no access code is set)."""
    if not settings.ACCESS_CODE:
        return None
    expires = int(expires_at)
    return f"{expires}.{_download_signature(job_id, expires, settings.ACCESS_CODE)}"


def verify_download_access(request: Request, job_id: str) -> None:
    """Allow a download with either the X-Access-Code header or a valid `token` query param."""
    if not settings.ACCESS_CODE or request.headers.get("x-access-code"):
        verify_access_code(request)
        return

    token = request.query_params.get("token", "")
    expires_str, _, signature = token.partition(".")
    if expires_str.isdigit() and signature:
        expires = int(expires_str)
        expected = _download_signature(job_id, expires, settings.ACCESS_CODE)
        if time.time() <= expires and secrets.compare_digest(signature, expected):
            return

    raise AppError(
        code="AUTH_REQUIRED",
        message="This download link is invalid or has expired.",
        status_code=401,
    )


def sanitize_filename(filename: str, max_length: int = 200) -> str:
    """Sanitize original filename: remove directory traversal, null bytes, and control chars."""
    # Normalize unicode
    cleaned = unicodedata.normalize("NFKD", filename)
    # Normalize backslashes to forward slashes across all platforms
    cleaned = cleaned.replace("\\", "/")
    # Strip null bytes and control chars
    cleaned = "".join(ch for ch in cleaned if ch.isprintable() and ch != "\x00")
    # Base name only (no paths)
    cleaned = os.path.basename(cleaned)
    cleaned = re.sub(r"[/\\]+", "", cleaned)
    # Remove leading dots to prevent hidden files
    cleaned = cleaned.lstrip(".")

    if not cleaned:
        cleaned = "unnamed_file"

    if len(cleaned) > max_length:
        base, ext = os.path.splitext(cleaned)
        allowed_base_len = max(1, max_length - len(ext))
        cleaned = base[:allowed_base_len] + ext

    return cleaned


def sniff_magic_type(header_bytes: bytes) -> str | None:
    """Sniff MIME type from the first bytes of a file using filetype library."""
    kind = filetype.guess(header_bytes)
    if kind is None:
        return None
    return str(kind.mime)
