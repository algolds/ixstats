# Card Administration Facet & Apple Design Overhaul Spec

**Date:** 2026-08-10  
**Target:** `src/app/admin/cards/CardsPanel.tsx`, `src/app/admin/cards/AdminCardExplorer.tsx`  
**Goal:** Migrate all containers, cards, navigation bars, and interactive components in the Card Administration dashboard to the official IxStats **Facet Design System** (`FacetContainer`, `FacetCard`, `FacetNavigation` from `~/components/ui/facet-container`) combined with **Apple Design** physical motion and visual depth.

---

## 1. Overview & Architecture

The Card Administration interface (`/admin/cards`) is organized into 10 top-level navigation tabs. This spec defines the complete visual and interactive migration of all 10 tab views to use official `FacetContainer`, `FacetCard`, and `FacetNavigation` primitives from `src/components/ui/facet-container.tsx`.

---

## 2. Component Design & Z-Depth Mapping

### 2.1 Header & Segmented Tab Navigation (`CardsPanel.tsx`)
- **Main Header:** Wrapped in `<FacetNavigation depth={3}>`.
- **macOS Segmented Control Tab Bar:** Wrapped in `<FacetContainer depth={2} enableRefraction={true}>`.
- **Navigation Tabs:** Active tabs elevate to `depth={3}` with glowing translucent border, spring scale interaction (`active:scale-95 transition-all`), and high-contrast iconography. Inactive tabs rest at `depth={1}` with subtle hover state.

### 2.2 Overview Tab (`overview`)
- **NS Card Library Overview Card:** Main panel wrapped in `<FacetCard depth={2}>`.
- **4 Hero Stat Cards (`Total Cards`, `Active Nations`, `CTE Defunct`, `Last Sync`):** Wrapped in `<FacetCard depth={1} interactive="hover">` for micro-depth Z-elevation on mouse hover.
- **Proportion Gauge Bar:** Rendered inside a nested `<FacetContainer depth={1}>` with smooth refractions.

### 2.3 Card Explorer Tab (`explorer` & `AdminCardExplorer.tsx`)
- **Explorer Container:** `<FacetCard depth={2}>`.
- **Filter Toolbar:** `<FacetContainer depth={1}>` holding glass search inputs & select dropdowns.
- **Data Table Wrapper:** `<FacetContainer depth={1}>` with glass header (`backdrop-blur-md bg-card/40`), micro-animated row hovers, thumbnail frames, and glowing Facet status pills (`Active`, `CTE`, `Hidden`).

### 2.4 Card Fetching Tab (`import`)
- **Sync Health Metrics:** 4 `<FacetCard depth={1} interactive="hover">` cards.
- **Bulk Region Ingest & Region Discovery:** `<FacetCard depth={2}>`.
- **Active Sync Jobs Queue:** Each active job wrapped in `<FacetCard depth={1}>` with animated volumetric progress bars.

### 2.5 Takedowns & Compliance Tab (`takedown`)
- **Compliance Policy & Direct Hide Form:** `<FacetCard depth={2}>`.
- **Hidden Cards List:** Each item rendered in a `<FacetCard depth={1} interactive="hover">` with one-click **Restore** spring action.

### 2.6 Operations Log Tab (`logs`)
- **Audit Viewer Container:** `<FacetCard depth={2}>` housing `<LogViewerFilterable />`.

### 2.7 Secondary Admin Sub-Panels (`packs`, `lore`, `season`, `valuation`, `bonuses`)
- All sub-panel section cards wrapped in `<FacetCard depth={2}>` or `<FacetCard depth={1} interactive="hover">`.

---

## 3. Verification & Acceptance Criteria
1. Clean TypeScript compilation via `bun run typecheck:ui`.
2. All 10 tabs render cleanly with Facet depth physics (`depth={1..4}`) and glass refraction.
3. Interactive buttons and tabs exhibit instant pointer-down scale feedback (`active:scale-95`).
