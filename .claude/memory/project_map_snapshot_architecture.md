---
name: project_map_snapshot_architecture
description: Map rendering = single live instance + snapshot previews for all passive embeds (one WebGL context each); how origin changes propagate
metadata: 
  node_type: memory
  type: project
  originSessionId: 45c4a18a-9ed9-4ef9-a137-1f87d2e9457a
---

Map architecture on v2 (impl 2026-07-01, plan `plans/shared-map-snapshot-architecture.md`).

**Goal:** map loaded/used globally once; every embed derives from the same origin as the main map;
origin changes auto-propagate; perf-first.

**Model (two WebGL contexts total, regardless of embed count):**
- **Live instance** — the re-parented singleton in `SharedMapContext` (`acquireMap`), used for the ONE
  focused/interactive map (`/maps`, editor, a *promoted* preview). A single `<canvas>` can only be in
  one DOM node — this is why simultaneous live embeds were impossible and looped.
- **Snapshot factory** — `src/lib/map-snapshot/snapshot-service.ts`: ONE hidden offscreen map
  (`preserveDrawingBuffer:true`, positioned top-left+opacity:0 so it renders and isn't occlusion-culled),
  serial render queue, LRU(200) cache, 8s idle timeout. `getSnapshot(spec)` full-resets style per job
  (`setStyle diff:false`) → runs a builder → waits `idle` → `canvas.toDataURL()`. Cached by opaque key.
- **Builders** `src/lib/map-snapshot/builders.ts`: `buildCountryLayers` / `buildCoordsLayers`. Pins are
  CIRCLE LAYERS, not DOM `Marker`s (DOM markers aren't captured by `toDataURL`). GOTCHA: pass
  `countryId` into the country build data — `useCountryMapEmbed` result has none, and the neighbor
  filter needs it or the target draws as a grey neighbor.
- **Previews** `CountryMapPreview.tsx` / `CoordinatesMapPreview.tsx`: measure box → `<img src=snapshot>`
  → spinner → **click promotes** to the live component (`CountryMapEmbed`/`CoordinatesMapEmbed`).
  Drop-in for the passive `CountryMapEmbed` uses (no `interactive` prop).

**Propagation ("change main map → all update"):** snapshot cache key = size + options +
`dataUpdatedAt` (React-Query freshness of `getCountryGeoBundle`/`getWorldMap`) + `version`
(`src/stores/map-data-version.ts`). `useMapLiveSync.invalidateMapCaches` bumps the version on every
SSE `map_data_changed` → all previews re-render from refreshed origin, for all users.

**Migrated to preview (passive):** OverviewHero, DashboardRouter, CountryOverviewPanel, CountryPortal,
InfoboxWithMap, ArticleRenderer(coords). **Stay live (interactive, one-at-a-time):** DashboardMapWidget
(diplomacy/intel/defense, `onFeatureClick`), CountryFeatureSheet.

Old failure it fixed: `CoordinatesMapEmbed` spun a fresh `new maplibregl.Map()` per instance →
wiki articles with several map tags exhausted the WebGL context pool. See
[[project_maps_mycountry_integration]], [[project_map_editor_improvements]].
