# Defense System

**Last updated:** June 2026
**Hierarchy:** Part of MyCountry core system — grouped under Military & Security.

Defense capabilities model national readiness, crisis response, military operations, and strategic defense initiative (SDI) modules.

## UI Surfaces
- `src/app/mycountry/defense/page.tsx` – Core defense page (readiness scores, crisis response panels)
- `src/components/defense` – Modular widgets for threat levels, asset readiness, doctrine sliders
- `src/components/defense/OperationsPanel.tsx` – Operations management panel
- `src/components/defense/operations/` – ActiveOperations, DeploymentWizard, PvPConflictPanel
- Compliance overlays in `MyCountryComplianceModal.tsx` highlight unresolved defense tasks

## Routers & Data
- SDI router (`sdi.ts`) was dissolved; its functionality (module configs, readiness, upgrade paths) was migrated into the intelligence routers (`intelligence.ts`, `security.ts`)
- `security.ts` – National security posture, threat detection hooks
- `militaryEquipment.ts` – Equipment catalog management
- `smallArmsEquipment.ts` – Infantry weapons and small arms
- `crisis-events.ts` – Dynamic crisis event management
- `intelligence.ts` – Security metrics integrated with broader intelligence dashboards
- `notifications.ts` – Alerts for defense incidents and required actions

## Data Models
- `DefenseModule`, `DefenseReadiness`, `DefenseIncident`, `CrisisScenario`
- Linked to countries via `countryId` for quick aggregation in dashboards

## Workflow Summary
1. Configure modules and posture via intelligence router mutations
2. Monitor readiness and incidents in MyCountry defense tab
3. When incidents occur, alerts route through notifications and compliance monitors
4. Crisis playbooks (stored under `src/app/mycountry/defense`) provide decision support UI

## Future Enhancements
- Expand WebSocket updates to push live incident data in development mode
- Add regression tests for defense readiness calculators and scores
- Integrate defense metrics into achievements and leaderboards for cross-domain tracking

Ensure defense-related changes are reflected in `/help/defense/*` and link to relevant compliance tasks.
