# Facet Style Audit — 2026-09-30

Scope: `docs/reference/facet-design-system.md` checked claim by claim against the code; the whole styling layer
(`src/styles/**`, ~20.5k lines); and every Facet/UI usage in 1,553 `.tsx` files under `src/` (tests excluded).
Read-only; counts are from scripted scans on `rose-garden` after the MyCountry/maps Facet conversion (`8b134fb5`).
This audit feeds the unified design-system decisions (see *Open decisions* at the end).

## 1. Headline

- **Facet is a good idea implemented three times.** The doc, the CSS and the components each describe a different
  system. The doc's values (blur tiers, dark surfaces, z scale, materials, navigation behaviour) disagree with the code
  in ~40 places; the CSS ships ~2× the features the doc lists; and the components emit classes the CSS never defines.
- **Adoption is split in two.** MyCountry (9/10) and maps (8.5/10) are close to canonical after today's conversion.
  Everything else hand-rolls: 1,033 raw cards, 1,097 `backdrop-blur`, 1,457 raw `<button>`, 786 hand-rolled
  uppercase labels, 2,735 `dark:` overrides.
- **The cascade is the root bug.** Only `globals.css` uses `@layer`; ~20k lines of Facet/theme CSS are unlayered, so they
  beat every Tailwind utility. Components silently lose `absolute`, `sticky`, `z-*`, `bg-*`, `rounded-*` and `tracking-*`.
- **~40% of the styling layer (~8k lines) is dead or unreachable in production**, and ~830 `!important` exist mostly to
  fight the unlayered rules.
- **There is no foundation layer.** No type scale in use, no radius/spacing/elevation scale, no colour-role reference,
  no accessibility preferences beyond reduced motion — exactly the parts Apple's HIG treats as the system.

## 2. Doc vs code (highest-impact discrepancies)

| Doc § | Doc says | Code does |
|---|---|---|
| 1, 5 | `glass-*` are backward-compatible aliases; `.glass-refraction` exists | The glass CSS was deleted; **37 files still use undefined classes** (`glass-hierarchy-interactive` ×31, `glass-child` ×25, `glass-parent`, `glass-none`, `glass-hierarchy-modal`, `facet-card-child/parent`). `.glass-refraction` doesn't exist. |
| 2 | Strict `--z-depth-*` scale | Primitives hard-code other numbers (Dialog 100010/11, Sheet 99999/100000, Popover 100050 = toast tier, Select/Dropdown 100020 = tooltip tier, Tooltip 150000). 94 magic `z-[…]` in TSX; `.navigation-bar{z-index:50}` overrides the nav's 5000. Depth-3 cards get z 1000, depth-4 **100001 (above modal backdrops)**. |
| 3 | 4-tier blur 8→16→24→32, dark bgs `rgba(255,255,255,.08…)` | Depth classes are 16/24/32/32 (8/16/24/24 ≤768px); dark surfaces are gradients `rgba(22,24,29,…)`. `.facet-modal` ≠ depth-4 (220% vs 200% saturation). |
| 4 | Four materials | Seven (glass, carbon, wood too); 19 textures (doc: 5). Pointer-driven sheen only works via `<FacetMaterial>`, whose listeners never attach with a callback ref. `.facet-magnetic-3d` tilt is invalid CSS (px × deg). |
| 6 | Radix is the only headless base; primitives expose `data-slot` | Tabs, Switch, Toggle are custom; no ToggleGroup exists; `data-slot` missing on button, tabs, sheet, switch… (so `facet.css` tab rules are dead). |
| 6, 10 | No `dark:` overrides, zero hex | 153 `dark:` inside `components/ui`, 2,735 in TSX; 166 inline hex in TSX, 391 in CSS. |
| 8 | `.btn-tactile` 140ms; ≤250ms; exits 100–180ms; 0ms command palette | `.btn-tactile` doesn't exist; Sheet 280ms, nav 280ms, sheens 600–800ms, `CommandDialog` gets the 200ms dialog zoom; 51% of JS durations exceed 250ms. |
| 9 | Scroll-up reveals nav instantly; hidden mode reveals on scroll >10px | Scroll-up while sticky does **not** reveal; hidden mode never reveals on scroll (only hover at `clientY ≤ 2`). Repulsion is used by one header. |
| 11 | Domain accents via `--color-amber-500` etc. | Real tokens are `--facet-mycountry…` (never read by any rule); `.facet-{domain}` classes hard-code rgba; MyCountry gold is defined **8 different ways**. |
| 12 | Cookbook `FacetCard depth={2}`, `@/components`, press+bloom sound | Contradicts the doc's own nesting/restraint rules; codebase uses `~/` only. |

Also dead/broken: `enableRefraction` and `adaptToBackground` emit classes with no CSS; 10 of 18 `variant` values have no
CSS (99% of callsites never set `variant`); reduced-motion guards name classes that don't exist while the infinite
`facet-texture-shimmer` is unguarded.

## 3. Token & CSS layer

**Semantic colours** (dark is the `:root` default, light is `.light`; all hex/rgba — no HSL, no oklch):

| token | dark | light |
|---|---|---|
| background / card | #0f1114 / #16181d | #f8fafc / #ffffff |
| foreground / muted-fg | #e4e4e7 / #a1a1aa | #09090b / #71717a |
| primary | #e4e4e7 (monochrome) | #09090b |
| muted / secondary / accent | #1e2028 | #f1f5f9 |
| border / input | rgba(255,255,255,.08 / .12) | rgba(0,0,0,.08 / .10) |
| ring | #6366f1 (the only brand colour) | #6366f1 |
| chart-1..5 | violet, cyan, lime, orange, pink | *(no light values)* |

**Competing systems:** 4 theme-selector conventions (`:root/.light`, `.dark`, `[data-theme]`, `html:not([data-theme])`);
3 z scales; 4+ blur scales; radius token `--radius` not wired to `rounded-*`; 5 shadow families; `@theme` mostly
self-referential (`--color-chart-1: var(--color-chart-1)`).

**Real bugs this causes**
- **First-paint theme flash:** theme is applied in `useEffect`; SSR ships `class="dark"` with no `data-theme`, and
  `html:not([data-theme=dark])` rules (higher specificity) paint light glass on dark pages until hydration.
- **Hijacked utilities:** `.focus\:ring-2:focus` restyles all 42 uses; `.font-mono/.font-sans/.font-serif` force
  letter-spacing (165 `tracking-*` lost); `.facet-hierarchy-*` forces radius 0.5rem and background (87 `rounded-*`,
  68 `bg-*` lost); `SportsCommandBar` is not sticky.
- **Invalid colours:** ~90 `hsl(var(--color-*-hsl))` references (builder theme-utils, `GlassChart`) point to tokens
  that don't exist; `rgba(var(--primary-color),…)` and an undefined `--transition-standard`.
- **Route-scoped tokens used globally:** `--wikios-*` used by navigation, stashes and blurbs but only defined on `/wiki`.

**Dead weight:** ~8k lines (wiki-os/components ~70%, facet/components ~87%, physics ~53% lab-only, components ~59%);
7 dead keyframes; unused fonts (Playfair, Geist outside wiki/forum, 6 `@theme` families with no `@font-face`); a named
type scale (`text-display-hero` … `micro-badge`) with **0 uses**.

## 4. Usage across the app

| Area | Score /10 | Notes |
|---|---|---|
| mycountry | 9 | 216 Facet surfaces (92%), 251 Eyebrow, 2 `dark:`, 1 blur, 81% `<Button>` — *re-checked against Facet 3 2026-10-01 (spec §14): `FacetContainer` → `FacetCard`/inset, ~7.7k legacy type/radius/palette/alias hits → roles (incl. the never-converted executive panels and atomic selector), native fields → `Select`/`Checkbox`/`Switch`/`Slider`, choice pills/tabs → `SegmentedControl`/`ToggleGroup`/`RadioCardGroup`, detail dialogs → `Sheet`, metric tiles → `Stat`, `x.5` steps closed* |
| help/legal | 9 | tiny, clean |
| maps | 8.5 | 96% Facet; weak: 111 raw buttons, 135 raw inputs/selects — *re-checked against Facet 3 2026-10-01 (spec §14): panels/toolbars → `FacetMaterial`, `MapDynamicIsland` off `.dynamic-island-shell` (CSS deleted), native selects/ranges/checkboxes → primitives, editor tabs/pills → `SegmentedControl`/`ToggleGroup`/`StepIndicator`, ~95 raw buttons → `Button`, `Table` for import review, phone editor panel → bottom `Sheet`, `x.5` steps closed* |
| ui primitives | 5.5 | 128 `dark:`, 20 magic z-indexes — *converted in Phase 4 (2026-10-01): no `dark:`, glass, hex, palette or x.5 spacing left; `components/ui` in the guard set* |
| builder | 5 | half Facet, 137 `dark:` — *converted in Phase 4 (spec §14); picker buttons → `ToggleGroup`/`MenuButton`/combobox/`Select`, image scrims centralised, `x.5` steps closed 2026-10-01* |
| countries/explore | 4.5 | 80% semantic colour, 17% Facet — *countries index, explore and the public pages (landing, feed, changelog, setup, realms, leaderboards, stashes) converted in Phase 4 (spec §14); profile activity feed + Factbook sidebar converted, real Diplomatic Standing, realm-labelled census ranks, `x.5` steps closed 2026-10-01* |
| sports | 4 | 70% bold-or-heavier type, 93 raw cards — *converted in Phase 4 (spec §14); role-styled buttons, sort headers and `x.5` steps closed 2026-10-01* |
| admin | 3.5 | 274 raw cards, 331 blurs, 237 hand labels — *converted in Phase 4 (spec §14); selection, form-control and Table leftovers closed 2026-10-01; rail rows, native selects/tables, log filters, lab templates and `x.5` steps closed in a second pass* |
| forum | 3.5 | own `--forum-*` tokens + legacy glass — *converted in Phase 4 (spec §14); post actions → `ActionPill`, pagination → `Button`, `x.5` steps closed 2026-10-01* |
| messages, vault+cards | 3 | vault: 113 durations >250ms, 156 `text-white` — *messages and vault + trading cards converted in Phase 4 (spec §14); messages' picker rows → `FacetRow`, icon buttons → `Button`, `x.5` steps closed 2026-10-01; vault/cards role-styled buttons, native selects and `x.5` steps closed 2026-10-01* |
| halo/nav, labs/onoma, wiki-os | 2.5 | wiki-os: 306 raw buttons, 518 `dark:`; onoma: 418 `text-[Npx]` — *labs/onoma and WikiOS (+ media player, wiki stylesheets) converted in Phase 4 (spec §14); Onoma's raw toggles/chips, native selects and `x.5` steps closed 2026-10-01; WikiOS option/list buttons, native selects and `x.5` steps closed 2026-10-01* |
| thinkpages, passport/settings | 2 | 308 / 259 `dark:`, custom modals — *passport + its settings panel converted in Phase 4 (spec §14); Lorewards → wide `Sheet`, settings sidebar tier → `Badge`, ThinkPages post actions → `ActionPill`, native selects → `SegmentedControl`/`Select`, Halo springs/sound ticks and `x.5` steps closed 2026-10-01* |
| dashboard, achievements | 1–1.5 | no Facet surfaces at all — *converted in Phase 4 (spec §14); `x.5` steps closed 2026-10-01* |

**De-facto house style (what the code actually converged on):** `text-xs` is 64% of all text sizes; `Button size="sm"`
58% of buttons; `rounded-xl`/`rounded-lg` dominate; `gap-2`/`space-y-4`; amber (2,697) and emerald (1,874) are the most
used hues; `font-mono` ×1,195 for numbers; only 9 `Sheet` uses vs 133 `Dialog`; 61 hand-rolled `fixed inset-0` overlays.

## 5. Gap analysis against Apple's Human Interface Guidelines

| HIG foundation | What HIG defines | Facet today | Gap |
|---|---|---|---|
| Typography | A fixed set of text styles (Large Title → Caption 2) with size, weight, leading and tracking per style; Dynamic Type scaling | No scale in use; 64% `text-xs`; weights skew bold; a named scale exists with 0 uses | **Missing** |
| Colour | Semantic *roles*: label/secondary/tertiary/quaternary label, system & grouped backgrounds (base vs elevated), fills, separators, one tint; system colours for status | shadcn set; monochrome `primary`; no tertiary label, fills or elevated background; tint only in `ring`; domain accents unwired | **Partial** |
| Materials | Named blur materials (ultra-thin → thick, chrome) used for *floating* layers, with vibrancy; content layers are opaque | Four depths + seven materials, used for content too, stacking; `surface="solid"` added ad hoc | **Conflicting** |
| Shape | Continuous (squircle) corners; concentric radii (inner = outer − padding) | No radius scale; radii chosen per component | **Missing** |
| Layout | Margins, readable width, safe areas, grouped/inset lists as the default data container | No layout grid tokens; ad-hoc containers; no list primitive | **Missing** |
| Controls | Segmented control, toggle, stepper, picker, menus, 44pt hit targets | Tabs/FacetTabs/Toggle; no segmented-control or toggle-group primitive; button heights 28–40 | **Partial** |
| Presentation | Sheets (with detents) for tasks, alerts only for decisions, popovers for small context | Dialog for almost everything; 61 custom overlays | **Divergent** |
| Navigation | Sidebar (large screens) / tab bar (compact), clear hierarchy | Top nav + Halo island + 3 scroll modes whose behaviour doesn't match the doc | **Divergent** |
| Motion | Spring-based, interruptible, purposeful; honours Reduce Motion | Tweens capped at 250ms (doc) vs springs (FacetTabs); half the code ignores the cap | **Conflicting** |
| Accessibility | Dynamic Type, Increase Contrast, Reduce Transparency, Reduce Motion, VoiceOver semantics | Reduce motion only (with broken guards); no reduced transparency; custom Tabs/Switch lack roles | **Partial** |
| Sound & haptics | Feedback used sparingly, respects system settings | Cuelume: 17 cues on by default at 0.25 | **Policy needed** |
| Iconography | SF Symbols sized and weighted to match adjacent text | Iconoir only (good); sizes h-2.5…h-10 unrelated to text | **Partial** |

## 6. Recommended order of work

1. **Fix the cascade** — put all Facet/theme CSS in `@layer components` (or `@utility`), strip position/z/radius/background
   from depth and hierarchy classes, delete the `!important` workarounds and global utility hijacks.
2. **One token source** — `@theme` owns colour roles, type scale, radius, spacing, elevation, blur, z-index and motion;
   one theme selector plus a pre-paint script.
3. **Fix the broken references** — undefined `glass-*` classes (37 files), `*-hsl` colours, reduced-motion guards.
4. **Rewrite the doc** as the specification of the decided system, with a component inventory and when-to-use rules.
5. **Delete dead CSS** (~8k lines) and move lab-only materials/textures into the lab.
6. **Migrate areas worst-first**, extending `facet-guards` per area as each converts.

## Open decisions

Settled with the maintainer on 2026-09-30 and written up as the
[Facet 3 specification](../specs/2026-09-30-facet-3-design-system.md): opaque content with glass chrome; glass + 3
textures; HIG semantic colour roles with per-app tints; HIG text styles at desktop density in the Swiss face with
tabular figures; concentric radii; follow-system appearance with a density toggle; sidebar + tab bar with Halo as the
island; HIG presentation rules; `FacetList`/`FacetRow`; three control sizes plus SegmentedControl/ToggleGroup/Stepper;
uppercase `Eyebrow` only for data labels; named springs; all four accessibility preferences; restrained Cuelume;
WikiOS/Forum folded into roles; foundations-first rollout.
