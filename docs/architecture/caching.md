# Caching & Rate Limiting Architecture

**Location**: `src/lib/cache/` (`trpc-cache.ts`, `rate-limiter.ts`, `redis-client.ts`, `external-api-cache.ts`, `advanced-cache-system.ts`) · `src/server/shared/layer-cache.ts` · `src/lib/wiki-os/adapters/mediawiki/bridge/`  
**Layers**: In-process Maps · Redis (shared client, in-memory fallback) · PostgreSQL stores (`ExternalApiCache`, `WikiCache`, `WikiArticle`, `WikiRevision`)

---

## 1. Multi-Tier Caching Architecture

IxStates employs a 3-tier caching hierarchy to deliver sub-millisecond response times while shielding external dependencies (MediaWiki, Unsplash, PostGIS):

```
┌─────────────────────────────────────────────────────────────┐
│                    TIER 1: IN-MEMORY CACHE                  │
│ In-process Map caches (TTL) in Node process memory          │
│ (src/server/shared/layer-cache.ts, Redis-fallback stores)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Cache Miss)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 TIER 2: DISTRIBUTED REDIS CACHE             │
│ tRPC response cache, rate-limit windows, cross-instance     │
│ (src/lib/cache/trpc-cache.ts, rate-limiter.ts, redis-client)│
└──────────────────────────────┬──────────────────────────────┘
                               │ (Cache Miss)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              TIER 3: DATABASE STORES & WIKI BRIDGE          │
│ PostgreSQL tables (WikiArticle, WikiCache, ExternalApiCache)│
│ Falls back to the live MediaWiki Action API over HTTP       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Procedure & In-Memory Caches

### 2.1 tRPC Procedure Cache (`src/lib/cache/trpc-cache.ts`)
Redis-backed (in-memory fallback only while Redis is not ready) and realm-aware. Used by `cachedPublicProcedure` (60s), `cachedStaticProcedure` (1h) and `cachedProtectedProcedure` (30s, per user):
```typescript
import { cachedPublicProcedure } from "~/server/api/trpc";

export const geoCountryRouter = createTRPCRouter({
  getCountryFeatures: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Computes or returns 60s memoized GeoJSON payload
    }),
});
```

### 2.2 Vector Map Layer Cache (`src/server/shared/layer-cache.ts`)
Assembled GeoJSON FeatureCollections are held in an in-process `Map` (plus an in-flight request map for de-duplication) with a 15-minute default TTL (set in `geo/core/cache.ts`). Per-layer compression lives in `src/server/api/routers/geo/core/cache.ts`: simplification plus coordinate truncation to 3 decimals (~111m) for decorative layers and 4 decimals (~11m) for political borders, with zoom-level LOD overrides.

### 2.3 External API Cache (`src/lib/cache/external-api-cache.ts`)
Responses from MediaWiki, Unsplash, Wikimedia, flagcdn and REST Countries are persisted in the `ExternalApiCache` table with per-service TTLs.


---

## 3. Tier 2: Redis Distributed Cache & Rate Limiting (`src/lib/cache/rate-limiter.ts`)

Redis backs the tRPC response cache and sliding-window rate limiting (tiers defined in `src/server/api/trpc/middleware.ts`):
- **Rate Limit Windows** (per 60 seconds): standard country-owner mutations 60; light mutations 100; read-only queries 120; public 100; admin/default 100 (env default `RATE_LIMIT_MAX_REQUESTS`=100, `RATE_LIMIT_WINDOW_MS`=60000).
- **Graceful Fallback**: If Redis is unreachable, the limiter falls back to an in-memory store without crashing.

---

## 4. Tier 3: WikiOS Store & Centralized Bridge (`src/lib/wiki-os/adapters/mediawiki/bridge/`)

All wiki queries, infobox parsing, and page wikitext must strictly use the centralized wiki bridge:

```typescript
// Canonical Wiki Fetch Pattern:
import { getInfobox, getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";

export async function resolveCountryFactbook(countryName: string) {
  // getInfobox → getArticleWikitext → (ixwiki) pg-reader:
  // 1. Reads the PostgreSQL article store (ArticleRepository)
  // 2. Falls back to the live MediaWiki Action API over HTTP
  // 3. Parses the infobox from the wikitext
  const infobox = await getInfobox(countryName);
  return infobox;
}
```

### Prohibited Pattern:
> [!CAUTION]
> **No Ad-Hoc Calls**: NEVER write manual `fetch()` requests or hardcode inline MediaWiki API URLs / User-Agents in frontend UI components, hooks, or non-wiki router files. All access must use `src/lib/wiki-os/adapters/mediawiki/bridge/` with the canonical `IxStats-Builder` User-Agent.

---

## 5. Cache Invalidation & Management

Admins can read external-API cache statistics (overall and per service) via the admin cache router (`src/server/api/routers/cache.ts`, a single `getStats` procedure). tRPC cache keys are invalidated in code via `deleteKeysByPattern` (`src/lib/cache/redis-client.ts`).

```bash
# Audit Prisma model ↔ tRPC router wiring coverage
bun run audit:wiring

# Exercise cache behaviour
bun run diagnostics:cache
```
