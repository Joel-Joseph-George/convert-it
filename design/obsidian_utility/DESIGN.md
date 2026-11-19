---
name: Obsidian Utility
colors:
  surface: '#151312'
  surface-dim: '#151312'
  surface-bright: '#3c3837'
  surface-container-lowest: '#100e0d'
  surface-container-low: '#1d1b1a'
  surface-container: '#221f1e'
  surface-container-high: '#2c2928'
  surface-container-highest: '#373433'
  on-surface: '#e8e1df'
  on-surface-variant: '#c6c5d5'
  inverse-surface: '#e8e1df'
  inverse-on-surface: '#33302e'
  outline: '#908f9e'
  outline-variant: '#454653'
  surface-tint: '#bdc2ff'
  primary: '#bdc2ff'
  on-primary: '#131e8c'
  primary-container: '#818cf8'
  on-primary-container: '#101b8a'
  inverse-primary: '#4953bc'
  secondary: '#cdc5c1'
  on-secondary: '#342f2d'
  secondary-container: '#4b4643'
  on-secondary-container: '#bbb3b0'
  tertiary: '#4ae176'
  on-tertiary: '#003915'
  tertiary-container: '#00ac4e'
  on-tertiary-container: '#003613'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#bdc2ff'
  on-primary-fixed: '#000767'
  on-primary-fixed-variant: '#2f3aa3'
  secondary-fixed: '#eae1dd'
  secondary-fixed-dim: '#cdc5c1'
  on-secondary-fixed: '#1f1b19'
  on-secondary-fixed-variant: '#4b4643'
  tertiary-fixed: '#6bff8f'
  tertiary-fixed-dim: '#4ae176'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005321'
  background: '#151312'
  on-background: '#e8e1df'
  surface-variant: '#373433'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  code:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system delivers an austere, tool-first utility experience modeled after developer-grade workflow software. Built for high-frequency conversion tasks, file processing, and immediate data manipulation, the interface prioritizes speed, spatial restraint, and zero visual friction.

The visual style merges dark-mode minimalism with structural precision:
- **Tone:** Engineered, silent, razor-sharp, and dependable.
- **Aesthetic:** Vercel- and Linear-inspired monochromatic substrate punctuated by a singular vibrant indigo accelerator. 
- **Principles:** Zero gradients, zero decorative illustrations, zero superfluous iconography. Every pixel is either interactive or structural.

## Colors

The palette relies on deep, warm-charcoal and obsidian grounds layered strictly through tonal shifts and micro-borders, punctuated by functional state accents.

### Palette Architecture
- **Background (`#0C0A09`):** The foundational ground layer. Deep, warm obsidian with neutral warmth.
- **Surface (`#171413`):** Canvas containers, inactive zones, and base card bodies.
- **Surface Container High (`#231F1D`):** Elevated segments, active states, hover fills, and nested wells.
- **Border (`#292524`):** Crisp 1px structural separator across all cards, inputs, and segment dividers.
- **Primary CTA / Accent (`#818CF8`):** High-energy indigo engineered for WCAG AA compliance against deep grounds. Reserved strictly for primary completion actions, selected states, and active focus rings.
- **Text Primary (`#FAFAF9`):** Pure contrast without stark terminal glare; applied to headlines, primary numbers, and form inputs.
- **Text Muted / Secondary (`#A8A29E`):** Warm stone gray for metadata, labels, shortcuts, and structural descriptions.
- **Functional Semantics:**
  - **Success:** `#22C55E` (indicators, completed conversions, valid uploads).
  - **Error:** `#EF4444` (destructive actions, failed operations, invalid states).
  - **Warning:** `#F59E0B` (file size cautions, rate limits, non-blocking notices).

## Typography

Typography relies entirely on the mechanical clarity of **Inter**, accented by an optional monospaced token (`JetBrains Mono`) for file sizes, conversion hashes, and raw data outputs.

- **Scale Philosophy:** Restrained step differences ensure visual unity without dramatic theatrical scale jumps.
- **Letter Spacing:** Tight tracking on display and heading sizes counters optical expansion on dark backdrops. Slight positive tracking on `label-sm` maintains legibility in all-caps format tags (e.g., `WEBP`, `PNG`, `MP4`).
- **Hierarchy:** Weight is kept strictly within 400 (Regular), 500 (Medium), and 600 (Semi-bold). Bold (700+) is deliberately excluded to prevent optical blooming against `#0C0A09`.

## Layout & Spacing

The layout is strictly centered with a maximum content boundary of **720px**, optimized for single-column command surfaces, drag-and-drop ingestion areas, and sequential task views.

### Structure
- **Shell:** Centered single-column fluid container capping at `max-width: 720px`. Extra viewport space on larger monitors remains neutral `#0C0A09`.
- **Rhythm Grid:** Strict 8px standard spacing increment (`0.5rem` = 8px, `1rem` = 16px, `1.5rem` = 24px, `2rem` = 32px), with `0.25rem` (4px) reserved exclusively for internal micro-alignments (e.g., icon-to-label gaps, badge paddings).
- **Responsive Adaptations:**
  - **Mobile (<640px):** 16px lateral padding (`margin: 1rem`). Full-width single-column execution. Elements stack vertically.
  - **Tablet (640px–1024px):** 24px lateral padding (`margin-tablet: 1.5rem`). Multi-step selectors can display side-by-side inside the 720px frame.
  - **Desktop (>1024px):** Fixed centered 720px column with top/bottom vertical spacing of 48px to 64px (`space-2xl`) creating a focused utility console.

## Elevation & Depth

This system intentionally eliminates traditional ambient dropped shadows and blurs. Spatial distinction is achieved purely through flat structural layering:

1. **Layer 0 (Canvas Base):** Ground color `#0C0A09`.
2. **Layer 1 (Card & Module Enclosures):** Surface `#171413` bounded by an uninterrupted `1px solid #292524`.
3. **Layer 2 (Interactive Inset / Elevated Containers):** Surface High `#231F1D` with `1px solid #292524` for internal trays, upload drop zones, and list rows.
4. **Interactive Focus:** Focus outlines use an unblurred `2px` ring of `#818CF8` with a `2px` offset rendered in `#0C0A09`.
5. **Drop Shadows:** Shadows are absent, except for floating context menus and command palettes, which use an ultra-crisp, directional shadow: `0 8px 24px rgba(0, 0, 0, 0.6)`.

## Shapes

The geometric framework balances approachable softness with high-density utility:

- **Cards, Panels & Large Inputs:** Fixed `12px` border radius (`rounded-lg`), grounding structural zones and drag-and-drop targets.
- **Buttons, Menus & Select Triggers:** Explicitly sized at `10px` border radius, creating an intentional, calibrated tier between outer containers (`12px`) and internal action triggers (`10px`).
- **Chips, Pills & Badges:** `6px` to `8px` corner radius or fully circular for status dots.
- **Borders:** Fixed `1px` uniform thickness across all perimeter boundaries.

## Components

### Buttons
- **Primary:** Background `#818CF8`, text `#0C0A09` (bold legibility), border `none`, radius `10px`. Hover: `#6366F1`. Active: `#4F46E5`.
- **Secondary / Default:** Background `#231F1D`, text `#FAFAF9`, border `1px solid #292524`, radius `10px`. Hover: Background `#2E2A27`, border `#3E3835`.
- **Destructive:** Background `transparent`, text `#EF4444`, border `1px solid rgba(239, 68, 68, 0.2)`, radius `10px`. Hover: Background `rgba(239, 68, 68, 0.1)`.
- **Sizes:** Default height `36px` (`padding: 0 14px`), Small height `28px` (`padding: 0 10px`).

### Cards & Dropzones
- **Standard Card:** Background `#171413`, border `1px solid #292524`, radius `12px`, padding `16px` or `24px`.
- **Upload / Dropzone Container:** Background `#171413`, border `1px dashed #292524`, radius `12px`, padding `32px`. Drag-over state shifts border to `1px solid #818CF8` and background to `#1C1917`.

### Input Fields & Selects
- **Inputs:** Background `#171413`, border `1px solid #292524`, text `#FAFAF9`, radius `12px`, height `40px`, padding `0 12px`.
- **Placeholder:** Text `#A8A29E`.
- **Focus:** Border color `#818CF8`, outline `2px solid rgba(129, 140, 248, 0.25)`.

### Chips & Format Badges
- **Format Chips (e.g., MP4, WEBP):** Background `#231F1D`, border `1px solid #292524`, text `#FAFAF9`, radius `6px`, typography `label-sm` (uppercase), padding `2px 6px`.
- **Active / Selected Chip:** Background `#818CF8`, text `#0C0A09`, border `1px solid #818CF8`.

### Lists & Conversion Queues
- **List Container:** Background `#171413`, border `1px solid #292524`, radius `12px`, divided by `1px solid #292524`.
- **Row Item:** Height `52px`, horizontal padding `16px`, layout `flex`, items aligned center. Hover state background `#231F1D`.
- **Progress Bar:** Track background `#231F1D` (height `4px`, radius `2px`), fill indicator `#818CF8` or `#22C55E` when complete.

### Checkboxes & Radios
- **Checkbox:** `16px x 16px`, radius `4px`, border `1px solid #292524`, background `#171413`. Checked: Background `#818CF8`, border `#818CF8`, checkmark icon in `#0C0A09`.
- **Radio:** `16px x 16px`, circular, border `1px solid #292524`, background `#171413`. Selected: Filled dot `#818CF8` with `#0C0A09` center inset.