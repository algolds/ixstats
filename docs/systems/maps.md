# IxWorld & IxMaps System Documentation

**Last updated:** August 2026  
**Status:** Production Ready (Beta)  
**Hierarchy:** Top-level App **IxWorld** (`IXWORLD_VERSION = 2`), powered by the **Atlas Spatial Engine** (`ATLAS_ENGINE_VERSION = 5`). Canvas sub-version `CANVAS_VERSION = 1`.

---

## Overview & Product Architecture

**IxWorld** is the spatial, cartographic, and worldbuilding engine for the platform. Built on **MapLibre GL JS**, it powers interactive world maps, procedural realm generation, admin cartography suites, embedded nation cards, and player territory editors.

### Product Model: IxWorld vs Realms Platform

- **IxWorld** is the default community realm (`realm="default"`) for the Ixnay community. It is a tenant on the platform.
- **Realms** is the multi-tenant product platform. External players create their own isolated **Realms** with procedural physical geography, custom nation boundaries, and sovereign simulation instances.
- **Unified Spatial Engine**: IxWorld and external Realms share identical code paths, data models, tRPC APIs, and WebGL rendering engines.
- **Dual Deployment Architecture**:
  - **Standalone App**: Hosted at `maps.ixwiki.com` (port 3002) via `NEXT_PUBLIC_IXWORLD_STANDALONE=true`.
  - **Embedded Main App**: Interactive `/maps` route within IxStates.
  - **Embedded Widgets**: Compact interactive cards embedded across `/mycountry`, `/diplomacy`, `/defense`, `/intelligence`, and `/dashboard`.

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

MapLibre GL JS renders 7 primary vector GeoJSON layers. Hydrological layers strictly render **above** political boundaries for correct cartographic presentation:

| Layer | Source File | z-Index | Purpose | Compression Tolerance |
| :--- | :--- | :---: | :--- | :---: |
| `rivers` | `rivers.geojson` | **7** | River linestrings with hierarchy | 0.025 |
| `lakes` | `lakes.geojson` | **6** | Freshwater and saline lakes | 0.015 |
| `icecaps` | `icecaps.geojson` | **5** | Glacial sheets & polar coverage | 0.000 (exact) |
| `political` | `political.geojson` | **4** | National borders & territory fills | 0.008 |
| `altitudes` | `altitudes.geojson` | **3** | 9-zone hypsometric elevation contours | 0.035 |
| `climate` | `climate.geojson` | **2** | 12 Trewartha biome zone polygons | 0.035 |
| `background` | `background.geojson`| **0** | Ocean base & landmass geometry | 0.020 |

---

## Component Architecture & Domain Boundaries

The cartographic frontend is strictly divided into three distinct modules with shared foundational atoms:

```
src/components/maps/
├── core/         # ALL Generic/Global MapLibre Primitives, Viewers, Info Panels & Controls
├── editor/       # Strictly Authoring & Editing Tools, Panels, Forms & Draw Pipelines
├── shared/       # Shared Visual Presentation Atoms & Lifecycle Hooks
└── overlays/     # Global Data Layers (Choropleths, Geopolitical lines, Heatmaps, Transport)
```

### 1. Viewer Components (`src/components/maps/core/`)
- `IxWorldMap.tsx` – Core MapLibre GL JS renderer with WebGL projection switching (Globe, Mercator, Dynamic), label distance fade, and layer styling
- `MapContainer.tsx` – SSR-safe data loading wrapper with two-tier cache resolution (React Query + IndexedDB)
- `MapControls.tsx` – Responsive control system: floating bottom-right dock on desktop ($\ge 768\text{px}$) and compact expandable FAB on mobile ($< 768\text{px}$) via `variant?: "desktop" | "mobile" | "auto"`
- `CountryInfoPanel.tsx` – Right-side nation dossier drawer with MediaWiki extract, economic stat modals, flag, and neighbor lists
- `MapPinInfoPanel.tsx` – Coordinate inspection drawer with Turf.js + PostGIS point lookup data
- `StoryPinModal.tsx` – Deep reading modal for historical lore chronicles with photo carousels and wiki links

### 2. Editor Components (`src/components/maps/editor/`)
- `MapEditorOverlay.tsx` – Full-screen authoring canvas with tool rail, property panel, and status bar
- `EditorMap.tsx` – Specialized MapLibre authoring map integrating `useEditorMapEvents` (hit testing & context menus) and `useEditorSnapGuide` (guide lines & cursors)
- `ToolOptionsBar.tsx` – Declarative contextual switcher delegating to dedicated sub-toolbars under `toolbars/options/` (`SubdivisionOptions`, `RouteOptions`, `MagicWandOptions`, `RulerOptions`)
- `TransportPropertyForm.tsx` – Modular route property form delegating to `ProceduralRouteGenerator`, `RouteWaypointList`, and `RouteFilterList` under `properties/transport/`
- `LayerPanel.tsx` – Dual-mode layer manager supporting full layer controls or `<LayerPanel minimal />` for grouped feature lists

### 3. Shared Primitives (`src/components/maps/shared/` & `src/hooks/`)
- `useMapLibreInstance.ts` – Standardized hook for MapLibre container mounting, WebGL surface acquisition (`acquireSurface`), resize observation, and cleanup
- `geojson-layer-helpers.ts` – Type-safe MapLibre source & layer utilities (`setOrUpdateGeoJSONSource`, `ensureMapLayer`, `removeLayerAndSource`)
- `TimelineEraBadge.tsx` – Unified category-colored badge for historical AT/BT IxTime dates
- `StoryPinDetailCard.tsx` – Unified lore presentation card for chronicles and event pins
- `FacetOnboardingDialog.tsx` – Glassmorphic multi-step carousel onboarding modal with keyboard navigation and persistence

### 4. Editor Selection & Hit-Testing Model
- **Deterministic Hit-Testing (`hit-test.ts`)**: Two-phase spatial query (exact point wins, polygon containment second, grab-assist over empty space only).
- **Transient Pointer State (`transientStore.ts`)**: `useSyncExternalStore` store for cursor movement, eliminating re-render cascades across React components.
- **Copy-on-Write Polygon Snapping (`border-editor.ts`)**: `cloneRingsWithTarget` avoids full geometry deep-clones during 60fps drag operations.
- **Branded Nominal Coordinates (`editor-types.ts`)**: TypeScript nominal types (`Lng`, `Lat`, `GeoPoint`, `ScreenPoint`, `BoundingBox`) prevent axis inversion bugs at compile-time.

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

