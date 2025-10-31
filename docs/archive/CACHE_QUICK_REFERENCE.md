# External API Cache - Quick Reference

## Common Operations

### Check Cache Before API Call

```typescript
import { mediaWikiCache } from "~/lib/mediawiki-cache-service";

// 1. Try cache first
const data = await mediaWikiCache.getInfobox(countryName);
if (data) return data;

// 2. Fetch from API
const fresh = await fetchFromAPI(countryName);

// 3. Cache it
await mediaWikiCache.setInfobox(countryName, fresh);
return fresh;
```

### Use in tRPC Router

```typescript
import { mediaWikiCache } from "~/lib/mediawiki-cache-service";

export const myRouter = createTRPCRouter({
  getData: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const cached = await mediaWikiCache.getInfobox(input.name);
      if (cached) return cached;

      const fresh = await fetchFromAPI(input.name);
      await mediaWikiCache.setInfobox(input.name, fresh);
      return fresh;
    }),
});
```

### Cache Custom API

```typescript
import { externalApiCache } from "~/lib/external-api-cache";

await externalApiCache.set(
  {
    service: "myapi",
    type: "data",
    identifier: "key123",
    ttl: 60 * 60 * 1000, // 1 hour
  },
  { /* your data */ }
);

const cached = await externalApiCache.get({
  service: "myapi",
  type: "data",
  identifier: "key123",
});
```

## Admin Operations

```typescript
// Get stats
const stats = await trpc.cache.getStats.query();

// Clear service
await trpc.cache.clearService.mutate({ service: "mediawiki" });

// Clear country
await trpc.cache.clearCountry.mutate({ countryName: "Caphiria" });

// Cleanup
await trpc.cache.cleanupExpired.mutate();

// Health check (public)
const health = await trpc.cache.getHealth.query();
```

## Default TTLs

| Type | TTL |
|---|---|
| Infobox | 7 days |
| Wikitext | 7 days |
| Templates | 14 days |
| Flags | 30 days |
| Images | 30 days |

## Service Imports

```typescript
// Universal cache (all APIs)
import { externalApiCache } from "~/lib/external-api-cache";

// MediaWiki wrapper
import { mediaWikiCache } from "~/lib/mediawiki-cache-service";

// Image/media wrapper
import { imageCache } from "~/lib/image-cache-service";

// Revalidation
import { runCleanupJob, findStaleEntries } from "~/lib/cache-revalidation";
```

## Health Endpoint

```bash
curl http://localhost:3000/api/trpc/cache.getHealth
```

## Database Table

```
ExternalApiCache
- id: String (cuid)
- key: String (unique)
- service: String
- type: String
- identifier: String
- data: String (JSON)
- countryName: String?
- metadata: String? (JSON)
- contentHash: String?
- hitCount: Int
- lastValidatedAt: DateTime
- validationStatus: String
- createdAt: DateTime
- updatedAt: DateTime
- expiresAt: DateTime
```

## Quick Integration Checklist

- [ ] Import cache service
- [ ] Check cache first
- [ ] Handle cache hit (return data)
- [ ] Handle cache miss (fetch API)
- [ ] Store in cache
- [ ] Include metadata
- [ ] Set appropriate TTL
- [ ] Log hits/misses

## Performance Expectations

| Scenario | Time |
|---|---|
| Cache hit | <100ms |
| Cache miss | 10-20s |
| Improvement | 99%+ |

## Files to Know

```
src/lib/external-api-cache.ts        # Core service
src/lib/mediawiki-cache-service.ts   # MediaWiki wrapper
src/lib/image-cache-service.ts       # Image wrapper
src/lib/cache-revalidation.ts        # Revalidation
src/server/api/routers/cache.ts      # Admin API
docs/EXTERNAL_API_CACHE.md           # Full docs
docs/CACHE_INTEGRATION_EXAMPLE.md    # Examples
```
