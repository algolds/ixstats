# Plan 115: Map Editor Backend GeoJSON Precision Truncation & Server Geometry Cache

**Phase**: 1 of 4 (Map Editor Backend Overhaul)  
**Target System**: `src/server/api/routers/geo/core/index.ts`, `src/server/api/routers/geo/features/subdivisions.ts`, `src/lib/geo-utils.ts`  
**Goal**: Reduce GeoJSON payload size by > 60% and eliminate redundant PostGIS database queries by truncating floating-point coordinates to 6 decimal places and introducing server-side memory caching.

---

## 1. Problem Statement

Currently, PostGIS GeoJSON serialization returns raw 64-bit floating point coordinates with 14–16 decimal places (e.g. `[12.34567890123456, 45.67890123456789]`).
For complex subdivision polylines with thousands of vertices, this inflates JSON payload size over 4x larger than necessary. Furthermore, repeated calls to `getCountryFeatures` query PostgreSQL sequentially on every page render.

---

## 2. Architecture & Ponytail / TS-Expert Design

### Ponytail Principle
- **Pay Only for Required Precision**: 6 decimal places in WGS84 coordinates yields $\sim 0.11\text{m}$ ground accuracy—far higher than map display requirements.
- **Server Cache Layer**: Cache country feature bundles in shared memory (`layer-cache.ts`) for 30s.

### TypeScript Advanced Types Pattern
Strongly typed geometry coordinate float truncator:

```typescript
export type WGS84Point = readonly [number, number];

export function truncateCoordinatePrecision<T extends GeoJSON.Geometry>(
  geometry: T,
  precision = 6
): T {
  const factor = Math.pow(10, precision);
  const round = (val: number) => Math.round(val * factor) / factor;

  // Recursively map coordinates with 6-digit float rounding
  // ...
  return geometry;
}
```

---

## 3. Implementation Steps

### Step 1: Create `truncateCoordinatePrecision` Helper (`src/lib/geo-precision.ts`)
Implement high-performance recursive coordinate precision rounding helper.

### Step 2: Integrate Precision Truncation & Caching in `getCountryFeatures`
Wrap `getCountryFeatures` in `src/server/api/routers/geo/core/index.ts` with coordinate truncation and `cachedProtectedProcedure` memory cache.

---

## 4. Machine-Checkable Verification

```bash
# Verify typechecking
bun run typecheck:server

# Test geo router test suite
bun run test -- src/server/api/routers/geo
```

### Expected Output
- `getCountryFeatures` network payload size reduced by > 60%.
- Repeated feature requests return from server cache in $< 2\text{ms}$.
