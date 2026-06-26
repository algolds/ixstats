# Plan 054: Bulk City Map Importer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report — do not
> improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 098a44bc..HEAD -- src/hooks/useMapEditor.ts src/components/maps/editor/MapEditorToolbar.tsx src/components/maps/editor/components/PropertiesPanelContent.tsx src/server/api/routers/geo/admin/provinces.ts src/server/api/root.ts src/components/maps/editor/province-importer/ProvinceImportWizard.tsx`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2 (bulk creation of cities from a spreadsheet — common worldbuilding workflow)
- **Effort**: M (1 new router, 1 hook, 3–4 UI components, 1 parser lib, 1 toolbar entry, 1 mode wire-up)
- **Risk**: LOW–MEDIUM (additive: new editor mode + router; no mutation changes to existing city code)
- **Depends on**: none (does not require Plan 053; the importer can pass `elevation` explicitly and it will start working automatically once 053 lands)
- **Category**: feature
- **Planned at**: commit `098a44bc`, 2026-06-16
- **Issue**: (none)

## Why this matters

The editor only allows creating cities one at a time (click map → type name →
submit). Worldbuilders frequently have a spreadsheet of dozens of cities with
name, lat, lng, population, etc. The province importer already proves the
pattern: upload a file, preview, validate, commit. This plan adds the same
workflow for **city point features**.

## Current state

**City creation today** is single-point:
- Toolbar tool `add-city` (`MapEditorToolbar.tsx:51`) switches `useMapEditor`
  into city-placing mode.
- `PropertiesPanelContent.tsx:113-146` renders `FeaturePropertyPanel` whenever
  `editor.mode !== "view"`.
- `FeaturePropertyPanel` shows `CityPropertyForm` for `add-city` / `edit-city`.
- `submitCity` in `useMapEditor.ts:1101-1121` calls `api.countryGeo.upsertCity`.

**Existing import pattern** (province importer):
- Client: `src/hooks/useProvinceImporter.ts` + `src/components/maps/editor/province-importer/`.
- Server: `src/server/api/routers/geo/admin/provinces.ts` has
  `parseProvinceUpload` / `validateProvinceImport` / `commitProvinceImport`.
- The `geoAdmin` subtree is registered in `src/server/api/root.ts` under the
  `geoAdmin` router.

**Relevant packages:** `papaparse` is already a dependency (`package.json:223`)
and used by `src/lib/export-utils.ts:1`. You may use `Papa.parse` on the client
for CSV/TSV parsing.

**No existing city import code** — this plan creates it from scratch.

## Conventions to follow

- **Editor modes** are string literals in the `EditorMode` union in
  `src/hooks/useMapEditor.ts`. Add `import-cities` there.
- **Toolbar tools** are declared in `MapEditorToolbar.tsx` `TOOLS` array with
  `mode`, `icon`, `label`, `shortcut`, `group`. Add to group 2 (Import) after
  the province import entry (which this plan also adds).
- **tRPC mutations** for country-owner data use
  `standardMutationCountryOwnerProcedure`; queries use
  `countryOwnerProcedure`.
- **TRPC routers** are registered in `src/server/api/root.ts` under the
  `geoAdmin` namespace. Use `mergeRouters` if needed (see existing `geoAdmin`
  router).
- **Client state** for a wizard lives in a dedicated hook under `src/hooks/`.
- **Wizard UI** components live under
  `src/components/maps/editor/city-importer/`.
- **Form styling** matches the editor: `bg-card`, `border-border`,
  `text-muted-foreground`, `text-xs` labels, `rounded-lg`, `space-y-2`.
- **Icons** use `lucide-react`.
- **No new dependencies.** `papaparse` is already installed.

## Commands you will need

| Purpose            | Command                                                                       | Expected on success |
|--------------------|-------------------------------------------------------------------------------|---------------------|
| Typecheck server   | `bun run typecheck:server`                                                    | exit 0              |
| Typecheck UI       | `tsc -p tsconfig.ui.json --noEmit` (or `bun run typecheck:file <path>`)       | 0 errors in scope   |
| Lint               | `bun run lint`                                                                | exit 0 (no new errors in in-scope files) |
| Test               | `bun run test`                                                                | all pass (no regressions) |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build`. If
`bun run typecheck:file` errors on the `~/*` alias, fall back to
`tsc -p tsconfig.ui.json --noEmit` and grep for in-scope files.

## Scope

**In scope** (the only files you may create/modify):
- `src/hooks/useMapEditor.ts` — add `"import-cities"` to `EditorMode`; add a
  reset case if the mode switch logic has an explicit switch.
- `src/components/maps/editor/MapEditorToolbar.tsx` — add an Import group and
  an "Import Cities" tool.
- `src/components/maps/editor/components/PropertiesPanelContent.tsx` — render
  `<CityImportWizard />` when `editor.mode === "import-cities"`.
- `src/server/api/routers/geo/admin/cities.ts` — new router with two
  procedures: `validateCityImport` (query) and `commitCityImport` (mutation).
- `src/server/api/root.ts` — register `geoAdminCitiesRouter` into the `geoAdmin`
  router (or under the existing `geoAdmin` namespace).
- `src/hooks/useCityImporter.ts` — new state-machine hook.
- `src/components/maps/editor/city-importer/CityImportWizard.tsx` — wizard
  shell (Upload → Preview → Commit).
- `src/components/maps/editor/city-importer/UploadStep.tsx` — file drop + parse.
- `src/components/maps/editor/city-importer/PreviewStep.tsx` — validation list.
- `src/components/maps/editor/city-importer/index.ts` — barrel export.
- `src/lib/city-importer/parser.ts` — pure parse/validate helpers.

**Out of scope (do NOT touch):**
- The province importer files (`src/hooks/useProvinceImporter.ts`,
  `src/components/maps/editor/province-importer/*`,
  `src/server/api/routers/geo/admin/provinces.ts`). Read them for patterns
  only.
- `CityPropertyForm.tsx` / Plan 053 work. The importer passes `elevation`
  through to `upsertCity`; if 053 is merged first it will persist, otherwise
  it will be silently dropped (same as today) and 053 will pick it up.
- The map editor canvas / `MapEditorOverlay.tsx`. v1 preview is a list, not
  map markers.
- Existing `upsertCity` mutation in `countryGeo.ts`. The importer calls it
  internally.

## Git workflow

- Branch: `advisor/054-city-map-importer` off `v2` (current HEAD `098a44bc`).
- Conventional commit, e.g. `feat(maps): add bulk city importer`.
- Do NOT push or open a PR unless asked.

## File format

The importer accepts **CSV, TSV, or JSON**.

### Required fields

- `name` (string, 1–100 chars)
- `lat` or `latitude` (number, -90..90)
- `lng`, `lon`, or `longitude` (number, -180..180)

### Optional fields

- `type` or `cityType` (string; if omitted, defaults to `"city"`)
- `population` (integer, ≥ 0)
- `foundedYear` or `founded` (integer)
- `elevation` (number)
- `isNationalCapital` or `capital` (boolean-ish: `true`/`1`/`yes`)
- `isSubdivisionCapital` or `regionalCapital` (boolean-ish)
- `subdivisionId` or `regionId` (string UUID of an existing Subdivision)
- `wikiPageTitle` (string, max 200)

### JSON example

```json
[
  { "name": "Londinium", "lat": 51.5, "lng": -0.1, "population": 8000000, "type": "capital" },
  { "name": "York", "lat": 53.9, "lng": -1.1, "population": 200000, "type": "city" }
]
```

### CSV example

```csv
name,lat,lng,population,type
Londinium,51.5,-0.1,8000000,capital
York,53.9,-1.1,200000,city
```

## Steps

### Step 1: Add `import-cities` editor mode

In `src/hooks/useMapEditor.ts`:

1. Add `"import-cities"` to the `EditorMode` union (around line 33-48).
2. Search for any explicit switch/conditional on mode that resets forms or
   UI. If there is a switch that lists modes, add `"import-cities"` to it
   (or add a `default` so new modes do not break).
3. Verify: `grep '"import-cities"' src/hooks/useMapEditor.ts` returns ≥ 1 hit.

### Step 2: Add the Import Cities tool to the toolbar

In `src/components/maps/editor/MapEditorToolbar.tsx`:

1. Import `Upload` from `lucide-react` (if not already imported).
2. Add a new tool entry to `TOOLS`:
   ```ts
   { mode: "import-provinces", icon: FileUp, label: "Import Regions", shortcut: "I", group: 2 },
   { mode: "import-cities", icon: Upload, label: "Import Cities", shortcut: "U", group: 2 },
   ```
   The province import tool is already conceptually in the import group but
   may not be on the toolbar yet; add it as the first import-group entry if
   missing, then add the city importer next to it.
3. Add `"import-cities"` to `disabledTools` handling if the toolbar disables
   tools when no country is selected (it likely disables `add-city`,
   `add-subdivision`, etc.). The import tools should be disabled under the
   same condition.
4. Verify: `grep -c '"import-cities"' src/components/maps/editor/MapEditorToolbar.tsx` → ≥ 1.

### Step 3: Render the wizard when the mode is active

In `src/components/maps/editor/components/PropertiesPanelContent.tsx`:

1. Import `{ CityImportWizard } from "../city-importer"`.
2. Find the block that renders `FeaturePropertyPanel` when
   `editor.mode !== "view"` (around lines 113-146). Before that block, add
   an early return for the import mode:
   ```tsx
   if (editor.mode === "import-cities") {
     return (
       <CityImportWizard
         countryId={activeCountryId ?? ""}
         onComplete={() => editor.setMode("view")}
         onCancel={() => editor.setMode("view")}
       />
     );
   }
   ```
3. Verify: `grep -c "CityImportWizard" src/components/maps/editor/components/PropertiesPanelContent.tsx` → ≥ 1.

### Step 4: Create the city import parser library

Create `src/lib/city-importer/parser.ts` (new file). It contains pure
functions (no React, no DB). Export at minimum:

```ts
export interface RawCityRow {
  name: string;
  lat: number;
  lng: number;
  cityType?: string;
  population?: number;
  foundedYear?: number;
  elevation?: number;
  isNationalCapital?: boolean;
  isSubdivisionCapital?: boolean;
  subdivisionId?: string;
  wikiPageTitle?: string;
}

export interface ParsedCityImport {
  rows: RawCityRow[];
  errors: string[];
  warnings: string[];
}

export function parseCityImportText(text: string, fileName: string): ParsedCityImport;
```

Implementation requirements:
- Detect format from extension or content:
  - `.json` or text starting with `[` or `{` → JSON array of objects.
  - `.csv` → `Papa.parse` with `header: true`.
  - `.tsv` → `Papa.parse` with `header: true, delimiter: "\t"`.
- Normalize each row:
  - `name` = trimmed string.
  - `lat` from `lat`/`latitude`.
  - `lng` from `lng`/`lon`/`longitude`.
  - `cityType` from `type`/`cityType`.
  - `population` as integer.
  - `foundedYear` from `foundedYear`/`founded` as integer.
  - `elevation` as number.
  - `isNationalCapital` from `isNationalCapital`/`capital` as boolean
    (`true`, `1`, `yes` → true; otherwise false).
  - `isSubdivisionCapital` from `isSubdivisionCapital`/`regionalCapital`.
  - `subdivisionId` from `subdivisionId`/`regionId`.
  - `wikiPageTitle` as trimmed string.
- Validate each row and collect per-row errors:
  - missing name
  - missing/invalid lat or lng
  - lat out of [-90, 90]
  - lng out of [-180, 180]
  - invalid population / foundedYear / elevation
  - name > 100 chars
- Global checks:
  - duplicate `name` values inside the import batch → warning (not fatal;
    server will create both; the user can rename).
- Return all rows that could be parsed (even partial rows with errors) so
  the preview can show what failed and why.

No tests required in this plan.

**Verify**:
- `ls src/lib/city-importer/parser.ts` exists.
- `grep -c "export function parseCityImportText" src/lib/city-importer/parser.ts` → 1.

### Step 5: Create the `useCityImporter` hook

Create `src/hooks/useCityImporter.ts` (new file).

It should expose:

```ts
export interface CityImportState {
  step: "upload" | "preview" | "commit";
  rawText: string;
  fileName: string;
  parsed: ParsedCityImport | null;
  validated: Array<RawCityRow & { issues: string[] }> | null;
  isProcessing: boolean;
  error: string | null;
  committedCount: number;
}

export function useCityImporter(countryId: string) {
  // state + handlers
  return {
    ...state,
    setStep,
    handleFile,
    validate,
    commitImport,
    canCommit,
    reset,
  };
}
```

Behavior:
- `handleFile(file)` reads the file as text, calls `parseCityImportText`,
  sets `parsed`, then moves to `"preview"`.
- `validate()` calls the tRPC `validateCityImport` query with the parsed
  rows, stores the per-row `issues` (coordinate bounds + inside-country
  checks), and stays in `"preview"`.
- `commitImport()` calls `commitCityImport` mutation with the rows that have
  no blocking issues, then sets `committedCount` and moves to `"commit"`.
- `canCommit` is true when there is at least one row with no blocking issues.
- `reset()` returns to `"upload"`.

Use `api.geoAdmin.validateCityImport.useQuery()` for validation, enabled only
when there are parsed rows and the user is on the preview step (or call it
lazily via `useQuery` with `enabled` and a manual refetch).

**Verify**:
- `grep -c "useCityImporter" src/hooks/useCityImporter.ts` → ≥ 1.
- `grep -c "geoAdmin" src/hooks/useCityImporter.ts` → ≥ 1.

### Step 6: Create the wizard UI components

Create the directory `src/components/maps/editor/city-importer/` with:

1. `index.ts` — barrel exports.
2. `CityImportWizard.tsx` — shell with step indicator and footer nav.
   - Props: `countryId: string; onComplete?: () => void; onCancel?: () => void;`
   - Renders `UploadStep`, `PreviewStep`, or a simple commit-success panel
     based on `importer.step`.
   - Footer has Back/Next/Import buttons matching the province wizard style.
3. `UploadStep.tsx` — file drop zone using a hidden `<input type="file">`.
   - Accept `.csv,.tsv,.json`.
   - Show selected file name and a parse error summary.
   - Include a small help block listing the expected columns.
4. `PreviewStep.tsx` — scrollable list of parsed rows.
   - Each row shows: name, lat/lng, type, population, issue badges.
   - Rows with blocking issues are shown but greyed out / with a warning icon.
   - Show counts: total, valid, with warnings.
   - Add a "Validate" button that triggers `importer.validate()`.
   - Validation issues that come from the server (inside-country check) are
     merged into the row issues after validate runs.

Match styling to the province importer wizard (`bg-card`, `border-border`,
`text-xs`, `rounded-lg`, `gap-2`).

**Verify**:
- `ls src/components/maps/editor/city-importer/` shows all four files.
- `grep -c "CityImportWizard" src/components/maps/editor/city-importer/CityImportWizard.tsx` → ≥ 1.

### Step 7: Create the server router

Create `src/server/api/routers/geo/admin/cities.ts` (new file).

Use this shape:

```ts
import { z } from "zod";
import { createTRPCRouter, countryOwnerProcedure, standardMutationCountryOwnerProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

const cityImportRowSchema = z.object({
  name: z.string().min(1).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  cityType: z.string().default("city"),
  population: z.number().int().min(0).optional(),
  foundedYear: z.number().int().optional(),
  elevation: z.number().optional(),
  isNationalCapital: z.boolean().default(false),
  isSubdivisionCapital: z.boolean().default(false),
  subdivisionId: z.string().optional(),
  wikiPageTitle: z.string().max(200).optional(),
});

export const geoAdminCitiesRouter = createTRPCRouter({
  validateCityImport: countryOwnerProcedure
    .input(z.object({ countryId: z.string(), cities: z.array(cityImportRowSchema) }))
    .query(async ({ ctx, input }) => {
      // 1. Fetch the country's political map layer geometry.
      // 2. For each city, check:
      //    - inside the country border (ST_Contains against geom_postgis)
      //    - name conflict with an existing city in the DB
      // 3. Return array of { ...row, issues: string[] }.
    }),

  commitCityImport: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string(), cities: z.array(cityImportRowSchema) }))
    .mutation(async ({ ctx, input }) => {
      // 1. Re-validate inside-country using the same PostGIS query.
      // 2. In a transaction, create each city via upsertCity(ctx.db, countryId, { ... }).
      // 3. Return { created: number }.
    }),
});
```

Implementation notes:
- Import `upsertCity` from `~/lib/country-geo-service`.
- The `countryOwnerProcedure` already loads `ctx.country` and verifies
  ownership. If `ctx.country` is `null` (admin), skip the ownership check
  (follow the pattern in `provinces.ts:107`).
- For the inside-country check, use the same `ST_Contains` query as
  `validateProvinceImport` (`provinces.ts:234-241`), but against the city
  point instead of a polygon:
  ```sql
  SELECT ST_Contains(
    (SELECT geom_postgis FROM map_layers WHERE "layerType" = 'political' AND "countryId" = $1 AND geom_postgis IS NOT NULL LIMIT 1),
    ST_SetSRID(ST_MakePoint($2, $3), 4326)
  ) as is_inside
  ```
- Name conflicts: query `ctx.db.city.findMany({ where: { countryId: input.countryId, name: { in: names } } })` and attach an issue for each match.
- `commitCityImport` should re-run the inside-country check and skip cities
  that fail (defensive; do not trust client-side validation).

**Verify**:
- `grep -c "validateCityImport" src/server/api/routers/geo/admin/cities.ts` → ≥ 1.
- `grep -c "commitCityImport" src/server/api/routers/geo/admin/cities.ts` → ≥ 1.
- `grep -c "upsertCity" src/server/api/routers/geo/admin/cities.ts` → ≥ 1.

### Step 8: Register the new router

In `src/server/api/root.ts`, find the `geoAdmin` router definition. If it is
a `createTRPCRouter` with inline procedures, import and merge:

```ts
import { geoAdminCitiesRouter } from "./routers/geo/admin/cities";

export const appRouter = createTRPCRouter({
  // ... existing routers ...
  geoAdmin: mergeRouters(geoAdminRouter, geoAdminCitiesRouter),
  // ...
});
```

If `geoAdmin` is already assembled from sub-routers in the same file, add
`geoAdminCitiesRouter` alongside them.

**Verify**:
- `grep -c "geoAdminCitiesRouter" src/server/api/root.ts` → ≥ 1.
- `bun run typecheck:server` → exit 0.

### Step 9: Full test + lint gate

**Verify**:
- `bun run test` → all pass (no regressions).
- `bun run lint` → exit 0 (no new errors in in-scope files).
- `bun run typecheck:server` → exit 0.
- `tsc -p tsconfig.ui.json --noEmit` → 0 errors in scope (or grep the output
  for the in-scope files and confirm none are listed).

## Test plan

Manual checks (non-blocking; run if a dev server is available):

1. Open the map editor for a country.
2. Click the new "Import Cities" toolbar tool (shortcut `U`).
3. Upload a CSV with 3 cities:
   - One inside the country.
   - One outside the country.
   - One with a missing `name`.
4. In the Preview step, confirm:
   - Valid city shows no issues.
   - Outside-city shows "outside country borders".
   - Missing-name row shows "name required".
5. Click Import Cities.
6. Confirm the valid city appears in the editor and the count is correct.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck:server` exits 0
- [ ] `bun run lint` exits 0 with no new errors in the in-scope files
- [ ] `bun run test` → all suites pass (no regressions)
- [ ] `grep '"import-cities"' src/hooks/useMapEditor.ts` returns ≥ 1 hit
- [ ] `grep -c '"import-cities"' src/components/maps/editor/MapEditorToolbar.tsx` → ≥ 1
- [ ] `grep -c "CityImportWizard" src/components/maps/editor/components/PropertiesPanelContent.tsx` → ≥ 1
- [ ] `grep -c "export function parseCityImportText" src/lib/city-importer/parser.ts` → 1
- [ ] `grep -c "useCityImporter" src/hooks/useCityImporter.ts` → ≥ 1
- [ ] `grep -c "validateCityImport" src/server/api/routers/geo/admin/cities.ts` → ≥ 1
- [ ] `grep -c "commitCityImport" src/server/api/routers/geo/admin/cities.ts` → ≥ 1
- [ ] `grep -c "upsertCity" src/server/api/routers/geo/admin/cities.ts` → ≥ 1
- [ ] `grep -c "geoAdminCitiesRouter" src/server/api/root.ts` → ≥ 1
- [ ] `git status --porcelain` shows only the in-scope files modified + new files
- [ ] `plans/README.md` status row for 054 updated (SKIP — reviewer maintains the index)

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift).
- `papaparse` is not in `package.json` dependencies.
- `standardMutationCountryOwnerProcedure` or `countryOwnerProcedure` are not
  exported from `~/server/api/trpc`.
- `upsertCity` is not exported from `~/lib/country-geo-service`.
- A verification command fails twice after a reasonable fix attempt.
- You find yourself needing to create more than ~10 files or refactor the
  province importer — this plan is intentionally narrow; report the scope
  creep instead of pushing forward.

## Maintenance notes

- **Why not map-marker preview in v1.** Rendering pending cities on the
  MapLibre canvas would require changes to `MapEditorOverlay.tsx` and a new
  transient source/layer. The list preview is enough to ship the core workflow;
  map markers are a natural follow-up.
- **Why a separate `geo/admin/cities.ts` router.** The province importer is
  already large (`provinces.ts` 400+ lines). Cities are a different feature
  with different validation (point-in-country vs polygon containment) and a
  different commit path (`upsertCity` vs `subdivision.create`). Keeping them
  separate keeps each router under the 700-line ceiling.
- **Elevation pass-through.** The importer passes `elevation` to `upsertCity`.
  If Plan 053 has already merged, the column will be persisted; if not, it
  will be silently dropped (same behavior as today). Plan 053 will wire the
  column without needing to touch the importer.
- **JSON/CSV/TSV only.** Excel (.xlsx) is intentionally out of scope; users
  can export CSV from any spreadsheet app. If Excel support is needed later,
  it is a small additive change in `parser.ts` using `xlsx` (currently not a
  dependency).
- **Name collisions are warnings, not blockers.** This matches the province
  importer philosophy: show the user what will happen and let them decide.
  The server-side duplicate-name check within a batch is also a warning, but
  the `commitCityImport` re-validation will skip duplicates that already exist
  in the DB.
