# Plan 113: IxWorld Spatial Feature Off-Thread Filtering

**Phase**: 4 of 4 (Main IxWorld Map Optimization)  
**Target System**: `src/components/maps/core/hooks/useWorldMapOverlayFeatures.ts`, `src/hooks/useGeoWorker.ts`  
**Goal**: Offload spatial overlay feature filtering (`filterByArea`, `PROGRESSIVE_THRESHOLDS`, bbox culling) off the main thread to `useGeoWorker` during map zoom and pan events.

---

## 1. Problem Statement

Currently, `useWorldMapOverlayFeatures.ts` filters thousands of GeoJSON features synchronously on every zoom change event using `filterByArea()` and progressive threshold matching.
When zooming rapidly on `/maps`, this main-thread loop freezes execution for 50–120ms, creating zoom stutter and delay.

---

## 2. Architecture & Ponytail / TS-Expert Design

### Ponytail Principle
- **Off-Thread BBox & Area Filtering**: Execute spatial filtering in `useGeoWorker` (Web Worker).
- **Fast Zoom Bucketing**: Pre-index features by area log-buckets (`log10(area)`) so filtering requires only array slice lookup ($\mathcal{O}(1)$ performance).

### TypeScript Expert Pattern

```typescript
export interface SpatialFilterRequest {
  zoomLevel: number;
  viewportBbox: [number, number, number, number];
  features: GeoJSON.Feature[];
}
```

---

## 3. Implementation Steps

### Step 1: Add Spatial Filter Handler in `geometry.worker.ts`
Implement `FILTER_SPATIAL_FEATURES` action in `geometry.worker.ts` to perform bounding-box culling and minimum area filtering in Web Worker background thread.

### Step 2: Refactor `useWorldMapOverlayFeatures.ts`
Update `useWorldMapOverlayFeatures.ts` to dispatch zoom filtering requests to `useGeoWorker` asynchronously.

---

## 4. Machine-Checkable Verification

```bash
# Verify UI build
bun run typecheck:ui

# Test maps core suite
bun run test -- src/components/maps/core
```

### Expected Output
- Main-thread zoom calculation time reduced to $< 2\text{ms}$.
- Zooming in/out on `/maps` is buttery smooth at 60fps.
