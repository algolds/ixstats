# Plan 139: Legacy Country Economy Purge, Flag Hook Deduplication & Type Consolidation

## Summary
Massive dead-code elimination and over-engineering prune pass removing over 9,000 lines of obsolete pre-Factbook components, dead infoboxes, duplicate flag hooks, and condensing the top type monolith in `arch-baseline.json`.

- **Status:** DONE
- **Priority:** P1
- **Target Line Savings:** ~9,300+ net lines deleted / condensed
- **Components/Files Deleted:** 13 dead files
- **Relocation**: Moved `language-families.ts` and `markov-naming.ts` into canonical `src/lib/onoma/`.

---

## 1. Audit Findings & Targets

### Target 1: Dead Pre-Factbook Country Economy Subsystem (`src/app/countries/_components/economy/`) — ~7,500 Lines Dead
- **Analysis**: When country profiles transitioned to WikiOS-powered Factbook routes (`/countries/[slug]/factbook`), the entire old tabbed economy system was superseded.
- **Dead files (0 callers in codebase)**:
  - `ComparativeAnalysis.tsx` (36KB, ~800L)
  - `CoreEconomicIndicators.tsx` (12KB, ~350L)
  - `CountryEconomicDataSection.tsx` (15KB, ~450L)
  - `Demographics.tsx` (50KB, ~1,200L)
  - `EconomicDataDisplay.tsx` (26KB, ~650L)
  - `EconomicSummaryWidget.tsx` (14KB, ~350L)
  - `FiscalSystemComponent.tsx` (66KB, ~1,500L)
  - `GovernmentSpending.tsx` (32KB, ~750L)
  - `HistoricalEconomicTracker.tsx` (8KB, ~220L)
  - `IncomeWealthDistribution.tsx` (44KB, ~1,000L)
  - `LaborEmployment.tsx` (44KB, ~1,050L)
  - `utils.ts` (6KB, ~195L)
- **Active file**: `EconomicModelingEngine.tsx` (used in `/countries/[slug]/modeling/page.tsx`).
- **Action**:
  - Migrate `EconomicModelingEngine.tsx` to import standard formatters directly from `~/lib/utils`.
  - Inline 7-line `calculateBudgetHealth` directly into `src/hooks/useFiscalData.ts`.
  - Delete the 11 dead economy component files and `utils.ts`.

### Target 2: Dead Country Infobox Monolith (`src/app/countries/_components/CountryInfobox.tsx`) — ~900 Lines Dead
- **Analysis**: `CountryInfobox.tsx` (34KB, 900+ lines) is completely unreferenced by any page or component in the codebase (WikiOS Factbook and Dossier render via `FactbookSidebar` and `CountryHeader`).
- **Action**: Delete `src/app/countries/_components/CountryInfobox.tsx` and remove from `src/app/countries/_components/index.ts`.

### Target 3: Flag Hook Deduplication (`src/hooks/`) — ~350 Lines
- **Analysis**: `useSimpleFlag.ts` (135L) is a redundant clone of `useUnifiedFlags.ts` used in only 2 files (`MetricCardGrid.tsx`, `achievements/page.tsx`). `useCountryFlagRouteAware.ts` contains unused `useCountryFlagsRouteAware` (0 callers).
- **Action**:
  - Migrate `MetricCardGrid.tsx` and `achievements/page.tsx` to use canonical `useFlag` from `~/hooks/useUnifiedFlags`.
  - Delete `src/hooks/useSimpleFlag.ts`.
  - Prune unused bulk hook from `src/hooks/useCountryFlagRouteAware.ts`.

### Target 4: RNG Deduplication (`src/lib/worldgen/rng.ts`)
- **Analysis**: `src/lib/worldgen/rng.ts` is an exact duplicate subset of `src/lib/worldgen/v2/helpers/rng.ts`.
- **Action**: Re-export from `src/lib/worldgen/v2/helpers/rng.ts` to maintain single source of truth.

### Target 5: Economy Builder Type Monolith (`src/types/economy-builder.ts`) — ~600 Lines
- **Analysis**: At 1,053 lines, `economy-builder.ts` is the largest file in `arch-baseline.json`. It contains verbose repetitive declarations and massive commented copy-paste blocks.
- **Action**: Streamline using mapped types and concise documentation, shrinking from 1,053L to $\le 450\text{L}$, and remove from `arch-baseline.json`.

---

## 2. Verification Plan

1. Sub-project sequential typechecks:
   - `bun run typecheck:db`
   - `bun run typecheck:trpc`
   - `bun run typecheck:server`
   - `bun run typecheck:ui`
2. Arch check: `bun run scripts/audit/audit-arch.ts`
3. Verify `/countries/[slug]/modeling` page renders without regressions.
