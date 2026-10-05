# Production Tooling & Deployment Architecture

**Plan 168 Decision Record & Static Operator Contract**

## Canonical Production Pipeline

The repository consolidates production deployment tooling behind a single canonical deployment pipeline:

- **Canonical Deployment Script**: [`scripts/deploy-production.sh`](../deploy-production.sh)
- **Local Trigger / Remote Deploy**: [`scripts/deploy-local.sh`](../deploy-local.sh)
- **Production Start Command**: `bun run start:prod` (invokes the root `start-production.sh` → `next start` on `${PORT:-3550}`)
- **Current release runbook**: [`docs/operations/deploy-rose-garden-2026-09.md`](../../docs/operations/deploy-rose-garden-2026-09.md) (Realms schema push, ownership backfill, Eurth serving)

## Operator Decisions & Decisions Record (2026-08-20)

1. **Canonical Production Entrypoint**:
   - `scripts/deploy-production.sh` is the sole authoritative production deployment entrypoint.
   - Stale/duplicate entrypoints are removed: the `deploy:production` alias and the legacy `scripts/deployment/deploy-to-production.sh` (2026-10-05). There is no staging environment, so `deploy-to-staging.sh` (which pointed at the production checkout) is removed too.

2. **Process Ownership Strategy**:
   - Production service lifecycle is managed on the VPS via PM2 (`pm2 startOrReload ecosystem.config.cjs`, called from `deploy-production.sh`).
   - Maps standalone instance is managed via `ecosystem.ixworld.config.cjs`; the standalone WebSocket backend (`ws-backend.mjs`, PM2 `ixstats-ws`) and cron runner (`cron-runner.mjs`, PM2 `ixstats-cron`) run as separate processes.
   - The `ecosystem*.config.cjs` files are server-local (git-ignored). [`ecosystem.config.example.cjs`](../../ecosystem.config.example.cjs) is the tracked template (`ixstats-cron`, `ixstats-ws`, `ixstats-ixtwitter`). `deploy-production.sh` fails if the PM2 reload fails, and warns if the file is missing.
   - Node process runs standalone on port 3550 with basePath `/projects/ixstates`. `next.config.js` is server-local (git-ignored) as well; [`next.config.example.js`](../../next.config.example.js) is its tracked template, so mirror changes to the server copy there.
   - Env files: `server.mjs`, `ws-backend.mjs` and `cron-runner.mjs` load them through `load-env.mjs` in the order `.env.production.local`, `.env.local`, `.env.production`, `.env` (first file to set a key wins; real env vars always win). `start-production.sh` sources `.env.production` and then `.env.production.local`, so the secrets file wins there too.

3. **Schema Migration Strategy**:
   - Schema deployment runs through explicit, guarded operations (`prisma db push` / `prisma migrate deploy`).
   - Destructive database writes (`db:reset`, unconfirmed schema drops) are permanently blocked in scripts.

4. **Prod-Clone / E2E Verification Workflow**:
   - Dead `.github/workflows/verify-prodclone.yml` workflow was removed as it referenced non-existent scripts and configs.
   - Verification in CI relies on native `bun run validate:script-targets`, unit tests, typechecks, and architecture audits.

5. **Runtime & Package Manager**:
   - Bun 1.4+ is the exclusive package manager and runtime across all scripts and CI workflows.
   - Banned package manager tokens (`npm`, `npx`, `yarn`, `pnpm`, `pnpx`) are rejected statically by `scripts/audit/validate-script-targets.ts`.

## Script Target Validator

Static validator: [`scripts/audit/validate-script-targets.ts`](../audit/validate-script-targets.ts)
Command: `bun run validate:script-targets`

Validates:
- All paths referenced in `package.json` exist on disk.
- All TypeScript config targets (`-p tsconfig.*.json`) exist.
- All CI workflow `bun run <cmd>` references match actual `package.json` scripts.
- No banned package-manager invocations exist.

## Other scripts in this directory

| Script | Alias | Notes |
| --- | --- | --- |
| `rollback-deployment.sh` | `bun run deploy:rollback -- <remote-branch> [--restore <dump>]` | Checks out a rollback branch, optionally restores the pre-deploy dump listed in `backups/deploy-history.log`, then redeploys with `ALLOW_NON_MASTER_DEPLOY=1` ([release guide](../../docs/operations/release-guide.md#rollback)) |
| `post-deployment-validation.ts` | `bun run post:deploy:validate` | Post-deploy smoke checks |
| `verify-environment.ts` | `bun run verify:environment` | Checks the environment it runs in. With `NODE_ENV=production` it fails when a secret `src/env.ts` requires in production is missing or too short (Clerk keys, `IXTIME_BOT_SECRET`, `CRON_SECRET` and `WIKI_SYNC_WEBHOOK_SECRET`, the last two at least 32 characters) and warns about Redis, `NEXT_PUBLIC_APP_URL` and the Discord webhook. It reads `process.env` only, so load the production env files first |
| `setup-monitoring.ts` | `bun run setup:monitoring` | Monitoring setup |
