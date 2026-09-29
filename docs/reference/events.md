# Events & Realtime Channels

**Last updated:** September 2026

This reference summarises realtime channels, notification payloads, and scheduled jobs used across IxStates (IxStats).

> The former `/ws/intelligence` channel and `RealTimeIntelligenceServer` (`pushEconomicUpdate`, `pushDiplomaticUpdate`, `pushCrisisAlert`) no longer exist. Realtime now runs over the two WebSocket servers and the one SSE stream below.

## WebSocket Channels

Both servers attach to a raw HTTP server's `upgrade` event. They are hosted by:
- **`ws-backend.mjs`** — standalone PM2 app `ixstats-ws` (port `WS_BACKEND_PORT`, default `3551`; `GET /healthz`). nginx proxies the WS paths to it, because the ixworld standalone build (`server.js`) has no Socket.IO server attached.
- **`server.mjs`** — the custom Next.js server; hosts ThinkPages WS in production only (disabled in dev) and Market WS always.

### ThinkPages — `/ws/thinkpages`
- **Server**: `src/lib/websocket/thinkpages-websocket-server.ts` (Socket.IO), bootstrapped by `src/server/websocket-server.ts`
- **Auth**: Clerk session token (`createSocketAuthMiddleware`, `src/lib/websocket/socket-auth.ts`); origin allow-list gates both polling and the websocket upgrade
- **Rooms**: `conversation:<id>` and `group:<id>` (pattern `^(conversation|group):[A-Za-z0-9_-]{1,64}$`); joining requires a membership check
- **Client → server**: `subscribe`, `unsubscribe`, `presence:update`, `typing:update`, `read:receipt`
- **Server → client**: `authenticated`, `subscribe:error` (`invalid_channel` | `forbidden`), `message:update`, `conversation:update`, `presence:update`, `typing:update`, `read:receipt`
- **Cross-process fan-out**: when the calling process does not host Socket.IO, routers publish to the Redis channel `ixstats:thinkpages:broadcast` (`src/server/thinkpages-broadcast-bridge.ts`); the hosting process subscribes and re-emits
- **Heartbeat**: Socket.IO `pingInterval` 25s, `pingTimeout` 60s
- **Payload Format** (`message:update`):
  ```json
  {
    "type": "message:update",
    "data": { "conversationId": "abc123", "messageId": "msg_1", "accountId": "acc_1" },
    "timestamp": 1760000000000,
    "channel": "conversation:abc123"
  }
  ```
- **Graceful Shutdown**: `SIGTERM`/`SIGINT` close the Redis subscriber and call `ThinkPagesWebSocketServer.shutdown()`

### Market — `/api/market-ws`
- **Server**: `src/lib/websocket/market-websocket-server.ts` (`ws`); client in `market-websocket-client.ts`
- **Server → client**: `connected`, `pong`, `bid`, `auction_complete`, `price_update`, `auction_created`

### Map updates (SSE) — `/api/sse/map-updates`
- **Route**: `src/app/api/sse/map-updates/route.ts` (Next.js route handler, `EventSource`), fed by `mapUpdateBus` (`src/lib/maps/map-update-bus.ts`)
- **Events**: `map_data_changed` after any successful geo mutation (city, subdivision, POI, story pin, map label, …); keep-alive every 15s

## Notification Pipeline
- `notifications` router (`src/server/api/routers/notifications/`) handles listing, read state, preferences, and event configuration
- Event catalog: `src/lib/notifications/events-registry.ts` (35 events) — categories: economic, governance, social, system, security, achievement, crisis, diplomatic, intelligence
- `notificationAPI` (`src/lib/notifications/api.ts`) is the server-side creation entry point
- Discord webhooks: `src/lib/discord/webhook.ts` and `src/lib/logging/error-logger.ts`, enabled by `DISCORD_WEBHOOK_ENABLED=true` (+ `DISCORD_WEBHOOK_URL`)
- In-app notifications appear in the notification centre, compliance modal, and activity streams

## Scheduled & Batch Jobs

`cron-runner.mjs` (PM2 app `ixstats-cron`, Bun) is the **only** scheduler; the web app, `server.mjs` and `ws-backend.mjs` schedule nothing. Jobs are defined in `src/server/cron/jobs.ts`; only those named in `CRON_ENABLED_JOBS` (comma list or `*`) run, each under a Postgres advisory lock (`src/lib/system/job-lock.ts`). Schedules with a `SystemConfig` override key are read once at startup.

| Job | Default schedule | Override key |
| --- | --- | --- |
| `auction-completion` | `* * * * *` | — |
| `passive-income` | `0 0 * * *` | `cronSchedule_passiveIncome` |
| `card-values` | `0 */6 * * *` | `cronSchedule_cardValue` |
| `lore-card-generation` | `0 2 * * *` | — |
| `lorewards-full-sync` | `0 6 * * *` | `cronSchedule_lorewardsScoring` |
| `lorewards-state-sync` | `*/10 * * * *` | — |
| `trade-expiry` | `*/5 * * * *` | — |
| `sports-season-advance` | `*/15 * * * *` | — |
| `scheduled-changes` | `*/10 * * * *` | — |
| `elections` | `*/10 * * * *` | — |
| `politics-drift` | `0 */6 * * *` | — |
| `diplomatic-drift` | `0 */6 * * *` | — |
| `policy-maintenance` | `0 */6 * * *` | — |
| `national-issues` | `*/30 * * * *` | — |
| `wiki-recentchanges` | `*/10 * * * *` | `cronSchedule_wikiRecentChanges` |

ixtwitter sync is not a cron job; it runs as the separate `ixstats-ixtwitter` PM2 process.

Manual scripts under `scripts/`:
- `scripts/audit/audit-trpc-wiring.ts` – Verifies endpoint wiring
- `scripts/audit/run-all-tests.ts` – Aggregated regression runner
- `scripts/audit/test-all-crud-operations.ts` – Exercises CRUD endpoints
- `scripts/audit/verify-economic-calculations.ts` – Validates economic formulas
- `scripts/setup/backup-db.ts` / `restore-db.ts` – Database maintenance (Postgres backups use `pg_dump`)

## Event Producers
- **ThinkShare messages** – `messages` router (`messaging.ts`, `conversations.ts`, `participants.ts`) → `getThinkPagesBroadcaster().broadcastMessage()`
- **Marketplace auctions** – `src/lib/economy/auction-service.ts` (card-market router and `auction-completion` job) → Market WS broadcasts
- **Achievements** – `achievements.unlock` mutation (awards 5 credits on first unlock); collector achievements resync via `syncMyCollectorAchievements`
- **Cron jobs** – economy, politics, diplomacy, national-issue and wiki jobs listed above

## Consumers
- Messaging (`useThinkPagesWebSocket` in `src/hooks/useThinkPagesWebSocket.ts`, used by `MessagesRouter.tsx`)
- Vault auctions (`useAuctionWebSocket` in `src/hooks/marketplace/`, used by `VaultAuctionsTab.tsx`)
- Compliance modal (`MyCountryComplianceModal.tsx`)
- External monitoring channels (Discord webhooks)

Update this document when new channels, event types, or automation scripts are introduced. Keep payload examples and channel lists in sync with the server implementation.
