# Backend Architecture

**Last updated:** February 2026

IxStates (IxStats) uses tRPC 11.4 to expose a fully typed API layer with **61 routers** and **927 procedures**. Routers live in `src/server/api/routers`, while shared infrastructure is defined in `src/server/api/trpc.ts` and supporting libraries under `src/lib`.

## Context & Middleware
- **Auth Context** – `createTRPCContext` loads Clerk sessions (via `@clerk/nextjs/server`) and auto-provisions users into the database when needed.
- **Database Access** – Prisma client imported from `~/server/db` is attached to the context for all procedures.
- **Rate Limiting** – `~/lib/rate-limiter` enforces per-identifier limits. Identifier derives from `x-ratelimit-identifier` header or defaults to `anonymous`.
- **User Activity Logging** – `~/lib/user-logging-middleware` records API usage for audit trails.
- **Error Handling** – Custom error formatter logs non-validation errors (`~/lib/error-logger`) and returns structured error payloads to clients.

## Router Composition
- Routers are grouped by domain (economics, intelligence, diplomacy, social, notifications, etc.).
- Shared procedures follow consistent naming: `get*` for queries, imperative verbs for mutations.
- Role-aware or protected endpoints leverage `protectedProcedure`/`adminProcedure` wrappers defined alongside context.

## Notable Routers
- `countries.ts` – Central country data access, historical metrics, forecasts.
- `diplomatic-intelligence.ts` – Executive diplomatic briefing material and relationship analytics.
- `economics.ts` / `enhanced-economics.ts` – Economic modelling, projections, and historical series.
- `notifications.ts` – Unified notification dispatch, completion tracking, and rate limiting metadata.
- `thinkpages.ts` – Social platform feeds, comments, and curation.
- `wikiImporter.ts` – MediaWiki integrations for country data ingest.
- `elections.ts` – D'Hondt/FPTP electoral systems, political parties, legislature management.
- `cardImages.ts` – Card background image management for 13 card types.
- `vault.ts` – IxVault wallet/economy (incl IxCredits), balances, transactions, daily bonuses.
- `cards.ts` / `card-packs.ts` / `lore-cards.ts` – IxCards trading card system (part of IxVault).
- `card-market.ts` / `card-analytics.ts` – Marketplace and analytics.
- `crafting.ts` / `trading.ts` – Card crafting and P2P trading.
- `ns-import.ts` – NationStates deck import.
- `historical.ts` – Historical time-series data.

## API Delivery
- App Router API handlers live under `src/app/api/*`, delegating to tRPC or bespoke logic when required.
- Endpoints mount at `/api/trpc/*` via Next.js' built-in handler and the exported `appRouter`.
- Server-only utilities (cron jobs, batch processing) reside in `scripts/` or `src/services` as needed.

## Security & Permissions
- Authentication optional in dev/demo; enabling Clerk keys switches to RBAC-backed flows (`src/server/api/routers/roles.ts`).
- Sensitive mutations require elevated procedures that verify roles or explicit permissions.
- Environment variables such as `RATE_LIMIT_ENABLED`, `ENABLE_QUERY_CACHE`, and `ENABLE_COMPRESSION` tune production behaviour.

## Testing & Audits
- Jest-based router tests live under `src/server/api/routers/__tests__` (e.g., `diplomaticIntelligence.test.ts`).
- Automation scripts in `scripts/audit` validate CRUD coverage, endpoint wiring, and economic formula correctness.
- Use `npm run audit:wiring` and `npm run test:critical` before deployments.

Maintain this guide when introducing new middleware, authentication layers, or API consumption patterns.
