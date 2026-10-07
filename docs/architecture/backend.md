# Backend Architecture

**Last updated:** 2026-10-05

**Framework**: tRPC 11.18.0 · Prisma 6.19.3 · Next.js 16 route handlers + custom Node `http` server (`server.mjs`) · TypeScript 7.0.2  
**Location**: `src/server/api/` (<!-- BEGIN_DOCS:COUNT:routers -->76<!-- END_DOCS:COUNT:routers --> routers registered in `root.ts`, <!-- BEGIN_DOCS:COUNT:procedures -->1,029<!-- END_DOCS:COUNT:procedures --> procedures — the generated count is in [`api-complete.md`](../reference/api-complete.md)) · `src/server/db.ts` · `src/server/shared/`

---

## 1. Overview & Router Organization

All backend API logic in IxStates is exposed through end-to-end type-safe **tRPC routers**. Routers are declared under `src/server/api/routers/` and composed into the unified `appRouter` in [`src/server/api/root.ts`](../../src/server/api/root.ts).

```
src/server/
├── db.ts                             # Global Prisma client instance (PostgreSQL + PostGIS)
├── shared/                           # Shared cross-router primitives (layer-cache, helpers)
└── api/
    ├── trpc/                         # tRPC context, middleware, and procedure builders (index.ts re-exports)
    ├── root.ts                       # Master appRouter composing every router
    └── routers/                      # Domain routers (flat or subdir-organized)
        ├── countries/                # Countries router (crud, metrics, forecasts, search)
        ├── government/               # Government structure, departments, cabinet, legislation
        ├── national-issues/          # Issues engine, inbox, options, player consequences
        ├── intent.ts                 # Statecraft directives engine (assemble, goals, execute)
        ├── wikios/                   # WikiOS headless engine (page content, editing, history, search)
        ├── onoma/                    # Onoma linguistics (namebank, etymology, speech, writing)
        ├── geo/                      # Map & GIS spatial pipeline (core, features, editor, admin, sovereignty)
        ├── realms/                   # Realms: realm admin, realm lookup, nation claims (logic in src/server/modules/realms)
        └── ...
```

---

## 2. Context & Procedure Builders (`src/server/api/trpc/`)

Every tRPC request initializes a typed context containing database access, authenticated user identity, and request metadata:

```typescript
// src/server/api/trpc/context.ts (simplified)
export const createTRPCContext = async (opts: { headers: Headers; req?: NextRequest }) => {
  // Clerk auth from the request, or a verified Bearer token for API routes
  // → resolves the DB user, play-as impersonation, and the rate-limit identity
  return {
    db,
    auth,
    user,
    rateLimitIdentifier,
    impersonatorId,
    realUserId: impersonatorId ?? auth?.userId ?? null,
    ...opts,
  };
};
```

### Standard Procedure Builders:
| Builder | Access Level | Description |
| :--- | :--- | :--- |
| **`publicProcedure`** | Unauthenticated | Open to public queries (cached reads, public stats, factbook data). |
| **`cachedPublicProcedure`** | Public + Cache | Realm-aware response cache, 60s TTL (`cachedStaticProcedure`: 1h). There is no cached protected builder: per-user caching is `.use(userCacheMiddleware)` (30s) on a protected procedure. TTLs live in `cacheConfigs` in `src/lib/cache/trpc-cache.ts`. |
| **`rateLimitedPublicProcedure`** | Public + Rate Limit | Public procedure with the public rate-limit bucket. |
| **`protectedProcedure`** | Authenticated User | Requires valid Clerk session; guarantees `ctx.auth.userId` and `ctx.user` are non-null. Variant: `lightMutationProcedure` (rate-limited mutations). |
| **`countryOwnerProcedure`** | Country Owner | Authenticated + owns the target country (`standardMutationCountryOwnerProcedure` adds rate limiting and input validation). |
| **`premiumProcedure`** | Premium User | Authenticated + premium membership. |
| **`adminProcedure`** | System Owner / Admin | System owner bypass, else role name `owner`/`admin`/`staff` or role level ≤ 20; blocked while impersonating (play-as). Adds rate limiting and audit logging. |

---

## 3. The `mergeRouters` Sub-Router Pattern

Large domain routers exceeding the architectural ceiling (≤700 lines) are split into focused sub-files and recombined using `mergeRouters` in their directory `index.ts`:

```typescript
// src/server/api/routers/wikios/index.ts (abridged — 11 sub-routers in total)
import { mergeRouters } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "./page-content";
import { wikiosHistoryDiffRouter } from "./history-diff";
import { wikiosSearchRouter } from "./search";
import { wikiosEditingRouter } from "./editing";
// ...categories, templates, stash, watchlist-annotations, user-talk, discussions, utilities

export const wikiosRouter = mergeRouters(
  wikiosPageContentRouter,
  wikiosHistoryDiffRouter,
  wikiosSearchRouter,
  wikiosEditingRouter,
  // ...
);
```

### Architectural Rules for Routers:
1. **Preserve Exact API Shape**: `mergeRouters` preserves all `api.<router>.<procedure>` call paths. No frontend call-sites need changes when a flat router is split.
2. **File Size Ceiling (≤700 Lines)**: Enforced by `scripts/audit/audit-arch.ts` as a ratchet — new router files must stay under 700 lines, and files already over it are frozen at their size in `scripts/audit/arch-baseline.json` (may only shrink).
3. **No Direct Cross-Router Imports**: Routers must not import internal helpers directly from another router's sub-files. Shared logic must be extracted to `src/server/shared/` or `src/lib/`.
4. **Static Router Registration (`root.ts`)**: Every router is a static ESM import registered directly in `createTRPCRouter({...})`. There is no runtime wrapper — a broken router fails the module load (and server boot) loudly.

---

## 4. Cross-Router Shared Primitives (`src/server/shared/`)

When multiple routers need to share common server-side logic (caching, batching, formatting), the code lives under `src/server/shared/`:

- **`layer-cache.ts`**: In-memory cache for assembled map FeatureCollections (populated by the geo router, invalidated by the countries router).
- **`country-helpers.ts`**: Shared numeric/field validation helpers for country data.
- **`country-authorization.ts`**: Shared country write-permission checks (`COUNTRY_WRITE_ROLES`).
- **`realm-link-guard.ts`**, **`geo-resource-sync.ts`**, **`transport-sync.ts`**, **`mycountry-helpers.ts`**: other cross-domain helpers.

The tRPC response cache (key generation + TTLs for `cachedPublicProcedure` and friends) lives in `src/lib/cache/trpc-cache.ts`, not under `src/server/shared/`.

---

## 5. Security, Rate Limiting & Audit Logging

1. **Redis Rate Limiting (`src/lib/cache/rate-limiter.ts`)**:
   - Enforces IP and user-identifier limits across tRPC procedures.
   - Falls back gracefully to an in-memory store if Redis is unavailable.
2. **User Activity Logging (`src/lib/logging/user-middleware.ts`)**:
   - `userLoggingMiddleware` is attached to every base procedure and logs mutations (default `MUTATIONS_ONLY`) via `UserLogger` to the `SystemLog` table. `adminProcedure` additionally runs `auditLogMiddleware` for sensitive/executive paths.
3. **SQL & Mutation Protection**:
   - Strict Zod v4 schemas validate all input parameters before procedure execution.
   - Prisma parameterized queries prevent SQL injection.

---

## 6. Architecture Verification Commands

```bash
# Verify all backend routers adhere to ≤700L ceiling and no cross-router imports
bun run audit:arch

# Run partitioned server typecheck (tsconfig.server.json)
bun run typecheck:server

# Run backend unit tests
bun run test -- src/tests/server
```
