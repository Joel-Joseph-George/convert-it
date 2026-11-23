"""ConvertIt Configuration and Settings."""

from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PORT: int = 8000
    ENVIRONMENT: Literal["development", "production", "test"] = "development"
    ALLOWED_ORIGINS: list[str] | str = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]
    ACCESS_CODE: str | None = None
    TRUSTED_PROXY_HOPS: int = 0

    QUEUE_BACKEND: Literal["memory", "redis"] = "memory"
    REDIS_URL: str = "redis://localhost:6379/0"

    TMP_DIR: str = "/tmp/convertit"
    ENABLE_YOUTUBE: bool = True

    MAX_UPLOAD_MB: int = 25
    YT_MAX_DURATION_MIN: int = 60
    YT_MAX_FILESIZE_MB: int = 300
    YT_MAX_HEIGHT: int = 1080

    JOB_TIMEOUT_YOUTUBE_SEC: int = 900
    JOB_TIMEOUT_HEAVY_SEC: int = 180
    JOB_RESULT_TTL_MIN: int = 15
    JOB_RECORD_TTL_MIN: int = 60

    CONCURRENCY_HEAVY: int = 1
    CONCURRENCY_YOUTUBE: int = 1
    CONCURRENCY_LIGHT: int = 2

    MAX_QUEUE_LENGTH: int = 20
    MAX_ACTIVE_JOBS_PER_IP: int = 2
    RATE_LIMIT_PER_MIN: int = 60
    JOB_CREATES_PER_10MIN: int = 20

    MAX_TMP_DISK_MB: int = 2000
    MIN_FREE_MEM_MB: int = 300
    SHUTDOWN_GRACE_SEC: int = 30

    YT_COOKIES_FILE: str | None = None
    YT_PROXY: str | None = None

    GEMINI_API_KEY: str | None = None
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            if value.startswith("[") and value.endswith("]"):
                import json

                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        if isinstance(value, list):
            return [str(origin).strip() for origin in value if str(origin).strip()]
        return []

    def validate_production(self) -> None:
        """Validate production constraints according to Section 9.3."""
        if self.ENVIRONMENT == "production":
            if not self.ALLOWED_ORIGINS:
                raise ValueError("ALLOWED_ORIGINS must not be empty in production.")
            if "*" in self.ALLOWED_ORIGINS:
                raise ValueError("ALLOWED_ORIGINS must not contain wildcard '*' in production.")


settings = Settings()
