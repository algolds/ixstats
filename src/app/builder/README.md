# Builder Overview (v3)

**Last updated:** August 2026

The MyCountry Builder (`/builder`) is a standalone core system that lets a signed-in user create a new nation — or edit an existing one — by configuring its foundation, identity, government, and economics before committing to the live MyCountry simulation. The builder is a single-page router: all sections render in place via `useState` + `window.history.pushState()` (no Next.js route transitions), with a `popstate` listener for back/forward and deep links via the `?section=` query param.

## Builder flow

Sections are defined in `lib/builder-theme.ts` (`BuilderSection` / `BUILD_STEPS`). The build flow proceeds in order; once foundation is complete, the remaining sections are freely accessible.

| Section | Purpose | Notable sub-tabs |
| --- | --- | --- |
| `foundation` | Pick a starting/reference country (eligible-country grid) to seed the build | — |
| `identity` | National identity, names, capital, flag & symbols | Archetype/Preset, Basic, Culture, Technical |
| `government` | Atomic government components + traditional structure, departments, budget/revenue | Core Setup, Departments, Budget & Revenue, Verify & Preview |
| `economics` | Core indicators, sectors, labor, demographics, tax system | Components, Sectors, Labor, Demographics, Tax |
| `preview` | Final review, then commit the nation | — |
| `import` | Import a nation from a wiki article (also reached at `/builder/import`, which redirects to `?section=import`) | — |

On commit, `api.countries.createCountry` (create mode) or `api.countries.updateCountry` (edit mode) runs and the user is routed to `/mycountry`. Edit mode reuses the same router (`mode="edit"`, sections mapped to `/mycountry/editor`).

## Key features

- **Atomic components** — Government, economic, and tax component catalogs (with synergies/conflicts) drive both setup and live simulation. Sourced from `atomicGovernment`, `atomicEconomic`, and `atomicTax` routers; selectors live under `components/enhanced/`.
- **Wiki import** — `ImportSection` searches a wiki and parses infoboxes/flags to pre-fill a build; `WikiDeepScanPanel` runs a deeper scan. Backed by `api.countries.searchWiki`, `api.countries.parseInfobox`, `api.countries.getWikiPageImages`, and `api.wikiCache.builderDeepScan` (cached).
- **Economy inputs** — Builder economy state is persisted and synced server-side, with cross-syncing between economy, government, and tax so changes stay consistent.
- **Economic archetypes** — Reusable economy presets via `api.economicArchetypes.*`.
- **Custom government types** — User-defined government types and field values via `api.customTypes.*`.
- **Policies** — Policy selection and effect calculation via `api.policies.*`.

## Architecture

| Path | Purpose |
| --- | --- |
| `page.tsx` | Thin entry — renders `<BuilderRouter />` |
| `import/page.tsx` | Legacy route — redirects to `/builder?section=import` |
| `components/BuilderRouter.tsx` | Single-page router: section state, URL sync, auth guard, layout |
| `components/enhanced/AtomicBuilderPage.tsx` | Inner build-step content (foundation → preview), create/edit submit logic |
| `components/enhanced/` | Atomic selectors, economy builder, national identity, government preview, context |
| `components/sections/ImportSection.tsx` | Wiki import flow |
| `import/_components/` | `EligibleCountryGrid`, `WikiDeepScanPanel`, and related import UI |
| `sections/` | Step section components (CoreIndicators, Economy, Labor, Demographics, FiscalSystem, GovernmentStructure, GovernmentSpending) |
| `components/` | Sidebar layout, notch bar, step nav, preview widget, vitality rings, welcome modal |
| `hooks/` | `useBuilderActions`, `useBuilderAlerts`, `useBuilderState`, `useEconomyBuilderSync`, `useGovernmentSpending` |
| `lib/builder-theme.ts` | Section/step definitions, theming, section↔legacy-step mapping |
| `data/archetypes/` | Archetype/preset data |

State is provided by `BuilderStateContext` (`components/enhanced/context/`) with `BuilderFilterProvider` layered on top; theming follows the MyCountry amber/gold identity with per-section accents.

## Data sources (verified `api.*` calls)

| Router | Procedures used |
| --- | --- |
| `countries` | `createCountry`, `updateCountry`, `getByIdAtTime`, `getEligibleCountries`, `searchWiki`, `parseInfobox`, `getWikiPageImages` |
| `mycountry` | `updateCountry` |
| `economics` | `getEconomyBuilderState`, `saveEconomyBuilderState`, `syncEconomyWithGovernment`, `syncEconomyWithTax` |
| `government` | `getByCountryId`, `getComponents` |
| `taxSystem` | `getByCountryId` |
| `policies` | `calculatePolicyEffects`, `savePolicySelections` |
| `atomicGovernment` / `atomicEconomic` / `atomicTax` | `listComponents` |
| `economicArchetypes` | `getAllArchetypes`, `incrementArchetypeUsage` |
| `customTypes` | `getUserCustomGovernmentTypes`, `getFieldSuggestions`, `upsertCustomGovernmentType`, `upsertFieldValue` |
| `wikiCache` | `builderDeepScan` |
| `countryGeo` | `upsertCity` |

All routers are registered in `src/server/api/root.ts`.

## Connections

- **MyCountry** — On commit the user lands on `/mycountry`; edit mode round-trips through `/mycountry/editor`. Builder selections persist to the same Prisma models the executive suite reads.
- **Economy & calculations** — Economy/government/tax state is cross-synced server-side; see `docs/systems/economy.md` and `docs/systems/calculations.md`.
- **Wiki / import** — Import and flag fetching share wiki services and caching; see `docs/systems/builder.md` for the authoritative flow.

## Maintenance checklist

- Update `docs/systems/builder.md` and `/help/getting-started/*` after changing steps or data contracts.
- Keep section definitions in `lib/builder-theme.ts` in sync with router/sidebar UI.
- Ensure new fields persist to Prisma and surface in MyCountry; include backfill logic for required fields.
