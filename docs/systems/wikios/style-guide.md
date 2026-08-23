# WikiOS design system and style guide

Specification: Apple Human Interface Guidelines and Emil Kowalski design engineering principles.  
Version: WikiOS 1.0.0 / Facet standard.  
Last updated: August 2026.  

---

## Core philosophy

WikiOS combines an encyclopedia reading layout with tactile spring physics, translucent materials, and strict typographic hierarchy.

Facet is the IxStates design system standard. It defines refractive glass physics, specular chamfered borders, dynamic depth hierarchy, and spring-based physical feedback across all platform applications.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THREE PILLARS OF WIKIOS UI                      │
├──────────────────┬─────────────────────────────┬───────────────────────┤
│ 1. Directness    │ 2. Grounded physics         │ 3. Depth hierarchy    │
│ Zero lag, instant│ Critically damped springs,  │ Translucent materials │
│ feedback on press│ interruptible velocity,     │ separate layers       │
│                  │ no ungrounded scale(0) jumps│ without distraction   │
└──────────────────┴─────────────────────────────┴───────────────────────┘
```

1. **Unseen details compound.** When an article opens without layout shifts, responds to clicks within one frame, and maintains consistent typography, readers trust the content.
2. **Behavior over decoration.** Animations exist to provide feedback and show spatial origin. If an action repeats frequently, such as opening search or typing shortcut keys, it runs without blocking timers.
3. **No monospace fonts in editorial headers or body.** Reading long articles and browsing category trees requires proportional type. Monospace is reserved for raw wikitext code blocks.

---

## Typography and optical hierarchy

WikiOS uses dynamic optical scaling via CSS `clamp()`, proportional tracking, and tabular numbers for data.

### Font families
- **Display and brand.** `var(--wikios-font-brand)` resolves to `"Host Grotesk", sans-serif` for hero titles and brand anchors.
- **Reading prose.** `var(--wikios-font-reading)` resolves to `var(--font-geist-sans), system-ui, -apple-system, sans-serif` for article body copy, summaries, and lead blurbs.
- **UI and navigation.** `var(--wikios-font-ui)` resolves to `var(--font-geist-sans), system-ui, -apple-system, sans-serif` for sidebar items, tabs, and controls.
- **Code and syntax.** `var(--wikios-font-mono)` resolves to `"JetBrains Mono", "Consolas", monospace` for wikitext source editing and raw code snippets only.

### Type scale

| Level | Size expression | Weight | Tracking | Line height | Target elements |
| --- | --- | --- | --- | --- | --- |
| **Display hero** | `clamp(2.5rem, 5vw, 3.75rem)` (40px to 60px) | 800 | -0.03em | 1.05 | Editorial mastheads, hero headlines |
| **Page title (h1)** | `clamp(1.75rem, 3.5vw, 2.25rem)` (28px to 36px) | 700 | -0.02em | 1.15 | Article titles |
| **Section anchor (h2)** | `clamp(1.125rem, 2vw, 1.375rem)` (18px to 22px) | 600 | -0.015em | 1.25 | Major sections, browse headers |
| **Subsection (h3)** | `1.0625rem` (17px) | 600 | -0.01em | 1.3 | Category groups, major infobox decks |
| **Sub-subhead (h4)** | `0.9375rem` (15px) | 500 | -0.005em | 1.4 | Minor section splits, infobox sub-rows |
| **Body prose** | `1.0rem` to `1.0625rem` (16px to 17px) | 400 | 0em | 1.65 | Article body paragraphs |
| **Eyebrow subhead** | `0.8125rem` to `0.875rem` (13px to 14px) | 600 | -0.01em | 1.2 | Module header labels, category badges |
| **Metrics and metadata** | `0.6875rem` to `0.75rem` (11px to 12px) | 500 | 0.01em | 1.2 | Timestamps, authors, numeric values |

Heading levels h3 (17px, semibold) and h4 (15px, medium) are intentionally separated in size, weight, and line height to maintain a 6-tier document structure.

Statistical numbers such as population, GDP, byte differentials, coordinates, and dates must use `tabular-nums` (`font-variant-numeric: tabular-nums`). This keeps numeric columns aligned when data updates live without needing monospace fonts.

---

## Surface palette, materials, and color tokens

WikiOS uses layered translucent materials with GPU-accelerated backdrop blur and chamfered edge glare overlays.

### System color tokens

| Token | Dark mode | Light mode | Purpose |
| --- | --- | --- | --- |
| `--wikios-accent` | `#3b82f6` (blue-500) | `#2563eb` (blue-600) | Primary system focus rings, active tabs, search dot indicators |
| `--wikios-purple` | `#a855f7` (purple-500) | `#9333ea` (purple-600) | Blurb responses, interactive lore cards, social knowledge links |
| `--wikios-amber` | `#f59e0b` (amber-500) | `#d97706` (amber-600) | Timeline chronologies, warning alerts, canon event pills |
| `--wikios-green` | `#22c55e` (green-500) | `#16a34a` (green-600) | Positive byte diffs (`+412`), online indicators, verified badges |
| `--wikios-red` | `#ef4444` (red-500) | `#dc2626` (red-600) | Negative byte diffs (`-38`), deletion warnings, conflict flags |

### Dark mode surfaces (default)
- Base canvas (`--wikios-bg`): `#0f1114`
- Structural rails (`--wikios-surface`): `#16181d`
- Glass cards (`--wikios-card-bg`): `rgba(22, 24, 29, 0.72)` with `backdrop-filter: blur(20px) saturate(180%)`
- Card border (`--wikios-card-border`): `rgba(255, 255, 255, 0.08)`
- Chamfered edge glare: `linear-gradient(to bottom, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02))`
- Shadow (`--wikios-card-shadow`): `0 4px 20px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.08)`

### Light mode surfaces
- Base canvas (`--wikios-bg`): `#fafafa`
- Structural rails (`--wikios-surface`): `#ffffff`
- Glass cards (`--wikios-card-bg`): `rgba(255, 255, 255, 0.72)` with `backdrop-filter: blur(20px) saturate(180%)`
- Card border (`--wikios-card-border`): `rgba(0, 0, 0, 0.08)`
- Chamfered edge glare: `linear-gradient(to bottom, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.2))`
- Shadow (`--wikios-card-shadow`): `0 4px 20px rgba(0, 0, 0, 0.03), inset 0 1px 1px rgba(255, 255, 255, 0.6)`

### Contrast and WCAG compliance
- Body reading text (`--wikios-text`) achieves a 12.8:1 contrast ratio in dark mode and 14.1:1 in light mode over the 72% opacity frosted surface and underlying base canvas, exceeding the WCAG 2.1 AA requirement of 4.5:1.
- Muted captions (`--wikios-text-muted`) maintain a 5.6:1 contrast ratio, exceeding the 4.5:1 requirement.
- When `prefers-contrast: more` is active, card opacity raises from 72% to 100% and border opacity raises to `rgba(255, 255, 255, 0.3)` (dark) and `rgba(0, 0, 0, 0.3)` (light).

### Layer hierarchy and z-index stacking scale

```
z-0:  Base canvas (Level 0, #0f1114 / #fafafa)
  └── z-10: Left rail and reading container (Level 1, #16181d / #ffffff)
        └── z-20: Sticky headers, search bar, and section navigation
              └── z-30: Floating action triggers and audio mini-player
                    └── z-40: Modal scrim backdrops (rgba(0,0,0,0.6) / rgba(0,0,0,0.3))
                          └── z-50: Portaled popovers, spotlight search, and floating toolbars (Level 3, blur 20px, 95% opacity)
```

---

## Motion and spring physics

Interactive motion uses critically damped springs that can be interrupted on any frame.

### Spring values

| Role | Stiffness | Damping | Target properties |
| --- | --- | --- | --- |
| **Card hover lift** | 400 | 24 | `whileHover={{ y: -2, scale: 1.03 }}` |
| **Button and card press** | 500 | 28 | `whileTap={{ scale: 0.97 }}` |
| **Modal and sheet entry** | 350 | 30 | `initial={{ opacity: 0, scale: 0.95, y: 8 }}` |
| **Segmented pill switcher** | 450 | 32 | `layoutId="activePill"` shared layout transition |

### Interaction rules
1. **Never animate from `scale(0)`.** Objects in the physical world do not appear from a point. Animate entry starting at `scale(0.95)` with `opacity: 0`.
2. **Instant press feedback.** Buttons and pressable cards must react on pointer-down with `scale(0.97)`. Do not wait for pointer-up.
3. **No `ease-in` curves on UI.** UI transitions use strong `ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`) or springs so movement starts immediately.
4. **Origin-aware popovers.** Dropdowns and search popovers scale out from their trigger element, not from the center of the screen. Centered modals remain centered in the viewport.
5. **Short durations.** Micro-interactions stay between 125ms and 220ms. Standard cards and menus stay under 300ms.

---

## Component patterns

### Section eyebrow header
```tsx
<div className="wikios-section-header">
  <h3 className="wikios-section-title">
    <span className="h-2 w-2 rounded-full bg-[var(--wikios-accent)] shadow-[0_0_8px_var(--wikios-accent)]" />
    <span>Section title</span>
  </h3>
  <Link
    href="..."
    className="text-xs text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)] transition-colors flex items-center gap-1 font-medium group/all"
  >
    <span>Action link</span>
    <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/all:translate-x-0.5" />
  </Link>
</div>
```

### Major section anchor (h2)
```tsx
<div className="flex items-baseline justify-between border-b border-[var(--wikios-border-subtle)] pb-2.5 mb-4">
  <h2 className="wikios-h2-anchor">
    Major section title
  </h2>
  <span className="text-xs text-[var(--wikios-text-dim)] tabular-nums">
    124 articles
  </span>
</div>
```

### Interactive glass card
```tsx
import { motion, useReducedMotion } from "framer-motion";
import { useMediaQuery } from "~/hooks/useMediaQuery";

export function WikiOSCard({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const isFinePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const enableMotion = !reduceMotion && isFinePointer;

  return (
    <motion.div
      whileHover={enableMotion ? { scale: 1.03, y: -2 } : undefined}
      whileTap={enableMotion ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className="wikios-card wikios-card-interactive p-3.5"
    >
      <Link href={href} className="block text-left wikios-focus-ring">
        <h4 className="text-sm font-semibold text-[var(--wikios-text)] tracking-tight">
          {title}
        </h4>
        <div className="mt-1 text-xs text-[var(--wikios-text-muted)]">
          {children}
        </div>
      </Link>
    </motion.div>
  );
}
```

---

## Performance rules and compositor budget

Animations and translucent effects must not block or stutter during high-frequency interactions or heavy page loads.

1. **Animate only `transform` and `opacity`.** These properties execute on the GPU compositor thread and skip layout and paint recalculations. Never animate `padding`, `margin`, `height`, `width`, `box-shadow`, or `border-color` on gesture paths.
2. **Backdrop blur budget is capped at 20px.** Heavy blurs degrade frame rates, particularly on WebKit and integrated mobile GPUs. Standard glass cards and floating popovers use `blur(16px)` to `blur(20px)`.
3. **Portaling prevents translucent glass stacking.** Never render popovers, tooltips, or dropdown menus inline as child DOM nodes of translucent cards. All floating elements must portal to `document.body` or `#portal-root` (at `z-50`). This ensures the compositor renders floating menus over an isolated stacking layer rather than multiplying glass shader passes.
4. **CSS variables during drag gestures.** Do not update parent container CSS variables on high-frequency pointer moves, as this invalidates styles across the entire subtree. Apply inline `style.transform` directly to the active element.
5. **Compositor thread isolation.** Use CSS transitions for predictable entry and exit states so they stay smooth even when the JavaScript main thread is busy loading content.

---

## Accessibility and keyboard navigation

1. **Keyboard focus rings (WCAG 2.1 AA).**
   - Interactive cards, buttons, and tab controls must use `:focus-visible` outlines: `outline: 2px solid var(--wikios-accent)` with `outline-offset: 2px`.
   - Never remove focus indicators without an equivalent high-contrast focus ring.
2. **Reduced motion (`prefers-reduced-motion: reduce`).**
   - Spatial transforms (`translate`, `scale`, `rotate`) are disabled, and elements render directly at their resting coordinates.
   - Opacity and color transitions continue to run using short CSS cross-fades (`transition: opacity 150ms ease`).
3. **Reduced transparency (`prefers-reduced-transparency: reduce`).**
   - Backdrop blur is disabled (`backdrop-filter: none`).
   - Glass surfaces switch to solid opaque backgrounds (`var(--wikios-surface)`).
4. **Fine pointer vs touch.**
   - Hover lift transitions are gated behind `@media (hover: hover) and (pointer: fine)` so touch devices do not get stuck in hover states after tapping.

---

## Standardization review

| Before | After | Why |
| --- | --- | --- |
| Monospace on section headers | `font-semibold text-foreground tracking-tight` (sans-serif) | Long-form reading requires proportional type. Monospace is reserved for code. |
| Inconsistent card padding (`p-6` vs `p-2.5`) | Standardized `p-3.5` with `wikios-card` tokens | Keeps card density uniform across layouts. |
| Inconsistent border tokens | `var(--wikios-card-border)` (`rgba(255,255,255,0.08)` / `rgba(0,0,0,0.08)`) | Gives consistent contrast across light and dark modes. |
| Linear CSS hover transitions | Springs with `stiffness: 400, damping: 24` | Natural physics that can be redirected mid-motion. |
| Animating `box-shadow`, `border-color`, and `background-color` on hover | Animating only `transform: translateY(-2px)` with `will-change: transform` | Skips layout and paint steps, running purely on the compositor GPU thread. |
| Arbitrary high blur radius values (`blur(24px)`) | Blur radius capped at `20px` across all layers | Prevents fill-rate bottlenecks and Safari rendering slowdowns. |
| Inline popovers causing multi-layer glass stacking | Floating UI portals to `document.body` at `z-50` | Eliminates exponential GPU shader fill-rate penalties. |
| Disagreeing hover scale tokens (`1.04` vs `1.03`) | Standardized to `1.03` across spec table and code snippets | Single source of truth across design documentation and implementation. |
| Missing accent color tokens in style spec | Explicit definitions for blue, purple, amber, green, and red tokens | Ensures consistent semantic color usage across all WikiOS features. |
| Missing keyboard focus ring specifications | Focus visible rings (`outline: 2px solid var(--wikios-accent)`) | WCAG 2.1 AA keyboard accessibility compliance. |
| Shifting numeric columns on data updates | `tabular-nums font-medium` | Tabular figures prevent layout shifts when numbers change. |
| Monospace byte diff pills | `text-[11px] font-semibold tabular-nums` | Keeps number columns aligned without switching to monospace fonts. |
| Colored indicator dots in section headers | Removed dots; clean proportional typography | Avoids visual noise and keeps emphasis on the content hierarchy. |
| Hero card glow unbounded expansion | Volumetric under-glow with golden-ratio containment ($1:1.618$) | Maintains physical spatial boundary under paper grain texture. |
| Greedy lead image grabbing top WIP notice icons | Infobox-first wikitext parsing + notice icon filtering | Ensures authentic subject images and corporate logos are displayed. |
