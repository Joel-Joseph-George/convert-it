# ConvertIt: Project Status & Roadmap

> **Current Version:** `v0.2.0` (Image Editor, Chat with PDF, tool testing round)  
> **Repository:** [ConvertIt](https://github.com/Joel-Joseph-George/convert-it.git)  
> **Status:** Deployed (web on Vercel, API on Render). All 32 tools were tested in November 2026; the bugs found are fixed. The YouTube downloader is kept but is no longer the home page focus, because YouTube blocks hosted servers (#1).

---

## 1. What Has Been Completed

### v0.2.0 (November 2026)

- [x] **Image Editor & home page revamp** (#21): the home page now leads with a photo drop target. The editor crops (free and 1:1, 4:5, 3:2, 16:9, 9:16), makes passport photos for six countries with a face guide and 6×4 in print sheet, rotates, flips, resizes, and exports JPG/PNG/WebP to a target KB size. Fully in the browser. Covers most of #18.
- [x] **YouTube downloader moved to `/tools/youtube`** and listed in All tools, so work on it can continue without blocking the home page.
- [x] **Chat with PDF** (#2, #3): on-device search with a MiniLM embedding worker and IndexedDB cache, Gemini answers with clickable page citations.
- [x] **Tool testing round & fixes** (#22): automated checks of every tool with generated files, checking actual output contents. Fixed: compression levels ignored and compressed files growing, SVG to PNG failing, AVIF output mislabelled, PDF to images never finishing (#5), split range and image fit ignored, WebP in Images to PDF (#6), CSV/Excel to JSON options ignored, PDF to Excel CSV/mode ignored, LibreOffice outputs named `input.pdf`, GIFs upscaled, ffmpeg.wasm hanging on the dev server, empty conversions spinning forever.
- [x] **Chat reliability:** Gemini errors are logged with the provider's message and mapped to specific messages (bad key, missing model, region, rejected request). A broken cached embedding model is detected, cleared and re-downloaded automatically, and **Clear stored data** now also clears it.

### v0.1.0 (initial release)

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
- [x] **Frontend Unit & Component Tests:** 93 Vitest tests (69 at v0.1.0).
- [x] **E2E Browser Tests:** 7 Playwright flows: home → image editor, YouTube invalid URL, search & filter, browser conversion, theme persistence, mobile layout, Chat with PDF.
- [x] **Backend Integration Tests:** 105 Pytest tests (44 at v0.1.0), including chat provider error mapping and PDF to Excel CSV.
- [x] **Security Audits:** 0 known vulnerabilities via `pip-audit`.

---

## 2. Immediate Next Steps

### Open bugs and chores (GitHub issues)
- [ ] **#1** YouTube downloads blocked on Render (bot check). Needs cookies or a proxy; see `apps/api/README.md`.
- [ ] **#7** ffmpeg.wasm: progress goes to the wrong file, cancel doesn't stop, duplicate instances.
- [ ] **#8** Queue: removed items still convert, retry double-converts, ZIP name collisions.
- [ ] **#9** API: failed upload raises `UnboundLocalError` instead of a clean error.
- [ ] **#10** Rate limits treat every user as one IP behind Render's proxy (`TRUSTED_PROXY_HOPS`).
- [ ] **#11** Error buttons do nothing on tool pages; server health never re-checks.
- [ ] **#13** Access code can't be entered in the UI. **#12** Cache `/vendor` assets on Vercel. **#14** Replace `xlsx@0.18.5`. **#15** Repo hygiene.

### Manual test checklist (not covered by the automated round)
- [ ] HEIC to JPG with a real iPhone photo.
- [ ] PowerPoint to PDF with a real `.pptx`.
- [ ] YouTube downloader on the deployed API.
- [ ] Chat with PDF end to end on the deployed site, after setting a valid `GEMINI_API_KEY`.
- [ ] Image editor and converters on Safari (macOS and iOS) and Android Chrome.

### Deployment & setup

- [x] **Hosting Provider Selection:** API on Render, web app on Vercel.
- [x] **Domain & CORS Configuration:** `ALLOWED_ORIGINS` and `VITE_API_BASE_URL` are set for the Vercel and Render deployments.
- [ ] **Optional Access Code Configuration:**
  - Set `ACCESS_CODE` in `.env` if lightweight passphrase protection is desired for private personal hosting.
- [ ] **Candidate Host Smoke Test:**
  - Run `python scripts/youtube_smoke_test.py` on the target server to verify that the host IP is not flagged by YouTube bot detection.
- [x] **LibreOffice Host Decision:** enabled on Render; Word and Excel to PDF were verified against the live API.

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
- [x] **Chat with PDF.** Search selectable text on-device and stream answers from Gemini with clickable page citations. The browser caches document indexes by file hash. The API admits each stream as a light job.
- [ ] **More image tools (#18):** background removal and an EXIF viewer/stripper. Crop, resize and compress-to-size shipped in the Image Editor.
- [ ] **More PDF tools (#17):** compress, reorder, OCR, sign.
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
