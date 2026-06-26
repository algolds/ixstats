# Plan 085: Optimize Map Editor Realtime Reactivity and Invalidate Server Caches

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: 
> `git diff --stat add9bdee..HEAD -- src/server/api/routers/geo/admin/provinces.ts src/server/api/routers/geo/admin/cities.ts src/server/api/routers/countryGeo.ts src/server/api/routers/geo/editor/borders.ts src/server/api/routers/geo/editor/linkage.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature / performance (sync)
- **Planned at**: commit `add9bdee`, 2026-06-18

## Why this matters

Currently, users have to manually refresh the browser page or wait a long time to see their map edits (province borders, subdivisions, cities, POIs, labels, etc.) registered. This is caused by two gaps:
1. **Missing Invalidations on Importers**: The province and city importers do not trigger any server-side cache clearing or event broadcasting.
2. **Stale Server-Side Caches**: Mutations in `countryGeo.ts`, `borders.ts`, and `linkage.ts` invalidate only sub-sections of the cache (e.g. `"geoCore.getAllMapFeatures"`). They miss clearing `"geoCore.getCountryFeatures"` (the main query active in the editor), `"geoCore.getMapBundle"` (the canvas query), and `"geoCore.getCountryGeoBundle"`. Consequently, React Query client-side refetches simply hit the stale server-side cache and retrieve unchanged data.

## Current state

- `src/server/api/routers/geo/admin/provinces.ts` and `src/server/api/routers/geo/admin/cities.ts` contain no invalidation or update broadcast logic.
- `src/server/api/routers/countryGeo.ts` write procedures (`upsertCity`, `upsertSubdivision`, `setCapital`, `upsertPoi`, `updateGeoRollupMode`, `rebaseNationalFromGeography`, `populateFromWiki`) only invalidate `"geoCore.getAllMapFeatures"` and sometimes `"geoCore.getCapitalCities"` or `"countries.getByIdWithEconomicData"`.
- `src/server/api/routers/geo/editor/borders.ts` write procedures (`commitBorderEdit`, `splitCountry`, `mergeCountries`) only call `clearLayerCache("political")` and miss tRPC cache invalidation and SSE broadcast.
- `src/server/api/routers/geo/editor/linkage.ts` write procedures do not invalidate `"geoCore.getCountryFeatures"`, `"geoCore.getMapBundle"`, and `"geoCore.getCountryGeoBundle"`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Test      | `bun run test`           | exit 0, all 690 pass|
| Lint      | `bun run lint`           | exit 0, no errors   |

## Scope

**In scope:**
- `src/server/api/routers/geo/admin/provinces.ts`
- `src/server/api/routers/geo/admin/cities.ts`
- `src/server/api/routers/countryGeo.ts`
- `src/server/api/routers/geo/editor/borders.ts`
- `src/server/api/routers/geo/editor/linkage.ts`

**Out of scope:**
- Modifying client-side WebSocket/SSE listener hook structures.
- Changing cache duration or TTL specifications.

## Git workflow

- Branch: `advisor/085-map-editor-reactivity`
- Commit: `perf(geo): invalidate all map caches and broadcast updates on mutations`

## Steps

### Step 1: Update province and city commit mutations
In `src/server/api/routers/geo/admin/provinces.ts`:
1. Import `invalidateCache` from `"~/lib/trpc-cache"`, `broadcastMapUpdate` from `"~/lib/map-update-bus"`, and `clearLayerCache` from `"~/server/shared/layer-cache"`.
2. In `commitProvinceImport`, run the database transaction, then clear the layers, invalidate the cache, and broadcast the map update:
   ```typescript
   const result = await ctx.db.$transaction(async (tx) => {
     // ... (existing body returning output)
   });

   clearLayerCache("political");
   await invalidateCache([
     "geoCore.getCountryFeatures",
     "geoCore.getMapBundle",
     "geoCore.getWorldMap",
     "geoCore.getAllMapFeatures",
     "geoCore.getCountryGeoBundle"
   ]);
   broadcastMapUpdate("bulk", input.countryId);

   return result;
   ```

In `src/server/api/routers/geo/admin/cities.ts`:
1. Import `invalidateCache` from `"~/lib/trpc-cache"`, `broadcastMapUpdate` from `"~/lib/map-update-bus"`, and `clearLayerCache` from `"~/server/shared/layer-cache"`.
2. In `commitCityImport`, after the import loop finishes, add:
   ```typescript
   clearLayerCache("political");
   await invalidateCache([
     "geoCore.getCountryFeatures",
     "geoCore.getMapBundle",
     "geoCore.getWorldMap",
     "geoCore.getAllMapFeatures",
     "geoCore.getCountryGeoBundle"
   ]);
   broadcastMapUpdate("bulk", input.countryId);
   ```

**Verify**: No compile errors in geo admin routers.

### Step 2: Expand cache invalidation patterns in countryGeo.ts mutations
In `src/server/api/routers/countryGeo.ts`:
1. In `upsertCity`, `upsertSubdivision`, `setCapital`, `upsertPoi`, `updateGeoRollupMode`, `rebaseNationalFromGeography`, and `populateFromWiki`, update the `invalidateCache` arrays to include:
   - `"geoCore.getCountryFeatures"`
   - `"geoCore.getMapBundle"`
   - `"geoCore.getWorldMap"`
   - `"geoCore.getAllMapFeatures"`
   - `"geoCore.getCountryGeoBundle"`
2. In `upsertStoryPin` and `upsertMapLabel`, also append:
   - `"geoCore.getCountryFeatures"`
   - `"geoCore.getMapBundle"`
   - `"geoCore.getCountryGeoBundle"`

**Verify**: No compiler errors in `countryGeo.ts`.

### Step 3: Add cache invalidations and SSE broadcasts to borders.ts mutations
In `src/server/api/routers/geo/editor/borders.ts`:
1. In `commitBorderEdit` (around L284):
   Add:
   ```typescript
   await invalidateCache([
     "geoCore.getCountryFeatures",
     "geoCore.getMapBundle",
     "geoCore.getWorldMap",
     "geoCore.getAllMapFeatures",
     "geoCore.getCountryGeoBundle"
   ]);
   broadcastMapUpdate("borders", feature.countryId ?? undefined);
   ```
2. In `splitCountry` (around L390) and `mergeCountries` (around L458):
   Add:
   ```typescript
   await invalidateCache([
     "geoCore.getCountryFeatures",
     "geoCore.getMapBundle",
     "geoCore.getWorldMap",
     "geoCore.getAllMapFeatures",
     "geoCore.getCountryGeoBundle"
   ]);
   broadcastMapUpdate("borders");
   ```

**Verify**: No compile errors.

### Step 4: Expand cache invalidation list in linkage.ts mutations
In `src/server/api/routers/geo/editor/linkage.ts`:
- Expand the `invalidateCache` arrays inside the mutations (e.g. `linkCountryGeometry`, `unlinkCountryGeometry`, etc.) to clear `"geoCore.getCountryFeatures"`, `"geoCore.getMapBundle"`, and `"geoCore.getCountryGeoBundle"`.

**Verify**: `bun run lint` passes with no errors.

## Test plan

- Run `bun run test` to verify all existing tests still pass.
- Open the Map Editor in the browser and perform a boundary edit, division edit, or city edit.
  - Verify that the changes display instantly on the map without needing a manual browser refresh.
  - Open a second browser tab looking at the same map, perform an edit in the first tab, and verify that the second tab updates in real-time.
