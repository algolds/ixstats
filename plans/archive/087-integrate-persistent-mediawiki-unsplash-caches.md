# Plan 087: Integrate Persistent MediaWiki & Unsplash Caches

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 29dc7239..HEAD -- src/lib/mediawiki-service.ts src/lib/services/wiki-cache-service.ts src/lib/unsplash-service.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `29dc7239`, 2026-06-26

## Why this matters

The project has fully implemented, database-backed persistent caches (`wikiCacheService` and `externalApiCache`) that survive server restarts. However, these caches are bypassed by `mediawiki-service.ts` and `unsplash-service.ts` in favor of transient in-memory maps. Consequently, every server restart wipes the caches, causing slow initial loads (up to 15 seconds), potential rate-limiting, and request timeouts from MediaWiki/Unsplash APIs. Integrating these persistent caches will ensure long-term stability and near-instantaneous page loads.

## Current state

- **Relevant Files**:
  - `src/lib/mediawiki-service.ts` — contains `IxnayWikiService` that fetches MediaWiki content. Uses private `LRUCache` in-memory maps.
  - `src/lib/services/wiki-cache-service.ts` — implements the 3-layer `WikiCache` (Redis + DB + L1). Calls `IxnayWikiService` on miss.
  - `src/lib/unsplash-service.ts` — contains `UnsplashService` for dynamically fetching background images. Uses a transient in-memory `Cache`.
  - `src/lib/external-api-cache.ts` — implements generic `externalApiCache` persistent DB store.

- **Excerpts**:
  - `src/lib/mediawiki-service.ts:1012-1018`:
    ```typescript
    async getCountryInfobox(countryName: string): Promise<CountryInfoboxWithDynamicProps | null> {
      // Check cache first
      const cached = this.getCacheValue(this.INFOBOX_CACHE, countryName);
      if (cached !== null) {
        console.log(`[MediaWiki] Infobox cache hit for: ${countryName}`);
        return cached;
      }
    ```
  - `src/lib/services/wiki-cache-service.ts:250-254`:
    ```typescript
    // Layer 3: Fetch from MediaWiki API
    console.log(
      `[WikiCache] Cache miss for infobox: ${countryName} (${wikiSource}), fetching from API`
    );
    const infobox = await this.getWikiService(wikiSource).getCountryInfobox(countryName);
    ```
  - `src/lib/unsplash-service.ts:94-100`:
    ```typescript
    private async fetchImages(params: UnsplashSearchParams): Promise<UnsplashImageData[]> {
      const cacheKey = JSON.stringify(params);
      const cached = this.unsplashCache.get<UnsplashImageData[]>(cacheKey);

      if (cached !== undefined) {
        return cached;
      }
    ```

- **Design Constraints**:
  - **No Server Imports in Client Bundle**: `mediawiki-service.ts` and `unsplash-service.ts` are imported by client components (e.g. `CountryInfobox.tsx`, `DynamicCountryHeader.tsx`). Top-level imports of `wiki-cache-service.ts` or `external-api-cache.ts` will bring `~/server/db` into the client bundle, crashing Webpack. We **must** use dynamic imports (`await import(...)`) gated by `typeof window === "undefined"`.
  - **Avoid Infinite Recursion**: When `IxnayWikiService` delegates server-side cache misses to `wikiCacheService`, `wikiCacheService` will fetch from `IxnayWikiService` on a cache miss. To avoid infinite loops, we must pass a `skipCache: true` option through the call stack when performing the actual L3 API fetches.

## Commands you will need

| Purpose   | Command                         | Expected on success |
|-----------|---------------------------------|---------------------|
| Typecheck | `bun run typecheck`             | exit 0, no errors   |
| Tests     | `bun run test -- mediawiki`     | all tests pass      |
| Lint      | `bun run lint`                  | exit 0              |

## Scope

**In scope**:
- `src/lib/mediawiki-service.ts`
- `src/lib/services/wiki-cache-service.ts`
- `src/lib/unsplash-service.ts`

**Out of scope**:
- Direct modification of client components or React hooks.
- Modifying tRPC procedure wrappers or endpoint structures.

## Git workflow

- Branch: `advisor/087-persistent-caches`
- Commit message style: `perf: <summary>`

## Steps

### Step 1: Update method signatures in mediawiki-service.ts

Add an optional `options` parameter containing `skipCache?: boolean` to:
- `getCountryInfobox`
- `getPageWikitext`
- `getFlagUrl`

```typescript
// Example target signature
async getCountryInfobox(
  countryName: string,
  options?: { skipCache?: boolean }
): Promise<CountryInfoboxWithDynamicProps | null>
```

**Verify**: `bun run typecheck` resolves successfully (no signature mismatch errors).

### Step 2: Implement wikiCacheService integration in mediawiki-service.ts

For the three methods modified in Step 1, add server-side checks. If `typeof window === "undefined"` and `!options?.skipCache`:
1. Dynamically import `wikiCacheService` using `const { wikiCacheService } = await import("~/lib/services/wiki-cache-service");`.
2. Query `wikiCacheService` (e.g., `wikiCacheService.getCountryInfobox(countryName, this.wikiSource)`).
3. If it returns valid data, write it to the local L1 cache Map, and return it.
4. If it returns null or fails, fall back to the pre-existing API/SQL fetching logic in the method.

**Verify**: `bun run typecheck` passes.

### Step 3: Pass skipCache: true from wiki-cache-service.ts

In `src/lib/services/wiki-cache-service.ts`, update every site that invokes `getWikiService(wikiSource)` to perform L3 queries on cache misses. Pass `{ skipCache: true }` to the calls to prevent recursion:
- In `getCountryInfobox`: `this.getWikiService(wikiSource).getCountryInfobox(countryName, { skipCache: true })`
- In `getPageWikitext`: `this.getWikiService(wikiSource).getPageWikitext(pageName, { skipCache: true })`
- In `getFlagUrl`: `this.getWikiService(wikiSource).getFlagUrl(countryName, { skipCache: true })`

**Verify**: `bun run test -- mediawiki` executes without infinite recursion/stack overflow.

### Step 4: Integrate externalApiCache in unsplash-service.ts

In `src/lib/unsplash-service.ts`, modify `fetchImages`:
1. If `typeof window === "undefined"`:
   - Dynamically import `externalApiCache` from `~/lib/external-api-cache`.
   - Call `externalApiCache.get<UnsplashImageData[]>` with options: `{ service: "unsplash", type: "json", identifier: cacheKey }`.
   - If hit: cache it in `this.unsplashCache` (L1 memory) and return.
2. After a successful API fetch from Unsplash:
   - If `typeof window === "undefined"`:
     - Dynamically import `externalApiCache` from `~/lib/external-api-cache`.
     - Write results using `externalApiCache.set(...)` with a TTL of 30 days (`30 * 24 * 60 * 60 * 1000`).

**Verify**: `bun run typecheck` and `bun run lint` both pass.

## Test plan

- Run existing MediaWiki integration tests to verify no regressions:
  `bun run test -- mediawiki-service` or `bun run test -- wiki-cache-service`.
- Verify the build compiles without issues: `bun run build`.

## Done criteria

- [ ] `bun run typecheck` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] Caching integration does not cause stack overflows (no recursive calls).
- [ ] No database import errors on client builds.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- If importing `wiki-cache-service` dynamically inside `mediawiki-service.ts` still leaks server-side dependencies to client bundles and breaks Next.js compilation (even when guarded by `typeof window === "undefined"`). If this occurs, stop and request helper utilities to isolate client-only interfaces.
- If stack overflow/recursion occurs and cannot be resolved with `skipCache: true`.

## Maintenance notes

- Any future MediaWiki or Unsplash client methods must follow the L1/L2 server-split pattern to avoid bundling database drivers.
