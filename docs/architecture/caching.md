# Caching & Rate Limiting Architecture

**Location**: `src/lib/wiki/cache-service.ts` · `src/server/shared/` · `src/lib/rate-limiter.ts`  
**Layers**: Memory LRU Cache · Redis Cluster / Standalone · Database Shadow Store (`WikiArticle`, `WikiRevision`)

---

## 1. Multi-Tier Caching Architecture

IxStates employs a 3-tier caching hierarchy to deliver sub-millisecond response times while shielding external dependencies (MediaWiki, Unsplash, PostGIS):

```
┌─────────────────────────────────────────────────────────────┐
│                    TIER 1: IN-MEMORY CACHE                  │
│ Fast synchronous WeakMap / LRU cache in Node process memory │
│ (src/server/shared/layer-cache.ts, trpc-cache.ts)           │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Cache Miss)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 TIER 2: DISTRIBUTED REDIS CACHE             │
│ Persistent rate-limiting tokens & cross-instance cache      │
│ (src/lib/rate-limiter.ts, redis client)                     │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Cache Miss)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              TIER 3: DATABASE SHADOW & WIKI BRIDGE          │
│ PostgreSQL shadow tables (WikiArticle, WikiInfoboxCache)    │
│ Falls back to MySQL / MediaWiki API with write-through sync │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tier 1: In-Memory Fast Cache (`src/server/shared/`)

### 2.1 tRPC Procedure Cache (`trpc-cache.ts`)
Used by `cachedPublicProcedure` to memoize expensive read queries for 60 seconds:
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

### 2.2 Vector Map Layer & Static Catalog Cache (`layer-cache.ts`)
Map tiles, GeoJSON feature collections, and immutable reference catalogs (e.g. equipment catalogs, administrative division lists, country presets) are cached in an in-memory LRU buffer with automatic TTL eviction and geometry coordinate truncation (6 decimal places $\approx 0.11\text{m}$ precision), reducing redundant database round-trips to 0ms for warm lookups.


---

## 3. Tier 2: Redis Distributed Cache & Rate Limiting (`src/lib/rate-limiter.ts`)

Redis manages token-bucket rate limiting and session stores:
- **Rate Limit Windows**: 90 requests / 60 seconds for standard APIs; 30 requests / 60 seconds for external MediaWiki imports.
- **Graceful Fallback**: If the Redis container is unreachable, the system automatically falls back to an in-memory token bucket without crashing.

---

## 4. Tier 3: WikiOS Shadow Cache & Centralized Bridge (`src/lib/wiki/`)

All wiki queries, infobox parsing, and page wikitext must strictly use the centralized wiki bridge:

```typescript
// Canonical Wiki Fetch Pattern:
import { getInfobox, getArticleWikitext } from "~/lib/wiki/bridge";

export async function resolveCountryFactbook(countryName: string) {
  // 1. Checks PostgreSQL WikiInfoboxCache
  // 2. Falls back to direct MediaWiki MySQL pool / API
  // 3. Backfills shadow store on miss
  const infobox = await getInfobox(countryName);
  return infobox;
}
```

### Prohibited Pattern:
> [!CAUTION]
> **No Ad-Hoc Calls**: NEVER write manual `fetch()` requests or hardcode inline MediaWiki API URLs / User-Agents in frontend UI components, hooks, or non-wiki router files. All access must use `src/lib/wiki-os/adapters/mediawiki/bridge/` with the canonical `IxStats-Builder` User-Agent.

---

## 5. Cache Invalidation & Management

Admins can inspect cache hit ratios, evict stale keys, or flush memory pools via the admin cache router (`src/server/api/routers/cache.ts`):

```bash
# Verify cache wiring and external bridge connections
bun run audit:wiring
```
