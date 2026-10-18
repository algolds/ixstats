# Deploying `rose-garden` to production (September 2026 plan wave)

> **One-off runbook.** It retires to [docs/history/](../history/README.md) once 1.4 is released; the standing
> procedure is the [release guide](release-guide.md).

**For:** whoever deploys IxStats on the prod host (`ssh ixwiki`, root). **Written:** 2026-09-27.
Read it end to end once before starting. Every command here is meant to be run by hand.

## What this release changes (why the steps below matter)

- **Money and jobs:** vault credit moves run inside their callers' transactions, payouts are
  idempotent (the passive-income job has since been replaced by the Vault dividend, step 5a), and `cron-runner.mjs` is now the only scheduler. It runs only the jobs named in `CRON_ENABLED_JOBS`
  and runs none by default.
- **Security:**
  - Every country-scoped mutation checks ownership.
  - WebSocket connections need a Clerk token and an allowed Origin.
  - Wiki webhooks need a shared secret.
  - Wiki HTML is sanitized on the server.
- **Deleted code:** about 900 tRPC procedures with no in-repo caller are gone (2026-09-25 and 2026-09-27).
  The Discord bot only calls `countries.getGlobalStats` and `admin.getSystemStatus`, and both still exist (checked on
  prod). IxMaps and the MediaWiki extensions make no tRPC calls.
- **Schema:**
  - `VaultTransaction.idempotencyKey` (nullable, unique)
  - a `REFUND` value in the vault transaction enum
  - a `SportMatch (status, resolvedIxTime)` index
  - a `WikiRevision (source, mwRevId)` unique index
  - realm region pages (2026-10-05, additive): `Realm` banner, factbook, tags and `foundedAt` columns;
    `realm_officers`, `realm_embassies` and `realm_board_bans` tables; a nullable `Poll.realmId`. `db push` applies
    them with no data-loss prompt
  - realm links, rules and in-world date (2026-10-07, additive): nullable `Realm.communityLinks`, `rulesWikitext`,
    `rulesHtml`, `rulesUpdatedAt`, `rulesUpdatedBy` and `RealmClaim.rulesAcceptedAt`
    (`prisma/migrations/20261007_realm_links_rules_calendar.sql` has the same columns). `db push` applies them with
    no data-loss prompt; the in-world date is a `Realm.settings` key and needs no column
  - realm source sync (2026-10-07): `realm_source_syncs` and `realm_sync_runs` tables, a nullable
    `Country.externalSourceKey` (unique per realm), and `Alliance.realmId` (default `default`) with
    `Alliance.externalSourceKey`. Alliance names become unique **per realm** instead of globally. Apply
    `prisma/migrations/20261007120000_realm_source_sync/migration.sql` by hand in step 4 first: `db push` would
    otherwise stop on the new `(realmId, name)` unique constraint's warning
  - realm maps (2026-10-07, additive): `MapLabel.countryId` becomes nullable, with new `MapLabel.realmId` and
    `MapLabel.fontStyle` (default `normal`) and a `(realmId, status)` index, so a realm labels oceans and regions;
    a nullable `MapEditRequest.realmId` with a `(realmId, status)` index
    (`prisma/migrations/20261007_realm_map_labels.sql` has the same changes). `db push` applies them with no
    data-loss prompt. The realm map settings (planet radius, default view, base image, attribution) are the `map`
    key of `Realm.settings` and need no column
  - realm map import (2026-10-07, additive): `map_import_jobs` (background import jobs) and `map_imports`
    (rollback snapshots) tables (`prisma/migrations/20261007150000_map_import_jobs/migration.sql`, idempotent, has the
    same tables). `db push` applies them with no data-loss prompt. Uploaded maps and analysis results are files in
    `MAP_IMPORT_DIR` (default `.map-imports/` in the app directory, git-ignored); the web app and the cron runner
    must see the same directory
  - a nullable `IntelligenceAlert.readAt` (2026-10-05, additive): when the owner read a threshold alert (MC-17)
  - ThinkPages post views (2026-10-05, additive, SL-8): a `ThinkpagesPostViewDay` table (post, day, views)
  - ThinkPages flag queue (2026-10-05, additive, SL-10): `PostFlag.status` (default `open`), `resolvedAt`,
    `resolvedBy` and a `(status, createdAt)` index
  - the Exchange (2026-10-06, additive, VT-16/D5): nullable unique `idempotencyKey` on `exchange_transactions`,
    `exchange_conversion_logs` and `exchange_contracts`; `exchange_contracts` gains issuer, escrow, award, dispute and
    `updatedAt` columns plus `issuerCompanyId`/`winnerCompanyId` indexes; `SPEND_EXCHANGE` and `EARN_EXCHANGE` in the
    vault transaction enum. The Exchange is on by default (`vault_isExchangeEnabled`; Admin → Vault and economy →
    System config). New ₷ wallets now start at 1,000 instead of 10,000. **No data fix:** existing wallets keep their
    balance, and seeded ₷ can't be converted to IxCredits (the conversion has since been removed altogether)
  - Exchange phase 2 (2026-10-06, additive, VT-16): `exchange_companies.tradingOpen` (default false) and
    `decisionValue`; `exchange_contracts.issuerCountryId`, `fundedBy` and a `(status, endIxTime)` index;
    `exchange_sector_indices.fundSovereigns` and `unitsOutstanding`; new tables `exchange_share_listings` and
    `exchange_company_dividends`. `db push` applies them with no data-loss prompt. **No data fix:** MVP contracts have
    `fundedBy` NULL, which the code reads as company-funded
  - WikiOS v1 (2026-10-06, D20): the wiki tables and columns of PR #52 (`wiki_mirror_jobs`, `wiki_user_groups`,
    `wiki_restrictions`, `wiki_blocks`, `wiki_bot_passwords`, `wiki_api_sessions`, `wiki_template_links`,
    `wiki_image_links`, new `wiki_articles` / `wiki_revisions` / `wiki_logs` / `wiki_assets` / `wiki_account_links`
    columns) and five unique constraints that `db push` asks to confirm (see 5a)
  - privacy and notification delivery (2026-10-06, additive, SL-4/SL-5): `ConversationParticipant.requestStatus`
    (default `none`) and a `(userId, requestStatus)` index; `UserPreferences.emailEnabledAt`, `emailDigest` (default
    false) and `lastEmailDigestAt`; a `PushSubscription` table. `db push` applies them with no data-loss prompt
  - map geometry sync triggers (2026-10-07): `prisma/migrations/20261007_map_geometry_sync_triggers.sql` (re)creates
    the PostGIS triggers that fill `geom_postgis` on `map_layers`, `subdivisions`, `cities` and `points_of_interest`,
    and backfills rows still missing it. **`db push` cannot create triggers**: run the file by hand after the deploy
    script (step 5b). Idempotent; on prod, where the archived setup script installed them, it only backfills
  - Atlas Release 0 (2026-10-21, additive): `Realm.mapVersion` (default 0), which versioned map layer and tile URLs
    carry, and the PostGIS pieces `db push` cannot create: a `Country` trigger that fills `geom_postgis` from
    `geometry`, a backfill of the countries missing it, and the function `atlas_country_union`
    (`prisma/migrations/20261021120000_atlas_r0/migration.sql`, idempotent). **Apply that file before the new code
    serves a request** (step 5a); the deploy script runs it again after its own push
  - Atlas Release A (2026-10-22, additive): `Country.worldgen` (default false) and `Country.claimable` (default true),
    which world generation and the claim flow read (`prisma/migrations/20261022120000_atlas_ra/migration.sql`,
    idempotent; `db push` adds the same two columns). Apply that file with the Release 0 one (step 5a), and build
    Ixnay's and Eurth's relief once after the deploy (step 5c)
  - Atlas and World Studio (2026-10-23, **drops data**): new `world_presets` and `world_preset_versions` tables (the
    built-in presets are seeded on first read, no rows are inserted), and the models `ProceduralWorld`
    (`procedural_worlds`, 38 rows on the local clone), `WorldTemplate` (`world_templates`) and `Realm.templateId` are
    gone from the schema. `prisma/migrations/20261023120000_atlas_studio/migration.sql` (idempotent) creates the new
    tables and drops the old ones. **Apply it BEFORE `db:push:force`** (step 5a): `db push` without
    `--accept-data-loss` refuses to drop the non-empty `procedural_worlds` and would stop the deploy. The deploy
    script, `start-development.sh`, `scripts/refresh-local-db.sh` and the dev bootstrap run it before their push too
  - map import snapshots read every row (2026-10-23, code only, no schema change): `captureMapSnapshot`, the world
    import diff and the other import, apply and rollback reads took at most 1,000 rows per layer. A snapshot taken by
    the older code for a layer with more rows than that is missing the rest, so rolling back an import made before this
    deploy restores only part of such a layer. Snapshots taken after it hold every row. Rollback of a large layer
    (Ixnay's altitudes have 4,068 rows) needs the new code
  - Vault collectathon hub (migration `20261024120000`, **drops one column**): adds `Country.ownedSince`, `cards.lorewardEntryId` and
    `cards.lorewardEdition` (unique together), drops `national_issues.ixCreditsAwarded`, and deletes the stored
    `showCardsTab` setting (`prisma/migrations/20261024120000_vault_hub/migration.sql`, idempotent). **Apply it BEFORE
    `db:push:force`** (step 5a), after the Atlas and World Studio file: `db push` without `--accept-data-loss` refuses
    the column drop. The deploy script, `start-development.sh`, `scripts/refresh-local-db.sh` and the dev bootstrap run
    it before their push too. The rest of the hub is steps 5a (cron swap), 5d and 7
- **Profile URLs:** `/@user` becomes the canonical profile URL.
- **WikiOS v1 ships switched off.** `WIKIOS_V1_ENABLED` is unset, so WikiOS reads but takes no edits (MediaWiki's
  `readonly` error; people edit on classic MediaWiki), `/w/api.php` answers `readonly`, and the mirror and background
  renders do nothing. The cutover is its own runbook, [wikios-v1-cutover.md](wikios-v1-cutover.md); its section
  "Before the cutover" lists what is safe meanwhile. Do not set `WIKIOS_V1_ENABLED` in this deploy.

## What prod looked like on 2026-09-27 (read-only check)

- `/ixwiki/public/projects/ixstats` is on branch **`development` @ `7877d620`**, which is far behind `rose-garden`.
- **PM2:** `ixstats-cron`, `ixstats-ws`, `ixstats-ixtwitter`, `ixworld` and `ixwiki-discord-bot` are online. The main
  app runs outside PM2 through `start-production.sh`, and the `ixstates` PM2 entry is stopped.
- **The three `ixstats-*` PM2 processes run with `NODE_ENV=development`,** although `ecosystem.config.cjs` says
  `production`. The deploy script's `pm2 startOrReload ecosystem.config.cjs --update-env` fixes that. From then on
  they read `.env.production`, `.env.local` and `.env.production.local`.
- **Env:** `.env.production` / `.env.production.local` define `CLERK_SECRET_KEY` but none of
  `WIKI_SYNC_WEBHOOK_SECRET`, `IXTIME_BOT_SECRET`, `WS_ALLOWED_ORIGINS`, `NEXT_PUBLIC_APP_URL`, `REDIS_ENABLED` or
  `CRON_ENABLED_JOBS`.
- **Deploy script:** `scripts/deploy-production.sh` fetches the checkout's current branch from the remote named
  `master` and hard-resets to it. It then runs `bun install --frozen-lockfile`, `db:generate`, takes a backup, applies
  the Atlas and World Studio SQL, and runs **`prisma db push` against the prod database**, builds, reloads PM2 and runs `start-production.sh`. `db push`
  applies the schema changes above by itself. It aborts the deploy if a change would lose data, which is what the
  dedupe step below prevents.

## 1. Before you start

1. **Back up the database.** Postgres runs in the Docker container `ixstats-postgres`.
   ```bash
   docker exec ixstats-postgres pg_dump -U postgres -d ixstats -Fc > /root/ixstats-$(date +%F-%H%M).dump
   ls -lh /root/ixstats-*.dump | tail -1
   ```
2. Note the current commit for rollback: `git -C /ixwiki/public/projects/ixstats log -1 --oneline`.
3. Check disk space with `df -h /`. A full disk puts Postgres into recovery mode.

## 2. Environment

Add these to `/ixwiki/public/projects/ixstats/.env.production.local`. The new values are secrets, so generate them
on the server and never paste them anywhere else.

```bash
cd /ixwiki/public/projects/ixstats
echo "WIKI_SYNC_WEBHOOK_SECRET=$(openssl rand -hex 32)" >> .env.production.local
echo "IXTIME_BOT_SECRET=<the secret the Discord bot sends to /api/ixtime/sync-from-bot>" >> .env.production.local
echo 'NEXT_PUBLIC_APP_URL=https://ixwiki.com' >> .env.production.local
echo 'WS_ALLOWED_ORIGINS=https://ixwiki.com,https://maps.ixwiki.com' >> .env.production.local
echo 'REDIS_ENABLED=true' >> .env.production.local
echo 'REDIS_URL=redis://localhost:6379' >> .env.production.local   # ixstats-redis-cache listens on 127.0.0.1:6379
```

- **Required at boot:** the web app refuses to start in production without `WIKI_SYNC_WEBHOOK_SECRET` (at least 32
  characters) and `IXTIME_BOT_SECRET`.
- **`IXTIME_BOT_SECRET`** must match what the Discord bot sends. The bot currently pushes to `localhost:3000`, the
  dev port, with no auth header, so prod relies on the pull path. Set a value anyway, and give the bot the same
  value if you point its push at prod.
- **Redis:** `REDIS_ENABLED=true` is what lets chat messages sent through the web app reach the websocket process.
  It publishes over Redis, so `ixstats-ws` needs the same Redis settings. Check that `ixstats-redis-cache` is
  healthy and has a `maxmemory`/eviction policy, because both caches now really use Redis.
- **PM2 processes:** give `ixstats-cron` and `ixstats-ws` the same values by adding them to their `env:` blocks in
  `ecosystem.config.cjs`. The loaders also read `.env.production.local` once `NODE_ENV=production` is in effect.
- **`ixstats-cron`:** add `CRON_ENABLED_JOBS: ''` to its `env:` block for now (no jobs; see step 7).
- **`MAP_TILE_DIR` (Atlas Release 0 vector tiles):** the map's altitude, river and lake tiles are cached on disk, one
  folder per realm, map version and tile format, and grow with every border save. Three processes read and write
  that cache: the web app, the IxWorld standalone (maps.ixwiki.com, `/ixwiki/public/maps/ixworld`) and `ixstats-cron`.
  Their working directories differ, so unset, each one fills its own `data/cache/map-tiles` and the cron job renders
  into a folder maps.ixwiki.com never reads. Create one folder outside the repository and outside `data/` (the IxWorld
  deploy copies `data/`), for example `mkdir -p /var/cache/ixstats/map-tiles`, and set the same
  `MAP_TILE_DIR=/var/cache/ixstats/map-tiles` in the `env:` of the web app's PM2 app, of `ixstats-cron` and of
  `ecosystem.ixworld.config.cjs`. Check `df -h /` again after a week: a realm with many saves adds about 0.35 MB per
  version at z0 to z3 alone.
- **Notification email and push (optional, SL-5):** both are off until their variables are set, and Settings hides
  their switches until then. Email takes `EMAIL_API_KEY` and `EMAIL_FROM` (and `EMAIL_API_URL` for an API other
  than Resend that accepts Resend's JSON); links in emails use `APP_URL` or `NEXT_PUBLIC_APP_URL`. Push takes
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (`mailto:` address); generate the pair once with
  `node -e "const c=require('crypto').createECDH('prime256v1');c.generateKeys();console.log(c.getPublicKey('base64url'),c.getPrivateKey('base64url'))"`
  and keep it: changing it invalidates every saved browser subscription. Set them for the web app and for
  `ixstats-cron` (the digest job sends email). Details: [notifications.md](../systems/notifications.md#email-and-web-push-sl-5).

## 3. `next.config.js` on the server (canonical `/@user` URLs)

`next.config.js` is not tracked, so edit the server's copy by hand.
- **In `rewrites()`:** replace the two `/id/@:username…` entries in `passportRewrites` with this:
  ```js
  const passportRewrites = [{ source: "/@:username", destination: "/id/:username" }];
  ```
- **In `redirects()`:** delete the `/@:username…` entries (`permanent: false`) and every other legacy entry (the
  repository's `next.config.js` has no `redirects()` any more). Wiki
  pages that still link `/id/@user`, `/@user/<tab>` or `/thinkpages/profile/<user>` are resolved to the new pages
  when they render.
- **Check it parses:** run `node --check next.config.js`.
- **If you skip this step,** the new `/@user` links still work, because the old config redirects them to `/id/@user`.
  Do not apply only half of it, or you will create a redirect loop.

## 4. Database steps that must happen before the deploy

`prisma db push` would fail on the new `WikiRevision` unique index if duplicate revisions exist. The file
`prisma/migrations/20260927_wiki_revisions_source_mwrevid_unique.sql` has numbered sections. Run them **one at a
time** in `docker exec -it ixstats-postgres psql -U postgres -d ixstats`, never by piping the whole file:

1. Run section **1** (duplicate count) and **1b** (duplicates referenced as a parent revision). If 1b is not 0,
   stop: those `parentRevisionId` values have to be re-pointed to the surviving row first.
2. Run section **2**, the dedupe that keeps the earliest row per `(source, mwRevId)`.
3. Run section **3**, the unique index. `db push` would also create it.

Rows with `mwRevId IS NULL` are left alone.

`db push` applies the other schema changes by itself. If you prefer to apply them yourself first, the hand-written
files are:
- `20260923_add_vault_transaction_idempotency_key.sql` — it must be in place before the new code runs, and `db push`
  guarantees that.
- `20260923_add_vault_refund_type.sql`
- `20260927_sport_match_status_resolved_idx.sql` — use `CREATE INDEX CONCURRENTLY` for no table lock.

Apply the realm source sync migration by hand **before** the deploy script, so its `db push` has nothing to ask
about (existing alliances become IxWorld's; two alliances could never share a name before, so the per-realm unique
key cannot fail):

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
  < prisma/migrations/20261007120000_realm_source_sync/migration.sql
```

The map import tables can go in the same way (optional: `db push` creates them too, and the file is idempotent):

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
  < prisma/migrations/20261007150000_map_import_jobs/migration.sql
```

## 5. Deploy

First promote the release on GitHub: merge `rose-garden` into `development`, then `development` into `master`
(merge PRs, CI green; see [contributing.md](../processes/contributing.md#branches)). Production deploys `master`.

```bash
cd /ixwiki/public/projects/ixstats
git fetch master master
git checkout -B master master/master     # the deploy script deploys the checkout's current branch
```

### 5a. Realms schema + ownership backfill (before the deploy script)

`rose-garden` includes the Realms work (`docs/architecture/realms-framework-spec.md`). Its schema change **drops**
`world_configs` (1 row) and `territory_claims` (0 rows) and adds two unique constraints, so the deploy script's own
`db push` would stop on the data-loss warning. Apply it by hand first, then the one-off ownership backfill. The
Atlas and World Studio SQL goes **before** that push, for the same reason: it creates `world_presets` and
`world_preset_versions` and **drops `procedural_worlds`, `world_templates` and `realms."templateId"`** (the schema no
longer has them, and `db push` stops on the non-empty `procedural_worlds`). The Vault hub SQL follows it, also before the
push: it **drops `national_issues."ixCreditsAwarded"`**. The step 1 backup covers the dropped rows:

```bash
bun install --frozen-lockfile && bun run db:generate        # new dependency: potrace (since removed: the dependency and the code that used it are gone)
docker exec ixstats-postgres psql -U postgres -d ixstats -tAc \
  "SELECT count(*) FROM map_layers WHERE \"worldId\" IS NULL; SELECT id, slug, \"ownerId\" FROM realms;"
#   expect: a count (compare with the backfill's map-layer line) and the row  default|default|system
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
  < prisma/migrations/20261023120000_atlas_studio/migration.sql      # BEFORE db:push:force; idempotent
docker exec ixstats-postgres psql -U postgres -d ixstats -tAc \
  "SELECT to_regclass('world_presets') IS NOT NULL, to_regclass('world_preset_versions') IS NOT NULL, to_regclass('procedural_worlds') IS NULL, to_regclass('world_templates') IS NULL, NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'realms' AND column_name = 'templateId');"
#   expect: t|t|t|t|t
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
  < prisma/migrations/20261024120000_vault_hub/migration.sql         # Vault hub: BEFORE db:push:force; idempotent
docker exec ixstats-postgres psql -U postgres -d ixstats -tAc \
  "SELECT (SELECT count(*) FROM information_schema.columns WHERE (table_name, column_name) IN (('Country','ownedSince'),('cards','lorewardEntryId'),('cards','lorewardEdition'))), NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'national_issues' AND column_name = 'ixCreditsAwarded'), NOT EXISTS (SELECT 1 FROM \"SystemConfig\" WHERE key = 'showCardsTab');"
#   expect: 3|t|t
bun run db:push:force        # answer yes: the world_configs drop, the two Realms unique constraints and WikiOS v1's five are expected
bun scripts/realms/backfill-foundation.ts                  # dry run
```

WikiOS v1's five unique constraints are `wiki_articles (source, pageId)`, `wiki_revisions (source, revId)`,
`wiki_logs.logId`, `wiki_logs.mwLogId` and `lore_stash_items (stashId, contentType, pageTitle)` (in place of
`(stashId, pageTitle)`). None can fail: the four columns are new and empty, and the stash key is weaker than the old one.
Do not run WikiOS's manual SQL (`prisma/manual-migrations/*wikios*`) here; it is step 1 of the cutover runbook.

The dry run prints `owners: N to assign, M collisions`. A **collision** is a country that two or more ordinary
users point at; the script never guesses. For each `COLLISION <countryId>: users <a>, <b>`, decide the owner and
clear the others' pointer, then dry-run again (the dev rehearsal on 2026-09-29 had exactly one, Faneria):

```bash
docker exec ixstats-postgres psql -U postgres -d ixstats -c \
  "UPDATE \"User\" SET \"countryId\" = NULL WHERE id = '<user to detach>' AND \"countryId\" = '<countryId>';"
```

When the dry run shows `0 collisions` and no `BLOCKS --apply` line:

```bash
bun scripts/realms/backfill-foundation.ts --apply
bun scripts/realms/backfill-foundation.ts                  # expect: owners: 0 to assign, 0 collisions
```

(One `ixwiki links … skip` line is normal when two accounts share a legacy wiki username: the first keeps it, the other
verifies in Settings.)

The backfill never makes a system owner a nation's owner, so a nation that both a system owner's sign-in account and an
older duplicate account point at goes to the duplicate. That is the case for Caphiria: the owner signs in as
`user_2zqm…` (`User.id cmdfcodpb00014kevb5x5b1es`, forum name `admin`), and the never-used `user_3078…`
(`cmdayg3wf00024kl8ojchrnxq`) also points at it. Hand the nation to the sign-in account and store its passport handle,
otherwise the passport at `/@Heku` shows `@admin` and no realms:

```bash
docker exec -i ixstats-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ixstats <<'SQL'
BEGIN;
UPDATE "Country" SET "ownerUserId" = 'cmdfcodpb00014kevb5x5b1es'
 WHERE id = 'cmgn9d82v00484kyx3mjv9b8q' AND "ownerUserId" IS DISTINCT FROM 'cmdfcodpb00014kevb5x5b1es';
UPDATE "User" SET handle = 'heku' WHERE id = 'cmdfcodpb00014kevb5x5b1es' AND handle IS NULL;
COMMIT;
SQL
# expect: UPDATE 1 twice (UPDATE 0 when already applied)
```

Then apply the Atlas Release 0 SQL by hand, **before any new code runs**. `db push` adds `Realm.mapVersion` and
`Country.geom_postgis` but cannot create the `Country` trigger or the `atlas_country_union` function, and it does not
backfill. Without the function, the code now notices (one check per process, logged as a warning) and keeps nations'
cached outlines, so nothing aborts; without the backfill, every country's geography panel (`getCountryGeoProfile`)
answers "Country has no usable map outline" until `"Country".geom_postgis` is filled. The deploy script applies the same
idempotent file after its own push, so this step is for the order: SQL first, code second.

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
  < prisma/migrations/20261021120000_atlas_r0/migration.sql
docker exec ixstats-postgres psql -U postgres -d ixstats -tAc \
  "SELECT to_regprocedure('atlas_country_union(text,text)') IS NOT NULL, (SELECT count(*) FROM \"Country\" WHERE geometry IS NOT NULL AND geom_postgis IS NULL);"
#   expect: t|0, or t and a count of only countries whose stored outline is invalid (the run printed a WARNING naming each)
```

(The Atlas and World Studio SQL ran above, before the push. `./scripts/deploy-production.sh` runs it again before its own
`db:push:force`, and so do `start-development.sh`, `scripts/refresh-local-db.sh` and the dev bootstrap, which a local
database that still has `procedural_worlds` rows needs: without it dev startup aborts like the deploy would.)

Then the Atlas Release A file the same way: two `ADD COLUMN IF NOT EXISTS` on `"Country"` (`worldgen`, `claimable`).
`db push` adds them too and the deploy script runs the file after its push, so this too is only for the order, SQL first:

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
  < prisma/migrations/20261022120000_atlas_ra/migration.sql
docker exec ixstats-postgres psql -U postgres -d ixstats -tAc \
  "SELECT count(*) FROM information_schema.columns WHERE table_name = 'Country' AND column_name IN ('worldgen', 'claimable');"
#   expect: 2
```

Then swap the cron job **before** the deploy script, because the script reloads `ixstats-cron` at its end and
`cron-runner.mjs` exits 1 on an unknown job name. The `passive-income` job no longer exists. In `CRON_ENABLED_JOBS` in
`ecosystem.config.cjs`, **replace `passive-income` with `vault-dividend`** (midnight UTC, the nightly Vault dividend);
if `passive-income` is not listed yet, there is nothing to replace and `vault-dividend` joins the list in step 7. Do not
restart yet. An admin cron override saved under `cronSchedule_passiveIncome` is orphaned (nothing reads it); re-save the
schedule in Admin, which stores it under `cronSchedule_vaultDividend`. The first run records the start day in the
SystemConfig row `vault_dividend_started_on` and pays only the day just ended; it never settles an earlier day.

Then run the deploy script — its `db push` is now a no-op:

```bash
./scripts/deploy-production.sh
```

The script installs dependencies; the new ones are `@clerk/backend` and `jsdom`, and `bun.lock` is updated. It then
generates the Prisma client, runs `db push`, builds (plus `scripts/deploy-ixworld.sh`), reloads PM2 with `--update-env`, and starts the app.
If `db push` reports possible data loss, **stop and read the message**. It means a schema change would drop data,
and you should not add `--accept-data-loss` blindly.

After it finishes, confirm the processes picked up production mode:

```bash
pm2 jlist | python3 -c "import sys,json;[print(p['name'],p['pm2_env'].get('NODE_ENV')) for p in json.load(sys.stdin) if p['name'].startswith('ixstats')]"
pm2 logs ixstats-cron --lines 30 --nostream     # expect "CRON_ENABLED_JOBS is empty — no jobs scheduled" and no import errors
pm2 logs ixstats-ws --lines 30 --nostream       # expect "[WS] ✓ ThinkPages WebSocket initialized" and no "[ThinkPagesBridge] Redis disabled" warning
```

`ixstats-ixtwitter` already points at `scripts/run-ixtwitter-sync.ts`. `server.mjs` no longer schedules any jobs.

### 5b. Map geometry triggers (after the deploy script)

The spatial SQL (country geo profiles, terrain lookups, containment checks) reads `geom_postgis`, which only these
triggers keep in step with the GeoJSON columns. Install or refresh them and backfill, then check nothing is missing:

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
  < prisma/migrations/20261007_map_geometry_sync_triggers.sql
docker exec ixstats-postgres psql -U postgres -d ixstats -tAc \
  "SELECT count(*) FROM map_layers WHERE geom_postgis IS NULL;"
#   expect: 0, or only rows whose GeoJSON is invalid (the run printed a WARNING naming each)
```

### 5c. Relief for Ixnay and Eurth (after the deploy script)

Atlas Release A draws a hillshade over the land (the raster layer `relief`). Generated worlds build theirs when they
are applied; Ixnay's and Eurth's come from their stored altitude bands and are built once, by hand, on the server
itself (the command writes to the database it is connected to). The step needs no stored map pipeline.

**Required first: one shared raster folder.** Four processes touch the tiles: the web app (serves them, and builds a
founder's world relief in its apply job, at any time after the deploy), `ixstats-cron` (pipeline runs), the command
below, and the IxWorld standalone (maps.ixwiki.com serves them). Unset, `MAP_RASTER_DIR` is `data/map-rasters` under
each process's own working directory, so every one of them reads and writes a different folder. A redeploy of IxWorld
copies the web app's `data/` once: that would cover Ixnay and Eurth as built today, and never a world a founder applies
later, whose relief tiles maps.ixwiki.com would then answer with 404 ([realm-maps.md](../systems/realm-maps.md#7-production-notes)).
Do this before the commands:

1. Create one folder outside the repository and outside `data/` (the IxWorld deploy copies `data/`), for example
   `mkdir -p /var/lib/ixstats/map-rasters`, owned by the user that runs the processes. If tiles already exist under
   `data/map-rasters`, move them into it.
2. Set the same absolute `MAP_RASTER_DIR=/var/lib/ixstats/map-rasters` in the `env:` of the web app's PM2 app, of
   `ixstats-cron` and of `ecosystem.ixworld.config.cjs`, and export it in the shell that runs the command below.
3. Reload them with `pm2 reload <app> --update-env` and check each sees it, as for `MAP_TILE_DIR` (step 2).

```bash
cd /ixwiki/public/projects/ixstats
bun scripts/realms/build-realm-map.ts --realm ixnay --steps relief            # dry run
bun scripts/realms/build-realm-map.ts --realm ixnay --steps relief --apply
bun scripts/realms/build-realm-map.ts --realm eurth --steps relief            # dry run
bun scripts/realms/build-realm-map.ts --realm eurth --steps relief --apply
```

Each run prints the step's status in brackets, then the job's result. Expect:

- the dry run: `Relief [would-change]` and `relief: version <hash>, z0–5, tiles to build`;
- the apply: `Relief [changed]` and `relief: version <hash>, z0–5: <n> tiles written, <m> fully transparent left out`
  (Ixnay on the local clone: 490 tiles, about 3 MB, about 4 s), then `run <id>: succeeded`;
- a second run: `Relief [unchanged]`;
- a realm with no stored altitude bands: `Relief [skipped]` and `No altitude bands to shade`. Nothing is written, and
  there is nothing to do for that realm.

Then check the folder is the shared one: `ls "$MAP_RASTER_DIR"/ixnay/relief` lists the version folder, and a tile
request to maps.ixwiki.com for that version (`/api/map-rasters/ixnay/relief/<version>/0/0/0`, with the version from
the realm's settings) answers 200, not 404. Repeat with a test realm's first applied world in step 6.

### 5d. Vault hub: backfills and restart (after the deploy script)

Do these in this order. The hub's SQL (step 5a) and the cron swap (before the deploy script, step 5a) are already done.

1. **`ownedSince` backfill**, then 2. **trophy card backfill.** Both need the new columns and the new code, so they run
   after the deploy script. Both are dry runs by default, idempotent, and print what they would do before you add
   `--apply`.

   ```bash
   cd /ixwiki/public/projects/ixstats
   bun scripts/backfill-country-owned-since.ts                # dry run: dates per owned nation, and any it cannot date
   bun scripts/backfill-country-owned-since.ts --apply
   bun scripts/backfill-loreward-trophy-cards.ts              # dry run: trophy cards missing per contest
   bun scripts/backfill-loreward-trophy-cards.ts --apply
   ```

   - **`ownedSince`** is the latest approved realm claim by the current owner (`reviewedAt`), else the nation's first
     `CountryChangeLog` row. A nation with neither is listed and left empty (it counts as 0 months owned for the
     Stewardship achievements); set it by hand. **Run it after any `scripts/identity/audit-leader-ownership.ts --apply`**,
     because that script sets `ownerUserId` without `ownedSince`.
   - **Trophy cards** mint one card per recorded Loreward place back to 2017 (about 2,800 places on the local clone),
     with no IxCredits, and give each to its winner when that wiki account has a verified IxWiki link; the rest wait
     unowned and are granted by the Lorewards sync once the account is linked.
3. **Restart**, last: `pm2 restart ixstats-cron --update-env`, and the web app and `ixstats-ws` as in the deploy. The
   achievement sync at boot (`syncAchievements`) marks the 47 Legacy definitions inactive and creates the new ones; until
   it has run, `achievements.getAllWithStatus` also re-syncs when it finds the table behind the registry.

**Loreward payouts** use the tiered table for entries dated 2026-10-15 or later (`LOREWARD_PAYOUT_START`); earlier
entries keep what they paid. If the deploy lands after that date, the first sync pays the new table, runner-ups
included, for the days since.

## 6. Smoke checks (browser)

- `/`, `/dashboard`, `/mycountry`, `/maps` load, and the console shows no errors.
- Sign in: the page does not remount, and the title badge appears.
- `/@<your handle>` shows your passport on the Overview tab, `/id/<handle>` redirects to it, and the
  tabs switch.
- **Messages:** send a message in one browser and see it arrive in another. This proves the Redis bridge works.
  The folder badge shows your unread count.
- **Wiki:** open an article with 3+ revisions, open the history, and scrub; the diff changes. The Watch button
  toggles.
- **Country editor** (`/mycountry/editor`): change a slider, and an amber dot plus "1 change" appear. Undo reverts it.
- **Vault:** place a bid on a test auction; the balance moves, and cancelling refunds it.
- **Vault hub:** the sidebar shows Vault with five rows (Wallet, Daily reward, Achievements, Cards, Store) for a signed-in
  player with no nation; `/vault` is the statement page; `/vault/achievements` has its four tabs and `/achievements`
  redirects to it; `/util/lorewards` shows today's race. **Exchange is behind the Labs gate:** `/labs/exchange` gives a
  user without Labs access a 404 (Labs is open to every signed-in user while the `showLabsTab` setting is on, its default;
  with it off, only admins and `labs.access` holders get in), and so does every Exchange notification link; `/vault/exchange` redirects to it. The day after step 7, `/vault` shows a
  "Vault dividend" row for players with activity or a card collection.
- **Map editor:** click two points on one river, and the edge follows the river.
- **Atlas:** `/admin/maps` opens the realm overview under the health strip, and `/admin/maps/studio` opens World Studio
  (site admins only). The Earth-like, Ixnay and Eurth presets appear in the Studio and in a founder's World tab after
  the first read (they are seeded then). On Ixnay's realm page, **Rebuild relief** works for a site admin and builds from
  Ixnay's altitude bands.
- **Relief:** Ixnay's hillshade shows on `/maps` (the Relief toggle in the layer controls). On a test realm where you are
  the founder, `/maps?realm=<slug>&editor=world` opens the World tab; generating and rerolling work, and nothing is applied
  until Use this world. After you apply a world on that realm, its relief shows on `maps.ixwiki.com` too (the shared
  `MAP_RASTER_DIR` of step 5c; a 404 on its relief tiles means the standalone reads another folder).

## 6b. Serve Eurth (the first outside realm)

Full detail and player instructions: [`docs/systems/realms-eurth-onboarding.md`](../systems/realms-eurth-onboarding.md). On prod:

1. Re-run `bun scripts/realms/backfill-foundation.ts` (dry run): expect `0 to assign, 0 collisions` — anything else
   means someone linked a nation between the backfill and the deploy; resolve as in 5a.
2. `/admin/realms` → Realms → **New realm**: name `Eurth`, slug `eurth`, visibility `public`, description
   `Realistic geofiction and political simulation, loosely based on NationStates. Lore on IIWiki (Portal:Eurth);
   community at eurth.org.`
3. Import the lore index (prod reaches iiwiki directly — no proxy variable):
   ```bash
   bun scripts/realms/import-realm-lore.ts --realm eurth --source iiwiki --category "Category:Eurth" \
     --keyword Eurth --nation-roster "Category:Countries (Eurth)"            # dry run
   #   expect: pages ≈2750 (crawled ≈2746), nations 100, categories 49, truncated no
   bun scripts/realms/import-realm-lore.ts --realm eurth --source iiwiki --category "Category:Eurth" \
     --keyword Eurth --nation-roster "Category:Countries (Eurth)" --apply
   ```
   The dry run lists every nation, then warns about any roster title that is not among the crawled pages
   (`not crawled`) and any roster entry that looks like a subcategory rather than a nation (`suspect`). Check
   each one before `--apply`. Re-running later adds new pages, updates kinds, and only removes stale pages
   with `--prune` (never a page with a pending or approved claim, or with a Country); the dry run lists the
   stale pages. Approved nation-page claims found their country prefilled from the page's infobox,
   including its flag and coat of arms.
4. Configure the source sync (onboarding §4): `/admin/realms` → **Source sync** → realm `Eurth` → **Load preset**
   `Eurth community map` → check the continent table → **Save source sync**. Or from the shell:
   ```bash
   bun scripts/realms/sync-realm-source.ts --realm eurth --preset eurth-map        # loads the preset + dry run
   ```
5. **Dry run** and read the diff: about 130 source nations, new nations unclaimed, 115 borders, 8 alliances, and
   **Left to you** (match by hand or exclude each; nothing is guessed). Repeat until it reads right.
6. **Apply** (settings page: runs in the background, see the run history; or the script with `--apply`). New
   nations read their IIWiki infobox one at a time (paced, 8 s each), so allow a few minutes. Entries whose
   infobox gave nothing are listed; re-run to retry them.
7. Check: `/r/eurth` → **Nations** lists about 130 nations, the unclaimed ones badged **Unclaimed** with **Claim**;
   `/maps?realm=eurth` shows the borders and `Map: Eurth community, via eurth-map by Seth Harrison`; a nation's page
   shows **Claim this nation**; the alliances exist in Eurth only. The lore link opens `Portal:Eurth` read-only in
   WikiOS.
8. Choose a schedule in the sync settings (for example daily) and switch **Run on the schedule** on; then add
   `realm-source-sync` to `CRON_ENABLED_JOBS` (step 7).
9. Open claims: tell Eurth players to verify their IIWiki account (Settings → IxnayID & Passport → Linked Accounts),
   then claim their nation at `/r/eurth`. Site admins review other claims in `/admin/realms` → Claims (a nation only
   on the map always goes to review).

## 7. Turn cron jobs on, one per cycle

The cron runner starts with no jobs. Before enabling the money jobs, size the backlog with the read-only queries in
plan 327 (auctions, trades, crafting charges). Then add one name per full cycle to `CRON_ENABLED_JOBS` in
`ecosystem.config.cjs` and run `pm2 restart ixstats-cron --update-env`:

`wiki-recentchanges` → `lore-card-generation` → `card-values` → `sports-season-advance` → `national-issues` →
`politics-drift` → `diplomatic-drift` → `elections` → `trade-expiry` → `auction-completion` →
`policy-maintenance` (it debits treasuries) → `lorewards-full-sync` → `lorewards-state-sync` → `vault-dividend` (last).

The `passive-income` job was deleted with the Vault hub; its replacement `vault-dividend` and the swap are in step 5a.

The `scheduled-changes` job was deleted on 2026-10-06 (D11). If it is still listed in `CRON_ENABLED_JOBS`, remove it
before deploying: the runner exits on an unknown job name.

Enable `db-backup` (daily dump to `backups/`) and `log-retention` (prunes old logs and `CronRun` rows) with the
first cycle, and `budget-year-rollover` (new-fiscal-year reminders) once the budget-year remap in step 8 is applied.

PR #49 added three more jobs; enable them after the list above, one per cycle: `thinkpages-trending` (trending and
post counters) → `achievements-evaluate` → `stat-progression`. `stat-progression` writes every country's stored
stats and monthly history, so take a `bun run db:backup` first; until it runs, stored stats never move.

Exchange phase 2 added two jobs; enable them last, one per cycle: `exchange-contract-expiry` (refunds escrow of OPEN
contracts never awarded) → `exchange-market` (sector indices, sector fund rebalancing, company decisions, fair values).
Until `exchange-market` runs, every sector index stays at 1,000 and queued decisions wait.

Enable `notification-email-digest` (daily email summaries, SL-5) only once email is configured (step 2); it does
nothing without it.

Enable `realm-source-sync` (hourly at minute 37) once a realm's source sync is configured and applied (step 6b): it
runs each realm whose own schedule is due (set per realm in its sync settings), one realm at a time, each under the
lease `realm-source-sync:<realmId>`. It does nothing for realms with no schedule:

```
CRON_ENABLED_JOBS=...,realm-source-sync
```

Enable `map-import` (every minute) when realm staff start importing maps: it runs queued map import analyses in a
worker thread of the cron runner, one realm at a time under `map-import:<realmId>` leases. Without it the web process
runs analyses in-process (slower, sharing the web server's CPU); apply jobs always start in the web process:

```
CRON_ENABLED_JOBS=...,map-import
```

Enable `geo-profiles` (every 5 minutes) to make the map editor's **Recalc** action (`geoCore.recalculateGeoProfiles`)
do anything. The action only marks the stored geo profiles stale and returns at once; this job recomputes each stale or
missing profile and the country's map-derived `GeographicResource` rows, one country at a time under the lease
`geo-profiles`, and stops starting countries after 20 minutes (the next run carries on). Without it nothing is
recomputed: the toast then says no `geo-profiles` run is recorded. The first run also computes every country that has map
geometry but no stored profile, and replacing a country's resources resets their `exploitedPercent`, so check
`SELECT count(*) FROM geographic_resources WHERE "exploitedPercent" > 0` before enabling it:

```
CRON_ENABLED_JOBS=...,geo-profiles
```

Enable `map-tiles` (every 5 minutes) once `MAP_TILE_DIR` is set (step 2). It renders z0 to z3 of the altitude, river and
lake tiles of Ixnay and every published realm whose current map version has no `.done` marker (about 20 s of PostGIS per
realm), so the first visitor after a map change finds them cached, and deletes tile folders of versions a newer one
outlived a day ago. Without it nothing is pre-rendered: the first visitor pays the render, and the web process removes
a realm's outlived folders itself (at most once an hour per realm) so the disk cannot fill. Leave it out until the
Atlas SQL of step 5a has been applied and `MAP_TILE_DIR` is shared:

```
CRON_ENABLED_JOBS=...,map-tiles
```

That makes 26 jobs here, including `notification-email-digest`, `realm-source-sync`, `map-import` and `map-tiles` (plus the two
WikiOS ones below): the full table of 27 in `src/server/cron/jobs.ts` ([events.md](../reference/events.md#scheduled--batch-jobs) lists them with
schedules). Each run is recorded as a `CronRun` row; `/api/health` shows the last run per job.

`wiki-recentchanges` is now the **only** recent-changes sync; the in-process daemon was removed. Wiki edits stop
syncing until you enable it, or until the MediaWiki webhook calls `/api/wikios/inbound-sync` with the secret.

Leave `wiki-mirror` and `wiki-render-stale` out of the list. They do nothing while `WIKIOS_V1_ENABLED` is off, and
step 6b of the [WikiOS v1 cutover runbook](wikios-v1-cutover.md) adds them.

## 8. One-off data fixes

**Right after the deploy script** (it pushes the schema that adds per-match revenue tracking), mark matches that finished
before this release as already paid, or each club's first "Collect Revenue" pays its whole history (SL-14):

```bash
bun run db:mark-match-revenue-collected             # dry run: prints how many matches
bun run db:mark-match-revenue-collected -- --apply
```

The M0 fixes add three more, each a dry run first (take `bun run db:backup` before the first `--apply`):

```bash
bun run db:remap-budget-years               # real-calendar budget years → IxTime years (MC-1)
bun run db:remap-budget-years -- --apply
bun run audit:vault-exploits                # exploit rows and the corrections it would make (VT-1/2/6/11)
bun run audit:vault-exploits:apply
bun run audit:forum-links                   # read-only: forum links made without proof (WK-1)
```

The Archetype Proposal Token is retired (it never did anything). After `audit:vault-exploits:apply`, refund every
purchase of it, once, at what was paid:

```bash
bun run db:refund-retired-store-items             # dry run: lists each purchase and the refund
bun run db:refund-retired-store-items -- --apply  # REFUND rows keyed retired_item_refund:<purchase id>; re-runs change nothing
```

Existing storyteller effects were stored with second-scale IxTime and never applied (plan 329):

```bash
bun scripts/fix-storyteller-effect-timestamps.ts            # dry run: prints what it would change
bun scripts/fix-storyteller-effect-timestamps.ts --apply    # after reading the dry run
```

Once applied, government-component and power-broker bonuses start affecting economies. Announce it to players first.

WikiOS assets stored before WK-17 have no BlurHash (their placeholder is a flat box). Fill them in, any time after the
deploy; safe with `WIKIOS_V1_ENABLED` off, since it writes only `wiki_assets.blurhash`, never a page, file or log:

```bash
bun run wiki:backfill:blurhash                    # dry run: hashes at most 25 files, writes nothing
bun run wiki:backfill:blurhash -- --apply         # every PNG/JPEG/GIF/WebP asset without one; re-runs skip those done
```

## 9. Later, not part of this deploy

- **CSP (plan 335 Step 6, PL-2):** nginx or a Cloudflare transform rule replaces the app's `Content-Security-Policy`
  header. The app's nonce now reaches the page, so once this release is live: remove that override, then load the
  pages in section 6 with the browser console open and check for "Refused to execute inline script" (see
  [the release guide](release-guide.md#b7-csp-remove-the-nginx-override)).
- **Unused tables:** see plan 347 and branch `chore/drop-unused-prisma-models` (commit `d262df35`). It is kept off `rose-garden` on
  purpose, because `db push` would drop empty tables on the next deploy without review.
- **Rotate** the PostgreSQL credential (plan 325).

## Rollback

The deploy script re-fetches the checked-out branch from the remote and hard-resets to it, so roll back by pushing a
branch at the commit noted in step 1 (for example `rollback-2026-09`) and deploying it with the non-master override:

```bash
cd /ixwiki/public/projects/ixstats
git fetch master rollback-2026-09
git checkout -B rollback-2026-09 master/rollback-2026-09
ALLOW_NON_MASTER_DEPLOY=1 ./scripts/deploy-production.sh
```

Then revert or fix on `master` and deploy `master` again.

The schema changes are additive, so old code runs against them, except the `WikiRevision` dedupe, which removed
duplicate rows, and the Realms push, which **dropped** `world_configs` and `territory_claims` (old code's admin
world-config pages break; everything else runs). To undo that, restore from the step 1 dump:
`docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats --clean < /root/ixstats-<stamp>.dump`.
