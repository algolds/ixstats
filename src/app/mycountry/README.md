# MyCountry Command Suite

**Last updated:** September 2026

The MyCountry route (`/mycountry`) is the executive command suite for nation owners. Every page under it renders the same `<MyCountryRouter />` (`src/components/mycountry/shell/MyCountryRouter.tsx`), which switches between sections client-side via `useState` + `history.pushState()` — no Next.js route transitions — and renders every section through the single `CommandSurface`. Auth and country data are provided once by the router's provider chain: `MobileOptimized > AuthenticationGuard > CountryDataProvider`.

## Routes / Sections

All `page.tsx` files below (except `/mycountry/editor`) render `<MyCountryRouter />`; the active section is resolved from the pathname by `getSectionFromPathname()` in `MyCountrySidebarNav.tsx`.

| Route                     | Section    | Loading          | Notes                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ---------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/mycountry`              | overview   | eager            | Default (`ExecutiveHome`). Compliance modal + national-issues toasts fire here.                                                                                                                                                                                                                                                        |
| `/mycountry/executive`    | executive  | eager            | Directives page (`ExecutiveConsole` → `directives/DirectivesWorkspace`): declare, track in force, history.                                                                                                                                                                                                                             |
| `/mycountry/economy`      | economy    | eager            | Budget, fiscal and trade consoles (`EconomyDrillDown`).                                                                                                                                                                                                                                                                                |
| `/mycountry/diplomacy`    | diplomacy  | lazy panel       | Embassies, relationships, alliances, cultural exchanges, scenarios.                                                                                                                                                                                                                                                                    |
| `/mycountry/politics`     | politics   | eager            | Cabinet, parties, legislature, bills, power brokers (`PoliticsDrillDown`).                                                                                                                                                                                                                                                             |
| `/mycountry/defense`      | defense    | lazy (`dynamic`) | Premium-gated (`PremiumPreviewFrame`).                                                                                                                                                                                                                                                                                                 |
| `/mycountry/intelligence` | defense    | lazy             | Maps to the Defense section — there is no standalone intelligence surface.                                                                                                                                                                                                                                                             |
| `/mycountry/map-editor`   | map-editor | own page         | Full-screen country map editor (`src/app/mycountry/map-editor/page.tsx` → `MapEditorOverlay`), the same editor that opens in place on `/maps`. Signed-out users go to sign-in, users without a country to the builder. Client-side section switches to `map-editor` inside the shell (the Editor toggle) still render `ExecutiveHome`. |
| `/mycountry/editor`       | —          | —                | Separate page; renders `BuilderRouter` for post-creation country editing.                                                                                                                                                                                                                                                              |

Premium/feature gating uses `useAbility().can("access", "MyCountryFeature", …)` wrapped in `PremiumPreviewFrame`. Intelligence and defense nav items are also hidden for non-premium users unless an admin enables them via `api.admin.getNavigationSettings`.

## Key Features

- **Overview layout**: the page header (country name and identity, Profile and Editor, the one **Declare Directive** button with weekly slot status), the domain tiles, then the priority hero (the only hero, with the flag watermark), the agenda (a plain list of open issues, active directives and upcoming elections, each with a done action), recent activity, and National standing, World Census and Territory in the rail. Gold is reserved for **Declare Directive** and meaningful status (`shell/status-tone.ts`); see `docs/systems/mycountry.md`.
- **Single-page navigation** — instant section switches, URL kept in sync via `pushState`, back/forward handled by a `popstate` listener; document title updated per section.
- **Compliance gate** — `useMyCountryCompliance` surfaces `MyCountryComplianceModal` on the overview when the country is incomplete; "Review" deep-links to `/mycountry/editor`. Snooze state persisted in `localStorage`.
- **Per-section error isolation** — each section is wrapped in `DashboardErrorBoundary` with a retry/refresh fallback keyed on `activeSection`.
- **Sidebar notifications** — `MyCountrySidebarNav` accepts a per-section `notifications` map for indicator dots.
- **Demo / dev modes** — `layout.tsx` adds `DemoModeProvider`, `DevCountryViewProvider`, a demo banner, the dev "viewing as" toolbar, and the `MyCountryHalo` plugin.

## Architecture (v6)

The MyCountry subsystem uses a **4-tier modular domain architecture** located at `src/components/mycountry/`:

| Tier        | Path       | Description                                                                                                                                                                                                                                                                        |
| ----------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shell**   | `shell/`   | Executive command center (`CommandSurface`, `ExecutiveConsole`, `ExecutiveHome`, `DomainSurface`, `DomainContextRail`, `DrillSheets`, `EconomyDrillDown`, `PoliticsDrillDown`, `rails/`, `agenda/`, `MyCountryRouter`, `MyCountrySidebarNav`, `domain-meta.ts`, `status-tone.ts`). |
| **Shared**  | `shared/`  | Universal reusable primitives (`cards/`, `headers/`, `modals/`, `primitives/`, `tabs/`).                                                                                                                                                                                           |
| **Domains** | `domains/` | 5 simulation pillar modules: `defense/`, `diplomacy/`, `economy/`, `government/`, `geography/`.                                                                                                                                                                                    |
| **Dossier** | `dossier/` | Public country dossier views, factbooks, and Wiki infobox cards.                                                                                                                                                                                                                   |

The Directives page lives in `directives/` (`DirectivesWorkspace`, status strip, directive cards, recorded outcome). Its composer is `shared/primitives/IntentComposer.tsx`, with the steps and preset catalog in `shared/primitives/composer/` (presets in `directive-presets.ts`).

Key hooks (in `src/hooks/`): `useMyCountryCompliance`, `useMyCountryMetrics`, `useNationalIssues`, `useNationalIssuesToast`, `usePremium`, `useUserCountry`.

## Data Sources

Verified `api.*` calls used by this route (`src/app/mycountry`, `src/components/mycountry`, and the key hooks):

- **Country / economy:** `api.countries.getByIdWithEconomicData` / `getByIdBasic` / `getByIdAtTime` / `getActivityRingsData` / `getAll`, `api.economics.getEconomyConfiguration` / `updateFiscalSystem`, `api.taxSystem.getByCountryId`, `api.wikiCache.getCountryProfile`, `api.transport.getNationalMobilityProfile`
- **Overview / canon:** `api.mycountry.getCountryDashboard` / `getCanonFeed`, `api.achievements.getRecentByCountry`, `api.thinkpages.createPost`
- **Executive:** `api.nationalIssues.getMyIssues` / `getIssue` / `markViewed` / `respond` / `dismiss` / `commissionRecon` / `getReconReveal` / `getHistory` / `getPendingCount`, `api.intent.*` (suggest, commit, tree, status, update status, linked issues, outcome, summation draft), `api.policies.getPolicyReconContext` (CivCap), `api.quickActions.createMeeting`, `api.historical.getCountryHistory`
- **Diplomacy:** `api.diplomaticCore.*` (relationships, shared data, follow, goals), `api.diplomaticEmbassies.*` (establish, close, reopen, delete, profile, cost), `api.diplomaticPolicies.*` (foreign policies, alliances), `api.diplomaticCultural.*` (cultural exchanges), `api.diplomaticScenarios.getAllScenarios` / `recordChoice`
- **Defense:** `api.security.getSecurityAssessment` / `getMilitaryBranches` / `getBorderSecurity` / `getConflicts` / `getOperations`, plus the military-asset, operation and conflict mutations
- **Politics:** `api.elections.getElections` / `getCurrentParliament` / `getLegislature` / `getParties`
- **Government:** `api.government.getByCountryId` / `getFullByCountryId` / `getCivilServiceStatus`, `api.autosaveHistory.getAutosaveHistory` / `getAutosaveStats`
- **Vault / budget:** `api.vault.getBalance` / `getBudgetMultiplier` / `getTodayEarnings` / `calculatePassiveIncome`
- **Map editor:** `api.countryGeo.*` (geo bundle, compliance, subdivisions, cities, wiki populate, rollup), `api.geoCore.getCountryGeoProfile`, `api.geoFeatures.update`, `api.cardImages.*`
- **System:** `api.system.getCurrentIxTime`, `api.users.getProfile` / `getMembershipStatus`, `api.admin.getNavigationSettings`, `api.wikios.getSectionContent`

## Connections to Other Systems

- **Builder** — `/mycountry/editor` mounts `BuilderRouter` in edit mode (editor header, section tiles with change counts, persistent save bar; see [Country Editor](../../../docs/systems/builder.md#country-editor-edit-mode)); redirects to `/mycountry/builder` if the user has no country.
- **Maps / IxWorld** — map-editor section and `countryGeo`/`geoCore`/`geoFeatures` routers tie nation territory to the geo system.
- **ThinkPages / canon** — `getCanonFeed` surfaces narrative output on the overview.
- **Vault** — budget multipliers and passive income feed executive economics.
- **Halo** (formerly Dynamic Island) — `MyCountryHalo` registers in the layout; national-issue alerts pushed via `useNationalIssuesToast`.

See `docs/systems/mycountry.md` for the authoritative system guide and executive-action/effect details.
