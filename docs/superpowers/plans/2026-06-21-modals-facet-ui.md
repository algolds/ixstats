# Metric Modals Facet UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the core national and metric details modals (`BaseMetricDetailsModal` and `GdpPerCapitaDetailsModal`) with Facet UI depth-4 satin glass, edge refraction sheens, and nested hierarchy cards.

**Architecture:** Inject `facet-modal facet-refraction` classes and inline style overrides into modal wrappers, and declare global CSS overrides inside `glass-refraction.css` targeting nested `[data-slot="card"]` and `.bg-muted/50` components inside Facet modals.

**Tech Stack:** React 19, Next.js 16.2, Tailwind CSS v4, Facet UI Styling Tokens.

## Global Constraints

- Package manager: `bun` (never npm/yarn/pnpm). Lockfile: `bun.lock`.
- Do NOT run full typechecks or production builds during execution.
- Do NOT modify the base `dialog.tsx` components.
- Rely on incremental type checking (`bun run dev`) and visual verification.

---

### Task 1: CSS Overrides for Nested Cards & Info Panels

**Files:**
- Modify: `src/styles/glass-refraction.css`

- [ ] **Step 1: Edit glass-refraction.css**
  Add the following rules to the bottom of [glass-refraction.css](file:///ixwiki/public/projects/ixstats/src/styles/glass-refraction.css):
  ```css
  /* ==========================================================================
     NESTED COMPONENTS OVERRIDES FOR FACET MODALS
     ========================================================================== */

  /* Nested cards inside Facet depth 4 modals / facet-modal containers inherit hierarchy-child styles */
  .facet-depth-4 [data-slot="card"],
  .facet-modal [data-slot="card"] {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    box-shadow: none !important;
  }

  .dark .facet-depth-4 [data-slot="card"],
  .dark .facet-modal [data-slot="card"] {
    background: linear-gradient(135deg, rgba(9, 9, 11, 0.5) 0%, rgba(9, 9, 11, 0.3) 100%) !important;
    border: 1px solid rgba(255, 255, 255, 0.05) !important;
  }

  /* flat informational panel overrides (bg-muted/50) */
  .facet-depth-4 .bg-muted\/50,
  .facet-modal .bg-muted\/50 {
    background: rgba(255, 255, 255, 0.04) !important;
    border: 1px solid rgba(255, 255, 255, 0.06) !important;
    border-radius: 0.5rem;
  }

  .dark .facet-depth-4 .bg-muted\/50,
  .dark .facet-modal .bg-muted\/50 {
    background: rgba(0, 0, 0, 0.2) !important;
    border: 1px solid rgba(255, 255, 255, 0.03) !important;
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add src/styles/glass-refraction.css
  git commit -m "style: add custom card and info panel overrides for depth-4/modal glass frames"
  ```

---

### Task 2: BaseMetricDetailsModal Refactoring

**Files:**
- Modify: `src/components/modals/metric-details/BaseMetricDetailsModal.tsx`

- [ ] **Step 1: Replace legacy classes and add style override**
  Modify [BaseMetricDetailsModal.tsx](file:///ixwiki/public/projects/ixstats/src/components/modals/metric-details/BaseMetricDetailsModal.tsx) around line 147:
  ```tsx
        className={cn(
          // Glass physics styling
          "bg-background/95 backdrop-blur-xl",
          "border-2 border-white/10 shadow-2xl",
  ```
  Replace with:
  ```tsx
        style={{ background: "transparent", border: "none", boxShadow: "none" }}
        className={cn(
          // Glass physics styling
          "facet-modal facet-refraction border-none shadow-none bg-transparent",
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add src/components/modals/metric-details/BaseMetricDetailsModal.tsx
  git commit -m "style: apply facet-modal and inline overrides to BaseMetricDetailsModal"
  ```

---

### Task 3: GdpPerCapitaDetailsModal Refactoring

**Files:**
- Modify: `src/components/modals/GdpPerCapitaDetailsModal.tsx`

- [ ] **Step 1: Replace legacy classes, remove z-index override, and add style override**
  Modify [GdpPerCapitaDetailsModal.tsx](file:///ixwiki/public/projects/ixstats/src/components/modals/GdpPerCapitaDetailsModal.tsx) around line 300:
  ```tsx
      <DialogContent className="bg-background/95 z-[13000] max-h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto border-2 border-white/10 shadow-2xl backdrop-blur-xl sm:w-[calc(100vw-4rem)] sm:max-w-[calc(100vw-4rem)]">
  ```
  Replace with:
  ```tsx
      <DialogContent
        style={{ background: "transparent", border: "none", boxShadow: "none" }}
        className="facet-modal facet-refraction max-h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto border-none shadow-none bg-transparent sm:w-[calc(100vw-4rem)] sm:max-w-[calc(100vw-4rem)]"
      >
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add src/components/modals/GdpPerCapitaDetailsModal.tsx
  git commit -m "style: apply facet-modal and inline overrides to GdpPerCapitaDetailsModal"
  ```

---

### Task 4: Verification & Dev Compilation Audit

- [ ] **Step 1: Verify visually in browser**
  1. Open the dashboard or `/mycountry` pages.
  2. Click on the indicators for GDP, Population, Labor, Demographics/Health, and Government Spending to trigger the modals.
  3. Verify that the outer modal renders with high-quality satin blur and sheen (depth 4 / facet-modal).
  4. Verify that the GDP per Capita modal is fully clickable, is not blocked by the backdrop overlay, and has proper depth.
  5. Verify that inner cards (Overview/Trends tabs) and info boxes show correct child hierarchy styling without dark borders or high opacity solid backgrounds.
