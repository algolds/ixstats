# Facet design system

The canonical UI reference for Facet 4 (2026-10-04). Design rationale: [`docs/specs/2026-10-04-facet-4-design.md`](../specs/2026-10-04-facet-4-design.md).

Sources of truth: `src/styles/facet/tokens.css` (raw values), `layers.css` (the five layers and the content-type scopes), `interaction.css` (press, lift, primary and gold paints, preference kill switches), `shell.css` (navigation variables), `src/styles/card-art.css` (content art, imported globally) and `src/styles/textures.css`, `src/lib/design/{appearance,motion,tokens}.ts`, `src/components/ui/**`, `src/components/shell/**`.

Reuse a primitive before writing one. If a primitive is missing, add it to `src/components/ui/`.

## 1. Identity

Facet is a material and physics design system for content: data, text, worldbuilding and data visualisation. It is built for IxStates and is web-first: pointer and keyboard, wide layouts, dense information, hover as a real state. Mobile adapts from desktop.

Depth is structural. Every piece of content lives at a defined layer, and the type of content decides its material and its rules, so every page, component and element behaves the same across apps.

Borrowed from Apple HIG and Liquid Glass:

- Hierarchy through materials.
- Concentric radii.
- 44px touch targets.
- Springs.
- Honouring every accessibility preference.
- One primary action per surface.

Facet's own:

- A tinted canvas behind glass content panes.
- The no-glass-on-glass rule.
- Content types as a first-class axis.
- Per-app tints as real accents.
- Web-first density.

## 2. Theme and colour

- Dark-first. With no stored choice the theme follows the OS and falls back to dark when the OS states no light preference. The choice is written to `html[data-theme="light"|"dark"]` before first paint by the inline script `APPEARANCE_INIT_SCRIPT` (`src/lib/design/appearance.ts`), which `AppearanceInitScript` (`src/components/providers/AppearanceInitScript.tsx`) writes once into the server's `<head>` with the request's CSP nonce (`useServerInsertedHTML`, never a React `<script>` element; `src/tests/components/appearance-init-script.test.tsx`). The same script sets WikiOS's picture mode, `data-media-theme` (`auto` | `plinth`), which `wiki-os/foundations.css` themes pictures by. Light mode is white frosted glass over a lighter wash.
- Write colour as roles, never hex or Tailwind palette steps. Roles switch with the theme, so feature code has no `dark:` overrides.

| Role | Tokens |
|---|---|
| Text | `text-label`, `text-label-secondary`, `-tertiary`, `-quaternary` |
| Surfaces | `bg-background`, `bg-background-grouped`, `bg-surface`, `bg-surface-secondary`, `bg-surface-elevated` |
| Fills | `bg-fill`, `bg-fill-2`, `bg-fill-3`, `bg-fill-4` (hover and pressed backgrounds, tracks) |
| Lines | `border-separator`, `border-separator-opaque` |
| System colours | `red orange yellow green teal blue indigo purple pink mint cyan brown gray`, each with `on-*` and `*-ink` (ink is the legible text colour on its own 15% fill) |
| Status | `destructive`, `warning`, `caution`, `success`, `info`, each with `on-*` and `*-ink` |
| App tint | `tint`, `tint-hover`, `on-tint`, `tint-fill`, `tint-ink` |
| Primary action | `bg-primary-fill`, `hover:bg-primary-fill-hover`, `text-on-primary` (the `facet-primary` utility paints the same on a non-Button) |
| Gold | `facet-gold` utility (progress fills, step markers, count pills) |
| shadcn aliases | `foreground`, `card`, `popover`, `muted`, `accent`, `border`, `ring`, `chart-1..8` |

- `facet-on-dark` (utility) rebinds `red yellow green blue indigo` to their dark-theme values for its subtree. Use it for content on a fixed dark scrim or overlay (a reveal stage) so it stays legible in light mode. Only raw role utilities such as `text-green` and `bg-yellow` pick it up; derived tokens (`*-ink`, `success`, `destructive`) are not rebound.
- App tints come from `data-app` on the app root, which sets `--tint*` for its subtree. Never inline `--tint`.

The app palette has one colour per app, never shared:

- **Brand colours.** Two tints are logo colours and fixed: MyCountry gold, and the IxWiki navy from the original logo (`#1d4e89`).
- **Even spacing.** The rest sit evenly in the two OKLCH hue gaps those leave, at one lightness per mode (0.50 light, 0.78 dark), so no app reads louder than another.
- **Ink default.** The default (Home, Help, Settings, Admin) is not a colour but a warm ink, chroma under 0.04, so the apps carry the colour. A colourful default could only be violet, the free hue between the wiki navy and Realms.
- **Enforced.** `app-palette.test.ts` holds every pair at least 30 degrees apart in hue in both modes, and every non-brand tint at the shared lightness.
- **Adding a tint.** Nine hues is the ceiling: one more drops the spacing below 30 degrees. A new app or section wears its parent's tint unless one is removed.

| `data-app` | Tint | OKLCH hue |
|---|---|---|
| none, `admin` | Warm ink (Home, Help, Settings, Admin) | none (60, chroma 0.03) |
| `mycountry` | Gold (brand) | 49 light, 84 dark |
| `wiki` | IxWiki navy (brand) | 255 |
| `labs` | Green (also MyLeague and MyClub) | 127 |
| `thinkpages` | Emerald | 170 |
| `maps` | Cyan | 212 |
| `realms` | Purple | 302 |
| `vault` | Raspberry | 338 |

The Forum Red tint (hue 13) was retired with the XenForo bridge app in ThinkPages forum phase 4b; the native forum wears ThinkPages' emerald.

- `data-app="builder"` changes only the primary action (flat gold); its tint stays the default.
- `data-app="thinkpages"` also paints its primary action in the app tint, so the forum's New thread, Post and Reply read as ThinkPages' own.

Tint is a real accent everywhere:

- Section-title icons (`CardTitle icon`).
- A pane's top wash.
- Well fills.
- Progress bars.
- Key figures (`Stat`).

Semantic colours (destructive, warning, success, info) always win over tint where they carry meaning. One primary action per surface. Charts use only `chart-1..8` and semantic tokens.

- Radius (concentric): `rounded-sheet` for overlays, `rounded-card` for panes, `rounded-row` for wells and rows, `rounded-control-lg`, `rounded-control`, `rounded-control-sm` for controls, `rounded-full` for chips and avatars. `rounded-cutout` belongs to `CutoutCard` only. Values live in `tokens.css`.
- Elevation: `shadow-card`, `shadow-floating`, `shadow-sheet`. Layers apply them; do not add shadows to a layer by hand.
- z-index: use the named scale (`z-sticky`, `z-chrome`, `z-sheet`, `z-popover`, `z-toast`, `z-command`). No arbitrary `z-[...]` in `components/ui`.
- Spacing: Tailwind 4px scale, 8px rhythm. Avoid `x.5` steps except hairline tweaks.

## 3. Layers

Every surface is one of five layers. All glass, blur, hairline and elevation live in `src/styles/facet/layers.css`, as Tailwind utilities.

| # | Name | Utility | Paint | Shadow | Radius | z |
|---|---|---|---|---|---|---|
| 0 | Canvas | `facet-canvas` (shell root) | `bg-background-grouped` plus a static full-bleed radial wash of `--tint` | none | none | base |
| 1 | Pane | `facet-pane` | translucent surface fill, a tint wash and a glass hairline; no `backdrop-filter` | `shadow-card` | `rounded-card` | base |
| 2 | Well | `facet-well` | solid `bg-surface-secondary` with a little tint mixed in | none | `rounded-row` | none |
| 3 | Chrome | `facet-chrome` | glass with `backdrop-filter` | `shadow-floating` | per component | `z-chrome` |
| 4 | Overlay | `facet-overlay` | thickest glass with `backdrop-filter`, over a scrim | `shadow-sheet` | `rounded-sheet` | `z-sheet` / `z-popover` |

Components that provide each layer:

- Canvas: `AppShell` paints `facet-canvas` on its root, in the current app's tint through `data-app`. Chromeless routes (`data-chromeless`) skip it.
- Pane: `Card`. Well: a `Card` nested inside a `Card`, or `variant="well"`.
- Chrome: `FacetMaterial layer="chrome"` (sidebar, tab bar, toolbars, map controls, Halo).
- Overlay: `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `HoverCard`, `Select`, `Tooltip`, toasts, and `FacetMaterial layer="overlay"`.

Rules:

- Glass never sits directly on glass. A `Card` inside a `Card` renders as a Well. Overlays reset this: `SurfaceReset` makes a `Card` inside a Dialog, Sheet or Popover a pane again.
- Panes have no `backdrop-filter`. Only the static, soft canvas wash is behind them, so blur would add GPU cost and no visible change. Real blur is for Chrome and Overlay, where content scrolls underneath.
- Layer utilities paint only. They never set position, z-index, radius, margin or letter-spacing; the component owns those.
- Reduce Transparency makes Pane, Chrome and Overlay opaque. Increase Contrast strengthens hairlines and labels. Both themes are supported.
- Do not write `backdrop-blur-*`, glass fills or elevation outside `layers.css`.

## 4. Content types

Set the type with `<Card content="...">`, or `data-content` on any element. CSS scoped to `[data-content=...]` in `layers.css` applies the standard, the same mechanism `data-app` uses for tint. `ContentType` is exported from `~/components/ui/card`.

| Type | Surface | Type scale | Density and measure | Behaviour |
|---|---|---|---|---|
| `prose` | Pane | `text-body` at 17px with 1.6 leading; `text-title-2` and `text-title-3` headings | 70ch measure | No Wells inside except Embeds. Links are tint-underlined. Variant: Annotation (margin notes) |
| `data` | Pane, rows are Wells | `text-callout`; `tabular-nums`, right-aligned figures | 36px rows (44px on coarse pointers) | `fill-4` row hover. Units always. Sortable headers. An empty cell is "–". Variant: Comparison (diffs) |
| `visualization` | Flush Pane | Axis labels in `text-caption` | Fills its container | `chart-1..8` and semantic colours only. Tooltips are Overlays. The map is the Canvas and everything over it is Chrome |
| `entity` | `EntityHeader` on the Canvas, then Panes | Name in `text-large-title`; facts in `text-callout` | Facts in a 2 to 4 column Well grid | The only place for identity art (flag, emblem, watermark) |
| `collectible` | `CutoutCard` | `text-headline` | Min-width grid | Art keeps its palette and is never tinted. Variant: Listing (adds a price row) |
| `input` | Pane, fields are Wells | Labels in `text-subhead` | 8px field rhythm | Focus ring, inline validation, full keyboard. Variants: Flow (stepper in Chrome, one Pane per step), Workspace (tools over a Visualization: map editor, Vexel, lineup boards), Commit (Directives: one primary plus a confirm) |
| `feed` | Pane list | `text-callout`; timestamps in `text-caption` | Separator-divided, not boxed per item | Relative IxTime. Variant: Conversation (chat) |
| `signal` | `Signal` banner Pane in a semantic colour | `text-headline` plus one line | Full width, top of its section | At most one per section. Dismissible unless critical |
| `navigation` | Chrome | `text-body` | 36px rows | Source-list sidebar, toolbars, tabs |
| `transient` | Overlay and scrim | Per component | n/a | Dialog, Sheet, Popover, toast |
| `reveal` | Overlay on a full-bleed art stage | `text-large-title` figure | Centred | Art keeps its palette. One spring entrance. The `reveal` sound cue. Reduce Motion fades |

Enforced by `layers.css` today, and nothing more:

- `prose`: 70ch measure, 17px body size, 1.6 leading, and underlined links in the tint ink (the tint pulled toward the label, so they pass AA on the washed pane).
- `data`: `tabular-nums`, and the `fill-4` row hover on `tbody tr` and `[data-row]`.
- `visualization`: no padding, clipped overflow.
- `feed`: a separator between items.

Everything else in the table is enforced by the primitive that owns the type (`EntityHeader`, `Signal`, `RevealStage`, `CutoutCard`, `Stat`) or by the per-app sweep, not by CSS: the prose heading scale (`text-title-2` and `text-title-3`), the 36px and 44px data rows, right-aligned figures, the "–" empty cell, units, sortable headers, chart colours, the Well grid for facts, and the input field rhythm.

Embed rule: live data embedded in another type (stat cards in a post) is always a Well.

Three rules for every type:

- A section title is a tinted icon plus `text-headline` (`<CardTitle icon={...}>`). No eyebrow above it.
- A subtitle only when it adds information the title lacks.
- `Stat` is a large tinted figure with a regular-case label below. No uppercase labels.

### Facet exceptions

Recorded departures from a rule above. An exception is scoped to the surface named here and does not generalise.

1. **Country flags in forum author lines and lists (ThinkPages forum).** Identity art otherwise stays in `entity` cards. The forum's identity is the player's country, as on an RMB, so a flag beside an author name in a post header, thread row or list is allowed. Flags stay small and are never used as backdrops or watermarks.
2. **Board chips on phones (ThinkPages realm landing).** On phones the realm landing shows its boards as a horizontal chip row under the realm header, although `navigation` is otherwise the sidebar and More sheet only. The boards are the realm's content list, not app navigation, and the rail is hidden on phones, so the chips are the only place they can sit.

## 5. Type

- Font: Schibsted Grotesk, weights 400 to 800 (`font-sans`). Do not set another family.
- Use the text styles, not raw `text-sm`/`text-xl`. Sizes scale with the user's text size (`--text-scale`, 0.9 to 1.3).

| Utility | Use |
|---|---|
| `text-display`, `text-large-title`, `text-title-1` | Headings. Weight 700, tracking -0.015em. `text-large-title` is the page `<h1>` in `PageHeader` and the name in `EntityHeader` |
| `text-title-2`, `text-title-3`, `text-headline` | Smaller titles. Weight 600 |
| `text-body`, `text-callout`, `text-subhead`, `text-footnote`, `text-caption` | Running text and secondary text |
| `text-eyebrow` (or `Eyebrow`) | Being removed: do not add |
| `text-stat-label` | Being removed: do not add |

- Figures use `tabular-nums`. Numbers are not mono by default.
- `font-data` (Azeret Mono) is for IDs, codes and coordinates only. Never for prices, counts, percentages or stats.
- No uppercase labels.
- Minimum text size is 12px.

## 6. Primitives

Import from `~/components/ui/*`. Feature code never imports `@radix-ui/*`; the wrappers own that. Icons are `iconoir-react` (`lucide-react` is not installed).

### Page structure

- `PageHeader` (`~/components/shell`) gives every app and page its title: the one `<h1>`, plus a back button and trailing actions in a sticky toolbar that collapses to a compact title on scroll.
  - No hero card as a header.
  - No subtitle that restates the title. Use `subtitle` only when it says something the title does not.
  - `ShellPageHeader` and `shellPageTitleProps` handle pages that own their title (see `shell.css`).
- `EntityHeader`: the header of an entity page (country, person, organisation). Unboxed on the Canvas. Props: `art` (identity art), `name` (the `<h1>`), `facts`, and at most one `action`. It sets `data-content="entity"`.
- `Card` is a Pane at the top level and a Well inside another `Card`.
  - `variant`: `pane | well`. Leave it unset and let nesting decide; set `well` to force the inset look.
  - `content`: a `ContentType` (section 4). Sets `data-content`.
  - `padding`: `none | sm | md | lg`. A pane defaults to `none` (parts supply padding); a well defaults to `md`.
  - `interactive` adds press and lift feedback and makes a clickable card a keyboard-operable button.
  - Parts: `CardHeader`, `CardTitle` (takes an `icon`, rendered tinted), `CardDescription`, `CardContent`, `CardFooter`.
  - `SurfaceReset` marks an overlay surface so Cards inside it are panes again. The overlay primitives already wrap their children in it.
- `CutoutCard` is the feature or media card with the notched corner, the surface for collectibles. Dense UI (lists, tables, forms) uses `Card`.
- `FacetMaterial layer="chrome" | "overlay"` (default `chrome`) is the primitive for floating glass. Do not use it for content cards.
- `Signal`: an inline semantic banner. Props: `tone` (`info | success | warning | destructive`), `title`, optional body, optional `onDismiss` (omit for critical signals). At most one per section.
- `Inspector`: the one optional trailing column of a page, 320px wide and sticky from 1280px up, a `Sheet` below that. Props: `title`, `open`, `onOpenChange`. Use it for entity details, a table of contents or supporting data in Wells.
- `RevealStage`: a `Dialog` with a full-bleed `art` stage and a centred title, for pack openings and claimed rewards. It plays the `reveal` sound cue on open.
- `FlagWatermark` (`~/components/ui/facet`) is identity art for entity pages and heroes that have not moved to `EntityHeader` yet. Do not add it elsewhere.

### Actions and data

- `Button`: variants `default | destructive | outline | secondary | ghost | link`; sizes `default | xs | sm | lg | icon | icon-sm | icon-lg`.
  - `default` is the primary and is monochrome. Inside `data-app="mycountry"` and `"builder"` it is flat gold, and inside `data-app="thinkpages"` it is the emerald app tint. Never hand-roll a gold or gradient button.
  - Pressed is a colour change. There is no scale and no glow.
  - One primary per surface. Use `asChild` to render a link.
- `Badge`: 7 variants (`default`, `secondary`, `success`, `warning`, `destructive`, `info`, `outline`). Status and count chips only. Pair colour with text or an icon.
- `Stat`: a large tinted figure with its label below in regular case. Props: `label`, `value`, optional `delta` (direction and sentiment), `hint`, `icon`; `size="sm" | "md"`. The value is `tabular-nums`.
- `FacetList`, `FacetListSection`, `FacetRow`: inset grouped lists. Sections have sentence-case headers; rows are at least 44px; use the `plain` variant inside a `Card`. Rows can be links, buttons or swipeable.
- `EmptyState`: icon, title, message, at most one action.

### Choice controls (Radix-based, roving tabindex included)

| Need | Use |
|---|---|
| Switch between page-level sections | `Tabs` (`TabsList`, `TabsTrigger`, `TabsContent`) |
| 2 to 5 short peer views or periods | `SegmentedControl` (`asTabs` when it switches panels) |
| Multi-select filters, or toggle buttons | `ToggleGroup` with `ToggleGroupItem` |
| One choice with a title and description each | `RadioCardGroup` and `RadioCard` |
| On/off setting | `Switch` |

Name every group with `aria-label` or `aria-labelledby`. Never hand-roll roving tabindex or arrow-key handling.

### Overlays

- `Sheet` for tasks, detail views and multi-step flows. It is a right side sheet at 768px and up and a bottom sheet with `medium`/`large` detents below. `size="wide"` is for two-column details.
- `Dialog` and `AlertDialog` for short confirmations. Popovers, menus and tooltips use the `ui` wrappers.
- All of them paint `facet-overlay`. Do not restyle their surface.

## 7. Layout

- The sidebar is a macOS source list (`SourceList`, in `AppSidebar` at 1024px and up: 256px, collapsible to 64px icons, where rows become icons with popovers). It has two levels: every app is a top-level row and the current app discloses its sections. Admin and Settings use area mode: their sections are grouped under sub-headings and replace the app list while you are inside them. Rows carry badges (active country flag, diplomacy inbox count, Vault balance) and a Daily reward action row opens the reward dialog. Below 1024px the `TabBar` holds the primary apps and its More sheet reuses the same `SourceList`.
- The sidebar and the More sheet are the only navigation. A page renders no navigation of its own (no tab rail, pill bar or hidden sub-nav); in-page `Tabs` switch views of one thing, not destinations.
- Both read the one section map in `src/lib/navigation/app-sections.ts`. Add a destination there, not in a page.
- Halo is the floating island at the top, in Chrome glass. `PageHeader` keeps `--shell-halo-reserve` clear for it. Do not build a second top bar.
- `AccountMenu` is the account: `layout="sidebar"` is a popover from the sidebar footer, `layout="sheet"` is inline in the More sheet.
- Layout variables (read, never redefine): `--shell-sidebar-width`, `--shell-tabbar-height`, `--shell-top-offset`, `--shell-header-top`, `--shell-halo-reserve`. Sticky rails use `top-(--shell-top-offset)`.
- Chromeless routes (Maps, full-screen editors) set `data-chromeless` on the app shell.
- Inspector: at most one trailing column per page. It replaces hand-rolled side rails.
- Headers: `PageHeader` for pages, `EntityHeader` for entity pages. No hero card as a header.

## 8. Motion and feedback

- Use the named motion from `src/lib/design/motion.ts` and the matching CSS tokens. No ad hoc spring numbers.
  - Springs: `springSnappy` (controls), `springSmooth` (sheets, sidebar, layout), `springGentle` (emphasis, reveals).
  - Tweens: `tweenFast` 150ms for colour and opacity, `tweenExit` 120ms (exits are faster than entrances), `EASE_OUT_FACET`.
  - In CSS: `duration-fast`, `duration-exit`, `ease-out-facet`.
- Press feedback:
  - Controls change colour (Button, Switch, rows, segments).
  - `facet-press` (scale 0.98; `facet-press-sm` 0.95; `facet-press-subtle` 0.99) and `facet-lift` are only for pressable cards and tiles. `Card interactive` applies both.
  - Never `transition-all`, never a `scale(0)` entrance.
- Sounds (Cuelume): play only the `soundCues` moments (present, dismiss, success, error, destructive, arrival, reveal, notify). No hover ticks and no per-control `data-cuelume-*` attributes in new code.
- Preferences are written to `<html>` and must all keep working. Use the Tailwind variants, not raw media queries:
  - Reduce Motion: `motion-reduce:` (honours `data-motion="reduced"`). Springs fall back to `REDUCED_MOTION_FADE`.
  - Reduce Transparency: `transparency-reduced:`. Glass tokens become opaque.
  - Increase Contrast: `contrast-more:`. Separators, labels and tints get stronger.
  - Text size: `--text-scale`, 0.9 to 1.3. Use the text styles so it applies.
  - Density: `compact:` variant. Control heights are `--control-height-sm|md|lg`; use them, not fixed heights.
  - Sound off: `data-sound="off"`.
- Targets are at least 44px on coarse pointers (`hitSlop`). Focus is a 2px tint outline (`focusRing`).

## 9. Copy

- Sentence case everywhere: buttons, headings, labels, tabs. Capitalise product nouns: IxStats, MyCountry, Directive(s), ThinkPages, IxVault, Halo, IxTime, IxWorld, WikiOS.
- Say what the thing is and does. Empty states say what is missing and what to do next ("No drafts yet. Start one from the Builder."). Errors say what happened and how to recover.
- No em dashes in UI strings. Use a full stop, comma, colon or "·" as a separator, and "–" for an empty value.
- No subtitle that restates its title.
- Banned: filler, taglines, AI phrasing ("Detailed X metrics", "in O(1) time"), and the words seamless, powerful, "at a glance", "command center", unlock, comprehensive.
- Numbers keep units and context ("$1.2T", "+2.4% vs. last year").

## 10. Code comments

- Comments explain why, not what.
- Never write spec section citations (`§7.1`), commit hashes, version provenance ("v2", "Facet 3.1", "restored from") or contrast ratios in code comments. They rot and mislead.

## 11. Do not

- Put glass on glass, or stack translucent layers (blur on blur).
- Use `backdrop-blur-*`, glass fills or custom elevation outside `src/styles/facet/layers.css`.
- Use a hero card as a header.
- Add eyebrows (`Eyebrow`, `text-eyebrow`) or uppercase labels (`text-stat-label`, uppercase tracked text).
- Use emoji in UI.
- Add decorative `Sparks`.
- Use `hover:scale-*`.
- Add glows, glow blobs or glow tokens (`--color-*-glow`), or `animate-ping` pulses.
- Put gradients on UI (buttons, palette gradient stops). Gradients belong to content art in `card-art.css`.
- Use `[#hex]` colours or raw palette steps.
- Use `dark:` overrides.
- Use `!important` (the preferences section of `interaction.css` is the one exception).
- Use arbitrary z-index, or inline `--tint`.
- Set body or stat figures in `font-data` or `font-mono`.
- Hand-roll roving tabindex, tab lists, radio groups or switches.
- Import `@radix-ui/*` in feature code, or add `lucide-react`.
- Bring back removed names: `material-*` utilities, `material-hero`, `material-acrylic`, Card `hero` and `inset`, `FacetMaterial material=...`, `FacetCard`, `FacetContainer`, `FacetTabs`, `TintGlow`, `AcrylicGlow`, HIG button variants (`filled`, `tinted`, `plain`), or more than 7 badge variants.

## 12. CSS architecture

Four Facet files, one job each:

| File | Holds |
|---|---|
| `src/styles/facet/tokens.css` | Raw values only: colour roles, tints, type, radius, spacing, motion, z |
| `src/styles/facet/layers.css` | The five layers and the content-type scopes. The only file allowed `backdrop-filter`, glass fill, hairline or elevation. Transparency and contrast fallbacks |
| `src/styles/facet/interaction.css` | Press, lift, primary and gold paints, focus, preference kill switches |
| `src/styles/facet/shell.css` | Navigation variables |

Beside them: `src/styles/card-art.css` holds content art (card faces, holographic layers, achievement aurora and foil) that keeps its own palette, and `src/styles/textures.css` holds the `TextureOverlay` textures.

- `src/styles/globals.css` imports `facet/tokens.css` first, then `facet/layers.css` and `facet/interaction.css`, the other sheets, and `facet/shell.css` last. Everything is in `@layer`, so a Tailwind utility on the same element always wins.
- A token that mixes `--tint` is composed at the element (`layers.css`), not on `:root`, so each `data-app` scope resolves its own tint.
- Third-party overrides (Clerk, sonner, MapLibre) live in `integrations.css` and `clerk.css` with a comment.

## 13. Guards

The tests under `src/tests/architecture/` enforce parts of this file. Run the relevant one when you change tokens, layers or a primitive.

- `facet-layers.test.ts`: the five layer utilities exist; only Chrome and Overlay blur; `layers.css` is the only Facet sheet that blurs or paints glass; exactly four Facet sheets; no `material-*` class or `material=` prop; the content-type scopes.
- `facet-ratchet.test.ts`: counts of eyebrows, uppercase stat labels, em dashes, `Sparks`, emoji, `hover:scale`, hex classes, raw palette classes and `animate-ping` may only fall. Lower the baseline with `UPDATE_FACET_RATCHET=1 bun run test -- facet-ratchet` after removing tells.
- `token-contrast.test.ts`: CSS tokens match `src/lib/design/tokens.ts`; AA contrast for label, tint and ink pairs, and for labels on the Pane over the tinted canvas and on Chrome, in both themes; Reduce Transparency and Increase Contrast make every layer opaque.
- `css-layering.test.ts`: every Facet sheet is layered (no top-level rules, no `!important`), and utilities set no position, z-index, radius, margin or letter-spacing.
- `facet-guards.test.ts`: no `transition-all`, sub-12px text, arbitrary z-index, `dark:` or hex classes in converted apps, `@radix-ui` outside `src/components/ui`, `lucide-react`, removed decoration, or raw `backdrop-blur-*`; gradients and textures stay on sanctioned classes.
