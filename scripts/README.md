# IxStates Scripts & Tooling Catalog

Authoritative index for all active build, deployment, database, audit, diagnostic, and linguistic scripts in `scripts/`. Historical one-off migrations and GIS dataset pipelines are preserved in [`scripts/archive/`](archive/) for reference and reuse.

---

## 🛠️ Active Scripts Directory Structure

```
scripts/
├── README.md                     # Single authoritative index (this document)
├── audit/                        # Architecture guard (audit-arch.ts) & test validation suites (see audit/README.md)
├── bench/                        # WikiOS vs MediaWiki benchmark (wikios-bench.ts) and its default page list
├── lib/                          # Shared helpers: WikiOS bench/parity/round-trip (wikios-harness.ts), env loading, the migrations' production-database guard (database-guard.ts), the XenForo snapshot's disk fs (snapshot-fs.ts)
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
| [`scripts/migrations/archive-realm-boards.ts`](migrations/archive-realm-boards.ts) | `bun run db:archive-realm-boards [-- --apply]` — ThinkPages forum phase 2: copies each Realm Board feed into one archived, locked "Realm Board archive" thread in its realm's Hub, oldest first, with the original timestamps and the personas the posts were made under. Dry run by default (per-realm report: posts found, to create, skipped as removed / no user / already migrated / blank, plus the board chat's message and doc counts, which are not migrated); `--apply` writes one transaction per board. Idempotent by `sourceRef`, so a rerun creates nothing. Refuses the production database (`ixstats`) unless `--production` is passed, and exits 1 if a realm has no Hub (apply `20261009120000_thinkpages_forum_realms` first). Take a `db:backup` first. |
| [`scripts/migrations/realm-board-archive-plan.ts`](migrations/realm-board-archive-plan.ts) | Pure planner for the archive above (`planBoardArchive`, `boardPostBody`): builds each body as the feed displays it (feed-only markers removed, then `formatThinkpagesContentForDisplay`), keeps only https or site-relative attachments, sanitizes as forum writes do, removes action tokens from inside tags, and skips removed posts, posts with no `User` row and posts already archived. |
| [`scripts/migrations/migrate-board-bans.ts`](migrations/migrate-board-bans.ts) | `bun run db:migrate-board-bans [-- --apply]` — ThinkPages forum phase 3 (M6): turns every Realm Board mute and ban still in force into a realm-scope forum ban for each player it binds (the nation's holder when it was imposed, who keeps it after abandoning the nation, and the current owner unless they claimed it afterwards), keeping reason, end, creation time and creator (unmapped creators issue as `system`). A bound player who moderates the realm today (site admin, founder, officer with the `board` power), whom the board never restricted, is skipped and reported. Dry run by default (per-realm report: board bans, forum bans to create, skipped as expired / no holder / already migrated / binding a realm moderator, plus one line per planned ban and per moderator skip); `--apply` writes one transaction per 500 bans, taking each member's moderation lock and writing a `ban.migrate` mod log row (actor `system`) per ban inserted. Idempotent and resumable by `sourceRef` (`realm_board_ban:<id>:<userId>`). Never deletes `realm_board_bans`. Refuses the production database (`ixstats`) unless `--production` is passed, and exits 1 if `forum_bans` is missing (apply `20261010120000_thinkpages_forum_moderation` first). Take a `db:backup` first. |
| [`scripts/migrations/board-bans-to-forum-plan.ts`](migrations/board-bans-to-forum-plan.ts) | Pure planner for the ban migration above (`planBoardBanMigration`, `summarizeBanMigration`): binds each row through `restrictionHolders` (claims and owner read from the ban's own realm, as the board did), one ban per bound player except realm moderators and site admins (reported), mutes become bans with the kind kept in the detail, reasons trimmed and clipped to 1000 characters, and skips expired rows, rows that bind nobody and players already migrated. |
| [`scripts/migrations/export-xenforo-forum.ts`](migrations/export-xenforo-forum.ts) | `bun run forum:export-xenforo -- [--production] --out .forum-import/<name> [--rps 0.9] [--nodes 12,13] [--reset-filter] [--no-attachments] [--max-attachment-mb 25] [--retry-mismatch] [--skip-failing] [--bypass-permissions \| --no-bypass-permissions]` — ThinkPages forum phase 4: read-only export of forum.ixwiki.com through the XenForo REST API (`XENFORO_API_URL`, `XENFORO_API_KEY`; key never printed or written; never `XF-Api-User`; `--production` loads `.env.production.local` before the default env files, `scripts/lib/load-runner-env.ts`) into a snapshot directory (`meta.json`, `nodes.json`, `threads.jsonl`, `posts.jsonl`, `users.json`, `attachments.json`, `attachments/<id>.bin`, `state.json`) that the importer reads. Writes no database. **Permissions:** with a super-user key (per `/index`) every read adds `api_bypass_permissions=1` (read-only, not impersonation) so private forums, moderated content and all attachments are exported rather than a guest's view; `--no-bypass-permissions` turns it off, `--bypass-permissions` forces it on. `meta.json` records key type, bypass, client version and the node filter; the summary prints each forum's listed thread count next to XenForo's `discussion_count` (fewer listed → a restricted context). **Resume:** a rerun with the same `--out` skips the work `state.json` marks done; a different `--nodes` is refused unless `--reset-filter`; Ctrl-C stops after the current item. Redirect threads are not fetched, threads whose posts answer 403/404 are marked gone, attachments answering 403/404 are recorded `forbidden`/`missing`, a download whose size differs from the metadata is stored as `size_mismatch` and fetched again only by a rerun with `--retry-mismatch`, unreadable users (404, or 403 without `user:read`) are recorded as unavailable; none of these block completion, all are reported. An item that keeps failing (5xx or network errors past the retries; a forum's thread list also on 403/404) never stops the export: it is listed and left for a rerun, or with `--skip-failing` recorded as unavailable (forum listed empty, thread gone, user unavailable, attachment missing) so the snapshot can complete; five failures in a row stop it. Exits 1 with the ids still missing when the snapshot is incomplete. **Rate:** default 0.9 requests/s with `User-Agent: IxStats-ForumExport/1.0 (+https://ixwiki.com)`; 429 honours `Retry-After` (capped at 120 s); 429/5xx/network errors are retried up to 5 times after the first attempt (6 attempts, 1/2/4/8/16 s backoff); 401/403 and other 4xx are not retried; attachment downloads time out after 120 s, other requests after 30 s. The server's bot defense blocks above 60 requests a minute per IP (`ixwiki-bot-defense`, fail2ban `ixwiki-bots`), so before raising `--rps` above 1 check that the exporting host's IP is allowlisted (`/etc/ixwiki-defense.conf`, fail2ban `ignoreip`) and that the User-Agent is not matched by `/etc/nginx/conf.d/ixwiki-bots.conf`. `.forum-import/` is gitignored. Client, snapshot format and phases live in `src/lib/thinkpages-forum/import/` (`xenforo-client.ts`, `snapshot.ts`, `export-run.ts`, `attachment-mime.ts`). |
| [`scripts/migrations/import-xenforo-forum.ts`](migrations/import-xenforo-forum.ts) | `bun run db:import-xenforo-forum -- --snapshot DIR [--node-map FILE] [--apply] [--accept-unmapped] [--production] [--report FILE]` and `-- --snapshot DIR --rollback [--yes] [--production]` — ThinkPages forum phase 4: imports an export snapshot (above) into the native forum. `--production` loads `.env.production.local` before the default env files (`scripts/lib/load-runner-env.ts`); the upload directory and the database (no credentials) are printed first and again before any write. Dry run by default: prints the plan report (nodes and their targets, every Forum node without a node map entry with its proposed target, thread/post states, content re-hidden since an earlier import, authors matched and unmatched, features, action tokens, attachments by outcome and snapshot state, the attachment copy with omissions by reason, WARNING and BLOCKING lines) and writes it as JSON with `--report`. Preflight (exit 1): a complete snapshot, a valid node map (`nodeMapSchema`), the seven phase 1 sitewide categories and every mapped realm slug present, `UPLOAD_DIR` writable with twice the attachment bytes free. `--apply` also refuses while the report has BLOCKING lines (an existing archive whose visibility differs from the map, a staff-like title placed public by a title heuristic or the default, a thread or post state that is not visible, moderated or deleted) and while any Forum node has no explicit node map entry (pass `--accept-unmapped`, alias `--accept-defaults`, once the owner accepted the proposed targets). Apply: creates the `xf-<nodeId>` archive categories, copies attachments into `UPLOAD_DIR/forum/` (the bytes the plan hashed, through a `.partial` temp file renamed into place) and registers images as "Forum" media assets (restricted for hidden posts and non-public categories; only when copied now, not yet registered, or stored with another visibility), then one transaction per thread (thread when new, posts in chunks of 500 with `skipDuplicates`, XenForo action links remapped to the native post, counts recomputed from visible posts under the thread lock; a thread that fails is rolled back alone, listed, and the run goes on), then hides imported threads and replies the snapshot now marks moderated or deleted (never un-hides or deletes; their assets turn restricted), then relinks authorless imported rows to users whose `forumUserId` is now linked, and merges each node's resolved target into `forum_import_node_map` for the `/forum/<nodeId>` redirect (this run's nodes win, earlier nodes stay). Every apply also remaps every `("xenforo", xfPostId)` action link whose post is imported, including links the live bridge made after an earlier run. Bodies convert the XenForo wiki BBCode (`[wikilink]`, `[wikisummary]`, `[wikiinfobox]`, `[wikiimage=W]`) to wiki links and embeds, and every apply then points each quote's `data-post` at the native post id of the quoted post (a quote of a post that is not imported loses the attribute; while threads failed, unmapped ids are kept for the rerun). Idempotent and resumable by XenForo ids: a rerun creates nothing new and finishes an interrupted thread. Writes no activity feed, notification or mod-log rows. Exit codes: 0 done; 1 refused, failed, or some threads failed (XenForo ids listed); 2 done but some media asset registrations failed non-retryably (attachment ids listed; pending ones are retried by a rerun). `--rollback` alone is a preview: it prints the imported threads, posts, native replies on them, action links, archive categories, node map row, forum media assets and copied files it would delete, and exits 0. `--rollback --yes` deletes every imported thread (their posts cascade, native replies on them included), returns remapped action links to their XenForo post (a native reply's link is deleted), deletes `xf-*` archive categories left empty, the node map row, every "Forum" media asset and every file in `UPLOAD_DIR/forum/` named like the import names them (with thumbnails), whichever snapshot copied them. One run at a time: a Postgres session advisory lock taken on the runner's own client, which uses exactly one never-reaped connection (`connection_limit=1&max_idle_connection_lifetime=0` added to `DATABASE_URL`, other parameters kept) and is a plain uncapped `PrismaClient` (never `~/server/db`, whose `findMany` stops at 1000 rows); the lock is re-asserted before the attachment copy, before the thread writes, every 100 threads and before the rollback's deletes, and a lost lock stops the run with exit 1. **`DATABASE_URL` must be a direct Postgres connection (production: port 5433), never pgbouncer transaction pooling**, where a session lock means nothing. Refuses the production database (`ixstats`) unless `--production` is passed. Take a `db:backup` first. Pure helpers: `import-xenforo-forum-args.ts`, `import-xenforo-forum-plan.ts`; database code: `src/server/modules/thinkpages-forum/import-{db,write,rollback}.ts`. |
| [`scripts/migrations/reconvert-imported-posts.ts`](migrations/reconvert-imported-posts.ts) | `bun run forum:reconvert-imported -- --snapshot DIR [--node-map FILE] [--apply]` — ThinkPages forum: re-converts already imported XenForo posts with the current converter (wiki BBCode `[wikilink]`/`[wikisummary]`/`[wikiinfobox]`/`[wikiimage=W]` as links and embeds, quote post ids pointed at the native post, an id whose post is not imported dropped), for the clone and the local dev database only (the production import uses the fixed converter from the start). The messages come from the export snapshot (the database keeps only converted HTML), planned exactly as the importer plans them (same node map, same attachment plan, nothing written to disk), then compared with the stored rows: only imported posts whose HTML or plain text differ are updated, and a post edited on the forum since the import (or written with Canvas) is left alone. Dry run by default (counts of posts to re-convert, unchanged, not imported, edited since import); `--apply` writes in transactions of 200 posts. Refuses the production database (`ixstats`), has no `--production` flag, and refuses any `DATABASE_URL` host that is not `localhost`, `127.0.0.1` or `::1`. Takes the importer's Postgres advisory lock, so it never runs beside an import or rollback. Idempotent. Pure helpers: `reconvert-imported-posts-plan.ts`. |
| [`scripts/migrations/reconvert-imported-posts-plan.ts`](migrations/reconvert-imported-posts-plan.ts) | Pure planner for the re-convert above (`parseReconvertArgs`, `localDatabaseRefusal`, `planReconvert`, `reconvertLines`). |
| [`scripts/migrations/import-realm-board-history.ts`](migrations/import-realm-board-history.ts) | `bun run forum:import-board-history [-- --apply]` — ThinkPages realm board: copies each realm's old Realm Board chat (the board group's ThinkShare conversation, `ThinkshareMessage`) into the realm's board thread as history, oldest first, under the original author (Clerk id to user; an author with no user row keeps their personal persona name, else "Former member", as `importedAuthorName`) and the original time. Plain text becomes escaped paragraphs, sanitized last; the full text is kept (the 1,000 character cap is for new messages). Deleted and system messages and blank ones are skipped and reported; replies and attachments are not carried over. Dry run by default (per-realm report: to import, skipped by reason, authors without an account); `--apply` creates the posts in chunks of 500 with `skipDuplicates`, then recounts the thread's `postCount` and `lastPostAt` from its visible posts under the thread lock. Idempotent by `sourceRef` (`realm_board_message:<messageId>`), so a rerun creates nothing. Does not touch the "Realm Board archive" thread. Refuses the production database (`ixstats`), has no `--production` flag, refuses any `DATABASE_URL` host that is not `localhost`, `127.0.0.1` or `::1`, and exits 1 if a board with messages to import has no board thread. |
| [`scripts/migrations/import-realm-board-history-plan.ts`](migrations/import-realm-board-history-plan.ts) | Pure planner for the import above (`planBoardHistory`, `chatMessageBody`, `summarizeBoardHistory`, `parseBoardHistoryArgs`). |

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
