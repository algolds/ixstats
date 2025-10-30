# Feature Map & Inventory

**Last updated:** October 2025

This document inventories the primary code areas. Use it when auditing coverage, mapping dependencies, or planning refactors.

## App Router (`src/app`)
| Route | Purpose |
| --- | --- |
| `/` | Auth-aware landing (splash page vs command center) |
| `/achievements` | Achievement explorer and detail views |
| `/admin` | Administrative dashboards and tooling |
| `/builder` | Nation creation and editor flows |
| `/dashboard` | Signed-in overview widgets and cards |
| `/help` | In-app documentation hub |
| `/leaderboards` | Global rankings and comparative stats |
| `/mycountry` | Executive command suite |
| `/mycountry/intelligence` | Diplomatic operations, live feeds |
| `/thinkpages` | Social knowledge sharing and collaboration |
| `/wiki` | Wiki integration tools and info |
| `/setup`, `/sign-in`, `/sign-up` | Onboarding and auth surfaces |

> Additional experimental/test routes live under `/test-*` and internal tooling paths.

## Component Libraries (`src/components`)
- `achievements/`, `analytics/`, `charts/`, `countries/` – domain dashboards and data viz
- `diplomatic/`, `defense/`, `economy/`, `tax-system/` – specialised modules for systems guides
- `mycountry/` – shell, intelligence tabs, compliance dialogs, quick actions
- `thinkpages/`, `thinkshare/` – social layouts, feeds, collaboration primitives
- `ui/`, `shared/`, `magicui/`, `controls/` – base UI elements and utility widgets

## Hooks & Services
- Hooks in `src/hooks` and `src/app/**/hooks` coordinate client state (e.g., `useMyCountryCompliance.ts`, `usePageTitle.ts`)
- Services under `src/app/mycountry/services`, `src/services`, and `src/lib` encapsulate data fetches, caching, and job orchestration

## tRPC Routers (`src/server/api/routers`)
**35 routers / 546 procedures**. Key files:
```
achievements.ts        activities.ts        admin.ts
archetypes.ts          atomicEconomic.ts    atomicGovernment.ts
atomicTax.ts           countries.ts         customTypes.ts
diplomatic-intelligence.ts  diplomatic.ts   eci.ts
economics.ts           enhanced-economics.ts  formulas.ts
government.ts          intelligence.ts      meetings.ts
mycountry.ts           notifications.ts     optimized-countries.ts
policies.ts            quickactions.ts      roles.ts
scheduledChanges.ts    sdi.ts               security.ts
taxSystem.ts           thinkpages.ts        unifiedAtomic.ts
unified-intelligence.ts user-logging.ts     users.ts
wikiCache.ts           wikiImporter.ts
```
- Auth-aware context lives in `src/server/api/trpc.ts`
- Middleware: rate limiting (`~/lib/rate-limiter`), user logging (`~/lib/user-logging-middleware`)

## Database & Data Flow
- Prisma schema: `prisma/schema.prisma` (131 models)
- Seed scripts: `scripts/setup/`
- ETL & audits: `scripts/audit/` (wiring verifier, CRUD sweeps, economic calculators)
- PostgreSQL database: `localhost:5433/ixstats` (migrated from SQLite in October 2025)
- Legacy SQLite backups: `prisma/backups/sqlite-legacy/`

## Realtime Infrastructure
- `server.mjs` boots Next.js and attaches Socket.IO in production
- WebSocket logic: `src/lib/websocket-server.ts`
- Client integration: intelligence dashboards, diplomatic feeds, and live notifications

## Help & Documentation Surfaces
- `/help` React pages with shared layouts in `src/app/help/_components`
- Markdown docs in `docs/` (this directory)
- Feature-level READMEs stored alongside implementation (e.g., `src/app/mycountry/README.md`)

Keep this map aligned with real files. When adding new directories or routers, update the tables above so downstream docs and automation stay accurate.
