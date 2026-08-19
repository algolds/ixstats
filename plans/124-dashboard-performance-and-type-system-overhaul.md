# Plan 124: Audit & Overhaul Dashboard TypeScript Safety, React Performance & Component Decomposition

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 57ad1533..HEAD -- src/components/dashboard/ src/app/dashboard/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf | tech-debt | dx
- **Planned at**: commit `57ad1533`, 2026-08-09
- **Status**: DONE

## Why this matters

The signed-in dashboard is the primary home screen for IxStates users. Currently, 8 core components in `src/components/dashboard/` have `@ts-nocheck` at line 2, completely disabling TypeScript typechecking. Furthermore, `DashboardRouter.tsx` is a monolithic 1,034-line god component combining hero state, map embed logic, 11 uncoordinated tRPC queries, section snapshot renderers, and timer cycling in a single file. Every tab hover or timer tick forces re-rendering of the entire 1,034-line tree.

Removing `@ts-nocheck`, typing all Prisma/tRPC data contracts with strict discriminated unions, decoupling `DashboardRouter.tsx` into modular subcomponents, and memoizing feed item list renders will eliminate type safety regressions, prevent unnecessary re-renders, and dramatically improve UI responsiveness.

## Current state

- 8 Dashboard component files containing `@ts-nocheck`:
  1. `src/components/dashboard/DashboardRouter.tsx` (Line 2)
  2. `src/components/dashboard/sections/UnifiedDashboardSection.tsx` (Line 2)
  3. `src/components/dashboard/sections/UnifiedFeedContent.tsx` (Line 2)
  4. `src/components/dashboard/sections/UnifiedFeedItem.tsx` (Line 2)
  5. `src/components/dashboard/sections/BlurbSection.tsx` (Line 2)
  6. `src/components/dashboard/sections/TrendingSectionWidget.tsx` (Line 2)
  7. `src/components/dashboard/sections/CountriesToExploreCard.tsx` (Line 2)
  8. `src/components/dashboard/sections/WikiAuthorPopover.tsx` (Line 2)
- `DashboardRouter.tsx` (1,034 lines):
  - Line 247: `(LucideIcons as any)[chatBadge.icon]` (untyped icon lookup fallback)
  - Line 374: `(country as any)?.newStats` (untyped property access)
  - Line 710, 819: `(e: any)` and `(b: any)` in snapshot renderers
  - Line 333: 60s auto-cycling timer calling `setActiveSection` directly on root state
- Feed activity handling in `UnifiedFeedContent.tsx`:
  - Line 19: `groupWikiEdits(activities: any[])` using untyped arrays
  - Line 76: `groupRepeatedActivities(activities: any[])` executing unmemoized inline grouping
- Conventions to follow:
  - tRPC procedures called via `api.*.useQuery` with explicit `{ enabled: ... }` flags.
  - Component design matching Facet design system (`src/components/facet-ui`).

## Commands you will need

| Purpose   | Command                                | Expected on success |
|-----------|----------------------------------------|---------------------|
| Dev server| `bun run dev`                          | Server running on port 3000 |
| Single test| `bun run test -- src/components/dashboard` | All tests pass |

*(Note: Per repository guidelines, do not run global `tsc` or full typecheck commands. Rely on IDE diagnostics or `bun run dev`.)*

## Scope

**In scope**:
- `src/components/dashboard/DashboardRouter.tsx`
- `src/components/dashboard/sections/UnifiedDashboardSection.tsx`
- `src/components/dashboard/sections/UnifiedFeedContent.tsx`
- `src/components/dashboard/sections/UnifiedFeedItem.tsx`
- `src/components/dashboard/sections/BlurbSection.tsx`
- `src/components/dashboard/sections/TrendingSectionWidget.tsx`
- `src/components/dashboard/sections/CountriesToExploreCard.tsx`
- `src/components/dashboard/sections/WikiAuthorPopover.tsx`
- `src/types/dashboard-feed.ts` [NEW]
- `src/components/dashboard/hero/DashboardHero.tsx` [NEW]
- `src/components/dashboard/hero/HeroSnapshotPanels.tsx` [NEW]
- `src/components/dashboard/hero/useHeroAutoCycle.ts` [NEW]

**Out of scope**:
- `src/app/mycountry/*` routes and MyCountry components
- `src/server/api/routers/*` (tRPC backend definitions remain unchanged)
- Changing backend data structures or Prisma database models

## Git workflow

- Branch: `v2`
- Commit message format: `refactor(dashboard): <short summary>`

## Steps

### Step 1: Create Typed Feed Contract & Remove `@ts-nocheck` from Section Components

1. Create `src/types/dashboard-feed.ts` defining strict discriminated unions for activity, thinkpages, wiki, and forum items in the unified feed stream.
2. Remove `// @ts-nocheck` from:
   - `src/components/dashboard/sections/WikiAuthorPopover.tsx`
   - `src/components/dashboard/sections/CountriesToExploreCard.tsx`
   - `src/components/dashboard/sections/TrendingSectionWidget.tsx`
   - `src/components/dashboard/sections/BlurbSection.tsx`
3. Fix all strict TypeScript errors (explicit props interface, null checks, typing `accounts` and modal payload state).

**Verify**: Check that no compilation or runtime errors occur when accessing `/dashboard` in `bun run dev`.

---

### Step 2: Fix Types and Memoize Feed Items in `UnifiedFeedContent.tsx` & `UnifiedFeedItem.tsx`

1. Remove `// @ts-nocheck` from `UnifiedFeedContent.tsx` and `UnifiedFeedItem.tsx`.
2. Update `groupWikiEdits` and `groupRepeatedActivities` helper functions to accept strongly typed feed item arrays instead of `any[]`.
3. Wrap `groupWikiEdits` and `groupRepeatedActivities` processing in `useMemo` with proper dependencies (`[activities]`).
4. Wrap `UnifiedFeedItem` in `React.memo` to prevent feed list re-renders when parent state updates.

**Verify**: Verify feed renders cleanly without `@ts-nocheck` and tab switches perform without feed item re-render flashes.

---

### Step 3: Deconstruct `DashboardRouter.tsx` into Modular Hero Subcomponents

1. Extract hero state and auto-cycling timer logic into custom hook `src/components/dashboard/hero/useHeroAutoCycle.ts`.
2. Extract snapshot rendering (Overview, Executive, Diplomacy, Intelligence, Defense) into `src/components/dashboard/hero/HeroSnapshotPanels.tsx`.
3. Create `src/components/dashboard/hero/DashboardHero.tsx` combining hero navigation pills, map embed, and snapshot panels.
4. Refactor `DashboardRouter.tsx` to serve as a clean, lightweight layout orchestrator (< 150 lines).
5. Remove `// @ts-nocheck` from `DashboardRouter.tsx` and remove all `(as any)` type assertions.

**Verify**: Confirm dashboard hero auto-cycles smoothly, pill clicks update snapshot panels, and `@ts-nocheck` is completely eliminated.

---

### Step 4: Optimize tRPC Query Stale Times & Modal State Co-location

1. Add `staleTime: 60_000` (1 minute) to static background queries (`getGlobalStats`, `getMapLinkStatus`, `getRankings`) in dashboard components to eliminate redundant re-fetching on tab focus.
2. Co-locate metric modal state (`activeModal`) inside the Overview snapshot component rather than maintaining it at the root `DashboardRouter` level.

**Verify**: Tab switching between browser tabs causes zero background network refetch noise for static dashboard queries.

## Done criteria

- [x] All 8 `@ts-nocheck` annotations removed from `src/components/dashboard/`
- [x] `DashboardRouter.tsx` decomposed into focused subcomponents under `src/components/dashboard/hero/`
- [x] Feed list items in `UnifiedFeedContent.tsx` memoized with `React.memo` and `useMemo`
- [x] Static dashboard tRPC queries configured with appropriate `staleTime`
- [x] No regressions on `/dashboard` routes

## STOP conditions

- If backend tRPC schema changes require altering `src/server/api/routers/`, stop and report.
- If removing `@ts-nocheck` surfaces breaking API contract mismatches that affect other pages, stop and verify scope.

## Maintenance notes

- Future hero snapshot panels should be added directly to `HeroSnapshotPanels.tsx` with proper discriminated union props.
- Keep `staleTime` tuned for static stats vs real-time feed updates.
