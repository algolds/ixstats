# IxWorld & IxMaps System Documentation

## Overview & Product Architecture

**IxWorld** is the integrated map, geography, and worldbuilding system for the platform. Built on **MapLibre GL JS**, it serves as the geographic engine across interactive world maps, admin world tools, embedded nation cards, and player command suites.

### Product Model: IxWorld vs. Realms Platform

- **IxWorld** is the default internal realm (`realm="default"`) for the community. It is a tenant on the platform.
- **Realms** is the multi-tenant product architecture. External users create their own self-contained **Realms** with custom maps, physical geography, country boundaries, and simulation instances.
- **Unified Engine**: IxWorld and external Realms share identical code paths, data models, tRPC APIs, and rendering engines.
- **Standalone & Embedded Deployment**:
  - **Standalone App**: Deployed at `maps.ixwiki.com` (port 3002) via `NEXT_PUBLIC_IXWORLD_STANDALONE=true`.
  - **Embedded Route**: Main app `/maps` route within IxStats.
  - **Embedded Widgets**: Compact interactive cards embedded across `/mycountry`, `/diplomacy`, `/defense`, `/intelligence`, and `/dashboard`.

### Version Registry Alignment

In accordance with [reference/revision.md](../reference/revision.md), capability integers for the map system are sourced from the Version Registry (`src/lib/buildVersion.ts`):
- **App**: `IXWORLD_VERSION` (2) — Canvas sub-version `CANVAS_VERSION` (2)
- **Engine**: `ATLAS_ENGINE_VERSION` (2)

---

## Prerequisite Map Conversion & Processing Pipeline

Before GeoJSON layers are consumed by the rendering engine or stored in PostgreSQL/PostGIS, raw map graphics (SVG vector files or PNG raster maps) undergo a multi-pass parsing, affine coordinate transformation, topological repair, and compression pipeline (`src/lib/map-pipeline.ts`, `src/lib/svg-parser.ts`, `src/lib/geojson-compress.ts`).

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   PREREQUISITE MAP CONVERSION PIPELINE                   │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ Source File  │ SVG Parsing  │ Affine WGS84 │ Antimeridian │ Compression  │
│ (SVG / PNG   │ Bezier       │ Transformation│ & Topology  │ DP Truncate  │
│ raster)      │ flattening   │ ($\text{px}\to\text{deg}$)│ Seam lock    │ Dedup points │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### 1. Vector SVG Parsing & Layer Extraction (`svg-parser.ts`)

- **Parser Engine**: Server-side parsing using `@xmldom/xmldom` and `svg-path-parser`.
- **Inkscape Layer Mapping**: Identifies Inkscape layer groups (`<g inkscape:groupmode="layer" inkscape:label="political">`) to separate map layers automatically (`political`, `rivers`, `lakes`, `altitudes`, `climate`).
- **Bezier Curve Flattening**: Evaluates cubic (`C`, `S`) and quadratic (`Q`, `T`) Bezier commands into discrete linear line segments. Configurable curve resolution (`bezierSegments`, default 8–16 points per curve).
- **MultiPolygon Hole Detection**: Classifies outer boundary rings vs. inner hole rings via polygon winding order (even-odd / non-zero rule).

### 2. Raster PNG Conversion (`png-to-svg.ts`)

- For raster source maps, the pipeline executes color quantization, Marching Squares boundary contour extraction, and polyline smoothing before entering the vector parsing stage.

### 3. Affine Coordinate Transformation to WGS84 (`svg-coordinate-config.ts`)

Converts 2D SVG pixel viewBox space (`25625 × 15729` for the IxEarth reference map) to geographic WGS84 coordinates (`[-180, 180] × [-84, 84]`):

$$\text{lat} = \frac{\text{equatorY} - \text{svgY}}{\text{pixelsPerLat}} = -0.04392143 \cdot \text{svgY} + 110.1222$$

$$\text{lng} = \frac{\text{svgX} - \text{primeMeridianX}}{\text{pixelsPerLng}} + \text{primeMeridianReferenceLng} = 0.04392139 \cdot \text{svgX} - 153.9062$$

- **Scale**: Isotropic scale of ~22.768 SVG pixels per degree of longitude/latitude.
- **Reference Calibration**: Auto-calibrates mapping parameters by computing an optimal least-squares affine transformation matrix from control points (e.g. matching SVG path points to reference GeoJSON centroids).

### 4. Topology Locking & Shared Vertex Building (`shared-vertex-builder.ts`)

- **Shared Seam Extraction**: Identifies coincident border segments between adjacent country polygons.
- **Node Alignment**: Merges shared boundary vertices into a unified vertex lookup topology, preventing visual gap artifacts, overlapping slivers, or border tearing during zoom/pan operations.

### 5. GeoJSON Compression & Optimization (`geojson-compress.ts`)

To ensure low latency transfer across public tRPC endpoints, GeoJSON layers undergo 3 compression passes:

1. **Visvalingam-Whyatt Geometry Simplification**: Performed via `@turf/simplify` with layer-specific tolerance thresholds (e.g. `0.008` for crisp political borders vs. `0.035` for altitude contours).
2. **Coordinate Precision Truncation**: Floating-point coordinates are rounded from raw floats (16dp) down to 4 decimal places ($\sim 11\text{m}$ resolution at equator):
   $$[12.34567891234, -45.6789123456] \longrightarrow [12.3457, -45.6789]$$
   Reduces payload JSON transfer size by **60%–70%**.
3. **Consecutive Duplicate Removal**: Removes identical consecutive coordinates resulting from precision truncation.
4. **Antimeridian Sutherland-Hodgman Splitting**: (`map-utils.ts`) Clips and splits polygons crossing the $\pm 180^\circ$ line into valid multi-polygon components, preventing render wrapping anomalies in MapLibre GL.

---

## Procedural Realm Engine (UPG v2)

The **Ultra-Fidelity Unified Physical Geography (UPG v2)** vector engine (`src/lib/worldgen/v2/`) generates high-resolution, scientifically accurate, and cartographically smooth fictional world maps.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           UPG v2 ENGINE PIPELINE                         │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ 100K Mesh &  │ Coastal      │ Hydrology &  │ Quality Gate │ RBF Grid &   │
│ Tectonics    │ Hypsometry   │ Biomes       │ & Natural    │ Catmull-Rom  │
│ Voronoi +    │ Coastal slope│ Trewartha +  │ Scientific   │ Spline       │
│ Euler poles  │ damping      │ flow accum.  │ auto-repair  │ ($\tau=0.5$) │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### 8-Stage Generation Pipeline

1. **Ultra-Dense Spatial Mesh (100,000 Cells)**: Generates a 100,000-cell Voronoi mesh (`WorldGraph`) across WGS84 coordinates `[-180, 180] × [-84, 84]` using 5 iterations of Lloyd relaxation. Resolution is fixed at 100k cells to guarantee cartographic detail.
2. **Tectonic Plate Simulation**: Seeds plate centers via farthest-point sampling, assigns continental/oceanic crust types, computes Euler rotation vectors, and classifies convergent, divergent, and transform boundaries.
3. **Terrain Elevation & Coastal Hypsometric Damping**: Computes heightmaps in meters. Applies coastal slope damping within 3 cells of water (`coastDist <= 3`) so subduction mountain ridges rise inland rather than creating glacial peaks on shoreline edges.
4. **Coastline & Archipelago Refinement**: Classifies landmasses into continents, peninsulas, bays, and archipelagos, purging tiny land fragments (< 5 cells).
5. **Unified Hydrology & Climate Pass**: 8 sub-passes: temperature, lapse rate, Coriolis wind, rain shadow, priority-queue depression filling, steepest-descent river flow, tributary tracing, lakes, and Trewartha biomes (12 types). Recalibrates elevation zones (0–8) against the post-hydraulic filled heightmap.
6. **Automated Quality Gate**: 9-check scientific audit (land/water ratio, continent count, mountain continuity, river connectivity, biome distribution) with in-place topology repairs.
7. **Natural-Border Political Overlay**: Seeds culture centers and habitability-scored settlements, expanding territory boundaries via Dijkstra shortest-path on a natural-border resistance field (rivers, mountain chains, coastlines).
8. **RBF Marching Contours & Catmull-Rom Spline Vectorization**: Projects cell attributes onto a $2048 \times 1024$ grid via Inverse Distance Weighted (IDW) Radial Basis Functions (RBF). Dual Marching Squares extracts contour coordinates, followed by 4-pass Catmull-Rom spline curve subdivision ($\tau = 0.5$). Shared boundary vertices across all 7 layers are processed in a single pass to guarantee 100% topological alignment without gaps.

### Coastal Hypsometric Damping Formula

To keep shorelines in lowlands (`zone_0` / `zone_1`, 0–350m) and prevent alpine/glacial peaks (`zone_8`) at water edges:

$$H_{\text{final}} = H_{\text{raw}} \cdot \min\left(1.0, 0.15 + 0.35 \cdot \text{coastDist}\right)$$

---

## Map Layers & Layer Stacking Order

MapLibre GL JS renders 7 primary vector GeoJSON layers. The layer stacking order is strictly enforced so hydrological layers render above political boundaries for correct cartographic presentation:

| Layer | Source File | z-Index | Purpose | Compression |
|-------|-------------|---------|---------|-------------|
| `rivers` | `rivers.geojson` | **7** | River linestrings with flow hierarchy | 0.025 |
| `lakes` | `lakes.geojson` | **6** | Inland freshwater and saline lakes | 0.015 |
| `icecaps` | `icecaps.geojson` | **5** | Glacial ice sheets and polar coverage | 0.000 (exact) |
| `political` | `political.geojson` | **4** | Country polygons with crisp border paths | 0.008 |
| `altitudes` | `altitudes.geojson` | **3** | 9-zone hypsometric elevation contours | 0.035 |
| `climate` | `climate.geojson` | **2** | 12 Trewartha biome zone polygons | 0.035 |
| `background` | `background.geojson` | **0** | Base ocean and landmass boundary polygon | 0.020 |

---

## Component Architecture

### Core Viewer Components (`src/components/maps/core/`)

| Component | Purpose |
|-----------|---------|
| `IxWorldMap.tsx` | Core MapLibre GL JS renderer (~1,500 lines). Manages map style, projection switching, country labels, click/hover interactions, distance fade, and layer rendering loops. |
| `MapContainer.tsx` | SSR-safe data loading wrapper (~450 lines). Handles tRPC data queries, two-tier cache resolution, loading splashes, and error boundaries. |
| `MapControls.tsx` | Floating control panel (~220 lines). Layer toggles, projection switchers, coordinate readout, altitude/climate legends, and search toggles. |
| `CountryInfoPanel.tsx` | Right-side detail drawer (~590 lines). Shows economic profile, nation flag, MediaWiki extract summary, sovereignty chain, and neighbor list. |
| `MapPinInfoPanel.tsx` | Coordinate inspection drawer (~300 lines). Displays client Turf.js + PostGIS point lookup data (elevation zone, climate type, country, subdivision). |
| `MapSearchOverlay.tsx` | Type-filtered search input (~280 lines). Debounced query lookup across countries, cities, subdivisions, and points of interest. |
| `MeasureTool.tsx` | Interactive distance tool (~520 lines). Point-to-point measurement overlay with custom cursor and scale readouts. |
| `MapKeyboardControls.tsx` | Keyboard navigation hook listener (~150 lines). Supports WASD / Arrow keys, zoom (+/-), reset (R), and help (?) overlays. |
| `ProjectionToggle.tsx` | Projection selector widget (~80 lines). Seamlessly toggles between Globe, Mercator, and Dynamic projection modes. |
| `SwipeableBottomSheet.tsx` | Mobile responsive bottom sheet (~250 lines). Drag handle and swipe-to-dismiss sheet for mobile viewports. |

### Editor Components (`src/components/maps/editor/`)

| Component | Purpose |
|-----------|---------|
| `MapEditorOverlay.tsx` | Full-screen editor canvas overlay (~800 lines). Layout header, tool rail, property panel, status bar, and error boundaries. |
| `EditorMap.tsx` | MapLibre interactive editor map (~1,500 lines). Handles vertex dragging, snap guides, coordinate grid, paint mode colors, and non-player mask. |
| `MapEditorToolbar.tsx` | Vertical tool rail (~120 lines). 7 tools: Select (V), City (C), Region (R), POI (P), Route (T), Import (I), Paint (B). |
| `FeaturePropertyPanel.tsx` | Contextual property drawer (~700 lines). Feature editing forms + **Province Painter (B)** map modes (Population, Development, Resources, Wiki Coverage). |
| `BorderConformanceModal.tsx` | Spatial conformance modal (~100 lines). Validates province import shapes against national border constraints. |

---

## Pluggable Overlay Framework (`OVERLAY_REGISTRY`)

The overlay architecture (`src/lib/overlay-registry.ts`) uses a declarative registry pattern for pluggable map overlays, decoupling layer components from host containers.

```ts
type OverlayCategory = "fill" | "feature" | "analytics";

interface OverlayPluginDefinition {
  id: string;
  label: string;
  category: OverlayCategory;
  icon?: LucideIcon;
  defaultVisible?: boolean;
  dataFetcher: (utils: TRPCUtils, ctx: OverlayFetchCtx) => Promise<unknown>;
  component: React.LazyExoticComponent<React.ComponentType<OverlayComponentProps>>;
  legend?: OverlayLegend;
  isAvailable?: (ctx: OverlayFetchCtx) => boolean;
}
```

### Overlay Categories

1. **Fill Overlays** (Mutually Exclusive): Dynamically recolor the `political` layer (`ChoroplethOverlay`, `RiskHeatmapOverlay`).
2. **Feature Overlays** (Default On, Combinable): Interactive point/line vector elements (`TransportOverlay`, `TradeRouteOverlay`).
3. **Analytics Overlays** (Combinable): Geopolitical analysis overlays (`GeopoliticalOverlay` showing alliance links, embassy networks, and conflict hotspots).

---

## MyCountry Integration (Tier-0 Single Source of Truth)

Geography serves as the single source of truth across the MyCountry command suite.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      TWO-SURFACE EDITING ARCHITECTURE                    │
├──────────────────────────────────────────┬───────────────────────────────┤
│ Map Editor Surface                       │ MyCountry Editor Surface      │
│ Spatial half: Geometry, boundaries,      │ Attribute half: Names, GDP,   │
│ world placement → Admin review queue     │ roles, pop, mayor → Direct    │
└──────────────────────────────────────────┴───────────────────────────────┘
```

### Canonical Data Model

- **Borders & Footprint**: `MapLayer` (political), `Territory`, `BorderHistory`. Authoritative for geometry, area, centroid, bounding box, and adjacency.
- **Settlements & Features**: `City`, `Subdivision`, `PointOfInterest`, `StoryPin`, `MapLabel`. Foreign key linked to `Country.id`.
- **Gameplay Attribute Editing**: Nation owners edit city populations, GDP contributions, mayors, and subdivision budget shares directly without requiring map geometry recalculation or spatial re-approval.
- **Rollup Modes**:
  - `hybrid` (Default): National simulation metrics serve as baseline; city/region sums provide coverage percentages.
  - `top-down`: National values distribute down to subdivisions/cities proportionally.
  - `bottom-up`: National totals aggregate directly from the sum of city/subdivision attributes.

### Shared Embedded Widgets (`src/components/maps/widgets/`)

- `CountryMapEmbed.tsx`: Full interactive country view with dimmed neighboring nations.
- `CountryMapWidget.tsx`: Lightweight country thumbnail for sidebar cards.
- `DiplomacyMapWidget.tsx`: Embassy networks and partner links with cyan great-circle lines.
- `DefenseMapWidget.tsx`: Military posture, readiness overlays, and zone boundaries in red.
- `IntelligenceMapWidget.tsx`: Geopolitical relationship heatmaps and intelligence markers.

---

## Classification Systems

### Elevation Zones (9 Zones)

| Zone | Name | Range | Color |
|------|------|-------|-------|
| 0 | Coastal Lowlands | 0–200m | `#a8d5a2` |
| 1 | Low Hills | 200–500m | `#c4d99e` |
| 2 | Rolling Hills | 500–1,000m | `#e0dd9a` |
| 3 | Uplands | 1,000–1,500m | `#e8c878` |
| 4 | Low Mountains | 1,500–2,500m | `#d4a05a` |
| 5 | Mid Mountains | 2,500–3,500m | `#c0783c` |
| 6 | High Mountains | 3,500–5,000m | `#a0501e` |
| 7 | Alpine | 5,000–7,000m | `#783214` |
| 8 | Ice Cap | 7,000m+ | `#f0f4f8` |

### Trewartha Climate Types (12 Biomes)

| Code | Name | Category | Color |
|------|------|----------|-------|
| `Ar` | Tropical Wet | Tropical | `#990000` |
| `Aw` | Tropical Wet-and-Dry | Tropical | `#FF3300` |
| `Bw` | Desert / Arid | Dry | `#FFFF33` |
| `Bs` | Steppe / Semiarid | Dry | `#FF9933` |
| `Cs` | Subtropical Dry Summer | Subtropical | `#669900` |
| `Cf` | Subtropical Humid | Subtropical | `#336600` |
| `Do` | Temperate Oceanic | Temperate | `#00FF99` |
| `Dc` | Temperate Continental | Temperate | `#0099FF` |
| `E` | Boreal | Polar/Subpolar | `#0066CC` |
| `Ft` | Tundra | Polar | `#B9B9B9` |
| `Fi` | Ice Cap | Polar | `#99FFFF` |
| `H` | Highland | Alpine | `#FFCCFF` |

---

## Data Pipeline, Caching & Geo API

### Two-Tier Caching Architecture

```
Browser ──► React Query (In-memory, staleTime: 30m, gcTime: 2h)
              │
              ├──► IndexedDB (Persistent, TTL: 24h, hash invalidation)
              │
              └──► tRPC Geo Router (`geoCore` caching layer)
                     Zoom-bucket aware TTLs:
                     - political: 15m
                     - climate / altitudes / waterbodies: 24h
```

### Geo API Router (`src/server/api/routers/geo.ts` & `geoCore`)

Key procedures powering map operations:

- `geo.getWorldMap`: Public endpoint returning compressed, antimeridian-split GeoJSON layers.
- `geo.getCountryGeometry`: Returns country boundary GeoJSON, visual centroid, and bounding box.
- `geo.getPointInfo`: Spatial lookup returning elevation zone, climate biome, and country at `[lng, lat]`.
- `geo.getCountryFeatures`: Fetches cities, subdivisions, POIs, and story pins for a country.
- `geo.searchFeatures`: Full-text search across all geographical features.
- `geo.submitBorderEdit`: Submits border geometry modifications to the admin review queue.
- `geo.generateProceduralWorld`: Triggers UPG v2 engine generation for new realm creation.
