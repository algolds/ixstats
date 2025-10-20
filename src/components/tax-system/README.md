# Tax System Components

**Last updated:** October 2025

This folder contains UI components for visualising and managing tax system data inside IxStats. They are consumed by MyCountry, builder/editor flows, and analytics dashboards.

## Files
| Component | Description |
| --- | --- |
| `TaxBuilder.tsx` | UI flow for configuring tax systems (categories, rates, compliance settings) |
| `AtomicTaxEffectivenessPanel.tsx` | Displays effectiveness scores and synergies/conflicts for selected atomic tax components |
| `TaxEconomySyncDisplay.tsx` | Shows tax → economy integration details (revenue, GDP impact, labour feedback) |
| `TaxGovernmentSyncDisplay.tsx` | Highlights budget integration and departmental allocations |
| `UnifiedTaxEffectivenessDisplay.tsx` | Aggregated summary combining atomic effects + macro indicators |
| `atoms/` | Atomic tax component selector and supporting widgets |

## Data Sources
- `api.atomicTax.getComponents`, `api.atomicTax.calculateEffects`
- `api.taxSystem.getCurrentConfiguration`, `api.taxSystem.saveConfiguration`
- Economics integration data via `api.economics.getCountryIndicators`

## Usage Notes
- `TaxBuilder` expects props for current configuration, change handlers, and save callbacks; keep types aligned with the router inputs
- When adding new atomic components, update both the backend enums and the selector definitions under `atoms/`
- Update `/docs/systems/economy.md`, `/docs/systems/builder.md`, and `/docs/systems/achievements.md` when tax changes affect related systems

Keep this README in sync as new panels or data integrations are introduced.
