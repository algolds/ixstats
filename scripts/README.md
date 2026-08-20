# IxStates Scripts & Tooling Catalog

Authoritative index for all active build, deployment, database, audit, diagnostic, and linguistic scripts in `scripts/`. Historical one-off migrations and GIS dataset pipelines are preserved in [`scripts/archive/`](archive/) for reference and reuse.

---

## 🛠️ Active Scripts Directory Structure

```
scripts/
├── README.md                     # Single authoritative index (this document)
├── audit/                        # Architecture guard (audit-arch.ts) & test validation suites
├── setup/                        # Database seeders, init, backups, asset generators
├── deployment/                   # Production & staging deployment pipelines
├── diagnostics/                  # Health check & benchmark scripts
├── onoma/                        # Linguistics lexicon & Kokoro TTS dictionary tools
├── ops/                          # Nginx & server configuration templates
├── *.sh / *.js / *.ts            # Core root runners (with-base-path.sh, deploy-production.sh, etc.)
└── archive/                      # Historical migrations, one-off backfills, and GIS tools
    ├── migrations/               # Completed database backfills, user role seeds, title fixes
    ├── gis_tools/                # Historical SVG-to-GeoJSON scripts, metrics calculators
    └── geojson_dumps/            # Static GeoJSON pipeline dumps
```

---

## 📦 Build, Versioning & Deployment

| Script | Purpose & Usage |
| :--- | :--- |
| [`scripts/write-build-version.js`](write-build-version.js) | **Prebuild Hook**: Reads git short SHA and writes `src/lib/buildVersion.generated.ts`. |
| [`scripts/with-base-path.sh`](with-base-path.sh) | Wraps Next.js build/start with the `/projects/ixstates` production basePath. |
| [`scripts/post-build.sh`](post-build.sh) | **Postbuild Hook**: Copies standalone public assets and ensures standalone directory parity. |
| [`scripts/deploy-production.sh`](deploy-production.sh) | Full production deployment script (build, postbuild, PM2 reload, asset sync). |
| [`scripts/start-production.js`](start-production.js) | Production server runner for standalone Next.js + Socket.IO server. |
| [`scripts/deploy-ixworld.sh`](deploy-ixworld.sh) | Maps standalone build runner (`NEXT_PUBLIC_IXWORLD_STANDALONE=true`). |
| [`scripts/dev-local.sh`](dev-local.sh) / [`deploy-local.sh`](deploy-local.sh) | Local Linux development and staging runners. |
| [`scripts/start-auto.sh`](start-auto.sh) | Automatic environment-detecting dev runner. |
| [`scripts/validate-server-config.sh`](validate-server-config.sh) | Validates server environment variables, port bindings, and Redis connectivity. |

---

## 🛡️ Architecture & Verification Guards

| Script | Purpose & Command |
| :--- | :--- |
| [`scripts/audit/audit-arch.ts`](audit/audit-arch.ts) | **Architecture Guard**: Enforces ≤700L ceiling per router file and blocks cross-router imports (`bun run audit:arch`). |
| [`scripts/split-router-template.ts`](split-router-template.ts) | **ts-morph Router Splitter**: AST-based code splitter for refactoring oversized flat routers into `mergeRouters` subdirs. |
| [`scripts/verify-router-splits.ts`](verify-router-splits.ts) | **AST Parity Verifier**: Validates procedure count parity before and after router domain splits. |
| [`scripts/audit/audit-trpc-wiring.ts`](audit/audit-trpc-wiring.ts) | Validates that all 1,450+ tRPC procedures are wired to live implementations (`bun run audit:wiring`). |
| [`scripts/audit/verify-economic-calculations.ts`](audit/verify-economic-calculations.ts) | Validates economic modeling formulas, ERI, and tax calculations (`bun run test:economics`). |
| [`scripts/audit/verify-database-integrity.ts`](audit/verify-database-integrity.ts) | Exercises CRUD queries across all 296 Prisma models (`bun run test:db`). |
| [`scripts/audit/test-all-crud-operations.ts`](audit/test-all-crud-operations.ts) | Comprehensive CRUD regression test suite (`bun run test:crud`). |
| [`scripts/audit/test-api-health.ts`](audit/test-api-health.ts) | Live API endpoint health checker (`bun run test:health`). |
| [`scripts/audit/run-all-tests.ts`](audit/run-all-tests.ts) | Unified test runner for all audit suites (`bun run test:all`). |
| [`scripts/audit-flag-urls.ts`](audit-flag-urls.ts) | Audits and validates country flag URLs against MediaWiki endpoints (`bun run audit:flags`). |
| [`scripts/audit-production-urls.ts`](audit-production-urls.ts) | Validates production route 200 HTTP responses (`bun run audit:urls`). |
| [`scripts/prod-audit.ts`](prod-audit.ts) | Deep production readiness audit suite. |

---

## 🗄️ Database & Environment Setup (`scripts/setup/`)

| Script | Purpose & Command |
| :--- | :--- |
| [`scripts/setup/init-db.ts`](setup/init-db.ts) | Initializes database tables and seed prerequisites (`bun run db:init`). |
| [`scripts/setup/seed-db.ts`](setup/seed-db.ts) | Primary database seeder for countries, government structures, and initial users (`bun run db:seed`). |
| [`scripts/setup/backup-db.ts`](setup/backup-db.ts) | Backs up local PostgreSQL database into timestamped JSON/SQL (`bun run db:backup`). |
| [`scripts/setup/restore-db.ts`](setup/restore-db.ts) | Restores PostgreSQL database from backup (`bun run db:restore`). |
| [`scripts/setup/seed-sports-standalone.ts`](setup/seed-sports-standalone.ts) | Seeds standalone sports leagues, clubs, and schedules (`bun run db:seed:sports`). |
| [`scripts/setup/seed-vault-items.ts`](setup/vault-items.ts) | Seeds cards, card packs, and store perks. |
| [`scripts/setup/generate-pack-assets.ts`](setup/generate-pack-assets.ts) | Generates SVG pack art and foil textures for card packs. |
| [`scripts/setup-redis.sh`](setup-redis.sh) | Docker Redis manager (`bun run redis:start`, `redis:stop`, `redis:stats`). |
| [`scripts/sync-system-owner-roles.ts`](sync-system-owner-roles.ts) | Synchronizes system-owner privileges across Clerk and Postgres (`bun run sync:owners`). |
| [`scripts/set-admin-role.ts`](set-admin-role.ts) | Grants administrative privileges to a target user (`bun run set-admin-role`). |
| [`scripts/cleanup-logs.ts`](cleanup-logs.ts) | Rotates and prunes stale audit logs (`bun run cleanup:logs`). |
| [`scripts/watch-schema.sh`](watch-schema.sh) | File watcher for auto-generating Prisma client on schema change (`bun run db:watch`). |

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
- **`migrate-messages-to-thinkshare.ts`**: ETL migration script that transformed legacy direct message rows into unified `ThinkPost` / `DirectMessage` conversations.
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
- Intermediate GeoJSON outputs (`altitudes.geojson`, `climate.geojson`, `rivers.geojson`, `political.geojson`, `lakes.geojson`) from legacy GIS conversion passes.
