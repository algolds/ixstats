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

**Phase A DONE — applied to dev DB 2026-06-06 (commit `cc1586be`):** additive schema —
`NationalIdentity.capitalCityId`/`largestCityId` + `Subdivision.capitalCityId` FK→`City` (old strings
kept as display cache); `City`/`Subdivision` attribute-half fields (gdpContribution, economyOutput,
populationShare, governor/mayor, isPort, editableByOwner, …); `Country.geoRollupMode` default "hybrid".
Backfill `scripts/backfill-geo-links.ts` linked 13 capitals by name (0 ambiguous, 14 unmatched/left alone).

**Next phases (not started):** P-B de-dup read layer (`src/lib/country-geo-service.ts` + a `countryGeo`
tRPC router + `getCountryGeoBundle`; collapse duplicated `Country.geometry/area/centroid/density` to a
single `MapLayer`→sync, read derived) → P-C owner editing (attribute mutations + a map-picker in the
MyCountry editor) → P-D rollups + reconciliation UI → P-E shared `<CountryMap>` embedded across MyCountry
(retires the fragile per-section map widgets; also fixes the blank-map issue) → P-F live overlay layers
(implement the OVERLAY_REGISTRY from P7). Apply DB changes per [[reference-ixstats-db-apply]].
