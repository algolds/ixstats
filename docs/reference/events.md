# Events & Realtime Channels

**Last updated:** 2026-10-07

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
- **Cross-process fan-out**: bids and buyouts happen in the web process and completions in `ixstats-cron`, so every market event is published to the Redis channel `ixstats:market:broadcast` (`src/server/market-broadcast-bridge.ts`); each process that hosts a market socket subscribes and re-emits it. Without Redis the event goes only to the local socket, if the process has one

### Map updates (SSE) — `/api/sse/map-updates`
- **Route**: `src/app/api/sse/map-updates/route.ts` (Next.js route handler, `EventSource`), fed by `mapUpdateBus` (`src/lib/maps/map-update-bus.ts`)
- **Events**: `map_data_changed` after any successful geo mutation (city, subdivision, POI, story pin, map label, …); keep-alive every 15s

## Notification Pipeline
- `notifications` router (`src/server/api/routers/notifications/`) handles listing, read state, preferences, and event configuration
- Event catalog: `src/lib/notifications/events-registry.ts` (13 events in 6 categories: economic, diplomatic, governance, achievement, social, system)
- `notificationAPI` (`src/lib/notifications/api.ts`) is the server-side creation entry point
- Discord webhooks: `src/lib/discord/webhook.ts` and `src/lib/logging/error-logger.ts`, enabled by `DISCORD_WEBHOOK_ENABLED=true` (+ `DISCORD_WEBHOOK_URL`)
- In-app notifications appear in the notification centre, compliance modal, and activity streams

## Scheduled & Batch Jobs

`cron-runner.mjs` (PM2 app `ixstats-cron`, Bun) is the **only** scheduler; the web app, `server.mjs` and `ws-backend.mjs` schedule nothing. Jobs are defined in `src/server/cron/jobs.ts` (27 jobs, two of them WikiOS jobs not listed here); only those named in `CRON_ENABLED_JOBS` (comma list or `*`) run, each under a lease row in `job_leases` (`withJobLock`, `src/lib/system/job-lock.ts`) that expires after the job's timeout, so a crashed run never blocks the next. Every run is recorded as a `CronRun` row (success, skipped or failed) and a failure alerts the Discord webhook; see [monitoring.md](../operations/monitoring.md#scheduled-jobs). Schedules with a `SystemConfig` override key are read once at startup.

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
| `elections` | `*/10 * * * *` | — |
| `politics-drift` | `0 */6 * * *` | — |
| `diplomatic-drift` | `0 */6 * * *` | — |
| `policy-maintenance` | `0 */6 * * *` | — |
| `national-issues` | `*/30 * * * *` | — |
| `wiki-recentchanges` | `*/10 * * * *` | `cronSchedule_wikiRecentChanges` |
| `budget-year-rollover` | `41 * * * *` | — |
| `stat-progression` | `23 */6 * * *` | `cronSchedule_statProgression` |
| `thinkpages-trending` | `*/15 * * * *` | `cronSchedule_thinkpagesTrending` |
| `achievements-evaluate` | `41 * * * *` | — |
| `exchange-market` | `7 */6 * * *` | — |
| `exchange-contract-expiry` | `*/15 * * * *` | — |
| `db-backup` | `17 3 * * *` | — |
| `log-retention` | `41 4 * * *` | — |
| `notification-email-digest` | `7 8 * * *` | — |
| `realm-source-sync` | `37 * * * *` | — |
| `map-import` | `* * * * *` | — |

- `stat-progression` persists the economic projection into each country's stored `current*` stats and writes one `HistoricalDataPoint` per IxTime month; the admin `forceRecalculation` takes the same lease.
- `thinkpages-trending` scores posts with engagement decay, writes `TrendingTopic` and reconciles the like/reply/repost counters.
- `achievements-evaluate` evaluates account-level and active-country achievements for recently seen users.
- `db-backup` writes a `pg_dump` to `backups/` and keeps the newest 14.
- `notification-email-digest` emails the daily notification digest to users who chose it; it does nothing while email is not configured ([notifications.md](../systems/notifications.md#7-jobs)).
- `log-retention` prunes user-action logs and log files older than `UserLogger`'s 90-day retention, and `CronRun` rows older than 30 days.
- `exchange-market` recomputes the four Exchange sector indices, rebalances the sector funds (zero-sum), applies company decisions queued a day earlier and refreshes company fair values; `exchange-contract-expiry` cancels OPEN contracts never awarded within 3 days of bidding closing and refunds their escrow once ([exchange.md](../systems/exchange.md)).
- `realm-source-sync` runs every realm whose own source sync schedule is due (`RealmSourceSync.intervalHours` since its last applied run), one realm at a time, each under the lease `realm-source-sync:<realmId>` that manual runs share ([realms-eurth-onboarding.md](../systems/realms-eurth-onboarding.md), step 4).
- `map-import` runs queued realm map import analyses (PNG tracing in a worker thread) and any apply job the web process left queued for two minutes, one realm at a time under the lease `map-import:<realmId>`; without it the web process runs the queue in-process ([maps.md](../systems/maps.md#realm-map-import-engine)).
- `elections` also schedules first elections, and `diplomatic-drift` expires foreign-policy proposals and alliance invites after 14 days.

ixtwitter sync is not a cron job; it runs as the separate `ixstats-ixtwitter` PM2 process.

Manual scripts under `scripts/`:
- `scripts/audit/audit-trpc-wiring.ts` – Verifies endpoint wiring
- `scripts/audit/run-all-tests.ts` – Aggregated regression runner
- `scripts/audit/test-all-crud-operations.ts` – Exercises CRUD endpoints
- `scripts/audit/verify-economic-calculations.ts` – Validates economic formulas
- `scripts/setup/backup-db.ts` / `restore-db.ts` – `db:backup` / `db:restore` (`pg_dump -Fc` to `backups/` with retention; `pg_restore`), see [deployment.md](../operations/deployment.md#backups-and-restore)

## Event Producers
- **ThinkShare messages** – `messages` router (`messaging.ts`, `conversations.ts`, `participants.ts`) → `getThinkPagesBroadcaster().broadcastMessage()`
- **Marketplace auctions** – `src/lib/economy/auction-service.ts` (card-market router and `auction-completion` job) → Market WS broadcasts
- **Achievements** – `achievements.unlock` admin mutation (awards 5 credits on first unlock); collector achievements resync via `syncMyCollectorAchievements`
- **Cron jobs** – economy, politics, diplomacy, national-issue, stats, social and wiki jobs listed above

## Consumers
- Messaging (`useThinkPagesWebSocket` in `src/hooks/useThinkPagesWebSocket.ts`, used by `MessagesRouter.tsx`)
- Vault auctions (`useAuctionWebSocket` in `src/hooks/marketplace/`, used by `VaultAuctionsTab.tsx`)
- Compliance modal (`MyCountryComplianceModal.tsx`)
- External monitoring channels (Discord webhooks)

Update this document when new channels, event types, or automation scripts are introduced. Keep payload examples and channel lists in sync with the server implementation.
