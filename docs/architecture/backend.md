# Backend Architecture

**Framework**: tRPC 11.18.0 · Prisma 6.19.3 · Express 5.2.1 · TypeScript 7.0.0  
**Location**: `src/server/api/` (90 routers, 1,450+ procedures) · `src/server/db.ts` · `src/server/shared/`

---

## 1. Overview & Router Organization

All backend API logic in IxStates is exposed through end-to-end type-safe **tRPC routers**. Routers are declared under `src/server/api/routers/` and composed into the unified `appRouter` in [`src/server/api/root.ts`](../../src/server/api/root.ts).

```
src/server/
├── db.ts                             # Global Prisma client instance with PostGIS connection
├── shared/                           # Shared cross-router primitives (layer-cache, helpers)
└── api/
    ├── trpc.ts                       # tRPC context, middleware, and procedure builders
    ├── root.ts                       # Master appRouter composing all 90 routers
    └── routers/                      # Domain routers (flat or subdir-organized)
        ├── countries/                # Countries router (crud, metrics, forecasts, search)
        ├── government/               # Government structure, departments, cabinet, legislation
        ├── national-issues/          # Issues engine, inbox, options, player consequences
        ├── intent/                   # Statecraft directives engine (assemble, goals, execute)
        ├── wikios/                   # WikiOS headless engine (articles, parsoid, revisions)
        ├── onoma/                    # Onoma linguistics (markov, IPA phonetics, TTS)
        ├── geo/                      # Map & GIS spatial pipeline (core, features, tiles)
        └── ...
```

---

## 2. Context & Procedure Builders (`src/server/api/trpc.ts`)

Every tRPC request initializes a typed context containing database access, authenticated user identity, and request metadata:

```typescript
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const auth = await getAuth(opts.headers);
  const user = auth.userId ? await resolveDbUser(auth.userId) : null;

  return {
    db,
    user,
    userId: user?.id ?? null,
    headers: opts.headers,
  };
};
```

### Standard Procedure Builders:
| Builder | Access Level | Description |
| :--- | :--- | :--- |
| **`publicProcedure`** | Unauthenticated | Open to public queries (cached reads, public stats, factbook data). |
| **`cachedPublicProcedure`** | Public + Memory Cache | Caches query responses in-memory for 60 seconds (reduces DB load on high-traffic reads). |
| **`protectedProcedure`** | Authenticated User | Requires valid Clerk session; guarantees `ctx.userId` and `ctx.user` are non-null. |
| **`adminProcedure`** | System Owner / Admin | Verifies `ctx.user.role === "ADMIN"` or `"SYSTEM_OWNER"`; guards CMS and migration routes. |

---

## 3. The `mergeRouters` Sub-Router Pattern

Large domain routers exceeding the architectural ceiling (≤700 lines) are split into focused sub-files and recombined using `mergeRouters` in their directory `index.ts`:

```typescript
// src/server/api/routers/wikios/index.ts
import { createTRPCRouter, mergeRouters } from "~/server/api/trpc";
import { wikiArticlesRouter } from "./articles";
import { wikiEditingRouter } from "./editing";
import { wikiMediaRouter } from "./media";
import { wikiRevisionsRouter } from "./revisions";

export const wikiosRouter = mergeRouters(
  wikiArticlesRouter,
  wikiEditingRouter,
  wikiMediaRouter,
  wikiRevisionsRouter
);
```

### Architectural Rules for Routers:
1. **Preserve Exact API Shape**: `mergeRouters` preserves all `api.<router>.<procedure>` call paths. No frontend call-sites need changes when a flat router is split.
2. **File Size Ceiling (≤700 Lines)**: Enforced by `scripts/audit/audit-arch.ts`. No single router file may exceed 700 lines.
3. **No Direct Cross-Router Imports**: Routers must not import internal helpers directly from another router's sub-files. Shared logic must be extracted to `src/server/shared/` or `src/lib/`.
4. **Safe Router Registration (`root.ts`)**: In `root.ts`, each router is wrapped in a `safeRouter()` helper so if a single router encounters a runtime dependency error, remaining routers boot safely.

---

## 4. Cross-Router Shared Primitives (`src/server/shared/`)

When multiple routers need to share common server-side logic (caching, batching, formatting), the code lives under `src/server/shared/`:

- **`layer-cache.ts`**: High-performance in-memory cache for map vector layers and GeoJSON spatial features.
- **`country-helpers.ts`**: Shared country ownership and permission validation helpers.
- **`trpc-cache.ts`**: Cache key generation and TTL management for `cachedPublicProcedure`.

---

## 5. Security, Rate Limiting & Audit Logging

1. **Redis Rate Limiting (`src/lib/rate-limiter.ts`)**:
   - Enforces IP and user-identifier limits across tRPC procedures.
   - Falls back gracefully to an in-memory token bucket if Redis is unavailable.
2. **User Activity Audit Trail (`src/lib/user-logging-middleware.ts`)**:
   - Automatically records destructive mutations (policy changes, executive decrees, transfers) to `UserActivityLog`.
3. **SQL & Mutation Protection**:
   - Strict Zod v4 schemas validate all input parameters before procedure execution.
   - Prisma parameterized queries prevent SQL injection.

---

## 6. Architecture Verification Commands

```bash
# Verify all backend routers adhere to ≤700L ceiling and no cross-router imports
bun run audit:arch

# Run partitioned server typecheck (4096MB safe heap)
bun run typecheck:server

# Run backend unit tests
bun run test -- src/server
```
