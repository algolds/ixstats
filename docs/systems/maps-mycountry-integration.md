# Maps ↔ MyCountry — Native Integration Architecture

> **Status: design.** Tier-0 architecture for making IxWorld geography the single source of
> truth for MyCountry. Supersedes the narrower [map-overlay-framework.md](./map-overlay-framework.md)
> (which becomes the "live layers" mechanism inside this design). Implementation is phased
> (§8); nothing here ships with the doc.
>
> **Decisions locked:** unify Cities + Subdivisions + Borders/Territory + POIs/pins · **one
> canonical record, two editing surfaces** · tier-0 means *all four* — stats roll up from
> geography, map is an interaction canvas, gameplay renders live on the map, and the map is
> embedded everywhere · produce the full design before building.

## 1. Principles
1. **One record, two surfaces.** Each geographic entity (a City, a Subdivision, the border) is
   ONE row. The **map editor** owns its *spatial half* (geometry/coordinates/world placement);
   the **MyCountry editor** owns its *attribute half* (name, population, role, economy). No
   duplicate "country city" vs "map city."
2. **Geography is authoritative for geography.** Borders/area/centroid/adjacency/coastline come
   from the geo store, never re-stored on `Country`. Country keeps the *economic* baseline.
3. **Geography drives the sim (rollups).** City/Subdivision figures aggregate to national totals
   with explicit reconciliation — no silent drift.
4. **Map is core, not a widget.** A single shared `<CountryMap>` is embedded across MyCountry and
   is clickable: selecting a city/region opens its MyCountry config (same record).
5. **Gameplay is a layer, not a fork.** Embassies/operations/crises/trade render via the overlay
   registry from the same central data.

## 2. Canonical data model (3 sources, today's tables)
| Source of truth | Holds | Models |
|---|---|---|
| **Borders/territory** | country footprint, area, centroid, bbox, adjacency | `MapLayer` (political), `Territory`, `BorderHistory` (audit) |
| **Settlements & features** | cities, regions, POIs, pins, labels | `City`, `Subdivision`, `PointOfInterest`, `StoryPin`, `MapLabel` |
| **Computed geo stats (cache)** | climate/elevation/coastline/arable, sim modifiers | `CountryGeoProfile` (1:1 Country) |

All already FK to `Country.id`. The work is **linking, de-duplicating, and opening them to owners**, not new tables.

## 3. Schema changes (the gap → unified)
**A. Replace string geography with FKs** (the core "one record" fix):
- `NationalIdentity.capitalCityId → City.id` (and `largestCityId → City.id`). Keep the existing
  `capitalCity`/`largestCity` strings only as a denormalized display cache, written from the FK.
- `Subdivision.capitalCityId → City.id` (replaces `Subdivision.capital` string).
- Invariant: `City.isNationalCapital` ⇔ it's the `capitalCityId` for the country (enforced in the service).

**B. Stop duplicating border geometry on `Country`.** `Country.geometry / centroid / boundingBox /
landArea / areaSqMi / populationDensity / gdpDensity` become **derived** (read from `MapLayer` /
computed on read), not authoritative columns. Transitional: keep the columns as a cache updated by
*one* sync hook on `MapLayer` change; new code reads via the geo service (§6), not the columns.

**C. Add the "attribute half" for gameplay** so owners have something to edit and the sim can roll up:
- `City`: add `gdpContribution` / `populationShare`, `economyOutput`, `specialization`,
  `infrastructureLevel`, `isPort`, optional `mayorName`. (Spatial half already present: `coordinates`,
  `geom_postgis`, `population`, `elevation`.)
- `Subdivision`: add `gdpContribution`, `budgetShare`, `governorName`, `governmentType`. (Spatial
  half present: `geometry`, `level`, `population`, `areaSqKm`, `color`.)
- `City`/`Subdivision`: add `editableByOwner Boolean @default(true)` and reuse the existing approval
  `status` for the *spatial* half only (§5).

## 4. Two-surface editing (resolving the admin/approval tension)
Today everything geo goes through admin `MapEditRequest` review. That's right for **world-affecting
spatial** changes but wrong for **owner attributes**. Split by *which half*:

| Edit | Surface | Path | Review? |
|---|---|---|---|
| Country border geometry, split/merge, world placement of a feature | Map editor | `geoEditor.*` → `MapEditRequest` | **Yes** (affects shared world) |
| Move/redraw a city/subdivision shape | Map editor (or MyCountry map-picker) | spatial mutation → `MapEditRequest` | Yes (light) |
| **Create/name a city, set population/role/economy, pick capital, governor, description** | **MyCountry editor** | new `countryGeo.*` owner mutations | **No — direct** |
| Add POI / story pin / label (intra-territory) | Either; MyCountry map-picker | direct (auto-approved like today's StoryPin/MapLabel) | No |

Mechanism: the MyCountry editor embeds a **lightweight map-picker** (reusing the map core) so an
owner can drop/move a city pin *within their own territory* and fill attributes in the same form —
writing the one `City` record. A world-affecting spatial change still queues for admin review; the
attribute half saves immediately. (`editableByOwner` + ownership check gate this.)

## 5. Rollups & reconciliation (geography → sim)
**Decision (recommended): hybrid, reconciled, never silently drifting.**
- National `currentPopulation` / `currentTotalGdp` stay the sim's authoritative baseline (builder + economic engine).
- Cities/subdivisions hold **absolute** `population` / `gdpContribution`. A derived
  `geographicCoverage = Σ(city.population) / national.population` is shown to the owner.
- The owner picks a **mode** per country: *Top-down* (national distributes to cities by share — always reconciles) or *Bottom-up* (national = Σ cities; only when `geographicCoverage` is "complete"). A "**Rebase national from geography**" action recomputes national from the sum when they're ready.
- Provide a `CountryGeoRollup` read: per-subdivision and per-city population/GDP, plus the coverage delta. The economy engine consumes the *baseline*; the map/MyCountry display the breakdown. This guarantees the numbers always tie out and gives "stats roll up from geography" without breaking the existing sim.

## 6. Unified service + API
One module both editors and all surfaces use — `src/server/api/routers/countryGeo.ts` + `src/lib/country-geo-service.ts`:
- `getCountryGeoBundle(countryId)` → borders + territories + subdivisions + cities + POIs + pins + computed stats + rollup, in one call (replaces the scattered `getCountryGeometry`/`getCountryFeatures` for MyCountry).
- Owner mutations (attribute half, ownership-checked, direct): `upsertCity`, `upsertSubdivision`, `setCapital`, `upsertPoi`, `setCityEconomy`, …
- Spatial mutations delegate to the existing `geoEditor.*` review pipeline.
- Derived-stat helpers: `computeArea/centroid/density/coastline(countryId)` reading `MapLayer`/`CountryGeoProfile` — the de-dup layer for §3B.
- Invariant enforcement: capital FK ⇔ `isNationalCapital`; coverage recompute on city change.

## 7. Tier-0 surfaces (all four)
- **Embedded everywhere** — one shared `<CountryMap countryId focus>` built on the real `MapContainer`/`IxWorldMap` core (NOT the bespoke per-section widgets, which are fragile/blank). Used in the Overview hero and as per-section context. Retire `CountryMapWidget`/`DiplomacyMapWidget`/`DefenseMapWidget`.
- **Interaction canvas** — clicking a city/subdivision on the embedded map opens its config (the same `City`/`Subdivision` record) via a shared selection context; the MyCountry editor and the map share selection state.
- **Live gameplay layers** — embassies, operations, crises, trade, alliances render through the **OVERLAY_REGISTRY** ([overlay framework](./map-overlay-framework.md)), fed by the same central data + the `countryGeo` service. This is where P7 plugs in.
- **Stats from geography** — the rollup (§5) surfaces in MyCountry (national breakdown by region/city) and on the map (choropleth overlays of population/GDP per subdivision).

## 8. Migration plan (phased, each shippable, zero silent breakage)
- **P-A Schema + backfill:** add the FKs (§3A), attribute fields (§3C), coverage fields. Backfill `capitalCityId`/`largestCityId` by name-match to existing `City` rows; report unmatched. No behavior change yet.
- **P-B De-dup read layer:** add `country-geo-service` derived-stat helpers; route MyCountry reads through `getCountryGeoBundle`; collapse `Country.geometry/area/centroid` double-writes to one `MapLayer`→sync hook. Columns kept as cache.
- **P-C Owner editing:** `countryGeo` owner mutations + ownership checks; add the map-picker to the MyCountry editor (create/place/configure a city; set capital). Spatial/world edits still queue.
- **P-D Rollups:** rollup service + reconciliation UI (coverage meter, mode toggle, "rebase from geography").
- **P-E Tier-0 embed:** shared `<CountryMap>` across MyCountry + click-to-manage selection context; retire the bespoke widgets (fixes the blank-map issue too).
- **P-F Live layers:** implement the overlay registry (P7) and register gameplay overlays bound to the central data.

Order rationale: data integrity (A/B) before editing (C) before sim coupling (D) before UI surfacing (E/F). A/B are safe refactors; C+ are user-visible.

## 9. Risks / open decisions
- **Capital backfill ambiguity** — string "New Haven" may match 0 or many `City` rows; needs an owner confirmation step.
- **Rollup mode** — confirm the §5 hybrid (vs strict bottom-up). It's the one decision that touches the economy engine; recommended hybrid keeps the sim intact.
- **Owner vs world authority** — exact line between "direct attribute edit" and "queued spatial edit," esp. for moving a capital or large redraws.
- **Performance** — PostGIS rollups/derived stats per read; cache in `CountryGeoProfile` and invalidate on geo change.
- **Existing data** — many countries have no linked `MapLayer` (the blank-map case); MyCountry must degrade gracefully (attributes work even with no geometry; map shows a "link your territory" state).
- **Approval load** — owner spatial edits could flood the admin queue; consider auto-approving intra-territory feature placement.
