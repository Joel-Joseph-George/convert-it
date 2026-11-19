# ConvertIt: Project Progress & Phase Log

---

## Phase 0: Foundations

### 1. What was built
- **Repository & Monorepo Structure:**
  - Initialized Git repository and monorepo structure with npm workspaces (`apps/web`, `apps/api`).
  - Added `.gitignore`, `.env.example` documenting all server, security, and client environment variables.
  - Setup CI skeleton in `.github/workflows/ci.yml` with path-filtered jobs for frontend (lint, type-check, vitest, build, npm audit) and backend (ruff check/format, mypy, pytest, pip-audit).
- **Design Analysis & Token Specifications:**
  - Completely read `docs/ANTIGRAVITY_PROMPT.md`, `design/README.md`, both `DESIGN.md` files (`design/utilitarian_precision/DESIGN.md` for light theme, `design/obsidian_utility/DESIGN.md` for dark theme), and all 21 `screen.png` files.
  - Authored `docs/DESIGN_NOTES.md` documenting the design tokens, font hierarchy, screen-to-component mapping, and documented/resolved all discrepancies between the designs and the master specification.
  - Authored `docs/THIRD_PARTY.md` documenting all dependencies and their licenses.
- **Frontend Architecture (`apps/web`):**
  - Scaffolded React 19 + TypeScript (strict mode) + Vite setup.
  - Integrated `@fontsource/inter` (weights 400, 500, 600) and `@fontsource/jetbrains-mono` for 100% self-hosted typography with zero external runtime network requests.
  - Configured Tailwind CSS with custom colors mapped to `:root` and `.dark` CSS variables in `tokens.css`.
  - Built core UI primitives and shell layout components:
    - `tokens.css` with exact prose theme values from both design specifications.
    - `globals.css` with strict 2px accent focus-visible rings and negative letter-spacing for large text.
    - `button.tsx` (Radix Slot primitive, 40px regular height, 32px small, rounded 10px).
    - `settingsStore.ts` (Zustand store managing theme and optional access code, persisting to `localStorage`).
    - `ThemeToggle.tsx` (toggles light/dark modes with instant document class update and system preference detection).
    - `TopBar.tsx` (brand wordmark with "Convert" in text color and "It" in accent, "All tools" navigation link, search trigger, theme toggle).
    - `Footer.tsx` (minimal footer with "Made for personal use", "Files processed in your browser", and GitHub repository link).
  - Setup TanStack Router with file-based routing:
    - `__root.tsx`: TopBar, content shell (`max-w-content` 720px / `max-w-grid` 960px), 404 NotFound component, Footer.
    - `index.tsx`: Home screen foundation matching `convertit_home_updated_popular_tools`.
    - `tools.index.tsx`: All Tools directory foundation matching `convertit_all_tools_desktop`.
- **Backend Architecture (`apps/api`):**
  - Python 3.12 virtual environment with `pyproject.toml`.
  - FastAPI application with strict typing, CORS middleware, and `/api/health` endpoint.
  - Tooling configured: `ruff` (linter and formatter), `mypy` (strict mode on `app/` and `tests/`), and `pytest` + `pytest-asyncio` with httpx client test.

### 2. What was verified
- **Frontend Quality Gates:**
  - `npm run lint` (ESLint 9 flat config): 0 errors, 0 warnings.
  - `npm run type-check` (`tsc --noEmit`): 0 errors.
  - `npm run test` (Vitest): 3 test suites, 9 tests passing (`theme.test.tsx`, `button.test.tsx`, `footer.test.tsx`).
  - `npm run build` (Vite production build): Successfully generated production bundles, self-hosting fonts with zero external CDN dependencies.
- **Backend Quality Gates:**
  - `ruff check app tests`: All checks passed.
  - `ruff format --check app tests`: All files properly formatted.
  - `mypy app tests`: Strict typing passed with no issues found.
  - `pytest`: Async test suite passed (`test_health_check` returning 200 and `{status: 'ok', version: '0.1.0'}`).

### 3. What could not be verified
- Live GitHub Actions run in GitHub cloud (repository is currently local; CI workflow file `.github/workflows/ci.yml` is prepared and verified against local tool runs).

---

## Phase 1: Registry and UI (no real conversion yet)

### 1. What was built
- **Tool Registry Architecture (`features/registry`):**
  - `types.ts`: Core type abstractions (`Category`, `EngineKind`, `ToolOption`, `ToolDefinition`) strictly conforming to Section 5.
  - `tools.ts`: Full initial catalogue containing all 27 tools across Image, Audio, Video, Data, PDF, Text, and Server Documents. Enforced `popular: true` on the designated 8 tools.
  - `validate.ts`: Registry validation engine checking ID uniqueness, category membership, engine ID registration in `KNOWN_ENGINE_IDS`, input/output formats, and limits. Validates at startup and in tests.
  - `search.ts`: Deterministic client fuzzy/relevance scoring function supporting multi-term queries, exact/prefix name matches, and keyword lookups (e.g., "spreadsheet", "transcode", "png").
- **Client Queue Store (`features/queue`):**
  - `queueStore.ts`: Zustand store managing tool-specific file queues with status machine (`ready → converting → done | failed | cancelled`), 20-file batch limit, object URL cleanup, target format selection, tool option state, and fake conversion progress simulation for Phase 1 verification.
- **Shared UI Component Inventory:**
  - `EngineBadge.tsx`: Badges tools as "In your browser" (green dot) or "Server" (neutral dot), with optional "Best effort" tag.
  - `PrivacyLine.tsx`: Renders local browser privacy guarantee (Lock icon) or ephemeral server note (Cloud icon).
  - `StatusPill.tsx`: 20px status pill with dot indicator (green for complete, amber pulse for converting, red for error, neutral for ready).
  - `ProgressBar.tsx`: 4px track, linear width transition, solid accent fill turning green upon completion.
  - `ErrorAlert.tsx` & `errorToView.ts`: Maps all 12+ error codes from Section 10 to calm, actionable inline alert cards (soft red for hard errors, warm amber for limits).
  - `EmptyState.tsx`: Reusable empty state card with icon, message, and action trigger.
- **Tool Template & Interaction Components (`components/tool`):**
  - `FormatPills.tsx`: 32px height format chips (`rounded-chip`), uppercase typography, solid accent selection state.
  - `OptionsPanel.tsx`: Dynamic form generator rendering selects, sliders, toggles, numbers, and text inputs based on `tool.options`, with collapsible advanced parameters accordion.
  - `DropZone.tsx`: 1px dashed dropzone target with neutral surface fill, active dragover tint, and "Choose files" button alternative. Supports full-size and compact modes.
  - `FileRow.tsx`: File queue row showing file type icon, name, formatted file size, target format, progress bar with percentage, download trigger upon completion, and remove/clear action.
  - `FileQueue.tsx`: Batch queue container with item counter, "Download all (ZIP)", and "Clear all" actions.
- **Home & Tools Directory Views:**
  - `UrlInput.tsx`: Link ingestion bar with clipboard paste handling, client URL validation, and inline `ErrorAlert` integration.
  - `PopularToolsStrip.tsx`: Strip dynamically querying `getPopularTools()` from the registry, linking to `/tools/$toolId`.
  - `ToolSearch.tsx`: Search input with ⌘K / Ctrl+K keyboard shortcut focus and quick clear.
  - `CategoryChips.tsx`: Horizontal category selector for instant tool filtering.
  - `ToolCard.tsx`: Tool grid card with engine badge, format chips, and direct link to tool converter page.
  - `ToolGrid.tsx`: Responsive 1-col (mobile) to 3-col (desktop) grid with empty state fallback.
  - `apps/web/src/routes/tools.index.tsx`: `/tools` route with URL query param sync (`?q=&category=`).
  - `apps/web/src/routes/tools.$toolId.tsx`: Single shared tool page template at `/tools/$toolId` wired to registry, queue store, options panel, format pills, dropzone, and fake progress runner.
  - 404 handler for unknown tool IDs with "Browse all tools" recovery link.

### 2. What was verified
- **Visual & Layout Conformance:**
  - Verified against design screens in `design/` across desktop and 390px mobile viewports in both Light and Dark themes.
  - Focus rings adhere to 2px accent with 2px offset.
  - Inter (weights 400, 500, 600 only) and JetBrains Mono rendering locally.
- **Testing & Quality Gates:**
  - `npm run lint`: **0 errors, 0 warnings** across all files.
  - `npm run type-check`: **0 errors** (`tsc --noEmit`).
  - `npm run test`: **11 test suites, 40 tests passing** in Vitest:
    - Registry validation (`registry.test.ts`)
    - Search scoring & filtering (`search.test.ts`)
    - Queue store state machine (`queue.test.ts`)
    - Format pills (`formatPills.test.tsx`)
    - Options panel (`optionsPanel.test.tsx`)
    - Dropzone (`dropZone.test.tsx`)
    - Engine badge (`engineBadge.test.tsx`)
    - Error alert & error mapping (`errorAlert.test.tsx`)
    - Button variants (`button.test.tsx`)
    - Theme toggle (`theme.test.tsx`)
    - Footer (`footer.test.tsx`)
  - `npm run build`: Production bundle built successfully (1.07s).
  - Backend: `ruff check`, `ruff format --check`, `mypy app tests`, and `pytest` **all green with zero errors**.

### 3. What could not be verified
- Real media transcoding / browser WASM conversions (mock/fake progress used in Phase 1; real WebAssembly engines implemented in Phase 2).

---

## Phase 2: Browser Engines

### 1. What was built
- **Core Conversion Engine Layer (`features/engines`):**
  - `types.ts`: Defined `ConvertContext`, `ConvertResult`, `BrowserEngine` interface, and `EngineError` matching Section 6.3 error specifications.
  - `zipUtil.ts`: Pure in-memory ZIP archiver built on `fflate` for "Download all (ZIP)" multi-file exports with auto-naming.
  - `textEngine.ts`:
    - `markdown-to-html`: Converts Markdown to sanitized HTML via `marked`.
    - `html-to-markdown`: Converts HTML to Markdown via `turndown`.
  - `dataEngine.ts`:
    - `sheetjs-data`: Multi-directional conversion between CSV, XLSX, and JSON using `xlsx` (SheetJS).
    - Supports custom CSV delimiters (comma, semicolon, tab, pipe) and first-5-rows data preview extraction via `getPreviewRows()`.
  - `imageEngine.ts`:
    - Canvas / OffscreenCanvas client-side conversion for `image-convert`, `image-compress`, `image-resize`, and `svg-to-png`.
    - EXIF metadata stripping by canvas redrawing; quality control and dimension scaling.
  - `heicEngine.ts`:
    - `heic-to-jpg`: Apple HEIC/HEIF photo conversion via dynamic import of `heic2any` to keep initial bundle size light.
  - `pdfEngine.ts`:
    - `pdf-lib` implementations: `merge-pdf` (multi-file sequence merging), `split-pdf` (page extraction), `rotate-pdf` (90/180/270 degree rotation), `remove-pdf-pages` (1-indexed page deletion), `images-to-pdf` (JPG/PNG embedding).
    - `pdfjs-dist` implementation: `pdf-to-text` text extraction via self-hosted worker.
  - `ffmpegEngine.ts`:
    - WebAssembly single-threaded FFmpeg runner (`@ffmpeg/ffmpeg`) for `audio-convert`, `video-convert`, `video-to-gif`, and `video-to-audio`.
    - Dynamic load of local self-hosted WASM binaries (`/vendor/ffmpeg/ffmpeg-core.js`), abort controller cancellation support, and virtual filesystem cleanup.
  - `registry.ts`:
    - Central dispatcher mapping tool definitions to their corresponding engine implementations.
    - Pre-flight checks: file size limit verification, input format validation, and safe filename collision deduplication (`filename (1).ext`).
- **Zero Third-Party Runtime Asset Setup:**
  - Placed `@ffmpeg/core` (`ffmpeg-core.js`, `ffmpeg-core.wasm`) and `pdfjs-dist` worker (`pdf.worker.min.mjs`) in `apps/web/public/vendor/`.
  - Added npm build lifecycle script `"copy-vendor"` to copy vendor assets during setup and build.
- **Queue Store & UI Integration:**
  - Refactored `queueStore.ts` from fake simulation to real async engine execution with per-file `AbortController`, real progress, output Blob generation, and direct single or batch ZIP download.
  - Added `DataPreviewTable.tsx` for real-time 5-row preview of spreadsheets/CSV files.
  - Updated tool page (`tools.$toolId.tsx`) to render preview tables and handle real conversions.

### 2. What was verified
- **Unit & Engine Test Suites:**
  - `textEngine.test.ts`: Markdown to HTML and HTML to Markdown transformations.
  - `dataEngine.test.ts`: CSV to JSON, JSON to CSV, XLSX to CSV, custom delimiter handling, and preview table parsing.
  - `pdfEngine.test.ts`: PDF merging, page rotation, page removal, and text extraction.
  - `zipUtil.test.ts`: Multi-file ZIP archive generation via `fflate`.
  - `limitsAndErrors.test.ts`: File size cap enforcement (e.g., rejecting files over maxBytes), invalid format rejection, and filename collision deduplication logic.
- **Quality Gates:**
  - `npm run lint`: **0 errors, 0 warnings** across all files.
  - `npm run type-check`: **0 errors** (`tsc --noEmit`).
  - `npm run test`: **16 test suites, 54 tests passing** in Vitest.
  - `npm run build`: Production Vite build successful with self-hosted assets and code-splitting.
  - Backend: `ruff`, `mypy`, `pytest` all green.

### 3. What could not be verified
- Full WebAssembly execution of FFmpeg inside headless JSDOM test runner (FFmpeg WASM requires browser WebAssembly and SharedArrayBuffer/Blob URLs, verified via mock wrappers in Node and build asset bundling).

---

## Phase 3: Backend Core

### 1. What was built
- **Configuration & Environment (`app/core/config.py`):**
  - Strongly typed Pydantic Settings reading environment variables and `.env`.
  - Configurable defaults conforming to Section 8.6 table (`MAX_UPLOAD_MB=25`, `CONCURRENCY_HEAVY=1`, `CONCURRENCY_YOUTUBE=2`, `CONCURRENCY_LIGHT=2`, `MAX_QUEUE_LENGTH=20`, `RATE_LIMIT_PER_MIN=60`, etc.).
  - Production guard: refuses to start if `ALLOWED_ORIGINS` is empty or contains `*`.
- **Structured JSON Logging (`app/core/logging.py`):**
  - Configured `structlog` with JSON renderer in production and development console formatter.
  - Sanitization processor redacting sensitive keys (`access_code`, `cookie`, `token`, `filename`).
- **Error Model (`app/core/errors.py`):**
  - Unified error schema: `{ "error": { "code", "message", "retryable", "retryAfterSec", "details" } }`.
  - Central error catalogue mapping all 24 standard error codes to HTTP status and retryability.
  - Custom `AppError` and unhandled exception handler logging server-side and returning `INTERNAL` with a request ID.
- **Security & Admission Control (`app/core/security.py`, `app/core/admission.py`, `app/core/rate_limit.py`):**
  - Reverse proxy IP resolution honoring `TRUSTED_PROXY_HOPS`.
  - Constant-time `X-Access-Code` verification via `secrets.compare_digest`.
  - Filename sanitization stripping cross-platform path traversal (`/` and `\`), control characters, null bytes, and length bounding.
  - Magic-byte sniffing via `filetype` library.
  - Request ID tracking via `RequestContextMiddleware` generating UUID4 `X-Request-Id`.
  - Rate limiting: sliding window per-IP counter for API requests (default 60/min) and job creations (default 20 / 10 min).
  - Strict admission control pipeline executing Section 8.3 checks in order:
    1. Access code (`AUTH_REQUIRED`)
    2. Per-IP rate limits (`RATE_LIMITED` + `Retry-After`)
    3. Active jobs per IP cap (`RATE_LIMITED`)
    4. Global queue capacity (`QUEUE_FULL` + `Retry-After`)
    5. Temp disk usage check (`SERVER_BUSY`)
- **Job System & State Management (`app/jobs/`):**
  - `JobRecord` internal model and `JobSnapshot` public API model with 128-bit unguessable tokens (`secrets.token_urlsafe(16)`).
  - Storage backends (`store.py`): `MemoryJobStore` (dict + asyncio safety) and `RedisJobStore` (Redis hashes + sliding rate limits, compatible with `fakeredis`).
  - Queue backends (`queue.py`): `MemoryJobQueue` (asyncio queues) and `RedisJobQueue` (Redis lists) supporting 1-indexed position lookups and pre-execution cancellation.
  - `JobRunner` (`runner.py`): worker pool managing concurrency per class (`heavy`, `youtube`, `light`), `psutil` memory guard preventing heavy job admission when free RAM < `MIN_FREE_MEM_MB`, external process tree termination (`os.killpg`), monotonic progress throttling (~4 updates/sec), and SSE subscriber event dispatch.
  - `echo_engine` (`app/engines/echo.py`): fake echo conversion engine exercising the entire upload-to-download lifecycle with staged progress.
- **Disk & Record Lifecycle (`app/jobs/cleanup.py`):**
  - Startup temp directory wiper (`wipe_temp_directory`) removing orphan files.
  - Background periodic task running every 60s to expire result files (15m TTL), age job records (60m TTL), and clean directories 60s after first download.
  - Graceful shutdown lifespan: reports `draining` status on `/api/health`, drains running jobs up to `SHUTDOWN_GRACE_SEC`, and cleans up resources.
- **API Endpoints (`app/api/`):**
  - `GET /api/health`: reports operational state, version, uptime, yt-dlp version, and queue status (`{running, queued}`).
  - `GET /api/limits`: exposes server quotas, concurrency, and feature flags.
  - `POST /api/jobs/convert`: streaming multipart upload direct to disk without RAM buffering, validating size limits during stream. Returns `202 {jobId}`.
  - `GET /api/jobs/{id}`: returns job snapshot.
  - `GET /api/jobs/{id}/events`: SSE stream with 15s heartbeat comments (`: ping\n\n`) and live status/progress/done/error events.
  - `DELETE /api/jobs/{id}`: cancels queued or running job, terminates subprocesses, and cleans directory.
  - `GET /api/jobs/{id}/download`: streams converted file with safe `Content-Disposition`, security headers, and 60s cleanup timer.
- **Infrastructure & Documentation:**
  - `apps/api/Dockerfile`: multi-stage Python 3.12-slim build, non-root user (`appuser:10001`), ffmpeg, `/tmp/convertit` tmpfs support, and `/api/health` Docker healthcheck.
  - `docker-compose.yml`: services for `api` and optional `redis` (under profile `redis`).
  - `scripts/youtube_smoke_test.py`: standalone diagnostic script extracting live YouTube metadata.
  - `scripts/bump_ytdlp.sh`: helper script to update yt-dlp.
  - `docs/API.md`: complete HTTP API documentation conforming to the OpenAPI specification.
  - `.github/workflows/ci.yml`: added Docker build verification step to backend CI pipeline.

### 2. What was verified
- **Backend Quality Gates:**
  - `ruff check app tests`: **0 errors, 0 warnings**.
  - `ruff format --check app tests`: **All 23 source files formatted**.
  - `mypy app tests`: **Strict typing passed with 0 errors across 23 source files**.
  - `pytest`: **23 tests passing in 0.65s**:
    - `test_health.py`: health status, version, uptime, and queue counts.
    - `test_security.py`: filename traversal, null bytes, control chars, length caps, magic-byte sniffing, proxy hops, and access code enforcement.
    - `test_store_and_queue.py`: CRUD, active IP counters, rate limits, and queue position lookups on **both Memory and FakeRedis**.
    - `test_limits_and_admission.py`: limits schema, active job caps, global queue backpressure, and server draining.
    - `test_job_lifecycle.py`: full upload-to-download lifecycle with echo engine on **both Memory and FakeRedis**, file size limit enforcement (413), corrupt payload rejection (422), cancellation, and server draining rejection (503).
- **Docker Verification:**
  - Built `convertit-api:test` image cleanly from `apps/api/Dockerfile`.
  - Started container and verified Docker container healthcheck: reports `"Status": "healthy"`, exit code 0, and `/api/health` returning 200 with active yt-dlp version.
- **YouTube Live Smoke Test:**
  - Executed `scripts/youtube_smoke_test.py` against live YouTube video ("Me at the zoo"). Successfully extracted metadata, duration (19s), and 24 stream formats using yt-dlp 2026.10.26.
- **Frontend Quality Gates:**
  - `npm run lint`: **0 errors, 0 warnings**.
  - `npm run type-check`: **0 errors**.
  - `npm run test`: **16 test suites, 54 tests passing**.
  - `npm run build`: Production bundle builds cleanly in 2.34s.

### 3. What could not be verified
- Production cloud deployment (target host and domain are not yet decided per Section 16; backend is host-agnostic, single-instance, and fully containerized).

---

## Phase 4: YouTube Module

### 1. What was built
- **Backend URL Canonicalization & Security (`app/engines/youtube_url.py`):**
  - Strict host allowlist (`youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be`).
  - Automatic `http` to `https` protocol upgrade.
  - Rejection of URLs with userinfo credentials (`admin:pass@youtube.com`).
  - Rejection of unsupported endpoints: playlists, channels, user profiles, feeds (`UNSUPPORTED_URL`).
  - Strict 11-character regex verification (`^[a-zA-Z0-9_-]{11}$`) extracting video IDs from `/watch?v=`, `/shorts/`, `/live/`, and `youtu.be/`.
  - Rebuilding clean canonical target URL (`https://www.youtube.com/watch?v=<id>`) before dispatching to yt-dlp.
- **Backend Error Mapping (`app/engines/youtube_errors.py`):**
  - Pure mapping function converting yt-dlp exceptions into sanitized, user-friendly `AppError` payloads:
    - Bot verification / Captcha $\rightarrow$ `UPSTREAM_BLOCKED` (502, retryable)
    - Age-restricted $\rightarrow$ `AGE_RESTRICTED` (422)
    - Live stream / Premiere $\rightarrow$ `LIVE_NOT_SUPPORTED` (422)
    - Private / Removed / Copyright / Geo-blocked $\rightarrow$ `VIDEO_UNAVAILABLE` (422)
    - Duration limit exceeded $\rightarrow$ `VIDEO_TOO_LONG` (422)
    - File size cap exceeded $\rightarrow$ `FILE_TOO_LARGE` (413)
    - Network timeout / unreachable $\rightarrow$ `UPSTREAM_ERROR` (502, retryable)
    - General failures $\rightarrow$ `CONVERSION_FAILED` (500)
- **Backend YouTube Engine (`app/engines/youtube.py`):**
  - `extract_video_info`: asynchronous metadata extraction returning sanitized title, channel, duration, formatted duration, upload date, view count, `tooLong` flag vs `YT_MAX_DURATION_MIN`, deduplicated video streams filtered up to `YT_MAX_HEIGHT` with approximate MB sizes, and audio format profiles.
  - `download_youtube`: executes yt-dlp in a worker thread with progress hooks mapped to stages (downloading 0–85%, finalizing/transcoding 85–100%), FFmpeg audio transcode (`mp3`, `m4a`, `opus`, `wav`) with custom bitrate, container merging (`mp4`, `webm`), optional thumbnail embedding, metadata tag embedding, FFmpeg post-download trimming (`trimStart`, `trimEnd`), hard file size limit enforcement (`YT_MAX_FILESIZE_MB`), and user cancellation polling.
- **Backend API Endpoints (`app/api/youtube.py`):**
  - `POST /api/youtube/info`: parses canonical URL and returns summarized video metadata.
  - `POST /api/jobs/youtube`: validates admission control and canonical URL, enqueues job to `youtube` class, and returns `202 { jobId }`.
  - Both endpoints are gated behind `ENABLE_YOUTUBE` (returning 503 `TOOL_DISABLED` when disabled).
- **Frontend Server Client & Hooks (`src/features/server/`):**
  - `apiClient.ts`: centralized fetch client attaching `X-Access-Code` from settings and converting HTTP errors to typed `AppError`.
  - `useServerHealth.ts` & `ServerWakeBanner.tsx`: non-blocking server health probe showing calm wake-up banner if server takes $>3\text{s}$ to wake up, retrying every $3\text{s}$ with backoff up to $90\text{s}$, and surfacing offline error.
  - `useJobEvents.ts`: fetch-based Server-Sent Events (SSE) reader supporting headers and falling back to $1.5\text{s}$ polling if SSE stream fails twice.
- **Frontend YouTube State & UI (`src/features/youtube/`):**
  - `youtubeStore.ts`: state machine for YouTube download lifecycle (`idle` $\rightarrow$ `fetching_info` $\rightarrow$ `info_ready` $\rightarrow$ `downloading` $\rightarrow$ `converting` $\rightarrow$ `done` $\rightarrow$ `error`).
  - `YouTubeSkeleton.tsx`: animated skeleton placeholder during info fetch.
  - `YouTubeResultCard.tsx`: metadata header (thumbnail with duration pill, title, channel, views), Video/Audio segmented control, quality and format pills, `tooLong` limit alert with audio-only fallback, collapsed "Advanced options" accordion (trim start/end, embed thumbnail, embed metadata), and primary Download button.
  - `YouTubeProgressCard.tsx`: live progress bar, stage indicator ("Downloading..." / "Transcoding to MP3..."), percentage, and Cancel button.
  - `YouTubeDoneCard.tsx`: "Complete" status badge, filename, formatted size, primary "Save file" trigger, 15-minute expiration notice, and "Download another" action.
  - Home page integration (`src/routes/index.tsx`): wires full YouTube workflow and cleanly hides YouTube interface when `limits.youtubeEnabled === false`.

### 2. What was verified
- **Backend Testing & Quality Gates:**
  - `ruff check app tests`: **0 errors, 0 warnings**.
  - `ruff format --check app tests`: **All 30 source files formatted**.
  - `mypy app tests`: **Strict typing passed with 0 errors across 30 source files**.
  - `pytest`: **34 tests passing in 0.59s**:
    - `test_youtube_url.py`: validated 10 valid URL permutations (youtube.com, youtu.be, shorts, m., music., protocol-less), rejected hostile subdomains, userinfo injection, playlists, channels, and invalid video IDs.
    - `test_youtube_errors.py`: verified error mapping across bot detection, age restriction, live event, private/removed, timeout, and generic failures.
    - `test_youtube_api.py`: verified info extraction endpoint, job creation returning 202, and `ENABLE_YOUTUBE=false` feature flag returning 503 `TOOL_DISABLED`.
    - `test_job_lifecycle.py`: full upload-to-download lifecycle passing with clean temp path isolation.
- **YouTube Smoke Test:**
  - `scripts/youtube_smoke_test.py` executed cleanly against live video ("Me at the zoo") extracting title, 19s duration, and 24 stream formats using yt-dlp 2026.10.26.
- **Frontend Testing & Quality Gates:**
  - `npm run lint`: **0 errors, 0 warnings**.
  - `npm run type-check`: **0 errors** (`tsc --noEmit`).
  - `npm run test`: **18 test suites, 64 tests passing** in Vitest:
    - `youtubeStore.test.ts`: verified state initialization, info loading, `tooLong` forcing audio mode, API error handling, and download start.
    - `youtubeCard.test.tsx`: verified `ServerWakeBanner`, `YouTubeResultCard` mode switching and format rendering, `YouTubeProgressCard` progress bar, and `YouTubeDoneCard` file saving.
  - `npm run build`: Production bundle built cleanly in 2.27s.

### 3. What could not be verified
- Downloading DRM-protected or proprietary encrypted media (outside product scope and strictly rejected by yt-dlp).

---

*Ready for Phase 5 review upon user command to continue.*
