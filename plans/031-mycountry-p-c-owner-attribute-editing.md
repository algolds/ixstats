# Plan 031: MyCountry Integration P-C — owner attribute editing

## Status
- **Priority**: P2
- **Effort**: L (~5d server + client)
- **Risk**: MED (new owner-facing mutations; auth gating critical)
- **Depends on**: 024 (DONE — editor surface), P-A/P-B (mostly DONE)
- **Category**: direction (feature)
- **Planned at**: commit `daecb2ed`, 2026-06-15

## Why this matters

Per `docs/systems/maps.md:466-467`, P-C is the next phase of MyCountry Integration — "one canonical record, two editing surfaces." The map editor already handles spatial editing (geometry, coordinates, placement). The MyCountry editor should handle **attribute editing** — name, population, GDP contribution, governor/mayor name, specialization, etc. Currently these fields exist on `City`/`Subdivision` (added in P-A schema backfill) but have no owner-facing UI to edit them.

## Current state

- `src/lib/country-geo-service.ts` (1,292 lines) — `upsertCity`, `upsertSubdivision`, `upsertPoi`, `upsertStoryPin`, `upsertMapLabel`, `setCapital`, `updateGeoRollupMode`, `rebaseNationalFromGeography`. All server-side functions.
- `src/server/api/routers/countryGeo.ts` — `getCountryGeoBundle` (read). No owner-facing write mutations yet.
- `prisma/schema/core.prisma` — `City` has `gdpContribution`, `populationShare`, `economyOutput`, `specialization`, `infrastructureLevel`, `isPort`, `mayorName`. `Subdivision` has `gdpContribution`, `budgetShare`, `governorName`, `governmentType`.
- `src/app/mycountry/` — MyCountry executive command suite. Has widget components for various systems.
- P-A schema backfill (`cc1586be`): FK columns added. P-B dedup read layer: `countryGeo` router + `country-geo-service.ts` done.

## Scope

**In scope:**
- New tRPC mutations in `countryGeo` router: `updateCityAttributes`, `updateSubdivisionAttributes`, `updatePOIAttributes`, `setCapital`.
- MyCountry editor UI: a "Geography" widget/tab showing the country's cities, subdivisions, POIs in a list/grid with inline editing of attributes.
- Auth: `standardMutationCountryOwnerProcedure` — only the country owner can edit their own features' attributes.

**Out of scope:**
- Rollups + reconciliation UI (P-D).
- Tier-0 shared `<CountryMap>` embed (P-E).
- Spatial editing via MyCountry (that stays in the map editor — P-C is attribute-only).

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Tests | `bun run test` | 604/604 min |
| Lint | `bun run lint` | 0 errors |
| Typecheck server | `node .../tsc -p tsconfig.server.json --noEmit` | exit 0 |

## Steps

### 1. Create owner attribute mutations in `countryGeo` router
- `updateCityAttributes`: `standardMutationCountryOwnerProcedure.input(z.object({ cityId, name?, population?, gdpContribution?, specialization?, infrastructureLevel?, isPort?, mayorName? }))`. Calls `upsertCity` in `country-geo-service.ts`.
- `updateSubdivisionAttributes`: similar pattern for subdivisions.
- `updatePOIAttributes`: similar pattern for POIs.
- `setCapital`: simple call through to `setCapital` in `country-geo-service.ts`.
- **Verify:** `bun run typecheck:file src/server/api/routers/countryGeo.ts` → exit 0.

### 2. Create MyCountry Geography widget
- New component `src/components/mycountry/GeographyWidget.tsx` (or tab in existing layout).
- Fetch `getCountryGeoBundle` for the user's country.
- Render cities list with inline editable fields (name, population, GDP contribution, specialization, etc.).
- Render subdivisions list similarly.
- Use optimistic updates via tRPC.
- **Verify:** `bun run lint` → 0 errors.

### 3. Wire into MyCountry page
- Add "Geography" tab or sidebar widget to the MyCountry page layout.
- Guard behind `userCountryId` — only visible if the user has a country.
- **Verify:** `bun run typecheck:file <MyCountry page>` → exit 0.

### 4. Test auth gating
- Confirm a non-owner cannot call `updateCityAttributes` for another country's city (should throw FORBIDDEN).
- Use existing `standardMutationCountryOwnerProcedure` — already tested in other mutations.

## Done criteria

- [ ] `updateCityAttributes`, `updateSubdivisionAttributes`, `updatePOIAttributes`, `setCapital` mutations exist and are auth-gated.
- [ ] Geography widget shows cities/subdivisions/POIs for the user's country with inline editing.
- [ ] Auth gating tested (non-owner rejected).
- [ ] 604+ tests. 0 new lint errors.
- [ ] `plans/README.md` row updated.

## STOP conditions

- `upsertCity`/`upsertSubdivision` signatures changed from `country-geo-service.ts` — re-confirm.
- MyCountry page structure is heavily refactored — locate the correct mount point before wiring.

## Maintenance notes

- P-D (rollups + reconciliation UI) is the next phase — this widget is the foundation.
- The `CountryGeoProfile` cache must be invalidated after attribute edits.
