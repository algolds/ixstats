# Facet 3 — Design System Reference

**Version:** Facet 3.0 (`FACET_VERSION`, `src/lib/buildVersion.ts`) · **Decisions & rationale:**
[Facet 3 specification](../specs/2026-09-30-facet-3-design-system.md) · **Evidence for the rewrite:**
[Facet style audit](../audits/FACET_STYLE_AUDIT_2026-09-30.md)

Facet is IxStates' design system: Apple's Human Interface Guidelines as the foundation — semantic colour roles, named
text styles, glass only for floating chrome, concentric shape, springs, accessibility preferences — with the IxStates
identity on top: the Swiss typeface, per-app tints, Cuelume sound and Halo. This page documents **what ships**. The spec
records why; where the two differ, this page is right and the spec notes the deviation.

**Status:** Phases 1 (foundations) and 2 (primitives, settings) are live. Phase 3 (sidebar + tab bar navigation) and
Phase 4 (per-app migration) are pending, so many screens still use legacy classes that now alias onto the tokens below.

---

## 1. Rules of the road

1. **Content is opaque, chrome is glass.** Pages, cards, rows and dialogs are opaque. Glass (`material-*`) is only for
   floating chrome: map panels and toolbars, Halo, popovers and menus, the future sidebar/tab bar. Glass never nests.
2. **Use roles, not colours.** `text-label`, `bg-surface`, `border-separator`, `bg-tint`… switch with the theme and
   the Increase Contrast preference. No `dark:` overrides, no hex in class names, no raw palette for UI chrome.
3. **Use primitives, not hand-rolled markup.** Every card, row, button, badge, tab, switch, overlay and list on this
   page exists in `src/components/ui`; feature code never imports `@radix-ui/*` or `lucide-react`.
4. **Utilities always win.** All Facet CSS is layered (`@layer base/components` or `@utility`), so a class on an
   element is never silently overridden. `!important` exists only for user-preference switches over inline animation
   styles (`styles/facet/overrides.css`) and for MediaWiki HTML (`styles/wiki-os/mediawiki.css`).
5. **The guards are the rules.** `src/tests/architecture/{facet-guards,css-layering,token-contrast}.test.ts` fail the
   build on regressions (see §11).

## 2. Tokens

All tokens live in **`src/styles/facet/tokens.css`** (`@theme`, mirrored for tests in `src/lib/design/tokens.ts`).
Every token is also a Tailwind utility.

### 2.1 Colour roles

| Role | Utility | Use |
|---|---|---|
| `label` · `label-secondary` · `label-tertiary` · `label-quaternary` | `text-label…` | Primary text · secondary text and captions · placeholders/disabled · decorative |
| `background` · `background-grouped` | `bg-background` · `bg-grouped` | Plain pages · pages made of grouped sections (default body) |
| `surface` · `surface-secondary` · `surface-elevated` | `bg-surface…` | Cards and list groups · inset areas inside a card · dialogs, sheets, menus, tooltips |
| `fill` · `fill-2` · `fill-3` · `fill-4` | `bg-fill…` | Control backgrounds (strong → faint), tracks, hover washes |
| `separator` · `separator-opaque` | `border-separator…` | Hairlines · separators over glass |
| `tint` · `tint-hover` · `on-tint` · `tint-fill` | `bg-tint`, `text-tint`, `text-on-tint`, `bg-tint-fill` | Primary actions, links, selection, focus |
| System colours `red orange yellow green teal blue indigo purple pink` (+ `on-*`) | `text-red`, `bg-green`… | Status and data |
| Status aliases `destructive warning caution success info` | `text-destructive`… | Semantic status |
| `chart-1 … chart-8` | `fill-chart-1`… | Categorical data series (order: blue, orange, green, purple, pink, teal, yellow, red) |

Legacy shadcn names are aliases: `foreground`→label, `muted-foreground`→label-secondary, `card`→surface,
`popover`→surface-elevated, `muted`/`secondary`/`accent`→fill-3, `border`/`input`→separator, `primary`/`ring`→tint,
`primary-foreground`→on-tint. New code uses the role names.

**Contrast:** every label and tint pair meets WCAG AA in both themes (`token-contrast.test.ts`). Increase Contrast
(`prefers-contrast: more` or `html[data-contrast=more]`) strengthens separators, secondary labels and tints.

### 2.2 App tints

Each app root sets `data-app`, which sets `--tint`, `--tint-hover`, `--on-tint` and `--tint-fill` for its subtree;
`<PortalTintSync />` mirrors the deepest scope onto `<body>` so dialogs, popovers and menus keep it.

| `data-app` | Tint | Where |
|---|---|---|
| *(none)* / `admin` | Indigo | Shell, dashboard, settings, admin |
| `mycountry` | Gold | `/mycountry/**` |
| `intel` | Crimson | `/mycountry/intelligence`, `/mycountry/defense` |
| `maps` | Sky | `/maps` |
| `thinkpages` | Emerald | `/thinkpages`, `/thinktanks` |
| `vault` | Copper | `/vault` |
| `forum` | Orange | `/forum` |
| `wiki` | Ink indigo | WikiOS routes |
| `sports` | Teal | `/myleague`, `/myclub` |

Use the tint for interaction and identity only: one filled tint button per view, selection, links, focus. For a new
app scope, wrap its layout in `<div data-app="…" className="contents"><PortalTintSync />…</div>` and add its palette
in `tokens.css`.

### 2.3 Typography

**Face:** the Swiss stack (Schibsted Grotesk → Akzidenz-Grotesk → system fallbacks, metric-matched) for all UI;
National for `text-display`; Azeret Mono (`font-mono`) only for code, IDs, coordinates and hashes. Font stacks are
owned by `tokens.css`. Numbers use `tabular-nums` in the UI face.

| Utility | Size/line | Weight | Use |
|---|---|---|---|
| `text-display` | 40/44 | 700 (National) | Hero titles only |
| `text-large-title` | 28/34 | 700 | One per page: the page title |
| `text-title-1` | 22/28 | 700 | Dialog/sheet titles, major sections |
| `text-title-2` | 20/26 | 600 | Card titles on overview pages |
| `text-title-3` | 17/22 | 600 | Group titles, stat values |
| `text-headline` | 14/20 | 600 | Row titles, emphasis |
| `text-body` | 14/20 | 400 | Default text |
| `text-callout` | 13/18 | 400 | Helper text, secondary blocks |
| `text-subhead` | 13/18 | 500 | List section headers (sentence case) |
| `text-footnote` | 12/16 | 400 | Metadata, timestamps |
| `text-caption` | 12/16 | 500 | Chips, badges, axis labels |
| `text-eyebrow` / `<Eyebrow>` | 12/16 | 500, uppercase | Short **data** labels above a value — nothing else |

Sizes scale with `--text-scale` (Settings → Text size, 90–130%). Nothing is set below 12px. `cn()` understands these
utilities, so `cn("text-body text-label")` keeps both.

### 2.4 Shape, space, layout

- **Radius (concentric):** `rounded-sheet` 20 · `rounded-card` 16 · `rounded-row` 12 · `rounded-control-lg` 12 ·
  `rounded-control` 10 · `rounded-control-sm` 8 · `rounded-full` for chips and avatars. A nested radius is the outer
  radius minus the padding. Continuous (squircle) corners apply where the browser supports `corner-shape`.
- **Spacing:** Tailwind's 4px scale on an 8px rhythm; avoid x.5 steps except hairline tweaks.
- **Density:** `html[data-density=compact]` (Settings) shrinks control heights (`--control-height-sm|md|lg`,
  28/36/44 → 28/32/40) and component spacing; type is unchanged. Use the `compact:` variant for density tweaks.

### 2.5 Materials, elevation, z-index

| Utility | Use |
|---|---|
| `material-thin` | Toolbars, sub-headers, small floating buttons |
| `material-regular` | Map panels, Halo, (future) sidebar and tab bar |
| `material-thick` | Popovers, menus, map context menus and floating dialogs over the map |

Materials switch to opaque under Reduce Transparency and step down one blur level on small screens. Anything inside a
material uses opaque roles. **Elevation:** `shadow-card` (cards), `shadow-floating` (popovers, menus, map panels),
`shadow-sheet` (dialogs, sheets); shadows halve in dark mode, where `surface-elevated` carries the lift.

**Z-index** (utilities `z-base` … `z-command`): base 0 · raised 10 · sticky 100 · chrome 500 · nav 5000 · backdrop
100000 · sheet/dialog 100001 · popover/select/menu/hover card 100010 · tooltip 100020 · toast 100050 · command 110000.
Custom full-screen overlays that must host popovers use 100002–100009. No arbitrary `z-[…]` in `src/components/ui`.

### 2.6 Motion

`src/lib/design/motion.ts` exports three springs — `springSnappy` (controls, thumbs, segmented selection),
`springSmooth` (sheets, navigation, layout), `springGentle` (emphasis) — plus `--duration-fast` 150ms,
`--duration-exit` 120ms and `ease-out-facet`. Rules: animate transform and opacity; enter from scale .96 + fade;
exits are faster than entrances; keyboard-invoked UI appears instantly; nothing loops except live indicators.
Overlay animations are the `animate-facet-in/out` and `animate-sheet-in/out` utilities. `<FacetMotionConfig>` (root
layout) makes motion/react honour both the OS and the in-app Reduce Motion setting.

## 3. Surfaces & content

| Component | Use |
|---|---|
| `FacetCard` (+ `FacetCardHeader/Content/Footer`) | The opaque content card. `padding="sm|md|lg"`; `onClick` or `interactive` makes it pressable (keyboard, focus ring). `depth`/`theme`/`variant` are accepted and ignored. |
| `FacetList` / `FacetListSection` / `FacetRow` | Inset grouped list — the default for settings, details, rails and most stat grids. Section `header` (sentence case) and `footer`; rows with `leading`, `title`, `subtitle`, `trailing`, `accessory` (`chevron`/`check`/node), `href` or `onClick`, `selected`, `disabled`, `destructive`, `swipeActions`. `variant="plain"` inside a card. |
| `Stat` | Eyebrow label + tabular value + optional `delta` (icon and text, never colour alone) + `hint`. |
| `EmptyState` | Icon, title, message and one action; `compact` inside cards. |
| `FacetMaterial` | Glass: `material="thin|regular|thick"`. Old `satin|paper|rubber|metal` still work (deprecated). |
| `FacetContainer` | **Deprecated.** Content depths render as `FacetCard`; `material=…` renders glass. New code uses `FacetCard` or `FacetMaterial`. |
| `Skeleton` | Loading placeholders shaped like the final layout (no blur; stops under reduced motion). Never inside `<p>`. |
| `Badge` | `neutral`, `tinted`, `success`, `warning`, `caution`, `destructive`, `info` (old `default`/`secondary`/`outline` still work). |
| `Progress`, `HealthRing` | Meters; `tone` for status colours. |
| `Eyebrow` | Uppercase data label (`text-eyebrow`). |
| `TextureOverlay` | Decorative only; sanctioned textures are `dots`, `grid`, `paperGrain` (`SANCTIONED_TEXTURES`). |

Hero identity (e.g. MyCountry's `FlagBackdrop`) may add a faded image, a tint glow and a tint hairline behind a card's
content; it must be `aria-hidden`, not printed, and sit behind the content.

## 4. Controls

| Component | Notes |
|---|---|
| `Button` | Styles `filled` (tint), `tinted`, `gray`, `plain`, `bordered`, `destructive`, `link`; old `default`→filled, `secondary`→gray, `outline`→bordered, `ghost`→neutral plain. Sizes `sm` 28 · `md` 36 · `lg` 44 · `icon`/`icon-sm`/`icon-lg`; 44px hit area on touch; tint focus outline. One `filled` button per view. |
| `SegmentedControl` | 2–5 peer choices (views, periods, filters). Radiogroup, or tablist with `asTabs`. |
| `ToggleGroup` | Multi- or single-select filter chips. |
| `Tabs` / `FacetTabs` | Page-level section switching only; full tablist ARIA and arrow keys. |
| `Switch`, `Checkbox`, `Slider`, `Stepper` | Settings and numeric input; roles, tint when on, 44px touch targets. |
| `Input`, `Textarea`, `Select`, `SearchField`, `MenuButton` | Shared field style (`fieldStyles`): fill background, `rounded-control`, red `aria-invalid`, 16px text on phones. `MenuButton` opens a `DropdownMenu`. |

Ordinary controls make no sound.

## 5. Presentation

| Need | Use |
|---|---|
| Task, detail view, multi-step flow | `Sheet` — `side="auto"` (default): right side sheet ≥768px, bottom sheet below with `detents` (`medium`/`large`), grabber and drag-to-dismiss. Explicit `side` values still work. |
| Confirm a destructive or irreversible decision | `AlertDialog` (`AlertDialogAction variant="destructive"`) |
| Small contextual edit or info | `Popover` |
| Short focused form | `Dialog` |
| Keyboard-invoked palette | `CommandDialog` (instant presentation) |
| Transient feedback | `useNotify()` → toast / Halo |

Dialogs, alert dialogs and sheets are opaque `surface-elevated` over a light scrim (no blur). Popovers and menus are
`material-thick`; tooltips, hover cards and command lists are `surface-elevated`. Feature code must not build
`fixed inset-0` overlays or portals.

## 6. Sound (Cuelume)

`soundCues` (`src/lib/sound/cuelume.ts`) covers the only moments that make sound: `present`, `dismiss`, `success`,
`error`, `destructive`, `arrival`, `reveal`, `notify`. Sound is on by default at a restrained volume and is muted by
Settings → Sound, `html[data-sound=off]`, or Reduce Motion. Legacy `soundEffects` remains for code not yet migrated;
new code uses `soundCues` or the primitives (dialogs and sheets already play present/dismiss).

## 7. Appearance & accessibility

A blocking, nonce'd script in `src/app/layout.tsx` (`src/lib/design/appearance.ts`) applies the stored preferences to
`<html>` before first paint: `data-theme` (System default), `data-density`, `data-contrast`, `data-transparency`,
`data-motion`, `data-sound` and `--text-scale`. Users change them in **Settings → Appearance & accessibility**; code
reads them through `useTheme()` (`src/context/theme-context.tsx`). Variants: `motion-reduce:`, `contrast-more:`,
`transparency-reduced:`, `compact:`.

Requirements: WCAG 2.2 AA contrast; visible focus (2px tint, 2px offset); 44px targets on coarse pointers; full ARIA
patterns for custom controls; colour never carries meaning alone; layouts reflow at 130% text size.

## 8. Iconography & content

Iconoir only, `currentColor`. Size follows the text style: 14px with footnote/caption, 16px with body/headline, 18px
with title-3, 20px with titles 1–2, 24px with the large title. Icon-only buttons need an `aria-label` and a tooltip. No
emoji as icons. Sentence case for titles, buttons and headers; buttons are verbs; `Eyebrow` uppercase only for data
labels; no exclamation marks in UI chrome.

## 9. CSS architecture

- `src/styles/globals.css` imports, in order: Tailwind, `facet/tokens.css`, then the layered sheets (typography,
  utilities, animations, themes aliases, theming, components, domains, `wiki-os/tokens.css`, facet, integrations,
  layout, clerk). Route sheets: `wiki-os.css` (WikiOS), `forum.css` (Forum), `facet/lab.css` (materials lab only).
- Material and surface classes never set position, z-index, radius, margin or letter-spacing.
- Third-party overrides (Clerk, sonner, MapLibre) live unlayered in `integrations.css`/`clerk.css` with a comment.

## 10. Legacy and migration

Still supported while apps migrate (Phase 4): shadcn colour names, `FacetContainer`, `FacetMaterial` old materials,
old Button/Badge variant names, `soundEffects`, the `.facet-hierarchy-*` / `.facet-refraction` / `.facet-surface`
classes. Removed: `glass-*` classes, `*-hsl` tokens, per-domain `.facet-{domain}` production styles (lab only),
typography presets in the UI, blur on skeletons, hover/press sound ticks. See the spec's §13 migration map.

## 11. Guards

| Test | Enforces |
|---|---|
| `facet-guards.test.ts` | ≥12px text, no `transition-all`, no `scale(0)` entrances, `animate-pulse` ceiling, one blur in `DrillSheets`, one `<FacetMotionConfig>`, no lucide or stray Radix imports, no hand-drawn dot grids, no legacy `glass-*`/`*-hsl`, no arbitrary z in `components/ui`, no block elements inside `<p>`, and for converted apps (MyCountry, maps, atomic picker, Help, Country Editor): no `dark:`, no hex classes, no arbitrary z, capped gradients |
| `css-layering.test.ts` | Every sheet layered; no `!important` outside the two allowed files; no layout properties on material classes; no orphan comment closers |
| `token-contrast.test.ts` | WCAG AA for every label/tint pair in both themes |

## Changelog

- **3.0 (2026-09-30)** — Facet 3: HIG colour roles and per-app tints, text styles, concentric radii, glass materials
  for chrome only, one z scale, springs; layered CSS (~19.8k → ~12.6k lines); pre-paint appearance with Increase
  Contrast, Reduce Transparency, Reduce Motion, density and text size; new primitives (FacetList/Row, Stat,
  EmptyState, SegmentedControl, ToggleGroup, Stepper, MenuButton, SearchField, responsive Sheet); restrained Cuelume.
- **2.x** — glass depth hierarchy, physical materials, Cuelume matrix (superseded; see the audit).
