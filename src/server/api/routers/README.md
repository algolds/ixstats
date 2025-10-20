# tRPC Router Overview

**Last updated:** October 2025

Routers live under `src/server/api/routers` and expose the typed API surface for IxStats. The current codebase contains **35 routers** with **546 procedures** (274 queries / 272 mutations). This README describes shared patterns and points to supporting documentation.

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
| Countries & Economy | `countries`, `economics`, `enhanced-economics`, `optimized-countries` |
| Intelligence & Diplomacy | `intelligence`, `diplomatic`, `diplomatic-intelligence`, `unified-intelligence`, `unifiedAtomic` |
| Defense & Security | `sdi`, `security`, `meetings`, `policies` |
| Social & Collaboration | `thinkpages`, `activities`, `notifications` |
| Builder & Atomic Systems | `atomicGovernment`, `atomicEconomic`, `atomicTax`, `taxSystem`, `formulas` |
| Admin & Operations | `admin`, `users`, `roles`, `user-logging`, `scheduledChanges` |
| Integrations | `wikiImporter`, `wikiCache`, `archetypes`, `customTypes`

## Adding a Router
1. Create `<name>.ts` under `src/server/api/routers`
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

See `docs/architecture/backend.md` and `docs/reference/api.md` for deeper detail.
