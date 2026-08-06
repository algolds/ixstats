# Plan 111: IxWorld Progressive Level-of-Detail (LOD) Layer Streaming

**Phase**: 2 of 4 (Main IxWorld Map Optimization)  
**Target System**: `src/hooks/useMapDataBatched.ts`, `src/components/maps/core/hooks/useWorldMapLayers.ts`  
**Goal**: Stream low-resolution simplified country boundaries at low zoom ($z \le 4$), lazily fetching high-resolution subdivisions, cities, and POIs only when zoomed in ($z \ge 5$).

---

## 1. Problem Statement

Currently, `useMapDataBatched.ts` fetches the entire multi-megabyte GeoJSON payload containing 100k-cell Voronoi polygon boundaries, cities, subdivisions, and POIs on initial map load.
This blocks initial render on slow connections and causes heavy memory consumption (~120MB heap) even when the user is only viewing the world overview.

---

## 2. Architecture & Ponytail / TS-Expert Design

### Ponytail Principle
- **Pay as You Zoom**: Never download high-detail subdivision geometries until the user zooms into a region.
- **2-Tier Data Partitioning**:
  - **Tier 0 (Overview, $z \le 4$)**: Simplified country boundaries & national capitals (< 250KB).
  - **Tier 1 (Detailed, $z \ge 5$)**: Subdivisions, local cities, POIs, and rivers (fetched lazily on demand).

### TypeScript Expert Pattern

```typescript
export type LODTier = "overview" | "detailed";

export interface MapDataTierPayload {
  tier: LODTier;
  data: FeatureCollection;
  fetchedAtZoom: number;
}
```

---

## 3. Implementation Steps

### Step 1: Create `LODDataStreamer` (`src/hooks/useMapDataLOD.ts`)
Implement progressive LOD query hooks that fetch Tier 0 overview data immediately and defer Tier 1 detail payloads until zoom threshold $z \ge 5$ is crossed.

### Step 2: Update `useWorldMapLayers.ts`
Integrate LOD tier switching so low-res layers are displayed instantly while high-res layers stream in seamlessly in the background.

---

## 4. Machine-Checkable Verification

```bash
# Verify UI build
bun run typecheck:ui

# Test maps core suite
bun run test -- src/components/maps/core
```

### Expected Output
- Initial `/maps` page load size reduced by > 75% (under 300KB initial payload).
- Initial map interactive time reduced to $< 200\text{ms}$.
