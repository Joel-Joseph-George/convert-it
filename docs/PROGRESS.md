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
- Real media transcoding / browser WASM conversions (mock/fake progress used in Phase 1; real WebAssembly engines will be implemented in Phase 2).

---
*Ready for Phase 2 review upon user command to continue.*
