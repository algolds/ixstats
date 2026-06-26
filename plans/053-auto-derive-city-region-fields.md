# Plan 053: Auto-derive city elevation + region area from existing data

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report — do not
> improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 098a44bc..HEAD -- src/components/maps/editor/properties/CityPropertyForm.tsx src/components/maps/editor/properties/SubdivisionPropertyForm.tsx src/lib/country-geo-service.ts src/server/api/routers/countryGeo.ts src/hooks/useMapEditor.ts src/lib/base-layer-query.ts src/lib/geo-math.ts`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2 (eliminates two manual data-entry steps that the platform can compute for itself)
- **Effort**: M (1 new server endpoint, 2 form changes, 1 server-side auto-compute, 1 wire-up in `useMapEditor`)
- **Risk**: LOW (additive: elevation becomes optional-on-create-but-auto-by-default; area is now auto-derived but still overridable)
- **Depends on**: none
- **Category**: direction (UX) + tech-debt (manual fields that should be derived)
- **Planned at**: commit `098a44bc`, 2026-06-16
- **Issue**: (none)

## Why this matters

Two editor forms today ask the user to type data the platform can already compute:

1. **City elevation** — `CityPropertyForm.tsx:108-120` exposes a free-form
   `<input type="number">` labeled "Elevation (m)" that the user types by
   hand. The platform has a **terrain-zone layer** in PostGIS
   (`map_layers.layerType = 'altitudes'`) covering the whole world in 9
   canonical elevation bands (`src/lib/elevation-config.ts:24-117`). A pure
   server helper `getTerrainAtPoint(db, lng, lat)` already exists
   (`src/lib/base-layer-query.ts:43`) and returns the zone that contains a
   given lng/lat — there's just no UI to call it, **and** the `upsertCity`
   server helper (`src/lib/country-geo-service.ts:415`) silently drops
   `elevation` from the create payload, so even when the user types a value
   it never reaches the database.

2. **Region area** — `SubdivisionPropertyForm.tsx:75-86` exposes a free-form
   `<input type="number">` labeled "Area (km²)" that the user types by hand.
   The platform has a pure helper `geometryAreaSqKm(geometry)` in
   `src/lib/geo-math.ts:157-181` that computes the area of a Polygon or
   MultiPolygon in km² using the spherical-excess formula. The
   `upsertSubdivision` helper never calls it, so the column is null after
   import and remains null unless the user remembers to type a value.

This plan makes both fields auto-derive from the underlying data (terrain
zone → midpoint of band; polygon geometry → haversine area), with the
typed-in value preserved as an override. The two changes share the same
data-derivation pattern, so they're a single plan.

## Current state

**City elevation today (`CityPropertyForm.tsx:108-120`):**
```tsx
<input
  type="number"
  placeholder="Elevation (m)"
  value={form.elevation ?? ""}
  onChange={(e) => onChange({ ...form,
    elevation: e.target.value ? parseInt(e.target.value, 10) : undefined })}
  className={inputClasses}
/>
```

The form is rendered inside the editor's `PropertiesPanelContent` (after
Plan 024's "unified editor"). The form is in a 2-col grid at lines 96-120:
"Population" | "Elevation (m)" on row 1, "Founded year" alone on row 2. The
form's `onSubmit` calls `submitCity` in `src/hooks/useMapEditor.ts:1101-1121`
which dispatches `api.countryGeo.upsertCity.useMutation()`.

**`upsertCity` today (`src/lib/country-geo-service.ts:415-559`):**
The function does `db.city.create({ data: { ... } })` (line 502) with the
following data payload (lines 502-522):
```ts
data: {
  id: randomUUID(),
  worldId: ..., countryId, name, type, coordinates, population,
  foundedYear, isNationalCapital, isRegionalCapital, subdivisionId,
  // NOTE: no `elevation` here — silently dropped.
}
```
The update branch (lines 457-476) is similar. There is a separate
`wiki-infobox` import path in `src/server/api/routers/countryGeo.ts:448`
that tries to pass `elevation`, but the value is filtered out downstream by
`upsertCity`'s `data` payload.

**`City` model (`prisma/schema/maps.prisma:83-127`):** the `elevation` field
already exists at line 94 as `elevation Float?` with no default. The column
is present; the data just never flows to it.

**Terrain helper (`src/lib/base-layer-query.ts:43-89`):**
```ts
export async function getTerrainAtPoint(db, lng, lat): Promise<TerrainPointResult> {
  const results = await db.$queryRawUnsafe<...>(
    `SELECT "layerType", properties FROM map_layers
     WHERE "isActive" = true AND geom_postgis IS NOT NULL
       AND "layerType" IN ('altitudes', 'climate')
       AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($1, $2), 4326))`,
    lng, lat);
  // returns the matching zone { zoneId, zoneName, elevationMin, elevationMax, color } or null
}
```
The same point-query pattern is publicly exposed at
`src/server/api/routers/geo/core/point-queries.ts:70-87` as `pointAt`. No
analogous `sampleTerrainAt` mutation exists yet.

**Region area today (`SubdivisionPropertyForm.tsx:62-87`):**
```tsx
<div className="grid grid-cols-2 gap-2">
  <div>
    <label className={labelClasses}>Population</label>
    <input type="number" placeholder="0" value={form.population ?? ""}
      onChange={(e) => onChange({ ...form,
        population: e.target.value ? parseInt(e.target.value, 10) : undefined })}
      className={inputClasses} />
  </div>
  <div>
    <label className={labelClasses}>Area (km²)</label>
    <input type="number" placeholder="0" value={form.areaSqKm ?? ""}
      onChange={(e) => onChange({ ...form,
        areaSqKm: e.target.value ? parseFloat(e.target.value) : undefined })}
      className={inputClasses} />
  </div>
</div>
```

**`upsertSubdivision` today (`src/lib/country-geo-service.ts`):** receives
`areaSqKm` in the input but never recomputes it. Submit handler
`submitSubdivision` at `src/hooks/useMapEditor.ts:1123-1139` passes
`areaSqKm: subdivisionForm.areaSqKm` through, but if the user leaves the
field blank, the column stays null. After `commitProvinceImport`
(`src/server/api/routers/geo/admin/provinces.ts:267-358`) runs, every
imported subdivision has `areaSqKm = null` because the importer doesn't
compute it.

**Area helper (`src/lib/geo-math.ts:157-181`):**
```ts
export function geometryAreaSqKm(geometry: { type: string; coordinates: ... }): number {
  if (geometry.type === "Polygon") {
    const coords = geometry.coordinates as [number, number][][];
    let area = ringAreaSqKm(coords[0]!);
    for (let i = 1; i < coords.length; i++) area -= ringAreaSqKm(coords[i]!);
    return Math.abs(area);
  }
  // MultiPolygon: same pattern.
  return 0;
}
```
Pure, framework-free, no new deps. Used elsewhere as the canonical area
helper.

### Conventions to follow

- **Form fields** are `React.memo`-wrapped, controlled, single-state-per-field
  (no `react-hook-form` / Zod resolver in the editor). The pattern is
  `useState` + per-input `onChange`; form state is owned by the parent
  (`useMapEditor.ts`) and passed down via `form` + `onChange` props.
- **`inputClasses` / `selectClasses`** are shared Tailwind-v4 strings
  declared at the top of each form file. Match the existing strings
  exactly.
- **tRPC mutations** are wrapped in `standardMutationCountryOwnerProcedure`
  (auto-checks country ownership). Side effects invalidate via
  `invalidateCache(["geoCore.getAllMapFeatures"])` +
  `broadcastMapUpdate("city", countryId)`.
- **Errors** are surfaced via `throw new TRPCError({ code, message })`; the
  client surfaces them via the mutation hook's `error` field.
- **The auto-derive UI pattern** is: the existing manual `<input>` stays
  (preserves the override), and an "Auto" button next to it runs a query /
  calls the helper and fills the value. Match the visual treatment of the
  existing inline icons (e.g., the `Magnet` icon and refresh-style buttons
  in the same forms).
- **No new dependencies.** All helpers exist. No new tRPC files; this plan
  adds one new mutation to an existing router.

## Commands you will need

| Purpose            | Command                                                                       | Expected on success |
|--------------------|-------------------------------------------------------------------------------|---------------------|
| Typecheck server   | `bun run typecheck:server`                                                    | exit 0              |
| Typecheck form     | `bun run typecheck:file src/components/maps/editor/properties/CityPropertyForm.tsx` (or `tsc -p tsconfig.ui.json` if the file uses JSX) | exit 0 (or 0 errors in scope) |
| Typecheck helper   | `bun run typecheck:file src/lib/base-layer-query.ts`                          | exit 0              |
| Lint               | `bun run lint`                                                                | exit 0 (no new errors in in-scope files) |
| Test               | `bun run test`                                                                | all pass (no regressions) |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build`. If
`bun run typecheck:file` errors on the `~/*` alias (a known script
limitation), fall back to `tsc -p tsconfig.ui.json --noEmit` (or
`tsconfig.server.json` for the server file) and grep for in-scope files.

## Scope

**In scope** (the only files you may modify):
- `src/components/maps/editor/properties/CityPropertyForm.tsx` — add "Auto"
  button next to the elevation input; call the new tRPC endpoint and fill
  the form value
- `src/components/maps/editor/properties/SubdivisionPropertyForm.tsx` — add
  "Auto" button next to the area input; call the new server helper (via a
  small tRPC query) and fill the form value
- `src/server/api/routers/countryGeo.ts` — add `sampleTerrainAt` query
  (returns `{ zoneId, zoneName, elevationMin, elevationMax, midpoint }` for
  a lng/lat)
- `src/server/api/routers/geo/admin/provinces.ts` — add `sampleAreaSqKm`
  query (returns the km² area of a GeoJSON Polygon/MultiPolygon) OR add a
  small helper mutation alongside; see Step 3
- `src/lib/country-geo-service.ts` — in `upsertCity` create + update
  payloads, include `elevation` (read from input, fall back to
  `sampleTerrainAt` at the picked coordinates if not provided); in
  `upsertSubdivision` create + update payloads, compute and include
  `areaSqKm` from the saved geometry
- `src/hooks/useMapEditor.ts` — include `elevation` in the city submit
  payload; the subdivision submit is unchanged because area is computed
  server-side now
- `src/components/maps/editor/components/MapEditorWelcomeModal.tsx` — **NOT
  in scope** for this plan (the changelog is updated in Plan 055). Do not
  edit the changelog here even though the user is touching the city
  creator; the changelog entry is the final step.

**Out of scope (do NOT touch):**
- The province importer (`src/components/maps/editor/province-importer/`,
  `src/hooks/useProvinceImporter.ts`, `src/server/api/routers/geo/admin/provinces.ts`
  beyond adding the new `sampleAreaSqKm` query next to it). Do not change
  `commitProvinceImport` to populate `areaSqKm` retroactively — that
  would be a separate "backfill imported subdivision areas" plan.
- The `CountryGeoProfile.meanElevation` field
  (`prisma/schema/maps.prisma:462`) — the city elevation is a point
  sample, not a country-level aggregate.
- The `City` model's `worldId` — confirmed missing by recon; not in scope
  to add (it would be a different plan).
- The wiki-infobox elevation import path in `countryGeo.ts:448` — leave
  as-is; it'll start working once `upsertCity` includes `elevation`.
- The `EditorHeader` settings popover and the changelog modal
  (Plan 054 / 055 are separate plans).
- The snap, network view, and other Plan 049/051/052 toolbar work.

## Git workflow

- Branch: `advisor/053-auto-derive-city-region-fields` off `v2` (current
  HEAD `098a44bc`). Conventional commit, e.g.
  `feat(maps): auto-derive city elevation and region area`.
- Do NOT push or open a PR unless asked.

## Steps

### Step 1: Add a `sampleTerrainAt` query to the countryGeo router

In `src/server/api/routers/countryGeo.ts`, add a new public query after the
existing `pointAt` (or after `getCountryGeoBundle` — match the file's
existing section comments). Use the cached public procedure pattern
(`cachedPublicProcedure` from `~/server/api/trpc`) so the result is shared
across editor tabs.

```ts
/**
 * Sample the terrain-zone elevation band at a (lng, lat) point.
 * Returns the matching altitudes-layer zone { zoneId, zoneName,
 * elevationMin, elevationMax, color, midpoint } or null if the point is
 * outside any zone (e.g., over the ocean for a country whose altitudes
 * layer is land-only). The `midpoint` is the deterministic value to use
 * as the city's "elevation" — it's `(elevationMin + elevationMax) / 2`,
 * rounded to the nearest integer, matching the convention already used
 * by `src/lib/map-pipeline.ts:186`.
 */
sampleTerrainAt: cachedPublicProcedure
  .input(z.object({ lng: z.number(), lat: z.number() }))
  .query(async ({ ctx, input }) => {
    const result = await getTerrainAtPoint(ctx.db, input.lng, input.lat);
    if (!result.elevationZone) return null;
    const { elevationMin, elevationMax, zoneId, zoneName, color } = result.elevationZone;
    const midpoint = Math.round((elevationMin + elevationMax) / 2);
    return { zoneId, zoneName, elevationMin, elevationMax, color, midpoint };
  }),
```

Add the import at the top of the file if not already present:
```ts
import { getTerrainAtPoint } from "~/lib/base-layer-query";
```

**Verify**:
- `grep -c "sampleTerrainAt" src/server/api/routers/countryGeo.ts` → `≥ 2` (1 export + 1 in the procedure name; possibly 3+ with the JSDoc/import)
- `bun run typecheck:server` → exit 0

### Step 2: Add a `sampleAreaSqKm` query to the geo/admin/provinces router

In `src/server/api/routers/geo/admin/provinces.ts`, add a new public query
anywhere alongside the other queries (the file is the province-importer
companion; this query is the analogous "preview before commit" helper for
a future city importer and for the subdivision form's auto button). Use
`cachedPublicProcedure`:

```ts
/**
 * Compute the area of a GeoJSON Polygon or MultiPolygon in km².
 * Pure calculation, no DB writes. Returns 0 for unsupported geometry
 * types (Point, LineString, etc.) — callers should validate geometry
 * type before calling.
 */
sampleAreaSqKm: cachedPublicProcedure
  .input(z.object({
    geometry: z.object({ type: z.string(), coordinates: z.any() }),
  }))
  .query(async ({ input }) => {
    return geometryAreaSqKm(input.geometry as Parameters<typeof geometryAreaSqKm>[0]);
  }),
```

Add the import at the top of the file if not already present:
```ts
import { geometryAreaSqKm } from "~/lib/geo-math";
```

The router file is in `src/server/api/routers/geo/admin/` so it's already
imported in the `geo` admin subtree (Plan 052 didn't touch this file but
its typecheck:server pass should still work).

**Verify**:
- `grep -c "sampleAreaSqKm" src/server/api/routers/geo/admin/provinces.ts` → `≥ 2`
- `bun run typecheck:server` → exit 0

### Step 3: Add `elevation` to `upsertCity` create + update payloads

In `src/lib/country-geo-service.ts`, in the `upsertCity` function
(currently lines 415-559), add `elevation` to the create and update
`data` payloads. The function takes a single `input` argument that already
includes `elevation` (the wiki-infobox path already passes it — reconfirmed
by `countryGeo.ts:448`). The change is purely additive on the create +
update branches.

For the **create branch** (around line 502-522), the data object is
something like:
```ts
data: {
  id: randomUUID(),
  worldId: ..., countryId, name, type, coordinates, population,
  foundedYear, isNationalCapital, isRegionalCapital, subdivisionId,
  elevation: input.elevation,  // ADD THIS LINE (will be `undefined` if not provided → null on insert)
}
```

For the **update branch** (around line 457-476), only set the field if
explicitly provided (preserves the "leave it alone" semantics for partial
updates):
```ts
data: {
  // ... existing fields ...
  ...(input.elevation !== undefined && { elevation: input.elevation }),
}
```

The input type for `upsertCity` is in this file (or imported from a sibling).
If the input type does NOT yet include `elevation`, add it:
```ts
// In the input type (look for an interface or Zod schema near the function)
elevation: z.number().int().min(-500).max(9000).optional(),
```

Read the file's existing input-type pattern (some functions use Zod, some
use TypeScript types) and match it.

**Verify**:
- `grep -c "elevation: input.elevation" src/lib/country-geo-service.ts` → `≥ 1` (at least the create branch)
- `bun run typecheck:server` → exit 0

### Step 4: Auto-derive `areaSqKm` in `upsertSubdivision`

In `src/lib/country-geo-service.ts`, in the `upsertSubdivision` function
(call site at `src/server/api/routers/countryGeo.ts:172`; service
function definition is in `country-geo-service.ts`), add an auto-derive
for `areaSqKm` whenever a geometry is being saved.

Two cases to handle:
1. **Caller provided an explicit `areaSqKm`** — use it (the user's manual
   override).
2. **Caller didn't provide one** — compute from the geometry using
   `geometryAreaSqKm`. For create: the geometry is in `input.geometry`. For
   update: the geometry is in `input.geometry` if provided, or the existing
   geometry (the function re-reads the row before update — look for the
   existing pattern).

Pseudo-code for the create branch:
```ts
import { geometryAreaSqKm } from "~/lib/geo-math";
// ...
const areaSqKm = input.areaSqKm ?? (input.geometry ? geometryAreaSqKm(input.geometry) : undefined);
data: {
  // ... existing fields ...
  areaSqKm,
}
```

For the update branch, if the caller omits both `areaSqKm` and `geometry`,
preserve the existing `areaSqKm` (no change). If they pass a new geometry,
re-derive. Match the file's existing update-merge style.

**Verify**:
- `grep -c "geometryAreaSqKm" src/lib/country-geo-service.ts` → `≥ 1` (at least one new use)
- `bun run typecheck:server` → exit 0

### Step 5: Add the "Auto" button to `CityPropertyForm`

In `src/components/maps/editor/properties/CityPropertyForm.tsx`:

1. Add a tRPC query hook inside the component body:
   ```tsx
   const sampleTerrain = api.countryGeo.sampleTerrainAt.useQuery(
     { lng: form.coordinates?.lng ?? 0, lat: form.coordinates?.lat ?? 0 },
     { enabled: !!form.coordinates?.lng && !!form.coordinates?.lat },
   );
   ```
2. Replace the elevation `<input>` block (lines 108-120) with the manual
   input + an "Auto" button next to it. Match the visual treatment of the
   `Magnet` and other inline buttons in this file (h-7, gap-1, `text-[10px]`).
   When clicked, the button calls `onChange({ ...form, elevation:
   sampleTerrain.data?.midpoint ?? form.elevation })`. Show a small
   spinner while `sampleTerrain.isFetching`. Show a "zone: <zoneName>"
   tooltip on the button when data is available.
3. When the form is opened or the coordinates change, the query auto-runs
   (the `enabled` flag handles "no coords yet"). When the user changes
   coordinates via the `MapPickerModal`, the new coords trigger a new
   query, and the result is available for the button (not auto-filled — the
   user clicks the button to confirm).
4. Make the elevation field **read-only when the Auto button has populated
   it** and "from zone: <zoneName>" is shown next to the label, so the
   user knows where the value came from. (The user can still click the
   button again to re-derive, or clear the field and type manually.)

   This is a small UX touch. The simplest implementation: add a derived
   boolean `const derivedFromZone = form.elevation === sampleTerrain.data?.midpoint` (compared at render time, not stored in form state) and use it to set `readOnly={derivedFromZone && sampleTerrain.data}` on the input.

**Verify**:
- `grep -c "sampleTerrainAt" src/components/maps/editor/properties/CityPropertyForm.tsx` → `≥ 1`
- `bun run typecheck:file src/components/maps/editor/properties/CityPropertyForm.tsx` (or `tsc -p tsconfig.ui.json`) → exit 0 (or 0 errors in scope)

### Step 6: Add the "Auto from geometry" button to `SubdivisionPropertyForm`

In `src/components/maps/editor/properties/SubdivisionPropertyForm.tsx`:

1. Add a tRPC query hook inside the component body:
   ```tsx
   const sampleArea = api.geoAdmin.sampleAreaSqKm.useQuery(
     { geometry: form.geometry ?? { type: "Polygon", coordinates: [[]] } },
     { enabled: !!form.geometry && form.geometry.type !== "Point" },
   );
   ```
   The disabled-when-no-geometry case matches the existing form's behavior
   (the form is only shown when a geometry is being drawn).
2. Replace the area `<input>` block (lines 75-86) with the manual input +
   an "Auto from geometry" button. When clicked, set
   `onChange({ ...form, areaSqKm: sampleArea.data ?? form.areaSqKm })`.
   Show the computed value as a small helper text below the input
   ("≈ 12,345 km² from geometry" — formatted with `toLocaleString()` and
   one decimal).
3. The button is enabled as long as `sampleArea.data !== undefined`. The
   "from geometry" hint disappears once the user types a different value.

**Verify**:
- `grep -c "sampleAreaSqKm" src/components/maps/editor/properties/SubdivisionPropertyForm.tsx` → `≥ 1`
- `bun run typecheck:file` (or `tsc -p tsconfig.ui.json`) → exit 0

### Step 7: Wire `elevation` through `useMapEditor.submitCity`

In `src/hooks/useMapEditor.ts`, in the `submitCity` function
(currently lines 1101-1121), make sure the form's `elevation` is included
in the payload sent to `api.countryGeo.upsertCity.useMutation()`. The
recon says the field is currently NOT in the payload — find the existing
`createRoute`/`updateRoute` style and add `elevation: form.elevation` to
the city payload (both create and update paths if the form supports edit).

If the form's data type (`CityFormData` or similar) does not yet include
`elevation`, add it as `elevation?: number`. Then plumb it through the
mutation input.

**Verify**:
- `grep -c "elevation" src/hooks/useMapEditor.ts` → `≥ 3` (form state type, payload creation, mutation call)
- `bun run typecheck:file src/hooks/useMapEditor.ts` (or `tsc -p tsconfig.ui.json`) → exit 0

### Step 8: Full test + lint gate

**Verify**:
- `bun run test` → all pass (no regressions; no new tests written — this
  plan is form/UX behavior, not unit-testable logic. The underlying
  helpers `getTerrainAtPoint` and `geometryAreaSqKm` already have
  coverage from earlier plans.)
- `bun run lint` → exit 0 (no new errors in the in-scope files; the
  unused-imports check should pass)
- `bun run typecheck:server` → exit 0
- `tsc -p tsconfig.ui.json --noEmit` → 0 errors in the in-scope files

## Test plan

No new unit tests (this plan is form/UX plumbing on top of already-tested
helpers). The underlying helpers `getTerrainAtPoint` (`base-layer-query.ts`)
and `geometryAreaSqKm` (`geo-math.ts:157`) are already exercised by existing
tests. Manual visual check (non-blocking):

- Manual (do if a dev server is available): `bun run dev`, open `/maps`,
  enter the editor for a country. Click "Add City" (or whatever the
  create-city entry point is), pick a coordinate on the map. Confirm:
  - The "Elevation (m)" field shows an "Auto" button next to it.
  - Clicking "Auto" populates the field with a value and shows a small
    "from zone: <name>" hint.
  - The value clears if the user types a different number; the "from zone"
    hint disappears.
- Repeat for region: click "Add Subdivision", draw a polygon. Confirm:
  - The "Area (km²)" field shows an "Auto from geometry" button.
  - Clicking it fills the field with a value like "≈ 12,345.6 km²".
  - The value clears if the user types a different number.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck:server` exits 0
- [ ] `bun run lint` exits 0 with no new errors in the in-scope files
- [ ] `bun run test` → all suites pass (no regressions)
- [ ] `grep -c "sampleTerrainAt" src/server/api/routers/countryGeo.ts` → `≥ 2` (export + procedure name)
- [ ] `grep -c "sampleAreaSqKm" src/server/api/routers/geo/admin/provinces.ts` → `≥ 2` (export + procedure name)
- [ ] `grep -c "elevation: input.elevation" src/lib/country-geo-service.ts` → `≥ 1` (create branch)
- [ ] `grep -c "geometryAreaSqKm" src/lib/country-geo-service.ts` → `≥ 1` (auto-derive in upsertSubdivision)
- [ ] `grep -c "sampleTerrainAt" src/components/maps/editor/properties/CityPropertyForm.tsx` → `≥ 1` (UI hook)
- [ ] `grep -c "sampleAreaSqKm" src/components/maps/editor/properties/SubdivisionPropertyForm.tsx` → `≥ 1` (UI hook)
- [ ] `git status --porcelain` shows only the in-scope files modified
- [ ] `plans/README.md` status row for 053 updated (SKIP — reviewer maintains the index)

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift) — especially
  if the line numbers for the elevation/area inputs or the
  `upsertCity`/`upsertSubdivision` payloads have shifted.
- `getTerrainAtPoint` is not exported from `src/lib/base-layer-query.ts`
  (check with `grep -n "^export.*getTerrainAtPoint" src/lib/base-layer-query.ts`).
- `geometryAreaSqKm` is not exported from `src/lib/geo-math.ts` (check
  with `grep -n "export function geometryAreaSqKm" src/lib/geo-math.ts`).
- `cachedPublicProcedure` is not exported from `~/server/api/trpc` (check
  the imports in `countryGeo.ts` and `geo/admin/provinces.ts`).
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- **Why midpoint, not min or max.** The terrain data is a **band**
  (e.g., 100-349m), not an exact point value. Using min would under-report
  for any point in the upper half of the band; max would over-report for
  the lower half. Midpoint is the unbiased choice and matches the existing
  convention in `src/lib/map-pipeline.ts:186`. If a future plan adopts
  real raster SRTM data, this code path would still work — just with a
  tighter band (or an exact value) instead of the coarse zone.
- **Why a button, not auto-fill.** Auto-fill would surprise the user
  (their typed value would silently change to a derived value when the
  query result arrives). A button keeps the user's manual entry as the
  source of truth until they explicitly opt in. The user can still click
  the button to re-derive at any time.
- **City elevation's existing wiki-infobox import path.** Once `upsertCity`
  passes `elevation` through, the wiki-infobox auto-import at
  `countryGeo.ts:448` will start populating the field automatically. The
  form's "Auto" button is the manual fallback when there's no wiki
  infobox. No conflict.
- **Why compute `areaSqKm` server-side, not client-side.** The subdivision
  form sends a full geometry to the server anyway. Computing area on the
  client would require importing `geometryAreaSqKm` into a client
  component (it's currently a server-friendly pure function but also
  client-safe). Computing server-side keeps the single source of truth
  in `country-geo-service.ts` and means the importer
  (`commitProvinceImport`) can adopt the same auto-derive in a future
  backfill plan without changing client code. The form's "Auto" button
  uses a *query* (sample) for the preview, but the authoritative write
  path is server-side.
- **What "Auto" doesn't do.** It does NOT auto-fill the form on
  coordinate change. The user must click. This is by design — the user
  might be picking the coordinate iteratively and doesn't want the
  field to change underneath them. The query is *enabled* on coordinate
  change so the data is ready when they click.
- **The subdivision "from geometry" text** formats with `toLocaleString()`
  to handle thousand-separator formatting consistently across locales.
  Match the existing `simplifyAll` results alert in `EditorHeader.tsx` for
  consistency.
- **A future follow-up (NOT in this plan):** add `commitProvinceImport` to
  populate `areaSqKm` for the existing imported subdivisions (a one-line
  call to `geometryAreaSqKm` per imported province). Easy follow-up.
