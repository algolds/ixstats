# Economy System

**Last updated:** October 2025

The economy pillar models GDP, income, labor, trade, projections, and economic tiers. It is consumed across MyCountry, dashboard cards, builder flows, and analytics widgets.

## UI Components
- `src/components/economy` – Core charts, indicators, growth breakdowns
- `src/app/countries/_components/economy` – Country detail views, modeling tools, comparison modals
- `src/components/analytics/TrendRiskAnalytics.tsx` – Multi-metric risk assessment visualisations
- Modals for deep dives (`src/components/modals/*Modal.tsx`) reuse economic queries

## Routers & Procedures
- `economics.ts` – Country indicators (`getCountryIndicators`), projections, historical series
- `enhanced-economics.ts` – Aggregated dashboards, tier breakdowns, comparative analytics
- `atomicEconomic.ts` – Atomic economic component metadata and calculators
- `taxSystem.ts`, `atomicTax.ts` – Tax structures linked to fiscal calculations
- Cross-domain usage in `countries.ts` (`getByIdWithEconomicData`, `getHistoricalData`, `getForecast`)

## Calculations & Helpers
- `src/lib/chart-utils.ts` – Currency/population formatting helpers
- `src/lib/economy-calculations.ts` (and related utilities) – Growth curves, tier thresholds, resilience indices
- Scripts: `npm run test:economics`, `scripts/audit/verify-economic-calculations.ts`

## Data Models
- Prisma tables for `EconomicHistory`, `EconomicProjection`, `EconomicIndicator`, `LaborMetric`, `TradeBalance`, `TaxPolicy`
- Historical data extends back to Jan 2028 via seed scripts

## Integration Points
- Builder flows populate baseline GDP, growth, and tier settings
- Achievements and leaderboards depend on economic metrics for ranking
- Compliance checks monitor deficit/surplus positions, resilience scores, and trend direction

## Documentation & Help
- Synchronise updates with `/help/economy/*`
- Provide narrative explanations for new indicators in the help center and link them from UI tooltips

When adding new metrics, ensure they are computed once (either server-side or via scheduled jobs) and cached appropriately. Update the routers, Prisma schema, tests, and this guide together.
