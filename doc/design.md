# DESIGN.md — SITEWISE Engineering UI Specification (V4.2)
**Target Platform:** React 18+ / TypeScript / Google Antigravity / Tailwind CSS  
**Domain:** Multimodal Construction Intelligence & Heavy Civil Infrastructure Engineering

---

## 1. Color System & Semantic Tokens

The visual identity relies on a high-contrast industrial charcoal baseline, engineered concrete slates, and restrained, high-visibility Safety Yellow accents reserved strictly for primary actions, critical path focus, and active topological selections.

### 1.1 Base Surfaces & Layout Gradients
| Token Name | Hex Code | Antigravity / Tailwind Utility | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `surface-canvas` | `#0C0E10` | `bg-[#0C0E10]` | Global viewport background (deepest matte substrate) |
| `surface-base` | `#121416` | `bg-[#121416]` | Main workspace canvas & application shell background |
| `surface-container-low` | `#1A1C1E` | `bg-[#1A1C1E]` | Standard card containers, side panels, data sections |
| `surface-container-med` | `#24282B` | `bg-[#24282B]` | Hover states, elevated modal surfaces, nested telemetry blocks |
| `surface-container-high`| `#2D3236` | `bg-[#2D3236]` | Active tab backgrounds, toolbar buttons, active selection containers |
| `surface-border-subtle` | `#2A2E33` | `border-[#2A2E33]` | Card framing, internal grid column rules, subtle separators |
| `surface-border-default`| `#38393C` | `border-[#38393C]` | Structural component borders, inputs, drawer dividers |
| `surface-border-strong` | `#50555C` | `border-[#50555C]` | Focused interactive elements, active HUD bounds |

### 1.2 Accent & Brand Semantics
| Token Name | Hex Code | Antigravity / Tailwind Utility | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `brand-yellow-primary` | `#F5C542` | `bg-[#F5C542] text-[#121416]` | Primary CTA buttons, focused causal node highlights, active rail pill |
| `brand-yellow-hover`   | `#FFD564` | `bg-[#FFD564]` | Primary button hover state |
| `brand-yellow-subtle`  | `rgba(245,197,66,0.12)` | `bg-[#F5C542]/12 border-[#F5C542]/40` | Highlight badge backdrops, active entity selections |
| `brand-gold-warm`      | `#D4A916` | `text-[#D4A916]` | Secondary numeric highlights, monetary deltas |

### 1.3 Data Provenance & Trust Color Semantics
Every engineering data point displayed on screen MUST carry an unambiguous provenance indicator:
| Semantic Token | Background | Text / Border | Purpose & Engineering Meaning |
| :--- | :--- | :--- | :--- |
| `badge-source-verified` | `rgba(46,125,79,0.14)` | `#4ADE80` / `#22C55E` | Ground truth data (geotagged sensor files, certified mill test logs) |
| `badge-ai-inferred`     | `rgba(217,154,53,0.14)` | `#FBBF24` / `#D97706` | Machine vision / LLM extraction (apertures, object classifications) |
| `badge-human-reviewed`  | `rgba(56,189,248,0.14)` | `#38BDF8` / `#0284C7` | Resident Engineer or Consultant dispositioned findings |
| `badge-calculated-risk` | `rgba(239,68,68,0.14)`  | `#F87171` / `#EF4444` | Contractual breach, critical path CPM slips, liquidated damages |
| `badge-proposed-action` | `rgba(245,197,66,0.14)` | `#F5C542` / `#CA8A04` | Prescriptive mitigation, CFRP wrapping, grouting scenarios |
| `badge-synthetic-demo`  | `rgba(245,197,66,0.10)` | `#F5C542` / `#854D0E` | Persistent synthetic workspace banner & non-certified calibration tag |

### 1.4 Typography & Content Colors
| Token Name | Hex Code | Tailwind Utility | Accessibility / Contrast Ratio |
| :--- | :--- | :--- | :--- |
| `text-primary` | `#F3F4F6` | `text-gray-100` | 14.8:1 against `#121416` (WCAG AAA) |
| `text-secondary` | `#9CA3AF` | `text-gray-400` | 6.2:1 against `#121416` (WCAG AA Normal & Large) |
| `text-tertiary` | `#6B7280` | `text-gray-500` | 3.8:1 against `#121416` (Auxiliary metadata, timestamps) |
| `text-code` | `#E2E8F0` | `text-slate-200` | Monospaced coordinate values, chainage, hash signatures |

---

## 2. Typography Scale

- **Primary UI Font:** `Space Grotesk`, `Inter`, `-apple-system`, `sans-serif`
- **Telemetry & Monospaced Font:** `JetBrains Mono`, `ui-monospace`, `SFMono-Regular`, `monospace`

| Type Style | Font Family | Size (px/rem) | Weight | Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `Display Title` | Space Grotesk | `24px (1.5rem)` | 700 Bold | `30px` | `-0.02em` | Workspace Package Headers, Node Modal titles |
| `Heading 1` | Space Grotesk | `20px (1.25rem)`| 600 SemiBold| `26px` | `-0.015em`| Page titles, Primary Card Headers |
| `Heading 2` | Space Grotesk | `16px (1.0rem)` | 600 SemiBold| `22px` | `-0.01em` | Section groupings, KPI card labels |
| `Heading 3` | Space Grotesk | `14px (0.875rem)`| 600 SemiBold| `20px` | `0` | Sub-section titles, table section heads |
| `Body Large` | Inter | `14px (0.875rem)`| 400 Regular | `20px` | `0` | Primary narratives, inspector technical notes |
| `Body Regular` | Inter | `13px (0.8125rem)`| 400 Regular | `18px` | `0` | Table cell contents, attribute values |
| `Body Small` | Inter | `12px (0.75rem)` | 400 Regular | `16px` | `0.01em` | Auxiliary captions, metadata lines |
| `Micro / Badge` | Inter / Mono | `11px (0.6875rem)`| 600 SemiBold| `14px` | `0.04em` | Status tags, provenance badges, chip buttons |
| `Telemetry Mono`| JetBrains Mono| `12px (0.75rem)` | 500 Medium | `16px` | `0.02em` | Chainage (Ch. 14+320), GSD metrics, hashes |
| `Metric Value` | Space Grotesk | `28px (1.75rem)`| 700 Bold | `32px` | `-0.03em` | Primary KPI numbers (-4 Days, 94.2%, ₹4.85L) |

---

## 3. Spacing, Sizing, Radii & Grid System

- **Base Unit:** 4px grid (multiples of 4px and 8px)
- **Border Radii:**
  - `radius-sm`: `3px` (Badges, chips, monospaced coordinate tags)
  - `radius-md`: `6px` (Buttons, text input fields, dropdown menus)
  - `radius-lg`: `8px` (Cards, panels, modal dialogs, HUD reticle bounding box)
  - `radius-full`: `9999px` (Status indicator dots, avatar circles)
- **Layout Spacing Tokens:**
  - `space-1`: `4px`
  - `space-2`: `8px`
  - `space-3`: `12px`
  - `space-4`: `16px`
  - `space-6`: `24px`
  - `space-8`: `32px`
- **Application Shell Dimensions:**
  - **Left Navigation Rail Width (Expanded):** `220px` fixed
  - **Left Navigation Rail Width (Collapsed / Narrow Viewport):** `64px` fixed
  - **Global Header Top Bar Height:** `56px` fixed
  - **Sub-header / Context Breadcrumb Bar Height:** `44px` fixed
  - **Inspector Drawer Width (Right Panel):** `380px` fixed (collapsible on viewports `< 1440px`)

---

## 4. Breakpoints & Responsive Behavior

1. **Wide Workstation (`>= 1600px`):**
   - Full 220px persistent navigation rail.
   - Dual-column workspace or primary 65% canvas + 35% sticky inspector drawer.
   - All multi-metric KPI rows display as 4 equal cards.
2. **Standard Desktop (`1280px - 1599px`):**
   - 220px persistent navigation rail.
   - Inspector panel collapsible via toggle icon or automatically floats as an overlay drawer.
   - KPI rows wrap into 2x2 grid.
3. **Narrow Desktop / Tablet Landscape (`1024px - 1279px`):**
   - Left navigation automatically collapses to 64px icon-rail mode.
   - Tables activate horizontal scroll with sticky primary identifier columns.
   - Graphs activate fluid zoom-to-fit with bottom-sheet inspector drawer.
