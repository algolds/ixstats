# Intelligence System

**Last updated:** October 2025

The intelligence stack aggregates diplomatic, economic, and security signals into executive-ready briefings.

## Frontend Surfaces
- `src/components/mycountry/IntelligenceTabSystem.tsx` – Tab-level orchestration
- `src/app/mycountry/intelligence/_components/IntelligenceFeed.tsx` – Core feed component combining hot issues, opportunities, and risk mitigation
- `src/app/mycountry/intelligence/_components/DiplomaticOperationsHub.tsx` – Mission tracking, embassy posture, and regional insights
- `src/components/diplomatic/LiveDiplomaticFeed.tsx` – WebSocket-enabled diplomatic activity stream

## Data Providers
- `diplomatic-intelligence.ts` – Executive briefings (`getIntelligenceBriefing`)
- `intelligence.ts` – National vitality, alerts, and forecasts (`getExecutiveDashboard`, `getAlerts`)
- `unified-intelligence.ts` – Consolidated SDI/ECI intelligence feeds
- `notifications.ts` – Push alerts and acknowledgement workflows

## Key Outputs
| Feed | Source Procedure | Notes |
| --- | --- | --- |
| Daily Briefing | `api.diplomaticIntelligence.getIntelligenceBriefing` | Classification-aware, returns relations, key developments, recommended actions |
| Vitality Dashboard | `api.intelligence.getExecutiveDashboard` | Metrics for economic, diplomatic, population, security health |
| Alert Stream | `api.intelligence.getAlerts`, `api.notifications.getCountryAlerts` | Used by compliance modal and intelligence feed |
| Mission Tracker | `api.diplomatic.getActiveMissions`, `api.diplomatic.getEmbassies` | Supports operations hub and quick actions |

## Realtime Behaviour
- Production WebSocket server (`src/lib/websocket-server.ts`) broadcasts diplomatic events, crisis updates, and notifications
- Client widgets subscribe via Socket.IO in `LiveDiplomaticFeed.tsx` and related components

## Calculations & Utilities
- Time context derived from `IxTime` (`~/lib/ixtime`) to align simulation timelines
- Synergy/impact scoring reused from atomic systems via helpers in `src/components/atomic`
- Formatting utilities located in `src/lib/formatters` and `src/lib/chart-utils`

## Implementation Notes
- Keep request payloads lightweight; sensitive details are filtered based on `classification` input
- When adding new intelligence categories, update both the router schema and front-end tab registry
- Align new intelligence articles with `/help/intelligence/*` so runtime guidance matches repo docs

Add unit tests in `src/server/api/routers/__tests__` when extending routers to protect calculation and classification logic.
