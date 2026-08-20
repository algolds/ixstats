# Plan 118: Map Editor Server-Side Precalculated BBox & Area Metrics

**Phase**: 4 of 4 (Map Editor Backend Overhaul)  
**Target System**: `prisma/schema/core.prisma`, `src/server/api/routers/geo/features/subdivisions.ts`  
**Goal**: Calculate and store spatial metadata (`areaSqKm`, `centroidLng`, `centroidLat`, `bbox`) directly on PostgreSQL records during feature creation/update, eliminating client-side Turf.js recalculation loops on load.

---

## 1. Problem Statement

Currently, when the Map Editor loads feature GeoJSON geometries, client-side code loops through all polygons calling `@turf/area`, `@turf/centroid`, and `@turf/bbox` on the browser main thread.
This blocks UI rendering on mount for 100–250ms when opening large countries with complex subdivisions.

---

## 2. Architecture & Ponytail / TS-Expert Design

### Ponytail Principle
- **Precompute Once on Save**: Compute area, centroid, and bounding box once on the server when the user saves a polygon, storing them as scalar columns in PostgreSQL.
- **Direct Properties Injection**: Return pre-computed spatial properties in the feature properties object, bypassing all client-side Turf.js calculations on load.

### TypeScript Expert Pattern
Typed precalculated properties interface:

```typescript
export interface PrecalculatedSpatialProperties {
  areaSqKm: number;
  centroid: [number, number];
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}
```

---

## 3. Implementation Steps

### Step 1: Compute Spatial Metrics on Mutation (`src/lib/geo-metrics.ts`)
Create `computeSpatialMetrics(geometry)` helper using PostGIS ST_Area / ST_Centroid / ST_Envelope or Turf.js server-side.

### Step 2: Store and Inject Spatial Metrics in `subdivisions.ts`
Store `areaSqKm`, `centroid`, and `bbox` in database fields and include them directly in `getCountryFeatures` GeoJSON properties response.

---

## 4. Machine-Checkable Verification

```bash
# Verify typechecking
bun run typecheck:server
bun run typecheck:ui

# Test geo router test suite
bun run test -- src/server/api/routers/geo
```

### Expected Output
- Client-side Turf.js calculations on map load reduced by 100%.
- Map Editor initial render time reduced by > 50%.
