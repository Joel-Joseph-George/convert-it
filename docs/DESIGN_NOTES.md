# ConvertIt: Design Notes & Specification Analysis

This document compiles the design tokens, screen-to-component mappings, and discrepancies identified from reviewing `docs/ANTIGRAVITY_PROMPT.md`, `design/README.md`, both `DESIGN.md` specifications (`design/utilitarian_precision/DESIGN.md` and `design/obsidian_utility/DESIGN.md`), and all screen designs in `design/`.

---

## 1. Design Tokens & Theme Values

Following Section 4.1 of `docs/ANTIGRAVITY_PROMPT.md`, we use the prose "Theme Values" hex codes from the design specifications (ignoring the front-matter Material tokens). These are mapped to CSS variables in `styles/tokens.css` with `:root` for light mode and `.dark` for dark mode.

### 1.1 Color Tokens

| Token | CSS Variable | Light (`utilitarian_precision`) | Dark (`obsidian_utility`) | Usage |
|---|---|---|---|---|
| **Canvas Background** | `--background` | `#FAFAF9` (Stone 50) | `#0C0A09` (Stone 950) | Main page background |
| **Surface / Card** | `--card` / `--surface` | `#FFFFFF` | `#171413` | Tool cards, dropzones, containers |
| **Elevated / Hover Fill** | `--muted` / `--surface-hover` | `#F5F5F4` (Stone 100) | `#231F1D` | Hover states, queue rows, active segments |
| **Border / Divider** | `--border` | `#E7E5E4` (Stone 200) | `#292524` (Stone 800) | 1px hairline borders, card outlines |
| **Dashed Dropzone Border** | `--border-dashed` | `#D6D3D1` (Stone 300) | `#44403C` (Stone 700) | Empty dropzone dashed outline |
| **Text Primary** | `--foreground` | `#1C1917` (Stone 900) | `#FAFAF9` (Stone 50) | Headings, primary labels, inputs |
| **Text Muted** | `--muted-foreground` | `#78716C` (Stone 500) | `#A8A29E` (Stone 400) | Descriptions, metadata, secondary copy |
| **Accent / Interactive** | `--primary` / `--accent` | `#4F46E5` (Indigo 600) | `#818CF8` (Indigo 400) | Primary buttons, active tabs, focus ring |
| **Accent Hover** | `--primary-hover` | `#4338CA` (Indigo 700) | `#6366F1` (Indigo 500) | Primary button hover |
| **Text on Accent** | `--primary-foreground` | `#FFFFFF` | `#0C0A09` | Text/icons inside primary buttons |
| **Success** | `--success` | `#16A34A` (Green 600) | `#22C55E` (Green 500) | Completed state pills, finished progress |
| **Warning** | `--warning` | `#D97706` (Amber 600) | `#F59E0B` (Amber 500) | Limit warnings, quota cautions |
| **Error / Destructive** | `--destructive` | `#DC2626` (Red 600) | `#EF4444` (Red 500) | Error banners, invalid states |
| **Focus Ring** | `--ring` | `#4F46E5` | `#818CF8` | 2px solid accent outline with 2px offset |

### 1.2 Typography

- **Primary Font:** Inter (weights 400 Regular, 500 Medium, 600 Semi-Bold only; strictly never 700+ to prevent blooming/noise).
- **Monospace Font:** JetBrains Mono (file sizes, speeds, durations, hashes, code).
- **Letter Spacing (Tracking):**
  - Tight tracking (`-0.01em` to `-0.025em`) on sizes 20px and above.
  - Neutral or slight positive tracking (`0.01em`) on small labels (11px–12px).
- **Hosting:** Self-hosted via `@fontsource/inter` and `@fontsource/jetbrains-mono` (zero runtime CDN calls).

### 1.3 Geometry & Radii

- **Cards, Panels & Large Containers:** `12px` (`0.75rem`, `rounded-xl`)
- **Inputs & Dropzones:** `12px` (`0.75rem`)
- **Buttons & Interactive Action Triggers:** `10px` (`rounded-[10px]`)
- **Format Chips & Badges:** `6px` (`rounded-[6px]`)
- **Status Pills:** Fully rounded (`9999px`, `rounded-full`)
- **Borders:** Crisp uniform 1px solid hairline (no decorative drop shadows)
- **Drop Shadows:** Floating popovers/menus only (`0 4px 12px rgba(0,0,0,0.05)` light / `0 8px 24px rgba(0,0,0,0.6)` dark)

### 1.4 Layout & Spacing

- **Base Grid:** 8px standard rhythm (with 4px for micro-alignments).
- **Max Content Width:** Centered container locked at `720px` (All Tools grid expands up to `960px`).
- **Button Heights:** 40px standard desktop height, 32px for small buttons; minimum 44px tap targets on mobile.
- **Progress Bar:** 4px track height, solid accent fill (green on completion), linear transition on width, zero shimmer.

---

## 2. Screen-to-Component & Route Mapping

| Design Folder / Screen | Target Route | Core Components | Responsibilities |
|---|---|---|---|
| `convertit_home_updated_popular_tools` / `convertit_home_dark_mode` | `/` | `TopBar`, `UrlInput`, `DropZone` (compact), `PopularToolsStrip`, `FeatureCallout`, `Footer` | Main landing page: YouTube input bar + quick dropzone + popular tools strip + privacy note. |
| `convertit_youtube_loading_state`, `convertit_youtube_result`, `convertit_youtube_result_dark_mode` | `/` (conditional card) | `YouTubeResultCard`, `MediaPreview`, `FormatSelector`, `QualitySelector`, `AdvancedOptionsPanel` | Result card rendered on home below input when a valid link is submitted. |
| `convertit_download_server_states` | `/` and `/tools/$toolId` | `ProgressBar`, `StatusPill`, `ServerWakeBanner`, `JobDownloadCard` | Ingestion, conversion progress, done state, and "Waking up server" notice. |
| `convertit_error_edge_case_states` | Shared across routes | `ErrorAlert` | Inline alert cards for client errors, server limits, upstream blocks, offline states. |
| `convertit_all_tools_desktop`, `convertit_all_tools_mobile` | `/tools` | `ToolSearch`, `CategoryChips`, `ToolGrid`, `ToolCard`, `EmptyState` | Directory of all available tools with instant client fuzzy search and category filtering. |
| `convertit_audio_converter_empty`, `convertit_audio_converter_files_added`, `_dark_mode` | `/tools/$toolId` | `DropZone`, `FormatPills`, `OptionsPanel`, `FileQueue`, `FileRow`, `EngineBadge`, `PrivacyLine` | The single shared tool page template for all converters (Audio, Video, Image, Data, PDF, Text). |
| `convertit_image_converter` | `/tools/image-convert` | Shared tool page template with image options (quality slider, dimensions, strip metadata). |
| `convertit_data_converter` | `/tools/excel-to-csv`, etc. | Shared tool page template with table preview (first 5 rows) and delimiter/sheet options. |
| `convertit_pdf_to_excel_in_browser`, `_server_processed` | `/tools/pdf-to-excel` | Shared tool page template showing dynamic engine badge ("In your browser" vs "Server") and privacy disclaimer. |
| `convertit_mobile_*` | All routes (<768px viewport) | Responsive layouts of above components with 16px lateral padding and vertical stacking. |

---

## 3. Discrepancies & Conflicts Found

| Area | Observation in Design / HTML | Specification (`docs/ANTIGRAVITY_PROMPT.md`) | Resolution |
|---|---|---|---|
| **Frontend Framework** | `design/README.md` mentions "Rebuild every screen as Vue components". | Section 2 explicitly mandates **React + TypeScript + Vite**. | Build as **React + TypeScript (strict) + Vite**, as mandated by the master specification. |
| **Top Bar Navigation** | Several HTML screens display category tabs (`YouTube`, `Audio`, `Video`, `Image`, `Documents`, `Data`) and a user profile avatar button in the header. | Section 4.2 states: "Top bar: wordmark **ConvertIt** ('Convert' in text colour, 'It' in accent), 'All tools' link, search icon, theme toggle. No login, no pricing, no category links." Section 0 states: "No accounts...". | Implement clean, minimal top bar containing **only**: Wordmark, "All tools" link, search trigger button, and `ThemeToggle`. No category links, no user avatar. |
| **Mobile Navigation Bar** | Screens `convertit_mobile_home` and `convertit_all_tools_mobile` show bottom navigation bars with 5–6 tab items. | Spec mandates a clean, minimal personal utility with no accounts and single-column responsive flow. Bottom tab bar is not part of the core specification routes (`/` and `/tools`). | Keep mobile navigation aligned with the desktop shell: TopBar with wordmark, search, All Tools, and theme toggle. Responsive header handles mobile navigation cleanly without fake authentication or phantom tabs. |
| **Button Heights** | Light `DESIGN.md` states 40px; Dark `DESIGN.md` states 36px. | Section 4.1 explicitly says: "the light file says 40px, the dark file says 36px: **use 40px** everywhere, 32px for 'small'". | Standardize on **40px** height (`h-10`) for regular buttons, **32px** (`h-8`) for small buttons, with 44px min tap targets on mobile touch. |
| **Home Screen Reference** | `design/` contains both `OLD_convertit_home` and `convertit_home_updated_popular_tools`. | Section 4.2 explicitly instructs: "(current home; **ignore** `OLD_convertit_home`)". | Follow `convertit_home_updated_popular_tools` as the canonical home design. |
| **Material vs Theme Tokens** | Front-matter in both `DESIGN.md` contains Material 3 tokens (e.g. `surface-container-low: #faf2ee`). | Section 4.1 explicitly instructs: "Use the prose 'Theme Values' hex codes... Ignore the front-matter Material tokens." | Strictly use the prose Theme Values hex codes for all tokens and CSS variables. |
| **Footer Links** | Some mockups contain links like "Privacy", "Codecs", "Settings", or "Utilitarian • Private • Lossless". | Section 4.2 states: "Footer: one muted line plus a GitHub icon link. Footer says 'Made for personal use'." | Footer displays "Made for personal use" + muted attribution + GitHub icon link. |

---

## 4. Phase 0 Shell Component Structure

In Phase 0, we scaffold the monorepo and implement the foundation shell:
- `tokens.css`: Complete light and dark CSS variable definitions matching Section 1.1.
- `globals.css`: Base typography, resets, focus-visible outlines (`2px` accent with `2px` offset), and antialiasing.
- `TopBar`: Brand wordmark (`Convert` in text color, `It` in accent), "All tools" link with active state indicator, search dialog trigger, and `ThemeToggle`.
- `Footer`: Minimal footer with "Made for personal use" and GitHub repository link.
- `ThemeToggle`: Sun/moon toggle switching `.dark` class on `document.documentElement` and persisting to `localStorage`.
- Router configuration (`/`, `/tools`, and 404 `NotFound`).
- CI workflows and strict linter/formatter configurations across frontend (`web`) and backend (`api`).
