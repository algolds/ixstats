# Plan 138: Platform-Wide Radix UI Prune & Builder Monolith Consolidation

## Summary
Comprehensive consolidation and over-engineering elimination pass across dependencies, base UI components, modal architectures, procedural generation namespaces, country builder state monoliths, and country management tRPC routers.

- **Status:** DONE
- **Priority:** P1
- **Target Line Savings:** ~3,700 net lines removed/extracted
- **Dependencies Removed:** 3 runtime packages pruned (`@radix-ui/react-aspect-ratio`, `@radix-ui/react-switch`, `@radix-ui/react-separator`), `@types/papaparse` moved to `devDependencies`.

---

## 1. Scope & Architecture

### Phase 1: Package Dependencies & Base UI Pruning (`package.json`, `src/components/ui/`)
- Remove `@radix-ui/react-aspect-ratio` (0 consumers in `src/`).
- Remove `@radix-ui/react-switch` (0 consumers in `src/`).
- Remove `@radix-ui/react-separator` (replaced by native semantic `<hr />` in `src/components/ui/separator.tsx`).
- Move `@types/papaparse` from `dependencies` to `devDependencies`.
- Merge shortcut badge support into `src/components/ui/tooltip.tsx` and delete `src/components/ui/enhanced-tooltip.tsx`.
- Inline `FeedPollWidget.tsx` into `poll-widget.tsx` and delete `FeedPollWidget.tsx`.

### Phase 2: Metric Detail Modals Unification (`src/components/ui/modals/`)
- Move `GdpDetailsModal.tsx` and `PopulationDetailsModal.tsx` into `src/components/ui/modals/metric-details/` extending `BaseMetricDetailsModal.tsx`.
- Unify all 6 metric modals onto identical 4-tab caching and responsive presentation (`GDP`, `Population`, `Debt`, `DemographicsHealth`, `GovernmentSpending`, `Labor`).
- Delete loose 1,000-line modal monoliths `src/components/ui/modals/GdpDetailsModal.tsx` and `PopulationDetailsModal.tsx`.

### Phase 3: Procedural Archive Relocation (`src/lib/worldgen/procedural/`)
- Move `climate-system.ts`, `language-families.ts`, and `markov-naming.ts` from `src/lib/procedural-archive/` to `src/lib/worldgen/procedural/`.
- Update all call sites (`map-config.ts`, `settlements.ts`, `states.ts`, `cultures.ts`, `politics.ts`).
- Delete legacy `src/lib/procedural-archive/` directory.

### Phase 4: Builder Monolith & Data Extraction (`src/app/builder/`)
- Extract 2,000 lines of static component matrices from `src/app/builder/utils/atomicGovernmentIntegration.ts` to `src/app/builder/data/government-mappings.ts`.
- Replace class singleton ceremony in `UnifiedBuilderIntegrationService.ts` with pure transformer functions.
- Decompose 1,973-line `useBuilderState.ts` hook into clean domain slice hooks (`slices/useBuilderNavigationSlice.ts`, `useBuilderIdentitySlice.ts`, `useBuilderEconomicSlice.ts`, `useBuilderTaxSlice.ts`, `useBuilderPersistenceSlice.ts`).

### Phase 5: Country Management Routers Payload Builder (`src/server/`)
- Create `src/server/shared/country-payload-builder.ts` to extract repetitive Prisma payload mappings.
- Shrink `src/server/api/routers/countries/management/update.ts` (866L) and `create.ts` (808L) below the 700-line ceiling.
- Ratchet down `scripts/audit/arch-baseline.json` by removing `update.ts` and `create.ts`.

---

## 2. Verification Gates

1. `bun run typecheck:db`
2. `bun run typecheck:trpc`
3. `bun run typecheck:server`
4. `bun run typecheck:ui`
5. `bun run scripts/audit/audit-arch.ts`
