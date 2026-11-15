# Prisma 6 → 7 migration plan (2026-11-11)

Branch `deps/prisma-7`, cut from rose-garden `ad2722f84`, merged into rose-garden on 2026-11-11 at the owner's word.
It ships with the rest of the November dependency sweep ([runbook](deploy-dependencies-2026-11.md)).

## Why it is its own branch

Prisma 7 removes the query engine. Every client connects through a driver adapter (`@prisma/adapter-pg`, on `pg`), so
the production connection pool, its timeouts and its SSL handling become `pg`'s. No table or column changes, and
no data script, but every query takes a new path to the database.

Prisma 8 is at release candidate, and a Postgres app on Prisma 6 can go straight to it. Doing 7 now means a second,
smaller step later; waiting means staying on 6, which keeps getting fixes for now.

## What changes

| Area | Prisma 6 | Prisma 7 (this branch) |
| --- | --- | --- |
| Connection | engine reads `DATABASE_URL` | `pg` pool built in `src/server/prisma-client.ts` |
| Client construction | `new PrismaClient()` (128 files) | `createPrismaClient({ url? })`; `db.ts` and `scripts/perf/atlas-bench-client.ts` pass `adapter: prismaAdapter()` |
| Schema `datasource` | `url = env("DATABASE_URL")` | no URL; `prisma.config.ts` holds `datasource.url` |
| Generator | `prisma-client-js` | unchanged; still generates into `node_modules/@prisma/client`, so the 838 imports stay |
| Env loading by the CLI | automatic | none; `prisma.config.ts` already loads `.env*` itself |

### The pool, kept as Prisma 6 had it

`pg` ignores Prisma's URL parameters, so `poolConfigFor()` reads and drops them:

- `connection_limit` → `max` (default cores × 2 + 1, Prisma 6's default; `pg` alone would use 10)
- `pool_timeout` / `connect_timeout` → `connectionTimeoutMillis`, the longer of the two (default 10 s; `pg` alone
  waits forever). `pg` has one wait where Prisma had two.
- `schema` → the adapter's `schema` option
- `socket_timeout`, `pgbouncer`, `statement_cache_size` → dropped

`src/tests/server/prisma-client.test.ts` pins the mapping.

## Steps

1. **Done on the branch**:
   - packages: `prisma`, `@prisma/client`, `@prisma/config` 7.10.1, and `@prisma/adapter-pg`
   - the datasource URL moved into `prisma.config.ts`
   - `src/server/prisma-client.ts` and its test
   - the codemod over every `new PrismaClient(...)` (src, scripts, prisma seeds, archived scripts)
   The test setup changed too:
   - Prisma 7's runtime `Prisma.dmmf` keeps only names and types, so a Jest `globalSetup`
     (`src/tests/helpers/dmmf-global-setup.ts`, via `@prisma/internals`) writes the full datamodel once per run for
     the in-memory client (`memory-prisma.ts`) and the schema-default tests.
   - `setupTests.ts` shims `TextEncoder` for `pg` under Jest's jsdom window.
   - The three DB tests that build a client inside `jest.mock` require the helper there.
   - Prisma 7's Studio brings `@types/d3-delaunay`, so it is now declared, and worldgen's two `@ts-expect-error`
     lines are gone.
2. **Gates, done 2026-11-11**:
   - all six typechecks clean except the five exchange errors and the `market.test.ts` context error already on
     `ad2722f84`, which rose-garden has since fixed
   - full Jest green (951 suites), `check:script-imports` green, the changed files lint clean
3. **Real-database checks, done 2026-11-11**:
   - **Scenarios on `ixstats_scenarios`:** 9 failing suites on Prisma 7 against 10 on Prisma 6. Every failure is the
     scratch database's schema lagging (`categoryNeedsReview` missing), not the driver.
   - **PostGIS tiles on `ixstats_wv1` (`TILES_DB_URL`):** 9/9 on both.
   - **`next dev` on :3100 against `ixstats_wv1`:** `/`, `/countries`, a country page, `/api/health` and
     `countries.getAll` all answer 200, with no database errors in the log.
   - **Still owed:** a signed-in browser pass (MyCountry, the Vault, a cards market buy as the interactive
     transaction) and `bun run db:push:force` on `ixstats_scenarios` to bring the scratch schema up to date (it asks
     for `--accept-data-loss`, so the owner decides).
4. **Merged 2026-11-11**: package.json took rose-garden's side with the Prisma lines re-added, `bun.lock` was
   regenerated, and `setupTests.ts` keeps both sides' shims.

## Risks to check before merging

- **Raw query results**: the adapter maps column types in `$queryRaw`. Check `bigint`, `numeric`/`Decimal`,
  `timestamptz` and PostGIS `geometry` (as GeoJSON text) against Prisma 6's output.
- **SSL**: `pg` validates certificates where the engine did not. The local and production databases are on
  localhost without SSL, so nothing changes today. A remote database with a self-signed certificate would need
  `ssl: { rejectUnauthorized: false }`.
- **Errors**: connection failures arrive as `DriverAdapterError` causes inside Prisma errors. `prismaErrorToAppError`
  (`src/lib/prisma-error.ts`) maps by `code` and should keep working; confirm with a stopped database.
- **Preview features**: `relationJoins` and `nativeDistinct` still generate without warnings on 7.10.1.

## Deploy (when merged)

1. Node 22 is already a prerequisite of the dependency sweep.
2. Clean `node_modules`, then `./scripts/deploy-production.sh`. `bun install` runs `prisma generate` (postinstall).
   No migration, no `db push` change.
3. Watch `pg_stat_activity` for the pool size after the reload: about `connection_limit` connections per process.
4. **Rollback**: deploy the previous release. Nothing in the database changed.
