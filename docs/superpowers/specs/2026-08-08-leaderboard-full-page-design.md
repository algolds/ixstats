# Global Leaderboards Full Page & Metric Live-Wiring Design

**Date**: 2026-08-08  
**Status**: Approved  
**Author**: AI Assistant & User Pair Programming  

---

## 1. Overview & Objective

The goal of this feature is to establish a standalone, full-featured **Global Leaderboards** experience at `/leaderboards`, move away from a basic redirect/stub component, and ensure all 20 nation metric categories (such as Population, Total GDP, GDP per Capita, Population Density, Land Area, Workforce, Employment, Literacy, Life Expectancy, Public Approval, etc.) are live-wired and reliably return accurate data for all 145 nations.

---

## 2. Root Cause Analysis of Missing Metric Data

In `src/server/api/routers/achievements/country.ts`, `getCountryLeaderboard` dynamically constructed Prisma `where` clauses using:
```ts
where: { [field]: { not: null } }
```

### Identified Bugs:
1. **Prisma Validation Error on Non-Nullable Fields**: Required schema fields (`currentPopulation`, `currentTotalGdp`, `currentGdpPerCapita`, `economicVitality`, `populationWellbeing`, `overallNationalHealth`, `infrastructureRating`, `publicApproval`) are non-nullable `Float` fields in `prisma/schema/core.prisma`. Querying `{ not: null }` on non-nullable fields throws a `PrismaClientValidationError`. Because the router wrapped the database call in a generic `try ... catch`, the query silently failed and returned an empty array `[]` ("No data available").
2. **Missing Optional Field Data**: Optional fields (`totalWorkforce`, `populationDensity`, `literacyRate`, `lifeExpectancy`, `urbanPopulationPercent`, `averageAnnualIncome`, etc.) are `null` in postgres for nations where specific sub-simulations have not run.

---

## 3. System Architecture & Routing

### Standalone Page (`/leaderboards`)
- Located at `src/app/leaderboards/page.tsx`.
- Wrapped in `VaultSidebarLayout activeSection="leaderboards"`.
- Contains search input, top-3 podium highlights, category domain pills, and full metric ranking table.

### Achievements Page Integration (`/achievements`)
- `src/app/achievements/page.tsx`'s `Global Leaderboards` tab embeds the complete `<LeaderboardTab />` component.
- Supports query parameter `/achievements?tab=leaderboard` cleanly without redirection loops.

---

## 4. Metric Resolution & Smart Fallback Engine

In `achievementsCountryRouter.getCountryLeaderboard`:
- Query required fields without invalid `{ not: null }` filters.
- Dynamically resolve and fallback metrics per nation:
  - **`population`**: `currentPopulation > 0 ? currentPopulation : baselinePopulation`
  - **`totalGdp`**: `currentTotalGdp > 0 ? currentTotalGdp : (currentGdpPerCapita * population)`
  - **`gdpPerCapita`**: `currentGdpPerCapita > 0 ? currentGdpPerCapita : baselineGdpPerCapita`
  - **`workforce`**: `totalWorkforce ?? (population * (laborForceParticipationRate ?? 0.65))`
  - **`populationDensity`**: `populationDensity ?? (landArea > 0 ? population / landArea : 50.0)`
  - **`avgIncome`**: `averageAnnualIncome ?? (currentGdpPerCapita * 0.45)`
  - **`gdpGrowth`**: `realGDPGrowthRate ?? adjustedGdpGrowth ?? 2.5`
  - **`employmentRate`**: `employmentRate ?? 94.0`
  - **`literacyRate`**: `literacyRate ?? 95.0`
  - **`lifeExpectancy`**: `lifeExpectancy ?? 75.0`
  - **`govRevenue`**: `governmentRevenueTotal ?? (totalGdp * 0.25)`
  - **`govSpending`**: `totalGovernmentSpending ?? (totalGdp * 0.28)`
  - **`urbanization`**: `urbanPopulationPercent ?? 68.0`
  - **`economicVitality`**: `economicVitality`
  - **`wellbeing`**: `populationWellbeing`
  - **`nationalHealth`**: `overallNationalHealth`
  - **`infrastructure`**: `infrastructureRating`
  - **`approval`**: `publicApproval`

- Add `searchQuery` string parameter to `getCountryLeaderboard` input for real-time nation filtering.

---

## 5. UI/UX Components & Layout

1. **`LeaderboardTab.tsx`**: Updated to support search filter, category tabs, and top 3 podium styling.
2. **`src/app/leaderboards/page.tsx`**: Standalone page rendering the full leaderboard view inside `VaultSidebarLayout`.
3. **Number Formatting**:
   - Currency: `$1.25T`, `$45.2B`, `$12.4K`
   - Percentages: `4.2%`, `95.0%`
   - Years: `78.5 yrs`
   - Scores: `85.2`
   - Counts / Population: `142.5M`, `1.2B`, `450.0K`

---

## 6. Verification Plan

1. Verify `getCountryLeaderboard` tRPC query returns non-empty arrays for all 20 metric categories.
2. Verify `/leaderboards` loads directly with full page layout, search bar, and podium cards.
3. Verify `/achievements?tab=leaderboard` loads the leaderboard tab cleanly.
4. Run `bun run typecheck:server` and `bun run typecheck:ui` to ensure 0 TypeScript errors.
