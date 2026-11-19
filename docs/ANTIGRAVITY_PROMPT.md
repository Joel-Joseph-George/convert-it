# ConvertIt: Build Specification for Antigravity

You are the lead engineer building **ConvertIt**, a minimal, ad-free personal web app that (1) downloads YouTube video/audio from a pasted link and (2) converts files between formats (audio, video, image, PDF, documents, spreadsheets, text). This document is the single source of truth. Read all of it before writing any code.

---

## 0. How you must work

1. **Read first, then plan.** Before coding: read this file fully, read `design/README.md`, both `DESIGN.md` files (`design/utilitarian_precision/DESIGN.md` = light theme, `design/obsidian_utility/DESIGN.md` = dark theme), and open every `screen.png` in `design/`. Write `docs/DESIGN_NOTES.md` summarising the tokens, the screen-to-component map and any conflicts you found. Ask me about anything ambiguous instead of guessing.
2. **Work in phases (Section 14).** Finish one phase completely, run lint, type-check, tests and build, write a short report in `docs/PROGRESS.md`, then **stop and wait for me to say "continue"**.
3. **Do not add features, services or dependencies that are not in this spec** without asking. No accounts, no database, no analytics, no ads, no cookie banners, no tracking.
4. **Small commits** using conventional commit messages. Keep modules small and typed.
5. **Never fake it.** If something cannot be verified (e.g. a library API changed, a limit is unknown), say so in `docs/PROGRESS.md` rather than hiding it.
6. **Pin dependencies.** Use the latest stable versions at build time, commit lockfiles, and record every third-party library and its licence in `docs/THIRD_PARTY.md`.

---

## 1. Product principles

- **Minimal and calm.** One main action per screen. No clutter, no marketing sections.
- **Private by default.** Wherever a conversion can run in the browser, it must. Files never leave the device for those tools. Server tools are clearly badged.
- **Honest.** The UI always says where processing happens ("In your browser" or "Server"), what the limits are, and why something failed.
- **Free-tier friendly.** The backend must run on a small machine (assume as little as 512 MB RAM and a fraction of a CPU) and degrade gracefully (queueing, clear limits, wake-up UX) instead of crashing.
- **Extensible.** New tools are added by writing one registry entry plus, if needed, one engine function. No other part of the app should need to change.
- **Personal use.** Footer says "Made for personal use". YouTube downloading must be removable with a single feature flag (`ENABLE_YOUTUBE=false`).

---

## 2. Fixed technology stack

### Frontend (`apps/web`)
- React (latest stable) + **TypeScript (strict)** + **Vite**
- **Tailwind CSS** + **shadcn/ui** (Radix primitives) + `lucide-react` icons
- **Zustand** for client state
- **TanStack Router** (file-based routing via its Vite plugin) and **TanStack Query** for server calls
- Fonts self-hosted via `@fontsource` (Inter, JetBrains Mono). **No third-party requests at runtime** (no CDNs, no Google Fonts, no analytics).
- Browser conversion libraries: `@ffmpeg/ffmpeg` + `@ffmpeg/util` (ffmpeg.wasm), `pdf-lib`, `pdfjs-dist`, `xlsx` (SheetJS), `fflate` (ZIP), `heic2any` (or an equivalent maintained HEIC decoder), `marked` + `turndown` (text tools). Check each is maintained before adopting.
- Tests: **Vitest** + Testing Library; **Playwright** for a few end-to-end flows.
- Lint/format: ESLint + Prettier.

### Backend (`apps/api`)
- **Python 3.12**, **FastAPI**, Uvicorn, Pydantic v2, `pydantic-settings`
- **yt-dlp** (used as a Python library) + **ffmpeg** (system package)
- Phase 5 only: **LibreOffice (headless)**, `pdf2docx`, `pdfplumber`, `Pillow`, `pillow-heif`
- `psutil` (memory guard), `structlog` (JSON logs), `filetype` or `python-magic` (magic-byte sniffing)
- **Redis is supported but optional** (see Section 8). Default queue backend is in-memory so the app runs on hosts without Redis.
- Tests: `pytest`, `pytest-asyncio`, `httpx`, `fakeredis`. Lint/type: `ruff`, `mypy` (strict on `app/`).

### Infra
- **Docker** (multi-stage, non-root user) and **docker-compose** for local development (`api`, optional `redis` via a compose profile).
- **GitHub Actions** CI (lint, type-check, test, build). Deployment is **not decided yet**: do not add host-specific code. Keep the backend host-agnostic (plain Dockerfile, config via env vars, honour `$PORT`, no state that must survive a restart).
- **Monorepo**, single repository.

---

## 3. Repository layout

```
convert-it/
  apps/
    web/                      # React app
      src/
        routes/               # TanStack Router file routes
        components/           # ui/ (shadcn), layout/, tool/, youtube/, shared/
        features/
          registry/           # tool registry + types
          engines/            # browser engines (one folder per engine)
          queue/              # Zustand file-queue store
          youtube/            # YouTube UI state + API hooks
          server/             # API client, health, SSE, error mapping
        lib/                  # utils, formatters, constants
        styles/               # tokens.css, globals.css
        workers/              # Web Workers for heavy browser work
      tests/
    api/
      app/
        main.py
        core/                 # config, logging, errors, security, limits, rate_limit
        api/                  # routers: health, limits, youtube, jobs, convert
        jobs/                 # models, store (memory|redis), queue, runner, cleanup
        engines/              # youtube.py, libreoffice.py, pdf_tables.py, ...
        utils/                # files.py, urls.py, subprocess.py, sniff.py
      tests/
      Dockerfile
      requirements.txt (or pyproject.toml + lockfile)
  design/                     # Stitch exports (read-only reference)
  docs/                       # this file, DESIGN_NOTES.md, PROGRESS.md, THIRD_PARTY.md, API.md
  scripts/                    # youtube_smoke_test.py, bump_ytdlp.sh
  docker-compose.yml
  .github/workflows/ci.yml
  .env.example
  README.md
```

---

## 4. Design implementation

**Source of truth:** the PNGs in `design/` for how things look; the two `DESIGN.md` files for tokens. The Stitch `code.html` files are **references only**: never paste them in. Rebuild every screen as React components using shadcn/ui and Tailwind.

### 4.1 Token rules (important)
Each `DESIGN.md` has two sets of colours: a Material-style token block in the YAML front matter, and a "Theme Values" section in the prose. **Use the prose "Theme Values" hex codes** (these are what the screens use). Ignore the front-matter Material tokens.

Define everything as CSS variables in `styles/tokens.css`, mapped onto shadcn's token names (`--background`, `--card`, `--border`, `--primary`, `--muted-foreground`, `--ring`, and so on), with `:root` for light and `.dark` for dark.

| Token | Light | Dark |
|---|---|---|
| Canvas background | `#FAFAF9` | `#0C0A09` |
| Surface / card | `#FFFFFF` | `#171413` |
| Elevated / hover fill | `#F5F5F4` | `#231F1D` |
| Border | `#E7E5E4` | `#292524` |
| Dashed dropzone border | `#D6D3D1` | `#44403C` |
| Text primary | `#1C1917` | `#FAFAF9` |
| Text muted | `#78716C` | `#A8A29E` |
| Accent | `#4F46E5` | `#818CF8` |
| Accent hover | `#4338CA` | `#6366F1` |
| Text on accent | `#FFFFFF` | `#0C0A09` |
| Success | `#16A34A` | `#22C55E` |
| Warning | `#D97706` | `#F59E0B` |
| Error | `#DC2626` | `#EF4444` |

Other rules from the design files:
- Font: Inter (weights 400/500/600 only; never 700+). JetBrains Mono for file sizes, speeds and code-like text. Tight tracking on sizes 20px and above.
- Radii: cards/inputs/dropzones **12px**, buttons **10px**, format chips **6px**, status pills fully rounded.
- No gradients, no illustrations, no decorative shadows. Depth comes from 1px borders. Only floating popovers/menus get a soft shadow.
- Max content width **720px** (the All Tools grid may use up to 960px). 8px spacing grid.
- Buttons: 40px tall on desktop (the light file says 40px, the dark file says 36px: **use 40px** everywhere, 32px for "small"). Minimum 44px tap targets on mobile.
- Focus ring: 2px accent outline with 2px offset, on every interactive element.
- Progress bar: 4px track, solid accent fill (green when complete), linear width transition, no shimmer.
- Theme: follows the system by default, user can toggle, choice stored in `localStorage` (this is one of only two things allowed in `localStorage`; the other is the optional access code, Section 9.4).

### 4.2 Screen-to-route map

| Design folder | Route / component |
|---|---|
| `convertit_home_updated_popular_tools` (current home; **ignore** `OLD_convertit_home`) | `/` (link input + "Popular tools" strip + "Browse all tools") |
| `convertit_youtube_result`, `_loading_state`, `_dark_mode` | YouTube result card, rendered on `/` below the input |
| `convertit_download_server_states` | Progress / converting / done states and the "waking up the server" banner |
| `convertit_error_edge_case_states` | Shared `ErrorAlert` component (Section 10) |
| `convertit_all_tools_desktop`, `_mobile` | `/tools` (search + category chips + grid) |
| `convertit_audio_converter_empty`, `_files_added`, `_dark_mode` | The **single shared tool page template** at `/tools/$toolId` |
| `convertit_image_converter`, `convertit_data_converter` | Same template; only formats and options differ (from the registry) |
| `convertit_pdf_to_excel_in_browser`, `_server_processed` | Same template; engine badge and privacy line differ |
| `convertit_mobile_*` | Responsive behaviour of the above (breakpoint 768px; 640px for tablet rules) |

Top bar: wordmark **ConvertIt** ("Convert" in text colour, "It" in accent), "All tools" link, search icon, theme toggle. No login, no pricing, no category links.
Home copy: label "Free. No ads. No sign-up." / H1 "Paste a link. Convert it." / subtext from the design. Footer: one muted line plus a GitHub icon link.

### 4.3 Component inventory
`TopBar`, `Footer`, `ThemeToggle`, `UrlInput`, `ToolCard`, `ToolGrid`, `CategoryChips`, `ToolSearch`, `DropZone`, `FormatPills`, `OptionsPanel` (generated from the tool's option schema), `FileQueue`, `FileRow`, `StatusPill`, `ProgressBar`, `EngineBadge`, `PrivacyLine`, `YouTubeResultCard`, `ServerWakeBanner`, `ErrorAlert`, `EmptyState`, `NotFound`. Build these once, reuse everywhere.

### 4.4 Accessibility
WCAG AA contrast in both themes; full keyboard operation; visible focus; labels on every input; `aria-live="polite"` for progress and status changes; `prefers-reduced-motion` respected; drag-and-drop always has a "Choose files" button alternative.

---

## 5. The tool registry (the core abstraction)

Everything user-facing (nav search, All Tools page, popular strip, tool pages, option panels, badges) is **generated from one registry**. Adding a tool must not require touching UI code.

```ts
type Category = 'pdf' | 'image' | 'audio' | 'video' | 'documents' | 'data' | 'archives' | 'text';
type EngineKind = 'browser' | 'server';

interface ToolOption {
  id: string;
  label: string;
  type: 'select' | 'slider' | 'toggle' | 'number' | 'text';
  default: string | number | boolean;
  choices?: { value: string; label: string }[];
  min?: number; max?: number; step?: number;
  showWhen?: { optionId: string; equals: unknown };   // conditional display
  advanced?: boolean;                                  // goes inside the collapsible "Options"
}

interface ToolDefinition {
  id: string;                         // 'pdf-to-excel' (also the URL slug)
  name: string;                       // 'PDF to Excel'
  description: string;                // one line for cards
  category: Category;
  keywords: string[];                 // for search ('xls','spreadsheet','table')
  popular?: boolean;
  inputs: { extensions: string[]; mimeTypes: string[]; multiple: boolean; maxFiles?: number };
  outputs: { value: string; label: string }[];   // the format pills ('xlsx')
  options: ToolOption[];
  engine: { kind: EngineKind; id: string };      // id points to an engine implementation
  limits: { maxFileSizeMB: number; maxFiles?: number };
  badge?: 'best-effort';                         // shows the "Best effort" tag
  notes?: string;                                // e.g. "Works best on PDFs with real tables."
}
```

Rules:
- The registry is a typed array in `features/registry/tools.ts`, validated at startup (unique ids, valid categories, engine ids that exist). A unit test enforces this.
- **Browser engines** implement `run(files, options, ctx) => Promise<ConvertResult[]>` where `ctx = { onProgress(0..100), signal: AbortSignal }`. Heavy work runs in **Web Workers**, never on the main thread.
- **Server engines** are thin clients to the API (upload, job events, download). The server keeps its **own** capability map (`tool_id -> handler, limits`) and validates every request independently. The frontend must never be trusted.
- Search: fuzzy match over name, description and keywords (a small in-house scorer or `fuse.js`), results update as you type.
- The frontend reads `GET /api/limits` to learn which server tools and features are enabled. Server tools not listed there (or when the API is unreachable) render as **disabled** with the text "Unavailable on this server"; browser tools are never affected.

### 5.1 Initial tool catalogue

**Phase 2: browser tools**
- **Image:** `image-convert` (PNG, JPG, WEBP, AVIF; quality slider, optional resize, strip metadata), `heic-to-jpg`, `svg-to-png`, `image-resize`, `image-compress`
- **Audio:** `audio-convert` (MP3, WAV, AAC, M4A, FLAC, OGG; bitrate, sample rate, mono/stereo)
- **Video:** `video-convert` (MP4, WEBM), `video-to-gif`, `video-to-audio`
- **Data:** `excel-to-csv`, `csv-to-excel`, `json-to-csv`, `csv-to-json`, `excel-to-json`, `json-to-excel` (delimiter, header row, sheet selector, preview of first 5 rows)
- **PDF:** `merge-pdf`, `split-pdf`, `rotate-pdf`, `remove-pdf-pages`, `images-to-pdf`, `pdf-to-images`, `pdf-to-text`
- **Text:** `markdown-to-html`, `html-to-markdown`

**Phase 5: server tools** (badge "Server")
`word-to-pdf`, `powerpoint-to-pdf`, `excel-to-pdf`, `pdf-to-word` (best effort), `pdf-to-excel` (best effort, real tables only), `pdf-to-powerpoint` (**defer** unless quality is acceptable; tell me if it is not).

**Mark as `popular`:** merge-pdf, pdf-to-word, image-compress, audio-convert, excel-to-csv, video-to-gif, heic-to-jpg, images-to-pdf.

---

## 6. Frontend architecture

### 6.1 Routing
- `/` Home; `/tools` All Tools; `/tools/$toolId` tool page (unknown id renders `NotFound`); a global error boundary and a 404 route.
- Search state and category filter live in the URL search params on `/tools` (`?q=&category=`).

### 6.2 State (Zustand)
- `queueStore`: per-tool list of `QueueItem { id, file, status, progress, result?, error? }`. Status machine: `ready → converting → done | failed | cancelled`. Actions: add, remove, clear, start, cancel, retry.
- `settingsStore`: theme, access code (if required).
- `serverStore`: `{ status: 'unknown' | 'waking' | 'ready' | 'offline', limits }`.
- Server data (video info, job polling) goes through **TanStack Query**, not Zustand.

### 6.3 Browser engines: rules
- **ffmpeg.wasm:** lazy-load the core only when an audio/video tool is opened. Use the **single-threaded** core (multi-threaded needs cross-origin isolation headers, which we are not enabling). Process **one file at a time**. Free memory between files. Show a clear message if the file exceeds the tool's `maxFileSizeMB`.
- **Images:** Canvas/`createImageBitmap` (OffscreenCanvas in a worker where supported); AVIF/WEBP encode support differs by browser, so feature-detect and disable unsupported output formats with a tooltip.
- **PDF:** `pdf-lib` for merge/split/rotate/remove/images-to-pdf; `pdfjs-dist` for rendering pages to images and extracting text.
- **Data:** SheetJS in a worker. Preview the first 5 rows.
- Concurrency: ffmpeg 1, PDF 1, images up to 3, data 2.
- Every engine supports **cancel** via `AbortSignal` and reports progress.
- Revoke object URLs after download or when items are removed. Cap a batch at 20 files.
- "Download all (ZIP)" uses `fflate`.
- Outputs are named `<original-name>.<new-ext>`, with `(1)`, `(2)` appended on collisions.

### 6.4 Talking to the server
- Base URL from `VITE_API_BASE_URL`. All requests go through one typed API client that attaches `X-Access-Code` when set, applies timeouts, and converts error responses into typed `AppError` objects (Section 10).
- Uploads use `XMLHttpRequest` (for upload progress). Job progress uses **SSE via a fetch-based reader** (so headers can be sent); fall back to polling `GET /api/jobs/{id}` every 1.5s if the stream fails twice.
- **Wake-up UX:** on first load of `/` or any server tool page, fire a non-blocking `GET /api/health`. If it has not answered within 3s, show `ServerWakeBanner` ("Waking up the server, this can take up to a minute the first time"), retry every 3s for up to 90s with backoff, then show the "server not responding" error. Browser tools are never blocked by this.
- Retry only idempotent requests (GET); never auto-retry job creation.
- Cancelling a server job sends `DELETE /api/jobs/{id}`.

### 6.5 YouTube UI (home)
1. Client-side URL validation (youtube.com, www/m/music.youtube.com, youtu.be). Invalid shows the "doesn't look like a YouTube link" alert. A "Paste" button reads the clipboard (handle permission denial silently).
2. "Fetch" calls `POST /api/youtube/info`. Show the skeleton state while loading.
3. Result card: thumbnail, duration badge, title, channel, views and age. Video/Audio segmented control. Video: quality (only heights actually available, up to the server cap, with approximate sizes) and format (MP4, WEBM). Audio: format (MP3, M4A, WAV, OPUS) and bitrate. Collapsed "Advanced options": trim start/end (hh:mm:ss), embed thumbnail, embed metadata.
4. If `tooLong` or a size estimate exceeds the cap, show the matching alert and offer "Choose audio only" where it makes sense.
5. "Download" creates a job and shows the progress, converting and done states from the design. "Save file" triggers the browser download. The result link expires, so show a small "Available for N minutes" note.

---

## 7. Backend API contract

Prefix all routes with `/api`. JSON in and out unless noted. Every response includes an `X-Request-Id` header.

| Method & path | Purpose |
|---|---|
| `GET /api/health` | `{status, version, uptimeSec, ytdlpVersion, queue:{running, queued}}`. Public, cheap, never touches YouTube. |
| `GET /api/limits` | Effective limits and enabled features/tools, `accessCodeRequired`. Public. |
| `POST /api/youtube/info` | Body `{url}` → video metadata and available formats (summarised, not raw yt-dlp output), `tooLong`, `estimatedSizes`. |
| `POST /api/jobs/youtube` | Body `{url, mode:'video'|'audio', format, quality?, bitrate?, trimStart?, trimEnd?, embedThumbnail?, embedMetadata?}` → `202 {jobId}` |
| `POST /api/jobs/convert` | `multipart/form-data`: `toolId`, `options` (JSON string), `file` → `202 {jobId}` |
| `GET /api/jobs/{id}` | Job snapshot (below) |
| `GET /api/jobs/{id}/events` | **SSE** stream: events `status`, `progress`, `done`, `error`; heartbeat comment every 15s |
| `DELETE /api/jobs/{id}` | Cancel (kills the subprocess group) and clean up |
| `GET /api/jobs/{id}/download` | Streams the result with a safe `Content-Disposition`; schedules deletion |

**Job snapshot:**
```json
{
  "id": "…", "type": "youtube|convert", "toolId": "pdf-to-word",
  "status": "queued|running|succeeded|failed|cancelled|expired",
  "stage": "downloading|converting|finalizing|null",
  "progress": 0,
  "queuePosition": 2,
  "createdAt": "…", "startedAt": null, "finishedAt": null,
  "error": { "code": "…", "message": "…", "retryable": false },
  "result": { "filename": "…", "sizeBytes": 0, "mime": "…", "expiresAt": "…" }
}
```

- Validate all bodies with Pydantic; reject unknown fields.
- Job ids are unguessable (at least 128 bits, e.g. `secrets.token_urlsafe(16)` or longer). Possession of the id is the capability to read or download, so never list jobs.
- Download: stream from disk in chunks, and delete the job directory **60 seconds after the first complete download** (grace for retries) or at TTL, whichever is first.
- Document the contract in `docs/API.md` and generate the OpenAPI schema (FastAPI default). Keep `docs/API.md` in sync.

---

## 8. Job system, queue and load management

### 8.1 Architecture
Two small abstractions, each with two implementations selected by `QUEUE_BACKEND=memory|redis` (default `memory`):

- `JobStore`: create/get/update/delete job records with TTL, plus rate-limit counters. `MemoryJobStore` (dict + asyncio lock) and `RedisJobStore` (hashes with TTL, `redis.asyncio`).
- `JobQueue`: enqueue, dequeue (per class), position lookup, cancel. `MemoryJobQueue` (asyncio queues) and `RedisJobQueue` (lists).

The `JobRunner` (asyncio worker pool inside the API process) pulls from the queue and executes engines. **Do not build multi-replica support**: job files live on local disk, so the API is a single instance. Redis only adds restart-survivable job records and shared counters. Tests must run against both backends (`fakeredis` for Redis).

### 8.2 Job classes and concurrency
| Class | Used by | Default concurrency |
|---|---|---|
| `heavy` | LibreOffice, ffmpeg transcodes, PDF table extraction | 1 |
| `youtube` | yt-dlp downloads | 2 |
| `light` | quick server tasks | 2 |

Overall cap on running jobs is the sum of the above, configurable via env. Everything beyond that **queues**.

### 8.3 Backpressure and admission control (reject early, clearly)
Before accepting any job, check in this order and return the matching error:
1. Access code (if enabled) → `AUTH_REQUIRED`
2. Per-IP request rate → `RATE_LIMITED` + `Retry-After`
3. Per-IP active jobs (default 2) → `RATE_LIMITED`
4. Global queue length (default 20) → `QUEUE_FULL` + `Retry-After`
5. Free temp disk space vs `MAX_TMP_DISK_MB` → `SERVER_BUSY`
6. Tool enabled and input valid → `TOOL_DISABLED` / `INVALID_OPTIONS` / `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE`

**Memory guard:** before a `heavy` job starts, check available RAM via `psutil`; if below `MIN_FREE_MEM_MB`, keep it queued and retry shortly. Never start a heavy job when memory is critically low.

### 8.4 Execution rules
- Each job gets its own directory under `TMP_DIR/<jobId>/`. Never share directories.
- Run external tools with `asyncio.create_subprocess_exec` (**never `shell=True`**), argument lists only, in a **new process group** so a cancel or timeout kills the whole tree. Capture stderr (truncated), set hard timeouts per class, and apply `resource` limits (CPU time, file size) where supported.
- yt-dlp runs in a worker thread/executor (it is blocking) with progress hooks feeding the job record. Cancellation uses a flag checked in the hook, plus subprocess termination for ffmpeg post-processing.
- Progress is monotonic (never goes backwards), throttled to at most ~4 updates per second, and mapped per stage (e.g. YouTube: download 0 to 85, post-process 85 to 100).
- Every job ends in exactly one terminal state; failures always clean up the job directory.

### 8.5 Cleanup and lifecycle
- On startup: wipe `TMP_DIR` (no orphan files after a crash).
- Background task every 60s: delete expired job directories (result TTL default 15 minutes) and expire job records (default 60 minutes).
- **Graceful shutdown** (SIGTERM): stop accepting new jobs (`/api/health` reports `draining`), let running jobs finish up to `SHUTDOWN_GRACE_SEC` (default 30), then cancel the rest and clean up.
- Queue positions are recomputed and pushed over SSE when they change.

### 8.6 Limits table (all configurable via env; these are defaults)

| Setting | Default | Notes |
|---|---|---|
| `MAX_UPLOAD_MB` | 25 | Per-tool override in the server tool map |
| `YT_MAX_DURATION_MIN` | 60 | |
| `YT_MAX_FILESIZE_MB` | 300 | Enforced via yt-dlp `max_filesize` and the post-download size check |
| `YT_MAX_HEIGHT` | 1080 | |
| `JOB_TIMEOUT_YOUTUBE_SEC` | 900 | |
| `JOB_TIMEOUT_HEAVY_SEC` | 180 | |
| `JOB_RESULT_TTL_MIN` | 15 | |
| `JOB_RECORD_TTL_MIN` | 60 | |
| `CONCURRENCY_HEAVY / YOUTUBE / LIGHT` | 1 / 2 / 2 | |
| `MAX_QUEUE_LENGTH` | 20 | |
| `MAX_ACTIVE_JOBS_PER_IP` | 2 | |
| `RATE_LIMIT_PER_MIN` | 60 | All endpoints, per IP |
| `JOB_CREATES_PER_10MIN` | 20 | Per IP |
| `MAX_TMP_DISK_MB` | 2000 | |
| `MIN_FREE_MEM_MB` | 300 | Heavy jobs only |
| `SHUTDOWN_GRACE_SEC` | 30 | |

Browser-side defaults live in the registry (`limits.maxFileSizeMB`): image 50, PDF 100, data 50, audio 300, video 200 (show a warning above 100). `GET /api/limits` returns the server values so the UI shows the real numbers in its messages.

---

## 9. Security and abuse prevention

### 9.1 YouTube URL handling (SSRF and injection)
yt-dlp can fetch from hundreds of sites, so **never pass the raw user string to it**. Parse the URL, require `https` (upgrade `http`), require the host to be exactly one of `youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be`, extract and validate the 11-character video id with a strict regex, then **rebuild the canonical URL** `https://www.youtube.com/watch?v=<id>` and pass only that. Playlists, channels and live streams are not supported (`noplaylist=True`).

### 9.2 Uploads
- Stream to disk in chunks and abort as soon as the size cap is exceeded (do not trust `Content-Length`; do not buffer whole files in memory).
- Check the extension against the tool's allowlist **and** sniff magic bytes; mismatch → `UNSUPPORTED_FILE_TYPE`.
- Sanitise filenames (strip paths, control characters, limit length). Store as a fixed internal name; keep the original name only to build the download name.
- Archive-type tools (future): enforce uncompressed-size and entry-count limits (zip-bomb protection).

### 9.3 Network and process hygiene
- CORS: exact-origin allowlist from `ALLOWED_ORIGINS`. In production the app must **refuse to start** if the list is empty or contains `*`.
- Trust `X-Forwarded-For` only when `TRUSTED_PROXY_HOPS` is set; otherwise use the socket address.
- API security headers (`X-Content-Type-Options: nosniff`, `Cache-Control: no-store` on job and download routes).
- Docker: non-root user, read-only root filesystem where practical, writable only under `TMP_DIR`.
- Logs must **never** contain uploaded file names, cookies, access codes or full URLs; log job id, tool id, sizes, durations, status and (for YouTube) the video id.

### 9.4 Optional access code
If `ACCESS_CODE` is set, every route except `/api/health` and `/api/limits` requires header `X-Access-Code` (constant-time compare). `GET /api/limits` returns `accessCodeRequired: true`; the frontend then shows a single small prompt, stores the code in `localStorage`, and sends it with every request. Be honest in the docs: this is light friction for a personal app, not strong authentication.

### 9.5 YouTube access (important operational reality)
- YouTube may block datacenter IPs ("sign in to confirm you're not a bot"). Support these **optional** env settings: `YT_COOKIES_FILE` (path to a cookies file mounted as a secret; never log it, never commit it) and `YT_PROXY`. Both are off by default.
- Create `scripts/youtube_smoke_test.py` early (Phase 3): it calls the real extraction for a known short public video, prints success/failure and the yt-dlp version. I will run it on candidate hosts before committing to one.
- Pin yt-dlp, expose its version in `/api/health`, and add `scripts/bump_ytdlp.sh` plus a note in the README on updating it. YouTube changes frequently, so update often.
- yt-dlp may require an external JavaScript runtime for full YouTube support. **Check the current yt-dlp documentation at build time** and install whatever it requires in the Docker image (use `yt-dlp[default]` if that is the recommended extra). Verify with the smoke test.
- Keep everything YouTube-related in one module (`engines/youtube.py`, `routes/youtube.py`, the `features/youtube` folder) behind `ENABLE_YOUTUBE`, so it can be switched off cleanly.

---

## 10. Error handling

### 10.1 Format
Every error response, with the correct HTTP status:
```json
{ "error": { "code": "VIDEO_TOO_LONG", "message": "…", "retryable": false, "retryAfterSec": null, "details": {} } }
```
Unhandled exceptions return `INTERNAL` with a request id (never a stack trace) and are logged with the stack trace server-side.

### 10.2 Error catalogue

| Code | HTTP | Retryable | Meaning / UI mapping |
|---|---|---|---|
| `INVALID_URL` | 400 | no | "That doesn't look like a YouTube link" |
| `UNSUPPORTED_URL` | 400 | no | Non-YouTube host, playlist/channel/live |
| `VIDEO_UNAVAILABLE` | 422 | no | Private, removed, geo-blocked, members-only |
| `AGE_RESTRICTED` | 422 | no | Same card as unavailable, different text |
| `LIVE_NOT_SUPPORTED` | 422 | no | |
| `VIDEO_TOO_LONG` | 422 | no | Offer "Choose audio only" if it helps |
| `FILE_TOO_LARGE` | 413 | no | Show the real limit |
| `UNSUPPORTED_FILE_TYPE` | 415 | no | |
| `FILE_CORRUPT` | 422 | no | |
| `TOOL_NOT_FOUND` / `TOOL_DISABLED` | 404 / 503 | no | "Unavailable on this server" |
| `INVALID_OPTIONS` | 422 | no | |
| `AUTH_REQUIRED` | 401 | no | Prompt for access code |
| `RATE_LIMITED` | 429 | yes | Use `retryAfterSec` |
| `QUEUE_FULL` / `SERVER_BUSY` | 503 | yes | "Try again in a moment" |
| `UPSTREAM_BLOCKED` | 502 | yes | "The server couldn't reach YouTube right now" |
| `UPSTREAM_ERROR` | 502 | yes | |
| `CONVERSION_FAILED` | 500 | maybe | Generic failure with Retry |
| `CONVERSION_TIMEOUT` | 504 | no | |
| `JOB_NOT_FOUND` / `JOB_EXPIRED` / `JOB_CANCELLED` | 404 / 410 / 409 | no | |
| `INTERNAL` | 500 | yes | Show request id |
| (client only) `SERVER_OFFLINE` | n/a | yes | "The server is not responding" |

### 10.3 yt-dlp error mapping
Wrap yt-dlp exceptions in one function that maps known message patterns to the codes above (bot check/sign-in → `UPSTREAM_BLOCKED`; private/removed/unavailable/region → `VIDEO_UNAVAILABLE`; age → `AGE_RESTRICTED`; live/premiere → `LIVE_NOT_SUPPORTED`; network/timeouts → `UPSTREAM_ERROR`; anything else → `CONVERSION_FAILED`). Cover this mapping with unit tests using sample messages. Never expose raw yt-dlp output to the user.

### 10.4 Frontend
- `ErrorAlert` renders the design's inline alert cards (icon, bold title, one-line explanation, one action). Red for errors, amber for limit cases.
- A single `errorToView(error)` function maps `code` to title, message and action, so copy lives in one file.
- Browser engines produce the same `AppError` shape (`FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `FILE_CORRUPT`, `CONVERSION_FAILED`, out-of-memory as `CONVERSION_FAILED` with a specific message).
- One failed file never blocks the others in a batch; each row shows its own state with Retry/Remove.
- Never leave a spinner without a timeout path.

---

## 11. Server conversion engines (Phase 5)

- **LibreOffice:** headless `soffice --convert-to`, with a **unique profile directory per job** (`-env:UserInstallation=file:///…`), heavy class (concurrency 1), timeout 180s, kill the process group on timeout. Build the Docker image with a build arg `INSTALL_LIBREOFFICE=true|false` so the lightweight image (YouTube only) stays small.
- **PDF → Word:** `pdf2docx`. **PDF → Excel:** `pdfplumber` table extraction, one sheet per page that has tables; if no tables are found return a clear error ("No tables found. Scanned PDFs may need OCR"), not an empty file. Both carry the "Best effort" badge.
- Validate output exists and is non-empty before marking a job succeeded.
- Each engine has a **golden-file test** with a small fixture.

---

## 12. Docker and local development

- `apps/api/Dockerfile`: multi-stage; Python 3.12 slim; install ffmpeg; optional LibreOffice via build arg; create a non-root user; `HEALTHCHECK` calling `/api/health`; start with `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}` (single worker).
- `docker-compose.yml`: `api` service (env from `.env`, a volume or tmpfs for `TMP_DIR`), and `redis` under profile `redis`. `docker compose up` runs the in-memory setup; `docker compose --profile redis up` with `QUEUE_BACKEND=redis` exercises Redis.
- `.env.example` documents **every** env var from Sections 8 and 9 with comments. Never commit real secrets.
- The web app runs with `npm run dev` against `VITE_API_BASE_URL=http://localhost:8000`.
- A top-level `README.md` explains setup, commands, env vars, how to add a tool, how to update yt-dlp, and how to run the smoke test.

### CI (`.github/workflows/ci.yml`)
Two jobs, path-filtered: **web** (install, lint, type-check, Vitest, build) and **api** (ruff, mypy, pytest, Docker build). Add dependency auditing (`npm audit`, `pip-audit`) as non-blocking warnings. Do **not** add deployment steps yet.

---

## 13. Testing strategy

- **Frontend unit:** registry validation, search scoring, `errorToView`, queue store state machine, filename collision logic, URL validation.
- **Frontend component:** DropZone, FileRow states, OptionsPanel generated from a registry entry, YouTube result card states.
- **Browser engine tests:** small fixtures (tiny WAV, PNG, CSV, XLSX, PDF) with output checks where feasible in the test environment.
- **Backend unit:** URL canonicalisation (including hostile inputs such as `youtube.com.evil.com`, userinfo tricks, non-https), error mapping, limits, rate limiter, job state machine, filename sanitisation, magic-byte sniffing.
- **Backend integration:** upload to download flow with a fake engine; queue ordering, concurrency, backpressure (`QUEUE_FULL`), cancellation, timeout, TTL cleanup, shutdown draining, all against **both** memory and fakeredis backends.
- **YouTube:** mock yt-dlp in CI (no live network in tests); the live check is only the manual smoke script.
- **E2E (Playwright):** home → paste invalid URL → error; All Tools search and filter; a browser conversion end to end (e.g. CSV → JSON); theme toggle persists; mobile viewport layout.
- Quality gates before each phase report: lint, type-check and tests all pass with zero errors.

---

## 14. Phased build plan

**Stop after each phase and wait for my "continue".**

### Phase 0: Foundations
Monorepo scaffold, tooling (ESLint, Prettier, ruff, mypy, Vitest, pytest), CI skeleton, `.env.example`, `docs/DESIGN_NOTES.md`. Tailwind + shadcn setup, `tokens.css` with both themes, fonts, `TopBar`, `Footer`, `ThemeToggle`, router with `/`, `/tools`, 404.
**Done when:** both themes render the shell correctly against the PNGs; CI is green.

### Phase 1: Registry and UI (no real conversion yet)
Registry types and the full tool catalogue (Sections 5 and 5.1) with stub engines. Build Home (static YouTube input UI, popular strip), All Tools (search, chips, grid, empty state), the shared Tool page template (DropZone, FormatPills, OptionsPanel, FileQueue with fake progress), `EngineBadge`, `PrivacyLine`, `ErrorAlert`, mobile layouts, dark mode.
**Done when:** every screen matches its design PNG at desktop and 390px widths in both themes, search works, and registry validation tests pass.

### Phase 2: Browser engines
Implement the real engines (Section 6.3) and wire them to the registry: data, image, PDF, text, then audio and video via ffmpeg.wasm. Cancel, progress, ZIP download, limits and error handling for each.
**Done when:** each browser tool converts a real fixture file end to end, large-file and corrupt-file cases show proper errors, and no network requests are made during conversion (verify in an E2E test).

### Phase 3: Backend core
FastAPI app, config, structured logging, error model, `/api/health`, `/api/limits`, job store and queue (memory **and** Redis), runner, admission control, rate limiting, cleanup, graceful shutdown, upload handling, security items from Section 9, Dockerfile, docker-compose, `scripts/youtube_smoke_test.py`, `docs/API.md`, and a **fake echo engine** to exercise the whole job lifecycle.
**Done when:** the integration tests in Section 13 pass on both backends and the Docker image builds and passes its healthcheck.

### Phase 4: YouTube module
Backend `youtube/info` and `jobs/youtube` with canonical URL handling, format selection, progress hooks, limits, error mapping, optional cookies/proxy, and the full frontend flow from Section 6.5 including the progress, done, error and wake-up states.
**Done when:** with the smoke test passing locally, a real video downloads as MP4 and as MP3 through the UI, all error cards are reachable via mocked failures, and the YouTube feature disappears cleanly with `ENABLE_YOUTUBE=false`.

### Phase 5: Server document tools
LibreOffice image build arg, the engines in Section 11, server-tool client in the frontend, "Server" badges, best-effort notes, disabled states when the backend lacks a tool.
**Done when:** each server tool passes its golden test and the UI shows server limits correctly.

### Phase 6: Polish and hardening
Accessibility pass (keyboard, screen reader, contrast, reduced motion), performance pass (code-splitting per engine, bundle size report in `docs/PROGRESS.md`), final `README.md`, review of all env vars and limits, dependency audit, full E2E run.

---

## 15. Definition of done (applies to every phase)

- Matches the design PNGs (both themes, desktop and mobile) where UI is involved.
- No `any` in TypeScript, no `# type: ignore` without a comment, zero lint errors.
- No console errors or warnings in the browser during normal use.
- No unhandled promise rejections; every async path has loading, success and error states.
- No third-party network calls from the frontend at runtime.
- No secrets, personal data or uploaded content in logs or in git.
- Tests added for new logic; `docs/PROGRESS.md` updated with what was built, what was verified, and what could not be verified.

## 16. Decisions still open (do not decide these for me)
- Where the backend will be hosted (affects only deployment config).
- Whether heavy server tools (Phase 5) ship at all on the chosen host.
- Final domain/URL and the exact `ALLOWED_ORIGINS` value.
- Whether to add an access code in production.

If any open item blocks you, stop and ask.
