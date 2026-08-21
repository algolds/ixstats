# Deployment Guide

**Last updated:** May 2026

IxStats ships as a Next.js app with a custom Node server (`server.mjs`). Production deployments wrap the Next build with base-path tooling and enable WebSocket broadcasting.

## Build Pipeline
1. Install dependencies: `bun install`
2. Prepare database (if needed): `bun run db:migrate:deploy`
3. Build: `bun run build` (wraps `./scripts/with-base-path.sh next build`)
4. Start: `bun run start` (executes `server.mjs`)

### Alternative Commands
- `bun run preview` – Build + start Next.js server on `${PORT:-3550}`
- `bun run start:next` – Direct Next.js start without the custom server (no WebSocket support)
- `bun run deploy:prod` – Hook for deployment automation (extend as required)

## Server Behaviour (`server.mjs`)
- Loads environment variables from `.env.production`, `.env.local`, `.env`
- Defaults to port 3550 in production, 3003 for dev fallback (development script favours 3000)
- Starts Socket.IO server via `src/server/websocket-server.ts` in production
- Graceful shutdown handlers respond to `SIGTERM` and `SIGINT`

## Base Path & Hosting
- Script `scripts/with-base-path.sh` handles deployments under `/projects/ixstates`
- Update `NEXT_PUBLIC_BASE_PATH` and reverse-proxy settings if hosting path changes
- Ensure static assets under `public/` are served with the same base path

## Database Management
- Production database: PostgreSQL with PostGIS extension for geographic features
- Use `pg_dump` for backups before promotions; store backups securely
- For schema changes, update `DATABASE_URL` and run `bun run db:migrate:deploy`

## Health & Monitoring
- Rate limiter and error logger configured via environment toggles (`ENABLE_RATE_LIMITING`, `DISCORD_WEBHOOK_ENABLED`)
- `bun run verify:production` convenience command runs critical test suites + linting
- WebSocket failures log warnings but continue serving HTTP; monitor logs for `[Server] ✗ WebSocket` entries

## Deployment Checklist
1. Verify environment variables using `bun run auth:check:prod` and compare with `docs/operations/environments.md`
2. Run `bun run audit:wiring` and `bun run test:critical`
3. Create a database backup (`bun run db:backup`)
4. Build and deploy the new release
5. Monitor Discord/webhook alerts and server logs after rollout

Document any hosting-specific steps (containerisation, CI/CD pipelines) in an appendix or infra repo referencing this guide.

## Environment Configuration

> Merged from `docs/operations/environments.md`. Date: June 2026.

### Minimum Development Setup

```dotenv
DATABASE_URL="postgresql://ixstats:ixstats@localhost:5433/ixstats?schema=public"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_key"   # optional for Clerk-auth flows
CLERK_SECRET_KEY="sk_test_your_key"                    # optional
IXTIME_BOT_URL="http://localhost:3001"
NEXT_PUBLIC_IXTIME_BOT_URL="http://localhost:3001"
ENABLE_RATE_LIMITING=false
```

> **Note:** Set any value to an empty string if you intentionally disable a service.

### Server-Side Variables

| Variable | Purpose |
| --- | --- |
| `ALLOW_E2E_MUTATIONS` | Enables mutation endpoints during automated E2E runs |
| `BASE_PATH` | Manually override Next.js basePath |
| `CACHE_TTL_SECONDS` | Global cache TTL for select services |
| `CLERK_SECRET_KEY` | Clerk backend secret (required for production auth) |
| `CRON_SECRET` | Token for scheduled job authentication |
| `DATABASE_URL` | Prisma connection string (PostgreSQL with schema parameter) |
| `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` | Discord bot configuration |
| `DISCORD_WEBHOOK_ENABLED`, `DISCORD_WEBHOOK_URL` | Error/alert webhook delivery |
| `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` | Credentials for automated testing |
| `ENABLE_CACHING`, `ENABLE_COMPRESSION`, `ENABLE_QUERY_CACHE` | Toggles for response caching and compression |
| `ENABLE_RATE_LIMITING`, `RATE_LIMIT_ENABLED` | Enables rate limiter middleware |
| `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MS` | Throttle configuration |
| `ENCRYPTION_MASTER_PASSWORD` | Encryption utilities (e.g., secure storage) |
| `FLAG_SERVICE_URL` | Country flag provider endpoint |
| `INVOKE_FAIL_ON_ERRORS`, `INVOKE_TREAT_AUTH_ERRORS_AS_SKIP` | Script behaviour toggles |
| `IXTIME_BOT_URL` | Internal IxTime bot endpoint |
| `IXWIKI_API_URL`, `IXWIKI_LOCAL_PATH` | MediaWiki integration targets |
| `PORT` | HTTP server port (3550 production default, 3000 dev) |
| `PROD_CLONE_BASE_URL` | Remote URL for cloning production data |
| `REDIS_ENABLED`, `REDIS_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Redis caching / rate limiting config |
| `SKIP_ENV_VALIDATION` | Bypass environment checks during fast builds |
| `TEST_RUN_ID`, `TEST_TENANT_PREFIX` | Namespacing for automated run artefacts |
| `VERCEL_URL` | Vercel deployment hostname |
| `WIRING_FAIL_ON_UNWIRED` | Forces wiring audits to fail builds on missing data |

### Public (Client-Side) Variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | External URL for absolute links |
| `NEXT_PUBLIC_BASE_PATH` | Client-side base path override |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key for authentication widgets |
| `NEXT_PUBLIC_CLIENTVAR` | Generic placeholder for feature flags |
| `NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS` | UI toggle for experimental intelligence tips |
| `NEXT_PUBLIC_IXTIME_BOT_URL` | Browser-accessible IxTime endpoint |
| `NEXT_PUBLIC_MEDIAWIKI_URL` | Public wiki URL for builder imports |
| `NEXT_PUBLIC_WS_ENDPOINT`, `NEXT_PUBLIC_WS_PORT`, `NEXT_PUBLIC_WS_URL` | WebSocket client configuration |

### Environment Files

| File | Usage |
| --- | --- |
| `.env.local.dev` | Preferred for local development (auto-loaded by `start-development.sh`) |
| `.env.local` | Secondary fallback for dev |
| `.env.production` | Production-specific overrides (loaded by `server.mjs`) |
| `.env` | Shared defaults |

### Validation & Tooling

- `bun run auth:check:*` — Validates Clerk configuration for different environments
- `scripts/setup/check-auth-config.js` — CLI script invoked by commands above
- `bun run audit:wiring` — Uses environment toggles to ensure critical data paths are wired
