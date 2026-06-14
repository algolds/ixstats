# Platform Overview

**Last updated:** June 2026

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
| Collector / Trader | Card packs, trading, IxVault management, marketplace | `/vault`, `/cards` |
| New Player | Guided onboarding, documentation, tutorials | `/help`, `/getting-started`, docs in `docs/overview` |

## Release Cadence & Versioning
- Platform: **IxStates 1.0.6 "Ogma"** (channel: Alpha) — OS-inspired model (`Major.Minor.Patch` + permanent epoch **release name** + **channel**). Apps / Engines / Systems each carry a single capability integer. Full spec: [`revision.md`](../reference/revision.md); single source of truth is the **Version Registry** at `src/lib/buildVersion.ts`.
- Next.js 16.2.9, React 19.2.7, Prisma 6.19.3, tRPC 11.17, Tailwind CSS 4.3
- 87 tRPC routers, 1,376 API endpoints, 237 Prisma models, 893+ components
- Documentation updates must accompany feature work; use this overview and `docs/DOCUMENTATION_INDEX.md` as canonical entry points
- **After a major change, reference [`revision.md`](../reference/revision.md) and confirm with the team whether any version should bump.**

## Platform Hierarchy

```
IxStates (platform — versioned: 1.0.6 "Ogma", channel Alpha)
├── Apps (independent version): IxWorld (maps; standalone deployment: IxMaps), WikiOS (wiki software powering the IxWiki content; incl Canvas editor sub-system + Image Repository), IxVault (incl IxCards, IxCredits, Card Crafting/Trading/Marketplace/Packs/Lore Cards/NS Import)
├── Engines (internal sim cores, independent version): MyCountry (nation sim), Concord (living-world — time/diplomacy/crises/NPCs), Atlas (geo/worldgen — powers IxWorld)
├── Core Systems (independent version): MyCountry ★ (flagship, with grouped subsystems: Military & Security, Governance & Politics, Economy & Resources, Intelligence & Diplomacy, National Management), MyCountry Builder (standalone core system, not under MyCountry), ThinkPages (incl ThinkShare, ThinkTanks, IxTwitter), Achievements & Awards (incl LoreWards), Stash, Repository, Blurbs, Halo, Admin CMS
├── Design System (independent version): Facet (glass/refraction/depth)
├── Platform Utilities: IxTime, IxnayID
├── Inherits platform version: IxForum, Experimental Labs (Vexel/Onoma/Strata/Dynas/Nomora)
├── Infrastructure: Notifications, Help, c15t, Flag Service, WebSocket, Cron, Cache/RateLimit/Auth
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

**MyCountry (Core System):** `/mycountry` (executive command suite), `/mycountry/executive`, `/mycountry/diplomacy`, `/mycountry/intelligence`, `/mycountry/defense`, `/mycountry/map-editor`.

**ThinkPages (Core System):** `/thinkpages` — social knowledge sharing (ThinkShare, ThinkTanks, IxTwitter).

**Achievements & Awards (Core System):** `/achievements` — achievement explorer and detail views.

**MyCountry Builder (Core System):** `/builder` — nation creation and editor flows.

**Admin CMS (Core System):** `/admin` — administrative dashboards and tooling; `/admin/maps` — map management, SVG upload, world generation.

**Navigation Hubs:** `/` (auth-aware landing), `/dashboard` (signed-in overview), `/dashboard/diplomacy`, `/dashboard/feed`, `/dashboard/trends`, `/leaderboards`.

**IxWorld (Integrated Product):** `/maps` — world map viewer (standalone at maps.ixwiki.com).

**Infrastructure:** `/help` — in-app documentation hub.

**Auth/Onboarding:** `/setup`, `/sign-in`, `/sign-up`.

### Component Libraries (`src/components`)

- `achievements/`, `analytics/`, `charts/`, `countries/` — domain dashboards and data viz
- `diplomatic/`, `defense/`, `economy/`, `tax-system/` — specialised modules for systems guides
- `mycountry/` — shell, intelligence tabs, compliance dialogs, quick actions
- `thinkpages/`, `thinkshare/` — social layouts, feeds, collaboration primitives
- `maps/core/`, `maps/editor/`, `maps/widgets/` — MapLibre world map, border editor, embedded widgets (27 components)
- `ui/`, `shared/`, `magicui/`, `controls/` — base UI elements and utility widgets

### Hooks & Services

Hooks in `src/hooks` and `src/app/**/hooks` coordinate client state (e.g., `useMyCountryCompliance.ts`, `usePageTitle.ts`, `useMapData.ts`, `useBorderEditor.ts`, `useMapEditor.ts`, `useMapPinInfo.ts`, `useCountryMapEmbed.ts`). Services under `src/app/mycountry/services`, `src/services`, and `src/lib` encapsulate data fetches, caching, and job orchestration.

### tRPC Routers

**87 routers / 1,376 procedures** (52 of 87 are now split into subdirectories via `mergeRouters`; 24 remain flat; the rest are 3rd-level deep splits). Architecture guard (`bun run audit:arch`) enforces a ≤700-line per-file ceiling and blocks new cross-router imports — see `docs/prevent_ts_graph_explosion.md` for the rationale.

Key groups (current top-level entries, `src/server/api/root.ts` `appRouter`):

**IxVault:** `vault/`, `cards/`, `card-packs/`, `card-market/`, `card-analytics/`, `cardImages.ts`, `crafting/`, `trading/`, `lore-cards/`, `ns-import/`

**MyCountry & Subsystems:** `mycountry/`, `intelligence/` (core, alerts, analytics, core/cache), `diplomatic-intelligence/`, `diplomacy/` (core, embassies, policies, cultural), `security/` (operations, military, assessment, stability), `sdi/`, `government/`, `elections/`, `economics/`, `enhanced-economics/`, `eci/`, `atomicEconomic.ts`, `atomicGovernment.ts`, `atomicTax.ts`, `unifiedAtomic.ts`, `taxSystem/`, `resources/`, `transport/`, `meetings/`, `national-issues/`, `crisis-events/`, `policies/`, `scheduledChanges/`, `quickactions/`, `historical/`

**Other:** `achievements/`, `activities/` (feed, follows, trending, activities), `admin/` (28 interfaces across countries, wiki, worldEvents, system, etc.), `archetypes/`, `countries/` (list, economy, identity, management, diplomacy, wiki, atomic, geography, flags), `blurbs/`, `commons.ts`, `formulas.ts`, `thinkpages/` (posts, accounts, feed, messaging, thinktanks), `notifications/`, `roles/`, `users/`, `user-logging.ts`, `wikiCache.ts`, `wikiImporter/`, `wiki/`, `forum/`, `geo/` (core, features, editor, admin, sovereignty, wiki), `demoMode.ts`, `autosaveHistory.ts`, `autosaveMonitoring.ts`

### Database & Data Flow

- Prisma schema: 237 models across 12 files
- Seed scripts: `scripts/setup/`
- ETL & audits: `scripts/audit/` (wiring verifier, CRUD sweeps, economic calculators)
- PostgreSQL database: `localhost:5433/ixstats` (migrated from SQLite October 2025)

### Realtime Infrastructure

- `server.mjs` boots Next.js and attaches Socket.IO in production
- WebSocket logic: `src/lib/websocket-server.ts`
- Client integration: intelligence dashboards, diplomatic feeds, and live notifications

Keep this map aligned with real files. When adding new directories or routers, update the tables above so downstream docs and automation stay accurate.
