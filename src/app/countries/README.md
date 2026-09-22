# Countries / Explore

**Last updated:** August 2026

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

The public profile employs a 2-tier Apple Design navigation hierarchy:
1. **Tier 1 (Page Top Bar — `CountryTabs.tsx`):** `Factbook` (`/factbook`), `Dossier` (`/dossier`), and `Activity` (`/activity`) with physical Framer Motion spring layout indicators.
2. **Tier 2 (Factbook Sections — `MyCountryTabsList.tsx`):** `Overview`, `Economy`, `Labor`, `Government`, and `Geography` with sliding underline navigation.

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
    │   ├── layout.tsx                # Country shell (CountryDataProvider + CountryHeader + CountryTabs)
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
    ├── _components/                  # CountryHeader, CountryTabs, FactbookSidebar, CountryActivityPanel
    ├── _hooks/useCountryPageState.ts # Tab & banner state manager
    ├── _types/                       # Domain types for profile pages
    └── _utils/countryDataTransformers.ts # Telemetry vitality calculation
```

## Data sources (verified `api.*`)

| Procedure | Used by |
| --- | --- |
| `api.countries.getAll` | Explore list (`page.tsx`) |
| `api.countries.getByIdWithEconomicData` | Profile shell (`CountryDataProvider`), modeling |
| `api.countries.getActivityRingsData` | Telemetry vitality rings |
| `api.activities.getCountryActivity` | Factbook sidebar & activity tab |
| `api.government.getByCountryId` | Overview government structure (via `useMyCountryMetrics`) |
| `api.wikiCache.getCountryProfile` | Overview wiki content (via `useMyCountryMetrics`) |
| `api.maps.getCountryGeometry` | Factbook sidebar map embed |
| `api.system.getCurrentIxTime` | Time context |
| `api.users.getProfile` | Viewer identity (`useUserCountry`) |

All routers above are registered in `src/server/api/root.ts`.
