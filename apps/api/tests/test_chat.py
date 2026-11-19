"""Chat validation, privacy, admission and OpenAI streaming contract."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import openai
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.chat import ChatRequest, ChatStream
from app.core.config import settings
from app.core.logging import setup_logging
from app.jobs.models import JobRecord
from app.jobs.queue import MemoryJobQueue
from app.jobs.runner import JobRunner
from app.jobs.store import MemoryJobStore
from app.main import app

BODY = {
    "question": "private-question-marker",
    "chunks": [{"page": 2, "text": "private-excerpt-marker </excerpt>"}],
    "history": [{"role": "user", "content": "private-history-marker"}],
}


@pytest.fixture
async def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> AsyncIterator[AsyncClient]:
    monkeypatch.setattr(settings, "TMP_DIR", str(tmp_path))
    monkeypatch.setattr(settings, "OLLAMA_API_KEY", "test-only")
    app.state.store = MemoryJobStore()
    app.state.queue = MemoryJobQueue()
    app.state.runner = JobRunner(app.state.store, app.state.queue)
    app.state.is_draining = False
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("question", ""),
        ("question", "x" * 2001),
        ("chunks", []),
        ("chunks", [{"page": 1, "text": "x"}] * 9),
        ("chunks", [{"page": 0, "text": "x"}]),
        ("chunks", [{"page": "1", "text": "x"}]),
        ("chunks", [{"page": True, "text": "x"}]),
        ("chunks", [{"page": 1, "text": "x" * 1501}]),
        ("history", [{"role": "system", "content": "x"}]),
        ("history", [{"role": "user", "content": "x" * 4001}]),
        ("history", [{"role": "user", "content": "x"}] * 7),
        ("unexpected", "value"),
    ],
)
async def test_validation(client: AsyncClient, key: str, value: Any) -> None:
    res = await client.post("/api/chat", json={**BODY, key: value})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "INVALID_OPTIONS"
    assert "private-" not in res.text


async def test_missing_key(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "OLLAMA_API_KEY", None)
    res = await client.post("/api/chat", json=BODY)
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "PROVIDER_NOT_CONFIGURED"


def mock_client() -> tuple[MagicMock, AsyncMock]:
    sdk = MagicMock()
    sdk.__aenter__.return_value = sdk
    create = AsyncMock()
    sdk.chat.completions.create = create
    return sdk, create


async def test_stream_and_privacy(client: AsyncClient, caplog: pytest.LogCaptureFixture) -> None:
    sdk, create = mock_client()
    stream = MagicMock()
    stream.__aenter__.return_value = stream
    stream.__aiter__.return_value = [
        MagicMock(choices=[MagicMock(delta=MagicMock(content=None, reasoning="thinking-marker"))]),
        MagicMock(choices=[MagicMock(delta=MagicMock(content="private-answer-marker [p. 2]"))]),
    ]
    create.return_value = stream
    setup_logging("test")
    caplog.set_level(logging.INFO)
    with patch("app.api.chat.openai.AsyncOpenAI", return_value=sdk):
        res = await client.post("/api/chat", json=BODY)
    assert res.status_code == 200 and res.headers["cache-control"] == "no-store"
    assert (
        res.text
        == 'event: token\ndata: {"token": "private-answer-marker [p. 2]"}\n\nevent: done\ndata: {}\n\n'
    )
    assert create.await_args is not None
    args = create.await_args.kwargs
    assert args["stream"] is True and args["model"] == settings.OLLAMA_MODEL
    assert "private-" not in args["messages"][0]["content"]
    assert (
        '<excerpt page="2">private-excerpt-marker &lt;/excerpt&gt;</excerpt>'
        in args["messages"][-1]["content"]
    )
    assert "chat_request" in caplog.text and "latency_ms" in caplog.text
    assert "private-" not in caplog.text
    stream.__aexit__.assert_awaited()
    sdk.__aexit__.assert_awaited()
    assert await app.state.store.get_all_jobs() == []


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (401, "PROVIDER_AUTH_ERROR"),
        (403, "PROVIDER_AUTH_ERROR"),
        (429, "PROVIDER_RATE_LIMITED"),
        (504, "PROVIDER_TIMEOUT"),
        (502, "UPSTREAM_ERROR"),
    ],
)
async def test_provider_errors(client: AsyncClient, status: int, code: str) -> None:
    sdk, create = mock_client()
    req = httpx.Request("POST", "https://provider.invalid")
    response = httpx.Response(status, request=req)
    if status == 504:
        create.side_effect = openai.APITimeoutError(request=req)
    else:
        error_type = {
            401: openai.AuthenticationError,
            403: openai.PermissionDeniedError,
            429: openai.RateLimitError,
            502: openai.InternalServerError,
        }[status]
        create.side_effect = error_type("private-provider-detail", response=response, body=None)
    with patch("app.api.chat.openai.AsyncOpenAI", return_value=sdk):
        res = await client.post("/api/chat", json=BODY)
    assert res.status_code == (502 if status in (401, 403) else status)
    assert res.json()["error"]["code"] == code
    assert "private-" not in res.text
    if status == 429:
        assert int(res.headers["retry-after"]) == res.json()["error"]["retryAfterSec"]


async def test_midstream_failure(client: AsyncClient) -> None:
    sdk, create = mock_client()
    stream = MagicMock()
    stream.__aiter__.side_effect = httpx.ReadTimeout("private-detail")
    create.return_value = stream
    with patch("app.api.chat.openai.AsyncOpenAI", return_value=sdk):
        res = await client.post("/api/chat", json=BODY)
    assert res.status_code == 200
    assert res.text.startswith("event: error")
    assert json.loads(res.text.split("data: ")[1])["error"]["code"] == "PROVIDER_TIMEOUT"
    assert "event: done" not in res.text


async def test_admission(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ACCESS_CODE", "local-test-code")
    assert (await client.post("/api/chat", json=BODY)).status_code == 401
    monkeypatch.setattr(settings, "ACCESS_CODE", None)
    monkeypatch.setattr(settings, "JOB_CREATES_PER_10MIN", 1)
    monkeypatch.setattr(settings, "OLLAMA_API_KEY", None)
    assert (await client.post("/api/chat", json=BODY)).status_code == 503
    assert (await client.post("/api/chat", json=BODY)).status_code == 429


@pytest.mark.usefixtures("client")
async def test_disconnect_during_handshake() -> None:
    from starlette.requests import Request

    request = Request({"type": "http", "app": app})
    sdk, create = mock_client()
    started = asyncio.Event()
    cancelled = asyncio.Event()

    async def blocked(**_kwargs: Any) -> None:
        started.set()
        try:
            await asyncio.Future[None]()
        finally:
            cancelled.set()

    async def disconnect() -> dict[str, str]:
        await started.wait()
        return {"type": "http.disconnect"}

    create.side_effect = blocked
    record = JobRecord(id="disconnect", type="convert", toolId="chat-pdf")
    await app.state.runner.light_slots.acquire()
    await app.state.store.create_job(record)
    with patch("app.api.chat.openai.AsyncOpenAI", return_value=sdk):
        await asyncio.wait_for(
            ChatStream(ChatRequest.model_validate(BODY), request, record)(
                request.scope, disconnect, AsyncMock()
            ),
            timeout=2,
        )
    assert cancelled.is_set()
    assert await app.state.store.get_all_jobs() == []
