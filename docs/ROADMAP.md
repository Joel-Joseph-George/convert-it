# ConvertIt: Project Status & Roadmap

> **Current Version:** `v0.1.0` (Initial Release — Phases 0 through 6 Complete)  
> **Repository:** [ConvertIt](https://github.com/Joel-Joseph-George/convert-it.git)  
> **Status:** All core functional requirements, browser/server engines, YouTube module, and test suites are built and verified.

---

## 1. What Has Been Completed (v0.1.0)

### 🎨 Design & User Experience
- [x] **Dual Theme System:** Full Obsidian Utility (Dark) and Utilitarian Precision (Light) themes matching Figma/Stitch specs with instant, non-flickering theme toggling.
- [x] **Zero Third-Party Assets:** 100% self-hosted typography via `@fontsource/inter` and `@fontsource/jetbrains-mono`. Zero external runtime CDN or Google Fonts requests.
- [x] **21 Design Views & Components:** Built pixel-perfect DropZone, CategoryChips, FormatPills, Dynamic OptionsPanel, FileQueue, FileRow, DataPreviewTable, EngineBadge, PrivacyLine, and StatusPill.
- [x] **Keyboard & Navigation:** Global `⌘K` / `Ctrl+K` quick-search trigger, 2px focus-visible rings on all interactive elements, and accessible tab flows.
- [x] **Accessibility Hardening:** `@media (prefers-reduced-motion: reduce)` support, explicit ARIA roles (`role="progressbar"`, `role="alert"`), and screen reader descriptors.

### ⚡ Client-Side Browser Engines
- [x] **Code-Split Engine Architecture:** Dynamic asynchronous loading reducing the initial web bundle by **75%** (down to 463 kB).
- [x] **Data Engine (SheetJS):** Bidirectional conversions between CSV, JSON, and XLSX with live table previewing.
- [x] **PDF Tools (pdf-lib & pdfjs-dist):** Merge PDF, extract PDF pages, render PDF to PNG/JPEG, images to PDF, with canvas-based preview rendering.
- [x] **Audio & Video (ffmpeg.wasm):** WebAssembly FFmpeg single-threaded runner with local vendor asset hosting for transcode, container conversion, and bitrate selection.
- [x] **Image Tools:** Canvas-based JPEG, PNG, WebP converters with quality sliders, and `heic2any` decoder for Apple HEIC photos.
- [x] **Text Tools:** Markdown to HTML (`marked`) and HTML to Markdown (`turndown`).
- [x] **Batch Archiving:** In-browser client ZIP generation via `fflate` for multi-file downloads.

### 🎥 YouTube Downloader Module
- [x] **Strict SSRF / Host Allowlist:** Validates URLs, upgrades to HTTPS, strips userinfo, rejects non-YouTube domains and playlist/channel injections.
- [x] **Metadata & Stream Extraction:** Asynchronous extraction of video details, duration caps, view counts, and available resolution profiles up to 1080p.
- [x] **Staged Transcoding & Audio Extraction:** Downloads via `yt-dlp` (0–85%), transcodes via FFmpeg to MP3, M4A, OPUS, or WAV (85–100%), with optional thumbnail embedding and metadata tagging.
- [x] **Time Trimming:** Precise start/end time trimming (`trimStart`, `trimEnd`) during download.
- [x] **Sanitized Error Mapping:** Transparent user-facing error cards (e.g. `UPSTREAM_BLOCKED`, `AGE_RESTRICTED`, `VIDEO_TOO_LONG`, `LIVE_NOT_SUPPORTED`).
- [x] **Feature Gating:** Clean, complete removal of YouTube UI and API routes when `ENABLE_YOUTUBE=false`.

### 🖥️ Ephemeral Backend & Server Tools
- [x] **FastAPI Core:** Python 3.12 service with structured JSON logging (`structlog`), unified error envelope, and request ID tracking.
- [x] **Admission Control & Rate Limiting:** Per-IP sliding-window rate limiter, active job limits, and PSUTIL memory guard for heavy conversions.
- [x] **Multi-Backend Queueing:** Support for in-memory asyncio worker pools (default) and Redis queues (`fakeredis` supported).
- [x] **Ephemeral Disk Cleaner:** Automated disk wiper on startup; completed files deleted 60 seconds after first download or at 15-minute TTL.
- [x] **Server Document Tools:**
  - `pdf2docx`: PDF to Word `.docx` with layout reconstruction.
  - `pdfplumber` + `openpyxl`: Multi-sheet PDF to Excel table extractor with scanned-PDF detection returning `NO_TABLES_FOUND`.
  - LibreOffice Headless: Isolated user installation profiles (`-env:UserInstallation`) to prevent concurrency locks, with SIGTERM process group termination on timeout.
- [x] **Multi-Stage Dockerfile:** Non-root user (`appuser:10001`), lightweight base, with `ARG INSTALL_LIBREOFFICE=true|false`.

### 🧪 Verification & Testing
- [x] **Frontend Unit & Component Tests:** 19 test suites, 69 tests passing in Vitest.
- [x] **E2E Browser Tests:** 5 Playwright end-to-end flows passing (Invalid URL handling, Search & Filter, Browser Conversion, Theme persistence, Mobile layout).
- [x] **Backend Integration Tests:** 44 Pytest tests passing (API lifecycle, golden fixtures, memory & Redis queues, SSE events).
- [x] **Security Audits:** 0 known vulnerabilities via `pip-audit`.

---

## 2. Immediate Next Steps (Deployment & Setup)

These items depend on final production infrastructure choices (per Section 16 of the specification):

- [ ] **Hosting Provider Selection:** Choose hosting destination for the API container (e.g., Fly.io, Railway, Render, Hetzner, or a personal VPS).
- [ ] **Domain & CORS Configuration:**
  - Set production domain in `ALLOWED_ORIGINS` (the API strictly refuses to start if `ALLOWED_ORIGINS` contains `*` or is empty in production).
  - Set `VITE_API_BASE_URL` in frontend production environment.
- [ ] **Optional Access Code Configuration:**
  - Set `ACCESS_CODE` in `.env` if lightweight passphrase protection is desired for private personal hosting.
- [ ] **Candidate Host Smoke Test:**
  - Run `python scripts/youtube_smoke_test.py` on the target server to verify that the host IP is not flagged by YouTube bot detection.
- [ ] **LibreOffice Host Decision:**
  - Decide whether the production host has sufficient RAM/disk to run LibreOffice (`INSTALL_LIBREOFFICE=true` requires ~350MB extra disk and at least 512MB RAM).

---

## 3. Polish & Enhancement Backlog (Future Releases)

### 🏎️ Performance & Architecture
- [ ] **Web Worker Offloading for FFmpeg & HEIC:**
  - *Current:* Conversions run in asynchronous tasks on the main browser thread.
  - *Enhancement:* Move heavy WebAssembly FFmpeg encoding and `heic2any` decoding into dedicated Web Workers (`apps/web/src/workers/`) so long renders never introduce minor frame drops.
- [ ] **Streaming ZIP Downloads:**
  - For large batches (10+ files or >100MB total), use chunked streaming ZIP construction to minimize client memory consumption before saving.

### ✨ User Interface & Interactions
- [ ] **Visual Page Reordering for PDF Tools:**
  - Add drag-and-drop reordering for `merge-pdf` and `images-to-pdf` file queues before clicking Convert.
- [ ] **Audio Waveform Preview:**
  - Add a lightweight visual audio waveform scrubber for YouTube audio trimming (`trimStart` / `trimEnd`) before starting the download.
- [ ] **Keyboard Shortcut Modal:**
  - Surface a small `?` shortcut helper modal displaying navigation shortcuts (`⌘K` for search, `Esc` to clear, `Space` on DropZone).

### 📄 Document & OCR Enhancements
- [x] **Chat with PDF.** Search selectable text on-device and stream answers from Ollama with clickable page citations. The browser caches document indexes by file hash. The API admits each stream as a light job.
- [ ] **Optional Client/Server OCR for Scanned PDFs:**
  - When a PDF fails with `NO_TABLES_FOUND`, offer an optional OCR pass (e.g., Tesseract.js in the browser or server-side OCR) to extract text and tables from image-only scans.
- [ ] **EPUB & E-Book Converters:**
  - Add EPUB to PDF / EPUB to Markdown tools using lightweight browser parsers.

### 📱 Progressive Web App (PWA)
- [ ] **Service Worker Offline Mode:**
  - Register a Service Worker with CacheStorage so all browser-based conversion tools (Image, Data, PDF, Text) work 100% offline without an active internet connection.
- [ ] **Web App Manifest:**
  - Add `manifest.webmanifest` and installable icons so ConvertIt can be installed as a standalone desktop/mobile app.

---

## 4. Maintenance Checklist

| Task | Frequency | Command / Procedure |
|---|---|---|
| **Update yt-dlp** | Weekly / Bi-weekly | `./scripts/bump_ytdlp.sh && pytest` |
| **Audit Python Dependencies** | Monthly | `cd apps/api && pip-audit` |
| **Audit Node Dependencies** | Monthly | `npm audit` |
| **Run E2E Flows** | Prior to release | `cd apps/web && npm run test:e2e` |
| **Verify YouTube Smoke Test** | When host changes | `python scripts/youtube_smoke_test.py` |
