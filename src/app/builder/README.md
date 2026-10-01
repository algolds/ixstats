# Builder Overview (v4)

**Last updated:** September 2026

The MyCountry Builder (`/builder`) is a standalone core system that lets a signed-in user create a new nation — or edit an existing one — by configuring its foundation, identity, government, and economics before committing to the live MyCountry simulation. The builder is a single-page router: all sections render in place via `useState` + `window.history.pushState()` (no Next.js route transitions), with a `popstate` listener for back/forward and deep links via the `?section=` query param.

## Builder flow

Sections are defined in `lib/builder-theme.ts` (`BuilderSection` / `BUILD_STEPS`); the header stepper (`HEADER_NAV_STEPS`) shows four steps — Foundation (foundation + identity), Government, Economics, Preview & Create. The build flow proceeds in order; once foundation is complete, the remaining sections are freely accessible. The foundation step is skipped in edit mode and when starting from scratch or an import.

| Section | Purpose | Notable sub-tabs |
| --- | --- | --- |
| `foundation` | Pick a starting/reference country (eligible-country grid) to seed the build | — |
| `identity` | National identity, names, capital, flag & symbols | Basic, Culture, Technical |
| `government` | Atomic government components + traditional structure, departments, budget/revenue | Core Setup, Departments, Budget & Revenue, Verify & Preview |
| `economics` | Core indicators, sectors, labor, demographics, tax system | Components, Sectors, Labor, Demographics, Tax |
| `preview` | Final review, then commit the nation | — |
| `import` | Import a nation from a wiki article (also reached at `/builder/import`, which redirects to `?section=import`) | — |

On commit, `api.countries.createCountry` (create mode) or `api.countries.updateCountry` (edit mode) runs and the user is routed to `/mycountry`. Edit mode reuses the same router (`mode="edit"`, sections mapped to `/mycountry/editor`).

## Key features

- **Atomic components** — Government, economic, and tax component catalogs (with synergies/conflicts) drive both setup and live simulation. The catalogs are static client data (`src/components/mycountry/domains/government/atoms/`, `src/lib/economy/data/`, `src/lib/government/tax/atomic-tax-components.ts`); selectors live under `components/enhanced/`. Synergies/conflicts are re-checked server-side on save (`src/lib/government/synergy.ts`).
- **Wiki import** — `ImportSection` searches a wiki and parses infoboxes/flags to pre-fill a build; `WikiDeepScanPanel` runs a deeper scan. Backed by `api.countries.searchWiki`, `api.countries.parseInfobox`, `api.countries.getWikiPageImages`, and `api.wikiCache.builderDeepScan` (cached).
- **Economy inputs** — Builder economy state is persisted and synced server-side, with cross-syncing between economy, government, and tax so changes stay consistent.
- **Economic archetypes** — Reusable economy presets (`src/lib/economy/archetypes/`); usage tracked via `api.economicArchetypes.incrementArchetypeUsage`.
- **Custom government types** — User-defined government types and field values via `api.customTypes.*`.
- **Companion guide** — `BuilderGuideSheet` (Milestones / Rules tabs) opened from the studio header and auto-opened on first visit to Government and Economics (`builder-guide-context.tsx`).
- **Drafts & autosave** — `api.builderDraft.*` (`useBuilderPersistence`) plus autosave history in edit mode.

## Architecture

| Path | Purpose |
| --- | --- |
| `page.tsx` | Thin entry — renders `<BuilderRouter />` |
| `import/page.tsx` | Legacy route — redirects to `/builder?section=import` |
| `components/BuilderRouter.tsx` | Single-page router: section state, URL sync, auth guard, layout |
| `components/enhanced/AtomicBuilderPage.tsx` | Inner build-step content (foundation → preview), create/edit submit logic |
| `components/enhanced/` | Atomic selectors, economy builder, national identity, government preview, context, `steps/`, `tabs/`, `sections/` (step renderer, preview) |
| `components/sections/ImportSection.tsx` | Wiki import flow |
| `import/_components/` | `EligibleCountryGrid`, `WikiDeepScanPanel`, and related import UI |
| `components/` | Sidebar layout, studio header/stepper, step footer, guide sheet + context, mode toggle, welcome modal, editor save bar |
| `hooks/` | `useBuilderState`, `useBuilderActions`, `useBuilderAlerts`, `useBuilderPersistence`, `useBuilderSync`, `useBuilderEditMode`, `useEditChanges`, `useStepCompletion`, `useBuilderKeyboardShortcuts` |
| `lib/builder-theme.ts` | Section/step definitions, theming, section↔legacy-step mapping |
| `data/` | Guide content (`contextual-help.ts`, `guide-rules.ts`, `onboarding-tutorial.ts`) |
| `lib/` | Theme, wiki parsers/assembler, economy defaults, field importance, edit-change diffing |
| `primitives/` | `CountryGrid`, field indicators, advanced-fields disclosure |

State is provided by `BuilderStateProvider` (`components/enhanced/context/`) with `BuilderFilterProvider` and `BuilderGuideProvider` layered on top; theming follows the MyCountry amber/gold identity with per-section accents.

## Data sources (verified `api.*` calls)

| Router | Procedures used |
| --- | --- |
| `countries` | `createCountry`, `updateCountry`, `getByIdAtTime`, `getEligibleCountries`, `getEditorRelations`, `searchWiki`, `parseInfobox`, `getWikiPageImages` |
| `builderDraft` | `get`, `save`, `clear` |
| `economics` | `getEconomyBuilderState`, `autoSaveEconomyBuilder` |
| `government` | `getByCountryId` |
| `taxSystem` | `getByCountryId` |
| `economicArchetypes` | `incrementArchetypeUsage` |
| `autosaveHistory` | `getAutosaveHistory`, `getAutosaveStats` |
| `customTypes` | `getUserCustomGovernmentTypes`, `getFieldSuggestions`, `upsertCustomGovernmentType`, `upsertFieldValue` |
| `wikiCache` | `builderDeepScan` |
| `countryGeo` | `getCountryGeoBundle`, `upsertCity` |

All routers are registered in `src/server/api/root.ts`.

## Connections

- **MyCountry** — On commit the user lands on `/mycountry`; edit mode round-trips through `/mycountry/editor`. Builder selections persist to the same Prisma models the executive suite reads.
- **Economy & calculations** — Economy/government/tax state is cross-synced server-side; see `docs/systems/economy.md` and `docs/systems/calculations.md`.
- **Wiki / import** — Import and flag fetching share wiki services and caching; see `docs/systems/builder.md` for the authoritative flow.

## Maintenance checklist

- Update `docs/systems/builder.md` and `src/content/help/getting-started/*` after changing steps or data contracts.
- Keep section definitions in `lib/builder-theme.ts` in sync with router/sidebar UI.
- Ensure new fields persist to Prisma and surface in MyCountry; include backfill logic for required fields.
- Keep the heading outline: one h1 per page (`FoundationHero`, the Archetype sub-step's title, the visually hidden h1 in `BuilderStudioHeader` / `FoundationPathSelector` / `ImportSection`, or `EditorHeader` in edit mode); step content starts at h2 and never skips a level (Facet spec §16.8, pinned by `src/tests/architecture/facet-hig-leftovers.test.ts`).
- Image actions revealed on hover must stay usable on touch screens: add `IMAGE_SCRIM_TOUCH_CLUSTER` / `IMAGE_SCRIM_TOUCH_ACTION` or `IMAGE_SCRIM_TOUCH_BAND` from `lib/image-scrim.ts`, and keep each action a labelled button with a 44pt target.
