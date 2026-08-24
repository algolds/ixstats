# 🏛️ MyCountry Intelligence & Recon Domain (Preview)

**Parent App Suite:** MyCountry Suite (`MYCOUNTRY_VERSION = 5`)  
**Engine:** Statecraft Simulation Engine (`MYCOUNTRY_ENGINE_VERSION = 4`)  
**Primary Action:** `SURVEY` | **Domain Accent:** Dark Indigo / Amber Gold  
**Route:** `/mycountry/intelligence` | **Status:** 🧪 Developer Preview (Not in Active Public Navigation)  

> **⚠️ Status Note:** The Intelligence & Recon module is currently under development in developer preview and is not part of the active public navigation suite.

The intelligence stack aggregates diplomatic, economic, and national security signals into executive briefings, predictive forecasts, recon research operations, and real-time alert feeds.

---

## Architecture & Surface Integration

### Frontend Surfaces
- `src/components/mycountry/EnhancedIntelligenceContent.tsx` – Intelligence orchestrator and tab system
- `src/app/mycountry/intelligence/_components/IntelligenceFeed.tsx` – Core intelligence feed combining urgent hot issues, geopolitical opportunities, and risk mitigation
- `src/app/mycountry/intelligence/_components/DiplomaticOperationsHub.tsx` – Mission tracking, embassy posture, and regional insights
- `src/components/mycountry/domains/diplomacy/LiveDiplomaticFeed.tsx` – WebSocket-enabled diplomatic and crisis activity stream

### Backend Routers
All endpoints are organized under the modularized API:
- `src/server/api/routers/intelligence/` (`index.ts`, `core.ts`, `alerts.ts`, `analytics.ts`) – National vitality dashboard, classified alerts, and threat forecasts
- `src/server/api/routers/diplomatic-intelligence/` – Executive intelligence briefings (`getIntelligenceBriefing`), bilateral threat assessments, and recommended policy counters
- `src/server/api/routers/notifications/` – Push alerts and compliance task acknowledgement workflows

---

## Key Intelligence Feeds

| Output Feed | Source Procedure | Description |
| :--- | :--- | :--- |
| **Executive Briefing** | `api.diplomaticIntelligence.getIntelligenceBriefing` | Classification-aware summary of diplomatic shifts, economic movements, and recommended actions |
| **Vitality Dashboard** | `api.intelligence.getExecutiveDashboard` | 4-domain composite vitality metrics (Economic, Diplomatic, Population, Governance) |
| **Alert Stream** | `api.intelligence.getAlerts`, `api.notifications.getCountryAlerts` | Security and compliance alerts highlighted across Command Surface rails |
| **Mission Tracker** | `api.diplomatic.getActiveMissions`, `api.diplomatic.getEmbassies` | Realtime status of active covert and overt foreign missions |

---

## Realtime & Caching Architecture

### Caching Performance (`src/lib/advanced-cache-system.ts`)
- **Intelligence Feed Caching**: Briefing queries leverage `globalCache` with a 2-minute TTL, resolving cache hits in **~2.2ms** (compared to ~1,200ms for full database aggregation).
- **Graceful Redis Fallback**: If Redis is offline in local development, the system seamlessly falls back to a thread-safe in-memory cache with zero disruption.
- **WebSocket Broadcast**: Production WebSocket server (`server.mjs`) broadcasts high-priority diplomatic events, security alerts, and crisis developments to connected clients.

---

## Data Models

Defined in `prisma/schema/intelligence.prisma` and `prisma/schema/core.prisma`:
- `IntelligenceBriefing`: Pre-written and dynamic executive briefings with classification level (`CONFIDENTIAL`, `SECRET`, `TOP_SECRET`)
- `IntelligenceItem`: Granular intel entries with category, severity, source, and expiration
- `VitalitySnapshot`: Historical time-series record of national vitality scores used for trend analysis

---

## Related Documentation

- [Diplomacy System](./diplomacy.md)
- [Defense & Security System](./defense.md)
- [MyCountry Command Suite](./mycountry.md)
- [API Reference: Intelligence Routers](../reference/api-complete.md#intelligence-router)
