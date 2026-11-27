#!/usr/bin/env bash
# Bump the pinned yt-dlp version in apps/api/pyproject.toml to the latest PyPI release
# (or to the version given as the first argument). Also upgrades the local venv if present.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${SCRIPT_DIR}/../apps/api" && pwd)"
PYPROJECT="${API_DIR}/pyproject.toml"

VERSION="${1:-$(curl -fsSL https://pypi.org/pypi/yt-dlp/json | python3 -c 'import json, sys; print(json.load(sys.stdin)["info"]["version"])')}"
CURRENT="$(sed -nE 's/.*"yt-dlp\[default\]==([^"]+)".*/\1/p' "${PYPROJECT}")"

if [ "${CURRENT}" = "${VERSION}" ]; then
    echo "yt-dlp already pinned to ${VERSION}"
    exit 0
fi

python3 - "${PYPROJECT}" "${VERSION}" <<'PY'
import re, sys
path, version = sys.argv[1], sys.argv[2]
text = open(path).read()
text, n = re.subn(r'"yt-dlp\[default\]==[^"]+"', f'"yt-dlp[default]=={version}"', text)
if n != 1:
    sys.exit("Could not find the yt-dlp pin in pyproject.toml")
open(path, "w").write(text)
PY
echo "Pinned yt-dlp ${CURRENT} -> ${VERSION}"

if [ -d "${API_DIR}/.venv" ]; then
    "${API_DIR}/.venv/bin/pip" install --quiet "yt-dlp[default]==${VERSION}"
    echo "Updated local venv"
fi
