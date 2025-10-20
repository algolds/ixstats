# MyCountry Command Suite

**Last updated:** October 2025

The MyCountry route (`/mycountry`) provides the executive dashboard for nation owners. It combines intelligence, defense, economy, compliance, and analytics modules into a single experience.

## Layout
| File | Purpose |
| --- | --- |
| `page.tsx` | Entry point rendering `EnhancedMyCountryContent` once the user is authenticated |
| `components/` | Shared UI shells (tab system, intelligence content, compliance modal, quick actions) |
| `intelligence/` | Live feeds, diplomatic operations hub, analytics widgets |
| `defense/` | Strategic defense initiative panels and readiness summaries |
| `hooks/` | Domain hooks (`useMyCountryCompliance`, etc.) for data orchestration |
| `services/` | Server helpers and adapters supporting MyCountry-specific data workflows |
| `utils/` | Data transformers, formatting helpers, validation routines |
| `types/` | TypeScript definitions for intelligence + compliance payloads |
| `editor/` | Post-creation editing flows linked to builder data

## Data Sources
- Country metrics: `api.countries.getByIdWithEconomicData`, `api.countries.getActivityRingsData`
- Intelligence: `api.intelligence.getExecutiveDashboard`, `api.diplomaticIntelligence.getIntelligenceBriefing`, `api.unifiedIntelligence.getCommandView`
- Compliance & Alerts: `api.mycountry.getComplianceSummary`, `api.notifications.getCountryAlerts`
- Defense: `api.sdi.getModules`, `api.security.getThreatStatus`

## Implementation Notes
- Tab configuration lives in `MyCountryTabSystem.tsx`
- `MyCountryComplianceModal.tsx` centralises outstanding actions, drawing from compliance + notifications routers
- Live feeds subscribe to Socket.IO channels when available (production runtime)

## Documentation
- Keep `docs/systems/mycountry.md` and `/help/mycountry/*` synced with new functionality
- Update this README when adding tabs, hooks, or services

Use this file as the quick reference when extending the MyCountry experience.
