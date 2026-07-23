# Unified Physical Geography Engine (UPG v2)

The **Unified Physical Geography Engine (UPG v2)** is the high-fidelity procedural realm map generator for IxStates. Located in [`src/lib/worldgen/v2/`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/), UPG v2 generates 100% topologically aligned, cartographically smooth, scientifically realistic fictional realm maps matching the aesthetic quality of the IxWorld reference map.

---

## Key Design Principles

1. **Fixed 100,000-Cell Spatial Mesh**: Uses a single high-density Voronoi mesh (`WorldGraph`, 100,000 cells, 5 Lloyd relaxation iterations). No user-facing cell resolution sliders—mesh density is locked to ensure uniform cartographic fidelity.
2. **Coastal Hypsometric Slope Damping**: Smooth exponential coastal dampening ($H_{\text{damped}}[i] = H[i] \cdot (1.0 - 0.85 \cdot e^{-0.35 \cdot \text{coastDist}[i]})$) keeps shoreline land in lowlands (`zone_0`/`zone_1`, 0–350m), preventing glacial mountain peaks (`zone_8`) from touching ocean borders.
3. **Polar Soft Clamping**: High-latitude noise dampening (`polarFactor = cos(((absLat - 70) / 18) * (PI / 2))`) for $|lat| > 70^\circ$. South Pole ($lat < -74^\circ$) clamps to a stable +800m polar continent plateau; North Pole ($lat > 76^\circ$) clamps to a -1500m Arctic sea basin with ice caps, eliminating map projection pinching.
4. **Option A 3-Stage IxWorld Vector Synthesis Engine**:
   - **Douglas-Peucker Decimation (`simplifyRing`)**: Strips high-frequency Voronoi cell chatter ($120^\circ$ direction flips) before curve calculation.
   - **Control Point Catmull-Rom Subdivision (`catmullRomSmooth`)**: Passes clean structural control points into 3-pass Catmull-Rom spline subdivision ($\tau = 0.5$) for smooth Bezier arcs at all zoom levels without scalloped wave bumps.
   - **Multi-Octave Harmonic Vector Perturbation (`perturbRing`)**: Morphs vector coordinates with continuous harmonic noise matching IxWorld's `vector-synthesis.ts` architecture for organic fractal cartography.
5. **Topological Layer Locking**: All 7 GeoJSON output layers (`background`, `altitudes`, `climate`, `political`, `rivers`, `lakes`, `icecaps`) share the exact same underlying Voronoi mesh graph, guaranteeing zero visual drift, gaps, or overlapping artifacts between coastlines, borders, biomes, and isolines.

---

## 8-Stage Pipeline Architecture

```
                       ┌─────────────────────────────────────────┐
                       │ 100,000-Cell Voronoi Mesh (5-Pass Lloyd) │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │ Tectonic Plate & Boundary Dynamics      │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │ Multi-Fractal Terrain & Coastal Damping │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │ Coastlines, Fjords & Archipelagos       │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │ Hydrology, Rivers, Lakes & Biomes       │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │ Automated 9-Check Quality Gate          │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │ Natural-Border Political Country Overlay │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │ 3-Stage Vector Synthesis & GeoJSON Export│
                       └─────────────────────────────────────────┘
```

### Stage Details

| Stage | Module | Key Operations |
|-------|--------|----------------|
| 1. Mesh | [`mesh.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/mesh.ts) | 100,000 Voronoi cells, 5 Lloyd relaxation passes, adjacency graph, boundary cell classification. |
| 2. Tectonics | [`tectonics.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/tectonics.ts) | 10 tectonic plates, continental vs oceanic assignment, velocity vectors, convergent/divergent/transform classification, BFS distance fields. |
| 3. Terrain | [`terrain.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/terrain.ts) | Multi-octave fractal noise heightmap (meters), convergent mountain uplift, polar cosine soft clamping (North/South poles), 2-pass spatial Laplacian heightmap smoothing. |
| 4. Coastlines | [`coastlines.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/coastlines.ts) | Fjord carving ($|lat| > 48^\circ$), peninsula extension, bay formation, island filtering (< 5 cells), smooth exponential coastal slope damping (`coastDist <= 8`), geographic feature classification. |
| 5. Hydro-Climate | [`hydro-climate.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/hydro-climate.ts) | 8 sub-passes: temperature, lapse rate, Coriolis wind vectoring, rain shadow precipitation, priority-queue depression filling, steepest-descent river flow, tributary networks, lake basins, and 12 Trewartha biomes. Post-routing `elevZone` recalibration. |
| 6. Quality Gate | [`quality-gate.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/quality-gate.ts) | 9 scientific/aesthetic checks (continent count, shape diversity, mountain alignment, river drainage, rain shadow, lake placement, coastline complexity, land/ocean ratio, 9-zone elevation coverage). Performs in-place repairs. |
| 7. Politics | [`politics.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/politics.ts) | Culture centers, habitability-scored settlement seeding, Dijkstra shortest-path country expansion over natural border cost fields (rivers, mountains, coastlines), exclave repair, island capital proximity assignment. |
| 8. Export & Vector Synthesis | [`export.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/export.ts) | Polygon ring merging, 3-stage vector synthesis (Douglas-Peucker decimation $\rightarrow$ 3-pass Catmull-Rom spline subdivision $\rightarrow$ multi-octave harmonic noise perturbation), 7 topology-locked GeoJSON layer collections. |

---

## GeoJSON Layer Contract

UPG v2 exports 7 standardized GeoJSON layer feature collections:

```typescript
export interface GeneratedWorld {
  seed: number;
  params: WorldGenParams;
  graph: WorldGraph;
  layers: {
    background: FeatureCollection; // Base landmass polygons (#e8e5da)
    altitudes: FeatureCollection;  // 9-zone cumulative topography isolines (zone_0 to zone_8)
    climate: FeatureCollection;    // 12 Trewartha biome polygons
    political: FeatureCollection;  // National country territories with _id, _displayName, _fillColor, _areaSqKm
    rivers: FeatureCollection;     // Hydrographic river LineStrings (_strokeColor #0284c7, lengthKm, flux)
    lakes: FeatureCollection;      // Inland waterbody lake polygons (_fillColor #0284c7, areaKm2)
    icecaps: FeatureCollection;    // Polar ice cap polygons (#ffffff)
  };
  stats: WorldStats;
}
```

### Render Layer Stacking Order

MapLibre layers must be mounted in the following `zIndex` order to ensure proper visual hierarchy:

```
  zIndex 9: country_labels
  zIndex 8: icecaps
  zIndex 7: rivers          <── Renders ABOVE political fills
  zIndex 6: lakes           <── Renders ABOVE political fills
  zIndex 4: political       <── National territory fills (opacity 0.4)
  zIndex 2: climate         <── Trewartha biomes (opacity 0.35)
  zIndex 1: altitudes       <── 9-zone topographic isolines (opacity 0.75)
  zIndex 0: background      <── Landmass base (#e8e5da)
```

---

## Standard Elevation Zones (9-Zone System)

| ID | Zone ID | Name | Min (m) | Max (m) | Color |
|---|---|---|---|---|---|
| 0 | `zone_0` | Coastal Lowlands | 0 | 99 | `#a8c995ff` |
| 1 | `zone_1` | Low Hills | 100 | 349 | `#c3d3a1ff` |
| 2 | `zone_2` | Rolling Hills | 350 | 499 | `#dcdcacff` |
| 3 | `zone_3` | Uplands | 500 | 999 | `#f7e6b8ff` |
| 4 | `zone_4` | Low Mountains | 1000 | 1999 | `#dac497ff` |
| 5 | `zone_5` | Mid Mountains | 2000 | 2999 | `#bea276ff` |
| 6 | `zone_6` | High Mountains | 3000 | 3999 | `#9c7b50ff` |
| 7 | `zone_7` | Alpine | 4000 | 4999 | `#7a5c34ff` |
| 8 | `zone_8` | Glacial Peaks | 5000 | 9000 | `#f0f0f0ff` |

---

## Core Programmatic Usage

### Synchronous Generation

```typescript
import { generateWorld } from "~/lib/worldgen/v2";

const world = generateWorld({
  seed: 42,
  cellCount: 100000,
  oceanPercentage: 0.65,
  continentCount: 6,
  countryCountRange: [60, 200],
});

console.log(`Generated ${world.stats.countryCount} nations across ${world.stats.continentCount} continents`);
```

### Progress-Monitored Generation (Labs & Async Pipelines)

```typescript
import { generateWorld } from "~/lib/worldgen/v2";

const world = generateWorld(
  { seed: 12345 },
  (stageName, percentComplete) => {
    console.log(`Stage: ${stageName} (${percentComplete}%)`);
  }
);
```

---

## Testing & Verification

The UPG v2 engine features a comprehensive test suite across 17 test files:

```bash
# Run all UPG v2 unit, integration, performance, and quality gate tests
bun test ./src/lib/worldgen/v2/__tests__/ ./src/lib/map-pipeline/
```

### Key Test Suites:
- [`mesh.test.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/__tests__/mesh.test.ts): Voronoi mesh density, spatial distribution, and boundary detection.
- [`terrain.test.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/__tests__/terrain.test.ts): Heightmaps, elevation zone assignments, mountain ridges, and polar soft clamps.
- [`coastlines.test.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/__tests__/coastlines.test.ts): Feature classification, island filtering, and coastal slope damping.
- [`quality-gate.test.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/__tests__/quality-gate.test.ts): 9-check quality evaluation and deterministic in-place repairs.
- [`integration.test.ts`](file:///home/jxsig/projects/ixstats/src/lib/worldgen/v2/__tests__/integration.test.ts): Multi-seed end-to-end pipeline validation across seeds `1`, `42`, `100`, `256`, `777`.
- [`geographical-accuracy-analyzer.test.ts`](file:///home/jxsig/projects/ixstats/src/lib/map-pipeline/geographical-accuracy-analyzer.test.ts): Multi-seed scientific composite score enforcement ($\ge 85\%$).
