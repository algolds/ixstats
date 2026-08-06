# Plan 105 — Country Profile Performance & Bundle Optimization

**Target Route**: `/countries/[slug]`  
**Target Files**:
- [src/app/countries/[slug]/page.tsx](file:///home/jxsig/projects/ixstats/src/app/countries/[slug]/page.tsx)
- [src/app/countries/[slug]/_components/CountryOverviewPanel.tsx](file:///home/jxsig/projects/ixstats/src/app/countries/[slug]/_components/CountryOverviewPanel.tsx)
- [src/app/countries/[slug]/_hooks/useCountryPageState.ts](file:///home/jxsig/projects/ixstats/src/app/countries/[slug]/_hooks/useCountryPageState.ts)
- [src/hooks/useMyCountryMetrics.ts](file:///home/jxsig/projects/ixstats/src/hooks/useMyCountryMetrics.ts)

---

## User Review Required

> [!NOTE]
> This plan focuses on **zero-breaking-change performance optimization**. All visual layouts, ring modal popups, and tab navigation behavior remain 100% identical.

---

## Technical Audit & Root Causes

1. **Duplicate `government.getByCountryId` Queries**:
   - `page.tsx` fetches `api.government.getByCountryId.useQuery({ countryId: country?.id })`.
   - `useMyCountryMetrics.ts` independently fires the exact same `api.government.getByCountryId.useQuery({ countryId: country?.id })` hook.
2. **Heavyweight Modals Statically Bundled Upfront**:
   - `CountryOverviewPanel.tsx` imports `GdpDetailsModal`, `GdpPerCapitaDetailsModal`, `PopulationDetailsModal`, `GovernmentSpendingModal`, and `DemographicsHealthModal` statically.
   - Initial JS bundle footprint for public profile visitors is bloated by ~120KB of unused modal code.
3. **Dead / Redundant Queries in `useCountryPageState`**:
   - `useCountryPageState.ts` fires legacy `getWikiRichIntro` and `getWikiInfoboxCached` queries which are superseded by `useMyCountryMetrics`'s 3-layer `wikiCache.getCountryProfile` integration.
4. **CPU Re-computation Overhead**:
   - Flag themes (`getFlagColors`, `generateFlagThemeCSS`) and average vitality calculations re-run on every render frame of `CountryOverviewPanel`.

---

## Proposed Changes

### 1. Code Splitting & Dynamic Imports for Modals
#### [MODIFY] [CountryOverviewPanel.tsx](file:///home/jxsig/projects/ixstats/src/app/countries/[slug]/_components/CountryOverviewPanel.tsx)
- Replace static modal imports with `next/dynamic` loaders:
  ```tsx
  const GdpDetailsModal = dynamic(() => import("~/components/modals/GdpDetailsModal").then((m) => m.GdpDetailsModal));
  const PopulationDetailsModal = dynamic(() => import("~/components/modals/PopulationDetailsModal").then((m) => m.PopulationDetailsModal));
  const DemographicsHealthModal = dynamic(() => import("~/components/modals/metric-details").then((m) => m.DemographicsHealthModal));
  const GovernmentSpendingModal = dynamic(() => import("~/components/modals/metric-details").then((m) => m.GovernmentSpendingModal));
  ```
- Wrap `flagColors`, `flagThemeCSS`, and `vitalityRings` in `useMemo`.

---

### 2. Consolidate & Deduplicate Queries
#### [MODIFY] [useCountryPageState.ts](file:///home/jxsig/projects/ixstats/src/app/countries/[slug]/_hooks/useCountryPageState.ts)
- Remove unused legacy `getWikiRichIntro` and `getWikiInfoboxCached` queries from `useCountryPageState` to avoid redundant network requests.

#### [MODIFY] [useMyCountryMetrics.ts](file:///home/jxsig/projects/ixstats/src/hooks/useMyCountryMetrics.ts)
- Set `staleTime: 5 * 60_000` on `api.government.getByCountryId.useQuery` so React Query instantly reuses the response already fetched by `page.tsx` instead of making a duplicate HTTP fetch.

---

## Verification Plan

### Automated Verification
```bash
bun run lint                             # Ensure 0 ESLint / TypeScript errors
bun run typecheck:ui                     # Typecheck UI components
```

### Manual Verification
- Navigate to `/countries/Burgundie` (or any valid country slug).
- Confirm instant load, smooth tab switching, and 0 console errors.
- Click any of the 4 HealthRings to confirm the metric modal lazy-loads and displays properly.
