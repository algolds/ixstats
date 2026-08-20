# Plan 110: IxWorld Map Globe-to-2D Smooth Projection Transition

**Phase**: 1 of 4 (Main IxWorld Map Optimization)  
**Target System**: `src/components/maps/core/IxWorldMap.tsx`, `src/lib/map-config.ts`  
**Goal**: Eliminate the abrupt camera projection jump when zooming between 3D Globe mode and 2D Mercator map mode.

---

## 1. Problem Statement

Currently, when zooming in past zoom level ~4.5 on `/maps`, `IxWorldMap.tsx` evaluates the zoom threshold and calls `map.setProjection('mercator')` or `map.setProjection('globe')`.
Because this is an instantaneous projection swap, the viewport juts abruptly, disorienting the user.

---

## 2. Architecture & Ponytail / TS-Expert Design

### Ponytail Principle
- **Smooth Linear Interpolation**: Use MapLibre's built-in projection transition options or camera distance interpolation instead of instant boolean toggling.
- **Debounced Projection Switch**: Apply projection changes only after camera motion settles or via linear cross-fade animation ($\tau = 0.35\text{s}$).

### TypeScript Expert Pattern
Typed projection configuration interface:

```typescript
export interface ProjectionTransitionConfig {
  thresholdZoom: number;
  transitionDurationMs: number;
  currentProjection: "globe" | "mercator";
}
```

---

## 3. Implementation Steps

### Step 1: Add Projection Transition Utility (`src/components/maps/core/utils/projectionTransition.ts`)
Create a helper to calculate smooth projection blending during camera zoom.

### Step 2: Refactor Projection Switch in `IxWorldMap.tsx`
Update zoom event handler in `IxWorldMap.tsx` to apply projection changes with a 350ms smooth transition window.

---

## 4. Machine-Checkable Verification

```bash
# Verify UI build
bun run typecheck:ui

# Test maps core suite
bun run test -- src/components/maps/core
```

### Expected Output
- Seamless, smooth transition when zooming past zoom level 4.5 between 3D Globe and 2D Map modes with zero visual camera juts.
