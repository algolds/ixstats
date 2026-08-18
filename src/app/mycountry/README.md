# MyCountry Command Suite

**Last updated:** June 2026

The MyCountry route (`/mycountry`) is the executive command suite for nation owners. Every page under it renders the same `<MyCountryRouter />` (`src/components/mycountry/MyCountryRouter.tsx`), which switches between sections client-side via `useState` + `history.pushState()` — no Next.js route transitions. Auth, country data, and atomic government state are provided once by the router's provider chain: `MobileOptimized > AuthenticationGuard > CountryDataProvider > AtomicStateProvider`.

## Routes / Sections

All `page.tsx` files below render `<MyCountryRouter />`; the active section is resolved from the pathname by `getSectionFromPathname()` in `MyCountrySidebarNav.tsx`.

| Route | Section | Loading | Notes |
| --- | --- | --- | --- |
| `/mycountry` | overview | eager | Default. Compliance modal + national-issues toasts fire here. |
| `/mycountry/executive` | executive | eager | National issues, meetings, policies, executive actions. |
| `/mycountry/diplomacy` | diplomacy | eager | Embassies, relationships, scenarios, diplomatic events. |
| `/mycountry/politics` | politics | eager | Elections, parliament, parties, legislature. |
| `/mycountry/intelligence` | intelligence | lazy (`dynamic`, `ssr:false`) | Premium-gated. |
| `/mycountry/defense` | defense | lazy | Premium-gated. |
| `/mycountry/map-editor` | map-editor | lazy | Premium-gated; not in sidebar nav. |
| `/mycountry/editor` | — | — | Separate page; renders `BuilderRouter` for post-creation country editing. |

Premium/feature gating uses `useAbility().can("access", "MyCountryFeature", …)` wrapped in `PremiumPreviewFrame`. Intelligence and defense nav items are also hidden for non-premium users unless an admin enables them via `api.admin.getNavigationSettings`.

## Key Features

- **Single-page navigation** — instant section switches, URL kept in sync via `pushState`, back/forward handled by a `popstate` listener; document title updated per section.
- **Compliance gate** — `useMyCountryCompliance` surfaces `MyCountryComplianceModal` on the overview when the country is incomplete; "Review" deep-links to `/mycountry/editor`. Snooze state persisted in `localStorage`.
- **Per-section error isolation** — each section is wrapped in `DashboardErrorBoundary` with a retry/refresh fallback keyed on `activeSection`.
- **Sidebar notifications** — `useMyCountryNotifications(countryId)` drives per-section indicator dots.
- **Demo / dev modes** — `layout.tsx` adds `DemoModeProvider`, `DevCountryViewProvider`, a demo banner, and the dev "viewing as" toolbar.

## Architecture (v5)

The MyCountry subsystem uses a **4-tier modular domain architecture** located at `src/components/mycountry/`:

| Tier | Path | Description |
| --- | --- | --- |
| **Shell** | `shell/` | Executive command center (`CommandSurface`, `ExecutiveConsole`, `ExecutiveHome`, `DomainSurface`, `DomainContextRail`, `DrillSheets`, `MyCountryRouter`, `MyCountrySidebarNav`, `domain-meta.ts`). |
| **Shared** | `shared/` | Universal reusable primitives (`cards/`, `banners/`, `headers/`, `context/`, `metrics/`, `modals/`, `primitives/`, `tabs/`). |
| **Domains** | `domains/` | 6 simulation pillar modules: `defense/`, `diplomacy/`, `economy/`, `government/`, `intelligence/`, `geography/`. |
| **Dossier** | `dossier/` | Public country dossier views, factbooks, and Wiki infobox cards. |

Directive primitives under `shared/primitives/composer/` provide preset catalogs, tuning controls, and diff previews.

Key hooks (in `src/hooks/`): `useMyCountryCompliance`, `useMyCountryNotifications`, `useNationalIssuesToast`, `usePremium`, `useUserCountry`.

## Data Sources

Verified `api.*` calls used by this route:

- **Country / economy:** `api.countries.getByIdWithEconomicData`, `getActivityRingsData`, `getLoreScore`, `getWikiSections`
- **Overview / canon:** `api.mycountry.getComplianceSummary`, `getNewsFeed`, `getCanonFeed`; `api.notifications.getCountryAlerts`
- **Executive:** `api.nationalIssues.getMyIssues` / `respond` / `dismiss`, `api.meetings.getMeetings`, `api.policies.getPolicies`, `api.quickActions.getMeetings` / `getPolicies` / `completeMeeting` / `implementDecision` / `createDecision`, `api.crisisEvents.getActive`, `api.scheduledChanges.getPendingChanges`
- **Diplomacy:** `api.diplomaticEmbassies.getEmbassies`, `api.diplomaticCore.getRelationships` / `getRecentChanges`, `api.diplomaticPolicies.getActiveForeignPolicies`, `api.diplomaticScenarios.getAllScenarios` / `recordChoice`, `api.diplomaticIntelligence.getIntelligenceBriefing`
- **Intelligence:** `api.intelligence.getExecutiveDashboard`, `api.unifiedIntelligence.getCommandView` / `getModules`, `api.intelCore.getOverview` / `getKeyFindings`, `api.intelAlerts.getAlertThresholds` / `updateAlertThreshold` / `deleteAlertThreshold`
- **Defense:** `api.security.getDefenseOverview` / `getSecurityAssessment` / `getThreatStatus` / `getMilitaryBranches`
- **Politics:** `api.elections.getElections` / `getCurrentParliament` / `getLegislature` / `getParties` / `simulateElection`
- **Government:** `api.government.getComponents` / `getCivilServiceStatus`
- **Vault / budget:** `api.vault.getBalance` / `getBudgetMultiplier` / `getTodayEarnings` / `calculatePassiveIncome`
- **Map editor:** `api.countryGeo.*` (geo bundle, compliance, subdivisions, cities, wiki populate, rollup), `api.geoCore.getCountryGeoProfile`, `api.geoFeatures.update*`, `api.cardImages.*`
- **System:** `api.system.getCurrentIxTime`, `api.users.getProfile`, `api.admin.getNavigationSettings`, `api.wiki.getSectionContent`

## Connections to Other Systems

- **Builder** — `/mycountry/editor` mounts `BuilderRouter`; redirects to `/builder` if the user has no country.
- **Maps / IxWorld** — map-editor section and `countryGeo`/`geoCore`/`geoFeatures` routers tie nation territory to the geo system.
- **ThinkPages / canon** — `getNewsFeed` and `getCanonFeed` surface narrative output on the overview.
- **Vault** — budget multipliers and passive income feed executive economics.
- **Dynamic Island** — `MyCountryDIPlugin` registers in the layout; national-issue alerts pushed via `useNationalIssuesToast`.

See `docs/systems/mycountry.md` for the authoritative system guide and executive-action/effect details.
