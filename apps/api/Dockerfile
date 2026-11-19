# Multi-stage Dockerfile for ConvertIt API
# Stage 1: Build virtual environment and wheels
FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Stage 2: Runtime image
FROM python:3.12-slim AS runner

ARG INSTALL_LIBREOFFICE=false

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && if [ "$INSTALL_LIBREOFFICE" = "true" ]; then \
        apt-get install -y --no-install-recommends \
        libreoffice-writer \
        libreoffice-calc; \
    fi \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash -m appuser

# Create ephemeral directory with proper permissions
RUN mkdir -p /tmp/convertit && \
    chown -R appuser:appgroup /tmp/convertit

WORKDIR /app
COPY --chown=appuser:appgroup app /app/app

USER appuser

ENV PORT=8000 \
    PYTHONUNBUFFERED=1 \
    TMP_DIR=/tmp/convertit

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request, os; port = os.environ.get('PORT', '8000'); urllib.request.urlopen(f'http://localhost:{port}/api/health')" || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
