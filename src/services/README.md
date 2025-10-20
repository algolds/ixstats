# Services (`src/services`)

**Last updated:** October 2025

Client-side services live in this folder. They provide richer orchestration than simple hooks while remaining UI-facing (no direct database access).

## Current Services
| File | Purpose |
| --- | --- |
| `NotificationOrchestrator.ts` | Entry point for composing, throttling, and delivering notifications client-side |
| `NotificationGrouping.ts` / `NotificationCategorization.ts` | Grouping logic by priority, channel, or domain |
| `NotificationDeliveryOptimization.ts` / `DeliveryHandlers.ts` | Delivery heuristics and integrations (toast, compliance modal, feed) |
| `GlobalNotificationStore.ts` | Singleton store shared across components |
| `GlobalNotificationBridge.ts` | Bridges server push events (WebSocket) into the store |
| `IntelligenceNotificationPipeline.ts` | Tailors alerts for intelligence dashboards |
| `DiplomaticNotificationService.ts` | Specialised delivery for diplomatic missions/relations |
| `ContextIntelligenceEngine.ts` | Provides context-aware messaging for executive surfaces |
| `PolicyEffectService.ts`, `AtomicEffectivenessService.ts` | Client helpers for atomic / policy impact summaries |
| `EnhancedNotificationPriority.ts` | Priority scoring helpers used by the orchestrator |

## Usage Guidelines
- Services should remain side-effect-light; fetch data via tRPC hooks rather than direct HTTP calls
- Export singleton instances where state must persist across components (see `GlobalNotificationStore`)
- Document significant behaviour changes in `docs/reference/events.md` and relevant system docs
- Add Jest coverage for complex scheduling or prioritisation logic under `src/services/__tests__`

Keep this README updated as new services land in the folder.
