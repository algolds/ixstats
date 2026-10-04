# Facet design system

The canonical UI reference. Reset on 2026-10-02: the Facet 3 / 3.1 decoration layer (refraction, rims, retint, glow props, acrylic chrome, auto-mono numerals, eyebrow-title-subtitle heroes, HIG button names) was removed. This file describes what exists now. The old spec in `docs/specs/2026-09-30-facet-3-design-system.md` is history only.

Sources of truth: `src/styles/facet/tokens.css` (tokens), `layers.css` (the five glass layers), `interaction.css` (press, lift, primary and gold paints, preference kill switches), `card-art.css` (flag watermark and achievement layers), `shell.css` (navigation variables), `src/lib/design/{appearance,motion,tokens}.ts`, `src/components/ui/**`, `src/components/shell/**`.

Evolve the existing design. No redesign without an explicit owner request.

## 1. Principles

- Apple HIG plus anti-slop. A plain opaque card is the default surface.
- Glass is for floating chrome only: sidebar, tab bar, sheets, popovers, toolbars, map overlays. Glass never holds more glass; anything inside it uses opaque roles.
- One hero per app at most, and not on every page.
- The v2 identity is allowed only in four places: the dashboard hero, the MyCountry hero, Halo, and achievements.
  - Gold primary for MyCountry and the Builder.
  - `material-hero` glass with the `FlagWatermark`.
  - Halo's `material-acrylic` glow.
  - Achievement aurora, foil and jewel layers (`card-art.css`).
- Everywhere else: opaque cards, and tint only for interaction (selection, links, focus, the one primary action).
- Reuse a primitive before writing one. If a primitive is missing, add it to `src/components/ui/`.

## 2. Theme

- Dark-first. With no stored choice the theme follows the OS and falls back to dark when the OS states no light preference. The choice is written to `html[data-theme="light"|"dark"]` before first paint by the inline script in `src/app/layout.tsx` (`src/lib/design/appearance.ts`).
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

- App tints come from `data-app` on the app root, which sets `--tint*` for its subtree. Never inline `--tint`.

| `data-app` | Tint |
|---|---|
| none, `admin` | Indigo |
| `mycountry` | Gold |
| `intel` | Crimson (also resets the primary to monochrome) |
| `maps` | Sky |
| `thinkpages` | Emerald |
| `vault` | Copper |
| `forum` | Orange |
| `wiki` | Ink indigo |
| `sports` | Teal |

- `data-app="builder"` changes only the primary action (flat gold); its tint stays the default.
- Radius (concentric): `rounded-sheet` 20, `rounded-card` 16, `rounded-row` 12, `rounded-control-lg` 12, `rounded-control` 10, `rounded-control-sm` 8, `rounded-full` for chips and avatars. `rounded-cutout` 28 belongs to `CutoutCard` only.
- Elevation: `shadow-card`, `shadow-floating`, `shadow-sheet`. Dark mode halves the strength.
- z-index: use the named scale (`z-sticky`, `z-chrome`, `z-sheet`, `z-popover`, `z-toast`, `z-command`). No arbitrary `z-[…]` in `components/ui`.
- Spacing: Tailwind 4px scale, 8px rhythm. Avoid `x.5` steps except hairline tweaks.

## 3. Type

- Font: Schibsted Grotesk, weights 400 to 800 (`font-sans`). Do not set another family.
- Use the text styles, not raw `text-sm`/`text-xl`. Sizes scale with the user's text size (`--text-scale`, 0.9 to 1.3).

| Utility | Use |
|---|---|
| `text-display`, `text-large-title`, `text-title-1` | Headings. Weight 700, tracking -0.015em. `text-large-title` is the page `<h1>` in `PageHeader` |
| `text-title-2`, `text-title-3`, `text-headline` | Smaller titles. Weight 600 |
| `text-body`, `text-callout`, `text-subhead`, `text-footnote`, `text-caption` | Running text and secondary text |
| `text-eyebrow` (or `Eyebrow`) | Sentence-case label above a section or field |
| `text-stat-label` | Uppercase label, only directly above a number |

- Figures use `tabular-nums`. Numbers are not mono by default.
- `font-data` (Azeret Mono) is for IDs, codes and coordinates only. Never for prices, counts, percentages or stats.
- Uppercase is `text-stat-label` above a figure and nothing else. Do not use uppercase tracked labels as generic eyebrows.
- Minimum text size is 12px.

## 4. Components and when to use them

Import from `~/components/ui/*`. Feature code never imports `@radix-ui/*`; the wrappers own that. Icons are `iconoir-react` (`lucide-react` is not installed).

### Page structure

- `PageHeader` (`~/components/shell`) gives every app and page its title: the one `<h1>`, plus a back button and trailing actions in a sticky toolbar that collapses to a compact title on scroll.
  - No hero card as a header.
  - No subtitle that restates the title. Use `subtitle` only when it says something the title does not.
  - `ShellPageHeader` and `shellPageTitleProps` handle pages that own their title (see `shell.css`).
- `Card` is the default surface.
  - `variant`: `default` (opaque, border, `shadow-card`), `inset` (a panel inside a card, `bg-surface-secondary`), `hero` (the glass hero; only where section 1 allows it).
  - `padding`: `none | sm | md | lg`. `interactive` adds press feedback and makes a clickable card a keyboard-operable button.
  - Parts: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
  - A hero never nests another glass element.
- `CutoutCard` is the feature or media card with the notched corner. Use it for media and landing tiles. Dense UI (lists, tables, forms) uses `Card`.
- `FacetMaterial` (`thin | regular | thick | hero | acrylic`) is the primitive for floating chrome. Do not use it for content cards.
- `FlagWatermark`, `TintHairline`, `WatermarkGlyph` (`~/components/ui/facet`) are hero-only decoration, subject to the section 1 limit.

### Actions and data

- `Button`: variants `default | destructive | outline | secondary | ghost | link`; sizes `default | xs | sm | lg | icon | icon-sm | icon-lg`.
  - `default` is the primary and is monochrome. Inside `data-app="mycountry"` and `"builder"` it is flat gold. Never hand-roll a gold or gradient button.
  - Pressed is a colour change. There is no scale and no glow.
  - One primary per surface. Use `asChild` to render a link.
- `Badge`: 7 variants (`default`, `secondary`, `success`, `warning`, `destructive`, `info`, `outline`). Status and count chips only. Pair colour with text or an icon.
- `Stat`: `label`, `value`, optional `delta` (direction and sentiment) and `hint`; `size="sm" | "md"`. The label is `text-stat-label`; the value is `tabular-nums`.
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

## 5. Navigation

- `AppSidebar` is the primary navigation at 1024px and up (256px, collapsible to 64px icons). `TabBar` is the primary navigation below that: up to four apps plus a More sheet holding the current app's sections, the remaining apps and the account.
- Both read the one section map in `src/lib/navigation/app-sections.ts`. Add a destination there, not in a page.
- Halo is the floating island at the top. `PageHeader` keeps `--shell-halo-reserve` clear for it. Do not build a second top bar.
- Mark an app's own section navigation (tab rail, pill bar) with `data-app-subnav`. It is hidden at every width because the sidebar and the More sheet already list the same sections. Do not rely on it being visible.
- `AccountMenu` is the account: `layout="sidebar"` is a popover from the sidebar footer, `layout="sheet"` is inline in the More sheet.
- Layout variables (read, never redefine): `--shell-sidebar-width`, `--shell-tabbar-height`, `--shell-top-offset`, `--shell-header-top`, `--shell-halo-reserve`. Sticky rails use `top-(--shell-top-offset)`.
- Chromeless routes (Maps, full-screen editors) set `data-chromeless` on the app shell.

## 6. Motion and feedback

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

## 7. Copy

- Sentence case everywhere: buttons, headings, labels, tabs. Capitalise product nouns: IxStats, MyCountry, Directive(s), ThinkPages, IxVault, Halo, IxTime, IxWorld, WikiOS.
- Say what the thing is and does. Empty states say what is missing and what to do next ("No drafts yet. Start one from the Builder."). Errors say what happened and how to recover.
- Banned: filler, taglines, em-dash flourishes, and the words seamless, powerful, "at a glance", "command center", unlock, comprehensive.
- Numbers keep units and context ("$1.2T", "+2.4% vs. last year").

## 8. Code comments

- Comments explain why, not what.
- Never write spec section citations (`§7.1`), commit hashes, version provenance ("v2", "Facet 3.1", "restored from") or contrast ratios in code comments. They rot and mislead.

## 9. Do not

- Add glow props, glow blobs, tint glows or acrylic glows to anything outside Halo.
- Add refraction or rim layers, sheens, chromatic edges, or `facet-refraction` / `facet-gold-rim` style classes.
- Stack translucent layers (glass in glass, blur on blur) or use `backdrop-blur-*` directly. Blur comes from the materials.
- Make a content card glass. Content cards are opaque.
- Use gradient buttons, palette gradient stops, or `[#hex]` colours.
- Set body or stat figures in `font-data` or `font-mono`.
- Build an eyebrow + title + subtitle hero template, or a hero card as a page header.
- Use uppercase tracked labels as generic eyebrows.
- Hand-roll roving tabindex, tab lists, radio groups or switches.
- Import `@radix-ui/*` in feature code, or add `lucide-react`.
- Use `dark:` overrides, `!important`, arbitrary z-index, or inline `--tint`.
- Bring back the removed names: `FacetCard`, `FacetContainer`, `FacetTabs`, `TintGlow`, `AcrylicGlow`, the `facet-nav` flag, HIG button variants (`filled`, `tinted`, `plain`), or more than 7 badge variants.

## 10. CSS architecture

- `src/styles/globals.css` imports `facet/tokens.css` first, then the layered sheets, then `facet/shell.css`. Everything is in `@layer`, so a Tailwind utility on the same element always wins.
- Material and identity utilities paint only: they never set position, z-index, radius, margin or letter-spacing.
- A token that mixes `--tint` is composed at the element (`layers.css`, `card-art.css`), not on `:root`, so each `data-app` scope resolves its own tint.
- Third-party overrides (Clerk, sonner, MapLibre) live in `integrations.css` and `clerk.css` with a comment.

## 11. Guards

The tests under `src/tests/architecture/` and `src/tests/components/ui/` enforce parts of this file (no stray Radix or lucide imports, no `transition-all`, no `dark:` or hex classes in converted apps, layered CSS, AA contrast for every label and tint pair in both themes). Run the relevant test when you change tokens or a primitive. Some of them still assert the removed Facet 3.1 identity and need updating to match this reset.
