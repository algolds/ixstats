# Plan 084: Resolve Province/City Importer Save Failures and Duplicate Records

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: 
> `git diff --stat add9bdee..HEAD -- src/lib/geo-validation.ts src/lib/country-geo-service.ts src/server/api/routers/geo/admin/cities.ts src/server/api/routers/geo/admin/provinces.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MEDIUM
- **Depends on**: none
- **Category**: bug / database (PostGIS)
- **Planned at**: commit `add9bdee`, 2026-06-18

## Why this matters

1. **City Duplication Bug**: During province or bulk city imports, cities do not come with database `id`s. As a result, `upsertCity` defaults to performing a Prisma `create` call. Repeating the import duplicates all cities. We need to match existing cities by name case-insensitively within the same country and update them instead.
2. **Containment Validation Failure**: When cities or subdivision geometries lie exactly on or share country boundaries, PostGIS `ST_Contains` returns `false` (since boundary containment is not strictly interior). This causes validation to fail and aborts the database transactions. Replacing `ST_Contains` with `ST_Covers` resolves this.

## Current state

- `src/lib/geo-validation.ts`:
  - `validatePointContainment` (L103) uses `ST_Contains`.
  - `validatePolygonContainment` (L153) uses `ST_Contains`.
  - `snapPointToCountryBorder` (L585 and L686) uses `ST_Contains`.
- `src/lib/country-geo-service.ts`:
  - `upsertCity` (L417) handles upserting but defaults to creating a new record if `data.id` is not specified.
  - `findSubdivisionAtPoint` (L1065) uses `ST_Contains`.
  - `updateCitySpatialProfile` (L1259) uses `ST_Contains` to check dominant climate zones.
- `src/server/api/routers/geo/admin/cities.ts`:
  - `validateCityRow` (L48) uses `ST_Contains`.
  - `commitCityImport` (L157) uses `ST_Contains`.
- `src/server/api/routers/geo/admin/provinces.ts`:
  - `validateProvinceImport` (L251) uses `ST_Contains`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Test      | `bun run test`           | exit 0, all 690 pass|
| Lint      | `bun run lint`           | exit 0, no errors   |

## Scope

**In scope:**
- `src/lib/geo-validation.ts`
- `src/lib/country-geo-service.ts`
- `src/server/api/routers/geo/admin/cities.ts`
- `src/server/api/routers/geo/admin/provinces.ts`

**Out of scope:**
- Modifying maps overlay drawing tools or UI styles.
- Changing coordinates projection systems.

## Git workflow

- Branch: `advisor/084-province-city-importer-fix`
- Commit: `fix(geo): use ST_Covers for boundary containment and merge cities by name`

## Steps

### Step 1: Update geo-validation.ts to use ST_Covers
In `src/lib/geo-validation.ts`:
1. In `validatePointContainment` (around L103), replace `ST_Contains` with `ST_Covers`.
2. In `validatePolygonContainment` (around L153), replace `ST_Contains` with `ST_Covers`.
3. In `snapPointToCountryBorder` (around L585 and L686), replace `ST_Contains` with `ST_Covers`.

**Verify**: No syntax/TypeScript errors in `src/lib/geo-validation.ts`.

### Step 2: Implement city merge by name in upsertCity
In `src/lib/country-geo-service.ts` inside `upsertCity`:
1. Before checking `const isNew = !data.id;`, add name matching logic:
   ```typescript
   if (!data.id && data.name) {
     const matchedCity = await db.city.findFirst({
       where: {
         countryId,
         name: {
           equals: data.name.trim(),
           mode: "insensitive",
         },
       },
       select: { id: true },
     });
     if (matchedCity) {
       data.id = matchedCity.id;
     }
   }
   ```
2. In `findSubdivisionAtPoint` (around L1065), replace `ST_Contains` with `ST_Covers`.
3. In `updateCitySpatialProfile` (around L1259), replace `ST_Contains` with `ST_Covers`.

**Verify**: No compile errors.

### Step 3: Update containment checks in geo admin routers
1. In `src/server/api/routers/geo/admin/cities.ts`:
   - In `validateCityRow` (around L48), replace `ST_Contains` with `ST_Covers`.
   - In `commitCityImport` (around L157), replace `ST_Contains` with `ST_Covers`.
2. In `src/server/api/routers/geo/admin/provinces.ts`:
   - In `validateProvinceImport` (around L251), replace `ST_Contains` with `ST_Covers`.

**Verify**: `bun run lint` passes with no errors.

## Test plan

- Run `bun run test` to verify all existing tests still pass.
- Run a manual province import in a development/test country containing duplicate city names and border-snapped coordinates.
  - Verify that no containment errors are raised.
  - Verify that cities are saved successfully.
  - Import the same file again and verify that no duplicate city records are created in the database.
