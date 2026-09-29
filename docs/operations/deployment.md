# Deployment Guide

**Last updated:** September 2026

IxStats ships as a Next.js app. On the production VPS the web app runs as plain `next start` (via `start-production.sh`), with WebSockets and scheduled jobs in separate PM2 processes: `ixstats-ws` (`ws-backend.mjs`) and `ixstats-cron` (`cron-runner.mjs`). A custom Node server (`server.mjs`) that serves Next plus the WebSockets in one process remains available through `bun run start`. Production builds wrap `next build` with base-path tooling.

For the step-by-step release procedure see [`deployment-checklist.md`](deployment-checklist.md); for the current release see [`deploy-rose-garden-2026-09.md`](deploy-rose-garden-2026-09.md).

## Build Pipeline
1. Install dependencies: `bun install`
2. Sync the schema: `bun run db:push:force` (`prisma db push`; the Prisma migration history stops in November 2025, so `db:migrate:deploy` does not bring a database up to date)
3. Build: `bun run build` (wraps `./scripts/with-base-path.sh next build`, then `postbuild`)
4. Start: `bun run start:prod` (runs `start-production.sh` → `next start -p ${PORT:-3550}`), or `bun run start` (runs `server.mjs` with WebSockets in-process)

### Alternative Commands
- `bun run preview` – Build + start Next.js server on `${PORT:-3550}`
- `bun run start:next` – Direct Next.js start without the custom server (no WebSocket support)
- `bun run deploy:prod` – Runs `scripts/deploy-production.sh`: on the VPS it hard-resets the checkout to its current branch from the `master` remote, then `bun install --frozen-lockfile`, `db:generate`, `db:push:force`, build, `deploy-ixworld.sh`, `pm2 startOrReload ecosystem.config.cjs --update-env`, and `start-production.sh`
- `bun run deploy:local` – Local checks + push + remote `deploy-production.sh` (see [`local-dev-setup.md`](local-dev-setup.md))

## Server Behaviour (`server.mjs`)
- Loads environment variables from `.env.production`, `.env.local`, `.env.production.local`, `.env` in production (`.env.local.dev`, `.env.local`, `.env` in development); the first file that sets a key wins and real env vars are never overwritten
- Defaults to port 3550 in production, 3003 for dev fallback (development script favours 3000)
- Starts the ThinkPages Socket.IO server via `src/server/websocket-server.ts` in production, and the Market WebSocket at `/api/market-ws` in every mode
- Schedules no jobs: `cron-runner.mjs` (PM2 `ixstats-cron`) is the only scheduler and runs only the jobs named in `CRON_ENABLED_JOBS`
- Graceful shutdown handlers respond to `SIGTERM` and `SIGINT`
- `ws-backend.mjs` (PM2 `ixstats-ws`) serves the same two sockets standalone on `WS_BACKEND_PORT` (default 3551), with a `/healthz` probe

## Base Path & Hosting
- Script `scripts/with-base-path.sh` handles deployments under `/projects/ixstates`
- Update `NEXT_PUBLIC_BASE_PATH` and reverse-proxy settings if hosting path changes
- Ensure static assets under `public/` are served with the same base path

## Database Management
- Production database: PostgreSQL with PostGIS extension for geographic features
- Use `pg_dump` for backups before promotions (`docker exec ixstats-postgres pg_dump -U postgres -d ixstats -Fc > …`); store backups securely. `bun run db:backup` is **not** implemented for PostgreSQL — it prints a `pg_dump` hint and exits 1
- Schema changes are applied with `prisma db push` (`bun run db:push:force`, also run by `deploy-production.sh`); it stops on possible data loss, so review any such warning before accepting it

## Health & Monitoring
- Rate limiter and error logger configured via environment toggles (`RATE_LIMIT_ENABLED`, `DISCORD_WEBHOOK_ENABLED`)
- `bun run verify:production` convenience command runs critical test suites, schema validation and linting
- `GET /api/health` returns DB and memory status (200 `ok` / 503 `degraded`)
- WebSocket failures log warnings but continue serving HTTP; monitor logs for `[Server] ✗ … WebSocket` (or `[WS] ✗` from `ixstats-ws`) entries

## Deployment Checklist
1. Verify environment variables using `bun run auth:check:prod` / `bun run verify:environment` and compare with [Environment Configuration](#environment-configuration) below and `src/env.ts`
2. Run `bun run audit:wiring` and `bun run test:critical`
3. Create a database backup with `pg_dump` (see Database Management; `bun run db:backup` does not work on PostgreSQL)
4. Build and deploy the new release
5. Monitor Discord/webhook alerts and server logs after rollout

Document any hosting-specific steps (containerisation, CI/CD pipelines) in an appendix or infra repo referencing this guide.

## Environment Configuration

> Merged from `docs/operations/environments.md`. Date: June 2026.

### Minimum Development Setup

```dotenv
DATABASE_URL="postgresql://ixstats:PASSWORD@localhost:5433/ixstats?schema=public"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_key"   # optional for Clerk-auth flows
CLERK_SECRET_KEY="sk_test_your_key"                    # optional
IXTIME_BOT_URL="http://localhost:3001"
NEXT_PUBLIC_IXTIME_BOT_URL="http://localhost:3001"
RATE_LIMIT_ENABLED=false
```

> **Note:** Set any value to an empty string if you intentionally disable a service.

### Server-Side Variables

`src/env.ts` is the authoritative schema (validated at boot unless `SKIP_ENV_VALIDATION` is set). The main variables:

| Variable | Purpose |
| --- | --- |
| `BASE_PATH` | Manually override Next.js basePath (production scripts default to `/projects/ixstates`) |
| `CACHE_TTL_SECONDS`, `ENABLE_CACHING`, `ENABLE_COMPRESSION` | Declared performance toggles (`ENABLE_COMPRESSION` is read by `src/proxy.ts`) |
| `CLERK_SECRET_KEY` | Clerk backend secret (**required in production**) |
| `CRON_SECRET` | Bearer token for the `/api/cron/*` HTTP triggers (**required in production**, ≥32 chars) |
| `CRON_ENABLED_JOBS` | Comma-separated job names from `src/server/cron/jobs.ts` (or `*`) that `cron-runner.mjs` schedules; unset/empty schedules none |
| `DATABASE_URL` | Prisma connection string (PostgreSQL) |
| `DATABASE_READONLY` | `"true"` puts the Prisma client in read-only mode |
| `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` | Discord bot configuration (image proxy, IxTwitter sync, guild member sync) |
| `DISCORD_WEBHOOK_ENABLED`, `DISCORD_WEBHOOK_URL` | Error/alert webhook delivery |
| `IXTIME_BOT_URL` | Internal IxTime bot endpoint |
| `IXTIME_BOT_SECRET` | Secret the Discord bot sends to `/api/ixtime/sync-from-bot` (**required in production**) |
| `BOT_API_KEY` | Key the Discord bot sends to `/api/bot/lorewards/sync` |
| `IXWIKI_LOCAL_PATH`, `IXWIKI_DB_*`, `WIKIOS_MEDIAWIKI_*` | MediaWiki integration targets |
| `PORT` | HTTP server port (3550 production default, 3000 dev) |
| `WS_BACKEND_PORT` | Port for `ws-backend.mjs` (default 3551; read directly, not in `src/env.ts`) |
| `RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MS` | Rate limiter toggle (default `"true"`) and default window; see [`rate-limiting.md`](rate-limiting.md) |
| `REDIS_ENABLED`, `REDIS_URL` | Redis for rate limiting, caches and the ThinkPages cross-process broadcast bridge |
| `SKIP_ENV_VALIDATION` | Bypass environment checks during fast builds |
| `SYSTEM_OWNER_IDS` | Comma-separated Clerk IDs of system owners |
| `VERCEL_URL` | Vercel deployment hostname (only used to build absolute URLs) |
| `WIKI_SYNC_WEBHOOK_SECRET` | Shared secret MediaWiki sends to `/api/wiki/sync-webhook` and `/api/wikios/inbound-sync` (**required in production**, ≥32 chars) |
| `WS_ALLOWED_ORIGINS` | Extra browser origins allowed to open the ThinkPages socket (on top of `NEXT_PUBLIC_APP_URL`); fails closed |
| `ENABLE_RATE_LIMITING`, `ENABLE_QUERY_CACHE`, `FLAG_SERVICE_URL`, `IXWIKI_API_URL` | Read only by `scripts/audit/audit-v1.ts`, not by the app |
| `WIRING_FAIL_ON_UNWIRED` | Forces wiring audits (`scripts/audit/audit-trpc-wiring.ts`) to fail on missing data |

### Public (Client-Side) Variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | External URL for absolute links; also an allowed WebSocket origin |
| `NEXT_PUBLIC_BASE_PATH` | Client-side base path override |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key for authentication widgets (**required in production**) |
| `NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS` | UI toggle for experimental intelligence tips |
| `NEXT_PUBLIC_IXTIME_BOT_URL` | Browser-accessible IxTime endpoint |
| `NEXT_PUBLIC_MEDIAWIKI_URL` | Public wiki URL for builder imports |
| `NEXT_PUBLIC_ENABLE_WEBSOCKET`, `NEXT_PUBLIC_WS_PORT` | ThinkPages WebSocket client configuration |
| `NEXT_PUBLIC_IXWORLD_STANDALONE` | `"true"` for the IxWorld standalone build (empty base path) |

### Environment Files

| File | Usage |
| --- | --- |
| `.env.local.dev` | Preferred for local development (auto-loaded by `start-development.sh`) |
| `.env.local` | Secondary fallback for dev |
| `.env.production` | Production-specific values (loaded by `start-production.sh`, `deploy-production.sh`, `server.mjs`, `ws-backend.mjs`, `cron-runner.mjs`) |
| `.env.production.local` | Production secrets (loaded by the same scripts; never committed) |
| `.env` | Shared defaults |

### Validation & Tooling

- `bun run auth:check:*` — Validates Clerk configuration for different environments
- `scripts/setup/check-auth-config.js` — CLI script invoked by commands above
- `bun run audit:wiring` — Uses environment toggles to ensure critical data paths are wired
