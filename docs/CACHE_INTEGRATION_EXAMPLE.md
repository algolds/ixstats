# Cache Integration Examples

This document shows practical examples of integrating the External API Cache into existing services.

## Example 1: MediaWiki Infobox Fetching

### Before (No Caching)

```typescript
// Old approach - always hits the API
async function getCountryInfobox(countryName: string) {
  const response = await fetch(
    `https://ixwiki.com/api.php?action=query&titles=${countryName}&...`
  );
  const data = await response.json();
  return parseInfobox(data);
}
```

### After (With Caching)

```typescript
import { mediaWikiCache } from "~/lib/mediawiki-cache-service";

async function getCountryInfobox(countryName: string) {
  // 1. Check cache first
  const cached = await mediaWikiCache.getInfobox(countryName);
  if (cached) {
    console.log(`[Cache HIT] Infobox for ${countryName}`);
    return cached;
  }

  console.log(`[Cache MISS] Fetching infobox for ${countryName}`);

  // 2. Cache miss - fetch from API
  const response = await fetch(
    `https://ixwiki.com/api.php?action=query&titles=${countryName}&...`
  );
  const data = await response.json();
  const infobox = parseInfobox(data);

  // 3. Store in cache for future use
  await mediaWikiCache.setInfobox(countryName, infobox, {
    source: "ixwiki",
    wikitextLength: infobox.rawWikitext?.length,
  });

  return infobox;
}
```

**Benefits:**
- First call: ~15 seconds (API call)
- Subsequent calls: ~50ms (cache hit)
- 99.6% reduction in response time

## Example 2: Flag URL Fetching

### Before (No Caching)

```typescript
async function getFlagUrl(countryName: string) {
  // Try multiple sources
  const sources = [
    `https://ixwiki.com/wiki/File:Flag_of_${countryName}.svg`,
    `https://flagcdn.com/${countryCode}.svg`,
    `https://restcountries.com/v3.1/name/${countryName}`,
  ];

  for (const url of sources) {
    const response = await fetch(url);
    if (response.ok) {
      return extractFlagUrl(response);
    }
  }

  return null;
}
```

### After (With Caching)

```typescript
import { mediaWikiCache } from "~/lib/mediawiki-cache-service";
import { imageCache } from "~/lib/image-cache-service";

async function getFlagUrl(countryName: string) {
  // 1. Check cache first
  const cachedFlag = await mediaWikiCache.getFlag(countryName);
  if (cachedFlag) {
    console.log(`[Cache HIT] Flag for ${countryName}`);
    return cachedFlag;
  }

  console.log(`[Cache MISS] Fetching flag for ${countryName}`);

  // 2. Try multiple sources
  let flagUrl: string | null = null;

  // Try MediaWiki
  flagUrl = await fetchFromMediaWiki(countryName);

  // Fallback to flagcdn
  if (!flagUrl) {
    const countryCode = getCountryCode(countryName);
    flagUrl = await fetchFromFlagCdn(countryCode);
  }

  // Fallback to REST Countries
  if (!flagUrl) {
    flagUrl = await fetchFromRestCountries(countryName);
  }

  // 3. Cache the result (even if null - prevents repeated failures)
  if (flagUrl) {
    await mediaWikiCache.setFlag(countryName, flagUrl, {
      source: "auto-detect",
    });
  }

  return flagUrl;
}
```

**Benefits:**
- Eliminates multiple API calls
- Caches for 30 days (flags rarely change)
- Graceful fallback handling

## Example 3: Unsplash Image Fetching

### Before (No Caching)

```typescript
async function getCountryImage(query: string) {
  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${query}`,
    {
      headers: { Authorization: `Client-ID ${unsplashKey}` },
    }
  );

  const data = await response.json();
  return data.results[0]?.urls.regular;
}
```

### After (With Caching)

```typescript
import { imageCache } from "~/lib/image-cache-service";

async function getCountryImage(query: string) {
  // 1. Check cache first
  const cached = await imageCache.getUnsplashImage(query);
  if (cached) {
    console.log(`[Cache HIT] Unsplash image for "${query}"`);
    return cached.url;
  }

  console.log(`[Cache MISS] Fetching Unsplash image for "${query}"`);

  // 2. Fetch from Unsplash API
  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${query}`,
    {
      headers: { Authorization: `Client-ID ${unsplashKey}` },
    }
  );

  const data = await response.json();
  const photo = data.results[0];

  if (!photo) {
    return null;
  }

  // 3. Cache the image data
  await imageCache.setUnsplashImage(query, {
    url: photo.urls.regular,
    originalUrl: photo.urls.full,
    width: photo.width,
    height: photo.height,
    alt: photo.alt_description,
  });

  return photo.urls.regular;
}
```

**Benefits:**
- Reduces Unsplash API usage (rate limits)
- Images are immutable - safe to cache long-term
- Includes metadata for future use

## Example 4: React Component Integration

### Before (Direct API Calls)

```typescript
export function CountryCard({ countryName }: { countryName: string }) {
  const [infobox, setInfobox] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await fetchInfoboxFromAPI(countryName);
      setInfobox(data);
      setLoading(false);
    }
    loadData();
  }, [countryName]);

  if (loading) return <Spinner />;
  return <div>{/* render infobox */}</div>;
}
```

### After (With tRPC + Cache)

```typescript
// In tRPC router (src/server/api/routers/countries.ts)
import { mediaWikiCache } from "~/lib/mediawiki-cache-service";

export const countriesRouter = createTRPCRouter({
  getInfobox: publicProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      // Check cache
      let infobox = await mediaWikiCache.getInfobox(input.countryName);

      if (!infobox) {
        // Fetch from API
        infobox = await fetchInfoboxFromAPI(input.countryName);

        // Cache it
        await mediaWikiCache.setInfobox(input.countryName, infobox);
      }

      return infobox;
    }),
});

// In React component
export function CountryCard({ countryName }: { countryName: string }) {
  const { data: infobox, isLoading } = api.countries.getInfobox.useQuery({
    countryName,
  });

  if (isLoading) return <Spinner />;
  return <div>{/* render infobox */}</div>;
}
```

**Benefits:**
- Automatic cache management
- React Query handles client-side caching too (double caching)
- Type-safe API calls

## Example 5: Batch Cache Operations

### Warming the Cache

```typescript
import { mediaWikiCache } from "~/lib/mediawiki-cache-service";
import { db } from "~/server/db";

async function warmCountryCache() {
  // Get all countries from database
  const countries = await db.country.findMany({
    select: { name: true },
  });

  console.log(`Warming cache for ${countries.length} countries...`);

  // Fetch and cache all infoboxes
  for (const country of countries) {
    try {
      // Check if already cached
      const cached = await mediaWikiCache.getInfobox(country.name);

      if (!cached) {
        console.log(`Fetching ${country.name}...`);
        const infobox = await fetchInfoboxFromAPI(country.name);
        await mediaWikiCache.setInfobox(country.name, infobox);

        // Rate limit to avoid overwhelming MediaWiki
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to cache ${country.name}:`, error);
    }
  }

  console.log("Cache warming complete!");
}
```

### Batch Invalidation

```typescript
import { mediaWikiCache } from "~/lib/mediawiki-cache-service";
import { markForRevalidation } from "~/lib/cache-revalidation";

async function invalidateRegion(continent: string) {
  // Get countries in continent
  const countries = await db.country.findMany({
    where: { continent },
    select: { name: true },
  });

  console.log(`Invalidating cache for ${countries.length} countries in ${continent}...`);

  // Mark all for revalidation
  await markForRevalidation("mediawiki", undefined);

  // Or delete specific entries
  for (const country of countries) {
    await externalApiCache.delete({
      service: "mediawiki",
      type: "infobox",
      identifier: country.name,
    });
  }
}
```

## Example 6: Custom API Integration

### Any External API

```typescript
import { externalApiCache } from "~/lib/external-api-cache";

async function getWeatherData(city: string) {
  // 1. Check cache
  const cached = await externalApiCache.get({
    service: "openweather",
    type: "weather",
    identifier: city,
    ttl: 60 * 60 * 1000, // 1 hour for weather data
  });

  if (cached) {
    console.log(`[Cache HIT] Weather for ${city}`);
    return cached.data;
  }

  // 2. Fetch from API
  console.log(`[Cache MISS] Fetching weather for ${city}`);
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`
  );
  const data = await response.json();

  // 3. Cache it
  await externalApiCache.set(
    {
      service: "openweather",
      type: "weather",
      identifier: city,
      ttl: 60 * 60 * 1000, // 1 hour
    },
    data,
    {
      source: "openweathermap",
      temperature: data.main.temp,
    }
  );

  return data;
}
```

## Example 7: Conditional Caching

### Cache Only Successful Responses

```typescript
async function fetchCountryData(countryName: string) {
  const cached = await mediaWikiCache.getInfobox(countryName);
  if (cached) return cached;

  try {
    const infobox = await fetchInfoboxFromAPI(countryName);

    // Only cache if we got valid data
    if (infobox && infobox.name) {
      await mediaWikiCache.setInfobox(countryName, infobox);
    }

    return infobox;
  } catch (error) {
    console.error(`Failed to fetch ${countryName}:`, error);

    // Don't cache errors - let it retry next time
    return null;
  }
}
```

## Example 8: Cache Revalidation in Action

### Background Job

```typescript
import { findStaleEntries } from "~/lib/cache-revalidation";
import { mediaWikiCache } from "~/lib/mediawiki-cache-service";

async function revalidatePopularEntries() {
  // Find top 50 entries needing revalidation
  const staleEntries = await findStaleEntries(50);

  console.log(`Revalidating ${staleEntries.length} entries...`);

  for (const entry of staleEntries) {
    try {
      // Fetch fresh data
      const freshData = await fetchFromAPI(entry.identifier);

      // Validate against cache
      const isValid = await externalApiCache.validateContent(
        {
          service: entry.service as any,
          type: entry.type as any,
          identifier: entry.identifier,
        },
        freshData
      );

      if (!isValid) {
        console.log(`Content changed for ${entry.identifier} - updating cache`);
        // Content changed - update will happen automatically in validateContent
      } else {
        console.log(`Content unchanged for ${entry.identifier}`);
      }
    } catch (error) {
      console.error(`Revalidation failed for ${entry.identifier}:`, error);
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
```

## Integration Checklist

When integrating cache into your service:

- [ ] Import the appropriate cache service
- [ ] Check cache before making API call
- [ ] Handle cache hits (return cached data)
- [ ] Handle cache misses (fetch from API)
- [ ] Store fetched data in cache
- [ ] Include metadata for debugging
- [ ] Set appropriate TTL for content type
- [ ] Handle errors gracefully (don't cache errors)
- [ ] Log cache hits/misses for monitoring
- [ ] Consider batch operations for bulk data

## Performance Testing

```typescript
// Test cache performance
async function testCachePerformance(countryName: string) {
  console.log("Testing cache performance...");

  // First call (cache miss)
  const start1 = Date.now();
  await getCountryInfobox(countryName);
  const duration1 = Date.now() - start1;
  console.log(`First call (miss): ${duration1}ms`);

  // Second call (cache hit)
  const start2 = Date.now();
  await getCountryInfobox(countryName);
  const duration2 = Date.now() - start2;
  console.log(`Second call (hit): ${duration2}ms`);

  const improvement = ((duration1 - duration2) / duration1 * 100).toFixed(2);
  console.log(`Improvement: ${improvement}%`);
}

// Expected output:
// First call (miss): 15243ms
// Second call (hit): 47ms
// Improvement: 99.69%
```
