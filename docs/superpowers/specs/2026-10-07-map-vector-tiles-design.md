# IxWorld map: vector tiles for decorative layers, first-paint fixes

Date: 2026-10-07 · Branch: `rose-garden` · Sub-project 1 of 2 (2 = map editor performance, separate spec)

## Goal

Cut the map's first-load JSON from 2.56 MB to about 1 MB and make countries appear sooner on a first
visit, without changing how the map looks or how the editor works.

Owner priorities (2026-10-07): faster first paint, smoother pan/zoom, faster editor (sub-project 2).
Slowest today: the first visit. Max zoom stays at 6. Countries stay one download.

## Baseline (dev server, clone DB `ixstats_wv1`, 2026-10-07)

| Request on first load | JSON | gzip |
|---|---|---|
| `geoCore.getMapBundle` (background, political, labels, rivers, lakes, icecaps, POIs, capitals) | 1.54 MB | 543 KB |
| `geoCore.getWorldMapPacked` altitudes | 1.02 MB | 408 KB |
| **Total** | **2.56 MB** | **951 KB** |

Deferred until the first zoom past 3: `getMapBundleDetail` (cities, subdivisions), 466 KB / 121 KB.

## Design

### 1. Tile route

`GET /api/map-tiles/[realm]/[layer]/[z]/[x]/[y]` — a Next route handler beside `src/app/api/maps/`.

- `layer` is one of `altitudes`, `rivers`, `lakes`, `climate`; anything else is 404.
  `z` is 0–6, and `x`/`y` must be in range for `z`; otherwise 404.
- `realm` is a realm slug or id, resolved with the same resolver tRPC's `realm` input uses.
  An unknown realm is 404.
- One query builds the tile from `map_layers.geom_postgis` (SRID 4326, GiST index
  `idx_map_layer_geom`):

  ```sql
  WITH bounds AS (SELECT ST_TileEnvelope($z, $x, $y) AS env),
  rows AS (
    SELECT "featureId" AS _id, properties->>'fill' AS _fillColor, "areaSqKm" AS _areaSqKm,
           ST_AsMVTGeom(ST_Transform(geom_postgis, 3857), bounds.env) AS geom
    FROM map_layers, bounds
    WHERE "worldId" = $realmId AND "layerType" = $layer AND "isActive"
      AND geom_postgis && ST_Transform(bounds.env, 4326)
  )
  SELECT ST_AsMVT(t, $layer) FROM rows t WHERE geom IS NOT NULL;
  ```

  For altitudes and climate the final select reads from a merged step instead of `rows`:
  `SELECT min(_id) AS _id, _fillColor, sum(_areaSqKm) AS _areaSqKm, ST_Union(geom) AS geom
  FROM rows WHERE geom IS NOT NULL GROUP BY _fillColor`.

  Altitudes and climate are merged per colour within the tile (`ST_Union … GROUP BY _fillColor`), which
  mirrors today's `mergeFeaturesByColor`, so adjacent same-colour shapes don't show seams under a
  translucent fill. Rivers and lakes are not merged.
  Property names match what the paint rules already read (`_id`, `_fillColor`, `_areaSqKm`).
- The response is the `ST_AsMVT` bytes as `application/x-protobuf`. An empty tile is an empty body,
  which MapLibre handles.
- **Caching:** a published realm (`isRealmPublished`) gets `Cache-Control: public, max-age=86400`.
  That matches the 24 h server cache TTL decorative layers already have in `geo/core/cache.ts`.
- **Access:** an unpublished realm (draft or generating) requires the same moderator access the map
  already enforces for that realm. Otherwise it's 404. Such tiles get `Cache-Control: private, no-store`.
- **Errors:** a database error is logged and returns 500. MapLibre leaves that one tile blank, and the
  rest of the map keeps working.

### 2. Map style and sources

- In `src/lib/map-styles/standard.json`, `source-altitudes`, `source-rivers`, `source-lakes` and
  `source-climate` become `type: "vector"` sources with `maxzoom: 6`. Their layers gain
  `"source-layer": "<layer>"`. Paint, filters and z-order are unchanged.
- **Tile URLs** are absolute (`location.origin` + `withBasePath`), because MapLibre fetches tiles from
  its worker. They're set on the source when the map's realm is known: the `?realm=` slug if present,
  else the viewer's realm (`useViewerRealmId`), else `default`. Signed-out viewers start at once.
- `useWorldMapLayers` stops pushing GeoJSON to these four sources. Their visibility toggles stay as
  they are. Climate only fetches tiles once its layer is visible.
- Icecaps and the continent fill (`source-background`) stay GeoJSON in the bundle. Web Mercator tiles
  stop at ±85°, and the globe shows the poles.

### 3. Bundle and data hooks

- `CRITICAL_LAYERS` (`src/hooks/useMapData.ts`) drops `rivers` and `lakes`. `useMapDataBatched` drops
  the altitudes request (`DECORATIVE_LAYERS` becomes empty), and climate no longer goes through
  `getWorldMapPacked` in the viewer.
- The IndexedDB cache then holds only the bundle layers. Its read no longer waits on the profile query.
  It starts with the scope it can know immediately (`?realm=` or signed-out), so the cache isn't beaten
  by the network.
- The editor (`useMapData`) is unchanged and keeps per-layer packed GeoJSON for snapping.

### 4. Fixes found by the 2026-10-07 audit

- **Base style wipes loaded data (to confirm first).** `IxWorldMap.tsx:229-239` calls
  `setStyle(buildBaseStyle(), {diff:true})` when `isLoaded` turns true. The diff sends each GeoJSON
  source its empty declared data, after the layer hooks have filled it.
  - First, confirm in the browser: return to `/maps` with React Query or the IndexedDB cache warm, and
    check whether countries render before the network bundle arrives.
  - If confirmed, the fix: skip the initial run, so the effect only applies real theme changes. Then
    re-push current data after a theme change.
- **Zoom-3 prefetch never fires early.** `MapContainer.tsx:467-473` only updates `currentZoom` when the
  zoom bucket changes, which is at zoom 4. Add 3 as a boundary in that comparison, so
  `getMapBundleDetail` starts at zoom 3 as intended.
- **Invisible labels still take part in collision.** Add a filter on the country label layer that hides
  labels with `_distFade` = 0.
- **POI clusters never fully uncluster.** POI `clusterMaxZoom` (10) and story-pin `clusterMaxZoom` (8)
  are above the max zoom of 6. Set both to 5.

## Out of scope (cut on purpose; add when the ceiling is hit)

| Cut | Ceiling | Upgrade path |
|---|---|---|
| Redis tile cache | Uncached tiles each cost one indexed PostGIS query | Add Redis in the route if tile queries show in DB load |
| Revision in tile URLs | A decorative-layer edit can take up to 24 h to reach browsers that cached the tile | Add a per-layer revision (`max(updatedAt)`, count) to the URL |
| Per-zoom `ST_Simplify` and low-zoom area filters | Low-zoom tiles may be larger than needed | Add if any measured tile exceeds ~150 KB |
| Countries on tiles | Countries stay ~0.95 MB of JSON | Separate project; touches selection, labels, search, editor |
| Viewer-only 3-dp countries | ~200 KB more JSON than possible | Add if the bundle misses the target |
| Keeping data across map remounts (`map-engine.ts`) | Returning to the map within a session re-tiles | Revisit with editor work |
| Selective live-sync invalidation, IndexedDB double push | Small once only countries and labels are in the bundle | Revisit if profiling shows it |

## Testing

- **Route tests** (`src/tests/api/map-tiles.test.ts`):
  - 404 for unknown layer, realm and out-of-range `z/x/y`.
  - Public cache header for a published realm.
  - Unpublished realm: 404 for a non-moderator, and `private, no-store` for a moderator.
  - 500 on a database error.
- **One real-database test** against `ixstats_wv1`, skipped when the DB isn't reachable: decodes a
  z2 altitudes tile and a z4 rivers tile and checks for features with `_fillColor` / `_areaSqKm`.
  It uses `@mapbox/vector-tile` 3 + `pbf` 5, which are already installed as MapLibre dependencies, as a
  test-only import (no new package).
- **Hook tests:** the bundle no longer requests rivers or lakes; no altitudes query; tile URL built for
  `?realm=`, the viewer's realm and signed-out.
- **Browser probe** (`plans/wikios-v1-tools/maps-probe.mjs`), cold and warm, before and after:
  - Count and size of JSON responses, tile bytes and request count.
  - Time until the political layer has rendered features.
  - Screenshots at zoom 1.8 and zoom 5.
  - The signed-in editor still loads.
- **Gates:** affected Jest suites, `typecheck:server|ui|trpc` with the incremental cache cleared, and
  oxlint on changed files. No builds.

## Done when

- First-load JSON is ≤ ~1.05 MB (bundle only). Tile bytes are reported separately.
- On a cold load, countries render no later than today. On a warm return, they render from cache
  before the network responds.
- Screenshots at zoom 1.8 and 5 show no visual regression (no seams in altitudes or climate, poles
  intact), and the editor screenshot is unchanged.
- All gates pass.

## Ops and release

- **Owner adds a Cloudflare Cache Rule:** path starts with `/projects/ixstats/api/map-tiles/` (and
  `/api/map-tiles/` on maps.ixwiki.com) → eligible for cache, respect origin `Cache-Control`.
  `.pbf` responses are not edge-cached by default.
- **Release notes:** a changelog entry, plus a check against `docs/reference/revision.md` for the
  IxWorld capability integer bump. The owner confirms the version change.
