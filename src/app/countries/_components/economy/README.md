# Country Economic Modeling Engine

**Last updated:** August 2026

This directory contains the `EconomicModelingEngine` component rendered on the `/countries/[slug]/modeling` route for macroeconomic projections and scenario simulation.

## Component

| Component | Purpose |
| --- | --- |
| `EconomicModelingEngine.tsx` | Interactive forecasting engine with parameter sliders (GDP growth, inflation, unemployment, interest rate, population growth), sectoral breakdown editor, and policy scenario simulator with Recharts time-series projections |

## Integration

- **Route:** Rendered on `/countries/[slug]/modeling`
- **Data Query:** `api.countries.getByIdWithEconomicData`
- **Business Logic Hook:** `useEconomicModel` (`src/hooks/useEconomicModel.ts`)
- **Shared Tab Equivalents:** General economic overview panels are located in `src/components/mycountry/shared/tabs/EconomyTab.tsx`.
