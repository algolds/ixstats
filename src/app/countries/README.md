# Countries / Explore

**Last updated:** 30 September 2026

Public, read-only nation profiles plus the browse/explore experience. Anyone (signed in or not) can list all countries, search/filter/sort them, and open an individual country's public profile. Owner-side editing lives in MyCountry, not here.

## Routes

| Route | File | Purpose |
| --- | --- | --- |
| `/countries` | `page.tsx` | Explore grid: searchable/filterable/sortable list of all countries |
| `/countries/[slug]` | `[slug]/(profile)/page.tsx` | Deep link redirect handler (routes hash fragments to nested routes) |
| `/countries/[slug]/factbook` | `[slug]/(profile)/factbook/page.tsx` | Public Factbook overview (overview tab) |
| `/countries/[slug]/factbook/economy` | `[slug]/(profile)/factbook/economy/page.tsx` | Factbook economy indicators & charts |
| `/countries/[slug]/factbook/labor` | `[slug]/(profile)/factbook/labor/page.tsx` | Factbook labor force & employment statistics |
| `/countries/[slug]/factbook/government` | `[slug]/(profile)/factbook/government/page.tsx` | Factbook governance structure & budget spending |
| `/countries/[slug]/factbook/geography` | `[slug]/(profile)/factbook/geography/page.tsx` | Factbook geographic compliance & terrain rollup |
| `/countries/[slug]/dossier` | `[slug]/(profile)/dossier/page.tsx` | Wiki-synced dossier & native lore canvas reader |
| `/countries/[slug]/activity` | `[slug]/(profile)/activity/page.tsx` | Public nation governance timeline & community posts |
| `/countries/[slug]/modeling` | `[slug]/modeling/page.tsx` | Economic modeling/scenario simulation engine |

## Profile Navigation Structure

The profile shell (`(profile)/layout.tsx`) is being redesigned into **one immersive profile plus the Factbook deep-dive**. Until the structure is chosen, `CountryConceptSwitcher` (floating pill, bottom right, `Alt+1..3`) compares three layouts, all on real data:

| Option | `?concept=` | View |
| --- | --- | --- |
| Prototype A · Chronicle (default) | `chronicle` | `_components/prototypes/ChronicleProfileView.tsx` |
| Prototype B · Command | `command` | `_components/prototypes/CommandProfileView.tsx` |
| Factbook | `standard` | The tabbed shell below (`CountryHeader` + `CountryTabs` + route children) |

The choice is saved in `localStorage` (`ixstates_profile_concept_v3`; v2 held the retired sample-data concepts) and `?concept=` overrides it. The prototypes bring their own hero, so the banner `CountryHeader` renders only for the Factbook; the breadcrumb and Country Actions button stay on every layout. "Factbook deep-dive" in either prototype switches to `standard` for that visit (URL only, not saved) and opens `/factbook`.

The Factbook uses a 2-tier navigation hierarchy:
1. **Tier 1 (Page Top Bar — `CountryTabs.tsx`):** `Factbook` (`/factbook`), `Dossier` (`/dossier`), and `Activity` (`/activity`).
2. **Tier 2 (Factbook Sections — `MyCountryTabsList.tsx`):** `Overview`, `Economy`, `Labor`, `Government`, and `Geography` with sliding underline navigation.

## Profile prototypes

Both prototypes render one model built by `_hooks/useCountryProfileLayer.ts`, which runs the public queries in parallel; the pure parts (wiki parsing, public-record filters, chronicle merge, formatters) live in `_utils/profileLayer.ts` and are unit tested in `src/tests/app/countries/profile-layer.test.ts`. Shared pieces are in `src/components/country-profile/` (`LoreProse`, `CornerFlag`, `OwnerLayer`, `TerritoryMap`, `ChronicleTimeline`, `StateRecord`, `WorldStanding`, `EconomyTrend`, `ProfileFacts`, `QuickActions`, `useScrollSpy`).

- **Prototype A · Chronicle** — an editorial long read. Chapters Prologue → The Land → The People → The Economy → The State → The World → Chronicle each open with a National display title and wiki lore in the Reading style (serif body, 38rem measure, drop cap), with data woven in below (Stat grids, FacetList rows, the GDP trend). A sticky glass command rail (`<aside>`, `material-regular`) holds the vitals, a scroll-spy chapter index (`aria-current="location"`) and quick actions (Compare, Factbook deep-dive, Open on map, Wiki article). Below 1024px the rail becomes a summary strip and a sticky chapter pill scroller. Chapters with neither lore nor data are omitted.
- **Prototype B · Command** — a Command OS dashboard: a bento of tiles (at a glance, territory map, lore excerpt, economy, people, state + directives, world, chronicle) with a dock that jumps between domains (side rail at ≥1024px, sticky bottom bar below). "Read the story" opens a sheet with the whole lore in the Reading style; "Full chronicle" opens the complete timeline.

**Real data only.** Every figure comes from a router; a missing source renders an `EmptyState` or drops the section — never a sample figure.

**Visibility: public record only.** Visitors see lore, stats, enacted directives (`active`/`completed`), resolved national issues (`responded`/`auto_resolved`) with the decision taken and its outcome, the World Census, relations and embassies. Drafts, open issues, expired/dismissed issues, CivCap and budgets are never shown (`toPublicDirectives`, `toPublicIssueOutcomes`; government rows show offices, not budgets; embassy budgets are dropped). Issue outcomes come from `nationalIssues.getHistory`, which needs a session, so signed-out visitors see resolved issues by title only (from `mycountry.getCanonFeed`). When the signed-in viewer owns the country (`userProfile.countryId === country.id`), a tinted "Only you can see this" strip adds open-issue count, draft and in-force directive counts and a link to MyCountry.

| Part | Source |
| --- | --- |
| Identity | `country.nationalIdentity` (via `countries.getByIdWithEconomicData`), then `wikiCache.getCountryProfile` infobox |
| Lore (prologue + chapters) | `wikios.getWikitext` (IxWiki; follows `#REDIRECT`), split by section heading; non-IxWiki falls back to the `wikiCache.getCountryProfile` overview |
| Vitals, economy trend | `countries.getByIdWithEconomicData` (via `CountryDataProvider`) |
| Land (map, capital, cities, regions, story pins, geo profile, neighbours) | `countryGeo.getCountryGeoBundle`; map embed `CountryMapEmbed` (+ `geoCore.getWorldMap`) |
| Directives | `intent.getTree`, filtered to the public record |
| Issues | `nationalIssues.getHistory` (signed in), `mycountry.getCanonFeed` (titles); owner count `nationalIssues.getPendingCount` |
| Government, parliament | `government.getByCountryId`, `elections.getElectionStatus` |
| World | `mycountry.getRankings`, `diplomaticCore.getRelationships`, `diplomaticEmbassies.getEmbassies` |
| Chronicle | Infobox establishment dates + story pins + directives + resolved issues + diplomatic events (`mycountry.getCanonFeed`), on the in-game calendar |
| Compare | `countries.getSelectList` → `CountryComparisonModal` |

## Architecture

```
countries/
├── page.tsx                          # Explore page orchestrator
├── _components/                      # Explore + shared widgets
│   ├── CountriesPageModular.tsx      # Explore grid orchestrator
│   ├── CountriesFocusGridModular.tsx
│   ├── CountriesFilterSidebar.tsx
│   ├── CountriesSearch.tsx
│   ├── CountriesSortBar.tsx
│   ├── CountriesStats.tsx
│   ├── CountryComparisonModal.tsx
│   └── economy/                      # Economic modeling engine
│       └── EconomicModelingEngine.tsx
└── [slug]/
    ├── (profile)/
    │   ├── layout.tsx                # Country shell (CountryDataProvider, layout switcher, prototypes or CountryHeader + CountryTabs)
    │   ├── page.tsx                  # Hash redirect router
    │   ├── factbook/
    │   │   ├── layout.tsx            # Factbook shell (FactbookMetricsProvider + FactbookSidebar)
    │   │   ├── page.tsx              # Overview section
    │   │   ├── economy/page.tsx      # Economy section
    │   │   ├── labor/page.tsx        # Labor section
    │   │   ├── government/page.tsx   # Government section
    │   │   └── geography/page.tsx    # Geography section
    │   ├── dossier/page.tsx          # Dossier tab
    │   └── activity/page.tsx         # Activity feed tab
    ├── modeling/page.tsx             # Economic scenario engine
    ├── _components/                  # CountryHeader, CountryTabs, FactbookSidebar, FactbookSectionContent, CountryActivityPanel, prototypes/, shared/, switcher/
    ├── _hooks/useCountryPageState.ts # Tab & banner state manager
    ├── _hooks/useCountryProfileLayer.ts # Shared data layer for the profile prototypes
    ├── _types/                       # Domain types for profile pages
    ├── _utils/countryDataTransformers.ts # Telemetry vitality calculation
    └── _utils/profileLayer.ts        # Pure helpers: wiki lore, public-record filters, chronicle
```

## Data sources (verified `api.*`)

| Procedure | Used by |
| --- | --- |
| `api.countries.getAll` | Explore list (`page.tsx`) |
| `api.countries.getByIdWithEconomicData` | Profile shell (`CountryDataProvider`), modeling |
| `api.countries.getActivityRingsData` | Telemetry vitality rings (via `CountryDataProvider`) |
| `api.activities.getCountryActivity` | Factbook sidebar & activity tab |
| `api.government.getByCountryId` | Overview government structure (via `useMyCountryMetrics`) |
| `api.wikiCache.getCountryProfile` | Overview wiki content (via `useMyCountryMetrics`) |
| `api.countryGeo.getCountryGeoBundle`, `api.geoCore.getWorldMap` | Factbook sidebar map embed (via `useCountryMapEmbed`) |
| `api.system.getCurrentIxTime` | Time context |
| `api.users.getProfile`, `api.countries.getByIdAtTime` | Viewer identity (`useUserCountry`) |

All routers above are registered in `src/server/api/root.ts`.
