# 🗺️ Atlas — Spatial Geography & Cartographic Studio

**Parent App Suite:** Atlas (`ATLAS_VERSION = 2`, formerly dev codename `IxWorld`)  
**Engine:** Atlas Spatial Engine (`ATLAS_ENGINE_VERSION = 5`)  
**Subsystems:** Interactive World Map, Vector Map Editor Studio, Spatial Geographic Analyzer  
**Primary Action:** `MAP` | **Domain Accent:** Sky Blue (`#0EA5E9` / `--color-blue-500`)  
**Routes:** `/maps`, `/maps/editor`, standalone `maps.ixwiki.com` | **Status:** 📀 Gold Master (100% Ready)  

Atlas is the spatial, cartographic, and worldbuilding studio for IxStates. Built on **MapLibre GL JS**, it powers interactive vector globe maps, procedural realm generation, grounded manual IxEarth cartography, admin GIS suites, and precision player territory editors.

### Core Foundation: "Geography is King"
In IxStates, geography is not a passive cosmetic backdrop—it is the Tier-0 single source of truth driving the entire simulation:
- **Topological Ground Truth**: Border treaties, territorial integrity, and neighboring adjacency derive directly from PostGIS spatial geometry (`ST_Touches`, `ST_Intersection`).
- **Climate & Biomes**: Altitude, coastal distance, river basins, and rain shadow topography determine agricultural yields, resource endowments, and economic growth modifiers.
- **Dual Pipeline Architecture**: The Atlas Engine unifies two distinct cartographic streams under one high-performance WebGL renderer:
  1. **Grounded Manual IxEarth Pipeline**: Exact affine transformation ($25625 \times 15729$ viewBox $\to$ WGS84 coordinates), manual hypsometric contour stacking, topological seam-locking, and 12 Trewartha climate biomes.
  2. **Procedural UPG v2 Vector Pipeline**: 100,000-cell Voronoi spatial mesh (`WorldGraph`), 5 Lloyd iterations, coastal hypsometric damping, and 4-pass Catmull-Rom spline vector subdivision.

---

## Prerequisite Map Conversion & Processing Pipeline

Raw map graphics (SVG vector files or PNG raster maps) undergo a multi-pass parsing, affine coordinate transformation, topological repair, and compression pipeline (`src/lib/map-pipeline.ts`, `src/lib/svg-parser.ts`, `src/lib/geojson-compress.ts`).

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   PREREQUISITE MAP CONVERSION PIPELINE                   │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ Source File  │ SVG Parsing  │ Affine WGS84 │ Antimeridian │ Compression  │
│ (SVG / PNG   │ Bezier       │ Transformation│ & Topology  │ DP Truncate  │
│ raster)      │ flattening   │ (px → deg)   │ Seam lock    │ Dedup points │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

1. **Vector SVG Parsing (`svg-parser.ts`)**: Server-side parsing with `@xmldom/xmldom` and `svg-path-parser`. Extracts Inkscape layer groups (`political`, `rivers`, `lakes`, `altitudes`, `climate`), flattens Bezier curves, and resolves polygon hole winding order.
2. **Affine WGS84 Transformation (`svg-coordinate-config.ts`)**: Converts 2D SVG pixel viewBox space (`25625 × 15729` for IxEarth) to geographic coordinates ($[-180, 180] \times [-84, 84]$).
3. **Topology Locking (`shared-vertex-builder.ts`)**: Merges shared boundary vertices between adjacent nations into a unified vertex lookup topology, preventing tearing or slivers.
4. **GeoJSON Optimization (`geojson-compress.ts`)**: Visvalingam-Whyatt geometry simplification (`@turf/simplify`), coordinate precision truncation down to 4 decimal places ($\sim 11\text{m}$ resolution), and Sutherland-Hodgman antimeridian clipping.

---

## Procedural Realm Engine (UPG v2)

The **Ultra-Fidelity Unified Physical Geography (UPG v2)** vector engine (`src/lib/worldgen/v2/`) generates high-resolution, scientifically accurate fictional world maps:

1. **100,000-Cell Spatial Mesh**: Ultra-dense Voronoi mesh (`WorldGraph`) with 5 Lloyd relaxation iterations.
2. **Tectonic Plate Simulation**: Continental/oceanic crust assignment, Euler rotation vectors, and convergent/divergent/transform boundary classification.
3. **Coastal Hypsometric Damping**: Dampens coastal land elevation within 3 cells of water (`coastDist <= 3`), preventing glacial peaks on shorelines:
   $$H_{\text{final}} = H_{\text{raw}} \cdot \min(1.0, 0.15 + 0.35 \cdot \text{coastDist})$$
4. **Unified Hydrology & Biomes**: Coriolis wind simulation, rain shadow calculation, priority-queue depression filling, steepest-descent river tracing, and 12 Trewartha climate biomes.
5. **RBF Marching Contours & Catmull-Rom Splines**: Projects attributes onto a $2048 \times 1024$ grid via IDW Radial Basis Functions. 4-pass Catmull-Rom spline subdivision ($\tau = 0.5$) processes all 7 vector layers with shared topology.

---

## Map Layers & Stacking Order

MapLibre GL JS renders vector GeoJSON layers. Hydrological layers strictly render **above** political boundaries for correct cartographic presentation:

| Layer | Source File | z-Index | Purpose | Compression Tolerance |
| :--- | :--- | :---: | :--- | :---: |
| `rivers` | `rivers.geojson` | **7** | River linestrings with flow hierarchy | 0.025 |
| `lakes` | `lakes.geojson` | **6** | Freshwater and saline lakes | 0.015 |
| `political` | `political.geojson` | **4** | National borders & sovereign territory fills | 0.008 |
| `altitudes` | `altitudes.geojson` | **3** | 9-zone hypsometric elevation contours | 0.035 |
| `climate` | `climate.geojson` | **2** | 12 Trewartha biome zone polygons | 0.035 |

---

## Map Editor Studio Architecture (`/maps/editor`)

The Map Editor is a full-screen vector cartography workstation for authoring geography at national, regional, and municipal levels:

### 1. Authoring Toolset & Entity Types
- **Sovereign Boundaries & Territories**: Draw, split, merge, and modify national border polygons with shared-vertex topology locking to prevent border overlap slivers or tears.
- **Sub-National Regions & Provinces**: Partition sovereign territory into administrative subdivisions, states, and cantons with autonomous attribute rollups.
- **Cities & Municipalities**: Place capital cities, industrial hubs, and ports with population weight, status, and local timezone settings.
- **Points of Interest (POIs) & Landmarks**: Place historical sites, military fortifications, mountain peaks, canal locks, and natural superlatives.
- **Transit & Trade Corridors**: Friction-weighted pathfinding generating realistic highway, rail, and maritime shipping routes following terrain contours.

### 2. Precision GIS & Vertex Snapping Model
- **Voronoi & Polygon Snapping**: Snaps vertices directly to neighboring country borders and underlying mesh points, maintaining topological correctness.
- **Copy-on-Write Polygon Updates (`border-editor.ts`)**: `cloneRingsWithTarget` avoids full geometry deep-clones during 60fps drag operations.
- **Two-Phase Hit-Testing (`hit-test.ts`)**: Exact point selection wins, polygon containment second, grab-assist over empty space only.
- **Nominal Coordinate Typing (`editor-types.ts`)**: TypeScript nominal types (`Lng`, `Lat`, `GeoPoint`, `ScreenPoint`) prevent axis-inversion coordinate bugs.
- **Universal I/O**: Direct import and export of industry-standard GeoJSON and SVG path files.

---

## Pluggable Overlay Framework (`OVERLAY_REGISTRY`)

The overlay architecture (`src/lib/maps/overlay-registry.ts`) enables declarative, pluggable map overlays powered by `geojson-layer-helpers.ts`:
1. **Fill Overlays** (Mutually Exclusive): Recolor political boundaries (`ChoroplethOverlay`, `RiskHeatmapOverlay`).
2. **Feature Overlays** (Combinable): Interactive vector elements (`TransportOverlay`, `TradeRouteOverlay`).
3. **Analytics Overlays** (Combinable): Geopolitical analysis (`GeopoliticalOverlay` showing alliances, embassies, conflict hotspots).

---

## MyCountry Tier-0 Single Source of Truth

Geography serves as the foundational data source across the platform:
- **Spatial Boundaries**: `MapLayer`, `Territory`, `BorderHistory` are authoritative for geometry, area, centroid, bounding box, and PostGIS `ST_Touches` adjacency.
- **Settlements**: `City`, `Subdivision`, `PointOfInterest`, `StoryPin`, `MapLabel` foreign-key linked to `Country.id`.
- **Attribute Rollups**: `hybrid` (default), `top-down`, and `bottom-up` rollup modes aggregate regional metrics into national indicators.

---

## Geo API Routers (`src/server/api/routers/`)

- `countryGeo.ts` – Country boundaries, settlement upserts (`upsertCity`, `upsertSubdivision`, `upsertPoi`), and geo bundles
- `geoFeatures.ts` – Settlement deletions, natural superlatives (`createPeak`, `createNamedRiver`, `createNamedLake`)
- `geoCore.ts` – World map geometry, country bounds, point lookups, and cache management
- `geoEditor.ts` – Border editing mutations and spatial submission review
- `transport.ts` – Friction-based transit corridor generation and route management

---

## Related Documentation

- [Oceanography Report](../IXWORLD_OCEANOGRAPHY_REPORT.md)
- [Autosave Architecture](../AUTOSAVE_ARCHITECTURE.md)
- [Framework Specification (Realms)](../FRAMEWORK_SPEC.md)
- [API Reference: Geo Routers](../reference/api-complete.md#geo-routers)

