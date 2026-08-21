# Production Tooling & Deployment Architecture

**Plan 168 Decision Record & Static Operator Contract**

## Canonical Production Pipeline

The repository consolidates production deployment tooling behind a single canonical deployment pipeline:

- **Canonical Deployment Script**: [`scripts/deploy-production.sh`](../deploy-production.sh)
- **Local Trigger / Remote Deploy**: [`scripts/deploy-local.sh`](../deploy-local.sh)
- **Production Start Command**: `bun run start:prod` (invokes `start-production.sh`)

## Operator Decisions & Decisions Record (2026-08-20)

1. **Canonical Production Entrypoint**:
   - `scripts/deploy-production.sh` is the sole authoritative production deployment entrypoint.
   - Stale/duplicate entrypoints (such as legacy `scripts/deployment/deploy-to-production.sh`) are deprecated and removed from active package aliases (`deploy:production` pruned).

2. **Process Ownership Strategy**:
   - Production service lifecycle is managed on the VPS via PM2 (`pm2 startOrReload ecosystem.config.cjs`).
   - Maps standalone instance is managed via `ecosystem.ixworld.config.cjs`.
   - Node process runs standalone on port 3550 with basePath `/projects/ixstates`.

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
