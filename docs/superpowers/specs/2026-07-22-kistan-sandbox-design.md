# Spec: Kistan Developer Sandbox

Date: 2026-07-22
Author: Antigravity AI
Status: Approved

## Goal

Create a high-fidelity, interactive developer sandbox and play area for Kistan at `/labs/sandbox` (`src/app/labs/sandbox/page.tsx`). The sandbox will act as both a playground for Kistan to test custom simulation logic and a living design system reference showing him how to integrate tRPC queries and Facet Glass materials.

---

## Proposed Changes

### Component Structure & Architecture

#### [NEW] [page.tsx](file:///ixwiki/public/projects/ixstats/src/app/labs/sandbox/page.tsx)
The sandbox file will live at `src/app/labs/sandbox/page.tsx`. It will:
- Use `"use client"` to enable interactive client hooks.
- Frame the sandbox in a responsive grid (`relative min-h-screen p-6 md:p-8 bg-background`).
- Import and demonstrate key design primitives from `~/components/ui/facet-container` (including `FacetContainer` and `useFacetDepth`).
- Offer a three-tab system to partition functionality:
  1. **Simulation Sandbox:** Interactive controls (sliders, numeric state) calculating stability formulas.
  2. **tRPC Data Explorer:** Calls `api.users.getCurrentUserWithRole` and displays loading states.
  3. **Facet Materials Lab:** Shows different depths and interactions of the glass physics layout.

---

## Verification Plan

### Manual Verification
- Deploy locally and verify `/labs/sandbox` compiles cleanly.
- Verify tabs switch properly.
- Verify sliders recalculate local state.
- Verify the tRPC panel queries the local database successfully and displays the user data.
