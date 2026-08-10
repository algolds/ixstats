# Countries / Explore

**Last updated:** August 2026

Public, read-only nation profiles plus the browse/explore experience. Anyone (signed in or not) can list all countries, search/filter/sort them, and open an individual country's public profile. Owner-side editing lives in MyCountry, not here.

## Routes

| Route | File | Purpose |
| --- | --- | --- |
| `/countries` | `page.tsx` | Explore grid: searchable/filterable/sortable list of all countries |
| `/countries/new` | `new/page.tsx` | Alternate explore entry re-using `CountriesPageModular` |
| `/countries/[slug]` | `[slug]/page.tsx` | Public country profile (tabbed Apple HIG, Facet UI) |
| `/countries/[slug]/modeling` | `[slug]/modeling/page.tsx` | Economic modeling/scenario engine for a country |

The dynamic segment is `[slug]`. The profile query accepts either a slug or an id — pages resolve `params.slug` and pass it to `api.countries.getByIdWithEconomicData` as `{ id }`.

## Profile sections (tabs)

Defined in `[slug]/_components/CountryTabs.tsx` (`TabType`), rendered by `[slug]/page.tsx`:

| Tab | Component | Content |
| --- | --- | --- |
| Overview | `CountryOverviewPanel` | Vitality rings, headline economic stats, government summary, map embed, wiki intro/infobox |
| Factbook | `FactbookSidebar` | Factbook parameters, demography, geographic stats, and reference data |
| Governance | `CountryGovernancePanel` | Executive structure, cabinet, political parties, and active laws |
| Community | `CountryActivityPanel` | Recent country governance timeline, diplomatic events, and community feed |

Deeper economic detail (indicators, labor, fiscal, demographics, comparisons, modeling) is provided by the shared economy components — see `_components/economy/README.md`.

## Architecture

```
countries/
├── page.tsx, new/page.tsx        # explore entry points
├── _components/                  # explore + shared profile UI
│   ├── CountriesPageModular.tsx  # explore page orchestrator
│   ├── CountriesFocusGridModular / CountriesGrid / CountryFocusCard
│   ├── CountriesFilterSidebar / CountriesSearch / CountriesSortBar
│   ├── CountriesHeader / CountriesPageHeader / CountriesStats
│   ├── CountriesCommandPalette.tsx
│   ├── CountryComparisonModal.tsx / charts/ComparisonCharts.tsx
│   ├── CountryInfobox.tsx
│   └── economy/                  # shared economic display components (see its README)
└── [slug]/
    ├── page.tsx                  # tabbed public profile
    ├── _components/              # CountryHeader, CountryTabs, FactbookSidebar, CountryActivityPanel
    ├── _hooks/useCountryPageState.ts   # tab state, banner mode, wiki intro/infobox
    ├── _types/                   # domain types for profile pages
    └── _utils/countryDataTransformers.ts  # vitality data derivation and transformer helpers
```

- Explore page (`page.tsx`) fetches all countries, prefetches flags via `unifiedFlagService` / `useBulkFlagCache`, and maps results into `CountryCardData` for `CountriesPageModular`.
- Profile page (`[slug]/page.tsx`) drives tab/banner state with `useCountryPageState` and derives ring data with `calculateVitalityData`.

## Data sources (verified `api.*`)

| Procedure | Used by |
| --- | --- |
| `api.countries.getAll` | Explore list (`page.tsx`, `new/page.tsx`) |
| `api.countries.getByIdWithEconomicData` | Profile, modeling |
| `api.countries.getWikiInfoboxCached` / `getWikiRichIntro` | Overview wiki content (via `useCountryPageState`) |
| `api.government.getByCountryId` | Overview government structure |
| `api.activities.getCountryActivity` | Activity tab |
| `api.economics.getCountryIndicators` / `getProjections` | Economy components |
| `api.enhancedEconomics.getEconomicDashboard` | Economy dashboard |
| `api.system.getCurrentIxTime` | Time context |
| `api.users.getProfile` | Viewer identity (`useUserCountry`) |

All routers above are registered in `src/server/api/root.ts`.

## Relationship to MyCountry

This area is the **public, read-only** view of any nation. Editing, executive controls, and owner-only intelligence live under `/mycountry` (`src/components/mycountry/`). The profile page detects the viewer's own country (`isOwnCountry` via `useUserCountry`) only to surface banner customization and the `CountryActionsMenu`; it does not expose simulation editing here.
