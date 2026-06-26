# Modularize `geo/core.ts` → `geo/core/`

## Context

`src/server/api/routers/geo/core.ts` is **3,310 lines / 116 KB** — the largest geo
router file. It bundles four unrelated concerns: an in-memory layer cache, geometry
math helpers, DB/file layer assembly, and **27 tRPC procedures** spanning world-map
assembly, country geometry, point queries, search, stats, geo-profiles, overlays, and
admin recalcs. Size makes it hard to navigate, review, and edit. Break it into a
`geo/core/` directory of focused modules — **a pure mechanical move, no logic changes**
— while preserving the exact public API so **zero call sites elsewhere change**.

## Public API to preserve (do not break)

`geo/core` resolves to `geo/core/index.ts`, so a barrel that re-exports the current
symbols keeps every existing import working. The external consumers are:

| Importer | Symbol(s) |
|----------|-----------|
| `src/server/api/root.ts` | `geoCoreRouter` |
| `countries/management.ts`, `countries/identity.ts` | `clearLayerCache` |
| `geo/{admin,features,editor,sovereignty}.ts` (relative `./core`) | `clearLayerCache` (+ `extractAllPositions` in admin) |
| `src/instrumentation.ts` (dynamic `import()`) | `warmGeoCache`, `warmGeoCacheDev` |

`index.ts` must re-export: `geoCoreRouter`, `clearLayerCache`, `extractAllPositions`,
`warmGeoCache`, `warmGeoCacheDev` (and `layerCache` for safety). **No other file is
edited.**

## Established pattern to mirror

`src/server/api/routers/countries/` already does exactly this: each domain file exports
`export const <name>Procedures = { ... }` (a record of procedures), and
`countries/index.ts` spreads them into one router:

```ts
export const countriesRouter = createTRPCRouter({
  ...listProcedures, ...economyProcedures, ...identityProcedures, /* … */
});
```

No `mergeRouters` is used anywhere in the codebase (it isn't even exported from
`trpc.ts`). Spreading procedure records keeps names **flat** → identical API. Follow
this convention exactly.

## Target layout: `src/server/api/routers/geo/core/`

**Helper modules** (extracted from current lines 1–828, exported for reuse):

| File | Moves (current line) | ~lines |
|------|----------------------|--------|
| `shared.ts` | `coordinatesSchema` (75) + shared input schemas/constants | ~40 |
| `cache.ts` | `layerCache` (119), `clearLayerCache` (126), `ZoomBucket`/`getZoomBucket` (168/170), `getCompressionForLayer` (197), `getCached`/`setCache` (203/215), `warmGeoCache` (228), `warmGeoCacheDev` (275) | ~200 |
| `geometry.ts` | `extractAllPositions` (305), `computeApproxAreaForFeature` (325), `computeVisualCenter` (380), `estimateBboxOverlap` (~3257), `extractCoords` (~3295) | ~150 |
| `layer-loader.ts` | `loadGeoJSONFromFile` (430), `loadLayerFromDB` (465), `mergeFeaturesByColor` (772), `getColorForFeature` (813) | ~365 |

**Procedure groups** (each exports `export const <name>Procedures = {…}`):

| File | Procedures | ~lines |
|------|-----------|--------|
| `world-map.ts` (`worldMapProcedures`) | getWorldMap, getMapBundle, getAllMapFeatures | ~360 |
| `country.ts` (`countryProcedures`) | getCountryGeometry, getCountryFeatures, getCapitalCities, getCountryLinkage, getNeighbors, getNeighborGeometries | ~310 |
| `point-queries.ts` (`pointQueryProcedures`) | getCountryAtPoint, getPointInfo, validatePointInCountry | ~235 |
| `discovery.ts` (`discoveryProcedures`) | listCountries, getLayerInfo, searchFeatures | ~200 |
| `stats.ts` (`statsProcedures`) | getMapStats, getSystemHealth, getSharedVertices, getCountryConflicts | ~185 |
| `geo-profile.ts` (`geoProfileProcedures`) | getCountryGeoProfile | ~380 |
| `overlays.ts` (`overlayProcedures`) | getRegionalChoropleth, getCrisisRiskMap, getTradeRouteGeoJSON, getGeopoliticalOverlay | ~530 |
| `admin-ops.ts` (`adminOpsProcedures`) | recalculateArea, recalculateAllAreas, recalculateGeoProfiles | ~290 |

**Barrel** `index.ts` (~40 lines):

```ts
import { createTRPCRouter } from "~/server/api/trpc";
import { worldMapProcedures } from "./world-map";
import { countryProcedures } from "./country";
// … point-queries, discovery, stats, geo-profile, overlays, admin-ops

export const geoCoreRouter = createTRPCRouter({
  ...worldMapProcedures,
  ...countryProcedures,
  ...pointQueryProcedures,
  ...discoveryProcedures,
  ...statsProcedures,
  ...geoProfileProcedures,
  ...overlayProcedures,
  ...adminOpsProcedures,
});

// Preserve external API (resolution: `geo/core` → `geo/core/index.ts`)
export { clearLayerCache, warmGeoCache, warmGeoCacheDev, layerCache } from "./cache";
export { extractAllPositions } from "./geometry";
```

Result: one 3,310-line file → 13 files, none over ~530 lines.

## Dependency direction (avoid cycles)

- `shared` ← imported by everything; imports nothing internal.
- `cache` imports `shared`; `geometry` imports `shared`; `layer-loader` imports
  `cache` + `geometry` + `shared`.
- Procedure files import helpers (`cache`/`geometry`/`layer-loader`/`shared`) + the
  procedure builders from `~/server/api/trpc`.
- Helpers must **never** import procedure files. `index.ts` imports everything.

## Execution order (incremental, verify between steps)

1. Create `geo/core/` with `shared.ts`, `cache.ts`, `geometry.ts`, `layer-loader.ts` —
   move helper bodies verbatim, add per-file imports (subset of the current 81-line
   header), export each symbol used cross-module.
2. Create the 8 procedure-group files; move each procedure body + its zod input
   verbatim; wrap each group as `export const <name>Procedures = { … }`; import only the
   helpers/builders each file actually uses.
3. Create `index.ts` (composition + re-exports above).
4. **Delete the old `core.ts`** in the same change (TS cannot resolve `geo/core` with
   both `core.ts` and `core/index.ts` present).
5. `bun run dev` to confirm compilation + that all `./core` / `geo/core` imports still
   resolve.

## Risks

- **`core.ts` + `core/` coexistence** — ambiguous module resolution; old file must be
  deleted in the same commit as the new dir.
- **Import distribution** — give each file only the imports it uses; don't copy the
  whole 81-line header into every file (lint will flag unused imports).
- **Interleaved helpers** — `estimateBboxOverlap`/`extractCoords` live at the bottom of
  the current file among procedures; relocate to `geometry.ts` and export.
- **Verbatim move** — no behavioral edits. Procedure bodies, zod schemas, cache keys,
  and helper logic move unchanged; diffs should be pure relocation.

## Verification

- `bun run dev` (port 3000): server compiles; exercise the moved procedures via the UI —
  `/maps` (getWorldMap, getMapBundle, searchFeatures, getNeighbors) and a country page /
  `/mycountry` (getCountryGeometry, getCountryGeoProfile, overlays).
- Grep that nothing imports a symbol that didn't survive the barrel:
  `grep -rn 'geo/core' src --include=*.ts` and confirm each imported symbol is re-exported.
- `bun run lint` for unused-import / style.
- **Do NOT run global typecheck** (crashes server). `bun run typecheck:server` is the
  user's call to run, not mine.
