# Unified Physical Geography Engine (UPG v2)

The **Unified Physical Geography Engine (UPG v2)** is the high-fidelity procedural realm map generator for IxStates. Located in [`src/lib/worldgen/v2/`](v2/), UPG v2 generates 100% topologically aligned, cartographically smooth, scientifically realistic fictional realm maps matching the aesthetic quality of the IxWorld reference map.

It runs in the browser: the World tab of the world editor and the admin [World Studio](../../../docs/systems/maps.md#atlas-and-world-studio) generate in a Web Worker ([`worker/`](worker/)), preview the result, and upload it as a bundle that the server's `world` map import job writes (the server never generates). The generator and its pure helpers (`land-mask`, `baseline`, `relief*`, `world-stats`, `measure-world`) are shared by the worker and the server; `worker/` runs only in the browser, as do the World tab's and the Studio's own helpers (controls, draft recipes, fields, diagnostics, PNG render).

---

## Key Design Principles

1. **Whole-globe Voronoi mesh**: a latitude-compensated jittered grid (66,626 cells at the default `cellCount`, ~7,650 km² each) with 5 Lloyd passes, covering ±90° and stitched across the antimeridian, so continents, rivers and borders cross ±180° without a seam. All noise is evaluated on the unit sphere (no seam, no polar pinching).
2. **Controlled landmasses**: `continentCount` continents are grown from centres inside `continentLatitudeRange` over a noisy cost field (size spread `continentSizeVariance`, an ocean gap between them), optional Antarctica-style `polarLand` caps, and `islandShare` of the land as archipelagos and volcanic arcs. Land is exactly `1 − oceanPercentage` of the globe.
3. **Hypsometric elevation**: land cells are ranked by relief (distance inland + convergent-boundary mountain belts + noise) and mapped onto the `hypsometry` curve, so the share of land in each of the 9 zones matches the target while mountains stay on the tectonic belts.
4. **Climate from physics, classified by Trewartha's rules**: zonal temperature with lapse rate and continentality, Coriolis wind belts, an upwind trace for onshore rain, continentality and distance-fading rain shadows, then month counts of a seasonal temperature curve decide the 12 Trewartha types. `temperatureOffset` and `precipitationScale` tune a world warmer/colder or wetter/drier.
5. **Topological layer locking**: all 7 GeoJSON layers come from the same cells, so coastlines, borders, biomes and isolines never drift apart. The quality gate is report-only and never edits the graph after hydrology.

---

## Realm Presets

`WORLD_PRESETS` in [`v2/config.ts`](v2/config.ts) are the factory defaults. The presets people use live in the database (`WorldPreset`, seeded from `WORLD_PRESETS` on first read; draft, publish and versions in World Studio; see [Presets](../../../docs/systems/maps.md#presets)); `WORLD_PRESETS` stays in code as what "Reset to factory" goes back to, the test fixtures and the fallback when the database cannot be read. [`world-presets.ts`](world-presets.ts) holds the pure side (`FACTORY_PRESETS`, `resolvePreset`). A preset is a `WorldPresetParams` (`Partial<Omit<WorldGenParams, "seed">>`): a recipe without a seed.

`WORLD_PRESETS` reproduce the shape statistics of the two hand-drawn realm maps (measured 2026-10-11 from each realm's `map_layers` on a 0.5° grid, summing overlapping climate polygon areas):

|         | Land  | Continents                      | Polar land | Land < 100 m | Climate (ref.)                    |
| ------- | ----- | ------------------------------- | ---------- | ------------ | --------------------------------- |
| `ixnay` | 22.9% | ~6 mid-latitude + ~240 islands  | none       | 49%          | A 37, B 16, C 25, D 18, E/F/H 4   |
| `eurth` | 22.9% | 2 large, 2 medium + south-polar | south      | 40% (rugged) | A 21, B 23, C 11, D 24, E 9, F 13 |

```typescript
import { generateWorld } from "~/lib/worldgen/v2";
import { WORLD_PRESETS } from "~/lib/worldgen/v2/config";

const ixnayLike = generateWorld({ ...WORLD_PRESETS.ixnay, seed: 7 });
```

`src/tests/lib/worldgen/v2/presets.test.ts` holds the presets to those targets. The Studio's Calibration tab measures with [`measure-world.ts`](measure-world.ts) instead, on painted land only (see [Measuring a world](#measuring-a-world)), so its climate figures are not comparable with this table: on the local clone Ixnay reads A 25, B 19, C 31, D 21, E 2, F 0.2, H 1. Known gap: Eurth packs more continental (D) land into 40–60°N than the generator reliably does, so generated Eurth-likes run ~10 points low on D and high on A/B depending on seed.

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

### Staged generation

[`v2/stages.ts`](v2/stages.ts) groups the eight stages above into five restart points, so a changed parameter reruns only what reads it. `generateWorldStaged(params, onProgress, { cache })` takes a `StageCache` and returns the world with `restartedAt` and the finished `graph`; `generateWorld` is a full run of the same code.

| Restart point | Runs                                    | Reads (`STAGE_FIELDS`)                                                                                                                                                                                           |
| ------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mesh`        | 1. Mesh                                 | `seed`, `cellCount`, `lloydIterations`                                                                                                                                                                           |
| `land`        | 2. Tectonics, 3. Terrain, 4. Coastlines | `seed`, `plateCount`, `continentCount`, `continentLatitudeRange`, `continentSizeVariance`, `islandShare`, `polarLand`, `oceanPercentage`, `terrainRoughness`, `coastlineComplexity`, `hypsometry`, the land mask |
| `climate`     | 5. Hydro-Climate, 6. Quality Gate       | `temperatureOffset`, `precipitationScale`, `riverDensity`, `lakeCoverage`, `hasRivers`, `hasLakes`                                                                                                               |
| `nations`     | 7. Politics                             | `seed`, `countryCountRange`, `useMarkovNaming`, keep-borders                                                                                                                                                     |
| `output`      | 8. Export, slots, packed cells          | `hasIcecaps`, `developmentLevel` (read only after export, by `buildSlots`)                                                                                                                                       |

`planRestart(prev, next)` returns the first stage whose inputs differ (the land mask by identity), and `output` when nothing did. Every stage seeds its own random stream from `seed + offset` and writes only the arrays it owns, so a restarted run equals a full run; `stages.test.ts` pins that for every stage, both seeds, Ixnay and Eurth, with and without a mask, for every single parameter and for chains of changes.

The cache holds at most one snapshot per stage, copies of the cell arrays the later stages write: the land snapshot (17 bytes per cell) and the climate snapshot (56; the climate stage rewrites `h`, `isLand` and `elevZone`, so each owns its copy), and for nations the finished graph itself (60, no copy). Restoring copies out of a snapshot and never hands one out. `begin()` marks the cache unusable until `finish()`, so a half-finished run can never be restarted from, and a restart that throws is run again in full once (the worker runner does that; a failed first run is not repeated). The worker also keeps one rasterised land mask per `maskKey` (`<realm slug>:<mapVersion>`) so a realm's mask is not rasterised on every request.

On this machine, default size, Eurth, under Bun, restart time of the call (median of 5 warm): mesh 593 ms, land 307, climate 139, nations 76, output 64. Limits 1000, 600, 250, 250 and 200 ms, gated by `bun run perf:atlas`.

### Stage Details

| Stage                        | Module                                    | Key Operations                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Mesh                      | [`mesh.ts`](v2/mesh.ts)                   | Whole-globe Voronoi cells, 5 Lloyd passes, adjacency graph stitched across the antimeridian, polar boundary rows.                                                                                                                                                                                                                                                                                                         |
| 2. Tectonics                 | [`tectonics.ts`](v2/tectonics.ts)         | Plates, velocity vectors, convergent/divergent/transform classification, BFS distance to boundaries.                                                                                                                                                                                                                                                                                                                      |
| 3. Terrain                   | [`terrain.ts`](v2/terrain.ts)             | Continents, polar caps, islands; plate types from land cover; convergent mountain belts; hypsometric elevation; ocean depth.                                                                                                                                                                                                                                                                                              |
| 4. Coastlines                | [`coastlines.ts`](v2/coastlines.ts)       | Fjords (above 48° latitude), peninsulas and bays, single-cell speck removal, geographic feature classification. With a land mask the coast is kept as given: no carving, no sunk islands.                                                                                                                                                                                                                                 |
| 5. Hydro-Climate             | [`hydro-climate.ts`](v2/hydro-climate.ts) | Wind belts, upwind trace, temperature, ocean currents, precipitation, priority-flood depression filling, rivers with tributaries and watersheds, lakes (`lakeCoverage`), 12 Trewartha biomes.                                                                                                                                                                                                                             |
| 6. Quality Gate              | [`quality-gate.ts`](v2/quality-gate.ts)   | 9 scientific/aesthetic checks (continent count, shape diversity, mountain alignment, river drainage, climate-zone coherence, lake placement, coastline complexity, land/ocean ratio, 9-zone elevation coverage). Report-only.                                                                                                                                                                                             |
| 7. Politics                  | [`politics.ts`](v2/politics.ts)           | Cultures, spaced capitals (one per country; the target count is the middle of `countryCountRange`) and towns, Dijkstra country expansion over natural border costs (rivers, mountains, coastlines), exclave repair. `buildSlots` turns each country into a nation slot. Skipped when the realm keeps its borders.                                                                                                         |
| 8. Export & Vector Synthesis | [`export.ts`](v2/export.ts)               | Polygon ring merging on interned integer vertex ids, 3-stage vector synthesis (Douglas-Peucker decimation $\rightarrow$ Catmull-Rom spline subdivision, 2 passes for polygons / 3 for rivers $\rightarrow$ multi-octave harmonic noise perturbation), 7 topology-locked GeoJSON layer collections. Shared borders are smoothed chain by chain so both sides stay identical; every coordinate is clamped to ±90° latitude. |

---

## GeoJSON Layer Contract

UPG v2 exports 7 standardized GeoJSON layer feature collections:

```typescript
export interface GeneratedWorld {
  seed: number;
  params: WorldGenParams;
  layers: {
    background: FeatureCollection; // Base landmass polygons (#e8e5da)
    altitudes: FeatureCollection; // 9-zone cumulative topography isolines (zone_0 to zone_8)
    climate: FeatureCollection; // 12 Trewartha biome polygons
    political: FeatureCollection; // National territories: _id, _displayName, _fillColor, _areaSqKm, slotKey. Absent when the realm keeps its borders
    rivers: FeatureCollection; // Hydrographic river LineStrings (_strokeColor #0284c7, lengthKm, flux)
    lakes: FeatureCollection; // Inland waterbody lake polygons (_fillColor #0284c7, areaKm2)
    icecaps: FeatureCollection; // Polar ice cap polygons (#ffffff)
  };
  slots: WorldSlot[]; // One per generated country: key, suggested name, colour, cells, areaKm2, derived population and gdpPerCapita
  cells: Float32Array; // Packed lng, lat, height (m) per cell: the relief's input
  stats: WorldStats;
  graph?: WorldGraph;
}
```

The export names only countries (and their slots). Cities, named rivers and lakes, peaks and labels are not exported.

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

The hillshade is not a vector layer: it is the raster layer `relief` (kind `overlay`), drawn over elevation and climate and under the political fill (see [Relief](#relief)).

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

### Progress-Monitored Generation

```typescript
import { generateWorld } from "~/lib/worldgen/v2";

const world = generateWorld({ seed: 12345 }, (stageName, percentComplete, message) => {
  console.log(`Stage: ${stageName} (${percentComplete}%) ${message}`);
});
```

### Options: generate to fit, borders kept, mesh cache

```typescript
import { generateWorld, MeshCache } from "~/lib/worldgen/v2";
import { rasterizeLandMask } from "~/lib/worldgen/land-mask";

const meshCache = new MeshCache();
const world = generateWorld({ seed: 7 }, undefined, {
  landMask: rasterizeLandMask({ background, political, altitudes }), // a realm's own layers
  keepBorders: true, // no countries are generated; no political layer, no slots
  meshCache, // reused while seed, cellCount and lloydIterations stay the same
});
```

---

## Generate to Fit

[`land-mask.ts`](land-mask.ts) rasterises a realm's `background` and `political` layers (even-odd scanline fill, holes respected, edges taken the short way over ±180°, a ring round a pole closed over it) into a 1024-wide equirectangular mask; altitude bands, when the realm has them, give each pixel its highest band. `generateWorld({ landMask })` then:

- takes land from the mask instead of growing continents, and skips fjord, bay and peninsula carving so the coast is kept; mountains, hypsometry and everything downstream run as before, and the bands pull the relief ranking;
- with `keepBorders`, skips the politics stage and omits `political` and the slots (the server gives each political feature that has no country a claimable one).

The World tab's "This realm's map" source uses this; the worker rasterises the layers itself.

## Nation Slots and the Derived Baseline

[`baseline.ts`](baseline.ts) (`deriveBaseline`, pure) gives a slot what a claimant starts with:

- **Population** is the habitable land (no ice caps, high peaks or lakes) times a density per climate group (A tropical 55, B dry 10, C subtropical 110, D temperate 80, E boreal 6, F polar 0.5, H highland 15 per km² at the industrial level), scaled 0.8 / 1 / 1.25 by development level.
- **GDP per capita** is the level's base (developing 6,000, industrial 20,000, modern 45,000) times a geography factor (climate, coast and river access) clamped to 0.75 to 1.25.

`buildSlots` (in `politics.ts`) applies it to each generated country; areas are geodesic (they match PostGIS within about 1%). The server re-checks the figures against the measured area before it writes a slot. [`world-stats.ts`](world-stats.ts) summarises a world for the World tab: land share, continents, climate mix, slot count and the baseline range.

## Diagnostics and the PNG Render

All drawn from a finished graph by the worker, as images. [`diagnostics.ts`](diagnostics.ts) draws one of `height`, `temperature`, `rainfall`, `flow` or `cells` at 2048 px wide (rasterised with [`raster-draw.ts`](raster-draw.ts), then warped to Web Mercator rows with the relief's step so MapLibre can place it) with a legend (`{ kind, title, unit, domain, scale, stops, clipped }`: temperature fixed at -30 to 38 °C, rainfall 0 to 4500 mm a year, flow log over this world's river cells, height from the elevation zones). `seeds` returns each nation's capital cell as a point collection. [`render-png.ts`](render-png.ts) composes an equirectangular map at 2048, 4096 or 8192 px wide (ocean, land by band, optional political fills, relief, lakes, borders, rivers); the relief is made at up to 2048 px and upsampled, and `worker/encode-png.ts` encodes with `OffscreenCanvas.convertToBlob`, detaching the RGBA buffer first. Composing 8192 px takes about 0.8 s with politics and 0.5 s without; 8192 × 4096 is over iOS Safari's canvas limit. Both are pure up to the canvas, so jest runs them with a stub encoder. Land and political edges in the images are Voronoi-cell shaped; the exported layers are spline-smoothed.

The worker answers `diagnostic`, `seeds`, `render` and `measure` requests apart from generate requests, by their own request ids. The runner holds the last finished graph and cached diagnostics, clears them when any generate starts, and rejects a request for a world it no longer holds; the session rejects every pending request when a newer generate starts.

## Measuring a World

[`measure-world.ts`](measure-world.ts) (`measureWorld`, pure, no `node:*`) is the one sampler behind the Studio's Calibration tab, run on both sides. It rasterises a world's (or a realm's) layers on a 0.5° grid (720 × 360, cos(lat) weights; land and elevation zones through `rasterizeLandMask`, climate through `rasterizeValues`, both in [`land-mask.ts`](land-mask.ts)) and returns the land share, nine hypsometry shares, the climate mix over the seven Trewartha groups (and `unclassifiedShare`), the nation count with median and p90 area, and the coastline length (ring edges not shared by two rings). The worker measures a generated world in about 100 ms; the server measures a stored realm from its `geometry` JSON (`src/server/modules/maps/realm-calibration.ts`, cached by map version). Climate encodings are normalised to Trewartha groups: `properties.code`, then `biomeId`, then `climateId` or colour through the realm's key, then nearest colour.

## Studio Helpers

World Studio's own pure modules sit beside the founder's: `studio-fields.ts` (every parameter by stage group, ranges pinned to the zod schema, which fields a fitted map decides), `studio-recipe.ts` (browser storage per user), `studio-presets.ts` (the preset list as the Studio shows it), `calibration-distance.ts` (the single distance per realm), `studio-apply.ts` (what the Ship tab may apply where), `world-export.ts` (layer files, download names, blob download) and `zip-store.ts`, a store-only zip writer with CRC32 and no dependency, behind the GeoJSON export.

## Mesh Cache and Speed

`MeshCache` (in [`v2/mesh.ts`](v2/mesh.ts)) keeps the geometry of the last two meshes by `(seed, cellCount, lloydIterations)`, so a slider change, which keeps all three, skips the mesh (about 0.35 s of a 0.85 s first generation). Each `get` returns a fresh graph that shares the geometry; the stages write the attribute arrays and never the geometry. Other speed-ups: terrain noise and step costs precomputed in typed arrays, Lloyd relaxation updated in place, polygon merge on integer vertex ids. At the default size (66,626 cells) on this machine, under Bun: first generation about 0.87 s and reroll about 0.7 s (targets 1.0 and 0.9 s), and the per-stage restarts above. `bun run perf:atlas` gates these ([`scripts/perf/atlas-bench-worldgen.ts`](../../../scripts/perf/atlas-bench-worldgen.ts)) and prints the worker's end-to-end time per message.

## Relief

[`relief.ts`](relief.ts) (pure, shared by the worker and the server tiles):

- **Heights from cells** (`heightsFromCells`): the cell triangulation (d3-delaunay, with copies across the antimeridian) rasterised to a 2048×1024 equirectangular grid.
- **Heights from bands** (`heightsFromBands`, Ixnay and any realm with altitude bands): the stored bands drawn in zone order, then interpolated between each band's floor and ceiling by distance transforms. A realm with no altitude bands has no relief to build; the pipeline's `relief` step reports it as skipped.
- **Detail** (`addDetail`, [`relief-noise.ts`](relief-noise.ts)): a tileable 256² fractal texture scaled by altitude, at a fixed ruggedness of 1.
- **Hillshade** (`hillshade`): light from the northwest (315°) at 45°, slope scaled by metres per pixel at each latitude; shadows black up to alpha 0.55, lit slopes white up to 0.2, flat land and sea transparent.

The server builds it as the raster layer `relief` (`src/server/modules/maps/realm-relief.ts`): tiles z0 to 5 in lossy WebP (quality 70, alpha 60), fully transparent tiles skipped, a missing relief tile answered with one cached transparent tile, versioned by a hash of the picture so an unchanged world is never rebuilt. A world costs about 500 to 740 tiles and 3 MB. The preview ([`relief-preview.ts`](relief-preview.ts)) runs the same pipeline at 1024 px and warps it to Web Mercator rows for a MapLibre image source.

## The Worker

[`worker/`](worker/): `world.worker.ts` connects the Web Worker scope to `world-runner.ts` (`createWorldRunner`, callable directly), which owns the `MeshCache`, rasterises the land mask, calls `generateWorld`, then returns the layers as JSON strings, the slots, the stats, the packed cells and the preview relief (cells and relief transferred). `world-gen-session.ts` is the lifecycle behind `useWorldGenerator`: an idle worker is reused (its mesh cache survives slider changes), a worker still busy is terminated when a newer request arrives (a message cannot interrupt the synchronous generator), answers to anything but the latest request are dropped, and a run that takes more than 30 s ends in the error state. `create-world-worker.ts` is the only file with `import.meta.url`, so tests inject a fake worker. The runner owns a `StageCache` and the mask cache, and `useWorldGenerator` also exposes `diagnostic`, `nationSeeds`, `renderPng` and `measure`, which the Studio calls.

---

## Testing & Verification

The engine's Jest suites are in `src/tests/lib/worldgen/` (`v2/` for the stages and the generator, `worker/` for the runner and the factory, the rest for the mask, baseline, relief and stats):

```bash
# Run all worldgen unit, integration, performance, and quality gate tests (Jest)
bun run test -- src/tests/lib/worldgen --maxWorkers=1
# The generator's timing targets and the worker runner, against the local clone
bun run perf:atlas
```

### Key Test Suites:

- `mesh.test.ts`: Voronoi mesh density, spatial distribution, and boundary detection.
- `terrain.test.ts`: Heightmaps, elevation zone assignments, mountain ridges.
- `coastlines.test.ts`: Feature classification and speck removal.
- `quality-gate.test.ts`: 9-check quality evaluation; the gate never mutates the graph.
- `presets.test.ts`: Ixnay/Eurth preset fidelity and regressions from the 2026-10 audit.
- `integration.test.ts`: Multi-seed end-to-end pipeline validation across seeds `1`, `42`, `100`, `256`, `777`.
- `multi-seed-audit.test.ts`: 10-seed scientific composite score enforcement ($\ge 85\%$).
- `generate-to-fit.test.ts`: land mask and kept borders. `polygon-merge.test.ts`: the integer-key merge against the string-key reference. `performance.test.ts`: the cached-mesh slider change within budget.
- `stages.test.ts`: `planRestart` for every field and a restart equals a full run for every stage. `diagnostics.test.ts`, `raster-draw.test.ts`, `render-png.test.ts`: the diagnostic images, the rasteriser and the PNG layout. `measure-world.test.ts`, `zip-store.test.ts`, `studio-*.test.ts`: the sampler, the zip writer and the Studio's pure modules.
- `export.test.ts`, `ring-geometry.test.ts`, `ring-smooth.test.ts`: valid exported polygons, shared borders identical, areas within tolerance.
- `baseline.test.ts`, `land-mask.test.ts`, `relief.test.ts`, `relief-preview.test.ts`, `world-stats.test.ts`, `worker/*`: the pure modules and the runner.
