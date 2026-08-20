# Plan 108: Web Worker Geometry Offloading & Drag Simplification

**Phase**: 3 of 4  
**Target System**: `src/components/maps/editor/hooks/useSubdivisionDraw.ts`, `src/components/maps/editor/hooks/useSubdivisionVertexEdit.ts`  
**Goal**: Offload heavy Turf.js geometry math (`union`, `difference`, `bezierSpline`, `area`) off the main thread during vertex dragging into a Web Worker, while rendering simple $\mathcal{O}(1)$ polyline drag previews.

---

## 1. Problem Statement

Complex Turf.js operations (`union`, `difference`, `bezierSpline`, `intersect`, `buffer`) execute synchronously on the main thread during mouse drag events.
When dragging vertices of a detailed multi-polygon region, the main thread freezes for 100–300ms per frame, causing mouse jitter and dropped inputs.

---

## 2. Architecture & Ponytail / TS-Expert Design

### Ponytail Principle
- **$\mathcal{O}(1)$ Drag Previews**: While dragging a vertex, render only the raw 2D line segment connecting adjacent vertices ($\mathcal{O}(1)$ math).
- **Commit-on-Release**: Run Catmull-Rom spline smoothing and Turf.js topology reconciliation only when the user releases the mouse button (`mouseup`).

### TypeScript Expert Pattern
Strictly typed Web Worker RPC interface using message channels:

```typescript
export interface GeometryWorkerRequest {
  id: string;
  action: "COMPUTE_SPLINE" | "COMPUTE_UNION" | "COMPUTE_DIFFERENCE" | "COMPUTE_AREA";
  payload: {
    coordinates: [number, number][];
    options?: Record<string, unknown>;
  };
}

export interface GeometryWorkerResponse {
  id: string;
  success: boolean;
  result?: GeoJSON.Geometry | number;
  error?: string;
}
```

---

## 3. Implementation Steps

### Step 1: Create `geometry.worker.ts` (`src/lib/worldgen/workers/geometry.worker.ts`)
Encapsulate heavy Turf.js spatial functions into a web worker script.

### Step 2: Implement `useGeometryWorker` Hook (`src/hooks/useGeometryWorker.ts`)
Provide a clean, promise-based React hook interface for requesting async spatial computations:

```typescript
export function useGeometryWorker() {
  const computeSpline = useCallback(async (coords: [number, number][]) => { ... }, []);
  return { computeSpline };
}
```

### Step 3: Fast Polyline Dragging in `useSubdivisionVertexEdit.ts`
During active vertex drag, render straight-line segments in local canvas state. Post job to `geometryWorker` on drag end to finalize topology.

---

## 4. Machine-Checkable Verification

```bash
# Verify UI build
bun run typecheck:ui

# Verify worker compilation
bun run build
```

### Expected Output
- Vertex drag frame rate remains locked at 60fps regardless of polygon vertex count.
- Zero main-thread blocking during complex polygon operations.
