# Country Intelligence Components (removed)

**Last updated:** September 2026

This directory is empty. The components it used to describe were removed as dead code during the MyCountry v2 → Command Surface consolidation and the dead-code sweeps (`4663b564d`, `312b73018`): `VitalityMetricsPanel`, `IntelligenceSummary`, `WikiIntegrationPanel`, `StatusIndicators`, `charts/IntelligenceCharts`, and their `types`/`constants`/`utils`. The `useMyCountryIntelligence` hook and the `diplomatic-intelligence` router are gone as well.

Where the equivalents live now:

| Need | Current code |
| --- | --- |
| Vitality rings | `src/components/mycountry/shared/primitives/VitalityRings.tsx` |
| Metric grid | `src/components/mycountry/shared/primitives/CountryMetricsGrid.tsx` |
| Classification badges (dossier) | `src/components/mycountry/dossier/dossier/constants.ts`, `WikiSectionCard.tsx` |
| Intel / recon / fog | See [`docs/systems/intelligence.md`](../../../../../docs/systems/intelligence.md) |

This README can be deleted together with the directory.
