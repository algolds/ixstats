# Plan 056: SVG city import with province-correspondence auto-alignment

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report — do not
> improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat e3279d47..HEAD -- src/hooks/useCityImporter.ts src/components/maps/editor/city-importer/ src/lib/city-importer/parser.ts src/server/api/routers/geo/admin/cities.ts src/lib/province-importer/alignment.ts src/lib/province-importer/svg-element-converter.ts src/lib/province-importer/svg-layer-detector.ts src/lib/province-importer/svg-text-matcher.ts`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2 (high-value worldbuilding workflow — bulk-importing hundreds of cities from an existing master SVG)
- **Effort**: L (1 server parse lib + 1 server procedure + 1 client align lib + hook extension + UploadStep change + 1 new AlignStep with map preview + capital detection)
- **Risk**: MED (additive — new SVG path alongside the existing tabular path; reuses proven province-importer machinery; the map-preview overlay is the main integration risk)
- **Depends on**: 054 (DONE — the city importer this extends) and the province-importer SVG pipeline (already shipped). No new dependencies.
- **Category**: direction (feature)
- **Planned at**: commit `e3279d47`, 2026-06-16
- **Status**: DONE (commit `12787c8c`, 2026-06-17)
- **Issue**: (none)

## Why this matters

Worldbuilders keep a **master SVG map** with province borders AND ~500 city
markers in one file. They already import the province borders via the
**province importer** (full SVG → geometry pipeline with alignment). But the
**city importer (Plan 054)** only accepts CSV / TSV / JSON — so the same 500
cities, already drawn as dots in the SVG, have to be hand-typed into a
spreadsheet. This plan lets the city importer ingest the *same* SVG, detect the
city dots + their text labels, and — with one **Auto-adjust** button — align
those dots to real lat/lng by **recovering the SVG→geographic transform from the
provinces that are already imported** (same source SVG, matched by name).
Capital cities are inferred from a distinct icon/layer. End state: drop in the
master SVG, click Auto-adjust, preview the dots landing on the country, commit.

## Current state

### What exists and is reused (do NOT modify these — call them)

**Province importer SVG pipeline** (`src/lib/province-importer/`) — **server-side
only** for DOM parsing (`@xmldom/xmldom`):

- `parse-provinces.ts:11` `import { DOMParser } from "@xmldom/xmldom";` then
  `parse-provinces.ts:58-60`:
  ```ts
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, "image/svg+xml");
  const svgRoot = doc.documentElement;
  ```
  Main export `parseProvinceSvg(...)` at `parse-provinces.ts:43`. This is the
  pattern for turning an SVG string into a DOM `Element` server-side.
- `svg-layer-detector.ts`:
  - `detectProvinceLayer(svgRoot): {...}` (line 42) — auto-detects the most
    likely shape layer.
  - `collectShapeElements(container: Element, svgRoot?: Element): Element[]`
    (line 417) — gathers `<path>/<polygon>/<polyline>/<rect>/<circle>/<ellipse>`.
  - `isDecorativeElement(el: Element): boolean` (line 456).
- `svg-element-converter.ts`:
  - `elementToRings(el: Element, bezierSegments = 8): [number, number][][]`
    (line 29) — converts ANY shape element to coordinate rings (SVG pixel space).
  - `circleToRings(el, segments=32)` (line 143), `ellipseToRings` (line 160).
  - `SHAPE_TAGS = new Set(["path","polygon","polyline","rect","circle","ellipse"])`
    (line 178).
- `svg-text-matcher.ts`:
  - `interface TextLabel` (line 16) — `{ text, x, y, ... }` a label with position.
  - `extractAllTextLabels(svgRoot: Element, stopAt?: Element): TextLabel[]`
    (line 33).
  - `matchLabelsToProvinces(...)` (line 116) — proximity match labels→shapes.
- `svg-transform.ts`:
  - `getAccumulatedTransform(el, stopAt): SvgMatrix` (line 162) — composes
    `transform` attrs + inner `viewBox` so a child element's coords map into
    the root SVG coordinate space. **Use this so coordinates are in one space.**

**Alignment math** (`src/lib/province-importer/alignment.ts`) — **pure, client-safe**
(imports only types: `alignment.ts:16-17` import only from `geojson` and
`./types`). Reuse directly on the client:

- `computeAffineFromReferencePoints(points: ReferencePoint[]): AlignmentResult`
  (line 49) — least-squares affine from **3+** point pairs.
- `applyAffineToPoint(point: Position, matrix: AffineMatrix): Position`
  (line 245):
  ```ts
  return [
    matrix.a * point[0]! + matrix.b * point[1]! + matrix.tx,
    matrix.c * point[0]! + matrix.d * point[1]! + matrix.ty,
  ];
  ```
- `autoAlignToCountryBorder(provinces: ProvinceFeature[], countryBorder: Polygon | MultiPolygon): AlignmentResult`
  (line 156) — bbox/ICP fit to the border (the fallback).

**Types** (`src/lib/province-importer/types.ts`):
- `AffineMatrix { a, b, c, d, tx, ty }` (line 77).
- `ReferencePoint { source: Position; target: Position }` (line 87).
- `AlignmentResult { matrix; rmse; matchCount; ... }` (line 96).
- `AlignmentMode = "reference-points" | "auto-align" | "manual"` (line 94).
- `ImportStep = "upload" | "names" | "align" | "snap" | "validate" | "commit"`
  (line 165) — the province importer's step union (model for the city steps).

**Province importer wizard components** (`src/components/maps/editor/province-importer/`)
— **read as the pattern, do not modify**:
- `AlignmentStep.tsx` — the align UI: an `alignmentMode` toggle
  (`reference-points` / `auto-align` / `manual`), the reference-point list with
  add/remove, and "Apply Alignment". Mirror this for cities.
- `ProvincePreviewLayer.tsx` — overlays parsed features on the editor map.
  Model the city-dot map preview on this.
- `useProvinceImporter.ts` — the state machine: `STEPS` (line 41), `step`/`setStep`
  (line 51), `alignmentMode`/`setAlignmentMode` (line 55), `referencePoints`
  (line 56), auto-align after parse (lines 79-94 call `autoAlignToCountryBorder`
  + `applyAffineToProvinces`), `applyReferencePointAlignment`, `removeReferencePoint`.
- `provinces.ts:80` server procedure `parseProvinceUpload: standardMutationCountryOwnerProcedure`
  with input `{ countryId, svgContent }` (lines 83-85). Model `parseCitySvg` on this.

**The city importer being extended** (Plan 054):
- `src/hooks/useCityImporter.ts` — `CityImportStep = "upload" | "preview" | "commit"`
  (line 19), `useCityImporter(countryId)` returns `{ step, setStep, handleFile,
  validate, commitImport, canCommit, reset, ... }`. `handleFile(file)` (line 54)
  reads the file as text, calls `parseCityImportText`, sets `parsed`, → `"preview"`.
  `commitImport()` calls `api.geoAdmin.commitCityImport`.
- `src/lib/city-importer/parser.ts` — `parseCityImportText(text, fileName): ParsedCityImport`,
  `interface RawCityRow { name; lat; lng; cityType?; population?; foundedYear?;
  elevation?; isNationalCapital?; isSubdivisionCapital?; subdivisionId?;
  wikiPageTitle?; }`, `interface ParsedCityImport { rows; errors; warnings }`.
- `src/components/maps/editor/city-importer/` — `CityImportWizard.tsx` (shell +
  STEP_CONFIG + footer nav), `UploadStep.tsx` (hidden `<input type="file">`,
  currently `accept=".csv,.tsv,.json"`), `PreviewStep.tsx`, `index.ts`.
- `src/server/api/routers/geo/admin/cities.ts` — `geoAdminCitiesRouter` with
  `validateCityImport` (query) and `commitCityImport`
  (`standardMutationCountryOwnerProcedure`). `cityImportRowSchema` includes
  `name, lat, lng, cityType, population, isNationalCapital, ...`. `commitCityImport`
  already validates each point inside the border (PostGIS `ST_Contains`) and
  creates via `upsertCity`. **The SVG path reuses `commitCityImport` unchanged**
  — once dots are aligned to lat/lng they are ordinary city rows.

**DB subdivisions for the correspondence**: `getCountryGeoBundle(db, countryId)`
(`src/lib/country-geo-service.ts`, exposed at `countryGeo.getCountryGeoBundle`)
returns `{ subdivisions, cities, ... }` where each subdivision has `name` and
`geometry` (GeoJSON). Centroids are computed from `geometry`. The existing helper
`geometryAreaSqKm` lives in `src/lib/geo-math.ts`; check that file for a centroid
helper (e.g. `polygonCentroid` / `geometryCentroid`) and reuse it — only add a
local centroid if none exists.

### Conventions to follow

- **bun** only. Conventional commits. No new dependencies (`@xmldom/xmldom`,
  `svg-path-parser`, turf are already installed).
- **Server-only SVG parsing.** Anything importing `@xmldom/xmldom` (directly or
  via `parse-provinces`/`svg-layer-detector`/`svg-element-converter`/
  `svg-text-matcher`/`svg-transform`) MUST stay server-side (in `cities.ts` or a
  lib only imported by it). NEVER import those into a `"use client"` component or
  a hook — it will break the client bundle.
- **Client alignment is pure.** `alignment.ts` and the new `align-cities.ts` are
  client-safe (math only). The hook/components import THESE, not the SVG libs.
- tRPC: queries use `countryOwnerProcedure`; mutations use
  `standardMutationCountryOwnerProcedure`. Match `cities.ts`'s existing ownership
  check pattern (`ctx.country` null = admin).
- Editor form styling: `bg-card`, `border-border`, `text-xs`, `rounded-lg`,
  `gap-2`, `lucide-react` icons.

## Commands you will need

| Purpose          | Command                                                              | Expected on success |
|------------------|---------------------------------------------------------------------|---------------------|
| Install          | `bun install`                                                       | exit 0              |
| Typecheck file   | `bun run typecheck:file <path>`                                     | 0 real errors (ignore `~/*` TS2307 alias noise + JSX TS17004/TS1259 noise on .tsx) |
| Typecheck server | `bun run typecheck:server` (if `tsconfig.server.json` present)       | exit 0              |
| Lint             | `bun run lint`                                                      | exit 0 (pre-existing warnings OK; no NEW errors in your files) |
| Test             | `bun run test`                                                      | all pass (+ your new tests) |
| Single test      | `bun run test -- src/lib/city-importer/svg-points.test.ts`          | passes              |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build` — they OOM.

## Scope

**In scope** (create/modify only these):
- `src/lib/city-importer/svg-points.ts` (NEW, **server-only**) — parse an SVG
  string into city points + svg-province centroids + layer list.
- `src/lib/city-importer/svg-points.test.ts` (NEW) — unit tests for the above.
- `src/lib/city-importer/align-cities.ts` (NEW, **client-safe**) — derive the
  affine from province correspondence + apply it to points.
- `src/lib/city-importer/align-cities.test.ts` (NEW) — unit tests for the above.
- `src/server/api/routers/geo/admin/cities.ts` — add `parseCitySvg` mutation.
- `src/hooks/useCityImporter.ts` — add the SVG branch + align state to the hook.
- `src/components/maps/editor/city-importer/UploadStep.tsx` — accept `.svg`.
- `src/components/maps/editor/city-importer/CityAlignStep.tsx` (NEW) — layer
  pick + Auto-adjust + map preview + manual/reference fallback.
- `src/components/maps/editor/city-importer/CityImportWizard.tsx` — route SVG
  uploads through the align step.
- `src/components/maps/editor/city-importer/index.ts` — export the new step if needed.

**Out of scope (do NOT touch):**
- Any `src/lib/province-importer/*` file and any
  `src/components/maps/editor/province-importer/*` file — read for patterns,
  never edit. (If you think you must edit one, STOP and report.)
- `commitCityImport` / `validateCityImport` / `cityImportRowSchema` logic in
  `cities.ts` (you ADD `parseCitySvg`; you do NOT change the commit path — the
  SVG flow produces the same lat/lng rows the tabular flow does).
- `upsertCity` in `country-geo-service.ts`.
- The tabular (CSV/TSV/JSON) path in `parser.ts` and `PreviewStep.tsx` — leave
  working; the SVG path is additive.
- The shared `/maps` map and the editor map components beyond rendering a
  preview overlay.

## Git workflow

- You are (or should be) on branch `advisor/056-city-importer-svg-alignment` in a
  worktree based on `v2` (HEAD `e3279d47`). Conventional commit, e.g.
  `feat(maps): SVG city import with province-correspondence alignment`.
- Commit per logical step is fine. Do NOT push or open a PR.

## How the pieces fit (read before Step 1)

```
UploadStep (.svg chosen)
  → server parseCitySvg(svgContent)            [SERVER: @xmldom parse]
       returns { layers[], points[], svgProvinces[] }
  → CityAlignStep                              [CLIENT]
       - pick cities layer + (optional) capital layer  → re-parse if changed
       - "Auto-adjust": deriveCityAffine(svgProvinces, dbSubdivisions)  [pure]
            match svgProvince.name ⇆ dbSubdivision.name → ReferencePoint[]
            computeAffineFromReferencePoints → matrix
       - applyCityAffine(points, matrix) → lat/lng         [pure]
       - map preview of aligned dots; manual/reference fallback
  → PreviewStep (existing): list + validateCityImport (ST_Contains)
  → commitCityImport (existing, UNCHANGED): upsertCity per row
```

Capitals: `parseCitySvg` flags a point `isCapital=true` when it comes from the
chosen capital layer (or a point whose marker symbol differs — see Step 1).
`isCapital` → `isNationalCapital` on the committed row.

## Steps

### Step 1: Server SVG → points library (`src/lib/city-importer/svg-points.ts`)

Create a **server-only** module (it imports the province SVG libs which use
`@xmldom/xmldom`). Add a top-of-file comment: `// Server-only: imports
@xmldom/xmldom via the province-importer SVG pipeline. Never import into a
client component or hook.`

Export:

```ts
export interface SvgLayerInfo {
  id: string;        // element id or a synthesized id (e.g. "layer-3")
  name: string;      // inkscape:label / id / "Layer N"
  shapeCount: number;
  textCount: number;
}

export interface SvgCityPoint {
  svgX: number;      // in root SVG coordinate space (after getAccumulatedTransform)
  svgY: number;
  name: string;      // matched text label, or "" if none
  isCapital: boolean;
}

export interface SvgProvinceRef {
  name: string;      // province label text
  svgX: number;      // province shape centroid in root SVG space
  svgY: number;
}

export interface ParsedCitySvg {
  layers: SvgLayerInfo[];
  points: SvgCityPoint[];
  svgProvinces: SvgProvinceRef[];
}

export interface ParseCitySvgOptions {
  citiesLayerId?: string;   // which layer holds the dots; auto-detect if unset
  capitalLayerId?: string;  // layer (or marker) that marks capitals; optional
}

export function parseCitySvg(svgContent: string, opts?: ParseCitySvgOptions): ParsedCitySvg;
```

Implementation:
1. Parse the SVG to a DOM exactly like `parse-provinces.ts:58-60`
   (`new DOMParser().parseFromString(svgContent, "image/svg+xml")`,
   `doc.documentElement`). Reuse the same sanitize step `parse-provinces.ts`
   uses if it exposes one; otherwise pass the raw string.
2. **Layers**: enumerate `<g>` groups (and the root) that contain shape/text
   elements; build `SvgLayerInfo[]` using `inkscape:label` or `id` for the name,
   counting `collectShapeElements` results and `extractAllTextLabels` results per
   group. (You may reuse helpers from `svg-layer-detector.ts` — import them, do
   not copy.)
3. **City points**: within the chosen `citiesLayerId` group (or the auto-detected
   best layer if unset — pick the group with the most small/point-like shapes),
   collect candidate point elements:
   - `<circle>` / `<ellipse>` → point = (cx, cy) mapped through
     `getAccumulatedTransform(el, svgRoot)`.
   - small icon groups / `<use>` / `<path>` whose bbox is tiny relative to the
     viewBox → point = centroid of `elementToRings(el)` (average of ring
     vertices), mapped through the accumulated transform.
   - if a group contains ONLY `<text>` (no dots), treat each `<text>` anchor as a
     point (name = the text). 
   Use `getAccumulatedTransform` so every point is in the same root SVG space as
   the province centroids (Step: svgProvinces).
4. **Names**: run `extractAllTextLabels(svgRoot)` and assign each point the
   nearest label within a small radius (reuse the proximity approach from
   `matchLabelsToProvinces` — if it is generic enough to call with points, call
   it; otherwise write a tiny nearest-label loop here). A point with no nearby
   label gets `name: ""`.
5. **Capitals**: a point is `isCapital` if it belongs to `capitalLayerId`, OR
   (when `capitalLayerId` is unset) if the layer/group it sits in has a name
   matching `/capital/i`, OR if its marker element references a distinct
   `<symbol>`/`<use href>` than the majority (a "distinct icon"). Implement the
   layer/name rule first; the distinct-symbol heuristic is a bonus — if it adds
   real complexity, leave `isCapital=false` for symbol-only cases and note it.
6. **svgProvinces**: detect the province layer with `detectProvinceLayer(svgRoot)`,
   `collectShapeElements` it, and for each province shape compute its centroid
   (average of `elementToRings(el)` outer ring) in root SVG space, paired with the
   nearest text label as `name`. These are the correspondence anchors.

Keep it defensive: wrap per-element conversions in try/catch and skip elements
that fail, so one malformed shape doesn't abort the parse.

**Verify**:
- `bun run typecheck:file src/lib/city-importer/svg-points.ts` → 0 real errors.
- (test added in Step 2)

### Step 2: Unit-test the SVG point extraction (`svg-points.test.ts`)

Model after an existing province-importer test if one exists (look in
`src/lib/province-importer/__tests__/` or `*.test.ts` siblings; match its
structure). Create a tiny inline SVG fixture string with: a `viewBox`, one `<g
inkscape:label="Provinces">` containing 3 labeled `<path>` triangles, and one
`<g inkscape:label="Cities">` containing 4 `<circle>` dots with 4 nearby
`<text>` labels (mark one inside a `<g inkscape:label="Capitals">`).

Assert:
- `layers` includes "Provinces", "Cities", "Capitals" with correct counts.
- `parseCitySvg(svg, { citiesLayerId: <cities> })` returns 4 points with the
  expected names and coordinates in viewBox space.
- the capital dot has `isCapital: true`.
- `svgProvinces` has 3 entries with the province names.

**Verify**:
- `bun run test -- src/lib/city-importer/svg-points.test.ts` → all pass.

### Step 3: Client alignment library (`src/lib/city-importer/align-cities.ts`)

Create a **client-safe** module (math only — it imports `alignment.ts` and
`geo-math.ts`, NOT the SVG libs). Export:

```ts
import type { AffineMatrix, ReferencePoint } from "~/lib/province-importer/types";
import { computeAffineFromReferencePoints, applyAffineToPoint } from "~/lib/province-importer/alignment";

export interface DbSubdivisionRef { name: string; centroid: [number, number]; } // [lng, lat]
export interface SvgProvinceRef { name: string; svgX: number; svgY: number; }
export interface SvgCityPoint { svgX: number; svgY: number; name: string; isCapital: boolean; }

export interface CityAlignResult {
  matrix: AffineMatrix | null;
  matchCount: number;      // number of name-matched province pairs used
  rmse: number;            // from computeAffineFromReferencePoints
  unmatchedSvgProvinces: string[];
}

/** Build reference pairs by case-insensitive name match and compute the affine. */
export function deriveCityAffine(
  svgProvinces: SvgProvinceRef[],
  dbSubdivisions: DbSubdivisionRef[],
): CityAlignResult;

/** Apply an affine to all points, returning lat/lng rows. */
export function applyCityAffine(
  points: SvgCityPoint[],
  matrix: AffineMatrix,
): Array<{ name: string; lat: number; lng: number; isCapital: boolean }>;
```

Implementation:
- `deriveCityAffine`: lowercase-trim match each `svgProvince.name` to a
  `dbSubdivision.name`. For each match build a `ReferencePoint`
  `{ source: [svgX, svgY], target: centroid }`. If `< 3` matched pairs →
  return `{ matrix: null, matchCount, rmse: Infinity, unmatchedSvgProvinces }`
  (the caller falls back). Otherwise call
  `computeAffineFromReferencePoints(pairs)` and return its matrix + rmse.
- `applyCityAffine`: for each point, `const [lng, lat] = applyAffineToPoint([svgX, svgY], matrix);`
  return `{ name, lat, lng, isCapital }`. (Note coordinate order: the affine maps
  SVG → geographic where target is `[lng, lat]`, so `applyAffineToPoint` returns
  `[lng, lat]`.)

### Step 4: Unit-test the alignment (`align-cities.test.ts`)

Construct a known affine (e.g. scale + translate + Y-flip), generate
`svgProvinces` and their `dbSubdivisions` centroids by applying that affine to
3+ synthetic province points, then assert `deriveCityAffine` recovers a matrix
that maps a test city point to within a small epsilon of the expected lat/lng.
Also assert the `< 3 matches → matrix null` fallback path.

**Verify**: `bun run test -- src/lib/city-importer/align-cities.test.ts` → pass.

### Step 5: Server `parseCitySvg` procedure (in `cities.ts`)

Add to `geoAdminCitiesRouter` a `parseCitySvg` mutation modeled on
`parseProvinceUpload` (`provinces.ts:80`):

```ts
parseCitySvg: standardMutationCountryOwnerProcedure
  .input(z.object({
    countryId: z.string(),
    svgContent: z.string().min(1),
    citiesLayerId: z.string().optional(),
    capitalLayerId: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // ownership check identical to validateCityImport (ctx.country null = admin)
    const { parseCitySvg } = await import("~/lib/city-importer/svg-points");
    return parseCitySvg(input.svgContent, {
      citiesLayerId: input.citiesLayerId,
      capitalLayerId: input.capitalLayerId,
    });
  }),
```

Use a dynamic `await import(...)` (as `upsertCity` does for `geo-validation` in
`country-geo-service.ts`) so the server-only SVG module never leaks into a
client bundle. Keep the same `ctx.country` ownership guard the other procedures
use.

**Verify**:
- `grep -c "parseCitySvg" src/server/api/routers/geo/admin/cities.ts` → `≥ 2`.
- `bun run typecheck:file src/server/api/routers/geo/admin/cities.ts` → 0 real errors.

### Step 6: Extend `useCityImporter` with the SVG branch

In `src/hooks/useCityImporter.ts`:
- Widen the step union: `export type CityImportStep = "upload" | "align" | "preview" | "commit";`
- Add an `inputMode: "tabular" | "svg"` to the state.
- In `handleFile(file)`: if the file name ends in `.svg` (or type is
  `image/svg+xml`), set `inputMode="svg"`, read the text, call
  `api.geoAdmin.parseCitySvg` (via `api.useUtils().geoAdmin.parseCitySvg.fetch`
  or a mutation) with `{ countryId, svgContent }`, store `layers`, `svgPoints`,
  `svgProvinces`, and move to `"align"`. Otherwise keep the existing tabular path
  → `"preview"`.
- Add align state + handlers (mirror `useProvinceImporter`): `alignmentMode`
  (`"auto-align" | "reference-points" | "manual"`), `referencePoints`,
  `alignMatrix`, `alignedRows` (the lat/lng rows after applying the matrix),
  `citiesLayerId`, `capitalLayerId`.
- `setLayer(citiesLayerId, capitalLayerId?)`: re-call `parseCitySvg` with the
  chosen layers, refresh `svgPoints`/`svgProvinces`.
- `autoAdjust()`: fetch `getCountryGeoBundle` (via utils) for the country,
  compute each subdivision centroid (reuse `geo-math` centroid helper), call
  `deriveCityAffine(svgProvinces, dbSubs)`. If `matrix` is null (`<3` matches),
  set an error suggesting fallback; else `setAlignMatrix(matrix)` and
  `setAlignedRows(applyCityAffine(svgPoints, matrix))`.
- `applyReferencePointAlignment()` and manual translate/scale/rotate: mirror
  `useProvinceImporter`'s equivalents but produce the lat/lng rows via
  `applyCityAffine`.
- When leaving `"align"` for `"preview"`, feed `alignedRows` into the SAME
  `validated`/preview shape the tabular path uses (each row → `{ name, lat, lng,
  isNationalCapital: isCapital, cityType: isCapital ? "capital" : "city" }`),
  so `validate()`/`commitImport()` work unchanged.

**Import only the client-safe libs here**: `align-cities.ts` and `alignment.ts`.
Do NOT import `svg-points.ts` or any `province-importer` SVG lib into this hook.

**Verify**:
- `grep -c "align" src/hooks/useCityImporter.ts` → `≥ 3`.
- `bun run typecheck:file src/hooks/useCityImporter.ts` → 0 real errors (ignore alias noise).

### Step 7: Accept `.svg` in `UploadStep`

In `src/components/maps/editor/city-importer/UploadStep.tsx`, change the file
input `accept` to `.csv,.tsv,.json,.svg` and update the help text to mention SVG
("…or an SVG map exported from your editor — cities are detected from dots and
labels"). No other change — `handleFile` already routes by extension.

**Verify**: `grep -c ".svg" src/components/maps/editor/city-importer/UploadStep.tsx` → `≥ 1`.

### Step 8: New `CityAlignStep.tsx` (layer pick + Auto-adjust + map preview)

Create `src/components/maps/editor/city-importer/CityAlignStep.tsx`. Model the
controls on `province-importer/AlignmentStep.tsx` and the map overlay on
`province-importer/ProvincePreviewLayer.tsx` (read both; do not import/modify
them). Props: `{ importer, countryId }` (the `useCityImporter` return).

It renders:
1. **Layer pickers**: a select for "Cities layer" (from `importer.layers`) and an
   optional "Capitals layer" select; changing either calls `importer.setLayer(...)`.
2. **Auto-adjust button** (primary): `onClick={importer.autoAdjust}`. Show a
   status line: "Aligned via N matched provinces (RMSE …)" on success, or the
   fallback hint if `<3` matched.
3. **Mode toggle** (`auto-align` / `reference-points` / `manual`) mirroring
   `AlignmentStep.tsx`, with the reference-point list + manual translate/scale/
   rotate sliders for fine-tuning.
4. **Map preview**: render the aligned dots (`importer.alignedRows`) as markers
   over the country. Reuse the editor's existing map surface the way
   `ProvincePreviewLayer` does. **If wiring a live map overlay proves to require
   changes outside the in-scope files (e.g. editing `MapEditorOverlay` or
   `MapContainer`), STOP and report** — as a documented fallback, render the
   dots on a minimal standalone `MapContainer` preview (read-only, centered on
   the country bbox) or, if even that is out of reach, a coordinate list with an
   inside/outside-border badge. Do not edit out-of-scope map components to force
   a richer preview.
5. Footer: "Back" (→ upload) and "Next" (→ preview), Next disabled until
   `importer.alignedRows` is non-empty.

**Verify**:
- `grep -c "autoAdjust\|Auto-adjust\|Auto-Adjust" src/components/maps/editor/city-importer/CityAlignStep.tsx` → `≥ 1`.
- `bun run typecheck:file src/components/maps/editor/city-importer/CityAlignStep.tsx` → 0 real errors (ignore JSX/alias noise).

### Step 9: Route SVG uploads through the align step in `CityImportWizard`

In `CityImportWizard.tsx`, add `"align"` to the step rendering: when
`importer.step === "align"` render `<CityAlignStep importer={importer}
countryId={countryId} />`. Update `STEP_CONFIG` so the stepper shows Align for the
SVG flow (it can stay hidden/[skipped] for the tabular flow — gate the Align step
chip on `importer.inputMode === "svg"`). Tabular uploads still go
`upload → preview → commit`; SVG uploads go `upload → align → preview → commit`.

**Verify**:
- `grep -c "CityAlignStep" src/components/maps/editor/city-importer/CityImportWizard.tsx` → `≥ 1`.

### Step 10: Full gate

**Verify**:
- `bun run test` → all pass, including `svg-points.test.ts` and `align-cities.test.ts`.
- `bun run lint` → exit 0 (no new errors in in-scope files).
- `bun run typecheck:file` on each new/changed `.ts`/`.tsx` in scope → 0 real
  errors (ignore `~/*` TS2307 + JSX TS17004/TS1259 noise; confirm the same noise
  appears on an unmodified sibling so you know it's pre-existing).
- `git status --porcelain` shows only in-scope files (+ `node_modules`/lockfile).

## Test plan

New unit tests (pure functions — fully testable, unlike 054's UI):
- `src/lib/city-importer/svg-points.test.ts` — Step 2 (layer detection, point +
  name extraction, capital flag, svgProvinces).
- `src/lib/city-importer/align-cities.test.ts` — Step 4 (affine recovery from
  synthetic correspondence, `<3`-match fallback).

Model both after the nearest existing pure-function test (look at
`src/lib/province-importer/*.test.ts` or `src/lib/__tests__/` for structure and
the jest import style). No UI/render tests (the wizard/map preview is verified
manually).

Manual check (non-blocking, if a dev server is available): open the map editor
for a country with imported provinces, Import Cities → choose an SVG with the
provinces + city dots, pick the Cities layer, click **Auto-adjust**, confirm the
dots land on the country, then Preview → Commit and confirm cities appear (and
capitals are flagged).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test` → all pass, incl. `svg-points.test.ts` + `align-cities.test.ts`
- [ ] `bun run lint` → exit 0, no new errors in in-scope files
- [ ] `grep -c "parseCitySvg" src/server/api/routers/geo/admin/cities.ts` → `≥ 2`
- [ ] `grep -c "export function parseCitySvg" src/lib/city-importer/svg-points.ts` → `1`
- [ ] `grep -c "export function deriveCityAffine" src/lib/city-importer/align-cities.ts` → `1`
- [ ] `grep -c "export function applyCityAffine" src/lib/city-importer/align-cities.ts` → `1`
- [ ] `grep -rn "@xmldom/xmldom\|province-importer/svg-" src/hooks/useCityImporter.ts src/components/maps/editor/city-importer/` → **no matches** (no server-only SVG import leaked client-side)
- [ ] `grep -c '.svg' src/components/maps/editor/city-importer/UploadStep.tsx` → `≥ 1`
- [ ] `grep -c "CityAlignStep" src/components/maps/editor/city-importer/CityImportWizard.tsx` → `≥ 1`
- [ ] `git status --porcelain` shows only in-scope files modified/created
- [ ] `plans/README.md` status row for 056 updated (SKIP — reviewer maintains the index)

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift) — especially the
  alignment.ts signatures (`computeAffineFromReferencePoints`, `applyAffineToPoint`),
  the `ReferencePoint`/`AffineMatrix` shapes, or the 054 hook/router shape.
- Any province-importer SVG export named above is missing or has a different
  signature (`parseProvinceSvg`, `collectShapeElements`, `elementToRings`,
  `extractAllTextLabels`, `getAccumulatedTransform`, `detectProvinceLayer`).
- `getCountryGeoBundle` does not return subdivisions with usable `geometry`
  (you can't compute centroids for the correspondence) — report; the auto-adjust
  premise depends on it.
- The map preview in Step 8 cannot be rendered without editing an out-of-scope
  map component — fall back to the standalone/list preview per Step 8 and note it;
  do NOT edit out-of-scope files.
- `@xmldom/xmldom` ends up imported (transitively) into a client component/hook
  (the build/typecheck flags a server module in client code) — report; the
  server/client split in this plan must hold.
- A verification command fails twice after a reasonable fix attempt.
- You find yourself needing to modify any `province-importer/*` file.

## Maintenance notes

- **Why server-parse + client-align.** SVG DOM parsing needs `@xmldom/xmldom`
  (server-only); the affine math is pure and runs client-side so the user gets an
  instant, interactive Auto-adjust + map preview without round-trips. Keep that
  boundary: new SVG-DOM work goes in `svg-points.ts` (server), new math in
  `align-cities.ts` (client).
- **Why correspondence beats fit-to-border for this use case.** The dots and the
  provinces come from the *same* SVG, and the provinces are already placed
  correctly in lat/lng, so matching them by name recovers the exact transform —
  far more accurate than fitting a point cloud's bbox to the border. Fit-to-border
  (`autoAlignToCountryBorder`) and manual reference points remain as fallbacks.
- **No persisted transform.** The recovered affine is not saved; a re-import
  re-derives it. If repeated SVG re-imports become common, a future plan could
  persist the per-country affine (new schema field) — out of scope here.
- **Reviewer, scrutinize:** (1) the server/client import boundary (the grep gate
  above is the guardrail); (2) coordinate order — the affine target is `[lng,lat]`,
  so `applyCityAffine` must return `lat`/`lng` correctly; (3) that the SVG path
  funnels into the existing `validateCityImport`/`commitCityImport` unchanged so
  the inside-border check still runs.
- **Deferred:** capital detection by *distinct symbol* (vs. distinct layer) is a
  bonus heuristic; if it was skipped, a follow-up can add symbol-reference
  clustering. Map-marker preview polish (clustering 500 dots) is also a natural
  follow-up.
```
