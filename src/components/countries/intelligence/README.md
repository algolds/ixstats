# Country Intelligence Components

**Last updated:** October 2025

These components power country-level intelligence dashboards (MyCountry, country detail pages, admin views).

## Contents
| Component | Description |
| --- | --- |
| `VitalityMetricsPanel.tsx` | Renders vitality rings + trend indicators |
| `CountryMetricsGrid.tsx` | Categorised grid of intelligence metrics |
| `IntelligenceSummary.tsx` | High-level summary cards and alert callouts |
| `WikiIntegrationPanel.tsx` | Displays wiki content, coat of arms, and overview editing |
| `StatusIndicators.tsx` | Classification badges, trend arrows, stability indicators |
| `charts/IntelligenceCharts.tsx` | Collection of line/bar/area/radar charts tuned for intelligence data |
| `charts/chartConfig.ts` | Reusable chart configuration (colors, gradients) |
| `types.ts`, `constants.ts`, `utils.ts` | Shared types, thresholds, and helpers |

## Data Flow
- Components expect data produced by hooks/services such as `useMyCountryIntelligence` (see `src/app/mycountry/intelligence/_hooks`) and routers `diplomatic-intelligence.ts`, `intelligence.ts`
- Ensure new metrics are exposed via types in `types.ts` and passed through `utils.ts` transforms before reaching UI components

## Usage
Import the pieces you need from the barrel export:
```tsx
import { VitalityMetricsPanel, IntelligenceSummary } from "~/components/countries/intelligence";
```

Keep `/docs/systems/intelligence.md` and `/help/intelligence/*` up to date when introducing new metrics or panels.
