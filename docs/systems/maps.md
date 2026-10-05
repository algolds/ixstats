# 🗺️ Atlas — Spatial Geography & Cartographic Studio

**Last updated:** 2026-09-30

**Parent App Suite:** Atlas (app version 2 — `VERSIONS.apps.ixworld`, exported as `IXWORLD_VERSION`; `IxWorld` is the in-code app name)  
**Engine:** Atlas Spatial Engine (`ATLAS_ENGINE_VERSION = 5`)  
**Subsystems:** Interactive World Map, Vector Map Editor Studio, Spatial Geographic Analyzer  
**Primary Action:** `MAP` | **Domain Accent:** Sky Blue (`#0EA5E9` / `--color-blue-500`)  
**Routes:** `/maps` (players edit their own nation in place), `/mycountry/map-editor` (the same country editor, full-screen), `/admin/maps/editor` (world editor), standalone `maps.ixwiki.com` | **Status:** see [SYSTEM_STATUS.md](SYSTEM_STATUS.md) (interactive map ✅ Live; map editor, pipeline and worldgen 🟡 Partial or 🧪 Labs)  

Atlas is the spatial, cartographic, and worldbuilding studio for IxStates. Built on **MapLibre GL JS**, it powers interactive vector globe maps, procedural realm generation, grounded manual IxEarth cartography, admin GIS suites, and precision player territory editors.

### Core Foundation: "Geography is King"
In IxStates, geography is the source of truth for borders, area and adjacency. Its reach into the economy is narrower than the aspiration:
- **Topological Ground Truth**: Live neighbour queries use PostGIS spatial geometry (`ST_Touches`, `ST_Intersection`; `geo/core/geo-profile.ts`, `national-issues/neighbors.ts`). The stored `MapLayer.neighbors` column is filled only by the admin `rebuildAdjacency` mutation, which nothing calls in production.
- **Climate & Biomes**: The bbox-estimated geo profile derives `CountryGeoProfile.gdpModifier`, `tradeModifier` and `infraCostModifier` (`computeEconomicGeoModifiers`, `src/lib/maps/geo-analytics.ts`). These are written and displayed only (`GeoProfileContent.tsx`); no economy code reads them. The simulation's geographic inputs are `landArea`, transport effects (`transport-sync.ts`), the national-issues snapshot (landlocked, coastline) and the bottom-up rollup. `GeographicResource` has no writer.
- **Dual Pipeline Architecture**: The Atlas Engine unifies two distinct cartographic streams under one high-performance WebGL renderer:
  1. **Grounded Manual IxEarth Pipeline**: Exact affine transformation ($25625 \times 15729$ viewBox $\to$ WGS84 coordinates), manual hypsometric contour stacking, topological seam-locking, and 12 Trewartha climate biomes.
  2. **Procedural UPG v2 Vector Pipeline**: ~100,000-seed Voronoi spatial mesh (`WorldGraph`; ~69,000 cells after latitude thinning), 5 Lloyd iterations, coastal hypsometric damping, and Catmull-Rom spline vector subdivision (2 passes for polygons, 3 for rivers).

---

## Prerequisite Map Conversion & Processing Pipeline

Raw map graphics (SVG vector files or PNG raster maps) undergo a multi-pass parsing, affine coordinate transformation, topological repair, and compression pipeline (`src/lib/maps/map-pipeline.ts`, `src/lib/flags/svg-parser.ts`, `src/lib/maps/geojson-compress.ts`). PNG input is traced to SVG with `potrace` (`src/lib/flags/png-to-svg.ts`; flat-colour realm maps: `src/lib/maps/png-realm-map.ts`).

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   PREREQUISITE MAP CONVERSION PIPELINE                   │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ Source File  │ SVG Parsing  │ Affine WGS84 │ Antimeridian │ Compression  │
│ (SVG / PNG   │ Bezier       │ Transformation│ & Topology  │ DP Truncate  │
│ raster)      │ flattening   │ (px → deg)   │ Seam lock    │ Dedup points │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

1. **Vector SVG Parsing (`svg-parser.ts`)**: Server-side parsing with `@xmldom/xmldom` and `svg-path-parser`. Can extract Inkscape layer groups (`political`, `rivers`, `lakes`, `altitudes`, `climate`), flattens Bezier curves, and resolves polygon hole winding order. The map pipeline (`map-pipeline.ts`) asks only for `political` and `altitudes`; the other layers arrive through per-layer `SvgUploadManager` uploads.
2. **Affine WGS84 Transformation (`src/lib/flags/svg-coordinate-config.ts`)**: Converts 2D SVG pixel viewBox space (`25625 × 15729` for IxEarth) to geographic coordinates with an isotropic affine transform (~22.77 px per degree).
3. **Topology Locking (`src/lib/maps/shared-vertex-builder.ts`)**: Merges shared boundary vertices between adjacent nations into a unified vertex lookup topology, preventing tearing or slivers.
4. **GeoJSON Optimization (`geojson-compress.ts`)**: Radial-distance plus Douglas-Peucker geometry simplification (`@turf/simplify`, which comes in through `@turf/turf`), coordinate precision truncation (4 decimal places, $\sim 11\text{m}$, for political borders; 3 for decorative layers), and consecutive duplicate-point removal. Sutherland-Hodgman antimeridian clipping lives in `src/lib/maps/map-utils.ts`.

---

## Procedural Realm Engine (UPG v2)

The **Ultra-Fidelity Unified Physical Geography (UPG v2)** vector engine (`src/lib/worldgen/v2/`) generates high-resolution, scientifically accurate fictional world maps:

1. **~69,000-Cell Spatial Mesh**: Voronoi mesh (`WorldGraph`) with 5 Lloyd relaxation iterations. Seeds are thinned by `cos(latitude)` density (`mesh.ts`), so every seed measured gave about 69,000 cells, not 100,000.
2. **Tectonic Plate Simulation**: Continental/oceanic crust assignment, 2-D linear plate velocity vectors (`tectonics.ts`; no Euler poles), and convergent/divergent/transform boundary classification.
3. **Coastal Hypsometric Damping**: Exponentially dampens coastal land elevation within 8 cells of water (`coastDist <= 8`, `coastlines.ts`), preventing glacial peaks on shorelines:
   $$H_{\text{final}} = H_{\text{raw}} \cdot (1.0 - 0.85 \cdot e^{-0.35 \cdot \text{coastDist}})$$
4. **Unified Hydrology & Biomes**: Coriolis wind simulation, rain shadow calculation, priority-queue depression filling, steepest-descent river tracing, and 12 Trewartha climate biomes.
5. **Vector Synthesis & Export (`export.ts`)**: Merges cell polygons into rings, then Douglas-Peucker decimation → Catmull-Rom spline subdivision ($\tau = 0.5$; 2 passes for polygons, 3 for river lines) → harmonic noise perturbation, across all 7 vector layers with shared topology inside the generator. After import the layers are independent rows and `SharedVertex` is not read back.
6. **Status:** Labs only (`/labs/map-pipeline`). Nothing is persisted; the procedural import does not yet produce `Country`, `City` or `Subdivision` rows, and generation runs synchronously on the main Node process (3-28 s). Capital count is fixed at 80 (`politics.ts`); the `countryCountRange`, `useIxWorldTemplate`, `templateStrength`, `climateFidelity` and `languageFamilies` params are accepted and ignored. Worldgen biomes never reach the database, so the 12 Trewartha biomes drive agriculture only in the bbox-estimated profile.

---

## Runtime Requirements

- **MapLibre web worker.** MapLibre 6 finds its worker next to its own module, which is a bundled chunk under Turbopack, so `src/lib/maps/load-maplibre.ts` points it at `/maplibre/maplibre-gl-worker.mjs`. `scripts/setup/copy-maplibre-worker.mjs` copies that file and `maplibre-gl-shared.mjs` into the gitignored `public/maplibre/`; it runs from `postinstall`, `build`, `build:fast` and `start-development.sh`. If the files are missing, every map stalls with "Worker failed to load".
- **Direct dependencies.** Map code imports individual `@turf/*` packages (`@turf/intersect`, `@turf/union`, …). They are declared in `package.json` next to `@turf/turf`; an import of a package that is only a transitive dependency resolves under a hoisted `node_modules` but fails ("Module not found") under isolated installs.

## Viewer Performance

The public viewer (`/maps`, `MapContainer` → `IxWorldMap`, hooks in `src/components/maps/core/hooks/`) keeps pan, zoom and hover free of React renders and redundant worker work. Rules for anyone changing it:

- **No React state per frame.** Hover hit-testing (`useWorldMapInteractions`) is coalesced to one `queryRenderedFeatures` pass per animation frame and never stores the hovered country in state (hover only warms the country-panel query cache). `onZoomChange` fires on `zoomend`, and `MapContainer` keeps the new zoom only when its LOD bucket changes. `IxWorldMap` is memoised and receives only stable callbacks.
- **`setData` only on change.** Zoom-filtered point sources (cities, POIs, story pins, custom map labels) are re-filtered on `zoom` but pushed to the worker only when the filtered feature list differs (`setFilteredSourceData` in `utils/map-core-helpers.ts`). Subdivisions are pushed once per data change. The country-label distance fade (`utils/label-fade.ts`) runs on `moveend` and skips `setData` when no fade changed, which is always the case at globe zoom.
- **Hidden means `visibility: none`.** Base layers that are toggled off (climate, biomes, ice caps, rivers, …) are hidden with layout visibility, not opacity 0, so MapLibre neither tiles nor draws them. The political fill is the exception: it stays at opacity 0 so hover and click still work. Country labels live on one source (`source-country-labels`); there is no generic `source-country_labels`.
- **Level of detail.** `useMapDataBatched` requests the critical bundle without a zoom (the server's mid-zoom LOD, the key `MapPrefetcher` warms) and only asks for the detail bundle at zoom ≥ 7. It no longer refetches a coarser globe bundle after the first zoom. Extra layers (e.g. climate) load one `getWorldMap` query per layer, and once loaded stay loaded, so toggling them is instant.
- **Overlays and style readiness.** Overlay components check `isMapStyleReady()` (`src/lib/maps/geojson-layer-helpers.ts`), not `map.isStyleLoaded()`, which is false whenever any source is re-tiling and made overlays silently skip setup or cleanup mid-pan. `TransportOverlay`'s `styledata` handler is a no-op once its layers exist; it used to call `moveLayer` on every style event, which re-triggered itself and kept the map rendering every frame.
- **Cache invalidation.** `useMapLiveSync` coalesces bursts of `map_data_changed` SSE events into one invalidation (750 ms trailing), and `useMapPrefetch` warms per-country summaries and wiki intros in idle time after the first bundle arrives.

## Map Layers & Stacking Order

MapLibre GL JS renders vector GeoJSON layers. Hydrological layers strictly render **above** political boundaries for correct cartographic presentation:

| Layer | Source File | z-Index | Purpose | Compression Tolerance |
| :--- | :--- | :---: | :--- | :---: |
| `rivers` | `rivers.geojson` | **7** | River linestrings with flow hierarchy | 0.035 |
| `lakes` | `lakes.geojson` | **6** | Freshwater and saline lakes | 0.02 |
| `political` | `political.geojson` | **4** | National borders & sovereign territory fills | 0.008 |
| `climate` | `climate.geojson` | **2** | 12 Trewartha biome zone polygons | 0.05 |
| `altitudes` | `altitudes.geojson` | **1** | 9-zone hypsometric elevation contours | 0.05 |

z-index values are `LAYER_CONFIGS` in `src/lib/maps/map-config.ts`; tolerances are the base `LAYER_COMPRESSION` values in `src/server/api/routers/geo/core/cache.ts` (mid-zoom defaults; `LOD_OVERRIDES` change them for globe and detail zoom).

---

## Map Editor Studio Architecture (`/admin/maps/editor`, `/mycountry/map-editor`, in-place on `/maps`)

The Map Editor (`MapEditorOverlay`, `src/components/maps/editor/`) is a full-screen vector cartography workstation for authoring geography at national, regional, and municipal levels:

### 1. Authoring Toolset & Entity Types
- **Sovereign Boundaries & Territories**: Draw, split, merge, and modify national border polygons with shared-vertex topology locking to prevent border overlap slivers or tears.
- **Sub-National Regions & Provinces**: Partition sovereign territory into administrative subdivisions, states, and cantons with autonomous attribute rollups.
- **Cities & Municipalities**: Place capital cities, industrial hubs, and ports with population weight and review status.
- **Points of Interest (POIs) & Landmarks**: Place historical sites, military fortifications, mountain peaks, canal locks, and natural superlatives.
- **Transit & Trade Corridors**: Friction-weighted pathfinding generating realistic highway, rail, and maritime shipping routes following terrain contours.

### 2. Precision GIS & Vertex Snapping Model
- **Polygon Snapping**: Snaps vertices to neighboring borders, coastlines and rivers (per-layer snap toggles, `src/lib/maps/editor-prefs.ts`), with shared-edge cascading (`src/lib/maps/topology-engine.ts`) maintaining topological correctness.
- **Copy-on-Write Polygon Updates (`border-editor.ts`)**: `cloneRingsWithTarget` avoids full geometry deep-clones during 60fps drag operations.
- **Two-Phase Hit-Testing (`src/components/maps/editor/utils/hit-test.ts`)**: Exact point selection wins, polygon containment second, grab-assist over empty space only.
- **Nominal Coordinate Typing (`src/types/maps/editor-domain.ts`)**: TypeScript nominal types (`Lng`, `Lat`, `GeoPoint`, `ScreenPoint`) prevent axis-inversion coordinate bugs.
- **Import / export**: Province SVG/PNG import in the editor (`province-importer/`); whole-map SVG, PNG or JPEG through the admin Import Pipeline (`/admin/maps` → `PipelineWizard`). The editor's Settings menu imports a GeoJSON file (points → cities, or POIs when the feature has a `category`; polygons → regions; lines are skipped) and exports every feature as a GeoJSON FeatureCollection (`src/hooks/map-editor/editor-geo-ops.ts`). An import is one undo step. There is no SVG export.

### 3. Editing Model: Undo, Drafts, Confirmations
- **Every write is undoable.** Creates, deletes, attribute edits, point drags and arrow-key nudges (a burst of nudges is one save), region reshapes with their topology-cascaded neighbours, duplicates, merges/splits, bulk delete/edit, the city placement tools and GeoJSON imports all land on the history stack (`useMapHistory`, 50 steps). Multi-feature operations record one `"batch"` action. `useHistoryReversalExecutor` replays actions as **partial** patches (only the recorded fields are sent) and keeps an id alias map, because re-creating a deleted feature gives it a new id. Undo/redo run one at a time and close any open vertex/path edit first.
- **Region reshaping** (select a region → drag vertices, click a midpoint to add, right-click/Backspace to remove) saves through `geoFeatures.updateSubdivision` with `cascadedNeighbors`, writing only the neighbours whose shared vertices actually moved. "Done" saves only when something changed; "Cancel" restores the neighbours.
- **Tools that were stubs now work:** route and river drawing collect clicks (Enter finishes a route), the split-region tool draws a line and splits into "A"/"B" pieces, scatter cities, regional capitals for regions with no city ("Auto-Create Cities" while gaps are highlighted, `H`), snap city to region border / coastline (the `background` landmass layer, within 3°), bulk edit of region type/level/colour/government type (colour and government type go through `countryGeo.upsertSubdivision`), and the gap / empty-region overlay. Union keeps the merged shape and deletes the others; subtract and intersect reshape the first region and keep the rest.
- **Drafts:** an unsaved placement or drawing (placed point, closed shape, route waypoints, river path) is mirrored to `localStorage` per country and offered back when the editor reopens (`useEditorDraft`). Saved edits need no draft — they are on the server already.
- **Leaving:** the status bar shows Saving… / Unsaved / Saved *n* ago and the last error; the exit button asks before discarding unsaved work, and the browser warns on reload/close while work is unsaved.
- **Confirmations** use a themed AlertDialog (`EditorConfirmDialog`) instead of `window.confirm`; deleting from the Delete key, context menu, inspector, tool bar or header always asks and says the delete can be undone.
- **Keyboard:** one listener in `useMapEditorOverlayState` owns undo/redo, selection (Ctrl+A / Ctrl+D / Ctrl+J duplicate), Delete, Enter, Escape (close menu → cancel drawing → clear selection → leave tool → exit), `G` grid, `H` gaps, `F` panels, `I` import, `?` shortcut sheet, and the border editor's `V P X M T B`; tool letters (`V M C P K T Y R J U`) go through the plugin provider. The shortcut sheet lists exactly what is wired.
- **Wiki tab** (country editor): scans unlinked features against IxWiki search, links the best match in one click and lists map-vs-infobox conflicts (`WikiScannerPanel`, `useWikiScanner`).

### 4. Performance Model
- **Pointer work never re-renders the editor.** Cursor position, hovered feature, terrain-at-cursor and zoom live in `transientMapStore`, which notifies at most once per animation frame; only leaf components (status bar, hover tooltip, elevation HUD) subscribe. Hover hit-testing (`queryRenderedFeatures`), the lasso/marquee outline and cascade previews during a vertex drag are all frame-batched and drawn straight into their GeoJSON sources.
- **Layers upload only on real change.** `useMapLayers` keys feature uploads on the features array and the visibility *values*; opacity is a paint-property effect. The overlay passes memoised layer props, and the plugin context is stable (plugins read `context.state` through a getter), so map listeners are not re-registered on unrelated renders.
- **Rulers** re-render on map move in their own component (`EditorRulers`), so they track the camera without re-rendering the map.
- **Feature queries** are invalidated through one debounced call per burst (features + routes only; the country border and linkage are not refetched after feature edits).
- **Phones** mount the bottom sheet only (and only once there is something to fill in); desktop never mounts the hidden sheet, and phones never mount the docked panels.

---

## Pluggable Overlay Framework (`OVERLAY_REGISTRY`)

The overlay architecture (`src/lib/maps/overlay-registry.ts`) enables declarative, pluggable map overlays powered by `geojson-layer-helpers.ts`:
1. **Fill Overlays** (Mutually Exclusive): Recolor political boundaries — wealth, population, economic tier, vitality, health, trade balance, canon density (`ChoroplethOverlay`) and crises (`RiskHeatmapOverlay`).
2. **Feature Overlays** (Combinable): Cities, POIs, subdivisions, story pins and map labels (visibility toggles rendered by `IxWorldMap`).
3. **Analytics Overlays** (Combinable): Diplomacy (`GeopoliticalOverlay` showing alliances, embassies, conflict hotspots) and transport networks (`TransportOverlay`).

---

## MyCountry Tier-0 Single Source of Truth

Geography serves as the foundational data source across the platform:
- **Spatial Boundaries**: `MapLayer` plus the cached geometry columns on `Country` (`src/lib/country-geo/sync.ts`) and `BorderHistory` are authoritative for geometry, area, centroid and bounding box. `Territory` is used only by the demo seed. Adjacency is computed live with PostGIS `ST_Touches`.
- **Settlements**: `City`, `Subdivision`, `PointOfInterest`, `StoryPin`, `MapLabel` foreign-key linked to `Country.id`.
- **Attribute Rollups**: `hybrid` (default), `top-down`, and `bottom-up` rollup modes aggregate population and GDP only. Bottom-up overwrites the national figures, and with no approved subdivisions it falls back to the sum of city populations.

---

## Geo API Routers (`src/server/api/routers/`)

- `geo/core/` (`geoCore`) – World map geometry and bundles, country geometry/neighbors, point lookups, geo profiles, overlays, border history, and area/profile recalculation
- `geo/features/` (`geoFeatures`) – Cities, POIs, subdivisions, story pins, map labels, and named superlatives (`createPeak`, `createNamedRiver`, `createNamedLake`)
- `geo/editor/` (`geoEditor`) – Border editing mutations, split/merge, linkage, the spatial submission review queue, and the map pipeline (`runPipeline`, `importPipelineResult`, realm-targeted)
- `geo/admin/` (`geoAdmin`) – SVG uploads, province and city imports (the province and city imports are country-owner procedures, not admin-only)
- `geo/sovereignty.ts` (`geoSovereignty`), `geo/wiki.ts` (`geoWiki`) – Sovereignty relations; wiki intros/infobox lookups for features
- `countryGeo.ts` – Geo bundles and compliance, `sampleTerrainAt`, settlement upserts (`upsertCity`, `upsertSubdivision`), rollup mode, and wiki population
- `transport/` – Friction-based transit corridor generation, route CRUD, travel-time and national mobility queries
- `realms/` (`realms`) – Realm lookup, nation claims and the claims review queue (see [Realms](../architecture/realms-framework-spec.md))

---

## Related Documentation

- [Oceanography Report](../reference/oceanography-report.md)
- [Autosave Architecture](../architecture/autosave.md)
- [Framework Specification (Realms)](../architecture/realms-framework-spec.md)
- [API Reference: Maps & Geography](../reference/api-complete.md#maps--geography)
