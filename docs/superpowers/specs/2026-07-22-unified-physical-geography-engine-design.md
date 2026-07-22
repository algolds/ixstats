# Unified Physical Geography Engine (UPG v2) — Design Specification

> **Status**: Draft  
> **Date**: 2026-07-22  
> **Author**: AI + jxsig  
> **Replaces**: `src/lib/worldgen/` (entire directory)

## 1. Problem Statement

The current world generation engine (`src/lib/worldgen/`) produces maps with three fundamental flaws:

1. **Decoupled sequential stages** — Heightmap, rivers, climate, and features run independently. Rivers don't influence climate. Mountains don't create rain shadows. Layers can diverge.
2. **Low-resolution mesh** — 1,500–20,000 Voronoi cells produce visible hexagonal tiles ("voxel look") no amount of post-processing smoothing can fix.
3. **No quality validation** — Generation outputs whatever it produces. No checks for realistic continent shapes, coherent climate, or drainage basin quality.

The goal: generate random maps **as detailed, organized, and clean as the main IxWorld map**, with slight improvements since we want to ensure generated realm maps are best-in-class.

## 2. Design Decisions (from brainstorming)

| Decision | Choice |
|----------|--------|
| Mesh resolution | **50,000+ cells** (ultra-detail, ~2–5s generation) |
| Architecture | **Single unified cell graph** — all layers share exact same geometry |
| Terrain model | **Tectonic plate simulation** — plates with velocities, convergent/divergent boundaries |
| Realism level | **Full IxWorld quality** — Coriolis wind, orographic rain shadows, ocean currents |
| Quality failures | **Repair in place** — every seed produces a valid world |
| Political borders | **Natural borders** — rivers, mountains, coastlines as boundaries |
| Data model | **Replace PackedGraph entirely** — clean-slate `WorldGraph` |

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                   Unified Generation Pass                      │
│                                                                │
│  ┌─────────┐   ┌───────────┐   ┌───────────┐   ┌──────────┐ │
│  │ Voronoi  │──▶│ Tectonic  │──▶│  Terrain   │──▶│Coastline │ │
│  │  Mesh    │   │  Plates   │   │ Elevation  │   │ Refine   │ │
│  │ (50K+)   │   │ (N plates)│   │ (from      │   │(fjords,  │ │
│  └─────────┘   └───────────┘   │  plates)   │   │peninsulas│ │
│                                 └───────────┘   └──────────┘ │
│       │                              │                │       │
│       ▼                              ▼                ▼       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │           Unified Hydrology + Climate Pass              │  │
│  │  depression fill → precipitation → flux → rivers →      │  │
│  │  lakes → wind/Coriolis → orographic rain → ocean        │  │
│  │  currents → temperature → biomes                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                │
│                              ▼                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │          Quality Validation + Repair (9 checks)         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                │
│                              ▼                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │     Political Overlay (read-only on physical geo)       │  │
│  │     Cultures → Settlements → Natural-border States      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                │
│                              ▼                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │         Export (7-layer GeoJSON, Chaikin smoothing)      │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 4. New Data Model: `WorldGraph`

Replaces `PackedGraph`. All per-cell data stored as parallel typed arrays indexed by cell ID.

```typescript
interface WorldGraph {
  cells: WorldCells;
  plates: TectonicPlate[];
  features: GeographicFeature[];    // oceans, continents, lakes
  rivers: RiverNetwork[];
  watersheds: Watershed[];
  states: PoliticalState[];
  cultures: CulturalRegion[];
  settlements: Settlement[];
}

interface WorldCells {
  n: number;                        // cell count (50,000+)
  p: Float64Array;                  // flat [lng0,lat0, lng1,lat1, ...] WGS84
  neighbors: number[][];            // adjacency
  vertices: [number, number][][];   // Voronoi polygon vertices

  // Tectonic
  plate: Uint16Array;               // plate ID
  plateDist: Float32Array;          // distance to nearest plate boundary

  // Terrain
  h: Float32Array;                  // elevation in meters (NOT 0-255 quantized)
  elevZone: Uint8Array;             // elevation zone 0-8
  coastDist: Uint16Array;           // BFS hops from coast
  isLand: Uint8Array;               // boolean: 1=land, 0=water
  isMountainRidge: Uint8Array;      // boolean: on plate convergent boundary

  // Hydrology
  downstream: Int32Array;           // cell ID of downhill neighbor (-1 = ocean)
  flux: Float32Array;               // accumulated water flow
  river: Uint16Array;               // river ID (0 = none)
  watershed: Uint16Array;           // watershed ID
  lake: Uint16Array;                // lake feature ID (0 = none)

  // Climate
  temp: Float32Array;               // temperature in °C (float, not int8)
  prec: Float32Array;               // precipitation mm/year (float, not uint8)
  windDir: Float32Array;            // prevailing wind direction (radians)
  windSpeed: Float32Array;          // relative wind strength
  oceanCurrentInfluence: Float32Array; // warming/cooling from ocean currents
  biome: Uint8Array;                // Trewartha biome ID
  aridity: Float32Array;            // 0=wet, 1=arid (derived from prec/evapotranspiration)

  // Feature membership
  feature: Uint16Array;             // geographic feature ID (ocean/continent/lake)
  boundary: Uint8Array;             // touches grid edge

  // Political (set later, read-only on physical)
  culture: Uint16Array;
  state: Uint16Array;
}
```

**Key differences from old PackedGraph:**
- `h` is `Float32Array` in meters (not `Uint8Array` 0-255) — no more quantization artifacts
- Explicit `isLand`, `isMountainRidge` booleans
- `downstream`, `watershed` for proper drainage analysis
- `windDir`, `windSpeed`, `oceanCurrentInfluence` for climate model
- `aridity` for desert/rain shadow detection
- `plateDist` for tectonic boundary effects

## 5. Stage Details

### 5.1 Voronoi Mesh (Stage 1)

**File**: `src/lib/worldgen/v2/mesh.ts`

- 50,000+ jittered grid points with latitude-compensated density (more points near poles to counteract Mercator distortion)
- Delaunay triangulation → Voronoi tessellation
- 3 Lloyd relaxation iterations (up from 2) for uniform cell size
- Extract adjacency, vertices, boundary flags
- Output: skeleton `WorldGraph` with geometry populated, all arrays zeroed

### 5.2 Tectonic Plates (Stage 2)

**File**: `src/lib/worldgen/v2/tectonics.ts`

1. **Plate seed placement**: 8–15 plate centers via farthest-point sampling on the mesh (configurable)
2. **Voronoi plate assignment**: Grow plates outward from seeds (BFS/flood-fill), assigning every cell to exactly one plate
3. **Velocity vectors**: Each plate gets a random velocity vector (direction + magnitude). Continental plates move slower. Oceanic plates move faster.
4. **Boundary classification**: For every cell adjacent to a different-plate cell, classify the boundary:
   - **Convergent** (plates moving toward each other): Mountains, subduction, volcanic arcs
   - **Divergent** (plates moving apart): Rift valleys, mid-ocean ridges, new crust
   - **Transform** (plates sliding past): Fault lines, moderate seismic activity
5. **Continental vs oceanic plates**: Some plates are designated continental (lower density, higher buoyancy = land), others oceanic. Ratio controlled by `oceanPercentage` param.

**Boundary classification algorithm:**
```
For each cell i with plate P_i, for each neighbor j with plate P_j where P_i ≠ P_j:
  v_rel = velocity(P_j) - velocity(P_i)      // relative velocity
  n = normalize(position(j) - position(i))    // boundary normal
  dot = v_rel · n
  if dot < -threshold: CONVERGENT (approaching)
  elif dot > threshold: DIVERGENT (separating)
  else: TRANSFORM (sliding)
```

### 5.3 Terrain Elevation (Stage 3)

**File**: `src/lib/worldgen/v2/terrain.ts`

Elevation is computed as a sum of tectonic effects + noise:

1. **Continental base**: Continental plate cells get base elevation ~200m. Oceanic plate cells get base elevation ~-3000m.
2. **Convergent boundary uplift**: Cells near convergent boundaries get massive elevation boost (up to +5000m). Width of mountain belt: 5-15 cells from boundary. Profile: Gaussian falloff from boundary.
3. **Divergent boundary depression**: Cells near divergent boundaries on land get rift valley depression (-200m to -500m from base). On ocean: mid-ocean ridge (+1000m from ocean floor).
4. **Subduction zone arcs**: Where oceanic plate subducts under continental plate, create volcanic island arc offset from the boundary.
5. **Multi-octave fractal noise**: 4 octaves (macro-continental, tectonic fault, hills, micro-relief) layered on top for natural variation. Noise frequencies and amplitudes are seed-derived.
6. **Coastal shelf**: Gradual elevation transition from land to deep ocean (continental shelf, ~200m depth, extending 2-5 cells offshore).
7. **Normalization**: Adjust global elevation distribution to match target `oceanPercentage` and ensure hypsometric curve follows Earth-like distribution.

### 5.4 Coastline Refinement (Stage 4)

**File**: `src/lib/worldgen/v2/coastlines.ts`

After terrain determines land/water threshold:

1. **Peninsula generation**: For coastal cells, probabilistic extension of land into water following prevailing noise patterns
2. **Fjord carving**: In high-latitude convergent coastal areas, carve narrow water inlets into land (1-3 cells wide, 5-15 cells deep)
3. **Archipelago generation**: Near subduction zones, scatter small island groups (clusters of 3-10 land cells)
4. **Bay formation**: On leeward (downwind) coasts, erode small concavities
5. **Minimum continent filter**: Any landmass with < 50 cells is reclassified as island or absorbed into ocean (prevents "dust" continents)

### 5.5 Unified Hydrology + Climate (Stage 5 — THE BIG ONE)

**File**: `src/lib/worldgen/v2/hydro-climate.ts`

This is the unified pass where rivers, lakes, precipitation, temperature, wind, and biomes are computed **together** in iterative refinement:

#### Pass 1: Base Temperature
- Latitude-based temperature: `T_base = 30 - 60 * |lat/90|`
- Altitude lapse rate: `T = T_base - 6.5 * (elevation_m / 1000)`
- Ocean moderation: coastal cells within 3 hops are pulled toward ocean temperature (moderating extremes)

#### Pass 2: Wind Patterns (Coriolis)
- **Trade winds** (0-30° lat): East → West
- **Westerlies** (30-60° lat): West → East  
- **Polar easterlies** (60-90° lat): East → West
- Wind direction stored per-cell with latitude-based interpolation
- Mountain barriers deflect wind (cells behind tall mountains in wind shadow get reduced wind speed)

#### Pass 3: Ocean Currents
- Simplified gyre model: warm currents on western sides of ocean basins (Gulf Stream analogs), cold currents on eastern sides (California Current analogs)
- Cells near warm currents get temperature boost (+3-8°C) and moisture boost
- Cells near cold currents get temperature drop (-3-5°C) and reduced moisture
- Computed by tracing wind-driven flow through ocean cells

#### Pass 4: Precipitation + Orographic Effects
- **Base precipitation**: Depends on latitude, coast distance, and ocean current moisture
- **Orographic lift**: Wind blowing against mountain slope → rain on windward side
  - For each mountain ridge cell, check upwind direction
  - Windward cells (facing the wind): precipitation boost × 1.5–3.0
  - Leeward cells (behind mountains in wind shadow): precipitation reduction × 0.2–0.5 (rain shadow = deserts)
- **Continental interior drying**: Precipitation decreases with distance from coast

#### Pass 5: Depression Fill + Drainage
- Priority-queue-based depression filling (ensures no local minima trap water flow)
- Compute `downstream[i]` = steepest descent neighbor for every land cell
- Accumulate flux from highest to lowest cells

#### Pass 6: River Detection + Network Building
- Threshold flux for river detection (adaptive: targets ~500-1500 rivers depending on land area)
- Trace river networks upstream from high-flux coastal cells
- Merge tributaries into main rivers (tributary joins = where two river-bearing cells flow into same downstream cell)
- **Rivers terminate at**: ocean, lake, or endorheic basin (desert interior with no outlet)
- Validate: NO river crosses a mountain ridge (if it does, reroute or eliminate)

#### Pass 7: Lake Formation
- **Topographic lakes**: Where flow accumulates in depression (after depression fill, some depressions become lakes if surrounded by higher terrain on all sides)
- **Rift lakes**: In divergent plate boundary rift valleys
- **Glacial lakes**: At high latitudes in post-glacial depressions
- Lakes are flood-filled water bodies with an outlet river

#### Pass 8: Biome Classification
- Uses Trewartha classification (12 types) based on temperature + precipitation + aridity
- **Key constraints**:
  - Ice caps: only at extreme latitudes or very high altitudes
  - Deserts: only in rain shadow zones, continental interiors, or subtropical high-pressure belts (20-30° lat)
  - Tropical wet: only at low latitudes with high precipitation
  - Highland: only above tree line (elevation > 3000m or latitude-adjusted)
  - Boreal: only at high latitudes with cold winters

### 5.6 Quality Validation + Repair (Stage 6)

**File**: `src/lib/worldgen/v2/quality-gate.ts`

Nine mandatory checks, each with an automated repair strategy:

| # | Check | Threshold | Repair Strategy |
|---|-------|-----------|-----------------|
| 1 | **Continent count** | ≥ `continentCount` param (default 4-7) | If too few: split largest continent by deepening a rift valley. If too many: merge smallest adjacent. |
| 2 | **Continent shape diversity** | No two continents with aspect ratio within 20% of each other AND all continents have convexity < 0.85 (not too blobby) | Re-seed coastal noise with different parameters for offending continents |
| 3 | **Mountain placement** | ≥ 80% of mountain cells (zone 5+) within 10 cells of a convergent plate boundary | Move isolated mountain cells closer to boundaries, or extend boundary influence zone |
| 4 | **River drainage** | 100% of rivers flow monotonically downhill. 0% of rivers cross mountain ridges. ≥ 90% of rivers reach ocean/lake | Re-run depression fill + re-trace for failing rivers |
| 5 | **Climate coherence** | Rain shadow exists on ≥ 70% of leeward mountain slopes. Equatorial belt (±15°) has tropical biomes. Polar regions (>70°) have tundra/ice | Force-set biomes for failing cells based on latitude/elevation/wind position |
| 6 | **Lake placement** | ≥ 80% of lakes in topographic depressions or rift valleys | Remove lakes that aren't in valid depressions |
| 7 | **Coastline complexity** | Fractal dimension of coastline > 1.15 (not too smooth/blobby). At least 1 peninsula, 1 bay, 1 archipelago per continent | Add fractal perturbation to too-smooth coastlines |
| 8 | **Land/ocean ratio** | Within ±8% of target `oceanPercentage` | Re-normalize elevation threshold |
| 9 | **Elevation zone coverage** | Each zone 0-8 represented on every continent with area > 1000 cells | Boost/lower elevation of cells on continents missing zones |

### 5.7 Political Overlay (Stage 7)

**File**: `src/lib/worldgen/v2/politics.ts`

Runs AFTER physical geography is finalized. Reads physical data, never writes to it.

1. **Culture seeding**: Place culture centers in habitable lowlands (zone 0-3, moderate temperature, near water). Culture spread uses terrain cost (mountains = high cost, rivers = low cost).
2. **Settlement placement**: Capital cities in high-scoring locations (coastal, near rivers, temperate, low elevation). Secondary cities at river confluences, natural harbors.
3. **Natural border detection**: Pre-compute a "border strength" field:
   - River cells: strength 0.8 (rivers make natural borders)
   - Mountain ridge cells (zone 5+): strength 1.0 (mountains make strongest borders)
   - Coastline: strength 1.0 (coast is always a border)
   - Everything else: strength 0.1
4. **State expansion**: Dijkstra expansion from capitals, but edge cost is `base_cost / border_strength`. This means expansion naturally stops at rivers and mountains, creating states whose borders follow geographic features.
5. **Connectivity repair**: Reassign disconnected exclaves to neighboring states (same as current).

### 5.8 Export (Stage 8)

**File**: `src/lib/worldgen/v2/export.ts`

Converts `WorldGraph` to 7-layer GeoJSON for IxWorldMap renderer:

1. **Cell polygon smoothing**: 3-pass Chaikin subdivision on all cell polygon edges before merging. At 50K+ cells, polygons are already small (~50km), so 3-pass Chaikin makes edges invisibly smooth.
2. **Layer merging**: Adjacent cells with same attribute merged into MultiPolygons using union algorithm.
3. **Property mapping**: Each feature gets the exact properties IxWorldMap expects (`_fillColor`, `_id`, `_displayName`, etc.)

Layers:
- `background`: All land cells merged by continent → continent polygons
- `altitudes`: Cells merged by elevation zone → nested elevation contour polygons (cumulative threshold: zone N = all cells with elevZone ≥ N)
- `climate`: Cells merged by biome → biome region polygons
- `political`: Cells merged by state → country polygons
- `rivers`: River networks as LineString features
- `lakes`: Lake features as Polygon features
- `icecaps`: Cells with biome = Ice Cap merged

## 6. File Structure

```
src/lib/worldgen/v2/
├── index.ts              # Main entry: generateWorld()
├── types.ts              # WorldGraph, WorldCells, all interfaces
├── config.ts             # WorldGenParams, defaults, ELEVATION_ZONES
├── mesh.ts               # Voronoi mesh generation (50K+)
├── tectonics.ts          # Tectonic plate simulation
├── terrain.ts            # Elevation from plates + noise
├── coastlines.ts         # Coastline refinement (fjords, etc.)
├── hydro-climate.ts      # Unified hydrology + climate pass
├── quality-gate.ts       # 9-check validation + repair
├── politics.ts           # Cultures, settlements, natural-border states
├── export.ts             # 7-layer GeoJSON export
├── helpers/
│   ├── rng.ts            # Seeded PRNG (carry over from v1)
│   ├── noise.ts          # Multi-octave fractal noise utilities
│   ├── flood-fill.ts     # BFS/flood-fill utilities
│   ├── chaikin.ts        # Chaikin curve subdivision
│   └── polygon-merge.ts  # Cell polygon union/merge
└── __tests__/
    ├── mesh.test.ts
    ├── tectonics.test.ts
    ├── terrain.test.ts
    ├── coastlines.test.ts
    ├── hydro-climate.test.ts
    ├── quality-gate.test.ts
    ├── politics.test.ts
    ├── export.test.ts
    ├── integration.test.ts        # Full pipeline end-to-end
    └── multi-seed-audit.test.ts   # 10-seed quality audit
```

## 7. Migration Strategy

1. Build v2 engine in `src/lib/worldgen/v2/` alongside existing v1
2. v2 `generateWorld()` returns a `GeneratedWorld` compatible with existing renderer
3. Feature-flag to switch between v1 and v2 in the UI
4. Once v2 is validated, delete v1 files and move v2 to `src/lib/worldgen/`

## 8. Performance Budget

| Stage | Target Time | Notes |
|-------|-------------|-------|
| Mesh (50K) | < 800ms | Delaunay + Lloyd × 3 |
| Tectonics | < 200ms | BFS flood-fill + velocity |
| Terrain | < 400ms | Noise + normalization |
| Coastlines | < 200ms | Coastal cell perturbation |
| Hydro-Climate | < 1500ms | The bottleneck: depression fill + flux + 8 passes |
| Quality Gate | < 300ms | Validation + targeted repairs |
| Politics | < 500ms | Dijkstra expansion |
| Export | < 500ms | Polygon merge + Chaikin smoothing |
| **Total** | **< 4.5s** | Target: 3-5 seconds |

## 9. Renderer Compatibility

The v2 export must produce GeoJSON layers with the exact same structure as the current IxWorldMap renderer expects. Key contracts:

- `background.features[].properties._fillColor` — hex color string
- `political.features[].properties._id` — unique state ID
- `political.features[].properties._displayName` — state name
- `political.features[].properties._fillColor` — state color
- `political.features[].properties._areaSqKm` — area
- `political.features[].properties._centroidLng/Lat` — centroid
- `altitudes.features[].properties.zone` — elevation zone ID string
- `rivers.features[].geometry.type` — "LineString"
- All polygons: RFC 7946 GeoJSON (right-hand rule, closed rings)
