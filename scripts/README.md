# IxStates Scripts & Tooling Catalog

Authoritative index for all active build, deployment, database, audit, diagnostic, and linguistic scripts in `scripts/`. Historical one-off migrations and GIS dataset pipelines are preserved in [`scripts/archive/`](archive/) for reference and reuse.

---

## 🛠️ Active Scripts Directory Structure

```
scripts/
├── README.md                     # Single authoritative index (this document)
├── audit/                        # Architecture guard (audit-arch.ts) & test validation suites (see audit/README.md)
├── bench/                        # WikiOS vs MediaWiki benchmark (wikios-bench.ts) and its default page list
├── lib/                          # Shared helpers: WikiOS bench/parity/round-trip (wikios-harness.ts), env loading, the migrations' production and local-only database guards (database-guard.ts)
├── verification/                 # CI gates: partitioned typecheck runner, Jest quarantine runner, entrypoint check, verify-strict
├── docs/                         # Reference-doc synchronizer (docs:sync / docs:check)
├── setup/                        # Database seeders, init, backup/restore, asset generators, Clerk/auth checks
├── deployment/                   # Staging/rollback/validation tooling (see deployment/README.md)
├── diagnostics/                  # Health check, benchmark, cache and DB analysis scripts (diagnostics:*)
├── cron/                         # Cron job checker (cron:check)
├── perf/                         # Atlas acceptance benchmark: Release 0 and the world generator (atlas-bench.ts, perf:atlas)
├── codemods/                     # One-shot codemods (facet-anti-slop)
├── onoma/                        # Linguistics lexicon & Kokoro TTS dictionary tools
├── ops/                          # Nginx & server configuration templates
├── realms/                       # Realms data backfill (owners, Ixnay slug, wiki links, visibility) + realm lore index import
├── cards/                        # Cards refresh one-offs (dry run by default, --apply writes)
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
| [`scripts/docs/sync-reference-docs.ts`](docs/sync-reference-docs.ts) | **Reference Docs Synchronizer**: Synchronizes the AST-derived API inventory, version matrices and inline `BEGIN_DOCS:COUNT:<key>` counts (routers, procedures, schema files, models, enums, migrations), and checks relative links and `#anchors` in every tracked `docs/**`, `README.md`, `CHANGELOG.md`, `scripts/**/README.md`, `src/**/README.md` and `src/content/**` markdown file (`bun run docs:sync` / `bun run docs:check`). |
| [`scripts/audit/validate-script-targets.ts`](audit/validate-script-targets.ts) | **Script Target Validator**: Validates script paths, configs, and Bun package-manager usage (`bun run validate:script-targets`). |
| [`scripts/split-router-template.ts`](split-router-template.ts) | **ts-morph Router Splitter**: AST-based code splitter for refactoring oversized flat routers into `mergeRouters` subdirs; runs its own AST parity check after each split. |
| [`scripts/audit/audit-trpc-wiring.ts`](audit/audit-trpc-wiring.ts) | Cross-references Prisma models against tRPC router endpoints (77 routers, ~900 procedures) and reports coverage gaps (`bun run audit:wiring`). |
| [`scripts/audit/audit-country-idor.ts`](audit/audit-country-idor.ts) | Country-ownership (IDOR) check on country-data mutations (`bun run audit:idor`). |
| [`scripts/verification/run-typecheck.ts`](verification/run-typecheck.ts) | Partitioned typecheck runner behind `typecheck:ui` / `:server` / `:trpc` / `:db`. |
| [`scripts/verification/run-jest-with-quarantine.ts`](verification/run-jest-with-quarantine.ts) | CI Jest runner honouring `test-quarantine.json` (`bun run test:ci`, `test:quarantine:verify`). |
| [`scripts/verification/check-entrypoints.ts`](verification/check-entrypoints.ts) | Client/server entrypoint boundary check (`bun run check:entrypoints`). |
| [`scripts/audit-flag-urls.ts`](audit-flag-urls.ts) | Audits and validates country flag URLs against MediaWiki endpoints (`bun run audit:flags`). |
| [`scripts/audit-production-urls.ts`](audit-production-urls.ts) | Validates production route 200 HTTP responses (`bun run audit:urls`). |
| [`scripts/prod-audit.ts`](prod-audit.ts) | Deep production readiness audit suite. |
| [`scripts/bench/wikios-bench.ts`](bench/wikios-bench.ts) | **WikiOS vs MediaWiki speed**: times article page, `wikios.getArticleHtml`, search and history on both systems (p50/p75, cold/warm, script/CSS weight) over `bench/pages.default.json`; throttled, `IxStats-Builder` UA; `--mw` is required, output goes to `.bench-out/` (git-ignored). `bun scripts/bench/wikios-bench.ts --mw <MediaWiki URL> --wikios http://localhost:3000`. |
| [`scripts/audit/wikios-render-parity.ts`](audit/wikios-render-parity.ts) | **WikiOS render parity**: scores WikiOS HTML against MediaWiki `action=parse` per page (text, links, images, headings, tables, infobox) and lists the templates on the lowest-scoring pages. `--mw-api` is required; output goes to `.bench-out/`. `bun scripts/audit/wikios-render-parity.ts --mw-api <MediaWiki api.php URL> --wikios http://localhost:3000`. |
| [`scripts/audit/wikios-roundtrip.ts`](audit/wikios-roundtrip.ts) | **Visual-editor round trip**: runs each page's wikitext (local DB, read-only, or MediaWiki) through the editor's load/save pipeline without edits and reports byte-identical share, skipped pages and changed lines by construct; output goes to `.bench-out/`. `bun scripts/audit/wikios-roundtrip.ts --source db --limit 20`. |

---

## ⏱️ Performance (`scripts/perf/`)

| Script | Purpose & Command |
| :--- | :--- |
| [`scripts/perf/atlas-bench.ts`](perf/atlas-bench.ts) | **Atlas acceptance: Release 0 and the Release A world generator** (`bun run perf:atlas`): measures the targets of the [Release 0 spec](../docs/specs/2026-10-11-atlas-release-0-performance-design.md#acceptance) against the local database and prints one `PASS`/`FAIL` line per target with the measured value and the limit (`INFO` lines print numbers with no target, such as the slowest drag frame and the deferred overlap check); exit code 1 if any fails. In process, no dev server: the layer and tile route handlers (cold build, cache hit and its event-loop time, `If-None-Match` 304, DB statements on a disk hit), `getCountryGeoProfile` for Caphiria with the tRPC cache bypassed, `ST_CoverageSimplify` on Ixnay's political layer, the border drag frame (gated on the 95th percentile after 5 warm-up frames) and the 50-drag autosave payload on the pure editor functions, and the region-reshape hook in jsdom (overlap checks while dragging, the overlap work in the mouse-up frame, and the check when idle). The generator (`atlas-bench-worldgen.ts`, two fresh child processes, no database): `generateWorld` for the Eurth preset at the default size (66,626 cells) gated on the [Release A](../docs/specs/2026-10-11-atlas-release-a-world-creation-design.md#generator-performance-in-this-release) targets (first generation in a cold process 1.0 s, slider change on the cached mesh 0.6 s and reroll 0.9 s, the last two the median of five), plus `INFO` lines for the worker's runner (`createWorldRunner`) end to end per message with its phase split. It cannot see a browser: a second `/maps` load is checked as the immutable URL and the 304 the layer route sends, not as a download that does not happen, and the reshape release frame is the overlap work in the mouse-up handler over a fake map, not a painted frame. Reads only: a final line fails the run if it issued any write statement. Tiles render into a temporary folder that is removed afterwards, never `MAP_TILE_DIR`. Reads `DATABASE_URL` as Bun loads `.env`; refuses a database that is not on this machine, or is named `ixstats` unless `--production` is passed. `bun run perf:atlas`. Parts: `atlas-bench-report.ts` (the table; its verdict rules are unit-tested in `src/tests/scripts/verification-gates.test.ts`), `-server.ts`, `-editor.ts`, `-reshape.ts`, `-worldgen.ts` (its measurements run in child processes of `atlas-bench.ts --worldgen-run direct|runner`), `-client.ts` (the Prisma client that counts statements; imported first). |

---

## 🌐 Realms (`scripts/realms/`)

| Script | Purpose & Command |
| :--- | :--- |
| [`scripts/realms/backfill-foundation.ts`](realms/backfill-foundation.ts) | Realms Phase 1 data backfill (owners, Ixnay slug, visibility, map layers with no realm → Ixnay). Dry run by default; `--apply` writes. Run after `db:push:force`, before deploying the realms-foundation code (`bun scripts/realms/backfill-foundation.ts [--apply]`). |
| [`scripts/realms/backfill-plan.ts`](realms/backfill-plan.ts) | Pure planning helper for the owner-backfill step above (`planOwnerBackfill`) — never guesses on multi-user collisions, reports them for manual resolution. |
| [`scripts/realms/import-realm-lore.ts`](realms/import-realm-lore.ts) | One-time realm lore **index** import (titles only, never content): crawls a wiki category tree (keyword subcategories only, depth 5, 5,000-page cap, truncation reported), takes nations from a curated roster category (`--nation-roster`, one subcategory per nation; retired rosters refused) or, without one, from pages whose lead uses `Infobox country`/`Infobox former country`, and writes `RealmPage` rows. Dry run (the preview) by default; `--apply` writes. Needs the realm to exist first (`/admin/realms` → New realm). `bun scripts/realms/import-realm-lore.ts --realm eurth --source iiwiki --category "Category:Eurth" --keyword Eurth --nation-roster "Category:Countries (Eurth)" [--apply]` |

---

## 🃏 Cards (`scripts/cards/`)

Cards refresh one-offs. Each is a dry run that prints its plan and writes nothing unless given `--apply`, and each is idempotent (a second run plans nothing). Production order: the [Phase 2 deploy runbook](../docs/systems/cards.md#phase-2-deploy-runbook-owner) (Phase 1's is in its plan). Phases 3 and 4 have no one-off script: Phase 4's SQL marks imported copies for the import share from the import ledger ([Phase 4 deploy runbook](../docs/systems/cards.md#phase-4-deploy-runbook-owner)). The card categories phase has two, in the order of its [deploy runbook](../docs/systems/cards.md#card-categories-deploy-runbook-owner).

| Script | Purpose & Command |
| :--- | :--- |
| [`scripts/cards/backfill-cards-refresh.ts`](cards/backfill-cards-refresh.ts) | Phase 1 backfill on the in-between schema (types, rarities, realms, finishes, serials, the NS import ledger), in one transaction. `deploy-production.sh` runs it with `--apply` between `20261027120000_cards_foundations` and its constraint SQL. Unknown types or rarities, and copies held as `quantity > 1`, fail the dry run (exit 1) and block `--apply`. `bun scripts/cards/backfill-cards-refresh.ts [--apply]`. Pure planner and shapes: `backfill-cards-refresh-plan.ts`, `backfill-cards-refresh-types.ts`. |
| [`scripts/cards/backfill-card-compliance.ts`](cards/backfill-card-compliance.ts) | Phase 2: brings legacy NationStates takedowns (`metadata.nsTakedown`) into the Compliance queue, records a licence for every Lore card with art and none (UNKNOWN, or with `--fetch` the licence its wiki states), and hides restricted art by a licence review takedown. Run `--apply --fetch` on the production server (IIWiki answers only there); `--apply` alone records UNKNOWN and leaves `--fetch` nothing to read. A `--fetch` run records no licence for a card its wiki did not answer for (a refusal or rate limit parks the wiki, a failed read loses one card), and prints how many per wiki: re-run it to read them. Run it before the Library is used. `bun scripts/cards/backfill-card-compliance.ts [--apply [--fetch]]`. |
| [`scripts/cards/import-special-cards.ts`](cards/import-special-cards.ts) | Phase 2: creates the five achievement reward Special cards if missing, points the old seed's rows at their achievement, and awards each live card to players who already hold its achievement. `bun scripts/cards/import-special-cards.ts [--apply]`. |
| [`scripts/cards/convert-lore-requests.ts`](cards/convert-lore-requests.ts) | Phase 2: old paid lore requests become free suggestions (approved requests not yet made go back to waiting, open ones get a realm). No refund. `bun scripts/cards/convert-lore-requests.ts [--apply]`. |
| [`scripts/cards/refund-lore-tokens.ts`](cards/refund-lore-tokens.ts) | Phase 2: refunds every unused lore request token a player bought at what they paid (a `REFUND` row keyed `retired_item_refund:<purchase id>`) and withdraws the token items from the store. Run it after `bun run audit:vault-exploits:apply`, with a `db:backup` first. `bun scripts/cards/refund-lore-tokens.ts [--apply]`. |
| [`scripts/cards/retire-seed-cards.ts`](cards/retire-seed-cards.ts) | Card categories: retires the six lore cards seeded on 2026-02-16 with no article (Battle of Corumm, Cathedral of Stars, History of Ixnay, Port of Alkharsis, The Great Migration, Treaty of Kiro; `src/lib/cards/seed-cards.ts`), one `CARD_HIDE` audit row each, in one transaction. Held copies stay, worth 0; a re-run retires and audits nothing. Run it before the categories backfill. `bun scripts/cards/retire-seed-cards.ts [--apply]`. |
| [`scripts/cards/backfill-card-categories.ts`](cards/backfill-card-categories.ts) | Card categories: classifies every lore card from its wiki's infoboxes and categories (`prop=categories\|templates`, 50 titles a request, one a second, every continuation followed), its title and excerpt. The dry run writes a report to `scripts/reports/card-categories-<stamp>.md` (and `.json`): distribution, confidence histogram, samples, low-confidence list, changes, Abandoned Lore cards, unmapped categories and infoboxes. `--apply` writes the classifier's columns (never over an admin-, realm-founder- or suggestion-set category; a category set before the phase has no source, so protect it first, as the runbook says), retires Abandoned Lore cards with a `CARD_HIDE` audit row, and deletes the old `metadata.category` labels only once every card was read. Retired cards are skipped. Resumable: answers are cached (`--cache`, default `scripts/reports/card-categories-cache.json`), and a wiki that stops leaves its cards for the next run. Run it on the production server, where IIWiki answers; in development IIWiki goes through the maps.ixwiki.com relay. `bun scripts/cards/backfill-card-categories.ts [--apply [--reclassify]] [--source <wiki>] [--threshold <0-1>] [--report <path.md>] [--cache <path>]`. |
| [`scripts/backfill-loreward-trophy-cards.ts`](backfill-loreward-trophy-cards.ts) | Mints a trophy card for every recorded Loreward place back to 2017 and gives each to the account holding the name's approved claim (or the WikiOS account behind a `wikios>` name), with no IxCredits; the rest wait for a claim. Run after the weekly merge. `bun scripts/backfill-loreward-trophy-cards.ts [--apply]`. |
| [`scripts/lorewards/merge-weekly-keys.ts`](lorewards/merge-weekly-keys.ts) | Moves every weekly Loreward row to its UTC ISO week key (`YYYY-Www`) and folds the date-keyed duplicates into one row per contest; a week whose rows disagree, were paid or carded twice, or hold an override or a row not approved is reported as skipped and left for an admin override. Dry run by default. `bun scripts/lorewards/merge-weekly-keys.ts [--apply]`. |

---

## 🔁 Data Migrations (`scripts/migrations/`)

| Script | Purpose & Command |
| :--- | :--- |
| [`scripts/migrations/mark-match-revenue-collected.ts`](migrations/mark-match-revenue-collected.ts) | `bun run db:mark-match-revenue-collected [-- --apply]` — one-off SL-14 fix: marks matches completed before per-match revenue tracking as collected, so the first `collectMatchRevenue` after the deploy doesn't pay a club's whole history. Dry run by default; run once after the schema push. |
| [`scripts/cron/dry-run-stat-progression.ts`](cron/dry-run-stat-progression.ts) | `DATABASE_URL=<copy> bun scripts/cron/dry-run-stat-progression.ts` — read-only: what the first `stat-progression` run would write (rows, tier changes, largest GDP moves). Run on a production copy before enabling the job ([deploy-mycountry-2026-10.md](../docs/operations/deploy-mycountry-2026-10.md) step 7). |
| [`scripts/migrations/2026-10-mycountry/`](migrations/2026-10-mycountry/) | Idempotent SQL for the MyCountry fix plan, run in the order of [deploy-mycountry-2026-10.md](../docs/operations/deploy-mycountry-2026-10.md). |

**Retired 2026-10-21** (deleted, not archived; recover one from git with
`git log --diff-filter=D --oneline -- <path>` and `git checkout <commit>^ -- <path>`):
- XenForo forum export and import: `forum:export-xenforo` (`scripts/migrations/export-xenforo-forum.ts`),
  `db:import-xenforo-forum` (`scripts/migrations/import-xenforo-forum.ts`), their helpers, `scripts/lib/snapshot-fs.ts`,
  `scripts/lib/load-runner-env.ts`, `src/lib/thinkpages-forum/import/` and
  `src/server/modules/thinkpages-forum/import-*.ts`. The go-live runbook is in
  [docs/history/operations/forum-xenforo-import-runbook.md](../docs/history/operations/forum-xenforo-import-runbook.md).
- Realm board migrations: `db:archive-realm-boards` (`scripts/migrations/archive-realm-boards.ts`),
  `db:migrate-board-bans` (`migrate-board-bans.ts`), `forum:import-board-history` (`import-realm-board-history.ts`)
  and their planners.
- Remaps and backfills: `db:remap-budget-years` (`scripts/migrations/remap-budget-years.ts`,
  `budget-year-remap-plan.ts`), `db:backfill-transport-realm` (`scripts/realms/backfill-transport-realm.ts`,
  `transport-realm-plan.ts`), the `User.wikiUsername` audit `scripts/audit/wikios-legacy-wikiusername.ts` and the
  hex-to-token codemod `scripts/codemods/hex-to-tokens.ts`.

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
| [`scripts/cleanup-wikios-sync-summaries.ts`](cleanup-wikios-sync-summaries.ts) | `bun run wiki:clean:summaries` |

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
