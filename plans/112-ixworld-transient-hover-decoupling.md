# Plan 112: IxWorld Main Map Transient Hover & Tooltip Decoupling

**Phase**: 3 of 4 (Main IxWorld Map Optimization)  
**Target System**: `src/components/maps/core/hooks/useWorldMapInteractions.ts`, `src/components/maps/core/CountryInfoPanel.tsx`  
**Goal**: Integrate `transientMapStore` for nation hover tooltips and screen coordinate telemetry on the main IxWorld map viewer, eliminating React component tree re-renders on cursor movement across 82+ nations.

---

## 1. Problem Statement

On `/maps`, moving the mouse across country borders triggers `onMouseMove` events in `useWorldMapInteractions.ts`, updating `hoveredCountry` state via React `useState`.
This forces `IxWorldMap`, `MapControls`, `AnalyticsLegend`, and `CountryInfoPanel` to re-render on every frame during mouse movement, dropping panning frame rate below 40fps.

---

## 2. Architecture & Ponytail / TS-Expert Design

### Ponytail Principle
- **Zero React Re-renders on Hover**: Mouse hover state and screen coordinate tooltips should update via direct DOM refs or `transientMapStore` (`useSyncExternalStore`), avoiding top-level container re-renders.

### TypeScript Expert Pattern
Typed hover snapshot selector:

```typescript
export interface WorldHoverSnapshot {
  countryId: string | null;
  displayName: string | null;
  screenX: number;
  screenY: number;
}
```

---

## 3. Implementation Steps

### Step 1: Subscribe Tooltip Sub-Components to `transientMapStore`
Update hover tooltip components to read hover state via `useTransientMapStore((s) => s.hoveredFeatureId)` instead of receiving props from top-level state.

### Step 2: Update `useWorldMapInteractions.ts`
Replace `setHoveredCountry` React state updates in `useWorldMapInteractions.ts` with direct calls to `transientMapStore.setHoveredFeatureId()`.

---

## 4. Machine-Checkable Verification

```bash
# Verify UI build
bun run typecheck:ui

# Test maps core suite
bun run test -- src/components/maps/core
```

### Expected Output
- Zero re-renders of `IxWorldMap` or `MapControls` while panning mouse across nation borders.
- Panning frame rate locked at 60fps.
