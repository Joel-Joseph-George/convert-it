---
name: Utilitarian Precision
colors:
  surface: '#fff8f5'
  surface-dim: '#e0d8d5'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#faf2ee'
  surface-container: '#f4ece8'
  surface-container-high: '#eee7e3'
  surface-container-highest: '#e9e1dd'
  on-surface: '#1e1b19'
  on-surface-variant: '#464555'
  inverse-surface: '#33302d'
  inverse-on-surface: '#f7efeb'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#645d58'
  on-secondary: '#ffffff'
  secondary-container: '#eae1da'
  on-secondary-container: '#6a635e'
  tertiary: '#7e3000'
  on-tertiary: '#ffffff'
  tertiary-container: '#a44100'
  on-tertiary-container: '#ffd2be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#eae1da'
  secondary-fixed-dim: '#cec5bf'
  on-secondary-fixed: '#1f1b17'
  on-secondary-fixed-variant: '#4b4641'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#fff8f5'
  on-background: '#1e1b19'
  surface-variant: '#e9e1dd'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an uncompromising, quiet, and hyper-focused personal utility tool. The product exists to complete immediate, functional tasks—extracting media, transcoding audio/video, transforming tabular data, and converting documents—without distraction, friction, or visual noise.

### Brand Personality & Tone
- **Calm & Utilitarian:** Direct, silent efficiency. No marketing speak, zero promotional banners, and no unsolicited interactions.
- **Restrained & Precise:** Influenced by developer-first platforms like Linear and Vercel. Form follows pure function with meticulous balance, hairline borders, and generous breathing room.
- **Transparent & Trustworthy:** Communicates state (queued, processing, ready, failed) with instantaneous clarity. Tone of voice is plain, short, lowercase-leaning or sentence-cased, and completely devoid of artificial excitement.

### Design Movement
- **Modern Minimalist & Utilitarian Functionalism:** Built on strict spatial alignment, monoline iconography, flat functional surfaces, and low-contrast borders instead of layered drop shadows. Zero decorative gradients, no stock illustrations, and no decorative bloat.

## Colors

The palette relies on warm, stone-tinted neutrals to maintain a soft, human feel while preserving technical clarity. High-saturation accents are strictly reserved for primary actions, focus rings, and deterministic status indicators.

### Theme Values

#### Light Mode (Default)
- **Canvas Background:** `#FAFAF9` (Stone 50)
- **Surface / Card Background:** `#FFFFFF`
- **Border / Divider:** `#E7E5E4` (Stone 200)
- **Primary Text:** `#1C1917` (Stone 900)
- **Muted / Secondary Text:** `#78716C` (Stone 500)
- **Accent / Interactive:** `#4F46E5` (Indigo 600)
- **Accent Hover:** `#4338CA` (Indigo 700)
- **Success:** `#16A34A` (Green 600)
- **Warning:** `#D97706` (Amber 600)
- **Destructive / Error:** `#DC2626` (Red 600)

#### Dark Mode
- **Canvas Background:** `#0C0A09` (Stone 950)
- **Surface / Card Background:** `#171413`
- **Border / Divider:** `#292524` (Stone 800)
- **Primary Text:** `#FAFAF9` (Stone 50)
- **Muted / Secondary Text:** `#A8A29E` (Stone 400)
- **Accent / Interactive:** `#818CF8` (Indigo 400)
- **Accent Hover:** `#6366F1` (Indigo 500)
- **Success:** `#22C55E` (Green 500)
- **Warning:** `#F59E0B` (Amber 500)
- **Destructive / Error:** `#EF4444` (Red 500)

### Usage Guidelines
- Apply the accent color only to primary trigger buttons, active segmented control states, and active input borders. 
- Never tint canvas backgrounds with primary accents; surfaces must remain neutral.
- Error, warning, and success colors should appear solely on status pills, inline validation notices, and progress indicators.

## Typography

The typography scale is compact and strictly disciplined. System sans / Inter provides clarity at every size, prioritizing rapid scannability over decorative expression.

### Rules & Hierarchy
- **Weights:** Strictly bifurcated into 600 for headings/key titles, 500 for interactive labels/badges, and 400 for running text and descriptions.
- **Tracking:** Negative letter spacing applied to sizes 20px and above (`-0.01em` to `-0.02em`) creates a tight, unified headline rhythm. Smaller labels (12px) utilize neutral or slight positive tracking (`0.01em`) for immediate readability.
- **Line Heights:** Generous relative line heights ensure that instructions, file metadata, and conversion logs never feel compressed or claustrophobic.

## Layout & Spacing

The layout is centered around an intentional, single-column tool container with a strict maximum content width of 720px (`45rem`). This eliminates ocular travel, keeps the tool centered in the user's focus, and provides a desktop experience as refined as a native system utility.

### Layout Mechanics
- **Base Grid:** Fixed 8px base rhythm (`0.5rem`). All paddings, stack gaps, and margins map to multiples of 4px or 8px.
- **Max Width:** Content wrapper locked at `720px`, centered horizontally with automatic inline margins.
- **Breakpoints:**
  - **Desktop (≥ 768px):** Centered `720px` card container, `1.5rem` canvas padding, `1.5rem` internal component padding.
  - **Mobile (< 768px):** Full-bleed with `1rem` outer canvas padding; horizontal tools collapse into vertical linear stacks.

### Responsive Spacing Adjustments
- On viewports below 480px, layout gaps drop from `space-lg` (`1.5rem`) to `space-md` (`1rem`), and primary dropzone targets adjust height while keeping interactive tap targets at a 44px minimum.

## Elevation & Depth

This design system discards heavy dropshadows in favor of flat structural clarity and hairline separation. Depth is conveyed purely through surface contrast and crisp 1px borders.

### Surface Tiers
- **Tier 0 (Canvas):** The base level (`#FAFAF9` in light, `#0C0A09` in dark).
- **Tier 1 (Surface Containers):** Main tool containers, file dropzones, conversion cards (`#FFFFFF` in light, `#171413` in dark) bounded by a uniform 1px solid border (`#E7E5E4` / `#292524`).
- **Tier 2 (Floating Popovers / Modals):** Dropdowns, format pickers, and tooltips share Tier 1 background colors but add a subtle ambient boundary: `0 4px 12px rgba(0, 0, 0, 0.05)` in light mode, and `0 4px 16px rgba(0, 0, 0, 0.4)` in dark mode, paired with the mandatory 1px border.

### Focus & Active States
- No offset shadows. Interactive focus states utilize an explicit 2px outline or inner ring of `#4F46E5` (light) / `#818CF8` (dark) with an offset of 2px against the base canvas.

## Shapes

The interface balances soft friendliness with structured precision using a unified curve hierarchy.

### Geometry Specifications
- **Cards, Containers & Dropzones:** `12px` border-radius (`rounded-lg` level).
- **Input Fields, URL Bars & Select Triggers:** `12px` border-radius.
- **Buttons & Action Controls:** `10px` border-radius.
- **Badges, Tags & Format Pills:** Fully rounded / pill (`9999px`) or `6px` depending on data context (format pills use `6px`, status badges use `9999px`).
- **Dividers & Strokes:** 1px solid, continuous stroke alignment.

## Components

All components are engineered with minimalist restraint. Lucide-style thin line icons (1.5px to 1.75px stroke width) accompany textual cues.

### 1. Primary Action & Ghost Buttons
- **Height & Radius:** `40px` height (desktop), `10px` border-radius, `14px` font size (weight: 500).
- **Primary Variant:** Solid accent background (`#4F46E5` light / `#818CF8` dark), white text in light mode, dark text in dark mode. No drop shadow. Hover applies single-step darkness/lightness shift.
- **Secondary / Ghost Variant:** Surface background with 1px border (`#E7E5E4` / `#292524`), muted hover fill (`#F5F5F4` / `#1C1917`).
- **Loading State:** Text remains visible with an inline 14px monoline spinner replacing the leading icon.

### 2. File Dropzone & URL Input
- **URL Input Bar:** Integrated single row. `48px` height, 1px solid border, 12px radius. Left icon (link symbol), full-width clean input, trailing inline "Paste" or "Fetch" button.
- **File Drag & Drop Zone:** 1px dashed border (`#D6D3D1` light / `#44403C` dark) with a neutral surface fill. Active drag-over shifts border to solid accent and background to faint tint.

### 3. Chips & Format Selectors
- **Visuals:** Compact `32px` height, `6px` radius, 12px uppercase or capitalized label.
- **Selection State:** Active format selection receives solid high-contrast border and subtle background fill. Inactive formats remain transparent with faint borders.

### 4. Conversion Queue & File Items
- **Structure:** Flat list of items inside a 12px rounded container. Individual items separated by 1px horizontal borders.
- **Meta Hierarchy:** File name in primary text (14px, weight 500, truncated), file size and format in muted caption text (12px).
- **Action Trailing:** Single-click clear/remove icon button and a high-contrast "Download" trigger upon completion.

### 5. Progress Bars & Status Indicators
- **Track:** `4px` height, full width of file row or modal, `#E7E5E4` / `#292524` background, `9999px` border-radius.
- **Fill:** Solid `#4F46E5` (light) / `#818CF8` (dark) without shimmer or animation gradients. Transitions run linearly on the CSS `width` attribute.
- **Status Pills:** Small 20px height pill badges with a 6px circular dot indicator. Green for complete, Amber for converting, Red for error.

### 6. Inputs & Select Fields
- **Attributes:** 1px solid border, `10px` internal padding horizontal, 14px body text. 
- **Focus:** No default browser halo; explicit 2px accent border ring with `outline: none`.