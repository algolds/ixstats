# Maps & World Visualization System

## Overview

**Hierarchy:** IxWorld is the integrated maps product. IxMaps (maps.ixwiki.com) is the standalone deployment. Forge Mode is an admin sub-feature of IxWorld.

The IxWorld map system provides interactive visualization of IxEarth, a fictional planet with six continents, four oceans, and 60+ countries. Built with MapLibre GL JS, it replaces the v1 Leaflet-based IxMaps system (deprecated November 2025, rebuilt January–May 2026).

**Deployed at:**
- Standalone: `maps.ixwiki.com` (IxWorld — port 3002)
- Embedded: `/maps` route within IxStats
- Widgets: embedded in MyCountry, Diplomacy, Defense, Intelligence, and Dashboard pages

---

## Component Architecture

### Core Components (`src/components/maps/core/`)

| Component | Lines | Purpose |
|-----------|-------|---------|
| `IxWorldMap.tsx` | ~1,500 | Core MapLibre GL JS renderer — layer management, country labels, click/hover interactions, distance fade, ocean labels |
| `MapContainer.tsx` | ~450 | Data loading wrapper — tRPC queries, error states, dynamic imports for SSR safety |
| `MapControls.tsx` | ~220 | Layer toggle panel, tool buttons, coordinate display, climate/elevation legends |
| `CountryInfoPanel.tsx` | ~590 | Right-side panel with economic data, wiki intro, media gallery, flag, sovereignty, neighbors |
| `MapPinInfoPanel.tsx` | ~300 | Pin tool panel showing elevation zone, climate type, country, subdivision at clicked point |
| `MapSearchOverlay.tsx` | ~280 | Type-filtered search (country/city/subdivision/POI) with debounced queries and flag rendering |
| `MeasureTool.tsx` | ~520 | Point-to-point distance measurement with custom cursor and label display |
| `MapKeyboardControls.tsx` | ~150 | WASD/arrow navigation, +/- zoom, R reset, ? help overlay |
| `MapLoadingScreen.tsx` | ~180 | Animated loading screen with globe animation and subsystem progress |
| `ProjectionToggle.tsx` | ~80 | Globe/Mercator/Auto projection mode selector |
| `FeatureInfoPanel.tsx` | ~200 | Generic feature info display for cities, POIs, capitals |
| `SwipeableBottomSheet.tsx` | ~250 | Mobile bottom sheet with drag handle and swipe-to-dismiss |

### Editor Components (`src/components/maps/editor/`)

| Component | Lines | Purpose |
|-----------|-------|---------|
| `MapEditorOverlay.tsx` | ~800 | Full-screen editor overlay — title bar, tool rail, panel, status bar, error boundaries, loading splash |
| `EditorMap.tsx` | ~1,500 | MapLibre editor map — country boundary, non-player mask, grid overlay, vertex editing, snap guides, paint mode colors |
| `MapEditorToolbar.tsx` | ~120 | Vertical tool rail: Select (V), City (C), Region (R), POI (P), Route (T), Import (I), Paint (B) |
| `EditorPanel.tsx` | ~220 | Right panel with collapsible Properties (top) + Features (bottom) layout |
| `FeaturePropertyPanel.tsx` | ~700 | Context-sensitive forms: city/region/POI edit, transport panel (route list + generate), paint mode panel |
| `FeatureList.tsx` | ~200 | Collapsible feature groups (Cities/Regions/POIs) with auto-expand on select, shift-click multi-select |
| `EditorStatusBar.tsx` | ~120 | Live cursor coordinates, altitude/climate terrain info, mode badge, feature count, zoom |
| `MobileEditorSheet.tsx` | ~80 | Bottom sheet for mobile property editing |
| `SimulationPreview.tsx` | ~120 | Geographic profile stats card in editor |
| `WikiLinkWizard.tsx` | ~200 | Wiki search + infobox parsing for linking features to wiki articles |
| `SmartPlacement.tsx` | ~150 | Contextual suggestions when placing cities/POIs based on terrain |
| `BorderConformanceModal.tsx` | ~100 | Province import conformance warning modal |

**Editor Features:**
- **7 editor tools**: Select, City, Region, POI, Route, Import, Paint
- **Province Painter (B)**: CK3-style map modes — Population, Development, Resources, Wiki Coverage with color gradients and ranked stats panel
- **Transport management**: Route list with edit/delete, procedural generation, tabbed interface
- **Non-player mask**: Semi-transparent overlay dimming areas outside the player's country
- **Coordinate grid**: Toggleable grid (G) with adaptive spacing and degree labels, focused on country bbox
- **Layer toggles**: Rivers, Altitude in header bar
- **Live terrain info**: Debounced altitude + climate under cursor in status bar
- **Undo/Redo**: History stack with Ctrl+Z / Ctrl+Shift+Z shortcuts
- **Multi-select**: Shift+click features for bulk delete
- **Region stats tooltip**: Hover subdivisions for area, population, vertex count
- **Snapping guide lines**: Cyan dashed lines showing snap targets during vertex drag
- **Error boundaries**: Map + Panel wrapped independently with retry UI
- **Loading splash**: Animated loading screen while geometry/features load

### Overlay Components (`src/components/maps/overlays/`)

| Component | Lines | Purpose |
|-----------|-------|---------|
| `TransportOverlay.tsx` | ~200 | Transport route lines + hub circles with click handlers for route/hub inspection |
| `AnalyticsLegend.tsx` | ~100 | Color gradient legend for wealth/population/crisis/transport overlays |

### Route Info Panel (`src/components/maps/core/RouteInfoPanel.tsx`)

Slide-in panel for transport route details — type icon, name, status badge, length, terrain difficulty bar, speed, stops list, edit/delete actions. Supports inline name/status editing.

### Widget Components (`src/components/maps/widgets/`)

| Component | Lines | Embedded In | Purpose |
|-----------|-------|-------------|---------|
| `CountryMapEmbed.tsx` | ~420 | Country pages | Country-focused map with dimmed neighbors and city markers |
| `CountryMapWidget.tsx` | ~200 | Sidebar cards | Compact country map card (10-50KB vs 17.8MB full world) |
| `MiniWorldMap.tsx` | ~150 | Dashboard/cards | Tiny globe thumbnail, clickable to open full map |
| `DashboardMapWidget.tsx` | ~120 | Dashboard sidebar | Compact map — country or world view based on auth |
| `DiplomacyMapWidget.tsx` | ~300 | Diplomacy page | Embassy network with partner dots and great-circle lines (cyan) |
| `DefenseMapWidget.tsx` | ~280 | Defense page | Territory defense with subdivision zones and readiness overlay (red) |
| `IntelligenceMapWidget.tsx` | ~260 | Intelligence page | Geopolitical analytics with relationship strength coloring |

---

## Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useMapData` | `src/hooks/useMapData.ts` | tRPC data fetching with IndexedDB two-tier caching, layer visibility state, pre-fetching |
| `useBorderEditor` | `src/hooks/useBorderEditor.ts` | Border editing state — modes, vertex selection, undo/redo stack, area calculations |
| `useMapEditor` | `src/hooks/useMapEditor.ts` | Feature CRUD state — add/edit modes, form data, feature type management |
| `useMapPinInfo` | `src/hooks/useMapPinInfo.ts` | Pin tool — client-side Turf.js + server PostGIS coordinate-to-info queries |
| `useCountryMapEmbed` | `src/hooks/useCountryMapEmbed.ts` | Country geometry + neighbors + features fetching with shared cache |
| `useCountryPanelData` | `src/hooks/useCountryPanelData.ts` | Country panel wiki content and economic data |

---

## Library Utilities

### Configuration

| File | Purpose |
|------|---------|
| `src/lib/map-config.ts` | Layer types, colors, sovereignty types (34), projections, water body labels (22), country colors |
| `src/lib/elevation-config.ts` | 9-zone elevation system with colors, ranges, and normalized values |
| `src/lib/svg-coordinate-config.ts` | SVG-to-geographic coordinate mapping parameters |

### Data Pipeline

| File | Purpose |
|------|---------|
| `src/lib/map-pipeline.ts` | Unified pipeline: SVG/PNG/procedural → parse → enrich → validate → GeoJSON output |
| `src/lib/map-utils.ts` | Antimeridian splitting (Sutherland-Hodgman), feature name normalization |
| `src/lib/geojson-compress.ts` | Douglas-Peucker simplification, coordinate truncation, deduplication |
| `src/lib/base-layer-query.ts` | PostGIS terrain-at-point and terrain-in-area queries |
| `src/lib/map-point-query.ts` | Client-side Turf.js point-in-polygon, elevation/climate detection |

### Caching

| File | Purpose |
|------|---------|
| `src/lib/map-idb-cache.ts` | IndexedDB persistent cache (24h TTL), hash-based invalidation |

### SVG Processing

| File | Purpose |
|------|---------|
| `src/lib/svg-parser.ts` | SVG path-to-GeoJSON conversion — @xmldom parsing, Inkscape layers, bezier flattening, affine transform |
| `src/lib/png-to-svg.ts` | Raster-to-vector conversion utility |

### Border Editing

| File | Purpose |
|------|---------|
| `src/lib/border-editor.ts` | Vertex editing logic, split/merge operations, undo/redo, geometry validation |
| `src/lib/shared-vertex-builder.ts` | Shared vertex detection for adjacent territory borders |

---

## Procedural World Generation

`src/lib/procedural/` contains 19 files (~7,400 lines) implementing a complete world generation pipeline:

### Pipeline

```
Tectonic Plates → Elevation → Erosion → Coastlines → Countries →
Contours → Climate → Drainage → Rivers → Lakes → Icecaps → Validation
```

### Files

| File | Purpose |
|------|---------|
| `world-generator.ts` | Master pipeline orchestrator |
| `world-profile.ts` | World parameter profiles (IxWorld, realistic, archipelago, pangaea) |
| `plate-simulation.ts` | Tectonic plate generation — farthest-point seeding, Euler poles, collision detection |
| `tectonic-elevation.ts` | Elevation from plate collisions, spreading ridges, subduction zones |
| `tectonic-shapes.ts` | Collision zone classification for mountain placement |
| `terrain-generator.ts` | 9-zone altitude classification with climate embedding |
| `landmass-generator.ts` | Coastline extraction via flood fill + angular boundary |
| `erosion.ts` | Multi-stage: pit resolution, domain warping, bilateral smoothing, hydraulic/thermal/glacial |
| `climate-system.ts` | Physics-based climate — ITCZ, Coriolis, ocean currents, Trewartha classification (12 types) |
| `water-generator.ts` | Ocean, lake, and river generation from heightmap |
| `drainage.ts` | Steepest-descent flow accumulation, Strahler ordering, confluence detection |
| `contour-vectorizer.ts` | Marching squares contour extraction, edge chaining, simplification |
| `country-generator.ts` | Poisson disk sampling, Voronoi tessellation, Lloyd relaxation, territory expansion |
| `noise.ts` | Seeded OpenSimplex noise, fractal noise (fBm), ridge noise, domain warping |
| `rng.ts` | Seeded xorshift32 random number generator |
| `noisy-edges.ts` | Procedural edge fuzzification for organic boundaries |
| `weighted-voronoi.ts` | Weighted Voronoi cell generation |
| `grid-outline.ts` | Grid boundary extraction and simplification |
| `generation-validator.ts` | Topology, coverage, and statistics validation |

---

## Geo API Router

`src/server/api/routers/geo.ts` — ~4,300 lines, 70 tRPC endpoints.

### Map Data Queries

| Endpoint | Auth | Description |
|----------|------|-------------|
| `getWorldMap` | Public | All map layers with compression and antimeridian splitting |
| `getCountryGeometry` | Public | Single country geometry with centroid and bounding box |
| `getCountryAtPoint` | Public | PostGIS ST_Contains point-in-country query |
| `getPointInfo` | Public | Elevation zone + climate zone at coordinates |
| `listCountries` | Public | All countries with basic stats |
| `getNeighbors` | Public | Neighboring countries with shared borders |
| `getCountryFeatures` | Public | Cities, subdivisions, POIs for a country |
| `getAllMapFeatures` | Public | Complete searchable feature index |
| `getCapitalCities` | Public | National capitals with coordinates |
| `searchFeatures` | Public | Full-text search across all features |
| `getFeatureWikiIntro` | Public | Wiki article intro for features |
| `getCountrySovereignty` | Public | Sovereignty relationship chains |

### Feature Management (Country Owners)

| Endpoint | Description |
|----------|-------------|
| `createCity` / `updateCity` / `deleteCity` | City CRUD with type, population, capital flags |
| `createSubdivision` / `updateSubdivision` / `deleteSubdivision` | Subdivision CRUD |
| `createPOI` / `updatePOI` / `deletePOI` | Point of interest CRUD |
| `validatePointInCountry` | Verify coordinates within country boundary |

### Border Operations (Admin)

| Endpoint | Description |
|----------|-------------|
| `startBorderEditSession` | Initialize editor session with lock |
| `saveBorderEditDraft` | Auto-save intermediate edits |
| `submitBorderEdit` | Submit edited geometry with change log |
| `approveEdit` / `rejectEdit` | Admin approval workflow |
| `getSharedVertices` | Vertex data for neighbor-aware editing |

### World Generation (Admin)

| Endpoint | Description |
|----------|-------------|
| `generateProceduralWorld` | Trigger full procedural generation |
| `getProceduralWorldPreview` | Preview without saving |
| `commitProceduralWorld` | Save generated world to database |
| `importWorldTemplate` / `exportWorldTemplate` | Template management |
| `uploadSvg` / `processSvgUpload` / `commitSvgUpload` | SVG import pipeline |

---

## Map Layers

| Layer | Source | z-Index | Default Visible | Compression Tolerance |
|-------|--------|---------|-----------------|----------------------|
| `background` | background.geojson | 0 | Yes | 0.02 |
| `altitudes` | altitudes.geojson | 1 | Yes | 0.035 (aggressive) |
| `rivers` | rivers.geojson | 2 | Yes | 0.025 |
| `lakes` | lakes.geojson | 3 | Yes | 0.015 |
| `climate` | climate.geojson | 4 | No | 0.035 (aggressive) |
| `political` | political.geojson | 5 | Yes | 0.008 (crisp borders) |
| `icecaps` | icecaps.geojson | 6 | No | 0 (exact) |

---

## Classification Systems

### Elevation Zones (9)

| Zone | Range | Color |
|------|-------|-------|
| Coastal Lowlands | 0–200m | #a8d5a2 |
| Low Hills | 200–500m | #c4d99e |
| Rolling Hills | 500–1,000m | #e0dd9a |
| Uplands | 1,000–1,500m | #e8c878 |
| Low Mountains | 1,500–2,500m | #d4a05a |
| Mid Mountains | 2,500–3,500m | #c0783c |
| High Mountains | 3,500–5,000m | #a0501e |
| Alpine | 5,000–7,000m | #783214 |
| Ice Cap | 7,000m+ | #f0f4f8 |

### Trewartha Climate Types (12)

| Code | Name | Color |
|------|------|-------|
| Ar | Tropical Wet | #990000 |
| Aw | Tropical Wet-And-Dry | #FF3300 |
| Bw | Desert or Arid | #FFFF33 |
| Bs | Steppe or Semiarid | #FF9933 |
| Cs | Subtropical Dry Summer | #669900 |
| Cf | Subtropical Humid | #336600 |
| Do | Temperate Oceanic | #00FF99 |
| Dc | Temperate Continental | #0099FF |
| E | Boreal | #0066CC |
| Ft | Tundra | #B9B9B9 |
| Fi | Ice Cap | #99FFFF |
| H | Highland | #FFCCFF |

### Sovereignty Types

34 types defined in `src/lib/map-config.ts` including: crown possession, vassal, protectorate, dependency, dominion, colonial possession, overseas territory, LoN mandate, constituent country, and others.

---

## Caching Architecture

```
Browser ──► React Query (in-memory)
              │ staleTime: 30 min
              │ gcTime: 2 hours
              │
              ├──► IndexedDB (persistent)
              │      TTL: 24 hours
              │      Hash-based invalidation
              │
              └──► tRPC Server
                     cachedPublicProcedure
                     Layer-specific TTLs:
                       political: 15 min
                       climate/altitude: 24 hours
                       rivers/lakes: 24 hours

### Backend & Query Optimizations (May 2026 Update)

*   **Router Deduplication**: Eliminated 2,500 lines of redundant caching, simplification, and geometry loading helpers. All routing sub-modules (`geoSovereignty`, `geoEditor`, `geoAdmin`, `geoFeatures`, `geoWiki`) now query centralized layer configurations and utility handlers inside `geoCore`.
*   **Zoom-Bucket-Aware Caching**: Fixed a caching TTL bug where zoom-aware keys (e.g. `political:z1`) were compared directly with base keys (`political`), failing matches and defaulting to the 15-minute TTL. The router now extracts the base layer prefix first, ensuring static layers (climate, altitudes, waterbodies) use their configured 24-hour TTL.
*   **Centroid Detection**: Enhanced coordinate-to-subdivision query resolvers to compute accurate visual centroids using `computeVisualCenter`.
*   **Synchronized Cache Evictions**: Standardized all geometry cache invalidation patterns under correct namespace paths (`geoCore.*`, `geoEditor.*`, `geoFeatures.*`, `geoSovereignty.*`, and `geoAdmin.*`) to ensure immediate consistency on border approvals or edits.

---

## Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/maps` | `src/app/maps/page.tsx` | Public world map viewer |
| `/admin/maps` | `src/app/admin/maps/` | Admin map management, SVG upload, world generation |
| `/mycountry/map-editor` | `src/app/mycountry/map-editor/` | Player border and feature editing |

---

## Related Documentation

- [`IXWORLD_OCEANOGRAPHY_REPORT.md`](../IXWORLD_OCEANOGRAPHY_REPORT.md) — Ocean basins, seas, currents, shipping routes, and marine ecology
- [`reference/api-complete.md`](../reference/api-complete.md) — Full tRPC API catalog including geo router
- Old v1 map docs preserved in `docs/archive/` (vector tiles, Martin tile server — superseded)
