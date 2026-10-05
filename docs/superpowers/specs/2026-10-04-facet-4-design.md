# Facet 4: a content-typed material system

Date: 2026-10-04. Status: implemented (foundation + sidebar); per-app sweep in progress (2026-10-05).
Superseded the 2026-10-02 reset; [`docs/reference/facet-design-system.md`](../../reference/facet-design-system.md) is now the Facet 4 reference.

## 1. Why

The Sep 30 to Oct 2 2026 passes flattened IxStates into plain opaque cards, grey eyebrow labels and muted copy (glass references in components went from 682 to 2). The owner reads that, together with decorative AI tells (sparkles, emoji, glows, pings, blobs, `hover:scale`) and a Claude copy voice (em dashes, subtitles that restate titles), as "Claude design patterns". Facet 4 brings back the v2 material identity, strips the decoration and the voice, and gives the system a purpose beyond looks.

## 2. What Facet is

Facet is a material and physics design system for content: data, text, worldbuilding and data visualisation. It is built for IxStates and is **web-first**: pointer and keyboard, wide layouts, dense information, hover as a real state. Mobile adapts from desktop.

Depth is structural. Every piece of content in IxStates lives at a defined layer, and the **type of content** decides its material and its rules, so every page, component and element behaves the same across apps.

- **Borrowed from Apple HIG / Liquid Glass:** hierarchy through materials, concentric radii, 44px touch targets, springs, honouring every accessibility preference, one primary action per surface.
- **Facet's own:** a tinted canvas behind glass content panes, the no-glass-on-glass rule, content types as a first-class axis, per-app tints as real accents, web-first density.

## 3. Layers

| # | Name | Utility | Paint | Shadow | Radius | z |
|---|---|---|---|---|---|---|
| 0 | Canvas | `facet-canvas` (shell root) | `bg-background` + static full-bleed radial wash of `--tint`, ~6 to 8% | none | none | base |
| 1 | Pane | `facet-pane` | `--glass-fill` surface + tint wash + `--glass-hairline`; **no backdrop-filter** | `shadow-card` | `rounded-card` | base |
| 2 | Well | `facet-well` | solid `bg-surface-secondary` with ~8% tint mixed in | none | `rounded-row` | none |
| 3 | Chrome | `facet-chrome` | glass + `backdrop-filter` | `shadow-floating` | per component | `z-chrome` |
| 4 | Overlay | `facet-overlay` | thickest glass + `backdrop-filter`, over a scrim | `shadow-sheet` | `rounded-sheet` | `z-sheet` / `z-popover` |

Rules:
- Glass never sits directly on glass. A Card inside a Card renders as a Well. Overlays sit on a scrim.
- Panes skip `backdrop-filter`: only the static, soft canvas wash is behind them, so blur adds GPU cost and no visible change. Real blur is for Chrome and Overlay, where content scrolls underneath.
- Reduce Transparency makes layers 1, 3 and 4 opaque. Increase Contrast strengthens hairlines and labels. Both themes are supported; light mode uses white frosted glass over a lighter wash.

## 4. Colour

- Tint is a real accent everywhere: section-title icons, a Pane's top hairline, Well fills, progress bars, key figures.
- Semantic colours (destructive, warning, success, info) always win over tint where they carry meaning.
- One primary action per surface (unchanged).
- Retired: the "v2 identity in four places only" rule, `material-hero`, Halo's indigo glow, all `--glow-*` tokens.
- Charts use only `chart-1..8` and semantic tokens. The map gets a token ramp in place of its hex colours.

## 5. Content types

Set with `<Card content="...">` or `data-content` on any element. CSS scoped to `[data-content=...]` in `layers.css` applies the standard, the same mechanism `data-app` uses for tint.

| Type | Surface | Type scale | Density / measure | Behaviour |
|---|---|---|---|---|
| Prose | Pane | `text-body` 17px, 1.6 leading; `title-2`/`title-3` headings | 70ch measure | no Wells inside except Embeds; tint-underlined links. Variant: *Annotation* (margin notes) |
| Data | Pane, rows are Wells | `text-callout`; `tabular-nums`, right-aligned figures | 36px rows (44 coarse) | `fill-4` row hover; units always; sortable headers; empty cell is "–". Variant: *Comparison* (diffs) |
| Visualization | flush Pane | axis `text-caption` | fills container | `chart-1..8` + semantic only; tooltips are Overlays; the map is the Canvas and everything over it is Chrome |
| Entity | `EntityHeader` on Canvas, then Panes | name `large-title`; facts `callout` | facts in a 2 to 4 column Well grid | the only place for identity art (flag, emblem, watermark) |
| Collectible | `CutoutCard` | `headline` | min-width grid | art keeps its palette, never tinted. Variant: *Listing* (adds price row) |
| Input | Pane, fields are Wells | labels `subhead` | 8px field rhythm | focus ring, inline validation, full keyboard. Variants: *Flow* (stepper in Chrome, one Pane per step), *Workspace* (tools over a Visualization: map editor, Vexel, lineup boards), *Commit* (Directives: one primary + confirm) |
| Feed | Pane list | `callout`; stamps `caption` | separator-divided, not boxed per item | relative IxTime. Variant: *Conversation* (chat) |
| Signal | `Signal` banner Pane, semantic colour | `headline` + one line | full width, top of section | at most one per section; dismissible unless critical |
| Navigation | Chrome | `body` | 36px rows | source-list sidebar, toolbars, tabs |
| Transient | Overlay + scrim | per component | n/a | Dialog, Sheet, Popover, toast |
| Reveal | Overlay on a full-bleed art stage | `large-title` figure | centred | art keeps its palette; one spring entrance; `reveal` sound cue; Reduce Motion fades |

Embed rule: live data embedded in another type (stat cards in posts) is always a Well.

Applies to every type:
- Section title is a tinted icon plus `text-headline`. No eyebrow above it.
- A subtitle only when it adds information the title lacks.
- `Stat` is a large tinted figure with a regular-case label below. No uppercase labels.

## 6. Layout

- **Sidebar:** a macOS source list. Every app is a top-level row; the current app discloses its sections; widgets (Vault balance, daily reward, active country) are native sidebar items. The app switcher dropdown, every per-app sidebar and the `[data-app-subnav]` hiding rule are deleted. Phones keep the TabBar and More sheet. Detailed in its own spec (sub-project 3).
- **Inspector:** at most one trailing column per page, 320px, sticky, for Entity details, a table of contents or supporting Data in Wells. It becomes a Sheet below 1280px. It replaces the hand-rolled rails (MyCountry StandingBands/census, WikiOS TOC, Sports focus panel, map country panel, Factbook/Dossier sidebars).
- **Headers:** `PageHeader` for pages, `EntityHeader` for entity pages. No hero card as a header.

## 7. CSS and TS architecture

Four Facet files, one job each:

| File | Holds |
|---|---|
| `src/styles/facet/tokens.css` | raw values only: colour roles, tints, type, radius, spacing, motion, z |
| `src/styles/facet/layers.css` | the five layers and the content-type scopes; the **only** file allowed `backdrop-filter`, glass fill, hairline or elevation; transparency and contrast fallbacks |
| `src/styles/facet/interaction.css` | press, lift, focus (from `physics.css` and identity press) |
| `src/styles/facet/shell.css` | navigation variables (unchanged) |

Deleted: `facet/core.css`, `facet/physics.css`, `facet/components.css`, `facet/overrides.css`, `facet/identity.css`, `src/styles/facet.css`; legacy `--color-glass`, `--color-surface-blur` and the `.light` class in `themes.css`; `material-*` utilities; TS mirrors in `src/lib/design/tokens.ts` with no real importers (`GLASS_HERO`, `ACRYLIC`, `PHYSICS`, verified per symbol before removal). Achievement aurora and foil move to `card-art.css` as content art; `facet-radiance` and `facet-ghost-heraldry` are deleted.

## 8. Primitives

| Primitive | Change |
|---|---|
| `Card` | default is the Pane; provides context so a nested `Card` is a Well; `variant="well"` replaces `inset` (codemod); `hero` deleted; new `content` prop; `CardTitle` gets an `icon` prop |
| `FacetMaterial` | `material=thin/regular/thick/hero/acrylic` becomes `layer="chrome" or "overlay"` (codemod, 46 files) |
| `Dialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip` | `facet-overlay` over a scrim |
| `Stat` | large tinted figure, regular-case label below |
| `EntityHeader` (new) | unboxed on Canvas: identity art, name, facts slot, one primary action |
| `Signal` (new) | inline semantic banner |
| `Inspector` (new) | trailing column, Sheet below 1280px |
| `RevealStage` (new) | `Dialog` variant with a full-bleed art stage |
| `FacetShell` | paints `facet-canvas` on the shell root |
| `Eyebrow`, `text-stat-label` | kept during the sweep, deleted at its end |

## 9. Copy

Sentence case; capitalised product nouns (unchanged). No em dashes in UI strings: use a full stop, comma, colon or "·" separator, and "–" for an empty value. No subtitle that restates its title. No filler or AI phrasing ("Detailed X metrics", "in O(1) time", "seamless", "comprehensive", "unlock").

## 10. Guards and verification

- Architecture test: `backdrop-filter`, glass fills and elevation only in `facet/layers.css`.
- Ratchet test: records current counts of eyebrows, uppercase stat labels, em dashes in JSX strings, `Sparks`, emoji, `hover:scale`, hex colours and raw palette classes; a count may only fall. At zero, each becomes a ban.
- Contrast test rewritten: AA for label roles on the Pane fill over the wash, both themes.
- Unit tests: nested `Card` renders a Well; `content` sets `data-content`.
- Gates: `typecheck:*`, Jest, lint. No builds. Browser screenshots of about six pages, both themes, before and after.

## 11. Sub-projects and order

1. **Foundation** (this spec, sections 3 to 10).
2. **Daily reward modal** (section 12).
3. **Sidebar** (own spec): source list, native widgets, delete per-app sidebars and `data-app-subnav`, restore features that only lived in hidden navigation (MyCountry inbox badge and domain peeks, forum Reply/Share).
4. **Per-app sweep**, one app per pass: content types and Inspector applied, hero headers to `EntityHeader`, eyebrows and stat labels removed, copy cleaned, decoration stripped, own CSS folded in (WikiOS 5,932 lines, `forum.css` 638), Sports `SportsShell` main Card removed, WikiOS reduced to one main-page design. Order follows the audit's severity: MyCountry and Dashboard, Sports, Vault and Achievements, WikiOS, Builder, ThinkPages and Forum, Maps, country profiles.

## 12. Daily reward modal

File: `src/components/vault/DailyBonusWidget.tsx`. Based on the pre-`e02aa5a15` version, rebuilt on Facet 4.

- **Trigger:** tinted "Daily reward" button with the streak count while claimable; greyed "Daily claimed · Nd streak" state after claiming (restored). Lives in `VaultWidget` until the sidebar sub-project moves it to a native sidebar row under Vault.
- **Choice screen** (Overlay): trophy, "Daily reward" in `text-title-3`, streak pill on the right; no description line. Two Well tiles in **Vault copper** (tint): IxCredits ("Random roll, boosted by level and streak") and Card pull ("One random card"), each with a round tinted icon badge. Hover is a colour change; press is `facet-press`. Removed: progress bar, eyebrow, "Maybe later".
- **Reward screen** (Reveal): "Reward claimed"; credits as a large `tabular-nums` `+N` with the IxCredits symbol, scaling in from 0.95; card art slides in from a -2° tilt with a title strip and rarity badge; streak pill; primary "Collect", plus "View collection" for cards.
- **Kept behaviour:** auto-open once per user per UTC day; no dismissal mid-claim; resync and close on an "already claimed" error; no duplicate success toast; accurate copy.

## 13. Versioning

- `FACET_VERSION` 3.1 to 4 and `HALO_VERSION` 5 to 6 with the foundation.
- Platform 1.4.0 to 1.5.0 ("Lobster Crosby", Release Candidate) when the sweep completes.
- `docs/reference/revision.md` and the changelog updated with each bump.
