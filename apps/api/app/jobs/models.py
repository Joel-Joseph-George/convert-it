"""Job Data Models and Serialization."""

from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.core.errors import ErrorDetail

JobType = Literal["youtube", "convert"]
JobStatus = Literal["queued", "running", "succeeded", "failed", "cancelled", "expired"]
JobStage = Literal["downloading", "converting", "finalizing"]
JobClass = Literal["heavy", "youtube", "light"]


class JobResult(BaseModel):
    """Result details returned when a job completes successfully."""

    filename: str
    sizeBytes: int
    mime: str
    expiresAt: str


class JobSnapshot(BaseModel):
    """Public job snapshot conforming to Section 7."""

    id: str
    type: JobType
    toolId: str
    status: JobStatus
    stage: JobStage | None = None
    progress: int = 0
    queuePosition: int = 0
    createdAt: str
    startedAt: str | None = None
    finishedAt: str | None = None
    error: ErrorDetail | None = None
    result: JobResult | None = None


class JobRecord(BaseModel):
    """Internal job state record containing metadata and execution paths."""

    id: str
    type: JobType
    toolId: str
    status: JobStatus = "queued"
    stage: JobStage | None = None
    progress: int = 0
    queuePosition: int = 0
    createdAt: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    startedAt: str | None = None
    finishedAt: str | None = None
    error: ErrorDetail | None = None
    result: JobResult | None = None

    # Internal tracking
    clientIp: str = "127.0.0.1"
    jobClass: JobClass = "light"
    originalFilename: str | None = None
    options: dict[str, Any] = Field(default_factory=dict)
    downloadCount: int = 0
    firstDownloadedAt: float | None = None
    inputPath: str | None = None
    outputPath: str | None = None
    cancelRequested: bool = False
    createdAtTimestamp: float = Field(default_factory=lambda: datetime.now(UTC).timestamp())
    expiresAtTimestamp: float = 0.0

    def to_snapshot(self) -> JobSnapshot:
        """Convert internal record to public API snapshot."""
        return JobSnapshot(
            id=self.id,
            type=self.type,
            toolId=self.toolId,
            status=self.status,
            stage=self.stage,
            progress=self.progress,
            queuePosition=self.queuePosition,
            createdAt=self.createdAt,
            startedAt=self.startedAt,
            finishedAt=self.finishedAt,
            error=self.error,
            result=self.result,
        )
