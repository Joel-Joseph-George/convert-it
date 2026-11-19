"""Unit and golden tests for Phase 5 Server Conversion Engines (Section 11)."""

import asyncio
import os
import shutil
from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import AsyncMock, Mock, patch

import httpx
import openpyxl
import pytest

from app.core.config import settings
from app.core.errors import AppError
from app.engines.libreoffice import convert_with_libreoffice
from app.engines.pdf_to_excel import convert_pdf_to_excel
from app.engines.pdf_to_word import convert_pdf_to_word
from app.jobs.models import JobRecord
from app.jobs.queue import MemoryJobQueue
from app.jobs.runner import JobRunner
from app.jobs.store import MemoryJobStore
from app.main import app

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
TABLE_PDF = os.path.join(FIXTURES_DIR, "sample_table.pdf")
PLAIN_PDF = os.path.join(FIXTURES_DIR, "sample_plain.pdf")
SAMPLE_DOC = os.path.join(FIXTURES_DIR, "sample_doc.docx")


@pytest.fixture
def clean_job_env(tmp_path: Any) -> tuple[str, str]:
    """Create a temporary job directory with a copy of sample_table.pdf."""
    job_id = "test-job-server"
    job_dir = str(tmp_path / job_id)
    os.makedirs(job_dir, exist_ok=True)
    input_file = os.path.join(job_dir, "input.pdf")
    shutil.copy2(TABLE_PDF, input_file)
    return job_dir, input_file


@pytest.fixture
async def test_app(tmp_path: Any) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Test client with memory store, queue, and runner initialized."""
    old_tmp = settings.TMP_DIR
    settings.TMP_DIR = str(tmp_path)
    try:
        store = MemoryJobStore()
        queue = MemoryJobQueue()
        runner = JobRunner(store, queue)

        runner.register_engine("pdf-to-word", convert_pdf_to_word)
        runner.register_engine("pdf-to-excel", convert_pdf_to_excel)
        runner.register_engine("word-to-pdf", convert_with_libreoffice)
        await runner.start()

        app.state.store = store
        app.state.queue = queue
        app.state.runner = runner
        app.state.is_draining = False
        app.state.startup_time = 0.0

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

        await runner.stop()
    finally:
        settings.TMP_DIR = old_tmp


# --- pdf-to-word tests ---


@pytest.mark.asyncio
async def test_pdf_to_word_golden_success(clean_job_env: tuple[str, str]) -> None:
    """PDF to Word conversion produces a valid .docx file."""
    _, input_file = clean_job_env
    job = JobRecord(
        id="job-pdf-word",
        type="convert",
        toolId="pdf-to-word",
        inputPath=input_file,
        originalFilename="financial_report.pdf",
    )

    progress_reports: list[tuple[int, str | None]] = []

    async def update_prog(pct: int, stage: str | None) -> None:
        progress_reports.append((pct, stage))

    result = await convert_pdf_to_word(job, update_prog)

    assert result.filename == "financial_report.docx"
    assert result.mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert result.sizeBytes > 0
    assert job.outputPath is not None
    assert os.path.exists(job.outputPath)
    assert os.path.getsize(job.outputPath) == result.sizeBytes
    assert len(progress_reports) >= 2


@pytest.mark.asyncio
async def test_pdf_to_word_missing_file() -> None:
    """PDF to Word with missing input raises FILE_CORRUPT."""
    job = JobRecord(
        id="job-missing",
        type="convert",
        toolId="pdf-to-word",
        inputPath="/tmp/nonexistent_convertit_file.pdf",
    )
    with pytest.raises(AppError) as exc_info:
        await convert_pdf_to_word(job, AsyncMock())
    assert exc_info.value.code == "FILE_CORRUPT"


# --- pdf-to-excel tests ---


@pytest.mark.asyncio
async def test_pdf_to_excel_golden_success(clean_job_env: tuple[str, str]) -> None:
    """PDF to Excel extracts table cells into an .xlsx workbook."""
    _, input_file = clean_job_env
    job = JobRecord(
        id="job-pdf-excel",
        type="convert",
        toolId="pdf-to-excel",
        inputPath=input_file,
        originalFilename="quarterly_data.pdf",
    )

    progress_reports: list[tuple[int, str | None]] = []

    async def update_prog(pct: int, stage: str | None) -> None:
        progress_reports.append((pct, stage))

    result = await convert_pdf_to_excel(job, update_prog)

    assert result.filename == "quarterly_data.xlsx"
    assert result.mime == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert result.sizeBytes > 0
    assert job.outputPath is not None
    assert os.path.exists(job.outputPath)

    # Verify openpyxl can load the spreadsheet and read the extracted cells
    wb = openpyxl.load_workbook(job.outputPath)
    assert "Page 1" in wb.sheetnames
    ws = wb["Page 1"]
    rows = list(ws.iter_rows(values_only=True))
    assert len(rows) >= 2
    # Verify table content
    assert rows[0][0] == "Header A"
    assert rows[0][1] == "Header B"
    assert rows[1][0] == "Data 1"
    assert rows[1][1] == "Data 2"
    wb.close()


@pytest.mark.asyncio
async def test_pdf_to_excel_no_tables_rejection(tmp_path: Any) -> None:
    """PDF without tables raises NO_TABLES_FOUND (Section 11)."""
    job_dir = str(tmp_path / "job-plain")
    os.makedirs(job_dir, exist_ok=True)
    plain_input = os.path.join(job_dir, "input.pdf")
    shutil.copy2(PLAIN_PDF, plain_input)

    job = JobRecord(
        id="job-plain",
        type="convert",
        toolId="pdf-to-excel",
        inputPath=plain_input,
        originalFilename="essay.pdf",
    )

    with pytest.raises(AppError) as exc_info:
        await convert_pdf_to_excel(job, AsyncMock())

    assert exc_info.value.code == "NO_TABLES_FOUND"
    assert "No tables found. Scanned PDFs may need OCR" in exc_info.value.message
    assert exc_info.value.status_code == 422


# --- libreoffice tests ---


@pytest.mark.asyncio
async def test_libreoffice_disabled_when_binary_missing() -> None:
    """When soffice/libreoffice binary is absent, TOOL_DISABLED 503 is returned."""
    with patch("app.engines.libreoffice.find_libreoffice_binary", return_value=None):
        job = JobRecord(
            id="job-lo-test",
            type="convert",
            toolId="word-to-pdf",
            inputPath=SAMPLE_DOC,
            originalFilename="notes.docx",
        )
        with pytest.raises(AppError) as exc_info:
            await convert_with_libreoffice(job, AsyncMock())
        assert exc_info.value.code == "TOOL_DISABLED"
        assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_libreoffice_mocked_execution(tmp_path: Any) -> None:
    """LibreOffice engine executes with unique profile directory and produces output PDF."""
    job_dir = str(tmp_path / "job-lo-mock")
    os.makedirs(job_dir, exist_ok=True)
    input_file = os.path.join(job_dir, "input.docx")
    shutil.copy2(SAMPLE_DOC, input_file)

    job = JobRecord(
        id="job-lo-mock",
        type="convert",
        toolId="word-to-pdf",
        inputPath=input_file,
        originalFilename="document.docx",
    )

    expected_pdf = os.path.join(job_dir, "document.pdf")

    # Mock subprocess to write an empty or small valid PDF on execution
    async def fake_create_subprocess_exec(*cmd: Any, **_kwargs: Any) -> Any:
        # Check command structure
        assert "-env:UserInstallation=" in cmd[2]
        assert "--convert-to" in cmd
        assert "pdf" in cmd

        # Create the fake output PDF
        with open(expected_pdf, "wb") as f:
            f.write(b"%PDF-1.4\n%Fake PDF\n%%EOF")

        mock_proc = AsyncMock()
        mock_proc.returncode = 0
        mock_proc.communicate.return_value = (b"", b"")
        return mock_proc

    with (
        patch("app.engines.libreoffice.find_libreoffice_binary", return_value="/usr/bin/soffice"),
        patch("asyncio.create_subprocess_exec", side_effect=fake_create_subprocess_exec),
    ):
        result = await convert_with_libreoffice(job, AsyncMock())

    assert result.filename == "document.pdf"
    assert result.mime == "application/pdf"
    assert result.sizeBytes > 0
    assert os.path.exists(expected_pdf)


@pytest.mark.asyncio
async def test_libreoffice_timeout_handling(tmp_path: Any) -> None:
    """LibreOffice engine raises CONVERSION_TIMEOUT when execution exceeds threshold."""
    job_dir = str(tmp_path / "job-lo-timeout")
    os.makedirs(job_dir, exist_ok=True)
    input_file = os.path.join(job_dir, "input.docx")
    shutil.copy2(SAMPLE_DOC, input_file)

    job = JobRecord(
        id="job-lo-timeout",
        type="convert",
        toolId="word-to-pdf",
        inputPath=input_file,
    )

    mock_proc = AsyncMock()
    mock_proc.returncode = None
    mock_proc.communicate.side_effect = TimeoutError()
    mock_proc.terminate = Mock()

    with (
        patch("app.engines.libreoffice.find_libreoffice_binary", return_value="/usr/bin/soffice"),
        patch("asyncio.create_subprocess_exec", return_value=mock_proc),
        patch("os.killpg", return_value=None, create=True),
        patch("os.getpgid", return_value=12345, create=True),
    ):
        with pytest.raises(AppError) as exc_info:
            await convert_with_libreoffice(job, AsyncMock())

        assert exc_info.value.code == "CONVERSION_TIMEOUT"
        assert exc_info.value.status_code == 504


# --- API Integration Tests ---


@pytest.mark.asyncio
async def test_api_convert_pdf_to_word_lifecycle(test_app: httpx.AsyncClient) -> None:
    """Test full API lifecycle for pdf-to-word from upload to download."""
    with open(TABLE_PDF, "rb") as f:
        pdf_bytes = f.read()

    # 1. Upload
    response = await test_app.post(
        "/api/jobs/convert",
        data={"toolId": "pdf-to-word"},
        files={"file": ("test_table.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 202
    job_id = response.json()["jobId"]

    # 2. Wait for completion
    for _ in range(40):
        await asyncio.sleep(0.1)
        res = await test_app.get(f"/api/jobs/{job_id}")
        assert res.status_code == 200
        snap = res.json()
        if snap["status"] == "succeeded":
            break
        if snap["status"] == "failed":
            pytest.fail(f"Job failed unexpectedly: {snap.get('error')}")
    else:
        pytest.fail("Job did not finish in time")

    assert snap["status"] == "succeeded"
    assert snap["result"]["filename"] == "test_table.docx"

    # 3. Download
    download_res = await test_app.get(f"/api/jobs/{job_id}/download")
    assert download_res.status_code == 200
    assert len(download_res.content) > 0
    assert "test_table.docx" in download_res.headers.get("content-disposition", "")


@pytest.mark.asyncio
async def test_api_convert_pdf_to_excel_no_tables_error(test_app: httpx.AsyncClient) -> None:
    """Test API rejects plain PDF with NO_TABLES_FOUND."""
    with open(PLAIN_PDF, "rb") as f:
        pdf_bytes = f.read()

    response = await test_app.post(
        "/api/jobs/convert",
        data={"toolId": "pdf-to-excel"},
        files={"file": ("plain.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 202
    job_id = response.json()["jobId"]

    for _ in range(40):
        await asyncio.sleep(0.1)
        res = await test_app.get(f"/api/jobs/{job_id}")
        assert res.status_code == 200
        snap = res.json()
        if snap["status"] in ("done", "failed"):
            break
    else:
        pytest.fail("Job did not finish in time")

    assert snap["status"] == "failed"
    assert snap["error"]["code"] == "NO_TABLES_FOUND"
    assert "No tables found" in snap["error"]["message"]


@pytest.mark.asyncio
async def test_api_limits_exposes_server_tools(test_app: httpx.AsyncClient) -> None:
    """GET /api/limits returns serverTools map with boolean flags."""
    res = await test_app.get("/api/limits")
    assert res.status_code == 200
    data = res.json()
    assert "serverTools" in data
    server_tools = data["serverTools"]
    assert server_tools["pdf-to-word"] is True
    assert server_tools["pdf-to-excel"] is True
    assert "word-to-pdf" in server_tools
