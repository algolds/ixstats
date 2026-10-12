# Atlas Release 0 — performance pass — design

**Last updated:** 2026-10-11 · **Status:** design approved by the owner, not built · **Plan:**
[Atlas ship plan](2026-10-11-atlas-ship-plan.md)

Makes the map fast before Release A builds on it: cached tiles and layers, real `Country` geometry in PostGIS, a
world editor that does not re-render on every drag frame, and three editor correctness bugs found by the audits.
Generator speed-ups belong to [Release A](2026-10-11-atlas-release-a-world-creation-design.md).

## Baseline (measured 2026-10-11, local DB, Ixnay unless noted)

| Area                | Measurement                                                                                                                                                                                                                                                      | Where                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Vector tiles        | Rebuilt per request, no server cache. Altitudes `ST_Union` z0 737 ms, z1 393 ms, z2 356 ms; ~1.5–3 s DB time per first globe view; competes with the 20-connection Prisma pool. Unversioned URLs (`max-age=86400`); unpublished realms `no-store`                | `geo/core/tiles.ts:22,47`, `app/api/map-tiles/**/route.ts:18,33`, `realm-tile-access.ts:30`             |
| Layer serialization | superjson walks every coordinate: packed political 75 ms, plain `getWorldMap` 155 ms, altitudes 134–161 ms, `getMapBundle` 126 ms — on the event loop, twice on a Redis miss                                                                                     | `trpc-cache.ts:207`                                                                                     |
| Bundle caching      | Batched tRPC GET with no Cache-Control/ETag: 316 KB gz re-downloaded per load; IndexedDB layer cache is a placeholder that rewrites ~1.6 MB per load; `?realm=` bundles cached per user (`v:<userId>`)                                                           | `useMapDataBatched.ts:117-127,182-191`, `trpc-cache.ts:119`                                             |
| Country geometry    | `"Country".geom_postgis` is NULL for all 237 countries (no trigger). `getCountryGeoProfile` ~3.2 s serial SQL for Caphiria (rivers 1490, neighbours 1035, lakes 555 ms + 11.6 MB layer pull); `recalculateGeoProfiles` ~6–12 min and ~2.7 GB JSON in one request | `geo-profile.ts`, `profile-zones.ts:88`, `admin-ops.ts:137-170`                                         |
| Simplification      | turf `simplify` throws for 77/183 political features (64k of 94k vertices); the catch keeps full geometry at every zoom                                                                                                                                          | `geojson-compress.ts:144-152`                                                                           |
| Live sync           | Any geo change in any realm invalidates 10 queries on every open map                                                                                                                                                                                             | `useMapLiveSync.ts:29-40`                                                                               |
| Embeds              | Unpacked political (516 KB gz) on a separate cache; `CoordinatesMapEmbed` builds two maps on cold load and never releases off-screen (WebGL limit 16); async init leak                                                                                           | `useCountryMapEmbed.ts:33`, `CoordinatesMapEmbed.tsx:104,123,208`, `useCountryMapEmbedLayers.ts:96-106` |
| Warm map            | Re-acquire calls `setStyle({diff:false})`, dropping all sources                                                                                                                                                                                                  | `map-engine.ts:184-195`                                                                                 |
| Over-fetch          | Overlays return full `Country.geometry` (1.2 MB); neighbour geometry loaded realm-wide and filtered in JS, twice when border edit opens; `ST_MakeValid` in a WHERE defeats GiST (251 → 49 ms)                                                                    | `overlays.ts:72,256,389`, `country.ts:308-330`, `borders.ts:56-74`, `bundle.ts:111`                     |
| Caches              | Count-capped (1000) with 0.7–2 MB entries; `layerCache` 32 entries thrashes at 2 realms; `clearLayerCache()` clears every realm; `ixTime` in keys unbounded                                                                                                      | `cache.ts:91`, `map-import.apply.ts:413`, `border-history.ts:49`                                        |
| N+1                 | City import ~15 queries per row; water distance 77 ms (KNN 15 ms); subdivision demographics one query per row, no transaction                                                                                                                                    | `admin/cities.ts:66`, `spatial.ts:238`, `sync.ts:337-433`                                               |
| Border drag         | Re-sends 14.4k vertex/midpoint features per frame (11 ms) + whole editor tree re-renders: ~13.5 ms JS/frame before React                                                                                                                                         | `useBorderEditorLayers.ts:445-474`, `useMapEditorOverlayState.ts:58,248`, `useBorderEditor.ts:779`      |
| Region reshape      | 44 ms turf overlap check every 100 ms during drag                                                                                                                                                                                                                | `useVertexEditPointer.ts:240`, `useSubdivisionVertexEdit.ts:161-164`                                    |
| Autosave            | Uploads the whole undo stack every 30 s (15.1 MB after 50 drags); never read back                                                                                                                                                                                | `useBorderEditor.ts:196-214,533-543`                                                                    |
| Brush               | 70–129 ms boolean ops inside a setState updater                                                                                                                                                                                                                  | `useBorderEditor.ts:750-773`                                                                            |
| Copies              | `structuredClone` of whole geometries per frame; undo entries share nothing (~7–10 MB)                                                                                                                                                                           | `topology-engine.ts:106`                                                                                |
| Snap                | First snap builds segment grids: 68.5 ms stall                                                                                                                                                                                                                   | `map-helpers.ts:324-333`                                                                                |

## Design

### 1. Map delivery

- **Map version.** `Realm.mapVersion Int @default(0)`, incremented in one helper called by every map write path
  (the realm map writer, `refreshRealmMap`, editor saves, imports, rollbacks). Ixnay is realm `default`.
- **Layers leave tRPC.** `GET /api/map-layers/<realm>/<version>/<layer>?bucket=<0|1|2>` returns the packed layer as
  a pre-stringified JSON string from a **byte-bounded LRU** (default 256 MB) keyed by realm/version/layer/bucket,
  built once with in-flight sharing (as `layerCache` does today). Headers: Ixnay and published realms
  `public, max-age=31536000, immutable`; unpublished `private, no-store` (`realm-tile-access.ts` rules). The client
  reads the version from a tiny `realms.map.version` query and fetches layer URLs; the browser cache does the rest.
  `getMapBundle`/`getWorldMap*` tRPC procedures and the IndexedDB placeholder are removed once no caller remains.
- **Vector tiles.** URL gains the version (`/api/map-tiles/<realm>/<version>/<layer>/<z>/<x>/<y>`), served
  `immutable` under the same access rules. Tile bytes are cached on disk at
  `<MAP_TILE_DIR>/<realmId>/<version>/<layer>/<z>/<x>/<y>.pbf` behind a small in-memory LRU; a version bump makes
  old directories garbage (deleted by the cron job after a day). The `map-tiles` cron step **pre-renders z0–3** for
  altitudes, rivers and lakes when a realm's version changes; z4–6 render on first request. Realm access is
  memoised for 60 s. The route accepts the realm slug, so tiles no longer wait for the bundle.
- **Simplification.** The layer builder simplifies political per zoom bucket with `ST_CoverageSimplify` (PostGIS
  3.4 / GEOS 3.12, present locally), keeping shared borders aligned. If the function is missing, it falls back to
  turf simplify per polygon/ring with try/catch per ring.
- **Live sync.** The `geo-change` event carries `realmId` and `changeType`; clients ignore other realms and refetch
  only the version (and affected detail queries).
- **Warm map.** `map-engine` skips the style reset when the `world` role is re-acquired with the same theme; the
  last-loaded data marker lives on the map instance.
- **Embeds.** Use the shared packed layer URLs; `CoordinatesMapEmbed` updates sources with `setData` instead of
  rebuilding, and releases its map when scrolled more than a screen away; `useCountryMapEmbedLayers` gets a
  cancelled flag checked after `await initMap()`.
- **Overlays** return `{ countryId, value }[]`; the client joins on the political layer's `_countryId`.

### 2. Server geo

- **Country geometry.** A trigger on `"Country"` keeps `geom_postgis` in sync with `geometry` (same function as
  `sync_map_layer_geom`), plus a one-off backfill. `syncCountryGeometryFromMapLayer` unions in PostGIS
  (`ST_Union` of the linked features) instead of turf.
- **Geo profile.** Queries use `c.geom_postgis` / `ml.geom_postgis` with `&&`, filter by realm, run in
  `Promise.all`, and use `ST_Subdivide` on large countries for intersections; the Ixnay bbox branch is removed (the
  PostGIS clip path covers every realm). The stored `CountryGeoProfile` is served when fresh; TTL 1 h.
- **`recalculateGeoProfiles`** becomes a queued job run by the cron worker, one country at a time with progress.
- **Bundle query** drops `ST_MakeValid` in the WHERE and fetches geometry once; neighbour geometry is filtered in
  SQL (`geom_postgis && ST_MakeEnvelope`); opening border edit seeds the neighbour query from the session response
  (one fetch).
- **N+1.** City import does containment for the whole batch in one query and the water distance with KNN `<->`;
  demographics distribution runs in one transaction with batched updates.
- **Caches.** The memory fallback becomes byte-bounded; `clearLayerCache(realmId)` clears one realm; `ixTime` keys
  are rounded to the day; border history queries are realm-scoped and bounded.

### 3. Editor

- **Border drag.** In-drag geometry lives in a ref; a tiny `border-drag` source holds the dragged vertex and its two
  edges; the full vertex and midpoint sources are rebuilt on mouseup; the selected vertex uses feature-state. React
  state is committed once in `commitDrag`. `actions` are memoised and the overlay state object is stable, so
  memoised panels stop re-rendering; the live area readout goes through `transientStore`.
- **Copies.** `cascadeMoveVertex` copies only the touched ring, so undo entries share untouched rings.
- **Region reshape.** No overlap check during the drag; on mouseup it checks only regions sharing a vertex with the
  edited one.
- **Brush.** Boolean ops run outside the state updater (state read from a ref); the result is set once.
- **Snap grids** are built in `requestIdleCallback` once their layers arrive.
- **Autosave** saves `{ featureId, geometry, dirtyNeighbors, savedAt }` only (target ≤ 1 MB); opening the border
  editor on a feature with a draft newer than the feature's `updatedAt` offers "Restore unsaved changes" or
  "Discard".
- **Correctness bugs.** Region-drag neighbours: `promoteId: "id"` on `editor-subdivisions` and
  `source.updateData({ update: [...] })` (the `_data.features` read breaks on MapLibre 6). Border-edit neighbours are
  drawn and snapped from `borderState.neighborGeometries`, not the separate query. Point drag coalesces to one
  `setData` per animation frame.

## Acceptance

`scripts/perf/atlas-bench.ts` (committed) reruns the audit measurements against the local DB and prints pass/fail:

- a second `/maps` load in the same browser: no layer download (HTTP cache) and 0 ms tile DB time (disk cache);
- no map layer or tile route blocks the event loop > 50 ms on a cache hit;
- `getCountryGeoProfile` for Caphiria ≤ 400 ms;
- border drag on Caphiria ≤ 4 ms JS per frame (pure-function harness);
- no region-reshape frame > 16 ms from overlap checks;
- autosave payload ≤ 1 MB after 50 drags.

## Testing

TDD per task: version helper and cache headers (route tests), tile cache read/write and invalidation, coverage
simplify + fallback (unit on a small coverage), live-sync filtering, embed cancel/release, trigger + backfill
(migration test against the local DB), geo profile query shape, batched import, drag source handling and memo
stability (hook tests), autosave restore, the three bug fixes. Gates: lint, `typecheck:*`, touched tests; no builds.

## Ops

Schema (`Realm.mapVersion`, the `Country` trigger and backfill) is applied locally with `db:push:force` plus a SQL
migration file for the trigger. Production rollout, the first tile pre-render and `MAP_TILE_DIR` provisioning are
the owner's. Disk: tiles are a few MB per realm version; the cron job removes superseded versions.
