# Facet 3 — Unified Design System Specification

**Status:** 📐 Specification, decided 2026-09-30; Phases 1–2 shipped · **Replaces:** [Facet v2](../reference/facet-design-system.md) once
Phase 2 lands · **Evidence:** [Facet style audit](../audits/FACET_STYLE_AUDIT_2026-09-30.md)

Facet 3 is IxStates' single design system: Apple's Human Interface Guidelines as the foundation (semantic colour roles,
named text styles, materials for floating layers, concentric shape, springs, accessibility preferences), with the
IxStates identity on top (the Swiss typeface, per-app tints, Cuelume sound, Halo). It replaces three drifting sources
of truth — the v2 doc, `src/styles/**` and the primitives — with one: **tokens in `@theme`, primitives in
`src/components/ui`, and this document.**

The §2 colour values shipped unchanged in Phase 1 (`src/styles/facet/tokens.css`, mirrored in
`src/lib/design/tokens.ts`) and pass the automated contrast test (`src/tests/architecture/token-contrast.test.ts`).

---

## 0. Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Surfaces | **Opaque content, glass chrome.** Pages, cards and rows are opaque; translucent materials only on floating chrome (sidebar, tab bar, Halo, toolbars, sheets, popovers, menus, map panels). Glass never nests. |
| 2 | Materials | **Glass + 3 textures.** Three glass thicknesses; textures limited to dots, grid, paper grain. Satin/paper/rubber/metal/carbon/wood and the other 16 textures move to the lab stylesheet. |
| 3 | Colour | **HIG semantic roles** (labels, backgrounds, grouped backgrounds, elevated, fills, separators, tint, system colours). shadcn names become aliases. |
| 4 | Accent | **Per-app tint.** One `--tint`/`--on-tint` pair overridden per app subtree; primary buttons, selection, links and focus inherit it. |
| 5 | Type scale | **HIG text styles at desktop density** (body 14px, nothing below 12px), rem-based. |
| 6 | Typeface | **Swiss only** (the DIN/Akzidenz stack) for UI; National/Neutraface as display face only. Presets removed. |
| 7 | Numerals | **Tabular Swiss figures** for all numbers; `font-mono` (Azeret Mono) only for code, IDs, coordinates, hashes. |
| 8 | Shape | **Concentric radius scale by layer**, continuous corners where supported. |
| 9 | Appearance | **Follow system**, user override, applied pre-paint; one **Compact/Regular** density setting (spacing and control heights only). |
| 10 | Navigation | **Sidebar (large) + tab bar (compact)**; Halo is the contextual island; maps stays chromeless. |
| 11 | Presentation | **HIG rules:** Sheet for tasks/details, AlertDialog for decisions, Popover for small edits, Dialog for short focused forms. No custom overlays. |
| 12 | Lists | **`FacetList` + `FacetRow`** (inset grouped) is the default container for settings, details, rails and most stat grids. |
| 13 | Controls | **Three sizes (28/36/44)**, 44px hit area on touch; add SegmentedControl, ToggleGroup, Stepper, MenuButton. |
| 14 | Captions | **Uppercase `Eyebrow` only for short data labels** above a value; section/list headers are sentence case. |
| 15 | Motion | **Three named springs + short tweens**; 0ms for keyboard-invoked UI; long flourishes only for Vault reveal moments. |
| 16 | Accessibility | Honour **Reduce Transparency, Increase Contrast, Reduce Motion** and an in-app **text size** (90–130%). |
| 17 | Sound | **Cuelume on, restrained:** only meaningful moments; no hover/press ticks; one mute toggle. |
| 18 | Sub-systems | **WikiOS and Forum fold into Facet roles**; wiki reading typography is the one sanctioned content style. |
| 19 | Rollout | **Foundations → primitives + doc → navigation (flagged) → apps worst-first**, guards extended per app. |

---

## 1. Architecture

- **Tokens live in `@theme`** (Tailwind v4) in one file, `src/styles/facet/tokens.css`. Every token is a CSS variable
  *and* a utility (`bg-surface`, `text-label-secondary`, `rounded-card`, `z-sheet`, `shadow-floating`…). No
  self-referential `@theme` entries; aliases use `@theme inline`.
- **All Facet CSS is layered.** Component classes live in `@layer components` or are `@utility`s. Nothing unlayered,
  so Tailwind utilities on an element always win. Material/surface classes never set `position`, `z-index`, `radius`,
  `margin` or `letter-spacing`.
- **No `!important`** except inside `integrations.css` (third-party: Clerk, sonner, MapLibre).
- **No global utility hijacks** (e.g. redefining `.focus\:ring-2`, `.font-mono`, `.tabular-nums`, `.sticky.top-6`).
- **One theme selector:** `html[data-theme="light"|"dark"]`, written by a blocking inline script from the stored
  preference or `prefers-color-scheme` before first paint. Tailwind's `dark:` variant is bound to it
  (`@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`) but feature code does not use `dark:` —
  roles already switch.
- **Preference attributes on `<html>`:** `data-theme`, `data-density="regular|compact"`, `data-contrast="more"`,
  `data-transparency="reduced"`, `data-motion="reduced"`, `data-sound="off"`, and `--text-scale` (0.9–1.3). Each mirrors
  the matching media query and can be forced from Settings.
- **App tint scope:** each app root sets `data-app="mycountry|maps|thinkpages|vault|forum|wiki|intel|sports|admin"`,
  which sets `--tint`, `--tint-hover`, `--on-tint` and `--tint-fill` for that subtree.

## 2. Colour

### 2.1 Roles

| Role | Utility | Light | Dark | Use |
|---|---|---|---|---|
| `label` | `text-label` | #09090b | #f4f4f5 | Primary text |
| `label-secondary` | `text-label-secondary` | #52525b | #a1a1aa | Secondary text, captions (≥ 4.5:1 on every background) |
| `label-tertiary` | `text-label-tertiary` | #a1a1aa | #71717a | Placeholders, disabled — never body copy |
| `label-quaternary` | `text-label-quaternary` | #d4d4d8 | #52525b | Decorative only |
| `background` | `bg-background` | #ffffff | #0b0c0f | Plain pages |
| `background-grouped` | `bg-grouped` | #f2f3f6 | #0b0c0f | Pages made of grouped sections (the default) |
| `surface` | `bg-surface` | #ffffff | #16181d | Cards, list groups on a grouped page |
| `surface-secondary` | `bg-surface-secondary` | #f2f3f6 | #1e2028 | Inset areas inside a card |
| `surface-elevated` | `bg-surface-elevated` | #ffffff | #22252d | Sheets, popovers, menus (dark mode lifts with colour, not shadow) |
| `fill` 1–4 | `bg-fill`, `-fill-2`, `-fill-3`, `-fill-4` | label @ 16/12/8/5% | label @ 24/18/12/8% | Control backgrounds, selected rows, tracks |
| `separator` | `border-separator` | rgba(0,0,0,.10) | rgba(255,255,255,.10) | Hairlines, list separators |
| `separator-opaque` | `border-separator-opaque` | #e4e4e7 | #2a2d35 | Separators over glass |
| `tint` / `on-tint` | `bg-tint`, `text-tint`, `text-on-tint` | per app (§2.2) | per app | Primary actions, links, selection, focus ring |

Existing names map onto roles: `foreground`→`label`, `muted-foreground`→`label-secondary`, `card`/`popover`→`surface`/
`surface-elevated`, `muted`/`secondary`/`accent`→`fill-3`, `border`/`input`→`separator`, `ring`→`tint`,
`primary`→`tint` (with `primary-foreground`→`on-tint`). The shadcn names stay as aliases until the migration finishes.

**System colours** (status and data; each has light/dark values and an `on-` pair): `red` #dc2626/#f87171 ·
`orange` #c2410c/#fb923c · `yellow` #a16207/#facc15 · `green` #15803d/#4ade80 · `teal` #0f766e/#2dd4bf ·
`blue` #1d4ed8/#60a5fa · `indigo` #4338ca/#818cf8 · `purple` #7e22ce/#c084fc · `pink` #be185d/#f472b6. Status roles alias
them: `destructive`→red, `warning`→orange, `caution`→yellow, `success`→green, `info`→blue.

### 2.2 App tints

| App | `--tint` light / dark | `--on-tint` light / dark |
|---|---|---|
| Default (shell, settings, admin) | indigo #4338ca / #818cf8 | #ffffff / #0b0c0f |
| MyCountry | gold #b45309 / #fbbf24 | #ffffff / #1c1917 |
| Maps | sky #0369a1 / #38bdf8 | #ffffff / #0b0c0f |
| ThinkPages & ThinkTanks | emerald #047857 / #34d399 | #ffffff / #052e16 |
| Vault & Cards | copper #9a3412 / #fdba74 | #ffffff / #1c1917 |
| Forum | orange #c2410c / #fb923c | #ffffff / #1c1917 |
| Wiki | ink indigo #3730a3 / #a5b4fc | #ffffff / #0b0c0f |
| Intelligence & Defense | crimson #be123c / #fb7185 | #ffffff / #1c0a0f |
| Sports | teal #0f766e / #2dd4bf | #ffffff / #042f2e |

Rules: the tint marks *interaction and identity*, not decoration — one filled tint button per view, tinted icons only
where they mean "this app" or "selected". Everything else uses labels, fills and system colours.

### 2.3 Contrast

`label`/`label-secondary` ≥ 4.5:1 on every background and surface role; `tint` on `background` ≥ 4.5:1 (links);
`on-tint` on `tint` ≥ 4.5:1; UI boundaries ≥ 3:1. With Increase Contrast: separators go to 0.20/0.24 alpha,
`label-secondary` steps one shade toward `label`, tints darken (light) / lighten (dark) one step. A unit test computes
every pair from the token file and fails the build below threshold.

Shipped values (Phase 1): the "one step" is one Tailwind shade — `label-secondary` #3f3f46 / #d4d4d8; each tint's
`strong` shade (light one darker, dark one lighter, e.g. MyCountry #92400e / #fcd34d), which is also `--tint-hover`;
Increase Contrast additionally lifts `label-tertiary` (#71717a / #a1a1aa) and `separator-opaque` (#a1a1aa / #52525b).
`--tint-fill` is the tint at 14% (light) / 18% (dark). System colours use one `on-` colour per appearance
(#ffffff / #0b0c0f). The test also requires tints ≥ 4.5:1 on `background-grouped` and system colours ≥ 4.5:1 on
`background` and ≥ 3:1 on every surface; all current values pass without adjustment.

### 2.4 Data visualisation

Categorical series use the system colours in the order blue, orange, green, purple, pink, teal, yellow, red
(`chart-1` … `chart-8`; never the
app tint for series 1 unless the chart is about the app itself); sequential scales ramp the app tint from `fill-4` to
`tint`; diverging uses red ↔ blue through `fill-3`. Axes and gridlines use `label-secondary` and `separator`; tooltips
are `surface-elevated`. Map paint colours are data and are exempt, but must come from a named palette module, not
inline hex.

## 3. Typography

**Face:** the Swiss stack (Schibsted Grotesk / Akzidenz-Grotesk with metric-matched fallbacks) for all UI; National/Neutraface
only through `text-display`. Presets and `data-typography` are removed. Letter-spacing lives in the text styles, never
in `.font-*` classes.

**Text styles** (`@utility text-<style>`; rem at a 16px root × `--text-scale`):

| Style | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `text-display` | 40/44 | National 700 | −0.02em | Marketing/hero titles only |
| `text-large-title` | 28/34 | 700 | −0.02em | Page title (collapses to the toolbar title on scroll) |
| `text-title-1` | 22/28 | 700 | −0.015em | Sheet/dialog titles, major sections |
| `text-title-2` | 20/26 | 600 | −0.01em | Card titles on overview pages |
| `text-title-3` | 17/22 | 600 | −0.005em | Group titles, big stat values |
| `text-headline` | 14/20 | 600 | 0 | Row titles, emphasised body |
| `text-body` | 14/20 | 400 | 0 | Default text |
| `text-callout` | 13/18 | 400 | 0 | Secondary blocks, helper text |
| `text-subhead` | 13/18 | 500 | 0 | List section headers (sentence case) |
| `text-footnote` | 12/16 | 400 | 0.005em | Metadata, timestamps |
| `text-caption` | 12/16 | 500 | 0.01em | Chips, badges, axis labels |
| `Eyebrow` | 12/16 | 500 | 0.06em, uppercase | Short data label above a value — nothing else |

Rules: nothing below 12px; one `large-title` per page; bold (700) only in titles; body copy never `font-bold`.
Numbers: `tabular-nums` in the Swiss face (stats, tables, currency); `font-mono` only for code, identifiers,
coordinates and hashes. Readable measure for prose: 42rem (wiki reading style: 38rem).

## 4. Shape, space and layout

**Radius (concentric):** `rounded-sheet` 20 · `rounded-card` 16 · `rounded-row` 12 (grouped list, inset panel) ·
`rounded-control-lg` 12 (44px) · `rounded-control` 10 (36px) · `rounded-control-sm` 8 (28px) · `rounded-full`
(chips, pills, avatars). Nested radius = outer radius − padding (never larger than the parent's). Where supported,
`@supports (corner-shape: squircle)` applies continuous corners to card, sheet and control radii.

**Spacing:** 4px base, 8px rhythm. Allowed steps: 0, 0.5 (2px, hairline tweaks only), 1, 2, 3, 4, 5, 6, 8, 10, 12, 16.
Other fractional steps (1.5, 2.5, 3.5) are retired. Compact density multiplies component padding and gaps by 0.75 and
drops control heights to 28/32/40; type is unchanged.

**Layout:** page margins 16 (compact width) / 24 (regular) / 32 (≥1280px); content max width 1440px; grid gutters
16/24; card padding 16 (compact) / 20 (regular); section spacing 24/32. Sidebar 256px (collapsed 64px). Sticky rails
sit at `top-(--toolbar-height)`. Safe-area insets respected on mobile (tab bar, sheets).

## 5. Materials, elevation and depth

**Materials** (chrome only; `@utility material-*`):

| Material | Blur / saturation | Background | Use |
|---|---|---|---|
| `material-thin` | 12px / 150% | `surface` @ 72% | Toolbars, sub-headers, map floating buttons |
| `material-regular` | 20px / 170% | `surface` @ 80% | Sidebar, tab bar, Halo, map panels |
| `material-thick` | 28px / 180% | `surface-elevated` @ 88% | Sheets, popovers, menus, command palette |

Each has a 1px `separator-opaque` hairline and the top-edge refraction highlight (light 0.20→0.40, dark 0.08→0.15 on
hover). **Never nest materials:** anything inside a material uses opaque roles (`surface`, `surface-secondary`, fills).
Reduce Transparency (or `data-transparency="reduced"`) swaps every material for its opaque role; screens ≤768px use
the next thinner blur.

**Textures:** `dots` (8px), `grid` (12px), `paper-grain` — decorative only (empty states, heroes, wiki reading
surface), opacity ≤ 0.05, never on data. All other materials/textures live in the lab stylesheet.

**Elevation:** `shadow-none` (content on grouped pages) · `shadow-card` (light-mode cards on plain backgrounds only) ·
`shadow-floating` (popovers, menus, map panels) · `shadow-sheet` (sheets, dialogs). In dark mode, elevation is
expressed by `surface-elevated`, with shadows at half strength.

**Z-index (one scale, registered in `@theme`):** `z-base` 0 · `z-raised` 10 · `z-sticky` 100 · `z-chrome` 500
(sidebar, tab bar, toolbars) · `z-nav` 5000 · `z-backdrop` 100000 · `z-sheet` 100001 · `z-popover` 100010 ·
`z-tooltip` 100020 · `z-toast` 100050 · `z-command` 110000. No arbitrary `z-[…]` above 50 in feature code.

## 6. Iconography

Iconoir only, `currentColor`, the global stroke set in `layout.tsx`. Size follows the adjacent text style: footnote/
caption 14px · body/headline/callout 16px · title-3 18px · title-1/2 20px · large-title 24px. Decorative icons use
`label-secondary`; icons that carry state use a system colour or the tint. No emoji as icons (emoji stay user content).
Icon-only buttons need an `aria-label` and a tooltip.

## 7. Components

### 7.1 Surfaces & content

| Component | Use | Replaces |
|---|---|---|
| `FacetCard` | Opaque content card (`surface`, `rounded-card`, card padding). Header/Content/Footer parts. | `FacetContainer depth={1–3}`, `Card`, `CutoutCard`, `PanelCard`, `GlassPanel`, hand-rolled `rounded-xl border bg-*` |
| `FacetList` / `FacetListSection` / `FacetRow` | Inset grouped list: section header (sentence-case `text-subhead`) and footer, rows with leading icon, title, subtitle, trailing value/badge/accessory/chevron, separators inset to the text, optional swipe actions (`SwipeableRow`), selectable/navigable rows. | KPI grids, divided lists, rails' `RailRow`, settings rows |
| `Stat` | `Eyebrow` label + `text-title-3` tabular value + optional delta. | Hand-rolled metric tiles |
| `FacetMaterial` | The only glass surface: `thin`/`regular`/`thick`. | `FacetContainer` glass depths, `.facet-hierarchy-*`, `glass-*` |
| `EmptyState` | Icon, `text-title-3` title, `text-callout` message, one action. | Ad-hoc empty states |
| `Skeleton` | All loading placeholders, shaped like the final layout. | `animate-pulse` blocks |
| `Badge` | Status/count chips: `neutral`, `tinted`, and one per status role. | Hand-rolled chips |
| `Progress`, `Gauge`, `HealthRing` | Linear, radial and ring meters; colours from roles. | Hand-rolled bars |

`FacetContainer` stays as a deprecated wrapper during migration: `surface="solid"` → `FacetCard`; glass depths →
`FacetMaterial`. Its dead props (`variant`, `theme`, `enableRefraction`, `adaptToBackground`, `motionPreset`,
`gradient`, `hover`, `interactive` depth cycling) are removed.

### 7.2 Controls

| Component | Rules |
|---|---|
| `Button` | Styles: `filled` (tint, one per view), `tinted` (tint @ fill), `gray` (fill-3), `plain` (text only), `bordered`, `destructive`, `link`. Sizes `sm` 28 · `md` 36 · `lg` 44; 44px minimum hit area on coarse pointers. |
| `SegmentedControl` | Single choice among 2–5 peer options (view switchers, filters, periods). |
| `ToggleGroup` | Multi-select filters. |
| `Tabs` / `FacetTabs` | Page-level section switching only (with `role=tablist`, roving focus). |
| `Switch`, `Checkbox`, `Radio` | Settings and forms; full ARIA. |
| `Stepper`, `Slider` | Numeric adjustments. |
| `TextField`, `SearchField`, `Textarea`, `Select`, `MenuButton`, `Combobox` | Forms; inputs are `fill-3` backgrounds, `rounded-control`, no blur/refraction. |

### 7.3 Presentation

| Need | Use |
|---|---|
| Task, detail view, multi-step flow | `Sheet` — side sheet on ≥768px, bottom sheet with `medium`/`large` detents below |
| Confirm, destructive or irreversible decision | `AlertDialog` (≤ 2 actions, destructive styled `destructive`) |
| Small contextual edit or info | `Popover` |
| Short focused form that blocks the page | `Dialog` |
| Transient feedback | `useNotify` → toast / Halo |
| Command palette | `CommandDialog` with 0ms presentation |

No `createPortal` or `fixed inset-0` overlays in feature code.

### 7.4 Navigation

- **Large (≥1024px):** `AppSidebar` (material-regular): app switcher, then the current app's sections; collapsible to
  icons. Pages have a `PageHeader` (large title that collapses into the toolbar title on scroll) and an optional
  `Toolbar` (material-thin).
- **Compact:** bottom `TabBar` (material-regular) with the 4–5 primary apps plus "More"; sections move into the page
  as a `SegmentedControl` or list.
- **Halo:** the contextual island — search, notifications, live activity, quick actions — not the primary navigation.
- **Maps:** stays chromeless; wayfinding via `MapDynamicIsland`.
- The v2 scroll modes (morph/hide/repulsion) are retired with the top bar.

## 8. Motion

| Token | Spring / curve | Use |
|---|---|---|
| `spring-snappy` | stiffness 520, damping 38 | Controls: switch thumbs, segmented selection, toggles, press release |
| `spring-smooth` | stiffness 320, damping 32 | Sheets, sidebar, navigation, layout changes |
| `spring-gentle` | stiffness 180, damping 24 | Emphasis: success states, reveals |
| `duration-fast` / `ease-out-facet` | 150ms, cubic-bezier(.23,1,.32,1) | Colour and opacity changes |
| `duration-exit` | 120ms | Exits (always faster than entrances) |

Rules: animate transform and opacity only; entrances from `scale(0.96)` + opacity 0, never from 0; press compression
`scale(0.98)`; keyboard-invoked UI appears in 0ms; nothing loops forever except genuine live indicators. Long
flourishes (pack openings, rare-card reveals) are allowed only in Vault/cards moments and are skippable. Reduce Motion:
springs become 150ms cross-fades, parallax/tilt/shimmer off, loops stop.

## 9. Sound (Cuelume)

On by default at master 0.25, but only for meaningful moments: success, error, destructive confirm, sheet/dialog
present and dismiss, Vault reveals, Halo notifications, and page arrival. No hover ticks, per-button presses, tab or
select ticks. One mute toggle in Settings and in Halo; muted automatically with `data-motion="reduced"` or
`data-sound="off"`.

## 10. Accessibility

- WCAG 2.2 AA minimum (§2.3); focus ring 2px `tint` with 2px offset on every interactive element.
- Hit targets ≥ 44×44 on coarse pointers, ≥ 28px visual on fine pointers.
- Preferences: Reduce Transparency (§5), Increase Contrast (§2.3), Reduce Motion (§8), text size 90–130%
  (`--text-scale`; layouts must reflow without clipping at 130%).
- Every custom control exposes the matching ARIA pattern (tablist, radiogroup, switch, listbox, menu).
- Colour never carries meaning alone: status also uses an icon or text.

## 11. Content & voice

Sentence case for titles, buttons and headers (proper nouns and product names excepted); `Eyebrow` uppercase only for
data labels. Buttons are verbs ("Declare directive", "Save changes"). No exclamation marks in UI chrome; toasts only
for outcomes the user can't already see. Numbers use locale formatting with abbreviations above 10,000 (1.2M), exact
values on hover or tap.

## 12. Sub-systems

- **WikiOS:** `--wikios-*` become aliases of Facet roles plus the Wiki tint. The wiki keeps its **Reading style** —
  article body face, 38rem measure, paper-grain surface — as the one sanctioned content style; chrome, controls,
  colour and motion are Facet. Its private easing/spring/duration tokens are removed.
- **Forum:** `--forum-*` become aliases of roles plus the Forum tint; `glass-forum-*` are replaced by `FacetCard`/
  `FacetList`.
- **Labs (Onoma, materials lab):** may use lab-only materials and textures from `styles/facet/lab.css`, loaded only on
  lab routes; everything else follows Facet.

## 13. Migration map

| v2 | Facet 3 |
|---|---|
| `FacetContainer surface="solid"`, `FacetCard` | `FacetCard` (opaque) |
| `FacetContainer depth={1–4}` glass, `.facet-hierarchy-*`, `.facet-refraction` on content | `FacetMaterial` on chrome; `FacetCard`/roles on content |
| undefined `glass-*`, `facet-card-parent/child` | `FacetCard`, `FacetList` |
| `text-foreground` / `text-muted-foreground` | `text-label` / `text-label-secondary` (aliases kept meanwhile) |
| `text-xs` everywhere | `text-footnote` / `text-caption` / `Eyebrow` by meaning |
| hand-rolled uppercase labels | `Eyebrow` (data labels) or `text-subhead` (headers) |
| `font-mono` for numbers | `tabular-nums` |
| `rounded-lg/xl/2xl` | `rounded-row/card/sheet/control*` |
| `z-[…]`, `--z-depth-*` | `z-*` tokens |
| `dark:` overrides | roles |
| domain `--facet-{app}`, `--tab-*`, `--mycountry-gold*`, `.facet-{domain}` | `data-app` + `--tint` |
| pill filters, view switchers | `SegmentedControl` / `ToggleGroup` |
| custom overlays, most dialogs | `Sheet` / `AlertDialog` / `Popover` per §7.3 |
| top nav + scroll modes | `AppSidebar` / `TabBar` / `PageHeader` |
| per-primitive Cuelume cues | §9 moments only |

## 14. Rollout

1. **Foundations — ✅ done 2026-09-30.** `tokens.css` in `@theme` (roles, tints, type, radius, materials, elevation, z,
   motion — spacing uses Tailwind's 4px base; density exposes `--density` and `--control-height-*`); pre-paint theme
   script and preference attributes (default "system"); `data-app` scopes on app root layouts, mirrored onto `<body>`
   by `PortalTintSync` so portalled overlays keep the app tint; contrast test; `cn()` knows the token utilities.
   All Facet/theme CSS is layered (`css-layering` guard) and material classes no longer set position/z/radius;
   utility hijacks and `!important` workarounds removed (kept only in `facet/overrides.css` for user-preference
   switches over inline styles and `wiki-os/mediawiki.css` for MediaWiki/Parsoid HTML); broken references fixed
   (`*-hsl`, undefined `glass-*`, reduced-motion guards, route-scoped wiki tokens now in `wiki-os/tokens.css`);
   primitives use one z order; dead CSS deleted (~19.8k → ~12.6k lines) and lab-only CSS moved to `facet/lab.css`.
   Carried into Phase 2: honour the in-app reduce-motion setting in `MotionConfig` (it follows the OS only) and mute
   Cuelume under `data-motion="reduced"`; squircle corners for prefixed radius utilities; decide whether `tokens.css`
   or `typography.css` owns the font stacks; give `FacetMaterial` its own `relative` so the `:where()` default can go.
2. **Primitives and doc — ✅ done 2026-09-30.** Controls (Button styles/sizes, Badge, SegmentedControl, ToggleGroup,
   Stepper, MenuButton, SearchField, full ARIA for Tabs/Switch/Toggle/Checkbox/Slider, shared field style); surfaces
   (opaque `FacetCard`, `FacetContainer` as a deprecated wrapper, `FacetMaterial` thin/regular/thick,
   `FacetList`/`FacetRow`, `Stat`, `EmptyState`, Skeleton/Progress/HealthRing/Eyebrow); presentation (opaque dialogs,
   `material-thick` popovers/menus, responsive `Sheet` with detents, instant `CommandDialog`, overlay animations);
   `FacetMotionConfig`; Cuelume restricted to §9 moments; Settings → Appearance & accessibility. The
   [reference doc](../reference/facet-design-system.md) now documents Facet 3 and `FACET_VERSION` is 3.
   **Deviations from this spec, as shipped:** (a) the Swiss UI stack leads with Schibsted Grotesk (the shipped Swiss
   preset), not DINPro; (b) sheets are opaque `surface-elevated`, not `material-thick`, because callers nest blurred
   content inside them; (c) `FacetCard`/`FacetContainer` still accept `depth`, `theme`, `variant` and
   `enableRefraction` as ignored props because callers pass them; (d) IxMaps and the map editor keep glass on their
   floating panels via `material="regular"|"thick"`; (e) `appearance.ts` still writes `data-typography` (the picker is
   gone); (f) hero surfaces may carry identity imagery (MyCountry's `FlagWatermark`: circular corner flag, plus `TintHairline`; no full-width wash).
3. **Navigation shell** behind a flag: `AppSidebar`, `TabBar`, `PageHeader`, Halo as island; flip the flag once every
   app has a section map. **🟡 Shipped behind `facet-nav` (off) 2026-09-30.** `NEXT_PUBLIC_FACET_NAV=1` or Settings →
   Appearance & accessibility → "New navigation (preview)"; the pre-paint script writes `html[data-nav]`/
   `[data-sidebar]` and both shells are in the server HTML, CSS-gated (`styles/facet/shell.css`), so nothing flashes.
   `src/components/shell` (`AppShell`, `FacetShell`, `AppSidebar`, `TabBar`, `PageHeader`, `ShellGate`, `ShellHalo`),
   the app section map `src/lib/navigation/app-sections.ts` (12 apps; route guard in
   `tests/lib/navigation/app-sections.test.ts`) and the `--shell-*` layout variables (`--shell-top-offset` for sticky
   rails). `PageHeader` is adopted on `/help` under the flag. Maps and the full-screen map editors stay chromeless.
   **Before flipping the flag:** apps with their own sub-navigation (vault, admin, settings, wiki-os, sports, forum)
   still render it next to the sidebar — fold it into the section map as each app converts in Phase 4; Labs/Onoma is
   not in the map yet; fixed-position page chrome (map editor overlays, the builder, WikiOS drawers) doesn't offset by
   `--shell-sidebar-width`; retire `navigation.tsx`, `useNavigationScroll` and `lib/navigation-config.ts` with the
   legacy shell.
4. **Apps, worst-first:** dashboard, achievements, passport/settings, ThinkPages, WikiOS, labs chrome, Halo views,
   vault, messages, forum, admin, sports, countries, builder; then re-check MyCountry and maps against Facet 3.
   `facet-guards` gains each app's rules as it converts.

## 15. Governance

`FACET_VERSION` becomes 3.0.0 at the end of Phase 2. Changes to tokens or primitives require updating this document
and its changelog in the same PR; `facet-guards` encodes every rule that can be checked statically (roles instead of
`dark:`, no hex, no arbitrary z, no raw overlays, allowed text styles and radii, Eyebrow usage, no nested materials in
known containers).
