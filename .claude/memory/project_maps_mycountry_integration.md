---
name: project-maps-mycountry-integration
description: Tier-0 Maps↔MyCountry single-source-of-truth integration — design + phase status
metadata: 
  node_type: memory
  type: project
  originSessionId: 27047d24-f1ef-4183-87b7-a52d19c2ccb4
---

Making IxWorld geography the single source of truth for MyCountry. Design doc:
`docs/systems/maps-mycountry-integration.md` (supersedes/extends `docs/systems/map-overlay-framework.md`,
the P7 overlay-registry doc). Work is on branch **v2** (the MyCountry UX refactor was merged into v2;
all 6 sections on the SectionShell/CompactSectionHero template, sheets→modals, P0 persistence restored,
read-only premium preview, onboarding SetupChecklist — all done).

**Locked decisions:** one canonical record / **two editing surfaces** (map editor = spatial half:
geometry/position/world-placement → admin review; MyCountry editor = attribute half: name/pop/economy/
capital → owner-direct); unify Cities + Subdivisions + Borders/Territory + POIs/pins; rollups =
**hybrid + reconciled** (national stays sim baseline; cities/subdivisions hold absolute values + a
coverage meter + a "rebase national from geography" action); edit authority = **attributes direct,
spatial reviewed**; maps are tier-0 (embedded everywhere, click-to-manage canvas, live gameplay layers,
stats roll up from geography).

**STATUS: ALL PHASES A–F COMPLETE (committed on v2, 2026-06-07).**
- **A** (`cc1586be`, DB applied + backfill ran `--apply`: 13 capitals linked) — additive schema:
  `NationalIdentity.capitalCityId`/`largestCityId` + `Subdivision.capitalCityId` FK→`City`; City/Subdivision
  attribute-half fields; `Country.geoRollupMode` "hybrid". `scripts/backfill-geo-links.ts`.
- **B** (`61070c29`) — `src/lib/country-geo-service.ts` + `src/server/api/routers/countryGeo.ts`
  (`getCountryGeoBundle`, `syncCountryGeometryFromMapLayer`); MyCountry reads route through the bundle.
- **C** (`61070c29` + `3f0883e3`) — owner mutations `upsertCity/upsertSubdivision/setCapital/upsertPoi/...`;
  attribute fields surfaced in the click-to-manage `CountryFeatureSheet`.
- **D** (`61070c29`) — `updateGeoRollupMode`, `rebaseNationalFromGeography`, coverage; `GeographicReconciliationCard`
  (lives on the **Settings** page); tests in `country-geo-service.test.ts`.
- **E** (`3f0883e3`) — bespoke map widgets retired → shared `CountryMapEmbed`; embedded on Overview + Diplomacy;
  `onFeatureClick` → `CountryFeatureSheet` (owner-editable city/subdivision attributes).
- **F** (`4c50ea74`) — `src/lib/overlay-registry.ts` + `overlay-types.ts`; drives MapControls/MapContainer/
  IxWorldMap/AnalyticsLegend; 2 new data overlays (`economicTier`, `vitality`).

**Remaining polish / verify (not blockers):** runtime smoke-test the map after the Phase-F maps-core refactor
(implemented lint-clean but not browser-verified); verify schema↔DB still in sync (see [[reference-ixstats-db-apply]]
diff cmd) after the `61070c29` data-model refactor; consider surfacing `GeographicReconciliationCard` inside
MyCountry (currently Settings); de-`@ts-nocheck` `CountryMapEmbed`/`EnhancedMapEditorContent`. Apply DB changes
per [[reference-ixstats-db-apply]].
