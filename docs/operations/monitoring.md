# Monitoring & Observability

**Last updated:** 2026-10-05

Monitoring combines server logs, Discord webhooks, audit scripts, and compliance tooling to keep IxStats healthy.

## Runtime Monitoring
- **Health endpoints** – `GET /api/health` (under the base path) checks the database and heap usage and returns 200 `ok` or 503 `degraded`. It also reports `cron` (per job: `lastRunAt`, `lastStatus`, `lastSuccessAt`, from `CronRun` rows) and `redis` (`ok`, `not ready`, or `disabled`, flagged as required in production); neither marks the app degraded; `ws-backend.mjs` (PM2 `ixstats-ws`) answers `GET /healthz` on port 3551. `bun run diagnostics:health` / `bun run diagnostics:prod` run the shell diagnostics in `scripts/diagnostics/`.
- **Error Logger** – `ErrorLogger` (`~/lib/logging/error-logger`) logs tRPC errors in production and posts `ERROR`-level entries to Discord when `DISCORD_WEBHOOK_ENABLED=true` and `DISCORD_WEBHOOK_URL` is set (production only).
- **User Activity Logging** – `userLoggingMiddleware` (`~/lib/logging/user-middleware`) records API usage on the base tRPC procedures. There is no user-facing telemetry opt-out: the `hideStratcommIntel` and `hideDiplomaticOps` country flags still exist in the schema and in the admin country panel, but their Settings toggles were removed in the August 2026 settings refactor and no logging, directory or search code reads them.
- **Audit log** – `auditLogMiddleware` writes `[SECURITY_AUDIT]` entries (and `AuditLog` rows) for failed or high-sensitivity admin calls.
- **Rate Limiting** – `rateLimiter` (`~/lib/cache/rate-limiter`) and the tRPC tiers log `[RATE_LIMIT]` warnings on breaches and near-limit callers; see [`rate-limiting.md`](rate-limiting.md).
- **Scheduled jobs** – see [Scheduled jobs](#scheduled-jobs) below.
- **Row cap** – `src/server/db.ts` caps unbounded `findMany` reads at 1,000 rows and logs a warning naming the model when a read comes back with exactly the cap, so a truncated read is visible in the logs.

## Scheduled jobs

`cron-runner.mjs` (PM2 `ixstats-cron`) runs the jobs in `src/server/cron/jobs.ts` that `CRON_ENABLED_JOBS` names
(the table is in [events.md](../reference/events.md#scheduled--batch-jobs)).

- **Lease:** each run takes a lease row in `job_leases` (`withJobLock`, `src/lib/system/job-lock.ts`) with one atomic
  upsert. A run that finds the lease held is skipped. The lease is deleted when the job settles and expires after the
  job's `timeoutMs`, so a crashed holder never blocks later runs. Nothing holds a database connection during the run.
- **Run records:** every run, including skips, writes a `CronRun` row (`job`, `status` = `success` | `failed` |
  `skipped`, `startedAt`, `finishedAt`, `durationMs`, and a clipped `summary` or `error`; `src/lib/system/cron-runs.ts`).
  `log-retention` deletes rows older than 30 days.
- **Alerts:** a failed run posts a warning to the Discord webhook (needs `DISCORD_WEBHOOK_ENABLED=true` and
  `DISCORD_WEBHOOK_URL`).
- **Health:** `/api/health` → `cron` gives the latest run, its status and the latest success per job.
- **Logs:** each run logs a `[Cron]` line with its duration and summary (`pm2 logs ixstats-cron`); `bun run cron:check`
  import-checks every job.

## Alerts & Notifications
- **Discord Webhooks** – Configure `DISCORD_WEBHOOK_URL` (and `DISCORD_WEBHOOK_ENABLED=true`) for production alerts: logged errors and failed cron runs
- **In-App Notifications** – the `notifications` router (`src/server/api/routers/notifications/`) delivers in-app notifications to users
- **Help System** – `/help` articles are user-facing; there are no on-call runbooks there

## Manual Audits
None of these run on a schedule. Mostly in `scripts/audit/`:
- `audit-trpc-wiring.ts` (`bun run audit:wiring`) – Ensures front-end procedures map to live routers
- `run-all-tests.ts` (`bun run test:all`, `bun run test:critical`) – Aggregated regression suite
- `verify-economic-calculations.ts` (`bun run test:economics`), `verify-database-integrity.ts` (`bun run test:db`) – Spot-check critical calculations and schema health
- `scripts/audit-production-urls.ts` (`bun run audit:urls:prod`) – Validates page availability under production base path


## Incident Response
- There is no incident-response runbook in the repo (`docs/archive/` is gitignored and local-only). For deploy rollback see the [release guide](release-guide.md#rollback) (`scripts/deployment/rollback-deployment.sh`)
- `MyCountryComplianceModal.tsx` is a player-facing MyCountry modal, not an operations tool

## Logging Strategy
- In production the web app runs as `next start` (from `start-production.sh`, outside PM2), so its output goes to that session; `ixstats-ws` (`[WS]`), `ixstats-cron` (`[Cron]`) and `ixstats-ixtwitter` log through PM2 (`pm2 logs <name>`)
- `server.mjs` (used by `bun run start`) writes logs prefixed with `[Server]`
- tRPC middleware logs use `[AUTH_MIDDLEWARE]`, `[ADMIN_ACCESS_DENIED]`, `[RATE_LIMIT]`, `[SECURITY_AUDIT]` and `[TRPC]` (slow calls over 500 ms) prefixes; `TRPC_VERBOSE=true` adds more
- Consider piping logs into a centralised system for long-term retention when moving to dedicated hosting

Keep this guide aligned with new alert channels or monitoring scripts. Update the help center with user-facing instructions whenever operational responses change.
