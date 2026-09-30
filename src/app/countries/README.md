# Countries / Explore

**Last updated:** 30 September 2026

Public, read-only nation profiles plus the browse/explore experience. Anyone (signed in or not) can list all countries, search/filter/sort them, and open an individual country's public profile. Owner-side editing lives in MyCountry, not here.

## Routes

| Route | File | Purpose |
| --- | --- | --- |
| `/countries` | `page.tsx` | Explore grid: searchable/filterable/sortable list of all countries |
| `/countries/[slug]` | `[slug]/(profile)/page.tsx` | The country profile (`CommandProfileView`); legacy hash links (`#economy`, `#dossier`, …) move to their routes |
| `/countries/[slug]/factbook` | `[slug]/(profile)/factbook/page.tsx` | Public Factbook overview (overview tab) |
| `/countries/[slug]/factbook/economy` | `[slug]/(profile)/factbook/economy/page.tsx` | Factbook economy indicators & charts |
| `/countries/[slug]/factbook/labor` | `[slug]/(profile)/factbook/labor/page.tsx` | Factbook labor force & employment statistics |
| `/countries/[slug]/factbook/government` | `[slug]/(profile)/factbook/government/page.tsx` | Factbook governance structure & budget spending |
| `/countries/[slug]/factbook/geography` | `[slug]/(profile)/factbook/geography/page.tsx` | Factbook geographic compliance & terrain rollup |
| `/countries/[slug]/dossier` | `[slug]/(profile)/dossier/page.tsx` | Wiki-synced dossier & native lore canvas reader |
| `/countries/[slug]/activity` | `[slug]/(profile)/activity/page.tsx` | Public nation governance timeline & community posts |
| `/countries/[slug]/modeling` | `[slug]/modeling/page.tsx` | Economic modeling/scenario simulation engine |

## Country profile

`/countries/[slug]` is **one profile, the Command view** (`_components/CommandProfileView.tsx`), with the **Factbook as the deep-dive**. There is no layout switcher any more (the `?concept=` parameter, `Alt` shortcuts and `ixstates_profile_concept_*` keys are gone; stale values are simply ignored).

The profile shell (`(profile)/layout.tsx`) loads the country (`CountryDataProvider`), shows the breadcrumb and the Country Actions button on every route, and shares the country, flag, ownership and cover banner with the routes below through `ProfileShellProvider` (`_components/ProfileShellContext.tsx`). It reads the active child segment (`useSelectedLayoutSegment`):

- **Profile** (`/countries/[slug]`, segment `null`): the page renders `CommandProfileView`, which brings its own hero and tabs.
- **Deep-dives** (`/factbook/**`, `/dossier`, `/activity`): the layout renders `CountryHeader` (the same `CountryHero`, from the country record) and `CountryTabs`, then the route's own page. The Factbook keeps its section pills and `FactbookSidebar` (`factbook/layout.tsx`).

Navigation has two tiers:
1. **Tier 1 (`CountryTabs.tsx`):** `Profile` (`/countries/[slug]`), `Factbook` (`/factbook`), `Dossier` (`/dossier`), `Activity` (`/activity`) — real links styled as a Facet segmented control.
2. **Tier 2 (Factbook sections — `MyCountryTabsList.tsx`):** `Overview`, `Economy`, `Labor`, `Government`, `Geography`.

Legacy hash links on the bare profile URL (`#economy`, `#labor`, `#dossier`, `#activity`, …) are redirected by `legacyHashRoute` (`src/lib/country/factbook-routes.ts`); an empty or unknown hash stays on the profile, so the profile's own anchors (`#command-economy`) work.

### The Command view

The Sovereign Command OS layout on real data, in Facet 3 (opaque `FacetCard` content, glass only for the dock):

- **Hero** (`CountryHero`, from the original profile header): the cover banner as a photo band (landscape photo, flag, media-library image or none — the owner changes it with **Change cover**; saved per country on the device), the flag tile, the name in the display face with the owner's ribbons, the motto, capital and anthem, the realm and IxnayID strip (`CountryIdentityStrip`) and the headline figures. The flag also sits as a corner watermark (`CornerFlag`), never as a full-width wash.
- **National pulse** (`PulseBanner`): a status (rapid expansion, stable and prosperous, consolidating, economic headwinds) from real GDP growth, population growth and stability, with the readings. Hidden without a GDP growth reading.
- **Dock**: domains with a scroll-spy (side rail `material-regular` ≥1024px, sticky bottom bar below) and the sovereign tools (Compare, Factbook deep-dive, Economic modeling, Open on map, Wiki article).
- **Country DNA** (`CountryDNA` + `DnaLegend`): a radar of the nation's World Census percentile per category, with the ranks as rows; **National condition** (`ConditionMatrix`): meters for the 0–100 readings the nation has (employment, approval, stability, literacy, urbanisation).
- **Tiles**: territory (map, attributes, principal cities and regions), lore (prologue; "Read the story" opens every chapter), economy (figures + GDP trend), people, state (`StateStructure`: executive, legislative and judicial branches, system, ministries; election; directives and decisions), foreign affairs (`DiplomaticMatrix`: partners vs tensions, relation/treaty/embassy counts; embassies) and the chronicle.

Pure derivations for these pieces live in `src/components/country-profile/derive.ts` (`pulseStatus`, `toDnaAxes`, `conditionPillars`, `stateBranches`, `diplomaticMatrix`) and are tested in `src/tests/app/countries/command-derive.test.ts`. Pieces of the old concept with no real data — defence readiness, trade balance, industrial sectors, peer benchmarks with fixed scores — are not shown.

**Reading style.** Lore uses the wiki Reading face (`--wikios-font-reading`, Geist Sans — the token `.wikios-article-content` reads) at a 38rem measure with 1.7 leading and a tinted drop cap in the National display face (`LoreProse`, `READING_STYLE`). Titles use Facet text styles; figures use tabular numerals. The unloaded Baskerville serif is not used (pinned in `facet-guards.test.ts`).

### Data layer

The profile renders one model built by `_hooks/useCountryProfileLayer.ts`, which runs the public queries in parallel; the pure parts (wiki parsing, chronicle merge, formatters) live in `_utils/profileLayer.ts` and are unit tested in `src/tests/app/countries/profile-layer.test.ts`. Shared pieces are in `src/components/country-profile/`.

**Real data only.** Every figure comes from a router; a missing source renders an `EmptyState` or drops the section — never a sample figure.

**Visibility: public record only, enforced on the server.** Visitors — signed in or not — see lore, stats, enacted directives (`active`/`completed`), resolved national issues (`responded`/`auto_resolved`) with the decision taken, its outcome and when it was resolved, the World Census, relations and embassies, all from **`countries.getPublicRecord`** (a `publicProcedure`; rules in `src/lib/country/public-record.ts`). Drafts, abandoned directives, open/expired/dismissed issues, package line items, CivCap, budgets and applied consequences never leave the server. The other readers were tightened to match:

- `intent.getTree` returns the full tree only to the nation's owner (the user acting as it or its `ownerUserId`) and privileged roles; anyone else gets enacted directives only, with `changesJson`, `civCapCost` and `cooldownUntil` redacted.
- `nationalIssues.getHistory` is FORBIDDEN unless the caller owns the nation or holds a privileged role (`assertCountryWriteAccess`).
- The rest of the owner's side is owner/privileged only too: every other `nationalIssues` player procedure (open issues, issue detail, pending count, respond/dismiss/mark viewed, recon), `intent.suggest`, `intent.getStatus`, `intent.getLinkedIssues` and `policies.getPolicyReconContext` (CivCap). `intent.getOutcome` answers for enacted directives only unless the caller owns the nation, and `policies.getPolicies` drops drafts for non-owners. Full list in [MyCountry](../../../docs/systems/mycountry.md) (Visibility); tested in `src/tests/server/api/routers/country-private-record.test.ts`.

Tested in `src/tests/server/api/routers/country-public-record.test.ts`. When the signed-in viewer owns the country (`userProfile.countryId === country.id`), a tinted "Only you can see this" strip adds open-issue, draft and in-force directive counts (from the owner's own `intent.getTree` and `nationalIssues.getPendingCount`) and a link to MyCountry.

| Part | Source |
| --- | --- |
| Identity | `country.nationalIdentity` (via `countries.getByIdWithEconomicData`), then `wikiCache.getCountryProfile` infobox |
| Lore (prologue + chapters) | `wikios.getWikitext` (IxWiki; follows `#REDIRECT`), split by section heading; non-IxWiki falls back to the `wikiCache.getCountryProfile` overview |
| Vitals, pulse, condition, economy trend | `countries.getByIdWithEconomicData` (via `CountryDataProvider`) |
| Land (map, capital, cities, regions, story pins, geo profile, neighbours) | `countryGeo.getCountryGeoBundle`; map embed `CountryMapEmbed` (+ `geoCore.getWorldMap`) |
| Directives, issue outcomes | `countries.getPublicRecord`; owner counts `intent.getTree` + `nationalIssues.getPendingCount` (owner only) |
| Government, parliament | `government.getByCountryId`, `elections.getElectionStatus` |
| Country DNA, world | `mycountry.getRankings`, `diplomaticCore.getRelationships`, `diplomaticEmbassies.getEmbassies` |
| Chronicle | Infobox establishment dates + story pins + directives + resolved issues + decisions and diplomatic events (`mycountry.getCanonFeed`), on the in-game calendar |
| Cover | `unsplashService` (landscape), the flag, or a media-library image (`MediaSearchModal`) |
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
    │   ├── layout.tsx                # Country shell (CountryDataProvider, breadcrumb, actions; CountryHeader + CountryTabs on deep-dives)
    │   ├── page.tsx                  # The profile: CommandProfileView (+ legacy hash redirects)
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
    ├── _components/                  # CommandProfileView, CountryHeader, CountryTabs, ProfileShellContext, FactbookSidebar, FactbookSectionContent, CountryActivityPanel
    ├── _hooks/useCountryPageState.ts # Country Actions + cover banner state
    ├── _hooks/useCountryProfileLayer.ts # The profile's data layer
    ├── _types/                       # Domain types for profile pages
    ├── _utils/countryDataTransformers.ts # Telemetry vitality calculation
    └── _utils/profileLayer.ts        # Pure helpers: wiki lore, chronicle, formatters (re-exports the public-record rules)
```

## Data sources (verified `api.*`)

| Procedure | Used by |
| --- | --- |
| `api.countries.getAll` | Explore list (`page.tsx`) |
| `api.countries.getByIdWithEconomicData` | Profile shell (`CountryDataProvider`), modeling |
| `api.countries.getPublicRecord` | Profile: enacted directives and resolved issue outcomes (public, server-filtered) |
| `api.countries.getActivityRingsData` | Telemetry vitality rings (via `CountryDataProvider`) |
| `api.activities.getCountryActivity` | Factbook sidebar & activity tab |
| `api.government.getByCountryId` | Overview government structure (via `useMyCountryMetrics`) |
| `api.wikiCache.getCountryProfile` | Overview wiki content (via `useMyCountryMetrics`) |
| `api.countryGeo.getCountryGeoBundle`, `api.geoCore.getWorldMap` | Factbook sidebar map embed (via `useCountryMapEmbed`) |
| `api.system.getCurrentIxTime` | Time context |
| `api.users.getProfile`, `api.countries.getByIdAtTime` | Viewer identity (`useUserCountry`) |

All routers above are registered in `src/server/api/root.ts`.
