# Plan 050: Wiki Import Builder Performance Optimization

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat c11a6337..HEAD -- src/app/builder/components/sections/ImportSection.tsx src/app/builder/import/_components/DynamicIslandSearch.tsx src/server/api/routers/countries/wiki.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `c11a6337`, 2026-06-21

## Why this matters

Currently, when a user searches for a country to import, the builder performs up to 30 parallel `countries.parseInfobox` tRPC calls (one for each query search result) to populate GDP, population, capital, and government type on each card in the results dropdown.
- This creates massive network congestion on the client-side browser and spikes backend CPU load.
- If the backend cache is cold, the server performs up to 30 concurrent external mediawiki scrapes, resulting in extremely high latency (>10s) or triggering Cloudflare security challenges/blocks.
- When the user selects and imports the country, the client executes the identical `parseInfobox` query a second time, duplicating the parse work.

By removing the search-time parallel loops and resolving details **lazily (on-demand)** only when a country is selected for preview, we eliminate the N+1 tRPC requests, reduce search latency, and save significant backend resources.

## Current state

- [ImportSection.tsx](file:///ixwiki/public/projects/ixstats/src/app/builder/components/sections/ImportSection.tsx) — Performs `Promise.all` across all search results (lines 174–211), querying `parseInfoboxMutation` for every result.
- [DynamicIslandSearch.tsx](file:///ixwiki/public/projects/ixstats/src/app/builder/import/_components/DynamicIslandSearch.tsx) — Displays search results cards (`SearchResultItemInline`) and the country preview overlay (`previewingCountry`).
- [wiki.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/countries/wiki.ts) — Contains the `parseInfobox` endpoint.

## Commands you will need

| Purpose   | Command                                                            | Expected on success |
|-----------|--------------------------------------------------------------------|---------------------|
| Lint      | `bun run lint`                                                     | exit 0, no errors   |
| Typecheck | `bun run typecheck:ui`                                             | exit 0, no errors   |
| Dev Server| `bun run dev`                                                      | starts successfully |

## Scope

**In scope**:
- [ImportSection.tsx](file:///ixwiki/public/projects/ixstats/src/app/builder/components/sections/ImportSection.tsx)
- [DynamicIslandSearch.tsx](file:///ixwiki/public/projects/ixstats/src/app/builder/import/_components/DynamicIslandSearch.tsx)

**Out of scope**:
- Database schema changes (Prisma models are untouched).
- Modification of parser regex/logic in `src/lib/unified-wiki-parser.ts` or `src/lib/wiki-infobox-parser.ts`.

## Steps

### Step 1: Omit parallel infobox queries during search phase
In `src/app/builder/components/sections/ImportSection.tsx`:
1. Locate the debounced search `useEffect` hook.
2. In the `results.map` block (lines 174–211), remove the inner try-catch block that performs `parseInfoboxMutation.mutateAsync`.
3. Keep the fast flag resolution: `const flagUrl = await unifiedFlagService.getFlagUrl(result.title);`.
4. Directly return the result mapped with `flagUrl`, leaving other metadata fields (`population`, `gdpPerCapita`, `capital`, `government`) undefined.
5. In the fallback case (when category filter is not countries/nations), verify results are directly stored.

**Verify**: Perform a search in the UI and ensure the search results list displays immediately using MediaWiki's text snippets, without launching parallel infobox queries in the Network Tab.

### Step 2: Implement On-Demand Metadata Loading in Preview Overlay
In `src/app/builder/import/_components/DynamicIslandSearch.tsx`:
1. Receive a new prop `onLoadDetails?: (title: string) => Promise<any>` or access the tRPC context to load details.
2. Add a `loadingDetails` boolean state and a `detailsCache` ref or state mapping `title` -> `parsedData`.
3. In `handleCountrySelect` (line 257):
   - When a country is chosen for preview, check if `detailsCache[result.title]` exists.
   - If not, set `loadingDetails` to true, call `onLoadDetails(result.title)` (or the tRPC query), store the result, and set `loadingDetails` to false.
4. In the preview overlay:
   - Show a loading skeleton or shimmer effect for the stats grid (Population, GDP/Capita, Capital, Government) when `loadingDetails` is true.
   - Render the values from the lazy-loaded details once resolved.

**Verify**: Click a search result. Ensure the preview overlay opens instantly, showing a loading indicator, and populates with the correct details once the backend query resolves.

### Step 3: De-duplicate and reuse parsed data on import
In `src/app/builder/components/sections/ImportSection.tsx`:
1. Update `handleSelectResult` to accept an optional `cachedData` parameter.
2. If `cachedData` is provided, skip the tRPC call `parseInfoboxMutation.mutateAsync` and directly set `parsedData` to `cachedData`.
3. In `handleDeepScanComplete` or the import callback, pass the parsed preview data to ensure it is not fetched again.

**Verify**: Open a preview, wait for it to load, and click "Import Country". Confirm that the transition is instant and no duplicate network requests are made.

## Done criteria

- [ ] `bun run lint` returns no errors on modified files.
- [ ] Typing a search query fires exactly one search tRPC request instead of N+1 requests.
- [ ] Selecting a country for preview fetches its details on-demand.
- [ ] Confirming the import uses the pre-fetched preview details without duplicate network requests.

## STOP conditions

- If the search results drop-down ceases to render due to missing fallback text snippets, stop and verify `result.snippet` values returned by MediaWiki search.
