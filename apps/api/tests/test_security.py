"""Unit tests for security, sanitization, IP detection, and access code enforcement."""

import pytest
from fastapi import Request

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import (
    get_client_ip,
    sanitize_filename,
    sniff_magic_type,
    verify_access_code,
)


def test_sanitize_filename_traversal() -> None:
    # Strips directory traversal
    assert sanitize_filename("../../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\windows\\system32\\cmd.exe") == "cmd.exe"
    assert sanitize_filename("/var/log/syslog") == "syslog"


def test_sanitize_filename_control_chars_and_null() -> None:
    # Strips null bytes and non-printable control characters
    assert sanitize_filename("test\x00file\x07.pdf") == "testfile.pdf"
    assert sanitize_filename("....hidden.txt") == "hidden.txt"
    assert sanitize_filename("") == "unnamed_file"


def test_sanitize_filename_length_limit() -> None:
    long_name = "a" * 300 + ".mp4"
    sanitized = sanitize_filename(long_name, max_length=50)
    assert len(sanitized) <= 50
    assert sanitized.endswith(".mp4")


def test_sniff_magic_type() -> None:
    # PNG magic bytes
    png_header = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
    assert sniff_magic_type(png_header) == "image/png"

    # PDF magic bytes
    pdf_header = b"%PDF-1.4\n" + b"\x00" * 20
    assert sniff_magic_type(pdf_header) == "application/pdf"

    # Unknown random bytes
    assert sniff_magic_type(b"\x00\x01\x02\x03\x04") is None


def test_get_client_ip_direct() -> None:
    class DummyClient:
        host = "192.168.1.50"

    scope = {
        "type": "http",
        "client": ("192.168.1.50", 12345),
        "headers": [],
    }
    req = Request(scope)
    assert get_client_ip(req) == "192.168.1.50"


def test_get_client_ip_trusted_proxy_hops(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    headers = [(b"x-forwarded-for", b"203.0.113.195, 70.41.3.18")]
    scope = {
        "type": "http",
        "client": ("10.0.0.1", 12345),
        "headers": headers,
    }
    req = Request(scope)
    # With 1 hop, take the last proxy-reported IP
    assert get_client_ip(req) == "70.41.3.18"


def test_get_client_ip_ignores_spoofed_left_entries(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    headers = [(b"x-forwarded-for", b"1.2.3.4, 198.51.100.7")]
    req = Request({"type": "http", "client": ("10.0.0.1", 1), "headers": headers})
    assert get_client_ip(req) == "198.51.100.7"


def test_get_client_ip_header_takes_precedence(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "CLIENT_IP_HEADER", "true-client-ip")
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    headers = [
        (b"true-client-ip", b"203.0.113.9"),
        (b"x-forwarded-for", b"203.0.113.9, 172.71.0.1"),
    ]
    req = Request({"type": "http", "client": ("10.0.0.1", 1), "headers": headers})
    assert get_client_ip(req) == "203.0.113.9"

    # Header configured but absent -> falls back to X-Forwarded-For
    req2 = Request(
        {"type": "http", "client": ("10.0.0.1", 1), "headers": [(b"x-forwarded-for", b"5.6.7.8")]}
    )
    assert get_client_ip(req2) == "5.6.7.8"


def test_verify_access_code(monkeypatch: pytest.MonkeyPatch) -> None:
    # When disabled, passes without header
    monkeypatch.setattr(settings, "ACCESS_CODE", None)
    scope_no_auth = {"type": "http", "headers": []}
    req = Request(scope_no_auth)
    verify_access_code(req)  # Should not raise

    # When enabled, missing header raises AUTH_REQUIRED
    monkeypatch.setattr(settings, "ACCESS_CODE", "secret-passphrase")
    with pytest.raises(AppError) as exc_info:
        verify_access_code(req)
    assert exc_info.value.code == "AUTH_REQUIRED"
    assert exc_info.value.status_code == 401

    # Invalid access code raises AUTH_REQUIRED
    scope_wrong = {
        "type": "http",
        "headers": [(b"x-access-code", b"wrong-code")],
    }
    with pytest.raises(AppError) as exc_info:
        verify_access_code(Request(scope_wrong))
    assert exc_info.value.code == "AUTH_REQUIRED"

    # Correct access code passes
    scope_correct = {
        "type": "http",
        "headers": [(b"x-access-code", b"secret-passphrase")],
    }
    verify_access_code(Request(scope_correct))  # Should not raise


def test_download_token(monkeypatch: pytest.MonkeyPatch) -> None:
    import time

    from app.core.security import make_download_token, verify_download_access

    monkeypatch.setattr(settings, "ACCESS_CODE", None)
    assert make_download_token("job1", time.time() + 60) is None

    monkeypatch.setattr(settings, "ACCESS_CODE", "secret")
    token = make_download_token("job1", time.time() + 60)
    assert token

    def req(query: str) -> Request:
        return Request({"type": "http", "headers": [], "query_string": query.encode()})

    verify_download_access(req(f"token={token}"), "job1")
    for query, job in [(f"token={token}", "job2"), ("token=garbage", "job1"), ("", "job1")]:
        with pytest.raises(AppError):
            verify_download_access(req(query), job)

    expired = make_download_token("job1", time.time() - 1)
    with pytest.raises(AppError):
        verify_download_access(req(f"token={expired}"), "job1")
