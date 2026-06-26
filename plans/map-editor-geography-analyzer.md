# Plan C-2 — Geography Report / Analyzer (+ named features)

Part of the **Map Editor Improvements** initiative. **Self-contained** — you need no other plan to execute this.

**Repo:** `/ixwiki/public/projects/ixstats` · **Branch:** `v2` · **Base commit:** `35274d70`
**Stack:** Next.js 16.2 / React 19 / tRPC / Prisma (Postgres + PostGIS) · `maplibre-gl@5.24` · `@turf/turf@7.3.5`. Package manager: **bun**.

## Conventions (must follow)
- **bun only.**
- New Prisma models copy the existing map-model style exactly: `id String @id @default(cuid())`, `countryId String`, optional `geom_postgis Unsupported("geometry")?`, `@@index([geom_postgis], type: Gist)`, `@@map("snake_case")`, owner/review fields (`editableByOwner Boolean @default(true)`, `status String @default("pending")`, `submittedBy String`, `reviewedBy String?`, `reviewedAt DateTime?`). See `City`/`Subdivision` in `prisma/schema/maps.prisma`.
- Owner-gated mutations use `standardMutationCountryOwnerProcedure` (see `src/server/api/routers/countryGeo.ts`).
- Modals copy `src/components/mycountry/RollupSettingsModal.tsx` + `src/components/ui/dialog.tsx`.
- **Never** run global `tsc`/`typecheck:full`. Use `bun run typecheck:file <path>` and `bun run lint`.

## Why
The compute already exists — `src/server/api/routers/geo/core/geo-profile.ts:22` `getCountryGeoProfile` returns area, climate (zones + estimated temp/precip), elevation (zones + roughness), hydro, arable %, landlocked/island, coastline, and neighbors with shared-border km. But: (a) **no UI surfaces it** — the Geography tab (`src/components/mycountry/GeographyContent.tsx:31`) uses a different endpoint (`countryGeo.getCountryGeoBundle`); (b) the **hydro numbers are a bug** — `geo-profile.ts:77-92,218-224` fetch rivers/lakes with no country/spatial filter, so counts/lengths are world totals; (c) there are **no named superlatives** (no Peak/River/Lake records to name "tallest/longest/largest").

## Files in scope
- `src/server/api/routers/geo/core/geo-profile.ts`
- `src/components/mycountry/GeographyContent.tsx`; new `src/components/mycountry/GeographyReportModal.tsx`
- `prisma/schema/maps.prisma` (new models) + `prisma/schema/core.prisma` (Country relations)
- new `src/lib/country-geo/named-features.ts` (service)
- new router file under `src/server/api/routers/geo/features/` (e.g. `named-features.ts`), registered via the existing `geo/features` `mergeRouters` index
- `src/hooks/useMapEditor.ts`, `src/components/maps/editor/MapEditorToolbar.tsx`, a new property form (editor tools)

## Out of scope
- World-wide / global superlatives (note as a future extension).
- Raster DEM ingestion.
- Changing the climate/elevation **approximation** in `geo-profile.ts` (only the hydro path moves to PostGIS in this plan).

## Steps

### 1. Surface the existing profile in the Geography tab
In `GeographyContent.tsx`, add a "Geographic Profile" card calling `api.geo.getCountryGeoProfile.useQuery({ countryId }, { enabled: !!countryId, staleTime: 30_000 })`. Render area / climate (zones + temp/precip) / elevation / hydro / derived / neighbors. Add a **"Full report"** button opening `GeographyReportModal.tsx` (pattern from `RollupSettingsModal.tsx` + `ui/dialog.tsx`) with the richer breakdown (per-zone bars, neighbor list, and the superlatives from step 4).

**Verify:** the Geography tab shows the profile card for a country that has linked map geometry.

### 2. Fix the hydro bug (clip rivers/lakes to the country)
In `geo-profile.ts`, `riverLayers`/`lakeLayers` (lines 77-92) have **no spatial filter**, and the JS sums (lines 218-224) therefore aggregate the whole world. Replace those sums with PostGIS clipped to the country, reusing the `ST_Intersects` / `ST_Length` pattern already present in the neighbors block (lines 247-303):
- river length = Σ `ST_Length(ST_Intersection(river_geom, country_geom)::geography) / 1000`
- lake area = Σ `ST_Area(ST_Intersection(lake_geom, country_geom)::geography) / 1e6`
- counts = number of clipped features with non-zero intersection
Keep the existing `try/catch` fallback to bbox estimation.

**Verify:** two different countries return *different* river/lake numbers; an inland country no longer reports the entire world's rivers.

### 3. Named-feature schema
Add three models to `prisma/schema/maps.prisma` (mirror `City`/`Subdivision` conventions) and the matching relations on `Country` in `prisma/schema/core.prisma`:
- `Peak` (point): `name String`, `coordinates Json` (`[lng,lat]`), `elevation Float`, `prominence Float?`, `subdivisionId String?`, `wikiPageTitle String?`, owner/status fields, `geom_postgis`, `@@index([countryId])`, `@@map("peaks")`.
- `NamedRiver` (line): `name String`, `geometry Json` (LineString), `lengthKm Float?`, `wikiPageTitle String?`, owner/status fields, `geom_postgis`, `@@index([countryId])`, `@@map("named_rivers")`.
- `NamedLake` (polygon): `name String`, `geometry Json` (Polygon), `areaSqKm Float?`, `maxDepthM Float?`, `wikiPageTitle String?`, owner/status fields, `geom_postgis`, `@@index([countryId])`, `@@map("named_lakes")`.

Apply: `bun run db:push:force` then `bun run db:generate`.

**Escape hatch:** `db:push`/`db:migrate` are normally **blocked** to protect ~82 nations of production data; `db:push:force` writes to the DB. If applying the schema is not explicitly approved for this run, **STOP and report** with the proposed schema diff instead of pushing.

### 4. API + editor tools + superlatives
- **Service** `src/lib/country-geo/named-features.ts`: CRUD for the three models; compute `lengthKm` via `polylineLengthKm` and `areaSqKm` via `geometryAreaSqKm` (both from `src/lib/geo-math.ts`) on save.
- **Router**: new file under `src/server/api/routers/geo/features/` shaped like `subdivisions.ts`, registered through the existing `geo/features` merge so paths stay `api.geo.*`.
- **Editor tools**: extend the `EditorMode` union in `useMapEditor.ts` and the `TOOLS` array in `MapEditorToolbar.tsx:49` with `add-peak` (reuse the point-click flow used by city/POI), `add-river` (reuse the route-waypoint flow with a straight `buildRouteGeometry`), `add-lake` (reuse the `useSubdivisionDraw` polygon flow). Add one property form per type (copy `src/components/maps/editor/properties/CityPropertyForm.tsx`). Add matching branches to `ToolOptionsBar` (this overlaps plan C-1; if C-1 isn't done yet, still add the tool — the bar is optional).
- **Superlatives**: extend `getCountryGeoProfile` (or add a sibling `getGeographyReport`) to also return `tallestPeak` (max `Peak.elevation`; fallback to the highest `City.elevation`), `longestRiver` (max `NamedRiver.lengthKm`), `largestLake` (max `NamedLake.areaSqKm`). Render them in the card + modal from step 1.

**Verify:** place a peak/river/lake in the editor → it appears in the Geography report superlatives with correct elevation/length/area. `bun run typecheck:file` on each new file.

## Done criteria
- Geography tab shows the live profile + superlatives; report modal opens.
- Hydro river/lake numbers differ per country (bug fixed).
- Peaks/rivers/lakes are placeable in the editor and persist across reload.
- `bun run lint` clean on changed files.

## Test plan
Add `src/lib/country-geo/__tests__/named-features.test.ts` for the length/area computation (pure functions, fixture GeoJSON), following an existing `src/lib/*.test.ts`. The PostGIS hydro change is verified by querying two countries in `bun run dev`.

## Maintenance note
Named features intentionally do **not** feed the economic sim yet — that's a deliberate follow-on (navigable rivers / coastal lakes → `CountryGeoProfile.tradeModifier`). Keep the superlative queries indexed (`@@index([countryId])`).
