# Deployment Guide

**Last updated:** 2026-10-05

IxStats ships as a Next.js app. On the production VPS the web app runs as plain `next start` (via `start-production.sh`), with WebSockets and scheduled jobs in separate PM2 processes: `ixstats-ws` (`ws-backend.mjs`) and `ixstats-cron` (`cron-runner.mjs`). A custom Node server (`server.mjs`) that serves Next plus the WebSockets in one process remains available through `bun run start`. Production builds wrap `next build` with base-path tooling.

Vercel is not a deployment target. The repository is connected to a Vercel project, but `vercel.json` sets `git.deploymentEnabled: false` so pushes and pull requests no longer trigger Vercel builds (they had all failed). Remove that setting, or disconnect the project in Vercel, to change this.

To release, follow the [release guide](release-guide.md) (it also covers [rollback](release-guide.md#rollback)). The September release details are in [`deploy-rose-garden-2026-09.md`](deploy-rose-garden-2026-09.md). There is no staging environment.

## Build Pipeline
1. Install dependencies: `bun install`
2. Sync the schema: `bun run db:push:force` (`prisma db push`; the Prisma migration history stops in November 2025, so `db:migrate:deploy` does not bring a database up to date)
3. Build: `bun run build` (wraps `./scripts/with-base-path.sh next build`, then `postbuild`)
4. Start: `bun run start:prod` (runs `start-production.sh` → `next start -p ${PORT:-3550}`), or `bun run start` (runs `server.mjs` with WebSockets in-process)

### Alternative Commands
- `bun run preview` – Build + start Next.js server on `${PORT:-3550}`
- `bun run start:next` – Direct Next.js start without the custom server (no WebSocket support)
- `bun run deploy:prod` – Runs `scripts/deploy-production.sh`: on the VPS it refuses any branch but `master` (unless `ALLOW_NON_MASTER_DEPLOY=1`), hard-resets the checkout to that branch from the `master` remote, then runs `bun install --frozen-lockfile`, `db:generate`, `db:backup` (the deploy aborts if the dump fails; on success it appends the time, commit and dump to `backups/deploy-history.log`), `db:push:force`, build, `deploy-ixworld.sh`, `pm2 startOrReload ecosystem.config.cjs --update-env` (a failed reload aborts the deploy), and `start-production.sh`
- `bun run deploy:rollback -- <remote-branch> [--restore <dump>] [--yes]` – `scripts/deployment/rollback-deployment.sh`: checks out a rollback branch from the `master` remote, optionally restores a pre-deploy dump, then runs `deploy-production.sh` with `ALLOW_NON_MASTER_DEPLOY=1` (see the [release guide](release-guide.md#rollback))
- `bun run deploy:local` – Local checks + push + remote `deploy-production.sh` (see [`local-dev-setup.md`](local-dev-setup.md))

## Server Behaviour (`server.mjs`)
- Loads environment variables through `load-env.mjs` (shared with `ws-backend.mjs` and `cron-runner.mjs`) from `.env.production.local`, `.env.local`, `.env.production`, `.env` in production (`.env.local.dev`, `.env.local`, `.env` in development); the first file that sets a key wins and real env vars are never overwritten. `.env.production.local` beats `.env.production`, as in Next.js and `start-production.sh`
- Defaults to port 3550 in production, 3003 for dev fallback (development script favours 3000)
- Starts the ThinkPages Socket.IO server via `src/server/websocket-server.ts` in production, and the Market WebSocket at `/api/market-ws` in every mode
- Schedules no jobs: `cron-runner.mjs` (PM2 `ixstats-cron`) is the only scheduler and runs only the jobs named in `CRON_ENABLED_JOBS`
- Graceful shutdown handlers respond to `SIGTERM` and `SIGINT`
- `ws-backend.mjs` (PM2 `ixstats-ws`) serves the same two sockets standalone on `WS_BACKEND_PORT` (default 3551), with a `/healthz` probe

## PM2 processes

`ecosystem.config.cjs` is server-local and not tracked. Its tracked template is
[`ecosystem.config.example.cjs`](../../ecosystem.config.example.cjs), with three apps:

| App | Script | Notes |
| --- | --- | --- |
| `ixstats-cron` | `cron-runner.mjs` | The only scheduler. `CRON_ENABLED_JOBS` lives in this app's `env` block. `cron-runner.mjs` exits unless it runs under Bun, so the app's `interpreter` must be `bun` (check this when copying the template) |
| `ixstats-ws` | `ws-backend.mjs` | ThinkPages and market WebSockets on `WS_BACKEND_PORT` (3551), proxied by nginx at `/ws/thinkpages` and `/api/market-ws` |
| `ixstats-ixtwitter` | `scripts/run-ixtwitter-sync.ts` | Discord IxTwitter → ThinkPages sync (Bun) |

Secrets stay in `.env.production.local`; the processes load env files themselves (`load-env.mjs`). Put only
process-specific settings in the ecosystem file, and give `ixstats-cron` and `ixstats-ws` the same `REDIS_*` values as
the web app. The web app itself is not a PM2 app: `deploy-production.sh` starts it with `start-production.sh`.

## Base Path & Hosting
- Script `scripts/with-base-path.sh` handles deployments under `/projects/ixstates`
- Update `NEXT_PUBLIC_BASE_PATH` and reverse-proxy settings if hosting path changes
- Ensure static assets under `public/` are served with the same base path

## Database Management
- Production database: PostgreSQL with PostGIS extension for geographic features
- Back up with `bun run db:backup` (see [Backups and restore](#backups-and-restore)); `deploy-production.sh` takes one before every schema sync
- Schema changes are applied with `prisma db push` (`bun run db:push:force`, also run by `deploy-production.sh`); it stops on possible data loss, so review any such warning before accepting it

## Backups and restore

`bun run db:backup` (`scripts/setup/backup-db.ts`, logic in `src/lib/system/db-backup.ts`) writes a
`pg_dump -Fc` custom-format dump to `backups/ixstats-<UTC timestamp>.dump` (gitignored, so the deploy
script's `git clean -fd` leaves it alone) and then deletes the oldest `ixstats-*.dump` files beyond the
newest 14. It exits non-zero on any failure and never leaves a partial file behind.

- **Source.** When the Docker container `ixstats-postgres` is running (production, WSL local dev) it runs
  `docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats`, so the host needs no Postgres client.
  Otherwise it runs the host's `pg_dump` against `DATABASE_URL` (Prisma-only query parameters are dropped;
  the password is passed as `PGPASSWORD`). `--no-docker` forces `DATABASE_URL`.
- **Options.** `bun run db:backup -- --keep 30 --dir /srv/ixstats-backups`.
- **Deploys.** `scripts/deploy-production.sh` runs `bun run db:backup` before `bun run db:push:force`
  and aborts the deploy if the dump fails.
- **Schedule.** The cron job `db-backup` (`src/server/cron/jobs.ts`) takes the same dump daily at 03:17 UTC
  with the default retention, into `backups/` under the cron runner's working directory. Like every job it
  is off until named in `CRON_ENABLED_JOBS` (or `*`); restart `ixstats-cron` after changing it.
- **Off-site.** Dumps live on the same VPS as the database; copy them elsewhere
  (`scp ixwiki:/ixwiki/public/projects/ixstats/backups/ixstats-<stamp>.dump .`) for disaster recovery.

`bun run db:restore` lists the dumps in `backups/`, and `bun run db:restore -- <file>` prints the target
and the exact `pg_restore` command without changing anything. Add `--yes` to run
`pg_restore --clean --if-exists --no-owner` into the running `ixstats-postgres` container (the dump is piped
in on stdin), or into `DATABASE_URL` when the container is not running. Under `NODE_ENV=production` the
script refuses unless `--i-know-this-is-production` is also passed:

```bash
bun run db:backup   # dump the current state first
bun run db:restore -- ixstats-20260930T031700Z.dump --i-know-this-is-production        # review the plan
bun run db:restore -- ixstats-20260930T031700Z.dump --i-know-this-is-production --yes  # restore
docker exec ixstats-postgres psql -U postgres -d ixstats -c 'SELECT count(*) FROM "Country";'
```

Stop the web app and `ixstats-cron` during a production restore so nothing writes mid-restore.

## Health & Monitoring
- Rate limiter and error logger configured via environment toggles (`RATE_LIMIT_ENABLED`, `DISCORD_WEBHOOK_ENABLED`)
- `bun run verify:production` convenience command runs critical test suites, schema validation and linting
- `GET /api/health` returns DB and memory status (200 `ok` / 503 `degraded`), plus per-job cron status (`lastRunAt`, `lastStatus`, `lastSuccessAt`) and Redis state; see [monitoring.md](monitoring.md#scheduled-jobs)
- WebSocket failures log warnings but continue serving HTTP; monitor logs for `[Server] ✗ … WebSocket` (or `[WS] ✗` from `ixstats-ws`) entries

## Deployment Checklist
1. Verify environment variables using `bun run auth:check:prod` / `bun run verify:environment` and compare with [Environment Configuration](#environment-configuration) below and `src/env.ts`. With `NODE_ENV=production`, `verify:environment` fails when a secret `src/env.ts` requires in production is missing or too short (Clerk keys, `IXTIME_BOT_SECRET`, `CRON_SECRET`, `WIKI_SYNC_WEBHOOK_SECRET`) and warns about Redis, `NEXT_PUBLIC_APP_URL` and the Discord webhook. Run it with the production env files loaded (see the [release guide](release-guide.md#a2-server-prep))
2. Run `bun run audit:wiring` and `bun run test:critical`
3. Create a database backup with `bun run db:backup` (`deploy-production.sh` also takes one before `db push`; see [Backups and restore](#backups-and-restore))
4. Build and deploy the new release
5. Monitor Discord/webhook alerts and server logs after rollout

Document any hosting-specific steps (containerisation, CI/CD pipelines) in an appendix or infra repo referencing this guide.

## Environment Configuration

`.env.example` lists every key `src/env.ts` declares (`src/tests/config/env-example.test.ts` keeps them in step);
copy it to `.env.local` for development.

### Minimum Development Setup

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats"   # docker-compose.dev.yml
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_key"   # needed to sign in
CLERK_SECRET_KEY="sk_test_your_key"                    # needed to sign in
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
| `ENABLE_COMPRESSION` | Read by `src/proxy.ts`. (`ENABLE_CACHING` and `CACHE_TTL_SECONDS` are declared in `src/env.ts` but nothing reads them) |
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
| `REDIS_ENABLED`, `REDIS_URL` | Redis for rate limiting, caches and the ThinkPages and market cross-process broadcast bridges (`REDIS_ENABLED` defaults to `"false"`; production needs it) |
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
| `.env.local.dev` | Preferred for local development (auto-loaded by `start-development.sh` and `prisma.config.ts`) |
| `.env.local` | Development fallback; what `.env.example` suggests, and what Bun loads for `bun run <script>` |
| `.env.production` | Production template values (loaded by `start-production.sh`, `deploy-production.sh`, `server.mjs`, `ws-backend.mjs`, `cron-runner.mjs`) |
| `.env.production.local` | Production secrets (loaded by the same scripts; never committed) |
| `.env` | Shared defaults |

In production the precedence is the same everywhere: a variable already in the environment wins, then
`.env.production.local`, `.env.local`, `.env.production`, `.env` (`load-env.mjs`; `start-production.sh` sources
`.env.production` and then `.env.production.local`, so the latter wins).

### Validation & Tooling

- `bun run auth:check:*` — Validates Clerk configuration for different environments
- `scripts/setup/check-auth-config.js` — CLI script invoked by commands above
- `bun run audit:wiring` — Uses environment toggles to ensure critical data paths are wired
