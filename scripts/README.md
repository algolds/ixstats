# IxStates Scripts & Tooling Catalog

Authoritative index for all active build, deployment, database, audit, diagnostic, and linguistic scripts in `scripts/`. Historical one-off migrations and GIS dataset pipelines are preserved in [`scripts/archive/`](archive/) for reference and reuse.

---

## 🛠️ Active Scripts Directory Structure

```
scripts/
├── README.md                     # Single authoritative index (this document)
├── audit/                        # Architecture guard (audit-arch.ts) & test validation suites (see audit/README.md)
├── bench/                        # WikiOS vs MediaWiki benchmark (wikios-bench.ts) and its default page list
├── lib/                          # Shared helpers for the WikiOS bench/parity/round-trip scripts (wikios-harness.ts)
├── verification/                 # CI gates: partitioned typecheck runner, Jest quarantine runner, entrypoint check, verify-strict
├── docs/                         # Reference-doc synchronizer (docs:sync / docs:check)
├── setup/                        # Database seeders, init, backup/restore, asset generators, Clerk/auth checks
├── deployment/                   # Staging/rollback/validation tooling (see deployment/README.md)
├── diagnostics/                  # Health check, benchmark, cache and DB analysis scripts (diagnostics:*)
├── cron/                         # Cron job checker (cron:check)
├── codemods/                     # One-shot codemods (hex-to-tokens, facet-anti-slop)
├── onoma/                        # Linguistics lexicon & Kokoro TTS dictionary tools
├── ops/                          # Nginx & server configuration templates
├── realms/                       # Realms data backfill (owners, IxWorld slug, wiki links, visibility) + realm lore index import
├── migrations/                   # One-off data migrations (dry run by default, --apply writes)
├── reports/                      # Generated report outputs
├── *.sh / *.js / *.ts            # Core root runners (with-base-path.sh, deploy-production.sh, wiki sync, etc.)
└── archive/                      # Historical migrations, one-off backfills, and GIS tools
    ├── migrations/               # Completed database backfills, user role seeds, title fixes
    ├── gis_tools/                # Historical SVG-to-GeoJSON scripts, metrics calculators
    └── geojson_dumps/            # Static GeoJSON pipeline dumps (git-ignored; local only)
```

---

## 📦 Build, Versioning & Deployment

| Script | Purpose & Usage |
| :--- | :--- |
| [`scripts/write-build-version.js`](write-build-version.js) | **Prebuild Hook**: Reads git short SHA and writes `src/lib/buildVersion.generated.ts`. |
| [`scripts/with-base-path.sh`](with-base-path.sh) | Wraps Next.js build/start with the `/projects/ixstates` production basePath. |
| [`scripts/post-build.sh`](post-build.sh) | **Postbuild Hook**: Copies standalone public assets and ensures standalone directory parity. |
| [`scripts/deploy-production.sh`](deploy-production.sh) | Full production deployment script (`db:backup` before the schema sync — aborts if the dump fails — then build, postbuild, PM2 reload, asset sync). |
| [`scripts/start-production.js`](start-production.js) | Legacy production startup script (not wired to any `package.json` alias; `bun run start:prod` uses the root `start-production.sh`, `bun run start` uses `server.mjs`). |
| [`scripts/deploy-ixworld.sh`](deploy-ixworld.sh) | Maps standalone build runner (`NEXT_PUBLIC_IXWORLD_STANDALONE=true`). |
| [`scripts/dev-local.sh`](dev-local.sh) | WSL local dev (`bun run dev:local`): SSH tunnels, prod DB snapshot into the local `ixstats-postgres` container, asset rsync, then `start-development.sh`. |
| [`scripts/deploy-local.sh`](deploy-local.sh) | `bun run deploy:local`: local format/lint/test checks, push the current branch, then run `deploy-production.sh` on the VPS over SSH. |
| [`scripts/refresh-local-db.sh`](refresh-local-db.sh) | Refresh the local Postgres container from a production `pg_dump`. |
| [`scripts/start-auto.sh`](start-auto.sh) | Automatic environment-detecting dev runner. |
| [`scripts/validate-server-config.sh`](validate-server-config.sh) | Validates server environment variables, port bindings, and Redis connectivity. |

---

## 🛡️ Architecture & Verification Guards

| Script | Purpose & Command |
| :--- | :--- |
| [`scripts/audit/audit-arch.ts`](audit/audit-arch.ts) | **Architecture Guard**: Enforces ≤700L ceiling per file (500L for hooks; ratcheted via `arch-baseline.json`), blocks cross-router imports, server boundary leaks, and residue (`bun run audit:arch`). |
| [`scripts/docs/sync-reference-docs.ts`](docs/sync-reference-docs.ts) | **Reference Docs Synchronizer**: Synchronizes AST-derived API inventory and version matrix across canonical docs (`bun run docs:sync` / `bun run docs:check`). |
| [`scripts/audit/validate-script-targets.ts`](audit/validate-script-targets.ts) | **Script Target Validator**: Validates script paths, configs, and Bun package-manager usage (`bun run validate:script-targets`). |
| [`scripts/split-router-template.ts`](split-router-template.ts) | **ts-morph Router Splitter**: AST-based code splitter for refactoring oversized flat routers into `mergeRouters` subdirs. |
| [`scripts/verify-router-splits.ts`](verify-router-splits.ts) | **AST Parity Verifier**: One-off parity check for a fixed list of past splits (admin, sports, activities, security, ixnayid); the splitter now verifies parity itself. |
| [`scripts/audit/audit-trpc-wiring.ts`](audit/audit-trpc-wiring.ts) | Cross-references Prisma models against tRPC router endpoints (77 routers, ~900 procedures) and reports coverage gaps (`bun run audit:wiring`). |
| [`scripts/audit/audit-country-idor.ts`](audit/audit-country-idor.ts) | Country-ownership (IDOR) check on country-data mutations (`bun run audit:idor`). |
| [`scripts/verification/run-typecheck.ts`](verification/run-typecheck.ts) | Partitioned typecheck runner behind `typecheck:ui` / `:server` / `:trpc` / `:db`. |
| [`scripts/verification/run-jest-with-quarantine.ts`](verification/run-jest-with-quarantine.ts) | CI Jest runner honouring `test-quarantine.json` (`bun run test:ci`, `test:quarantine:verify`). |
| [`scripts/verification/check-entrypoints.ts`](verification/check-entrypoints.ts) | Client/server entrypoint boundary check (`bun run check:entrypoints`). |
| [`scripts/audit/verify-economic-calculations.ts`](audit/verify-economic-calculations.ts) | Validates economic modeling formulas, ERI, and tax calculations (`bun run test:economics`). |
| [`scripts/audit/verify-database-integrity.ts`](audit/verify-database-integrity.ts) | Checks referential integrity, indexes, and record counts (`bun run test:db`). |
| [`scripts/audit/test-all-crud-operations.ts`](audit/test-all-crud-operations.ts) | Comprehensive CRUD regression test suite (`bun run test:crud`). |
| [`scripts/audit/test-api-health.ts`](audit/test-api-health.ts) | Live API endpoint health checker (`bun run test:health`). |
| [`scripts/audit/run-all-tests.ts`](audit/run-all-tests.ts) | Unified test runner for all audit suites (`bun run test:all`). |
| [`scripts/audit-flag-urls.ts`](audit-flag-urls.ts) | Audits and validates country flag URLs against MediaWiki endpoints (`bun run audit:flags`). |
| [`scripts/audit-production-urls.ts`](audit-production-urls.ts) | Validates production route 200 HTTP responses (`bun run audit:urls`). |
| [`scripts/prod-audit.ts`](prod-audit.ts) | Deep production readiness audit suite. |
| [`scripts/bench/wikios-bench.ts`](bench/wikios-bench.ts) | **WikiOS vs MediaWiki speed**: times article page, `wikios.getArticleHtml`, search and history on both systems (p50/p75, cold/warm, script/CSS weight) over `bench/pages.default.json`; throttled, `IxStats-Builder` UA; `--mw` is required, output goes to `.bench-out/` (git-ignored). `bun scripts/bench/wikios-bench.ts --mw <MediaWiki URL> --wikios http://localhost:3000`. |
| [`scripts/audit/wikios-render-parity.ts`](audit/wikios-render-parity.ts) | **WikiOS render parity**: scores WikiOS HTML against MediaWiki `action=parse` per page (text, links, images, headings, tables, infobox) and lists the templates on the lowest-scoring pages. `--mw-api` is required; output goes to `.bench-out/`. `bun scripts/audit/wikios-render-parity.ts --mw-api <MediaWiki api.php URL> --wikios http://localhost:3000`. |
| [`scripts/audit/wikios-roundtrip.ts`](audit/wikios-roundtrip.ts) | **Visual-editor round trip**: runs each page's wikitext (local DB, read-only, or MediaWiki) through the editor's load/save pipeline without edits and reports byte-identical share, skipped pages and changed lines by construct; output goes to `.bench-out/`. `bun scripts/audit/wikios-roundtrip.ts --source db --limit 20`. |

---

## 🌐 Realms (`scripts/realms/`)

| Script | Purpose & Command |
| :--- | :--- |
| [`scripts/realms/backfill-foundation.ts`](realms/backfill-foundation.ts) | Realms Phase 1 data backfill (owners, IxWorld slug, ixwiki link rows, visibility, map layers with no realm → IxWorld). Dry run by default; `--apply` writes. Run after `db:push:force`, before deploying the realms-foundation code (`bun scripts/realms/backfill-foundation.ts [--apply]`). |
| [`scripts/realms/backfill-plan.ts`](realms/backfill-plan.ts) | Pure planning helper for the owner-backfill step above (`planOwnerBackfill`) — never guesses on multi-user collisions, reports them for manual resolution. |
| [`scripts/realms/import-realm-lore.ts`](realms/import-realm-lore.ts) | One-time realm lore **index** import (titles only, never content): crawls a wiki category tree (keyword subcategories only, depth 5, 5,000-page cap, truncation reported), takes nations from a curated roster category (`--nation-roster`, one subcategory per nation; retired rosters refused) or, without one, from pages whose lead uses `Infobox country`/`Infobox former country`, and writes `RealmPage` rows. Dry run (the preview) by default; `--apply` writes. Needs the realm to exist first (`/admin/realms` → New realm). `bun scripts/realms/import-realm-lore.ts --realm eurth --source iiwiki --category "Category:Eurth" --keyword Eurth --nation-roster "Category:Countries (Eurth)" [--apply]` |

---

## 🔁 Data Migrations (`scripts/migrations/`)

| Script | Purpose & Command |
| :--- | :--- |
| [`scripts/migrations/mark-match-revenue-collected.ts`](migrations/mark-match-revenue-collected.ts) | `bun run db:mark-match-revenue-collected [-- --apply]` — one-off SL-14 fix: marks matches completed before per-match revenue tracking as collected, so the first `collectMatchRevenue` after the deploy doesn't pay a club's whole history. Dry run by default; run once after the schema push. |
| [`scripts/migrations/remap-budget-years.ts`](migrations/remap-budget-years.ts) | `bun run db:remap-budget-years [-- --apply]` — one-off MC-1 fix: shifts `BudgetAllocation.budgetYear` rows still on real-calendar years (≤ 2035) onto the IxTime basis (`currentBudgetYear()`) by the constant offset `ixYear − realYear`. Dry run by default (prints the year mapping and conflicts); `--apply` writes in one transaction. Take a `db:backup` first. |
| [`scripts/migrations/budget-year-remap-plan.ts`](migrations/budget-year-remap-plan.ts) | Pure planner for the remap above (`planBudgetYearRemap`); a target year the department already holds is reported, never overwritten. |

---

## 🗄️ Database & Environment Setup (`scripts/setup/`)

| Script | Purpose & Command |
| :--- | :--- |
| [`scripts/setup/init-db.ts`](setup/init-db.ts) | Initializes database tables and seed prerequisites (`bun run db:init`). |
| [`scripts/setup/seed-db.ts`](setup/seed-db.ts) | Primary database seeder for countries, government structures, and initial users (`bun run db:seed`). |
| [`scripts/setup/backup-db.ts`](setup/backup-db.ts) | `bun run db:backup [-- --keep 14] [--dir backups] [--no-docker]` — `pg_dump -Fc` (via the `ixstats-postgres` container when it is running, else `DATABASE_URL`) to `backups/ixstats-<UTC timestamp>.dump`, then prunes to the newest N. Non-zero exit on failure. Run by `deploy-production.sh` before `db push` and by the `db-backup` cron job. |
| [`scripts/setup/restore-db.ts`](setup/restore-db.ts) | `bun run db:restore [-- <file> [--yes] [--i-know-this-is-production] [--no-docker]]` — lists `backups/`; with a file, prints the `pg_restore --clean --if-exists --no-owner` plan and runs it only with `--yes`. Refused under `NODE_ENV=production` without `--i-know-this-is-production`. |
| [`scripts/setup/seed-sports-standalone.ts`](setup/seed-sports-standalone.ts) | Seeds standalone sports leagues, clubs, and schedules (`bun run db:seed:sports`). |
| [`scripts/setup/seed-vault-items.ts`](setup/seed-vault-items.ts) | Seeds cards, card packs, and store perks. |
| [`scripts/setup/generate-pack-assets.ts`](setup/generate-pack-assets.ts) | Generates SVG pack art and foil textures for card packs. |
| [`scripts/setup-redis.sh`](setup-redis.sh) | Docker Redis manager (`bun run redis:start`, `redis:stop`, `redis:stats`). |
| [`scripts/sync-system-owner-roles.ts`](sync-system-owner-roles.ts) | Synchronizes system-owner privileges across Clerk and Postgres (`bun run sync:owners`). |
| [`scripts/set-admin-role.ts`](set-admin-role.ts) | Grants administrative privileges to a target user (`bun run set-admin-role`). |
| [`scripts/cleanup-logs.ts`](cleanup-logs.ts) | Rotates and prunes stale audit logs (`bun run cleanup:logs`). |
| [`scripts/watch-schema.sh`](watch-schema.sh) | File watcher for auto-generating Prisma client on schema change (`bun run db:watch`). |

---

## 📚 Wiki Sync (root)

| Script | Command |
| :--- | :--- |
| [`scripts/sync-ixwiki-full.ts`](sync-ixwiki-full.ts) / [`sync-ixwiki-live.ts`](sync-ixwiki-live.ts) / [`sync-ixwiki-media.ts`](sync-ixwiki-media.ts) | `bun run wiki:sync:full` / `wiki:sync:live` / `wiki:sync:media` — IxWiki → WikiOS PostgreSQL sync. |
| [`scripts/sync-wikios-categories.ts`](sync-wikios-categories.ts) | `bun run wiki:seed:categories` |
| [`scripts/cleanup-wikios-categories.ts`](cleanup-wikios-categories.ts) / [`cleanup-wikios-sync-summaries.ts`](cleanup-wikios-sync-summaries.ts) | `bun run wiki:clean:categories` / `wiki:clean:summaries` |

---

## 🗣️ Linguistics & Onoma Lexicon (`scripts/onoma/`)

| Script | Purpose & Usage |
| :--- | :--- |
| [`scripts/onoma/build-dicts.ts`](onoma/build-dicts.ts) | Compiles syllable frequency tables and Markov phonetic dictionaries. |
| [`scripts/onoma/extract-lexicon.ts`](onoma/extract-lexicon.ts) | Extracts real worldbuilding lexicons from MediaWiki corpus for language modeling. |
| [`scripts/onoma/kokoro-vocab-oracle.ts`](onoma/kokoro-vocab-oracle.ts) | Tests vocabulary coverage against Kokoro TTS phoneme tables. |
| [`scripts/onoma/audition-voice.ts`](onoma/audition-voice.ts) | Command-line CLI tool for testing Kokoro audio generation. |

---

## 🗃️ Historical Archive (`scripts/archive/`) — Preserved for Future Reuse

The [`scripts/archive/`](archive/) directory preserves one-off migration scripts, data backfill algorithms, and GIS conversion tools from earlier milestones. If similar bulk data transformations or GIS ingest tasks are needed in the future, reference these implementations:

### 1. Database Migrations & One-Off Backfills (`scripts/archive/migrations/`)
- **`migrate-messages-to-thinkshare.ts`**: ETL migration script that transformed legacy direct message rows into ThinkShare conversations (`ThinkshareConversation` / `ThinkshareMessage`).
- **`backfill-vault-effects.ts` / `backfill-government-branches.ts` / `backfill-geo-links.ts` / `backfill-ixtwitter.ts`**: Backfill algorithms linking atomic components, government branches, and social activity to Prisma models.
- **`fix-baseline-dates.ts` / `restore-baselines.ts`**: Time-series timestamp correction utilities.
- **`sync-wiki-flags.ts` / `regenerate-flag-metadata.ts`**: MediaWiki SVG flag scrapers and metadata parsers.
- **`setup-system-owner-access.ts` / `setup-dual-user-access.ts` / `link-dev-user-to-country.ts`**: Development tenant and user-linking helpers.
- **`maintenance/`**: Title update scripts (`fix-page-titles.ts`, `add-client-titles.ts`) and military DB generators (`generate-military-db.js`).
- **`migrations/`**: Slug generators (`generate-country-slugs.ts`), altitude metadata enhancers, and PostGIS trigger setup (`setup-map-triggers.ts`).

### 2. GIS Conversion Tools & Spatial Math (`scripts/archive/gis_tools/`)
- **`country-geo-report.ts`**: Spatial analyzer computing land area, coastline lengths, bounding boxes, and neighboring borders from PostGIS polygons.
- **`align-political-to-terrain.ts` / `split-geo.ts` / `diagnostic-borders.ts`**: Polygon alignment and boundary clipping tools.
- **`calculate-scale-factor.ts` / `calculate-ixearth-metrics.ts`**: Affine coordinate transformation calculators for pixel-to-WGS84 projection mapping.
- **`rebuild-adjacency.ts`**: Computes spatial border adjacency graphs from PostGIS geometry intersections.
- **`export-world-template.ts` / `import-world-template.ts` / `import-political-update.ts`**: JSON template import/export tools for realm geography.
- **`reprocess-icecaps.ts`**: Glacial polygon simplification and antimeridian splitting utility.

### 3. Static GIS Pipeline Dumps (`scripts/archive/geojson_dumps/`)
- Intermediate GeoJSON outputs (`altitudes.geojson`, `climate.geojson`, `rivers.geojson`, `political.geojson`, `lakes.geojson`) from legacy GIS conversion passes. This directory is git-ignored and exists only on machines that produced it.
