# Unified Physical Geography Engine (UPG v2)

The **Unified Physical Geography Engine (UPG v2)** is the high-fidelity procedural realm map generator for IxStates. Located in [`src/lib/worldgen/v2/`](v2/), UPG v2 generates 100% topologically aligned, cartographically smooth, scientifically realistic fictional realm maps matching the aesthetic quality of the IxWorld reference map.

---

## Key Design Principles

1. **Whole-globe Voronoi mesh**: a latitude-compensated jittered grid (≈ ⅔ of `cellCount` cells, ~3,700 km² each at the default) with 5 Lloyd passes, covering ±90° and stitched across the antimeridian, so continents, rivers and borders cross ±180° without a seam. All noise is evaluated on the unit sphere (no seam, no polar pinching).
2. **Controlled landmasses**: `continentCount` continents are grown from centres inside `continentLatitudeRange` over a noisy cost field (size spread `continentSizeVariance`, an ocean gap between them), optional Antarctica-style `polarLand` caps, and `islandShare` of the land as archipelagos and volcanic arcs. Land is exactly `1 − oceanPercentage` of the globe.
3. **Hypsometric elevation**: land cells are ranked by relief (distance inland + convergent-boundary mountain belts + noise) and mapped onto the `hypsometry` curve, so the share of land in each of the 9 zones matches the target while mountains stay on the tectonic belts.
4. **Climate from physics, classified by Trewartha's rules**: zonal temperature with lapse rate and continentality, Coriolis wind belts, an upwind trace for onshore rain, continentality and distance-fading rain shadows, then month counts of a seasonal temperature curve decide the 12 Trewartha types. `temperatureOffset` and `precipitationScale` tune a world warmer/colder or wetter/drier.
5. **Topological layer locking**: all 7 GeoJSON layers come from the same cells, so coastlines, borders, biomes and isolines never drift apart. The quality gate is report-only and never edits the graph after hydrology.

---

## Realm Presets

`WORLD_PRESETS` in [`v2/config.ts`](v2/config.ts) reproduce the shape statistics of the two hand-drawn realm maps (measured 2026-10-11 from each realm's `map_layers` on a 0.5° grid):

|         | Land  | Continents                      | Polar land | Land < 100 m | Climate (ref.)                    |
| ------- | ----- | ------------------------------- | ---------- | ------------ | --------------------------------- |
| `ixnay` | 22.9% | ~6 mid-latitude + ~240 islands  | none       | 49%          | A 37, B 16, C 25, D 18, E/F/H 4   |
| `eurth` | 22.9% | 2 large, 2 medium + south-polar | south      | 40% (rugged) | A 21, B 23, C 11, D 24, E 9, F 13 |

```typescript
import { generateWorld } from "~/lib/worldgen/v2";
import { WORLD_PRESETS } from "~/lib/worldgen/v2/config";

const ixnayLike = generateWorld({ ...WORLD_PRESETS.ixnay, seed: 7 });
```

`src/tests/lib/worldgen/v2/presets.test.ts` holds the presets to those targets. Known gap: Eurth packs more continental (D) land into 40–60°N than the generator reliably does, so generated Eurth-likes run ~10 points low on D and high on A/B depending on seed.

---

## 8-Stage Pipeline Architecture

```
                       ┌─────────────────────────────────────────┐
                       │ Whole-Globe Voronoi Mesh (5-Pass Lloyd)  │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │ Tectonic Plate & Boundary Dynamics      │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │ Continents, Mountains & Hypsometry      │
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
                       │ 9-Check Quality Gate (report-only)      │
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

| Stage                        | Module                                    | Key Operations                                                                                                                                                                                                                                                      |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Mesh                      | [`mesh.ts`](v2/mesh.ts)                   | Whole-globe Voronoi cells, 5 Lloyd passes, adjacency graph stitched across the antimeridian, polar boundary rows.                                                                                                                                                   |
| 2. Tectonics                 | [`tectonics.ts`](v2/tectonics.ts)         | Plates, velocity vectors, convergent/divergent/transform classification, BFS distance to boundaries.                                                                                                                                                                |
| 3. Terrain                   | [`terrain.ts`](v2/terrain.ts)             | Continents, polar caps, islands; plate types from land cover; convergent mountain belts; hypsometric elevation; ocean depth.                                                                                                                                        |
| 4. Coastlines                | [`coastlines.ts`](v2/coastlines.ts)       | Fjords ($                                                                                                                                                                                                                                                           | lat | > 48^\circ$), peninsulas and bays, single-cell speck removal, geographic feature classification. |
| 5. Hydro-Climate             | [`hydro-climate.ts`](v2/hydro-climate.ts) | Wind belts, upwind trace, temperature, ocean currents, precipitation, priority-flood depression filling, rivers with tributaries and watersheds, lakes (`lakeCoverage`), 12 Trewartha biomes.                                                                       |
| 6. Quality Gate              | [`quality-gate.ts`](v2/quality-gate.ts)   | 9 scientific/aesthetic checks (continent count, shape diversity, mountain alignment, river drainage, climate-zone coherence, lake placement, coastline complexity, land/ocean ratio, 9-zone elevation coverage). Report-only.                                       |
| 7. Politics                  | [`politics.ts`](v2/politics.ts)           | Cultures, spaced capitals (one per country, `countryCountRange`) and towns, Dijkstra country expansion over natural border costs (rivers, mountains, coastlines), exclave repair.                                                                                   |
| 8. Export & Vector Synthesis | [`export.ts`](v2/export.ts)               | Polygon ring merging, 3-stage vector synthesis (Douglas-Peucker decimation $\rightarrow$ Catmull-Rom spline subdivision, 2 passes for polygons / 3 for rivers $\rightarrow$ multi-octave harmonic noise perturbation), 7 topology-locked GeoJSON layer collections. |

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
    altitudes: FeatureCollection; // 9-zone cumulative topography isolines (zone_0 to zone_8)
    climate: FeatureCollection; // 12 Trewartha biome polygons
    political: FeatureCollection; // National country territories with _id, _displayName, _fillColor, _areaSqKm
    rivers: FeatureCollection; // Hydrographic river LineStrings (_strokeColor #0284c7, lengthKm, flux)
    lakes: FeatureCollection; // Inland waterbody lake polygons (_fillColor #0284c7, areaKm2)
    icecaps: FeatureCollection; // Polar ice cap polygons (#ffffff)
  };
  stats: WorldStats;
}
```

### Render Layer Stacking Order

MapLibre layers are mounted in `zIndex` order (`LAYER_CONFIGS` in `src/lib/maps/map-config.ts`) to ensure proper visual hierarchy:

```
  zIndex 8: country_labels
  zIndex 7: rivers          <── Renders ABOVE political fills
  zIndex 6: lakes, icecaps  <── Renders ABOVE political fills
  zIndex 4: political       <── National territory fills (opacity 0.45)
  zIndex 2: climate         <── Trewartha biomes (opacity 0.35)
  zIndex 1: altitudes       <── 9-zone topographic isolines (opacity 0.75)
  zIndex 0: background      <── Landmass base (#e8e5da)
```

---

## Standard Elevation Zones (9-Zone System)

| ID  | Zone ID  | Name             | Min (m) | Max (m) | Color       |
| --- | -------- | ---------------- | ------- | ------- | ----------- |
| 0   | `zone_0` | Coastal Lowlands | 0       | 99      | `#a8c995ff` |
| 1   | `zone_1` | Low Hills        | 100     | 349     | `#c3d3a1ff` |
| 2   | `zone_2` | Rolling Hills    | 350     | 499     | `#dcdcacff` |
| 3   | `zone_3` | Uplands          | 500     | 999     | `#f7e6b8ff` |
| 4   | `zone_4` | Low Mountains    | 1000    | 1999    | `#dac497ff` |
| 5   | `zone_5` | Mid Mountains    | 2000    | 2999    | `#bea276ff` |
| 6   | `zone_6` | High Mountains   | 3000    | 3999    | `#9c7b50ff` |
| 7   | `zone_7` | Alpine           | 4000    | 4999    | `#7a5c34ff` |
| 8   | `zone_8` | Glacial Peaks    | 5000    | 9000    | `#f0f0f0ff` |

---

## Core Programmatic Usage

### Synchronous Generation

```typescript
import { generateWorld } from "~/lib/worldgen/v2";

const world = generateWorld({
  seed: 42,
  oceanPercentage: 0.7,
  continentCount: 6,
  continentLatitudeRange: [-50, 60],
  polarLand: { north: false, south: true },
  countryCountRange: [60, 200],
});

console.log(
  `Generated ${world.stats.countryCount} nations across ${world.stats.continentCount} continents`
);
```

### Progress-Monitored Generation (Labs & Async Pipelines)

```typescript
import { generateWorld } from "~/lib/worldgen/v2";

const world = generateWorld({ seed: 12345 }, (stageName, percentComplete) => {
  console.log(`Stage: ${stageName} (${percentComplete}%)`);
});
```

---

## Testing & Verification

The UPG v2 engine has 13 Jest test files in `src/tests/lib/worldgen/v2/` (plus `src/tests/lib/maps/pipeline/enrichment-pipeline.test.ts` for the map pipeline):

```bash
# Run all UPG v2 unit, integration, performance, and quality gate tests (Jest)
bun run test -- src/tests/lib/worldgen/v2 src/tests/lib/maps/pipeline
```

### Key Test Suites:

- `mesh.test.ts`: Voronoi mesh density, spatial distribution, and boundary detection.
- `terrain.test.ts`: Heightmaps, elevation zone assignments, mountain ridges.
- `coastlines.test.ts`: Feature classification and speck removal.
- `quality-gate.test.ts`: 9-check quality evaluation; the gate never mutates the graph.
- `presets.test.ts`: Ixnay/Eurth preset fidelity and regressions from the 2026-10 audit.
- `integration.test.ts`: Multi-seed end-to-end pipeline validation across seeds `1`, `42`, `100`, `256`, `777`.
- `multi-seed-audit.test.ts`: 10-seed scientific composite score enforcement ($\ge 85\%$).
