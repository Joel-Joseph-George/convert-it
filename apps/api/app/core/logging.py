"""Structured JSON Logging for ConvertIt."""

import logging
import sys
from collections.abc import MutableMapping
from typing import Any

import structlog


def sanitize_log_event(
    _logger: Any, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """Sanitize log events: ensure no secrets, cookies, access codes, or uploaded filenames leak."""
    forbidden_keys = {
        "access_code",
        "cookie",
        "cookies",
        "authorization",
        "token",
        "secret",
        "filename",
        "original_filename",
    }
    for key in list(event_dict.keys()):
        if key.lower() in forbidden_keys:
            event_dict[key] = "[REDACTED]"
    return event_dict


def setup_logging(environment: str = "development") -> None:
    """Configure structlog and standard logging."""
    timestamper = structlog.processors.TimeStamper(fmt="iso")

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        timestamper,
        sanitize_log_event,
        structlog.processors.StackInfoRenderer(),
    ]

    if environment == "production":
        # Format as JSON in production
        processors: list[structlog.types.Processor] = [
            *shared_processors,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Development console formatting
        processors = [
            *shared_processors,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer(),
        ]

    structlog.configure(
        processors=processors,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )


logger = structlog.get_logger()
