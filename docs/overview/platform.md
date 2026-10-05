# Platform Overview

**Last updated:** September 2026

IxStates (dev codename: IxStats) is an alternate-history and nation-simulation platform that brings together strategic planning, collaborative storytelling, and operational dashboards. The codebase balances narrative-first UX with a data-rich backend, letting storytellers, game masters, and analysts all share a consistent source of truth.

## Core Goals
- Provide a **command experience** for nation owners through the MyCountry suite (`src/app/mycountry`)
- Deliver transparent **economic, diplomatic, and intelligence data** backed by tRPC routers in `src/server/api/routers`
- Encourage **collaboration** through ThinkPages, ThinkShare, achievements, and live feeds
- Support **rapid worldbuilding** with builder flows, wiki import tooling, and help content directly in the app

## Audience Personas
| Persona | Needs | Key Routes |
| --- | --- | --- |
| Nation Executive | Real-time intel, compliance, defense posture, elections | `/mycountry`, `/mycountry/intelligence`, `/mycountry/politics` |
| Game Master | Monitoring, audit scripts, environment management | `/admin`, `scripts/audit` |
| Analyst / Researcher | Economic stats, diplomacy data, exports | `/dashboard`, `/leaderboards`, `/thinkpages` |
| Collector / Trader | Card packs, trading, IxVault management, marketplace | `/vault`, `/vault/cards`, `/vault/marketplace` |
| New Player | Guided onboarding, documentation, tutorials | `/setup`, `/help`, `/help/getting-started/*`, docs in `docs/overview` |

## Release Cadence & Versioning

IxStates follows an OS-inspired model (`Major.Minor.Patch` + permanent epoch **release name** + **channel**). Apps / Engines / Systems each carry a single capability integer. Full spec: [`revision.md`](../reference/revision.md); single source of truth is the **Version Registry** at [`src/lib/buildVersion.ts`](../../src/lib/buildVersion.ts).

<!-- BEGIN_DOCS:VERSION_MATRIX -->
| Capability Domain | Component / Layer | Version / Release | Channel / Granularity |
| :--- | :--- | :---: | :--- |
| **Platform** | **IxStates (Lobster Crosby)** | **1.4.0 "Lobster Crosby"** | **Release Candidate** |
| **Apps** | IxWorld | v2 | Standalone & Embedded Maps Engine |
| | WikiOS | v1 | Headless Wiki & Canvas Architecture |
| | IxVault | v2 | Cards, Credits & Marketplace |
| **Engines** | MyCountry Engine | v4 | Deterministic Nation Simulation |
| | Concord Engine | v2 | Living World Simulation & Events |
| | Atlas Engine | v5 | Spatial Math & Geometry Pipeline |
| **Systems** | MyCountry UI | v6 | 4-Tier Command Architecture |
| | Nation Builder | v4 | Statecraft & Tax Builder Subsystems |
| | ThinkPages | v2 | Social Knowledge & Feed Components |
| | Achievements | v2 | Awards & LoreWards Resync |
| | Stash | v1 | Article Stashing (was LoreStash) |
| | Repository | v2 | Commons Media Explorer |
| | Halo | v6 | Contextual Overlay System |
| | Onoma | v4 | Conlang & Linguistics Studio |
| **Design** | Facet | v4 | Refraction / Depth Design System |
<!-- END_DOCS:VERSION_MATRIX -->

### Active Frameworks & Tooling

<!-- BEGIN_DOCS:FRAMEWORK_MATRIX -->
| Package / Layer | Version | Notes |
| :--- | :---: | :--- |
| **Next.js** | 16.3.6 | App Router architecture, Turbopack |
| **React** | 19.2.8 | React 19 concurrent features |
| **TypeScript** | 7.0.2 | Native Go Engine concurrency |
| **Prisma** | 6.19.3 | Multi-file schema partitioning |
| **tRPC** | 11.18.0 | Domain-split modular routers |
| **Tailwind CSS** | 4.3.3 | v4 CSS-first theme configuration |
| **Zod** | 4.4.3 | Schema validation |
| **Oxlint** | 1.80.0 | Flat config, TS 7 native (50-100× faster) |
| **Jest** | 30.4.2 | Unit and characterization suites |
| **Runtime** | Bun 1.4+ | Native concurrency & virtual store |
<!-- END_DOCS:FRAMEWORK_MATRIX -->

Documentation updates must accompany feature work; use this overview and [`docs/README.md`](../README.md) as canonical entry points. After a major change, reference [`revision.md`](../reference/revision.md) and confirm with the team whether any version should bump.

## Platform Hierarchy

```
IxStates (platform — release: Lobster Crosby, channel: Release Candidate)
├── Apps (capability version): IxWorld, WikiOS (incl Canvas editor + Image Repository), IxVault (Cards/Credits/Packs/Lore)
├── Engines (sim cores): MyCountry Engine, Concord (living-world/crises/NPCs), Atlas (spatial/worldgen)
├── Core Systems: MyCountry (command UI), Builder (statecraft/tax), ThinkPages (knowledge/feed), Achievements, Stash, Repository, Halo, Onoma
├── Design System: Facet (glass/physics)
├── Platform Utilities: IxTime, IxnayID
├── Inherits platform version: IxForum, Experimental Labs (Onoma/Vexel/Sandbox)
└── Navigation Hubs: Dashboard, Explore/Countries, Feed
```

Each system has a dedicated guide in `docs/systems`. Cross-cutting architecture details live in `docs/architecture`.

## How to Use This Document
- Share with new contributors during onboarding
- Reference when planning roadmap or scoping new pillars
- Keep the persona table aligned with actual routes and experiences

The platform overview should evolve alongside major releases. Update the "Platform Hierarchy" and persona mappings whenever new modules ship or old modules retire.

## Feature Map

> **Merged from:** docs/overview/feature-map.md

This section inventories the primary code areas for auditing coverage, mapping dependencies, or planning refactors.

### App Router (`src/app`)

**IxVault (Integrated Product):** `/vault` — cards, collections, crafting, trading, marketplace, packs, lore cards, NS import.

**MyCountry (Core System):** `/mycountry` (executive command suite), `/mycountry/executive`, `/mycountry/economy`, `/mycountry/diplomacy`, `/mycountry/intelligence`, `/mycountry/defense`, `/mycountry/politics`, `/mycountry/map-editor`, `/mycountry/editor`, `/mycountry/builder`.

**ThinkPages (Core System):** `/thinkpages` — social knowledge sharing (ThinkShare, ThinkTanks, IxTwitter).

**Achievements & Awards (Core System):** `/achievements` — achievement explorer and detail views.

**MyCountry Builder (Core System):** `/builder` — nation creation and editor flows.

**Admin CMS (Core System):** `/admin` — administrative dashboards and tooling; `/admin/maps` — map management, SVG upload, world generation.

**Navigation Hubs:** `/` (auth-aware landing), `/dashboard` (signed-in overview), `/explore`, `/countries`, `/feed`, `/leaderboards`.

**Other routes:** `/(forum)/forum` (IxForum), `/(wiki-os)/wiki` (WikiOS), `/blurbs`, `/messages`, `/myclub` + `/myleague` (sports), `/labs/onoma`, `/labs/vexel`, `/labs/map-pipeline`, `/admin/realms` (Realms admin).

**IxWorld (Integrated Product):** `/maps` — world map viewer (standalone at maps.ixwiki.com).

**Infrastructure:** `/help` — in-app documentation hub (`/help/[category]/[slug]`, content in `src/content/help`).

**Auth/Onboarding:** `/setup`, `/sign-in`, `/sign-up`.

### Component Libraries (`src/components`)

- `achievements/`, `analytics/`, `dashboard/` — domain dashboards and data viz
- `mycountry/` — `shell/`, `domains/` (defense, diplomacy, economy, geography, government), `dossier/`, `cards/`, `shared/`, quick actions
- `thinkpages/`, `thinktanks/`, `messages/` — social layouts, feeds, ThinkShare messaging, collaboration primitives
- `maps/core/`, `maps/editor/`, `maps/overlays/`, `maps/vexel/`, `maps/widgets/` — MapLibre world map, border editor, overlays, Vexel editor, embedded widgets
- `vault/`, `cards/`, `forum/`, `sports/`, `onoma/`, `wiki-os/`, `halo/`, `navigation/`, `admin/` — per-product component trees
- `ui/` (incl. `ui/facet/`, `ui/magicui/`), `shared/` — base UI elements and utility widgets

### Hooks & Services

Hooks in `src/hooks` and `src/app/**/hooks` coordinate client state (e.g., `useMyCountryCompliance.ts`, `usePageTitle.ts`, `useMapData.ts`, `useBorderEditor.ts`, `useMapEditor.ts`, `useMapPinInfo.ts`, `useCountryMapEmbed.ts`). Domain logic lives in `src/lib/<domain>/`; server-side services and modules live in `src/server/services/` and `src/server/modules/` (e.g. `modules/realms`).

### tRPC Routers

**77 routers registered in `appRouter` / ~900 procedures** (catalog: [`api-complete.md`](../reference/api-complete.md)) (most are domain-split into subdirectories via `mergeRouters`; some remain flat; a few are 3rd-level deep splits). Architecture guard (`bun run audit:arch`) enforces a ≤700-line per-file ceiling (ratcheted) and blocks new cross-router imports — see [`ts-graph-isolation.md`](../architecture/ts-graph-isolation.md) for the rationale.

Key groups (current top-level entries, `src/server/api/root.ts` `appRouter`):

**IxVault:** `vault/`, `cards/`, `card-packs/`, `card-market/`, `cardImages.ts`, `crafting/`, `trading/`, `lore-cards/`, `ns-import/`

**MyCountry & Subsystems:** `mycountry/`, `intelligence/`, `diplomacy/` (core, embassies, policies, cultural), `diplomaticScenarios/`, `npcPersonalities/`, `security/` (operations, military, assessment, stability, borders, conflicts, defense), `militaryEquipment/`, `smallArmsEquipment/`, `government/`, `atomicGovernment.ts`, `governmentComponents/`, `elections/`, `legislation.ts`, `economics/`, `economicComponents/`, `economicArchetypes/`, `taxSystem/`, `resources.ts`, `transport/`, `meetings/`, `national-issues/`, `intent.ts`, `crisis-events.ts`, `policies/`, `scheduledChanges.ts`, `quickactions/`, `historical/`, `countryGeo.ts`, `customTypes.ts`

**Maps & Realms:** `geo/` (core, features, editor, admin, sovereignty, wiki), `realms/`

**Wiki & Social:** `wikios/`, `wikiCache.ts`, `lorewards/`, `commons.ts`, `heraldry/`, `blurbs/`, `thinkpages/` (posts, accounts, feed, thinktanks), `messages/`, `polls/`, `forum/`, `ixnayid/`, `sports/`, `narrator/`, `onoma/`

**Other:** `achievements/`, `activities/` (feed, follows, trending, activities), `admin/` (countries, wiki, worldEvents, system, users, cron, bot, stash, thinkpages), `countries/` (list, economy, identity, management, wiki, atomic, flags), `formulas.ts`, `notifications/`, `users/`, `user-logging.ts`, `system.ts`, `system-validation.ts`, `cache.ts`, `demo-mode.ts`, `builderDraft.ts`, `autosaveHistory.ts`, `autosaveMonitoring.ts`

### Database & Data Flow

- Prisma schema: 332 models across 18 files (`prisma/schema/`)
- Seed scripts: `scripts/setup/`
- ETL & audits: `scripts/audit/` (wiring verifier, CRUD sweeps, economic calculators)
- PostgreSQL database: `localhost:5433/ixstats` (migrated from SQLite October 2025)

### Realtime Infrastructure

- `server.mjs` is a custom Node `http` server that boots Next.js and attaches the ThinkPages Socket.IO server in production (disabled in development)
- WebSocket logic: `src/server/websocket-server.ts`; `ws-backend.mjs` runs the WebSocket servers standalone (PM2 app `ixstats-ws`: `/ws/thinkpages`, `/api/market-ws`) for the IxWorld standalone build; scheduled jobs run in `cron-runner.mjs`
- Client integration: intelligence dashboards, diplomatic feeds, and live notifications

Keep this map aligned with real files. When adding new directories or routers, update the tables above so downstream docs and automation stay accurate.
