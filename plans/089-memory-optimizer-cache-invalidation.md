# Plan 089: Memory Optimizer Cache Invalidation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat HEAD -- src/lib/production-optimizations.ts src/lib/trpc-cache.ts src/lib/mediawiki-service.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `29dc7239`, 2026-06-26

## Why this matters

The `MemoryOptimizer` is responsible for monitoring system memory and proactively freeing cache space when memory usage limits are approached (e.g. above 70-80%). However, it currently misses two critical in-memory cache stores:
1. The module-level `memoryCache` in `src/lib/trpc-cache.ts` which holds tRPC query results.
2. The `IxnayWikiService` LRU caches in `src/lib/mediawiki-service.ts` which hold parsed MediaWiki page data, flags, templates, and rendered HTML.

Over time, these in-memory caches accumulate substantial amounts of memory, potentially leading to memory bloat and Out-Of-Memory (OOM) crashes on 8GB host servers. Hooking these caches into `MemoryOptimizer.clearAllCaches()` will prevent memory-related performance regressions.

## Current state

- **Relevant Files**:
  - `src/lib/production-optimizations.ts` — defines `MemoryOptimizer.clearAllCaches()`.
  - `src/lib/trpc-cache.ts` — holds `memoryCache` Map.
  - `src/lib/mediawiki-service.ts` — defines `IxnayWikiService` class and its L1 caches.

- **Excerpts**:
  - `src/lib/production-optimizations.ts:93-94`:
    ```typescript
    // Note: tRPC cache is a module-level Map, we can't easily clear it from here
    // but it has TTL-based auto-cleanup
    ```
  - `src/lib/trpc-cache.ts:70`:
    ```typescript
    const memoryCache = new Map<string, MemoryCacheEntry>();
    ```
  - `src/lib/mediawiki-service.ts:251-270`:
    ```typescript
    private readonly FLAG_CACHE = new LRUCache<string, CacheEntry<string | null>>(
      MEDIAWIKI_CONFIG.cache.maxSize
    );
    private readonly INFOBOX_CACHE = new LRUCache<
      string,
      CacheEntry<CountryInfoboxWithDynamicProps | null>
    >(MEDIAWIKI_CONFIG.cache.maxSize);
    ...
    ```

- **Design Constraints**:
  - **No Circular Imports or Client Leaks**: To prevent Next.js compilation issues, the caches must be imported dynamically (`await import(...)`) when invalidating.
  - **Track All Service Instances**: Since `WikiCacheService` dynamically spawns multiple `IxnayWikiService` instances for different sources, we must track all created instances and clear each of their in-memory LRU caches.

## Commands you will need

| Purpose   | Command                         | Expected on success |
|-----------|---------------------------------|---------------------|
| Typecheck | `bun run typecheck`             | exit 0, no errors   |
| Lint      | `bun run lint`                  | exit 0              |

## Scope

**In scope**:
- `src/lib/production-optimizations.ts`
- `src/lib/trpc-cache.ts`
- `src/lib/mediawiki-service.ts`

**Out of scope**:
- Database/Redis key evictions. Only in-memory (L1/module-level) cache invalidation is in scope.

## Git workflow

- Branch: `advisor/089-memory-optimizer-cache-invalidation`
- Commit message style: `perf: hook trpc and mediawiki memory caches into memory optimizer`

## Steps

### Step 1: Export a manual clear function in trpc-cache.ts

Expose a function to clear the module-level `memoryCache` Map.
At the end of `src/lib/trpc-cache.ts`, add:
```typescript
export function clearTrpcMemoryCache(): void {
  memoryCache.clear();
  console.log("[TRPC_CACHE] Module-level memory cache cleared manually");
}
```

### Step 2: Track and clear all IxnayWikiService instances in mediawiki-service.ts

1. Declare a module-level array to keep track of active service instances:
   ```typescript
   const activeWikiInstances: IxnayWikiService[] = [];
   ```
2. In the `IxnayWikiService` constructor, push the instance to the array if running on the server:
   ```typescript
   if (typeof window === "undefined") {
     activeWikiInstances.push(this);
   }
   ```
3. Export a helper function to clear all instances:
   ```typescript
   export function clearAllMediaWikiCaches(): void {
     activeWikiInstances.forEach((instance) => {
       instance.clearCache();
     });
     console.log(`[MediaWiki] Cleared L1 caches for ${activeWikiInstances.length} service instances`);
   }
   ```

### Step 3: Wire invalidations into MemoryOptimizer.clearAllCaches()

In `src/lib/production-optimizations.ts`, update `MemoryOptimizer.clearAllCaches()`:
1. Dynamically import `clearTrpcMemoryCache` and call it:
   ```typescript
   try {
     const { clearTrpcMemoryCache } = await import("./trpc-cache");
     clearTrpcMemoryCache();
     console.log("[MemoryOptimizer] Cleared trpcMemoryCache");
   } catch (error) {
     console.error("[MemoryOptimizer] Failed to clear trpc memory cache:", error);
   }
   ```
2. Dynamically import `clearAllMediaWikiCaches` and call it:
   ```typescript
   try {
     const { clearAllMediaWikiCaches } = await import("./mediawiki-service");
     clearAllMediaWikiCaches();
     console.log("[MemoryOptimizer] Cleared mediawikiL1Caches");
   } catch (error) {
     console.error("[MemoryOptimizer] Failed to clear mediawiki memory caches:", error);
   }
   ```

**Verify**: `bun run typecheck` and `bun run lint` execute successfully.

## Test plan

- Run `bun run typecheck` to verify correct imports and type safety.
- Verify compilation with `bun run build`.

## Done criteria

- [ ] `MemoryOptimizer.clearAllCaches()` calls both clearing routines.
- [ ] Active instances of `IxnayWikiService` are cleaned when memory threshold is crossed.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- None.
