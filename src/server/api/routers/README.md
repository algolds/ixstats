# tRPC Router Overview

**Last updated:** June 2026

Routers live under `src/server/api/routers` and expose the typed API surface for IxStats. The current codebase contains **87 routers** with **1,332+ procedures**. Some routers are split into subdirectory modules (geo, diplomacy, intelligence, countries, mycountry, government, thinkpages). All routers are registered in `src/server/api/root.ts`.

## Request Flow
1. Client calls `api.<router>.<procedure>` generated in `src/trpc/react.tsx`
2. Request hits the Next.js handler (`src/app/api/trpc/[trpc]/route.ts`)
3. `createTRPCContext` (in `src/server/api/trpc.ts`) attaches Prisma, Clerk auth, rate limiter, and user logging
4. Middleware runs (auth, rate limiting, logging, error formatting)
5. Router procedure executes business logic and returns serialised data via SuperJSON

## Common Middleware & Helpers
- **Auth & User Provisioning** – `getAuth` + `verifyToken` ensure Clerk users are mapped to database records (with auto upsert)
- **Rate Limiting** – `~/lib/rate-limiter`
- **User Activity Logging** – `~/lib/user-logging-middleware`
- **Error Logging** – `~/lib/error-logger`

## Router Groups
| Domain | Routers (examples) |
| --- | --- |
| Countries & Economy | `countries/`, `economics`, `enhanced-economics`, `market`, `formulas` |
| Geospatial & Maps | `geo/` (6 files: core, features, editor, admin, sovereignty, wiki — 102 endpoints) |
| Intelligence & Diplomacy | `intelligence/`, `diplomacy/`, `diplomatic-intelligence`, `unified-intelligence`, `unifiedAtomic` |
| Government & Politics | `elections`, `national-issues`, `atomicGovernment`, `policies` |
| Defense & Security | `defense`, `security`, `meetings` |
| Social & Collaboration | `thinkpages`, `activities`, `notifications`, `forum` |
| Builder & Atomic Systems | `atomicGovernment`, `atomicEconomic`, `atomicTax`, `taxSystem`, `formulas` |
| Cards & Vault | `ixcards`, `vault`, `crafting`, `packs` |
| Admin & Operations | `admin`, `users`, `roles`, `user-logging`, `scheduledChanges` |
| Integrations | `wikiImporter`, `wikiCache`, `archetypes`, `customTypes` |

## Recent Changes
- **`mycountry`** router now has `getNewsFeed` in the dashboard sub-router — returns recent StorytellerEffect records for the player-visible narrative feed.
- **`government`** router now has `recalculateEffects` in the components sub-router — recalculates and re-applies atomic government component effects on demand (protected mutation).
- **`thinkpages`** procedures `getFeed`, `getPost`, and `getPostsByClerkUserId` restored from git — paginated feed, single post with replies/reactions, and per-user post listing.

## Subdirectory Routers
Some domains are split into multiple files under a subdirectory with an `index.ts` barrel:

- **`geo/`** — 6 files (~11,558 lines, 102 endpoints): core, features, editor, admin, sovereignty, wiki
- **`diplomacy/`** — Split diplomatic operations
- **`intelligence/`** — Split intelligence operations
- **`countries/`** — Split country data operations

## Adding a Router
1. Create `<name>.ts` under `src/server/api/routers` (or in a subdirectory with `index.ts`)
2. Export `createTRPCRouter({ ... })`
3. Register the router in `src/server/api/root.ts`
4. Regenerate the client if needed (the project uses dynamic type inference; no manual generation step)
5. Document new procedures in `docs/reference/api.md` and relevant system guides

## Best Practices
- Prefer descriptive procedure names (`getLeaderboards`, `updateMissionStatus`)
- Validate all inputs with Zod schemas
- Restrict sensitive operations with `protectedProcedure` / role checks
- Reuse utilities from `src/lib` and `src/services` rather than duplicating logic
- Ensure new procedures have tests under `src/server/api/routers/__tests__` where feasible

See `docs/reference/api.md` for deeper detail.
