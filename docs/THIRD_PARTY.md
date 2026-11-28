# Third-Party Dependencies and Licenses

This document tracks all third-party libraries, tools, and dependencies used across ConvertIt, along with their versions and licenses.

---

## 1. Frontend (`apps/web`)

### Runtime Dependencies

| Package | Version | License | Purpose |
|---|---|---|---|
| `react` | `^19.0.0` | MIT | UI library core |
| `react-dom` | `^19.0.0` | MIT | React DOM renderer |
| `@tanstack/react-router` | `^1.114.0` | MIT | File-based client-side routing |
| `@tanstack/react-query` | `^5.66.0` | MIT | Asynchronous server state and data fetching |
| `zustand` | `^5.0.3` | MIT | Lightweight client-side state management |
| `lucide-react` | `^0.475.0` | ISC | Monoline iconography |
| `@fontsource/inter` | `^5.1.0` | OFL-1.1 | Self-hosted Inter font families (400, 500, 600) |
| `@fontsource/jetbrains-mono` | `^5.1.0` | OFL-1.1 | Self-hosted JetBrains Mono font family (400, 500) |
| `clsx` | `^2.1.1` | MIT | Utility for constructing conditional class names |
| `tailwind-merge` | `^3.0.1` | MIT | Utility to safely merge Tailwind CSS classes |
| `class-variance-authority` | `^0.7.1` | Apache-2.0 | Type-safe component variant styling |
| `@radix-ui/react-slot` | `^1.1.2` | MIT | Polymorphic component primitive (`asChild`) |
| `@radix-ui/react-dialog` | `^1.1.6` | MIT | Accessible modal dialog primitives |
| `@radix-ui/react-dropdown-menu` | `^2.1.6` | MIT | Accessible menu and popover primitives |
| `@radix-ui/react-tooltip` | `^1.1.8` | MIT | Accessible tooltip primitives |
| `pdf-lib` | `^1.17.1` | MIT | PDF manipulation (merge, split, rotate, remove, bundle) |
| `pdfjs-dist` | `^6.5.438` | Apache-2.0 | PDF rendering to images and raw text extraction |
| `@huggingface/transformers` | `^4.3.2` | Apache-2.0 | Local tokenizer and embedding pipeline |
| Xenova/all-MiniLM-L6-v2 | `751bff3` | Apache-2.0 | Self-hosted quantized ONNX weights for document retrieval. [Model card](https://huggingface.co/Xenova/all-MiniLM-L6-v2) |
| `xlsx` (SheetJS CDN build) | `0.20.3` | Apache-2.0 | Tabular data conversions (Excel, CSV, JSON) |
| `fflate` | `^0.8.3` | MIT | High-performance client-side ZIP compression |
| `marked` | `^18.2.1` | MIT | Markdown to HTML compiler |
| `turndown` | `^7.2.5` | MIT | HTML to Markdown converter |
| `heic2any` | `^0.0.4` | MIT | Apple HEIC/HEIF to JPEG/PNG decoding |
| `@ffmpeg/ffmpeg` | `^0.12.15` | MIT | WebAssembly FFmpeg runner for browser audio/video |
| `@ffmpeg/util` | `^0.12.2` | MIT | FFmpeg utilities for file fetching and memory management |
| `@ffmpeg/core` | `^0.12.10` | GPL-2.0-or-later | Single-threaded FFmpeg WebAssembly core binary |
| `tesseract.js` (+ `tesseract.js-core`) | `7.0.0` | Apache-2.0 | OCR PDF: text recognition in a Web Worker |
| `@tesseract.js-data/eng` | `1.0.0` | MIT (package), Apache-2.0 (tessdata_best `eng.traineddata`) | English recognition data, self-hosted |
| `@neslinesli93/qpdf-wasm` | `0.3.1` | ISC (package), Apache-2.0 (qpdf 12) | Protect / Unlock PDF (AES-256 encryption) |
| `exifr` | `7.1.3` | MIT | Reads EXIF/GPS for the metadata preview |
| `@fontsource/dancing-script` | `5.3.0` | OFL-1.1 | Handwriting font for typed signatures |
| Xenova/modnet | `fa2fa54` | Apache-2.0 | Self-hosted portrait matting ONNX model for Remove background. [Model card](https://huggingface.co/Xenova/modnet) |

### Development Dependencies

| Package | Version | License | Purpose |
|---|---|---|---|
| `vite` | `^6.1.0` | MIT | Frontend build tool and development server |
| `@vitejs/plugin-react` | `^4.3.4` | MIT | Vite plugin for React and Fast Refresh |
| `@tanstack/router-plugin` | `^1.114.0` | MIT | Vite code generator plugin for TanStack Router |
| `typescript` | `^5.7.3` | Apache-2.0 | Static type checker |
| `tailwindcss` | `^3.4.17` | MIT | Utility-first CSS framework |
| `postcss` | `^8.5.2` | MIT | CSS transformations tool |
| `autoprefixer` | `^10.4.20` | MIT | PostCSS vendor prefixing |
| `tailwindcss-animate` | `^1.0.7` | MIT | Tailwind CSS animation utilities |
| `eslint` | `^9.20.1` | MIT | JavaScript and TypeScript linter |
| `typescript-eslint` | `^8.24.0` | MIT | Tooling for ESLint with TypeScript |
| `eslint-plugin-react-hooks` | `^5.1.0` | MIT | React hooks linting rules |
| `eslint-plugin-react-refresh` | `^0.4.19` | MIT | Fast refresh linting rules |
| `prettier` | `^3.5.0` | MIT | Opinionated code formatter |
| `vitest` | `^3.0.5` | MIT | Unit and component testing framework |
| `@testing-library/react` | `^16.2.0` | MIT | React component testing utilities |
| `@testing-library/jest-dom` | `^6.6.3` | MIT | Custom DOM element matchers for Vitest |
| `jsdom` | `^26.0.0` | MIT | Pure JavaScript DOM implementation for testing |
| `@types/turndown` | `^5.0.6` | MIT | TypeScript type definitions for Turndown |

---

## 2. Backend (`apps/api`)

### Runtime Dependencies

| Package | Version | License | Purpose |
|---|---|---|---|
| `fastapi` | `>=0.115.0` | MIT | Modern, high-performance web framework |
| `uvicorn` | `>=0.34.0` | BSD-3-Clause | ASGI web server implementation |
| `pydantic` | `>=2.10.0` | MIT | Data validation and settings management |
| `pydantic-settings` | `>=2.7.0` | MIT | Settings configuration from environment variables |
| `structlog` | `>=25.1.0` | Apache-2.0 / MIT | Structured JSON logging |
| `psutil` | `>=6.1.1` | BSD-3-Clause | Process and system monitoring (RAM guard) |
| `filetype` | `>=1.2.0` | MIT | File type identification via magic numbers |
| `httpx` | `>=0.28.1` | BSD-3-Clause | HTTP client for asynchronous requests |
| `openai` | `>=2,<3` | Apache-2.0 | Async streaming client for Gemini's compatible endpoint |
| `python-multipart` | `>=0.0.20` | Apache-2.0 | Multipart form-data streaming parsing for FastAPI |
| `redis` | `>=5.0.0` | MIT | Async Redis client for state and queues |
| `yt-dlp` | `>=2025.1.1` | Unlicense | YouTube metadata extraction and video/audio download |
| `pdf2docx` | `>=0.5.8` | GPL-3.0 | PDF to Microsoft Word (.docx) document conversion |
| `pdfplumber` | `>=0.11.0` | MIT | PDF table extraction and structural analysis |
| `openpyxl` | `>=3.1.0` | MIT | Excel spreadsheet generation and multi-sheet workbook export |

### Development Dependencies

| Package | Version | License | Purpose |
|---|---|---|---|
| `pytest` | `>=8.3.4` | MIT | Python testing framework |
| `pytest-asyncio` | `>=0.25.3` | Apache-2.0 | Asyncio support for pytest |
| `fakeredis` | `>=2.27.0` | BSD-3-Clause | In-memory Redis simulation for tests |
| `ruff` | `>=0.9.6` | MIT / Apache-2.0 | Extremely fast Python linter and formatter |
| `mypy` | `>=1.15.0` | MIT | Strict static type checker for Python |
| `types-psutil` | `>=6.1.0` | Apache-2.0 | Type stubs for psutil |
