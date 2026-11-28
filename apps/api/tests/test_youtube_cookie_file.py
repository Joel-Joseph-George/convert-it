from pathlib import Path

import pytest
import yt_dlp
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.engines.youtube import base_ydl_options
from app.main import app


def test_cookie_writeback_is_isolated(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    source = tmp_path / "cookies.txt"
    original = b"# Netscape HTTP Cookie File\n.example.test\tTRUE\t/\tFALSE\t0\ttest\tfixture\n"
    source.write_bytes(original)
    monkeypatch.setattr(settings, "YT_COOKIES_FILE", str(source))
    with (
        yt_dlp.YoutubeDL(base_ydl_options()) as first,
        yt_dlp.YoutubeDL(base_ydl_options()) as second,
    ):
        assert first.cookiejar.get_cookie_header("https://example.test/") == "test=fixture"
        first.cookiejar.clear()
        first.save_cookies()
        assert second.cookiejar.get_cookie_header("https://example.test/") == "test=fixture"
    assert source.read_bytes() == original


async def test_health_reports_cookie_file_availability(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "cookies.txt"
    monkeypatch.setattr(settings, "YT_COOKIES_FILE", str(source))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for content in (None, b"", b"fixture"):
            if content is not None:
                source.write_bytes(content)
            response = await client.get("/api/health")
            assert response.status_code == 200
            assert response.json()["ytCookiesFileAvailable"] is bool(content)
