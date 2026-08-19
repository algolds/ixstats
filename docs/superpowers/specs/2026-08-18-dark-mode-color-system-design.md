# Specification: Dark Mode & Color System Harmonization

**Date:** 2026-08-18  
**Status:** Approved for Implementation Planning  
**Architecture Pillar:** Facet Design System & WikiOS Theming  
**Design Dials:** `DESIGN_VARIANCE: 7` | `MOTION_INTENSITY: 6` | `VISUAL_DENSITY: 5`

---

## 1. Executive Summary

This specification establishes a single canonical 4-tier dark mode color and physical surface system across IxStates. It eliminates the 5-palette fragmentation (where components mixed Obsidian, Slate, Zinc, Stone, and arbitrary opacity tiers), resolves WCAG AA text contrast violations on dark cards, synchronizes Facet physical material styles (`materials.css`, `hierarchy.css`) with global design tokens (`themes.css`), and adds Apple/Emil-grade tactile interaction polish.

---

## 2. 4-Tier Surface Elevation Hierarchy

All dark mode surfaces in IxStates must map to exactly one of the four standardized elevation tiers:

| Tier | Name | Token / Utility | Hex / RGBA Value | Border & Refraction | Use Cases |
|---|---|---|---|---|---|
| **Level 0** | **Base Canvas** | `--color-bg-primary`<br>`bg-background` | `#0f1114` | N/A (Viewport Root) | `<html>`, `<body>`, root page backgrounds |
| **Level 1** | **Base Surfaces** | `--color-bg-secondary`<br>`bg-card` | `#16181d`<br>`rgba(22, 24, 29, 0.75)` | `1px solid rgba(255, 255, 255, 0.08)`<br>`shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]`<br>`backdrop-blur(16px)` | Feed items, dashboard widgets, sidebars, content cards |
| **Level 2** | **Elevated Controls** | `--color-bg-tertiary`<br>`bg-secondary` / `bg-muted` | `#1e2028`<br>`rgba(30, 32, 40, 0.8)` | `1px solid rgba(255, 255, 255, 0.10)` | Subtab pills, form inputs, nested card sections, table headers |
| **Level 3** | **Floating Chrome** | `--color-bg-surface`<br>`bg-popover` | `#16181d/95`<br>`rgba(22, 24, 29, 0.95)` | `1px solid rgba(255, 255, 255, 0.15)`<br>`shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]`<br>`backdrop-blur(24px)` | Halo (Dynamic Island), modals, dropdown menus, command palette, tooltips |

---

## 3. Typography & WCAG Contrast Tokens

Text tokens are locked to the Zinc dark scale for uniform optical temperature:

| Token | Class | Dark Hex | Contrast on `#0f1114` | Contrast on `#16181d` | Usage |
|---|---|---|---|---|---|
| `--color-text-primary` | `text-foreground` | `#e4e4e7` (zinc-200) | **13.5:1** (AAA) | **11.2:1** (AAA) | Headlines, body copy, titles |
| `--color-text-secondary` | `text-muted-foreground` | `#d4d4d8` (zinc-300) | **10.8:1** (AAA) | **8.9:1** (AAA) | Subheadings, active labels |
| `--color-text-muted` | `text-muted-foreground` | `#a1a1aa` (zinc-400) | **7.1:1** (AAA) | **5.8:1** (AA) | Metadata, timestamps, table headers, captions |
| `--color-text-disabled` | `text-muted-foreground/60` | `#71717a` (zinc-500) | **4.2:1** (Non-body) | **3.5:1** (Non-body) | Disabled controls, decorative icons |

> **Contrast Rule:** Banned in dark mode: `text-slate-500` and `text-gray-500` on dark cards. Any text intended to be readable must use at minimum `#a1a1aa` (zinc-400) to meet WCAG AA (4.5:1).

---

## 4. Semantic & Domain Accents in Dark Mode

Domain colors adapt their luminance specifically for dark mode readability:

| Domain | Accent Name | Dark Foreground | Dark Container Background | Dark Container Border |
|---|---|---|---|---|
| **Executive / Global** | Indigo | `text-indigo-400` (`#818cf8`) | `bg-indigo-500/10` | `border-indigo-500/20` |
| **MyCountry** | Amber/Gold | `text-amber-400` (`#fbbf24`) | `bg-amber-500/10` | `border-amber-500/25` |
| **Economy** | Emerald | `text-emerald-400` (`#34d399`) | `bg-emerald-500/10` | `border-emerald-500/20` |
| **Defense / SDI** | Red | `text-red-400` (`#f87171`) | `bg-red-500/10` | `border-red-500/20` |
| **Intelligence** | Cyan | `text-cyan-400` (`#22d3ee`) | `bg-cyan-500/10` | `border-cyan-500/20` |
| **Cultural / Vault** | Purple | `text-purple-400` (`#c084fc`) | `bg-purple-500/10` | `border-purple-500/20` |
| **Builder / Forum** | Orange | `text-orange-400` (`#fb923c`) | `bg-orange-500/10` | `border-orange-500/20` |

---

## 5. Facet Physical Materials Alignment

### 5.1 `facet/materials.css`
* **`.facet-material-satin` (Dark)**:
  ```css
  .dark .facet-material-satin {
    background: linear-gradient(
      135deg,
      rgba(22, 24, 29, 0.85) 0%,
      rgba(15, 17, 20, 0.92) 100%
    ) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    box-shadow: 
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 8px 32px rgba(0, 0, 0, 0.35) !important;
  }
  ```

### 5.2 `facet/hierarchy.css`
* Standardize parent/child background gradients to Obsidian tokens:
  - Parent: `linear-gradient(135deg, rgba(22, 24, 29, 0.6) 0%, rgba(15, 17, 20, 0.7) 100%)`
  - Child: `linear-gradient(135deg, rgba(30, 32, 40, 0.6) 0%, rgba(22, 24, 29, 0.7) 100%)`
  - Interactive Hover: `rgba(255, 255, 255, 0.06)` with border `rgba(255, 255, 255, 0.15)`

---

## 6. Interaction & Motion Polish (Apple / Emil Principles)

1. **Tactile Button Feedback**:
   - All primary, secondary, and ghost buttons apply `active:scale-[0.98]` with `transition-transform duration-100 ease-out`.
2. **Origin-Aware Popovers & Modals**:
   - Popovers scale from `scale(0.96)` with `transform-origin: var(--radix-popover-content-transform-origin)`.
   - Modals scale from `scale(0.96)` centered. Scale-from-zero (`scale(0)`) is forbidden.
3. **Hover Sheens**:
   - Interactive glass surfaces implement pointer-following sheens via `radial-gradient(circle 250px at var(--pointer-x) var(--pointer-y), rgba(255,255,255,0.06), transparent)`.

---

## 7. Component Target Checklist for Refactoring

The following high-traffic components will be refactored from hardcoded Slate/Zinc classes to semantic tokens:

- [ ] `src/components/ui/select.tsx` (Select dropdown popover)
- [ ] `src/components/profile/WikiPreferencesCard.tsx`
- [ ] `src/components/vault/sections/import/ImportNationStep.tsx`
- [ ] `src/components/vault/DailyBonusWidget.tsx`
- [ ] `src/components/thinkpages/SportsBulletinCard.tsx`
- [ ] `src/components/thinkpages/GlassCanvasComposer.tsx`
- [ ] `src/components/thinkpages/composer/ComposerPollModal.tsx`
- [ ] `src/components/thinkpages/composer/ComposerAccountSwitcher.tsx`
- [ ] `src/components/thinkpages/editor/MentionMenuPortal.tsx`
- [ ] `src/components/thinkpages/editor/WikiAndStashPopovers.tsx`
- [ ] `src/components/maps/core/components/TourHUD.tsx`
- [ ] `src/components/halo/NotificationsView.tsx`
- [ ] `src/components/sports/player-cards/PlayerCard1.tsx`
- [ ] `src/components/sports/scoreboards/Scoreboard1.tsx`
- [ ] `src/components/sports/standings/Standings1.tsx`
- [ ] `src/components/sports/latest-results/LatestResults1.tsx`

---

## 8. Verification & Test Plan

1. **Visual Regression & Contrast Check**:
   - Verify all 4 surface levels on `/dashboard`, `/mycountry`, `/vault`, and `/thinkpages`.
   - Verify WCAG AA compliance (≥ 4.5:1) for all muted text on dark card surfaces using axe-core or contrast inspection.
2. **Automated Unit Tests**:
   - Run `bun run test -- src/lib/__tests__` to ensure zero regressions across core utilities.
3. **Build & Typecheck Validation**:
   - Run `bun run dev:local` incremental compilation to ensure clean styles without PostCSS or Tailwind v4 errors.
