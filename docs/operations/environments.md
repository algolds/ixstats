# Environment Configuration

**Last updated:** October 2025

IxStats relies on layered environment files loaded by `server.mjs` (`.env.production`, `.env.local`, `.env`). Development scripts (`start-development.sh`) prioritise `.env.local.dev`.

## Minimum Development Setup
```dotenv
DATABASE_URL="postgresql://ixstats:ixstats@localhost:5433/ixstats?schema=public"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_key"   # optional for Clerk-auth flows
CLERK_SECRET_KEY="sk_test_your_key"                    # optional
IXTIME_BOT_URL="http://localhost:3001"
NEXT_PUBLIC_IXTIME_BOT_URL="http://localhost:3001"
ENABLE_RATE_LIMITING=false
```
> **Migration Note (October 2025)**: IxStats now uses PostgreSQL instead of SQLite. Legacy SQLite files are backed up in `prisma/backups/sqlite-legacy/`.
Set any value to an empty string if you intentionally disable a service.

## Server-Side Variables
| Variable | Purpose |
| --- | --- |
| `ALLOW_E2E_MUTATIONS` | Enables mutation endpoints during automated E2E runs |
| `BASE_PATH` | Manually override Next.js basePath (defaults handled in scripts) |
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

## Public (Client-Side) Variables
| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | External URL for absolute links |
| `NEXT_PUBLIC_BASE_PATH` | Client-side base path override |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key for authentication widgets |
| `NEXT_PUBLIC_CLIENTVAR` | Generic placeholder for feature flags (clean up after use) |
| `NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS` | UI toggle for experimental intelligence tips |
| `NEXT_PUBLIC_IXTIME_BOT_URL` | Browser-accessible IxTime endpoint |
| `NEXT_PUBLIC_MEDIAWIKI_URL` | Public wiki URL for builder imports |
| `NEXT_PUBLIC_WS_ENDPOINT`, `NEXT_PUBLIC_WS_PORT`, `NEXT_PUBLIC_WS_URL` | WebSocket client configuration |

## Environment Files
| File | Usage |
| --- | --- |
| `.env.local.dev` | Preferred for local development (auto-loaded by `start-development.sh`) |
| `.env.local` | Secondary fallback for dev |
| `.env.production` | Production-specific overrides (loaded by `server.mjs`) |
| `.env` | Shared defaults |

## Validation & Tooling
- `npm run auth:check:*` – Validates Clerk configuration for different environments
- `scripts/setup/check-auth-config.js` – CLI script invoked by commands above
- `npm run audit:wiring` – Uses environment toggles to ensure critical data paths are wired

Keep this document updated whenever new environment variables or toggles are introduced. Remove deprecated entries as part of cleanup to avoid configuration drift.
