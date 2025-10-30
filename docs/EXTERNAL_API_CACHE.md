# External API Cache System

## Overview

The External API Cache System provides universal, persistent caching for all external API calls (MediaWiki, Unsplash, flag services, etc.) with intelligent revalidation and content validation.

## Architecture

### Core Components

1. **ExternalApiCache** (`src/lib/external-api-cache.ts`)
   - Universal cache service for all external APIs
   - Database-backed persistent storage
   - Content hash validation
   - Automatic expiration and revalidation

2. **MediaWikiCacheService** (`src/lib/mediawiki-cache-service.ts`)
   - MediaWiki-specific wrapper around ExternalApiCache
   - Simplified methods for common MediaWiki operations

3. **ImageCacheService** (`src/lib/image-cache-service.ts`)
   - Image and media API wrapper (Unsplash, Wikimedia, flags)
   - Optimized for image URL caching

4. **CacheRevalidation** (`src/lib/cache-revalidation.ts`)
   - Background revalidation logic
   - Stale entry detection
   - Cleanup jobs

5. **Cache Router** (`src/server/api/routers/cache.ts`)
   - Admin API for cache management
   - Statistics and monitoring endpoints

## Features

### 1. Intelligent Caching

- **Persistent Storage**: Database-backed cache survives server restarts
- **Content Hashing**: Detect changes without full comparisons
- **TTL Management**: Different TTLs for different content types
- **Hit Tracking**: Monitor cache popularity for optimization

### 2. Cache TTL (Time To Live)

Default TTLs for different content types:

| Content Type | TTL | Reason |
|---|---|---|
| MediaWiki Infobox | 7 days | Country data changes occasionally |
| MediaWiki Wikitext | 7 days | Article content updates periodically |
| MediaWiki Templates | 14 days | Templates rarely change |
| Flags | 30 days | Flags almost never change |
| Images (Unsplash/Wikimedia) | 30 days | Images are immutable |
| Country Data APIs | 30 days | Metadata rarely changes |

### 3. Revalidation Strategy

The system uses a **stale-while-revalidate** pattern:

1. **First Request**: Fetch from external API, cache result
2. **Subsequent Requests**: Serve from cache (instant response)
3. **Background Revalidation**: Check weekly if content changed
4. **Smart Updates**: Only update cache if content actually changed

### 4. Content Validation

```typescript
// Content hash comparison prevents unnecessary updates
const freshData = await fetchFromAPI();
const isValid = await cache.validateContent(options, freshData);

if (!isValid) {
  // Content changed - update cache
  await cache.set(options, freshData);
}
```

## Usage

### MediaWiki Caching

```typescript
import { mediaWikiCache } from "~/lib/mediawiki-cache-service";

// Get cached infobox (automatic)
const infobox = await mediaWikiCache.getInfobox("Caphiria");

if (!infobox) {
  // Cache miss - fetch from API
  const freshData = await fetchInfoboxFromMediaWiki("Caphiria");

  // Cache for future use
  await mediaWikiCache.setInfobox("Caphiria", freshData);
}

// Get cached wikitext
const wikitext = await mediaWikiCache.getWikitext("Caphiria");

// Cache flag URL
await mediaWikiCache.setFlag("Caphiria", "https://example.com/flag.png");
```

### Image Caching

```typescript
import { imageCache } from "~/lib/image-cache-service";

// Get cached Unsplash image
const image = await imageCache.getUnsplashImage("paris cityscape");

if (!image) {
  // Fetch from Unsplash API
  const freshImage = await fetchFromUnsplash("paris cityscape");

  // Cache it
  await imageCache.setUnsplashImage("paris cityscape", freshImage);
}

// Cache flag from flagcdn
await imageCache.setFlagCdn("fr", "https://flagcdn.com/fr.svg");
```

### Universal Caching (Custom APIs)

```typescript
import { externalApiCache } from "~/lib/external-api-cache";

// Cache custom API response
await externalApiCache.set(
  {
    service: "custom",
    type: "json",
    identifier: "weather-data-paris",
    ttl: 60 * 60 * 1000, // 1 hour
  },
  { temperature: 20, condition: "sunny" },
  {
    source: "openweathermap",
    lastFetched: new Date().toISOString(),
  }
);

// Retrieve cached data
const cached = await externalApiCache.get({
  service: "custom",
  type: "json",
  identifier: "weather-data-paris",
});
```

## Admin Management

### tRPC API Endpoints

All cache management endpoints are available via the `cache` router:

```typescript
// Get cache statistics
const stats = await trpc.cache.getStats.query();

// Clear cache for specific service
await trpc.cache.clearService.mutate({ service: "mediawiki" });

// Clear cache for specific country
await trpc.cache.clearCountry.mutate({ countryName: "Caphiria" });

// Clean up expired entries
await trpc.cache.cleanupExpired.mutate();

// Force revalidation of specific entry
await trpc.cache.forceRevalidate.mutate({
  service: "mediawiki",
  type: "infobox",
  identifier: "Caphiria",
});

// Get top cached items by hit count
const topHits = await trpc.cache.getTopHits.query({
  service: "mediawiki",
  limit: 20
});

// Health check (public endpoint)
const health = await trpc.cache.getHealth.query();
```

### Cache Statistics Response

```typescript
{
  overall: {
    total: 1234,
    valid: 1180,
    stale: 42,
    averageHitCount: 15.3,
    topHits: [
      { key: "mediawiki:infobox:Caphiria", hitCount: 523, ... },
      // ...
    ]
  },
  byService: {
    mediawiki: { total: 800, valid: 765, stale: 30, ... },
    unsplash: { total: 200, valid: 195, stale: 5, ... },
    // ...
  }
}
```

## Background Jobs

### Automatic Cleanup

Run periodic cleanup to remove expired entries:

```typescript
import { runCleanupJob } from "~/lib/cache-revalidation";

// Run cleanup job
const result = await runCleanupJob();
// {
//   expiredRemoved: 45,
//   failedRemoved: 3,
//   stats: { ... }
// }
```

### Finding Stale Entries

```typescript
import { findStaleEntries, markForRevalidation } from "~/lib/cache-revalidation";

// Find entries needing revalidation
const staleEntries = await findStaleEntries(50);

// Mark entries for revalidation
const count = await markForRevalidation("mediawiki", "Caphiria");
```

## Performance Benefits

### Before Caching
- Every page load: 10-20 second wait for MediaWiki API
- High API usage: 1000+ requests/day
- Timeouts: Frequent (17+ seconds)
- User experience: Poor

### After Caching
- First load: 10-20 seconds (cache miss)
- Subsequent loads: <100ms (cache hit)
- API usage: ~50 requests/week (revalidation only)
- Timeouts: Rare (only on cache miss)
- User experience: Excellent

### Cache Hit Rate Expectations

With proper warmup:
- MediaWiki infoboxes: **95%+ hit rate**
- Flags: **99%+ hit rate**
- Images: **90%+ hit rate**

## Database Schema

```prisma
model ExternalApiCache {
  id               String   @id @default(cuid())
  key              String   @unique
  service          String   // "mediawiki", "unsplash", etc.
  type             String   // "infobox", "flag", "image", etc.
  identifier       String   // Resource identifier
  data             String   // JSON-serialized content
  countryName      String?  // Associated country
  metadata         String?  // JSON metadata
  contentHash      String?  // SHA-256 hash for validation
  hitCount         Int      @default(0)
  lastValidatedAt  DateTime @default(now())
  validationStatus String   @default("valid")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  expiresAt        DateTime

  @@index([key])
  @@index([service, type, identifier])
  @@index([service, countryName])
  @@index([expiresAt])
  @@index([lastValidatedAt])
  @@index([validationStatus])
  @@index([countryName])
}
```

## Migration from In-Memory Cache

The system maintains backward compatibility with the old `WikiCache` model during transition. New code should use `ExternalApiCache`.

### Old Code
```typescript
// Old in-memory LRU cache (deprecated)
const cached = this.INFOBOX_CACHE.get(key);
if (cached && Date.now() - cached.timestamp < cached.ttl) {
  return cached.data;
}
```

### New Code
```typescript
// New persistent database cache
const cached = await mediaWikiCache.getInfobox(countryName);
if (cached) {
  return cached;
}
```

## Best Practices

1. **Always check cache first** before making external API calls
2. **Use appropriate TTLs** - static content deserves longer TTLs
3. **Monitor hit rates** - low hit rates indicate problems
4. **Run cleanup jobs** - prevent database bloat
5. **Revalidate intelligently** - prioritize popular content
6. **Handle cache misses gracefully** - external APIs may still timeout

## Monitoring

### Health Check Endpoint

```bash
curl https://yourapp.com/api/trpc/cache.getHealth
```

Response:
```json
{
  "status": "healthy",
  "metrics": {
    "totalEntries": 1234,
    "validEntries": 1180,
    "staleEntries": 42,
    "stalePercentage": "3.40",
    "averageHitCount": "15.30"
  }
}
```

### Recommended Alerts

- Stale percentage > 10%
- Average hit count < 5
- Total entries > 50,000 (cleanup needed)
- Validation failures > 100/day

## Future Enhancements

1. **Redis Integration**: Add Redis for even faster in-memory cache layer
2. **CDN Integration**: Cache images on CDN automatically
3. **Predictive Prefetching**: Pre-fetch likely-needed content
4. **Smart Revalidation**: ML-based prediction of content changes
5. **Distributed Caching**: Multi-server cache synchronization

## Troubleshooting

### Cache Not Working

1. Check database connection
2. Verify Prisma client is generated
3. Check for migration errors
4. Review logs for errors

### High Stale Percentage

1. Run cleanup job
2. Check external API availability
3. Review revalidation intervals
4. Investigate validation failures

### Low Hit Rate

1. Check TTL configuration
2. Review cache key generation
3. Monitor for frequent invalidations
4. Check for duplicate keys

## Support

For issues or questions:
- Check logs: `[ExternalApiCache]` prefix
- Review admin stats: `/api/trpc/cache.getStats`
- Monitor health: `/api/trpc/cache.getHealth`
