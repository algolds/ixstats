# Deploying `rose-garden` to production (September 2026 plan wave)

**For:** whoever deploys IxStats on the prod host (`ssh ixwiki`, root). **Written:** 2026-09-27.
Read it end to end once before starting. Every command here is meant to be run by hand.

## What this release changes (why the steps below matter)

- **Money and jobs:** vault credit moves run inside their callers' transactions, passive-income payouts are
  idempotent, and `cron-runner.mjs` is now the only scheduler. It runs only the jobs named in `CRON_ENABLED_JOBS`
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
- **Profile URLs:** `/@user` becomes the canonical profile URL.

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
  `master` and hard-resets to it. It then runs `bun install --frozen-lockfile`, `db:generate`, and
  **`prisma db push` against the prod database**, builds, reloads PM2 and runs `start-production.sh`. `db push`
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

## 3. `next.config.js` on the server (canonical `/@user` URLs)

`next.config.js` is not tracked, so edit the server's copy by hand.
- **In `rewrites()`:** replace the two `/id/@:username…` entries in `passportRewrites` with this:
  ```js
  const passportRewrites = [{ source: "/@:username", destination: "/id/:username" }];
  ```
- **In `redirects()`:** replace the two `/@:username…` entries (`permanent: false`) with these:
  ```js
  { source: "/@:username/:tab", destination: "/@:username?tab=:tab", permanent: true },
  { source: "/id/@:username", destination: "/@:username", permanent: true },
  { source: "/id/@:username/:tab", destination: "/@:username?tab=:tab", permanent: true },
  ```
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

## 5. Deploy

```bash
cd /ixwiki/public/projects/ixstats
git fetch master rose-garden
git checkout -B rose-garden master/rose-garden     # the deploy script deploys the checkout's current branch
```

### 5a. Realms schema + ownership backfill (before the deploy script)

`rose-garden` includes the Realms work (`docs/architecture/realms-framework-spec.md`). Its schema change **drops**
`world_configs` (1 row) and `territory_claims` (0 rows) and adds two unique constraints, so the deploy script's own
`db push` would stop on the data-loss warning. Apply it by hand first, then the one-off ownership backfill:

```bash
bun install --frozen-lockfile && bun run db:generate        # new dependency: potrace
docker exec ixstats-postgres psql -U postgres -d ixstats -tAc \
  "SELECT count(*) FROM map_layers WHERE \"worldId\" IS NULL; SELECT id, slug, \"ownerId\" FROM realms;"
#   expect: a count (compare with the backfill's map-layer line) and the row  default|default|system
bun run db:push:force        # answer yes: the world_configs drop and the two new unique constraints are expected
bun scripts/realms/backfill-foundation.ts                  # dry run
```

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
verifies in Settings.) Then run the deploy script — its `db push` is now a no-op:

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

## 6. Smoke checks (browser)

- `/`, `/dashboard`, `/mycountry`, `/maps` load, and the console shows no errors.
- Sign in: the page does not remount, and the title badge appears.
- `/@<your handle>` shows your passport on the Overview tab, `/id/@<handle>` redirects to it (after step 3), and the
  tabs switch.
- **Messages:** send a message in one browser and see it arrive in another. This proves the Redis bridge works.
  The folder badge shows your unread count.
- **Wiki:** open an article with 3+ revisions, open the history, and scrub; the diff changes. The Watch button
  toggles.
- **Country editor** (`/mycountry/editor`): change a slider, and an amber dot plus "1 change" appear. Undo reverts it.
- **Vault:** place a bid on a test auction; the balance moves, and cancelling refunds it.
- **Map editor:** click two points on one river, and the edge follows the river.

## 6b. Serve Eurth (the first outside realm)

Full detail and player instructions: `docs/realms/eurth-onboarding.md`. On prod:

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
4. `/r/eurth` lists 100 claimable nations and the lore link opens `Portal:Eurth` read-only in WikiOS.
5. Tell Eurth players: verify your IIWiki account (Settings → IxnayID & Passport → Linked Accounts), then claim your
   nation at `/r/eurth`. Site admins review other claims in `/admin/realms` → Claims.

## 7. Turn cron jobs on, one per cycle

The cron runner starts with no jobs. Before enabling the money jobs, size the backlog with the read-only queries in
plan 327 (auctions, trades, crafting charges). Then add one name per full cycle to `CRON_ENABLED_JOBS` in
`ecosystem.config.cjs` and run `pm2 restart ixstats-cron --update-env`:

`wiki-recentchanges` → `lore-card-generation` → `card-values` → `sports-season-advance` → `national-issues` →
`politics-drift` → `diplomatic-drift` → `elections` → `trade-expiry` → `auction-completion` → `scheduled-changes` →
`policy-maintenance` (it debits treasuries) → `lorewards-full-sync` → `lorewards-state-sync` → `passive-income` (last).

`wiki-recentchanges` is now the **only** recent-changes sync; the in-process daemon was removed. Wiki edits stop
syncing until you enable it, or until the MediaWiki webhook calls `/api/wikios/inbound-sync` with the secret.

## 8. One-off data fix

Existing storyteller effects were stored with second-scale IxTime and never applied (plan 329):

```bash
bun scripts/fix-storyteller-effect-timestamps.ts            # dry run: prints what it would change
bun scripts/fix-storyteller-effect-timestamps.ts --apply    # after reading the dry run
```

Once applied, government-component and power-broker bonuses start affecting economies. Announce it to players first.

## 9. Later, not part of this deploy

- **CSP (plan 335 Step 6):** nginx or a Cloudflare transform rule replaces the app's `Content-Security-Policy`
  header. Remove that override, then enable the nonce-based CSP and check the pages in section 6 for
  "Refused to execute inline script".
- **Unused tables:** see plan 347 and branch `chore/drop-unused-prisma-models` (commit `d262df35`). It is kept off `rose-garden` on
  purpose, because `db push` would drop empty tables on the next deploy without review.
- **Rotate** the PostgreSQL credential (plan 325).

## Rollback

```bash
cd /ixwiki/public/projects/ixstats
git checkout -B development <commit noted in step 1>
./scripts/deploy-production.sh
```

The deploy script re-fetches `master/development` and hard-resets to it, so this restores the noted commit only while
it is still the tip of `development` on the remote. If that branch has moved, push a rollback branch at the noted commit
and check that out instead.

The schema changes are additive, so old code runs against them, except the `WikiRevision` dedupe, which removed
duplicate rows, and the Realms push, which **dropped** `world_configs` and `territory_claims` (old code's admin
world-config pages break; everything else runs). To undo that, restore from the step 1 dump:
`docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats --clean < /root/ixstats-<stamp>.dump`.
