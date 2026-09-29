# IxWorld Map

**Last updated:** September 2026

The `/maps` route is the public, full-screen interactive viewer for **IxWorld** — the IxEarth fictional world (six continents, four oceans, 60+ countries). It is built on MapLibre GL JS and renders a globe at low zoom that transitions to a flat (Mercator) projection at higher zoom. This route is a thin page that mounts the shared map core (`MapContainer` → `IxWorldMap`); the same components also power the standalone deployment at **maps.ixwiki.com** and the map widgets embedded in country pages, MyCountry, WikiOS and the Dashboard. With `?realm=<slug>` it shows another realm's map (see [`docs/architecture/realms-framework-spec.md`](../../../docs/architecture/realms-framework-spec.md)).

For the full system guide (component catalog, procedural worldgen, classification systems, caching), see [`docs/systems/maps.md`](../../../docs/systems/maps.md).

## Routes

| Route | File | Purpose |
|-------|------|---------|
| `/maps` | `src/app/maps/page.tsx` | Public world map viewer (this route) |
| `/admin/maps` | `src/app/admin/maps/` | Admin map management, SVG upload, Import Pipeline (SVG/PNG/procedural, realm-targeted) |
| `/admin/maps/editor` | `src/app/admin/maps/editor/page.tsx` | Admin world editor (`?realm=<slug>` edits that realm's map) |

Players edit their own nation in place: the country editor (`MapEditorOverlay`) opens over the map from `/maps`.

This page is a client component (`export const dynamic = "force-dynamic"`). `layout.tsx` sets metadata and switches the title/description between standalone (`IxWorld - Interactive World Map`) and embedded (`World Map - IxStates`) modes.

### URL parameters (deep linking)

The page reads the following query params via `useSearchParams`:

| Param | Effect |
|-------|--------|
| `?country=<id>` | Auto-select country by database ID |
| `?name=<name>` | Auto-select by country name (resolved via `api.countries.getByNameWithAtomic`) |
| `?lat=X&lng=Y&zoom=Z` | Coordinate deep-link / initial view |
| `?layer=<layer>` | Show a specific layer on load (with `political`) |
| `?layers=a,b,c` | Comma-separated initial layers |
| `?embed=true` | Chromeless mode for iframe embedding (no nav, no controls) |
| `?controls=true` | Force-show controls even in embed mode |
| `?realm=<slug>` | Show that realm's map (default: the viewer's active nation's realm, else IxWorld) |

## Key features

- **MapLibre GL projection** — `dynamic` (globe at low zoom, flat at high zoom), or locked `globe` / `mercator`. Modes defined in `src/lib/maps/map-config.ts` (`ProjectionMode`, `getProjectionSpec`).
- **Map layers** — 11 layer types in `MAP_LAYER_TYPES`: `background`, `altitudes`, `climate`, `biomes`, `political`, `lakes`, `rivers`, `icecaps`, `cities`, `trade_routes`, `country_labels`. Per-layer config (color, z-index, default visibility) in `LAYER_CONFIGS`.
- **Country interaction** — click for an info panel (economic data, wiki intro, neighbors, sovereignty), hover highlight, distance-fade labels, ocean/water-body labels.
- **Tools** — search overlay, pin/point-info tool, point-to-point measure tool, keyboard navigation (WASD / +/- / R), projection toggle.
- **Overlays** — choropleth (wealth/population), risk/crisis heatmap, geopolitical relations, transport/trade routes (see overlay components under `src/components/maps/overlays/`).
- **Story pins** — narrative pins layer (`api.geoFeatures.getAllStoryPins` / `getStoryPinFull` / `createStoryPin` / `updateStoryPin`).
- **Border / territory editor** — admin + player editing of country geometry and features (cities, subdivisions, POIs), driven by the `geoEditor` / `geoFeatures` routers; the editor UI is `MapEditorOverlay` (`src/components/maps/editor/`), opened in place on `/maps` or at `/admin/maps/editor`.

## Architecture

| Piece | Location | Role |
|-------|----------|------|
| `IxWorldMap` | `src/components/maps/core/IxWorldMap.tsx` | Core MapLibre renderer — layers, labels, interactions |
| `MapContainer` | `src/components/maps/core/MapContainer.tsx` | Data-loading wrapper (tRPC queries, SSR-safe dynamic imports) |
| `map-config.ts` | `src/lib/maps/map-config.ts` | Layer types/configs, projection modes, sovereignty types, water-body labels |
| Editor components | `src/components/maps/editor/` | Border editor, toolbar, feature property panels |
| Overlay components | `src/components/maps/overlays/` | Choropleth, risk, geopolitical, transport overlays |
| Widget components | `src/components/maps/widgets/` | `CountryMapEmbed` / `CoordinatesMapEmbed` for country pages, MyCountry, WikiOS and the dashboard |
| `useMapData` | `src/hooks/useMapData.ts` | tRPC fetching + IndexedDB two-tier caching + layer visibility |

The page itself only resolves URL params and renders `<MapContainer>` with `showControls` / `showTools` / `showPopup` / `showLoading` flags (all off in `?embed=true` mode). Standalone vs. embedded behavior is decided at runtime by hostname via `src/lib/system/standalone-detection.ts` (`STANDALONE_HOSTNAME = "maps.ixwiki.com"`).

## Data sources (tRPC geo routers)

The geo API is split into **6 router namespaces** (90 procedures across 37 files under `src/server/api/routers/geo/`), registered in `src/server/api/root.ts`:

| Namespace | Approx. procs | Representative endpoints (verified in use) |
|-----------|---------------|--------------------------------------------|
| `geoCore` | 23 | `getWorldMap`, `getWorldMapAsOf`, `getCountryGeometry`, `getNeighborGeometries`, `getPointInfo`, `listCountries`, `searchFeatures`, `getCountryGeoProfile`, `getRegionalChoropleth`, `getCrisisRiskMap`, `getGeopoliticalOverlay`, `getHistoryRange` |
| `geoFeatures` | 29 | `createCity`, `updateCity`, `updatePOI`, `getAllMapLabels`, `updateMapLabel`, `getAllStoryPins`, `getStoryPinFull`, `updateStoryPin`, `createPeak`, `createNamedRiver`, `createNamedLake`, `simplifySubdivisions` |
| `geoEditor` | 19 | `assignCountryGeometry`, `createCountryFromShape`, `updateFeatureProperties`, `getFeatureDetails`, `validateLinkage`, `repairLinkage`, `unlinkCountryGeometry`, `runPipeline`, `importPipelineResult` |
| `geoAdmin` | 11 | `processSvgUpload`, `commitSvgUpload`, `parseProvinceUpload`, `commitProvinceImport`, `parseCitySvg`, `commitCityImport` |
| `geoSovereignty` | 5 | `getSovereigntyRelations`, `createSovereignty`, `updateSovereignty`, `deleteSovereignty` |
| `geoWiki` | 3 | `getFeatureWikiIntro`, `parseWikiInfobox`, `searchWikiPages` |

> Note: the old single `geo.ts` router was split into the six `geo*` sub-routers above (May 2026 deduplication), and plan 312 (September 2026) deleted zero-caller procedures; counts are as of 2026-09-29. Related routers outside `geo/`: `countryGeo`, `transport`, `realms`.

## Standalone IxMaps deployment

The same code is deployed standalone as **IxMaps** at **maps.ixwiki.com** (port 3002, empty base path). It uses one shared Next.js build that serves both the full app and the maps-only site, switching on hostname (`standalone-detection.ts`). Deployment is handled by `scripts/deploy-ixworld.sh` with PM2 config `ecosystem.ixworld.config.cjs` (server-local, gitignored).
