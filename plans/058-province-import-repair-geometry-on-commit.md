# Plan 058: Repair self-intersecting province geometry on commit and sync valid geom_postgis

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 3a4e3324..HEAD -- src/server/api/routers/geo/admin/provinces.ts src/lib/geo-validation.ts`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. **Also confirm Plan 057 has landed**
> (the commit loop must already use `buildProvinceMergePlan` with create/update
> branches) — if not, do Plan 057 first.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (PostGIS / geometry operations)
- **Depends on**: `plans/057-province-import-merge-on-conflict.md` (same commit loop)
- **Category**: bug
- **Planned at**: commit `3a4e3324`, 2026-06-17

## Why this matters

The import validator routinely reports self-intersecting features ("N kinks")
and the user's auto-fix tools don't fully remove them. Today the commit stores
the province `geometry` JSON **as-is** and never populates the `geom_postgis`
column, so:

1. **Saved provinces can be topologically invalid.** Any later PostGIS
   operation on them — `ST_Intersection` (used by `clipAndValidatePolygon`),
   `ST_Contains` (city containment checks), area/adjacency — throws a GEOS
   `TopologyException` on invalid input or returns garbage.
2. **`geom_postgis` is NULL after import**, so the spatial GiST index
   (`idx_subdivision_geom`) and every spatial query that reads `geom_postgis`
   silently skip these subdivisions.

The owner's goal for a "clean import" is: **the geometry that gets saved should
be valid**, even if the user accepts that borders shift slightly. PostGIS
`ST_MakeValid` is the standard, dependency-free repair: it removes
self-intersections deterministically. This plan repairs each province's
geometry at commit time and writes the repaired shape to **both** the
`geometry` JSON and `geom_postgis`, matching the sync the codebase already does
in `upsertSubdivision` (`src/lib/country-geo-service.ts:672-690`).

## Current state

**File: `src/server/api/routers/geo/admin/provinces.ts`**, `commitProvinceImport`.
After Plan 057 the transaction creates/updates each subdivision in a loop but
does **not** clean geometry or touch `geom_postgis`. Geometry is stored raw:
`geometry: province.geometry as any`.

**The established sync pattern** lives in `src/lib/country-geo-service.ts:672-690`
(inside `upsertSubdivision`) — note it does NOT repair, only syncs:

```ts
// Force PostGIS triggers to run by updating geom_postgis from geometry
if (subdivision && subdivision.geometry && (subdivision.geometry as any).coordinates &&
    (subdivision.geometry as any).coordinates.length > 0) {
  try {
    await db.$executeRawUnsafe(
      `UPDATE subdivisions SET geom_postgis = ST_GeomFromGeoJSON($1) WHERE id = $2`,
      JSON.stringify(subdivision.geometry),
      subdivision.id
    );
  } catch (err) {
    console.warn(`[upsertSubdivision] Failed to manually sync PostGIS geometry:`, err);
  }
}
```

**PostGIS availability guard** already exists:
`isPostGISAvailable(db)` in `src/lib/geo-validation.ts:64` (cached probe,
returns `false` if PostGIS missing). Use it so dev environments without PostGIS
degrade gracefully (store raw geometry, skip repair/sync) instead of throwing.

**Why `ST_MakeValid` and not `clipAndValidatePolygon`**: `clipAndValidatePolygon`
(`geo-validation.ts:209`) runs `ST_Intersection`, which itself **throws on
invalid input**. So repair must happen with `ST_MakeValid` *before* any
intersection-based op. `ST_MakeValid` can return a `GeometryCollection`
mixing points/lines/polygons; we keep only the polygonal parts with
`ST_CollectionExtract(..., 3)` so the result stays a Polygon/MultiPolygon.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (router) | `bun run typecheck:file src/server/api/routers/geo/admin/provinces.ts` | exit 0 |
| Typecheck (helper) | `bun run typecheck:file src/lib/geo-validation.ts` | exit 0 |
| Lint | `bun run lint` | exit 0 (no new errors in touched files) |

Do **NOT** run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build`.

## Scope

**In scope**:
- `src/lib/geo-validation.ts` (add one exported helper `repairGeometryGeoJSON`)
- `src/server/api/routers/geo/admin/provinces.ts` (call it in the commit loop;
  sync `geom_postgis`)

**Out of scope**:
- `clipAndValidatePolygon` and the client-side commit cleaning in
  `useProvinceImporter.ts` (`sanitizeRegionShape`/`simplifyProvinces`) — do not
  modify; they remain best-effort client passes. This plan is the server-side
  safety net.
- Gap filling — the owner accepts residual gaps; do NOT auto-fill them here.
- The cities block in the transaction — `upsertCity` already syncs its own
  geometry.
- Any schema migration — `geom_postgis` and its index already exist.

## Git workflow

- Branch: `advisor/058-province-import-repair-geometry`
- Commit message e.g.
  `fix(geo): ST_MakeValid province geometry on import commit and sync geom_postgis`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add the `repairGeometryGeoJSON` helper

In `src/lib/geo-validation.ts`, add an exported async helper near
`clipAndValidatePolygon`. It returns repaired GeoJSON (as a parsed object), or
the **original** geometry unchanged if PostGIS is unavailable or the repair
query fails (non-fatal — never throws):

```ts
/**
 * Repair a (possibly self-intersecting) polygonal GeoJSON geometry with PostGIS
 * ST_MakeValid, keeping only polygonal parts. Returns the repaired GeoJSON, or
 * the original geometry unchanged if PostGIS is unavailable or repair fails.
 * Never throws — geometry repair is best-effort and must not abort a commit.
 */
export async function repairGeometryGeoJSON(
  db: PrismaClient,
  geometry: Geometry | Record<string, unknown>
): Promise<Geometry | Record<string, unknown>> {
  if (!("coordinates" in geometry) || (geometry as any).type === "Point") return geometry;
  if (!(await isPostGISAvailable(db))) return geometry;
  try {
    const rows = await db.$queryRawUnsafe<Array<{ repaired: string | null }>>(
      `SELECT ST_AsGeoJSON(
         ST_CollectionExtract(
           ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
           3
         )
       ) AS repaired`,
      JSON.stringify(geometry)
    );
    const repaired = rows[0]?.repaired;
    if (!repaired) return geometry;
    const parsed = JSON.parse(repaired);
    // ST_CollectionExtract returns an empty geometry (no coordinates) if there
    // were no polygonal parts — fall back to the original in that case.
    if (!parsed || !parsed.coordinates || parsed.coordinates.length === 0) return geometry;
    return parsed;
  } catch (err) {
    console.warn(`[geo-validation] ST_MakeValid repair failed; storing original geometry:`, err);
    return geometry;
  }
}
```

`PrismaClient`, `Geometry`, and `isPostGISAvailable` are already imported/defined
in this file (confirm with `grep -n "isPostGISAvailable\|import type { .*Geometry" src/lib/geo-validation.ts`).

**Verify**: `bun run typecheck:file src/lib/geo-validation.ts` → exit 0.

### Step 2: Repair geometry before create/update in the commit loop

In `src/server/api/routers/geo/admin/provinces.ts`, inside the Plan-057
create/update loop, compute the repaired geometry once per province and use it
for the write. Add the import:

```ts
import { repairGeometryGeoJSON } from "~/lib/geo-validation";
```

At the top of the `for (const { province, existingId } of plan)` body:

```ts
const repairedGeometry = await repairGeometryGeoJSON(tx as any, province.geometry as any);
```

Then use `repairedGeometry` in place of `province.geometry as any` in **both**
the `update` (`data.geometry`) and `create` (`data.geometry`) branches.

**Verify**:
- `grep -n "repairGeometryGeoJSON" src/server/api/routers/geo/admin/provinces.ts` → 2 (import + call).
- `grep -c "province.geometry as any" src/server/api/routers/geo/admin/provinces.ts` → 0 inside the commit loop (both replaced).
- `bun run typecheck:file src/server/api/routers/geo/admin/provinces.ts` → exit 0.

### Step 3: Sync `geom_postgis` from the repaired geometry

Still inside the loop, after the `created.push(...)` in each branch (or once
after the branch using the resulting `subdivision.id`), sync the PostGIS column
from the **repaired** geometry. Mirror the existing `upsertSubdivision` pattern
but guard on PostGIS availability and never throw:

```ts
// Sync geom_postgis from the repaired geometry (best-effort, non-fatal)
if ((repairedGeometry as any)?.coordinates?.length) {
  try {
    await tx.$executeRawUnsafe(
      `UPDATE subdivisions SET geom_postgis = ST_GeomFromGeoJSON($1) WHERE id = $2`,
      JSON.stringify(repairedGeometry),
      subdivisionId   // the id from create/update in this iteration
    );
  } catch (err) {
    console.warn(`[commitProvinceImport] geom_postgis sync failed for "${province.name}":`, err);
  }
}
```

Bind `subdivisionId` to whichever id the branch produced (the created or updated
subdivision). Because `repairedGeometry` is already valid, `ST_GeomFromGeoJSON`
on it will not re-introduce invalidity.

**Verify**:
- `grep -n "geom_postgis" src/server/api/routers/geo/admin/provinces.ts` → at least 1 in the commit transaction.
- `bun run typecheck:file src/server/api/routers/geo/admin/provinces.ts` → exit 0.

### Step 4: Lint

**Verify**: `bun run lint` → exit 0 (no new errors in the two touched files).

## Test plan

- **No new unit test** is added: the repair is a PostGIS SQL roundtrip that
  cannot be exercised without a live PostGIS DB (consistent with how
  `clipAndValidatePolygon` and `validatePointContainment` are treated — they
  have no pure unit tests either).
- **Manual verification (required before marking DONE if a dev DB is available;
  otherwise mark deferred and say so in your report)**:
  1. Import an SVG known to contain self-intersecting provinces (validator shows
     "N kinks"); commit it.
  2. In `bun run db:studio` or psql, run:
     ```sql
     SELECT name, ST_IsValid(geom_postgis) AS valid
     FROM subdivisions
     WHERE "countryId" = '<id>' AND geom_postgis IS NOT NULL;
     ```
     Expected: every row `valid = true`, and `geom_postgis` is non-NULL for the
     committed provinces.
- **Regression guard**: importing valid (non-kinked) provinces still commits and
  the geometry is unchanged in shape (ST_MakeValid is a no-op on already-valid
  input).

## Done criteria

ALL must hold:

- [ ] `bun run typecheck:file src/lib/geo-validation.ts` exits 0
- [ ] `bun run typecheck:file src/server/api/routers/geo/admin/provinces.ts` exits 0
- [ ] `bun run lint` exits 0 with no new error in the touched files
- [ ] `grep -n "repairGeometryGeoJSON" src/server/api/routers/geo/admin/provinces.ts` returns the import + call
- [ ] `grep -n "geom_postgis" src/server/api/routers/geo/admin/provinces.ts` shows the sync inside the transaction
- [ ] Only the two in-scope files are modified (`git status`)
- [ ] `plans/README.md` status row updated to DONE
- [ ] Manual PostGIS validity check passed, or explicitly recorded as deferred (no dev DB)

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 057 has not landed (no `buildProvinceMergePlan` create/update loop to hook
  into) — do 057 first.
- The drift check shows the commit loop was refactored away from the
  per-province create/update shape this plan targets.
- `ST_MakeValid` is unavailable in the deployed PostGIS (the repair query errors
  with "function st_makevalid does not exist") — it ships with PostGIS ≥ 2.0 and
  the prod image is `postgis/postgis:16-3.4`, so this should not happen; if it
  does, report rather than swapping in `ST_Buffer(geom, 0)` without sign-off.
- After commit, `geom_postgis` is still NULL for imported provinces (the sync
  silently no-op'd) — investigate before claiming done.

## Maintenance notes

- **Reviewer should scrutinize**: that repair is non-fatal (commit still
  succeeds with the original geometry if PostGIS is down or repair fails) and
  that `geom_postgis` is synced from the **repaired** geometry, not the raw one.
- **`ST_CollectionExtract(..., 3)` can drop sliver line/point artifacts** created
  by `ST_MakeValid` — this is intended (we only want polygons). If a province
  legitimately becomes empty after extraction (it had no polygonal area), we
  fall back to the original geometry rather than storing an empty shape; flag if
  that fallback fires often, as it indicates upstream alignment is badly off.
- **Future consolidation**: `upsertSubdivision` does its own raw `geom_postgis`
  sync without `ST_MakeValid`. A later pass could route both through this helper
  so all subdivision writes get the same repair. Out of scope here.
