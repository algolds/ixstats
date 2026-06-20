# Country Economy Components

**Last updated:** June 2026

This folder holds the economy UI rendered on country profile pages — the tabbed economic data views, modeling tools, and comparison/summary widgets that visualize a country's GDP, labor, fiscal, income, spending, and demographic data. The main orchestrator (`EconomicDataDisplay`) fetches a country's economic profile via tRPC and renders the section components below as tabs.

## Components
| Component | Purpose |
| --- | --- |
| `EconomicDataDisplay.tsx` | Main orchestrator; fetches via `api.countries.getByIdWithEconomicData`, renders tabbed sections (core, labor, fiscal, income, government, demographics). Supports `mode`, `isEditable`, `showTabs`, `defaultTab` props |
| `CountryEconomicDataSection.tsx` | Page-level wrapper that mounts the economy section on country detail routes; shares the same data query and edit mutation |
| `CoreEconomicIndicators.tsx` | GDP, population, GDP per capita, inflation, and growth metrics |
| `LaborEmployment.tsx` | Employment, labor-force participation, wages, and workforce size |
| `FiscalSystemComponent.tsx` | Revenue, spending, debt, and budget balance |
| `IncomeWealthDistribution.tsx` | Income inequality, poverty, and wealth distribution |
| `GovernmentSpending.tsx` | Spending allocation by sector with per-capita figures |
| `Demographics.tsx` | Population distribution, urbanisation, literacy, life expectancy |
| `HistoricalEconomicTracker.tsx` | Historical time-series via the `useHistoricalEconomicData` hook |
| `ComparativeAnalysis.tsx` | Side-by-side comparison against peer countries |
| `EconomicModelingEngine.tsx` | Parameter/sector/policy scenarios and forward projections (configurable base year + projection horizon) |
| `EconomicSummaryWidget.tsx` | Compact economy summary for cards/dashboards |

Helper modules:
- `utils.ts` — `getEconomicTier`, `getEconomicHealthScore`, `calculateBudgetHealth`, `validateEconomicData`. (The `formatCurrency`/`formatPopulation`/`formatPercentage` wrappers here are deprecated — use `~/lib/format-utils` directly.)
- `index.ts` — barrel export for all components above plus `utils`.

## Key features
- **Indicators**: core, labor, fiscal, income, government-spending, and demographic metric panels.
- **Charts**: Recharts visualisations in Demographics, FiscalSystem, GovernmentSpending, IncomeWealthDistribution, LaborEmployment, ComparativeAnalysis, and EconomicModelingEngine.
- **Projections**: `EconomicModelingEngine` runs parameter/sector/policy scenarios and forecasts forward from a configurable base year.
- **Health scoring**: `getEconomicHealthScore` and `getEconomicTier` in `utils.ts` derive a tier (Developing → Advanced) and a 0–100 health score from GDP/capita, unemployment, fiscal, debt, and inflation.
- **Editing**: when `isEditable` is set, edits are persisted with `api.economics.updateEconomicProfile`.

## Data sources (verified)
| Query / mutation | Used by |
| --- | --- |
| `api.countries.getByIdWithEconomicData` | `EconomicDataDisplay`, `CountryEconomicDataSection` (primary data load) |
| `api.economics.updateEconomicProfile` | `EconomicDataDisplay`, `CountryEconomicDataSection` (edit mutation) |

All three routers (`countries`, `economics`, `enhancedEconomics`) are registered in `src/server/api/root.ts`. `HistoricalEconomicTracker` sources its series through the `useHistoricalEconomicData` hook rather than a direct `api.*` call here.

## Relation to the builder & calculations
The economy builder flows populate the baseline GDP, growth, and tier inputs that these read-only views display; see `docs/systems/builder.md`. Engine vs. builder math differences are documented in `docs/systems/calculations.md`. For the full system overview, routers, and Prisma models, see `docs/systems/economy.md`.

---
Keep this README aligned with the component exports in `index.ts` and the `api.*` calls actually present in this directory.

> **Corrected June 2026:** the prior README listed supplementary queries (`api.economics.getCountryIndicators`, `api.economics.getProjections`, `api.enhancedEconomics.getEconomicDashboard`) as data dependencies — none are referenced by components in this directory, so they were removed. `CountryEconomicDataSection` (previously undocumented) was added.
