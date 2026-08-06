# Plan 119: Map Editor Backend Overhaul — Revised & Measurement-First

**Status**: Draft (replaces/amends Plans 115–118)
**Scope**: Map Editor read/write pipeline performance (`geoCore.getCountryFeatures`, `countryGeo.*` + `geo/features/*` mutations, `useMapEditor.ts`)
**Goal**: Reduce browser memory/CPU and network payload for the Map Editor, without re-implementing machinery that already exists and without shipping unmeasured optimizations.

---

## 0. Why this revision exists

Plans 115–118 were written against assumptions that do not match the current codebase. A code audit (2026-08-06) found that several of the proposed mechanisms already exist, and several of the stated problems are not actually happening. This plan preserves the *intent* (smaller payloads, fewer refetches, offloaded secondary work) but:

1. Reuses existing primitives instead of duplicating them.
2. Gates every optimization on measured baselines.
3. Folds in a real stale-server-cache bug found during the audit.

### 0.1 Verdict per original phase

| Plan | Claim | Audit finding | Verdict |
|------|-------|---------------|---------|
| **115** (GeoJSON precision + cache) | "PostGIS returns 14–16dp floats, >60% payload, queries PG on every render" | PostGIS `ST_AsGeoJSON` defaults to **9dp** (`geo-validation.ts:230`). Truncation **already exists** (`geojson-compress.ts:18-62`). `getCountryFeatures` **already cached** 60s via `cachedPublicProcedure` (`geo/core/country.ts:103`, `trpc-cache.ts:376`). `layerCache` already caches map layers (`layer-cache.ts`). | **Partial.** Keep response-boundary 6dp truncation only; **drop** the new 30s cache layer and the new truncator helper. |
| **116** (Async sync) | "subdivisions.ts calls `syncGeographicDemographics` + `syncResourcePoolModifiers` synchronously; 300–800ms stalls" | `subdivisions.ts` mutations call **only** `syncGeographicDemographics` (lines 260/362/394/741). The heavy Haversine `syncResourcePoolModifiers` (`subdivisions.ts:48`) is called from **pois.ts + transport**, not subdivision saves. `syncGeographicDemographics` is cheap (2–3 aggregates; early-returns unless `geoRollupMode === "bottom-up"`, `sync.ts:120`). Real save cost is clip/align/PostGIS-write/spatial-profile — cannot be deferred. | **Rework.** Defer only if measurement says so; use deduped background flush, **not** `queueMicrotask`. |
| **117** (Incremental patches) | "every mutation triggers `debouncedRefetch()` → full 500-item refetch" | True for most mutations, **but** the main geometry-save path (`updateSubdivisionGeom`, `useMapEditor.ts:1127-1161`) **already** does `setData` incremental patching, and `countryGeo` upserts **already** return the full saved model (`countryGeo.ts:170/228/298`). | **Complete the work.** Extend the existing patch pattern to the remaining mutations; fix `geo/features` stale-cache invalidation. |
| **118** (Precomputed metrics) | "client loops turf `area`/`centroid`/`bbox` on load, blocking 100–250ms" | **No on-load turf geometry loops exist** in the maps editor (grep of editor components = 0 hits; the turf calls in `useMapEditor.ts:3555/3729/4287` are action-triggered). `Subdivision.areaSqKm` **already computed server-side** on save (`upsert.ts:275/284`). | **Skip.** Nothing to build. |

---

## 1. Measurement gate (BLOCKING — do this first)

Do not touch optimization code until baselines exist. Instrument with **temporary** timing logs (remove before merging).

### 1.1 Mutation stage timers

Add `console.time`/`console.timeEnd` around each stage in `src/lib/country-geo/upsert.ts`:

- `upsertSubdivision`: `clip+align` → `db write` → `geom_postgis sync` → `updateSubdivisionSpatialProfile` → `triggerGeographyPolicy` → `syncGeographicDemographics`.
- `upsertCity`: `snap+containment` → `auto-subdivision lookup` → `terrain elevation` → `db write` → `geom sync` → `spatial profile` → `recalculateLargestCity` → `syncGeographicDemographics`.
- `upsertPoi`: same stages.

Target metric: stage share (%) of total mutation latency across ~10 real saves. This decides whether §3 (deferral) is worth building at all.

### 1.2 Payload measurement

Log `JSON.stringify(response).length` for `getCountryFeatures` by feature type (subdivisions vs cities vs pois…), plus total vertex count per country. Re-run after §2.1 to record the real delta (expect ~20–30%, not the claimed >60%).

### 1.3 Client-side

In `useMapEditor.ts`, log once per mount: time-to-first-render of the `getCountryFeatures` query + the number of `setData` patches vs `refetchFeatures()` calls in a 60s editing session. This quantifies §2.2 impact.

**Exit criteria for the gate:** a dated baseline note appended to this file with (a) p50/p95 save latency by stage, (b) payload bytes by feature type, (c) patch-vs-refetch counts.

---

## 2. Confirmed low-risk wins (ship regardless of measurements)

### 2.1 Response-boundary 6dp coordinate truncation for `getCountryFeatures`

- **Reuse, don't recreate.** Export `truncateGeometry` from `src/lib/geojson-compress.ts` (or add a `truncateFeatureCollection` wrapper) and call it inside `getCountryFeatures` (`src/server/api/routers/geo/core/country.ts:103`) on each returned `subdivision.geometry` before the response returns.
- Truncate at the **response boundary only** — never at write time. The editor's `setData` patch compares saved geometry (`useMapEditor.ts:1130`); keeping full precision in the DB avoids any sub-mm drift and keeps PostGIS metrics accurate.
- Precision: 6dp ≈ 0.11 m — far below display need.
- **Do not add** a new 30s `layer-cache` entry for `getCountryFeatures` — the existing 60s `cachedPublicProcedure` + explicit invalidation is sufficient and adding a second TTL layer invites divergence.

### 2.2 Finish incremental cache patching (completes Plan 117)

Already done: `updateSubdivisionGeom` patches `geoCore.getCountryFeatures` + `countryGeo.getCountryGeoBundle` via `setData` and deliberately skips invalidating the feature query (`useMapEditor.ts:1127-1161`).

Remaining (in `src/hooks/useMapEditor.ts`): convert these from `invalidateAllMapData()` + `debouncedRefetch()` to the `setData` patch pattern on success:

- `createCity` / `updateCity` (line 1081/1089) — `upsertCity` returns the full model.
- `deleteCity` (1097) — remove from `cities` array.
- `createSubdivision` / `updateSubdivision` (1105/1113) — `upsertSubdivision` returns full model incl. `geometry` + `areaSqKm`.
- `deleteSubdivision` (1167) — remove from `subdivisions`.
- `createPOI` / `updatePOI` / `deletePOI` (1176/1184/1192) — `upsertPoi` returns full model.

Keep `getMapBundle`/`getWorldMap` invalidations for other views, but stop refetching `getCountryFeatures` after each edit.

### 2.3 Fix stale server cache invalidation (real bug found in audit)

`geo/features/{pois,cities,subdivisions,storyPins,labels}.ts` invalidate **only** `["geoCore.getAllMapFeatures"]` (plus their own list keys) — **not** `geoCore.getCountryFeatures`, `countryGeo.getCountryGeoBundle`, or `geoCore.getMapBundle`. Since `getCountryFeatures` is server-cached for 60s, any refetch after these mutations serves stale data until TTL expiry.

Fix: add the missing keys to every `invalidateCache([...])` call in those five files (mirror the array already used in `countryGeo.ts:219-225`):

```ts
await invalidateCache([
  "geoCore.getCountryFeatures",
  "geoCore.getMapBundle",
  "geoCore.getWorldMap",
  "geoCore.getAllMapFeatures",
  "countryGeo.getCountryGeoBundle",
]);
```

(`namedFeatures.ts` already includes `countryGeo.getCountryGeoBundle`.)

---

## 3. Deferral micro-optimization (ONLY if §1.1 shows sync is a hotspot)

If `syncGeographicDemographics` (or `syncResourcePoolModifiers` in `pois.ts`/`transport`) accounts for a material share of save latency:

- **Do not use `queueMicrotask`.** It does not offload CPU from the event loop and is not a queue (no dedup, no retry, no durability).
- Use a small module-level **deduped background flush** keyed by `countryId` (debounce 250ms, coalesce to one run per country, wrap in try/catch with `console.warn`, log failures to the server log). Place in `src/lib/country-geo/async-sync.ts`.
- Defer **only** the pure-rollup calls (`syncGeographicDemographics`, `syncResourcePoolModifiers`). Keep synchronous: `clipAndValidatePolygon`, `alignSubdivisionBorders`, the DB write, `geom_postgis` sync, `updateSubdivisionSpatialProfile`, `triggerGeographyPolicy`, `recalculateLargestCity`.
- Consistency caveat: for `geoRollupMode === "bottom-up"` countries, deferring means population/GDP lag the edit. Acceptable if the editor UI reads from the mutation response (it does, after §2.2); otherwise keep the sync synchronous for those countries.
- **Expected outcome is NOT `<15ms` saves** — the real save floor is the clip/align/PostGIS work. Set an honest target (e.g., remove sync's share of p95, whatever §1.1 measures).

---

## 4. Explicitly skipped

| Item | Why |
|------|-----|
| New 30s server cache for `getCountryFeatures` | Redundant with existing 60s `cachedPublicProcedure`; extra TTL layer = divergence risk. |
| New `truncateCoordinatePrecision` helper | `geojson-compress.ts` already does this. |
| Precomputed `centroid`/`bbox`/`areaSqKm` columns + client-side turf removal | No on-load turf loops exist; `areaSqKm` is already server-computed. |
| Simplifying/truncating map-layer (SVG/PostGIS country) geometry further | Already handled by `compressFeatureCollection` + LOD in `geo/core/cache.ts`. |

---

## 5. Verification

### 5.1 Static verification (2026-08-06, completed)

| Check | Result |
|-------|--------|
| `bun run typecheck:server` | PASS — no errors in files touched by this plan (20 pre-existing errors remain in unrelated files: `map-pipeline/realm-map-committer.ts`, `geo/realms-pipeline.ts`, `intent.ts`, `thinkpages/accounts.ts`, `geo/features/subdivisions.ts:353` cascadedNeighbors `Record<string,unknown>`). |
| `bun run typecheck:ui` | PASS — no errors in `useMapEditor.ts` / plan files (140 pre-existing elsewhere). |
| `bun run typecheck:trpc` | PASS — no plan-file errors (18 pre-existing elsewhere). |
| `bun run typecheck:db` | PASS — 0 errors. |
| `bun run test -- src/server/api/routers/geo` | PASS — 2 suites, 8 tests. |
| `bun run audit:arch` | PASS for this plan — `geo/features/subdivisions.ts` flagged GROWN (747 vs baseline 727) but that predates this plan (HEAD = 747, this plan's diff is +6/−6); all 12 violations are pre-existing working-tree files. |

The `geo/features/subdivisions.ts:353` TS2322 (`neighbor.geometry: Record<string, unknown>` → Prisma `InputJsonValue`) is a pre-existing error in untouched cascadedNeighbors code.

### 5.2 Baseline (measurement gate, §1)

Automated baselines **not yet established** — require a running dev environment with a large-nation test fixture (see §1.2). Until then §3 deferrals are **not** triggered; §2 changes (cache invalidation, truncation, patching) are shipped as correctness/perf wins that are safe regardless of measurement.

### 5.3 Remaining manual checks (pending live env)

- Edit a subdivision vertex → map updates **without** a `getCountryFeatures` network refetch (DevTools network tab).
- Create a city, delete a POI, create a subdivision → other views update; editor does not flicker.
- Wait >60s after a `geo/features` delete, reload → data consistent (stale-cache fix).
- Confirm TEMP instrumentation (`[upsert:*]` stage logs, `[getCountryFeatures:payload]`, `[useMapEditor:meas]`) appears, then **remove** before merge.

---

## 6. Changelog / versioning

Per standing instruction: after implementation, decide whether to bump platform `Major.Minor.Patch` or a component capability integer in `src/lib/buildVersion.ts` (`IXWORLD_VERSION` / `BUILDER_VERSION`?) and update `CHANGELOG.md`. This is a perf/internal refactor — likely a **patch** bump unless it ships with feature work.
