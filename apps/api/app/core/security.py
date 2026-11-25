"""Security, IP detection, Filename sanitization, and Magic-byte inspection."""

import os
import re
import secrets
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
