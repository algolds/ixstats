# Defense System

**Last updated:** October 2025

Defense capabilities model national readiness, crisis response, and strategic defense initiative (SDI) modules.

## UI Surfaces
- `src/app/mycountry/defense` – Core defense dashboards, readiness scores, crisis response panels
- `src/components/defense` – Modular widgets for threat levels, asset readiness, doctrine sliders
- Compliance overlays in `MyCountryComplianceModal.tsx` highlight unresolved defense tasks

## Routers & Data
- `sdi.ts` – Strategic defense initiative (module configs, readiness, upgrade paths)
- `security.ts` – National security posture, threat detection hooks
- `intelligence.ts` – Security metrics integrated with broader intelligence dashboards
- `notifications.ts` – Alerts for defense incidents and required actions

## Data Models
- `DefenseModule`, `DefenseReadiness`, `DefenseIncident`, `CrisisScenario`
- Linked to countries via `countryId` for quick aggregation in dashboards

## Workflow Summary
1. Configure modules and posture via SDI mutations
2. Monitor readiness and incidents in MyCountry defense tab
3. When incidents occur, alerts route through notifications and compliance monitors
4. Crisis playbooks (stored under `src/app/mycountry/defense`) provide decision support UI

## Future Enhancements
- Expand WebSocket updates to push live incident data in development mode
- Add regression tests for SDI calculators and readiness scores
- Integrate defense metrics into achievements and leaderboards for cross-domain tracking

Ensure defense-related changes are reflected in `/help/defense/*` and link to relevant compliance tasks.
