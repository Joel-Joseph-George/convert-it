#!/usr/bin/env bash
# Helper script to bump yt-dlp to the latest version in apps/api
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
API_DIR="${ROOT_DIR}/apps/api"

echo "Checking latest yt-dlp version..."
if [ -d "${API_DIR}/.venv" ]; then
    "${API_DIR}/.venv/bin/pip" install --upgrade yt-dlp
    CURRENT_VER=$("${API_DIR}/.venv/bin/python" -c "import yt_dlp; print(yt_dlp.version.__version__)")
    echo "Updated local environment to yt-dlp ${CURRENT_VER}"
else
    echo "Virtual environment not found at ${API_DIR}/.venv. Please run setup first."
fi
