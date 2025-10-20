# MyCountry Command Suite

**Last updated:** October 2025

The MyCountry experience gives nation owners a unified command environment. It lives primarily under `src/app/mycountry` with shared UI components in `src/components/mycountry`.

## Key Screens & Layout
- `src/app/mycountry/page.tsx` – Entry point that renders `EnhancedMyCountryContent`
- `EnhancedMyCountryContent.tsx` & `MyCountryTabSystem.tsx` – Tab shell for executive, intelligence, economy, labor, government, demographics, analytics, and compliance views
- `MyCountryComplianceModal.tsx` – Compliance briefing surface that calls the `useMyCountryCompliance` hook
- `src/app/mycountry/intelligence/_components` – Executive dashboards, diplomatic operations hub, live feeds
- `src/app/mycountry/defense` – Strategic defense initiative widgets and readiness summaries

## Data Sources
- **Country core** – `api.countries.getByIdWithEconomicData`, `api.countries.getActivityRingsData`
- **Intelligence** – `api.diplomaticIntelligence.getIntelligenceBriefing`, `api.intelligence.getExecutiveDashboard`
- **Compliance** – `api.mycountry.getComplianceSummary`, `api.notifications.getCountryAlerts`
- **Economics** – `api.economics.getCountryIndicators`, `api.economics.getProjections`

All queries originate from the generated `api` client (`src/trpc/react.tsx`). When adding new sections, expose data via an existing router or extend a domain router.

## Hooks & Utilities
- `useMyCountryCompliance.ts` – Fetches compliance checks, outstanding actions, and threshold breaches
- `useUnifiedFlags.ts` – Media and identity assets for display
- `src/app/mycountry/utils` – Data transformers for executive summaries, trend lines, and builder interoperability

## Actions & Mutations
- Quick actions orchestrated through `src/components/mycountry/QuickActionIntegration.tsx` use routers such as `quickactions.ts`, `policies.ts`, and `notifications.ts`
- Compliance tasks and acknowledgements leverage `api.notifications.acknowledge` and related mutation endpoints

## UI Guidelines
- Follow the glass hierarchy (parent shell, section cards, interactive controls) defined in `src/components/ui`
- Keep metrics grouped: vitality rings, economic indicators, labor stats, diplomatic status, defense readiness
- Each tab should link to its detailed help article (`docs/systems/*.md` and `/help`) for discoverability

## Future Enhancements
- Expand realtime updates (Socket.IO) into more widgets once the development WebSocket toggle is enabled
- Add test coverage for compliance hooks and tab orchestration
- Synchronize builder changes with MyCountry analytics to ensure new indicators appear automatically

Use this guide when contributing new analytics, tabs, or compliance tooling to MyCountry.
