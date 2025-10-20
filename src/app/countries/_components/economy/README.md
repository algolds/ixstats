# Country Economy Components

**Last updated:** October 2025

This folder contains reusable components that render economic views for existing countries (profile pages, dashboards, analytics tabs).

## Components
| Component | Description |
| --- | --- |
| `EconomicDataDisplay.tsx` | Main orchestrator; fetches data via `api.countries.getByIdWithEconomicData` and renders tabbed content |
| `CoreEconomicIndicators.tsx` | GDP, population, inflation, and growth metrics |
| `LaborEmployment.tsx` | Employment, participation, wages, and workforce size |
| `FiscalSystemComponent.tsx` | Revenue, spending, debt, and budget balance |
| `IncomeWealthDistribution.tsx` | Inequality, poverty, social mobility |
| `GovernmentSpending.tsx` | Allocation by sector with per-capita calculations |
| `Demographics.tsx` | Population distribution, urbanisation, literacy, life expectancy |
| `HistoricalEconomicTracker.tsx` | Time-series charts and change analysis |
| `ComparativeAnalysis.tsx` | Side-by-side comparisons against peers |
| `EconomicModelingEngine.tsx` | Scenario simulations and projections |
| `EconomicSummaryWidget.tsx` | Compact summary for cards/dashboards |

Helper modules:
- `utils.ts` – Aggregation helpers and formatting wrappers
- `index.ts` – Barrel exports for consumer modules

## Data Dependencies
- Primary query: `api.countries.getByIdWithEconomicData`
- Supplementary data: `api.economics.getCountryIndicators`, `api.economics.getProjections`, `api.enhancedEconomics.getEconomicDashboard`

## Usage Guidance
- Import `EconomicDataDisplay` in country detail routes or dashboards
- Use `mode`/`isEditable` props to toggle editing capabilities for admins/DMs
- When adding new metrics, update `docs/systems/economy.md`, `/help/economy/*`, and ensure Prisma models + routers expose the data

Keep this README aligned with component signatures and data contracts.
