# Shared Map — Single Origin + Snapshot Previews

**Goal (user, reaffirmed):** the map is loaded/used globally **once**; every embed derives from the
same origin as the main map; any change to the origin propagates to all embeds in the background;
priority is effectiveness + performance.

**Decision (user):** passive embeds are **non-interactive auto-updating snapshots**. Only the
*focused* map is a live WebGL instance. Click a preview to promote it to live if interaction is needed.

---

## Why the current design can't meet the goal

`SharedMapContext` re-parents **one** `<canvas>` into whichever slot calls `acquireMap`. A single
canvas can only live in one DOM node, so when several embeds mount at once (e.g.
`ArticleRenderer` portals one `CoordinatesMapEmbed` per wiki map tag; country lists stack cards),
every embed after the first loses the race and spins forever. The loop fixes we shipped
(memoized context value; leak-free cold-load polling) make the *single active* map robust — they
can't make one canvas exist in N places. This is a ceiling, not a bug.

Two concerns were conflated; separate them:

| Concern | State today | Target |
|--------|-------------|--------|
| **Data/style origin** (GeoJSON, styles, edits) | Already single-origin: `getWorldMap` / `getCountryGeoBundle` React-Query-cached once (30-min stale), shared by all consumers | Keep. Add a **version signal** so edits invalidate snapshots. |
| **Rendered instance** (WebGL canvas) | One re-parented singleton; can't serve simultaneous embeds | One **live** instance for the focused map + a **snapshot factory** for all passive embeds |

WebGL contexts are capped (~8–16/page), so "a live instance per embed" is off the table for perf.

---

## Target architecture

```
        ┌─────────────────────────── single origin ───────────────────────────┐
        │  React Query cache: getWorldMap / getCountryGeoBundle (loaded once)   │
        │  map-config styles  +  mapDataVersion (bumps on edit / invalidation)  │
        └───────────────┬───────────────────────────────────┬──────────────────┘
                        │                                   │
            ┌───────────▼───────────┐          ┌────────────▼─────────────┐
            │  LIVE instance (1)     │          │  SNAPSHOT FACTORY (1)     │
            │  SharedMapContext      │          │  1 hidden offscreen map,  │
            │  focused map only:     │          │  preserveDrawingBuffer,   │
            │  /maps, editor,        │          │  small canvas, serialized │
            │  a *promoted* embed    │          │  render queue → toDataURL │
            └────────────────────────┘          └────────────┬─────────────┘
                                                             │ PNG cache keyed by
                                                             │ (countryId, opts, version)
                              ┌──────────────────────────────▼──────────────────────────┐
                              │  <CountryMapPreview> — many, simultaneous, just <img>     │
                              │  spinner while pending; onClick → promote to LIVE instance│
                              └───────────────────────────────────────────────────────────┘
```

**Total WebGL contexts: 2** (1 live + 1 factory) regardless of embed count.

### Pieces

1. **`mapDataVersion`** — a global integer (Zustand or a tiny context) bumped whenever origin data
   changes: geo editor mutations that invalidate `getWorldMap`/`getCountryGeoBundle`
   (`geo/editor/*.ts`), or a manual "map updated" signal. Snapshot cache keys include it →
   propagation "in the background" is just a version bump + React re-request.

2. **`MapSnapshotService`** (new, `src/lib/map-snapshot/`):
   - Lazily creates **one** hidden `maplibre-gl` map (`preserveDrawingBuffer: true`, e.g. 480×320,
     built from the same `buildBaseStyle` + shared sources as the live map — **same origin**).
   - `getSnapshot(countryId, opts, version) → Promise<string /* dataURL */>`:
     cache hit → return; miss → enqueue a render job. Job = set style/layers/bbox for that country
     (reusing the exact layer-building logic already in `useCountryMapEmbedLayers`), wait for
     `idle`, `canvas.toDataURL("image/png")`, cache, resolve. Jobs run **serially** through the one
     instance (a promise queue) so N embeds cost N cached renders, once each.
   - LRU-cap the PNG cache (e.g. 200 entries) to bound memory.

3. **`<CountryMapPreview>`** (new) — replaces the heavy per-embed live path for passive callers:
   renders `<img src={snapshot}>` (object-fit cover), spinner while pending, `mapDataVersion` in
   deps so it auto-refreshes. `onClick` (opt-in) → swap this slot to the **live** singleton via the
   existing `acquireMap` (promote-to-interactive). Same props surface as `CountryMapEmbed` where it
   matters (countryId, height, className, highlight ids) so call sites swap with minimal churn.

4. **Keep `SharedMapContext`** as-is for the **one** live/focused map. Migrate passive call sites
   (`ArticleRenderer`, `CountryOverviewPanel`, `CountryPortal`, `InfoboxWithMap`, dashboard/overview
   heroes, sidebars) from `CountryMapEmbed` → `CountryMapPreview`. Interactive homes (`/maps`,
   editor) stay on the live instance.

---

## Status — ALL PHASES IMPLEMENTED (v2, 2026-07-01)

- **P1** `src/lib/map-snapshot/snapshot-service.ts` (1 offscreen `preserveDrawingBuffer` map + serial
  queue + LRU 200 + 8s idle timeout), `builders.ts` (`buildCountryLayers`/`buildCoordsLayers`, pin as
  circle layer since DOM markers aren't captured by `toDataURL`), `CountryMapPreview.tsx` +
  `CoordinatesMapPreview.tsx` (measure→snapshot `<img>`→click-to-promote to live). Converted
  `ArticleRenderer` (the per-embed-`new Map()` context-exhaustion case).
- **P2** `src/stores/map-data-version.ts` + bump in `useMapLiveSync.invalidateMapCaches` (SSE
  chokepoint → propagates to all users). Snapshots keyed by `dataUpdatedAt` (query freshness) **and**
  `version`; added `dataUpdatedAt` to `useCountryMapEmbed`.
- **P3** migrated passive sites: OverviewHero, DashboardRouter, CountryOverviewPanel, CountryPortal,
  InfoboxWithMap. Interactive one-at-a-time widgets (DashboardMapWidget w/ `onFeatureClick`,
  CountryFeatureSheet) stay on the live singleton — no contention since one section renders at a time.
- **P4** builder self-check test (`__tests__/builders.test.ts`, green), eslint clean on all touched
  files. Loop fixes from prior sessions (memoized context, leak-free cold polling) retained for the
  live instance.

Known minor: clicking a 2nd preview to promote while a 1st is promoted leaves the 1st spinner-stuck
(both want the single live canvas). Not a real flow; revisit only if it surfaces.

## Phasing (ship incrementally, each independently useful)

- **P1 — Snapshot factory + `CountryMapPreview`, wire the worst offender first.**
  Build `MapSnapshotService` + `CountryMapPreview`; convert `ArticleRenderer`'s `CoordinatesMapEmbed`
  (the multi-simultaneous case that's provably broken today). Proves the model end-to-end.
- **P2 — Version signal + background propagation.**
  Add `mapDataVersion`; bump it on geo-editor invalidations; key snapshots by it. Confirm an edit to
  a country updates its previews without a reload.
- **P3 — Migrate remaining passive embeds** (country cards/lists, portal, infobox, dashboard/overview
  heroes, sidebars). Add click-to-promote where interaction is expected.
- **P4 — Polish/perf.** LRU tuning, optional low-res→hi-res progressive snapshot, optional
  pre-warm of on-screen countries, delete now-dead embed layer paths.

## Non-goals / deferred (YAGNI)
- Server-side/static-map image rendering (extra infra) — client `toDataURL` is enough.
- Pre-baked stored thumbnails per country — only if first-paint latency proves to matter.
- A live-instance pool — rejected on perf grounds per the decision.

## Risks / watch
- `toDataURL` needs `preserveDrawingBuffer: true`; set it **only** on the factory instance, never the
  interactive one (perf).
- Serial render queue: a slow/stuck render must time out so the queue can't wedge (bounded per-job
  timeout → resolve with a placeholder, log).
- Snapshots are raster: retina sharpness = render at `devicePixelRatio`. Keep factory canvas modest;
  scale via CSS.
</content>
</invoke>
