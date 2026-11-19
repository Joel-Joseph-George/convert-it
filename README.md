# ConvertIt

> An ad-free, minimal personal web application for downloading YouTube media and converting files between multi-format audio, video, image, document, spreadsheet, and data representations with a private-by-default, browser-first architecture.

---

## 1. Product Principles & Architecture

- **Private by Default:** Conversions run locally inside the user's browser using WebAssembly and pure client-side libraries whenever technically feasible. Files never leave your machine for browser-supported tools.
- **Honest & Transparent:** Every tool is explicitly badged with processing location (**"In your browser"** with green indicator or **"Server"** with cloud indicator). Exact limits, errors, and progress stages are communicated directly.
- **Ephemeral Backend:** The backend retains zero persistent storage. Disk directories are wiped on startup; completed files are automatically purged 60 seconds after the first complete download or after 15 minutes TTL.
- **Free-Tier Friendly:** Designed to operate smoothly on minimal compute (as low as 512MB RAM) using backpressure, admission control queues, and PSUTIL memory guards.
- **Personal Use:** Zero third-party runtime requests, no tracking, no analytics, no advertisements, and no database or user accounts. The YouTube module can be completely disabled with a single environment flag (`ENABLE_YOUTUBE=false`).

---

## 2. Technology Stack

- **Frontend (`apps/web`):**
  - React 19 + TypeScript (strict mode) + Vite
  - Tailwind CSS + shadcn/ui primitives + Lucide Icons
  - Zustand (state management) + TanStack Router (file-based) + TanStack Query
  - Self-hosted `@fontsource/inter` and `@fontsource/jetbrains-mono` typography
  - Browser engines: `@ffmpeg/ffmpeg` (ffmpeg.wasm), `pdf-lib`, `pdfjs-dist`, `xlsx` (SheetJS), `fflate`, `marked`, `turndown`, `heic2any`
  - Testing: Vitest + Testing Library + Playwright E2E
- **Backend (`apps/api`):**
  - Python 3.12, FastAPI, Uvicorn, Pydantic v2, `pydantic-settings`
  - `yt-dlp` + FFmpeg system integration
  - Server engines: `pdf2docx`, `pdfplumber`, `openpyxl`, headless LibreOffice
  - Concurrency & Queueing: In-memory asyncio queues (default) or optional Redis backend
  - Testing: `pytest`, `pytest-asyncio`, `httpx`, `fakeredis`, `ruff`, `mypy`

---

## 3. Project Structure

```
convert-it/
├── apps/
│   ├── web/                    # React frontend application
│   │   ├── e2e/                # Playwright end-to-end test suites
│   │   ├── src/
│   │   │   ├── components/     # UI primitives, shared badges, layout, tools
│   │   │   ├── features/       # Registry, browser engines, queue store, server client
│   │   │   ├── routes/         # TanStack file routes (/, /tools, /tools/$toolId)
│   │   │   └── styles/         # Tokens (light/dark themes) and global CSS
│   │   └── tests/              # Vitest unit and component tests
│   └── api/                    # FastAPI backend service
│       ├── app/
│       │   ├── api/            # API route controllers (health, limits, jobs, youtube)
│       │   ├── core/           # Config, logging, admission, security, errors
│       │   ├── engines/        # YouTube, pdf2docx, pdfplumber, LibreOffice
│       │   └── jobs/           # Models, memory/redis stores & queues, worker pool
│       ├── tests/              # Pytest backend test suite & golden fixtures
│       └── Dockerfile          # Multi-stage non-root container definition
├── docs/                       # Master specification, design notes, progress, API docs
├── scripts/                    # youtube_smoke_test.py, bump_ytdlp.sh
└── docker-compose.yml          # Container composition (API + optional Redis)
```

---

## 4. Setup & Running Locally

### Prerequisites
- Node.js 20+ and npm 10+
- Python 3.12
- System `ffmpeg` installed (for YouTube and media transcoding)

### Quick Start (Development)

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/your-username/convert-it.git
   cd convert-it
   npm install
   ```

2. **Start Backend Service:**
   ```bash
   cd apps/api
   python3.12 -m venv .venv
   source .venv/bin/activate
   pip install -e ".[dev]"
   uvicorn app.main:app --reload --port 8000
   ```

3. **Start Frontend Web App:**
   ```bash
   # In root directory or apps/web
   cd apps/web
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 5. Docker Deployment

A multi-stage, non-root user Dockerfile is provided in `apps/api/Dockerfile`.

### Running with Docker Compose (In-Memory Queue)
```bash
docker compose up --build
```

### Running with Docker Compose (Redis Queue Profile)
```bash
docker compose --profile redis up --build
```

### Building with LibreOffice Support
To build the backend image with headless LibreOffice support for document conversions (.docx, .xlsx, .pptx to PDF):
```bash
docker build --build-arg INSTALL_LIBREOFFICE=true -t convertit-api apps/api
```

---

## 6. Environment Variables & Limits Reference

All environment variables are documented with defaults in `.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8000` | Backend port binding |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Strict CORS origin allowlist |
| `TMP_DIR` | `/tmp/convertit` | Ephemeral disk scratch directory (wiped on startup) |
| `ACCESS_CODE` | `""` | Optional shared passphrase required via `X-Access-Code` |
| `ENABLE_YOUTUBE` | `true` | Toggle YouTube downloader module |
| `QUEUE_BACKEND` | `memory` | Queue backend (`memory` or `redis`) |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL when using redis backend |
| `CONCURRENCY_HEAVY` | `1` | Max concurrent heavy conversions (LibreOffice, etc.) |
| `CONCURRENCY_YOUTUBE`| `2` | Max concurrent YouTube download jobs |
| `CONCURRENCY_LIGHT` | `2` | Max concurrent light jobs |
| `MAX_UPLOAD_MB` | `25` | Maximum upload limit for server document tools |
| `YT_MAX_DURATION_MIN`| `60` | Maximum YouTube video length in minutes |
| `YT_MAX_FILESIZE_MB` | `300`| Maximum YouTube downloaded file size |
| `YT_MAX_HEIGHT` | `1080` | Maximum allowed video resolution |
| `JOB_RESULT_TTL_MIN` | `15` | Retention time for output files before disk cleanup |

---

## 7. How to Add a New Tool

ConvertIt is designed to be easily extensible. Adding a new conversion tool requires only:

1. **Add Registry Entry (`apps/web/src/features/registry/tools.ts`):**
   ```typescript
   {
     id: 'my-new-tool',
     name: 'New Tool Name',
     description: 'Convert between new formats.',
     category: 'data',
     keywords: ['new', 'convert'],
     inputs: { extensions: ['ext'], mimeTypes: ['text/plain'], multiple: true },
     outputs: [{ value: 'out', label: 'OUT' }],
     options: [],
     engine: { kind: 'browser', id: 'my-new-engine' },
     limits: { maxFileSizeMB: 50 },
   }
   ```
2. **Implement Browser Engine (`apps/web/src/features/engines/`):**
   Create `myNewEngine.ts` implementing `BrowserEngine` interface (`run(files, options, targetFormat, context)`).
3. **Register Dynamic Loader in `apps/web/src/features/engines/registry.ts`:**
   Add `'my-new-engine': async () => (await import('./myNewEngine')).myNewEngine` to `ENGINE_LOADERS`.

No other application code or routing needs to change.

---

## 8. Operating & Testing yt-dlp

### Updating yt-dlp
YouTube frequently updates its internal player APIs. Keep yt-dlp updated to ensure continuous availability:
```bash
# Run automated bump script
./scripts/bump_ytdlp.sh
```

### Running the YouTube Smoke Test
Before deploying to a candidate host, verify that YouTube has not blocked the host IP and that extraction operates cleanly:
```bash
python scripts/youtube_smoke_test.py
```

---

## 9. Running Verification & Quality Gates

### Frontend Quality Checks
```bash
cd apps/web
npm run lint         # ESLint (zero warnings allowed)
npm run type-check   # TypeScript strict compilation
npm run test         # Vitest unit & component test suite (69 tests)
npm run test:e2e     # Playwright browser end-to-end suite (5 flows)
npm run build        # Production bundle build & code-split verification
```

### Backend Quality Checks
```bash
cd apps/api
.venv/bin/ruff check app tests          # Linter
.venv/bin/ruff format --check app tests # Code formatting check
.venv/bin/mypy app tests                # Strict static type checker
.venv/bin/pytest                        # Full integration & golden test suite (44 tests)
```

---

## 10. License

Made for personal use. Ad-free, tracking-free, and private-by-default.
See `docs/THIRD_PARTY.md` for full dependency inventory and licensing details.
