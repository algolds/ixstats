# Refactor: split `country-geo-service.ts` (1457 lines) → `country-geo/` modules

> **STATUS (2026-06-18): IMPLEMENTED on branch `advisor/refactor-country-geo-service`
> (commit `f5cb9143`), not yet merged to `v2`.** Executor used a finer **5-module**
> grouping (`sync`/`bundle`/`spatial`/`policy`/`upsert` + `index.ts`) instead of the
> 3 below — the inlined plan didn't reach it (tooling glitch). Verified by tech-lead
> review: 18/18 export parity, all function bodies byte-identical, no out-of-scope
> files, all 14 importers resolve through the barrel. Merge is the maintainer's call.

> **Executor**: this is a **pure mechanical move — no logic changes**. Move function
> bodies verbatim, add per-file imports, keep `country-geo-service.ts` as a barrel so
> **zero call sites change**. If any step needs a *behavioral* edit to compile, STOP and
> report — that means an assumption here is wrong.
>
> **Planned at**: commit `32667add`, 2026-06-18.
> **Drift check (run first)**: `git diff --stat 32667add..HEAD -- src/lib/country-geo-service.ts`
> If it changed, re-derive the line ranges below before moving anything.

## Context (audit summary)

Audit of the backend map logic found the geo **router** layer is already modularized
(`geo/core/`, `geo/editor/`, `geo/features/`, `geo/admin/` are all split dirs — see
`plans/geo-core-modularization.md`, done). The one genuinely-unsplit backend map
**service** is `src/lib/country-geo-service.ts` (1457 lines, 18 exported functions
spanning feature CRUD, spatial/PostGIS sync, demographics rollup, and policy triggers).
It is imported by ~12 files (routers, demo-seed, tests).

Deliberately **out of scope** (considered, not worth doing now — ponytail):
- `border-editor.ts` (1445) — cohesive client+server geometry engine; a pending feature
  (`plans/map-topology-engine.md`) wants to *extend* it. Splitting now = churn + conflict.
- `province-importer/parse-provinces.ts` (1192) — single-purpose importer parser, low churn.
- `countryGeo.ts` (574) — flat router but not oversized; works unchanged after this split.
- Replacing `db: any` params with a typed Prisma client — real improvement, but a
  separate change. Keep this refactor a pure move; do not touch signatures.

## Why this matters

1457 lines mixing four concerns is hard to navigate, review, and edit (the recent
province-save bug touched `upsertSubdivision` here). Splitting by domain — preserving the
exact export surface via a barrel — makes each concern reviewable in isolation at zero
risk to callers.

## Current state

`src/lib/country-geo-service.ts` — 18 exported `async function`s, static header imports:

```ts
import { getCountryColor } from "~/lib/map-config";
import { featureIdToDisplayName } from "~/lib/map-utils";
import { getTerrainAtPoint } from "~/lib/base-layer-query";
import { geometryAreaSqKm } from "~/lib/geo-math";
```
All other cross-lib deps are dynamic `await import(...)` *inside* functions (geo-validation,
geo-analytics, border-editor) — they move with the function body unchanged.

**Internal call graph (verified — clean DAG, no cycles):** the `upsert*` CRUD functions
call the spatial/rollup helpers; no helper calls back into CRUD; spatial and rollup do not
call each other. So `features → {spatial, rollup}`, both leaves.

**Established pattern to mirror**: `plans/geo-core-modularization.md` + the existing
`src/server/api/routers/geo/core/` dir (helper modules + barrel `index.ts`). Same idea here,
except the barrel stays at the original path so importers are untouched.

## Target layout

Create `src/lib/country-geo/` with three modules; turn `country-geo-service.ts` into a barrel.

| New file | Functions to move (current line range) |
|----------|----------------------------------------|
| `country-geo/spatial.ts` | `syncCountryGeometryFromMapLayer` (10-54), `checkPointInCountryTerritory` (291-308), `findSubdivisionAtPoint` (1097-1128), `updateSubdivisionSpatialProfile` (1129-1282), `updateCitySpatialProfile` (1283-1354), `alignSubdivisionBorders` (1400-1457) |
| `country-geo/rollup.ts` | `getCountryGeoBundle` (55-290), `recalculateLargestCity` (309-352), `syncGeographicDemographics` (353-416), `updateGeoRollupMode` (1036-1056), `rebaseNationalFromGeography` (1057-1096), `triggerGeographyPolicy` (1355-1399) |
| `country-geo/features.ts` | `upsertCity` (417-612), `upsertSubdivision` (613-743), `setCapital` (744-778), `upsertPoi` (779-873), `upsertStoryPin` (874-948), `upsertMapLabel` (949-1035) |

`spatial.ts` and `rollup.ts` import only external libs. `features.ts` additionally imports
the helpers it calls from `./spatial` and `./rollup` (the cross-function calls at lines
461, 594, 597, 600, 601, 603, 627, 723, 726, 735, 806).

`country-geo-service.ts` becomes (whole file):
```ts
export * from "./country-geo/spatial";
export * from "./country-geo/rollup";
export * from "./country-geo/features";
```

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Lint changed files | `bunx eslint src/lib/country-geo-service.ts "src/lib/country-geo/*.ts"` | exit 0 |
| Compile check | `bun run dev` (port 3000) — boots, no module-resolution / compile errors, then Ctrl-C | server ready |
| Unit test | `bun run test -- src/lib/__tests__/country-geo-service.test.ts` | all pass |

**Do NOT run `tsc --noEmit` / `bun run typecheck:full` / `bun run check`** — they crash the
server (8GB). The maintainer runs split typechecks themselves.

## Scope

**In scope (create/modify only these):**
- `src/lib/country-geo/spatial.ts` (create)
- `src/lib/country-geo/rollup.ts` (create)
- `src/lib/country-geo/features.ts` (create)
- `src/lib/country-geo-service.ts` (replace with 3-line barrel)

**Out of scope (do NOT touch):** every importer keeps working via the barrel — do not edit
any file under `src/server/api/routers/`, `src/lib/demo-seed/`, or the test file. Do not
change any function signature, body logic, SQL, or the `db: any` params.

## Steps

### Step 1: Create the three modules (verbatim moves)
For each module: create the file, move the listed function bodies **unchanged**, and add
only the imports those bodies use. Distribute the 4 static header imports to whichever
module references them (lint will flag any unused). Keep dynamic `await import(...)` calls
exactly as-is inside the moved bodies.

**Verify**: `bunx eslint "src/lib/country-geo/*.ts"` → exit 0 (no unused/missing imports).

### Step 2: Wire `features.ts` cross-module imports
In `features.ts`, import from `./spatial`: `findSubdivisionAtPoint`,
`updateSubdivisionSpatialProfile`, `updateCitySpatialProfile`, `alignSubdivisionBorders`;
from `./rollup`: `syncGeographicDemographics`, `recalculateLargestCity`,
`triggerGeographyPolicy`. (These are the only cross-domain calls.)

**Verify**: `bunx eslint "src/lib/country-geo/*.ts"` → exit 0.

### Step 3: Replace `country-geo-service.ts` with the barrel
Overwrite the file with the three `export *` lines above. Nothing else.

**Verify**: every original export still resolves —
`for f in syncCountryGeometryFromMapLayer getCountryGeoBundle checkPointInCountryTerritory recalculateLargestCity syncGeographicDemographics upsertCity upsertSubdivision setCapital upsertPoi upsertStoryPin upsertMapLabel updateGeoRollupMode rebaseNationalFromGeography findSubdivisionAtPoint updateSubdivisionSpatialProfile updateCitySpatialProfile triggerGeographyPolicy alignSubdivisionBorders; do grep -rqE "export (async function|const) $f|export \* " src/lib/country-geo/*.ts && echo "ok $f" || echo "MISSING $f"; done`
→ 18 × `ok`, 0 × `MISSING`.

### Step 4: Compile + test
**Verify**:
- `bun run dev` boots clean (no "Cannot find module" / "has no exported member"), then stop it.
- `bun run test -- src/lib/__tests__/country-geo-service.test.ts` → all pass.

## Done criteria (all must hold)
- [ ] `country-geo-service.ts` is exactly the 3-line barrel.
- [ ] The 18 exports resolve (Step 3 grep: 18 ok / 0 missing).
- [ ] `bunx eslint src/lib/country-geo-service.ts "src/lib/country-geo/*.ts"` exits 0.
- [ ] Existing unit test passes unchanged.
- [ ] `git status` shows only the 4 in-scope files (3 new + 1 modified).
- [ ] No function body, signature, SQL, or `db: any` param changed (diff is pure relocation + new imports + barrel).

## STOP conditions
- The drift check shows `country-geo-service.ts` changed since `32667add` and the line
  ranges no longer match.
- A function appears to be called by a *helper* you placed in `spatial.ts`/`rollup.ts`
  (would create a cycle `features ← spatial/rollup`) — re-check; the audit found none, so a
  match means the file drifted. Report instead of inventing a 4th module.
- Compile fails for any reason other than a missing/unused import you can add/remove without
  touching logic.

## Maintenance notes
- The barrel keeps `~/lib/country-geo-service` as the public path; new functions should be
  added to the right domain module and are auto-exported by `export *`. Avoid name
  collisions across the three modules (`export *` would clash).
- If the topology-engine work (`plans/map-topology-engine.md`) lands, its server-side cascade
  belongs in `country-geo/spatial.ts` alongside `alignSubdivisionBorders`.
- A follow-up worth doing later: replace `db: any` with the typed Prisma client across these
  modules — easier now that each file is small. Out of scope here on purpose.
