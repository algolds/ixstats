# Spec: Metric Modals Facet UI Refactoring

**Date**: June 21, 2026  
**Status**: Approved  
**Topic**: Refactoring core national and metric details modals with Facet UI glass physics.

---

## 1. Problem Statement & Goals

The metric details modals (GDP, Population, Labor, Debt, Demographics, Government Spending) currently use a legacy glass/backdrop implementation. We need to refactor them to use the standardized Facet UI design tokens and components (depth-4 satin glass, edge refraction sheens, hierarchical child panels). 

Per constraints:
- Do NOT modify the base `dialog.tsx` components.
- Swap only the actual modal wrappers and nested content card styles.
- Avoid updating individual metric modal view files (like `GdpDetailsModal.tsx`, `PopulationDetailsModal.tsx`) directly to swap cards. Instead, use hierarchical CSS overrides targeting cards nested within the modal container.

---

## 2. Proposed Changes

### 2.1 Modal Containers
Upgrade the outer Radix-based `<DialogContent>` styling in:
- `BaseMetricDetailsModal.tsx`
- `GdpPerCapitaDetailsModal.tsx`

We will replace the manual background/blur/border classes with:
- `facet-depth-4 facet-refraction`
- Remove legacy shadow, bg, and border styles.

### 2.2 Hierarchical CSS overrides
Add overrides in `src/styles/glass-refraction.css` to target components nested within `.facet-depth-4`:
- Style any standard card element `[data-slot="card"]` as a nested Facet hierarchy child.
- Style `bg-muted/50` informational boxes with translucent glass borders/backgrounds to look premium and readable on dark/light backdrops.

---

## 3. Verification Plan

### Manual Verification
- Run `bun run dev` and click on various metric indicators on the dashboard (GDP, Population, etc.) to trigger each metric modal.
- Verify the modal shell displays depth-4 satin glass, edge refraction sheen, and correct z-index.
- Verify inner cards inherit parent compound blur styles correctly in both dark and light modes.
- Verify page scrolling is locked when modals are open, and escape key closes them.
