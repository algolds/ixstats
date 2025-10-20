# Events & Realtime Channels

**Last updated:** October 2025

This reference summarises realtime channels, notification payloads, and scheduled jobs used across IxStats.

## WebSocket Channels
- **Endpoint**: `/ws/intelligence`
- **Server**: `src/lib/websocket-server.ts` (Socket.IO-compatible WebSocket server spun up by `server.mjs`)
- **Subscriptions**: Clients auto-subscribe to `all` plus type-specific channels (`economic`, `diplomatic`, `government`, `crisis`, `achievement`)
- **Payload Format**:
  ```json
  {
    "type": "intelligence_update",
    "category": "economic",
    "countryId": "abc123",
    "data": {...},
    "timestamp": "2025-10-18T17:12:34.000Z",
    "priority": "medium"
  }
  ```
- **Health Checks**: Server pings every 60s; clients respond with `pong`
- **Graceful Shutdown**: `RealTimeIntelligenceServer.shutdown()` invoked during process exit

## Notification Pipeline
- `notifications.ts` router handles alert creation, acknowledgement, and delivery rules
- Alert categories: compliance, diplomatic, defense, economic, social
- Webhooks (Discord) triggered via `~/lib/error-logger` when enabled (`DISCORD_WEBHOOK_ENABLED`)
- In-app notifications appear in compliance modal, intelligence feeds, and activity streams

## Scheduled & Batch Jobs
Scripts under `scripts/` (execute manually or via cron):
- `scripts/audit/audit-trpc-wiring.ts` – Verifies endpoint wiring
- `scripts/audit/run-all-tests.ts` – Aggregated regression runner
- `scripts/audit/test-all-crud-operations.ts` – Exercises CRUD endpoints
- `scripts/audit/verify-economic-calculations.ts` – Validates economic formulas
- `scripts/setup/backup-db.ts` / `restore-db.ts` – Database maintenance

## Event Producers
- **Economic Updates** – `RealTimeIntelligenceServer.pushEconomicUpdate`
- **Diplomatic Updates** – `pushDiplomaticUpdate`
- **Crisis Alerts** – `pushCrisisAlert`
- **Achievements** – `achievements.unlock` mutation triggers notifications & optional realtime events

## Consumers
- Intelligence dashboard (`LiveDiplomaticFeed.tsx`, `IntelligenceFeed.tsx`)
- Compliance modal (`MyCountryComplianceModal.tsx`)
- Social feeds (`LiveEventsFeed.tsx`)
- External monitoring channels (Discord webhooks)

Update this document when new channels, event types, or automation scripts are introduced. Keep payload examples and channel lists in sync with the server implementation.
