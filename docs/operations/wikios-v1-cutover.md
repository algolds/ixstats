# WikiOS v1 cutover runbook

**Status:** nothing in this runbook has been applied. It is written for a human operator on the production server
(`ssh ixwiki`). Plan 417, September 30, 2026. It replaces the superseded
[Stage 3 config plan](../systems/wikios/wikios-stage3-config-plan.md).

**This launch (owner, 2026-10-24).** WikiOS runs inside IxStates only (`ixwiki.com/projects/ixstates/wiki/*`, port
3550), and ixwiki.com stays classic: public, editable and canonical. Classic's saves reach IxStates through the webhook
(step 6), and bots move to IxStates' `/w/api.php` (step 6c). The separate `wikios` process and the nginx takeover
described in the next paragraph are deferred: their steps are listed under "Order matters" and are not run at this
launch.

**What changes (deferred takeover).** WikiOS runs as its own Next.js process (`pm2` app `wikios`, `127.0.0.1:3560`, like IxWorld at
maps.ixwiki.com) and takes over `ixwiki.com/wiki/*`. Classic MediaWiki stays editable at
`ixwiki.com/classic/*` and `index.php?...action=edit`. MediaWiki also becomes a private render engine on
`127.0.0.1:8081` (`action=parse&text=`), and every saved MediaWiki page is announced to WikiOS by a webhook.
IxStates (port 3550) and IxWorld (port 3002) are untouched, apart from the brief degradation during the WikiOS
build described in step 5.

**Order matters.** Every production command in this runbook is launch-time: run by hand, step by step, in this order.
None has been run yet.

- **Launch steps (this launch):** 0, 1, 1b, 1c, 2, 2a, 3 (3a to 3d, and 3e, the sister interwiki prefixes), 4, 4b, 4c
  (the sister wikis answer the server), 5b, 6, 6a, 6b, 6c, 6d, 7b, and the IxStates rows of 10 with 10d. Two parts of
  them run before step 2's deploy: step 4's loopback server with its env line, and step 6a's app URL check (step 2 says
  why). Steps 0 and 1 run before it too, `2026-09-30-wikios-api.sql` above all (see "The data-safety SQL runs before
  the push"), and so does step 1b's `verifiedById` fix-up while the IxnayID identity deploy has not run. Few of these steps change what the public sees on ixwiki.com: loading the snippet in step 3 changes neither
  classic's article path nor its canonical link, though it lets every uploader on classic upload SVG and PDF files (3a);
  step 3e lets classic's editors write `[[iiwiki:...]]` and `[[althistory:...]]` links; and step 6d only adds IxStates'
  rules to classic's `robots.txt`. Step 6b lets the wiki inside IxStates take edits, and step 6c moves the bots to it.
- **Deferred takeover steps (not run at this launch):** 5 (the separate `wikios` process on `127.0.0.1:3560`), 7 (its
  checks), 8 (the cutover: nginx first, then one `LocalSettings.php` line), 9, 9a, 10a and 10b (they prepare step 8),
  11 and 12 (the full rollback). Every `:3560` line in this runbook belongs to them.

Every step has a rollback line that names the backup it restores.

## Before the cutover

The WikiOS v1 code reaches production in an ordinary IxStates release (`scripts/deploy-production.sh`: the additive
schema step, its SQL files, `prisma db push`, build, PM2 reload; [release guide A4](release-guide.md#a4-build-and-deploy)).
That deploy runs none of the steps below: no manual SQL from `prisma/manual-migrations/`, no environment variables, no
MediaWiki configuration, no nginx takeover. The code is safe without them because of one switch,
**`WIKIOS_V1_ENABLED`, off unless set to `true`** (`src/lib/wiki-os/v1-switch.ts`). Step 6b turns it on. One of them is
not optional for the deploy itself: step 1's `2026-09-30-wikios-api.sql` must run before it (below).

**Safe while the switch is off (the state after an ordinary deploy):**

- **Schema.** Every table and column WikiOS v1 reads is in the Prisma schema, so the deploy's additive step and `db push`
  create them. Five unique constraints would make the push ask for confirmation: `wiki_articles (source, pageId)`,
  `wiki_revisions (source, revId)`, `wiki_logs.logId`, `wiki_logs.mwLogId`, and
  `lore_stash_items (stashId, contentType, pageTitle)` in place of `(stashId, pageTitle)`. None can fail: the four columns
  are new and empty (NULLs are never duplicates), and the stash key is weaker than the old one. Step 1's files create all
  five (`2026-09-30-wikios-api.sql`, `2026-09-30-wikios-sync-v1.sql`, `2026-09-30-wikios-stash-key.sql`), and step 1 runs
  before the deploy, so the push has none of them to ask. **Never push the schema by hand before the deploy**: a push
  before the deploy has run `20261105120000_wikios_conflicts` creates `wiki_revisions.origin` itself and skips its
  labelling (below). If the deploy's own push stops on a warning, the data-safety SQL has already run, so a hand push is
  safe then (step 2).
- **Reading.** Articles, history, diffs, categories, Special pages and search work. Full-text search uses the old query,
  because the search vector stays empty until step 1's `search-indexes.sql`.
- **No writes, unless an administrator turns editing on.** With the switch off, WikiOS writes follow a second switch,
  the admin editing toggle (`/admin/wikios-settings`, Editing; SystemConfig row `wikios_editing_enabled`), which is off
  until someone turns it on. While it is off, page edits, reverts, moves, deletions, protections, blocks, rights changes,
  uploads, XML imports and bot passwords are refused with MediaWiki's `readonly` error, and `/w/api.php` answers
  `readonly` (503) to every request. People edit on classic MediaWiki, as before. See "The editing toggle" below.
- **Cron.** `wiki-recentchanges` (and the webhook, once step 6 exists) keeps WikiOS's copy current: MediaWiki's revision
  always becomes WikiOS's head, nothing is parked and nothing is pushed back. `wiki-render-stale` does nothing even when
  listed. `wiki-mirror` does nothing while the editing toggle is off and the outbox is empty; it drains any jobs already
  queued. Leave both out of `CRON_ENABLED_JOBS` until the toggle goes on or step 6b, whichever comes first.
- **Other readers of IxWiki.** The lore-card generator and the Lorewards sync read IxWiki pages from MediaWiki, as they did
  before WikiOS v1.

**Incomplete until the cutover (nothing breaks):**

- With no background render, WikiOS fills its link, template and image tables only for pages someone opens. "What links
  here" and page images stay incomplete until step 7b; feed cards then fall back to the picture in the article's intro.
- Until step 1's manual SQL runs (before the deploy), these are missing: integer ids for api.php (`pageId`, `revId`,
  `logId` sequences, triggers and backfills), the generated search vector and its GIN and trigram indexes, the redirect
  backfill and the default protections. Every file is idempotent and safe to apply before the switch;
  `2026-09-30-wikios-stash-key.sql` can run at any time.

**Unsafe before the cutover:**

- Turning `WIKIOS_V1_ENABLED` on before steps 1, 3 and 4. Writes would queue in an outbox with no mirror account, api.php
  would hand out pages without ids, and background renders would have no render engine (in production they refuse the
  public MediaWiki and wait for step 4). (Writes themselves wait for the protections marker of steps 1 and 1b, see
  below, but the renders do not.)
- Steps 1 and 1b are mandatory before any WikiOS write. Until step 1b's `--yes` run has written the protections marker,
  WikiOS refuses every write in both modes, `WIKIOS_V1_ENABLED` included, and the editing toggle refuses to turn on.
- `NEXT_PUBLIC_WIKIOS_STANDALONE` in any env file (see step 5).

**What the release with the integration and hosts work needs at its deploy (plan 2026-10-25):**

- **`WIKIOS_MEDIAWIKI_INTERNAL_URL` (step 4), set before or with the deploy.** In production, with no internal URL,
  nothing renders through MediaWiki: the public MediaWiki is refused, not used as a fallback. That engine also renders
  ThinkPages forum posts, template previews and revision views, so without it they are compiled locally: no templates,
  no parser functions, no Lua. Forum posts recover through the `forum-render-stale` cron job once the variable is set
  (when that job is in `CRON_ENABLED_JOBS`); previews and revision views are fine again at the next request. The mirror
  waits too, and its admin section says so (step 4b checks it).
- **`NEXT_PUBLIC_APP_URL` (or `APP_URL`), set before the build (step 6a).** Feeds, permalinks, purges and Discord links
  are built on it. In production a missing or loopback app URL throws: the feed answers 503,
  Discord embeds stop, story-chain wiki syncs fail and retry, and the Cloudflare purge covers classic's URL only.
- **One re-render.** This release and the sister-wiki work (Workstream C) go out in the same deploy, so the renderer
  version moves from 4 to 6 at once and every stored bundle and forum post re-renders once, not twice (step 7b gives
  the rates).

**The data-safety SQL runs before the push (plan 2026-10-24, WikiOS data safety):**

That plan adds two migration files: `prisma/migrations/20261105120000_wikios_conflicts/migration.sql` (the conflict log,
and an `origin` column on `wiki_revisions` that says whether each revision was saved in WikiOS or on classic) and
`prisma/migrations/20261105120001_wikios_sync_dead_letters/migration.sql` (the inbound quarantine). They must run in this
order, and all before `db push`:

1. `prisma/manual-migrations/2026-09-30-wikios-api.sql` (part of step 1's loop). It gives every revision that came from
   MediaWiki `revId = mwRevId`.
2. `20261105120000_wikios_conflicts`. When it adds `origin`, it labels each existing revision once: `classic` when
   `revId = mwRevId` and no mirror job names it, `wikios` otherwise. It needs file 1 for that. Without the `revId` column
   it falls back to "has a MediaWiki id and no mirror job", which can label as `classic` a WikiOS save whose finished
   mirror job was already purged. With a `revId` column that `db push` created but file 1 never filled, every row stays
   `wikios`.
3. `20261105120001_wikios_sync_dead_letters`.
4. `db push`. A push that runs before file 2 creates `origin` itself (default `wikios`), and file 2 then skips its
   labelling, because it only labels when it adds the column.

A wrong label does not lose text, but every revision wrongly marked `wikios` makes later classic edits to its page look
like collisions: conflict rows and notices for edits that did not conflict.

How `scripts/deploy-production.sh` really runs them: after its database backup it runs the additive schema step
(`scripts/deployment/apply-additive-schema.ts --apply`), then a fixed list of migration files with
`bunx prisma db execute` (the Realms drop, the forum, Atlas Studio, Vault hub, the forum readers drop, the cards phases,
IxnayID, native lore), then `20261105120000_wikios_conflicts`, then `20261105120001_wikios_sync_dead_letters`, then the
2026-10 MyCountry and realm-time files, then `bun run db:push:force`. So inside the deploy, files 2 and 3 run before the
push, in that order. The additive step never adds `wiki_revisions.origin` (it is excluded by name, so file 2 always
adds it and labels), but it does add `revId` when the database lacks it: nullable and empty, which is exactly the case
where every row would stay `wikios`. The deploy runs nothing from `prisma/manual-migrations/`, so **file 1 is yours to run
before the deploy** (step 1; it fills `revId` whether or not the column already exists), and no hand push may run before
the deploy has run file 2. The [release guide](release-guide.md#b3-the-window-the-app-stopped) puts these in order for
1.5. If file 1 stops on a column it reads that the database does not have yet, run the additive step by hand first
(`bun scripts/deployment/apply-additive-schema.ts --apply`; the deploy runs it again and finds nothing), then file 1.

Check before that deploy (read-only):

```bash
# 0 = file 1 has run. An error saying "revId" does not exist means it has not: run step 1 first.
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c \
  "select count(*) from wiki_revisions where \"mwRevId\" is not null and \"revId\" is null"
# no row = file 2 has not run and no push has added origin yet (the expected state)
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c \
  "select column_name from information_schema.columns where table_name = 'wiki_revisions' and column_name = 'origin'"
```

If the deploy's push stops on a warning, files 2 and 3 have already run, so a hand `bun run db:push:force` is safe then
(step 2). Running files 2 and 3 by hand, after file 1, is also safe:

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < "$IX/prisma/migrations/20261105120000_wikios_conflicts/migration.sql"
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < "$IX/prisma/migrations/20261105120001_wikios_sync_dead_letters/migration.sql"
```

Both files are idempotent, so the deploy running them again changes nothing. Both are additive (new tables, a new
column), and they have no rollback of their own: the only way back is the dump taken in step 1. Check after (read-only):
most rows should be `classic`, since every imported revision is.

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c "select origin, count(*) from wiki_revisions group by origin"
```

If every row is `wikios`, the labelling was skipped (a push went first, or file 1 had not run). After running file 1, apply
the labelling by hand once. It is file 2's own rule, so a WikiOS save, whose `revId` comes from WikiOS's sequence, is never
marked `classic`:

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 -c \
  "update wiki_revisions r set origin = 'classic'
    where r.\"mwRevId\" is not null and r.\"revId\" = r.\"mwRevId\"
      and not exists (select 1 from wiki_mirror_jobs j where j.kind = 'revision' and j.\"revisionId\" = r.id)"
```

**The editing toggle (before the cutover):**

- **Where.** `/admin/wikios-settings`, Editing section; stored as the SystemConfig row `wikios_editing_enabled`
  (`src/lib/wiki-os/editing-switch.ts`). Every process (IxStates, `ixstats-cron`, `wikios`) reads the row at most every
  15 seconds, so a flip reaches all of them within 15 seconds. Each flip is written to the admin audit log and DMed to
  the admin on Discord. `WIKIOS_V1_ENABLED=true` forces it on and locks the switch.
- **What it unlocks.** On, WikiOS takes edits (and `/w/api.php` stops answering `readonly`), and each edit is queued for
  the mirror, which copies it to classic MediaWiki. Inbound sync, background renders, search and the other readers stay
  on `WIKIOS_V1_ENABLED`. Add `wiki-mirror` to `CRON_ENABLED_JOBS` before the first flip; without it the outbox drains
  only through the in-process run a couple of seconds after each write.
- **Preconditions.** It cannot be turned on before the protections import (steps 1 and 1b: the SystemConfig row
  `wikios_protections_imported_at`, written by step 1b's `--yes` run), nor while `WIKIOS_MEDIAWIKI_BOT_USER` or
  `WIKIOS_MEDIAWIKI_BOT_TOKEN` is unset (step 3c); the page says which is missing. `WIKIOS_MEDIAWIKI_API` is optional:
  unset, the mirror writes to the internal `api.php`. In production it must be a loopback or private host: a public
  `api.php` is refused, the mirror waits, and the page names it.
- **Why the protections come first.** Without them WikiOS knows only the protections it has seen in MediaWiki's log since
  its sync started: a page MediaWiki protected before then would be open in WikiOS, and the mirror account would push the
  edit to MediaWiki past its protection. So until the marker exists every WikiOS write (in both modes) is refused with
  MediaWiki's `readonly` error, saying it waits for the protections import; so is a write whose read of the marker
  failed before any read of it succeeded. A switch row already on shows as "On, waiting for the protections import" and
  can still be turned off (written and audited as usual).
- **Turning it off.** New WikiOS edits are refused; jobs already in the outbox keep draining to MediaWiki. To make them
  wait instead, set `SKIP_MEDIAWIKI_SYNC=true` (restart `ixstats-cron`, `wikios` and IxStates) or drop `wiki-mirror` from
  `CRON_ENABLED_JOBS`.

Files shipped by plan 417 (all in the IxStats checkout, `/ixwiki/public/projects/ixstats/`):

| File | Installed as |
|------|--------------|
| `scripts/deploy-wikios.sh` | run in place |
| `deploy/wikios/ecosystem.wikios.config.cjs.example` | `/ixwiki/public/wikios/ecosystem.wikios.config.cjs` |
| `deploy/wikios/next-config-snippet.md` | edits to `next.config.js` (tracked in git) for the deferred takeover build |
| `scripts/ops/nginx/wikios-render-internal.conf` | `/etc/nginx/conf.d/wikios-render-internal.conf` |
| `scripts/ops/nginx/wikios-upstream.conf` | `/etc/nginx/conf.d/wikios-upstream.conf` |
| `scripts/ops/nginx/wikios-proxy-params.conf` | `/etc/nginx/snippets/wikios-proxy-params.conf` |
| `scripts/ops/nginx/wikios-takeover.conf` | `/etc/nginx/snippets/wikios-takeover.conf` |
| `scripts/ops/mediawiki/wikios-localsettings.php` | `/ixwiki/config/wikios-localsettings.php` |
| `scripts/ops/verify-wikios-takeover.ts` | run in place with `bun` |

## Conventions (read once)

- **Shell setup.** Paste this at the top of every new shell before any step. It defines absolute paths only: no step
  changes directory without a subshell `( cd ...; ... )`, so a pasted block never leaves you somewhere else.

  ```bash
  IX=/ixwiki/public/projects/ixstats                          # the IxStats checkout
  WK=/ixwiki/public/wikios                                    # the WikiOS deploy directory
  MW=/ixwiki/mediawiki/releases/1.45.1                        # the MediaWiki install (adjust if it differs)
  BK=$(cat /ixwiki/private/backups/wikios-cutover.latest)     # the backup directory created in step 0
  IXSTATES_URL=$(sed -n 's/^NEXT_PUBLIC_IXSTATES_URL=//p' "$WK/.env.wikios-build" 2>/dev/null)   # empty until step 5
  # MediaWiki maintenance scripts run as the web user and read the production settings file:
  mwmaint() { sudo -u www-data env MW_CONFIG_FILE=/ixwiki/config/LocalSettings.php php "$MW/maintenance/run.php" "$@"; }
  # keep a copy of a file in $BK under a given name before editing it:  bk <file> <name>
  bk() { sudo cp -a "$1" "$BK/$2" && ls -l "$BK/$2"; }
  ```

  Step 0 creates `$BK`, so it skips the `BK=` line (it fails on the first run) and sets `BK` itself.
- **Backups.** Every file a step edits is copied into `$BK` first (`bk <file> <name>`), and the step's rollback line
  restores from there. `$BK` is mode 0700 because it holds copies of env files.
- **Secrets.** Never `echo` or paste a secret. Generate into a variable or a 0600 file inside a subshell with its own
  `umask` (`( umask 077; ... )`), and keep secrets out of command lines: `ps` shows every argument.
- **Reloads are chained.** `sudo nginx -t && sudo systemctl reload nginx` and
  `sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm` are always one command with `&&`: never reload a
  configuration that failed its test.
- **`sudoedit` refuses symlinks.** `/etc/nginx/sites-enabled/ixwiki.com` is one: edit its target,
  `sudoedit "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"`.

## 0. Baseline and backup directory

```bash
IX=/ixwiki/public/projects/ixstats
git -C "$IX" log -1 --oneline   # the release that contains plan 417 and the WikiOS plans it depends on
df -h /                         # need several GB free: a full root disk takes Postgres down

TS=$(date +%Y%m%d-%H%M%S)
BK=/ixwiki/private/backups/wikios-cutover-$TS
install -d -m 700 "$BK" && echo "$BK" > /ixwiki/private/backups/wikios-cutover.latest
mkdir -p /ixwiki/private/logs/wikios-cutover
{
  date -Is
  echo "--- php-fpm pool RSS (MB):"
  ps -C php-fpm8.4 -o rss= | awk '{s+=$1} END {printf "%.0f\n", s/1024}'
  echo "--- free -m:";  free -m
  echo "--- uptime:";   uptime
  echo "--- pm2:";      pm2 jlist | jq -r '.[] | "\(.name) rss=\((.monit.memory/1048576)|floor)MB cpu=\(.monit.cpu)%"'
  echo "--- wiki page timing:"
  curl -s -o /dev/null -w "Main_Page total: %{time_total}s\n" "https://ixwiki.com/wiki/Main_Page"
} | tee /ixwiki/private/logs/wikios-cutover/baseline.txt
```

The baseline is for step 11. **Rollback:** nothing changed.

## 1. Apply the WikiOS SQL migrations

**Mandatory before any WikiOS write.** Its `2026-09-30-wikios-rights.sql` backfills an `edit` restriction for every page
whose legacy protection is still in force; step 1b refuses to run until it has.

The WikiOS plans add hand-written, idempotent SQL under `prisma/manual-migrations/`. Take a dump first, then apply
the files in filename order, **except `2026-09-30-wikios-lead-image-canonical-path.sql`**: its header says to run it after
the code is deployed, so it is its own step after the deploy (5b below) and the loop leaves it out:

```bash
( cd "$IX" && bun run db:backup )                                   # aborts non-zero on failure; dump lands in backups/
ls "$IX"/prisma/manual-migrations/*wikios*.sql | grep -v lead-image-canonical-path | sort    # review the list; read each file before applying
for f in $(ls "$IX"/prisma/manual-migrations/*wikios*.sql | grep -v lead-image-canonical-path | sort); do
  echo "== $f"
  docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < "$f" || break
done
```

**Canonical titles (plan 403) come first, before that loop.** `2026-09-30-wikios-canonical-titles.md` is a procedure, not a
`.sql` file, so the loop does not run it, and the redirect backfill in the loop (`2026-09-30-wikios-redirects-backfill.sql`) and
any XML import should see canonical titles. Follow that file's steps: back up `wiki_articles`
(`pg_dump -t wiki_articles`), preview with `bun scripts/audit/wikios-title-duplicates.ts` (read-only), generate `fix.sql` with
`--emit-sql` (the script reads `DATABASE_URL` and refuses anything but `localhost:5433`), review and apply it, and handle by
hand the collision and invalid-title lists it prints as comments at the end, repeating the generate and apply steps until
both lists are empty.

Among the files in the loop is `2026-09-30-wikios-uploads.sql` (plan 411): the `sha1` column and index of `wiki_assets` (the content hash of an
uploaded file; the new `upload` mirror job kind needs no DDL).

**Rollback:** the files are additive and idempotent, so the running app is unaffected if you stop here. To undo,
restore the dump taken above (`pg_restore` into a scratch database first; never `docker system prune`).

## 1b. Import the MediaWiki rights (plan 409), after checking who vouched for each name

**Mandatory before any WikiOS write.** Its `--yes` run writes the protections marker WikiOS waits for (below).

`scripts/wikios-import-rights.ts` copies MediaWiki group memberships, protections and blocks into WikiOS. Its group and
block rows are keyed by wiki username alone; they reach an IxStates account through its **approved old IxWiki name
claims** (IxnayID identity, [Wiki identity](../systems/ixnayid-passport.md#wiki-identity)). A name's groups pass only
through a claim with `rightsPass` (a system owner approved or linked it); its blocks follow every approved claim. So
what matters is which claims carry `rightsPass`.

**If the IxnayID identity deploy has not run yet,** its conversion will turn each verified IxWiki link into an approved
claim and set `rightsPass` when `wiki_account_links."verifiedById"` is NULL (the account proved the link itself, with
the token on its wiki user page) or a system owner's id. That column is new in step 1, so **every link that existed
before it reads as NULL, including the ones an administrator confirmed by hand**, and would carry that name's sysop or
bureaucrat rights to the account. Fix that first:

```bash
# read-only: every verified ixwiki link (the ones an admin confirmed and the ones a player proved look alike here)
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c \
  "select l.id, l.\"userId\", l.username, l.\"verifiedAt\", l.\"verifiedById\", l.\"mwRegisteredAt\"
     from wiki_account_links l
    where l.source = 'ixwiki' and l.\"verifiedAt\" is not null and l.token is null
    order by l.\"verifiedAt\""
```

For each link an administrator confirmed (ask the admins), record the admin who did it, so the link is no longer taken
for self-proven:

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 -c \
  "update wiki_account_links set \"verifiedById\" = '<the confirming admin user id>' where id = '<link id>'"
```

An administrator who is not a system owner makes the converted claim carry no imported groups (the safe default); a
system owner's id makes it carry them. Leave NULL only for links the player proved themselves.

**If the IxnayID identity deploy has run,** the IxWiki links are gone; read the claims that pass groups instead:

```bash
# read-only: every approved claim whose name's imported groups pass to its account
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c \
  "select c.id, c.\"userId\", c.name, c.origin, c.\"decidedById\", c.\"decisionNote\"
     from wiki_name_claims c
    where c.source = 'ixwiki' and c.status = 'APPROVED' and c.\"rightsPass\"
    order by c.name"
```

For a claim that should not pass groups, an administrator removes it in Admin, Users, Name claims and one who is not a
system owner links the name again, or clear the flag by hand
(`update wiki_name_claims set "rightsPass" = false where id = '<claim id>'`).

Then dry-run the import, read its plan, and write:

```bash
( cd "$IX" && bun scripts/wikios-import-rights.ts --api https://ixwiki.com/api.php )          # dry run: no database
( cd "$IX" && bun scripts/wikios-import-rights.ts --api https://ixwiki.com/api.php --yes )    # prints the DB host, then writes
```

The `--yes` run first checks that step 1's backfill ran: if a protected page has no `edit` restriction it stops with
"Run step 1 (2026-09-30-wikios-rights.sql) first: N protected pages have no edit restriction" and writes nothing. After the
import it writes the protections marker, the SystemConfig row `wikios_protections_imported_at` (`{ at, restrictions }`).
Every process reads it within 15 seconds; until then WikiOS takes no write in either mode. Check it:

```bash
# read-only: expect one row
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c \
  "select value from \"SystemConfig\" where key = 'wikios_protections_imported_at'"
```

**Rollback:** the import only adds rows, and a re-run adds what is missing without overwriting a decision made in
WikiOS. Its group and block rows carry `source = 'mw-import'` (`delete from wiki_user_groups where source = 'mw-import'`,
the same for `wiki_blocks`); the restriction rows it adds are not marked, so undo those from the dump taken in step 1.
Deleting the marker (`delete from "SystemConfig" where key = 'wikios_protections_imported_at'`) makes WikiOS read-only
again within 15 seconds.

## 1c. The api.php session secret (plan 410), before bots use `/w/api.php`

WikiOS serves a MediaWiki-compatible `api.php` at `/w/api.php` for bots (Pywikibot, AWB, the Discord bot). Bot-password
sessions, login tokens and CSRF tokens are HMACs under one key, **`WIKIOS_API_SESSION_SECRET`**:

- **Needed for bots to log in, not for the app to start.** `src/env.ts` treats it as optional, so deploying IxStates
  or WikiOS before it is set takes nothing down. Without it, api.php answers `action=login`, a login token
  (`meta=tokens&type=login`) and any request that carries a session cookie with the MediaWiki error
  `sessionsecretmissing`; it never signs or accepts a session with a fallback key, in development either. Anonymous
  reads (`meta=siteinfo`, `list=allpages`, `action=parse&page=`, ...) keep working, and one warning is logged the first
  time the missing key is needed. Set it before the cutover so bots can log in (step 9's login-token row fails until then).
- **At least 32 characters to be used.** The environment check accepts any value, so a typo never stops a process
  from starting; api.php treats an empty or shorter value as missing (the same `sessionsecretmissing` answers and
  one warning in the log).
- It is a key, not a password: generate it, never type it, and never print it.

```bash
bk "$IX/.env.production.local" env.production.local.1c
grep -c '^WIKIOS_API_SESSION_SECRET=' "$IX/.env.production.local"          # 0 = not set yet; 1 = already there, skip the next line
( umask 077; printf '\nWIKIOS_API_SESSION_SECRET=%s\n' "$(openssl rand -base64 48 | tr -d '\n')" >> "$IX/.env.production.local" )
ls -l "$IX/.env.production.local"                                          # same mode as before (-rw-------)
```

**Changing it later** ends every bot session and invalidates every outstanding token (bots log in again; nothing is
stored that cannot be recreated): rotate it if it may have leaked, then restart IxStates (its usual restart) and
WikiOS (`pm2 restart wikios --update-env`). Bot passwords themselves are not affected: users create them on
`Special:BotPasswords` in WikiOS, and each is stored as a salted scrypt hash.

**Rate limits.** api.php counts requests per client in the buckets `wiki_api`, `wiki_api_write`, `wiki_api_login` and
`wiki_api_render` (limits and keys in [rate-limiting.md](rate-limiting.md#wikios-buckets)); there is nothing to
configure, but a bot that is throttled sees MediaWiki's `ratelimited` error, and a client that logs in over and over sees
`Throttled`. The same file lists the other WikiOS buckets (`wiki_upload`, `wiki_media`, `wiki_export`, `wiki_raw`,
`wiki_read`, `wiki_proxy` and the two webhook ones).

**Rollback:** `sudo cp -a "$BK/env.production.local.1c" "$IX/.env.production.local"` and restart the two processes: bots
get `sessionsecretmissing` again and nothing else changes.

## 2. Deploy IxStates as usual

**Before this deploy:** step 1 (at least `2026-09-30-wikios-api.sql`, see "The data-safety SQL runs before the push"),
and step 1b's `verifiedById` fix-up if the IxnayID identity deploy has not run (the deploy's conversion reads it).

**Before this deploy (launch time), when the release carries the integration and hosts work (plan 2026-10-25):**

1. Step 4's loopback server and its `WIKIOS_MEDIAWIKI_INTERNAL_URL` line. They use plan 417's files, which the checkout
   already holds (step 0). Step 4's bot-login check needs step 3c, so run that check after step 3. Without the variable,
   production renders nothing through MediaWiki: forum posts, template previews and revision views are compiled locally
   until it is set ("Before the cutover" above).
2. Step 6a's app URL check. `NEXT_PUBLIC_APP_URL` is written into the build, so a value fixed after the build needs
   this deploy again, not only a restart.

```bash
( cd "$IX" && bun run deploy:prod )     # scripts/deploy-production.sh (master only; takes its own db backup)
```

After the deploy, check (read-only) that no process logged the loopback warning. Each process logs it once, the first
time it would have rendered without `WIKIOS_MEDIAWIKI_INTERNAL_URL`:

```bash
pm2 logs ixstats-cron --lines 2000 --nostream | grep -c 'WIKIOS_MEDIAWIKI_INTERNAL_URL is not set'     # 0
# and IxStates' own output, wherever its usual start writes it (docs/operations/monitoring.md, Logging strategy): no
# "[WikiOS:render] WIKIOS_MEDIAWIKI_INTERNAL_URL is not set" line
```

A hit means a process started without the variable: fix the env file (step 4) and restart that process.

The release arrives with `WIKIOS_V1_ENABLED` off (see "Before the cutover"); leave it off until step 6b. If `db push`
stops on a unique-constraint warning, the deploy has already run its SQL, the data-safety files included, and left the
live build untouched: read every line, run `bun run db:push:force` by hand and answer yes only if each is an expected
unique constraint on a new column, then run the deploy again.

This also runs `deploy-ixworld.sh`. It does **not** deploy WikiOS: the `wikios` process built in step 5 keeps
serving the code it was built from until `scripts/deploy-wikios.sh` runs again, so run that script after every
IxStates release that touches WikiOS code. `deploy-production.sh` has no lock: never run it while
`deploy-wikios.sh` runs (the WikiOS script refuses to start while `deploy-production.sh` is running).

**Rollback:** the usual IxStates rollback (`bun run deploy:rollback`).

## 2a. Fonts and uploads at the site root (read-only, after step 2)

Some of IxStates' files are asked for at the root of ixwiki.com, without the base path: the reader's fonts
(`src/styles/typography.css` and the font preloads load `/fonts/…`), and uploaded flags and pictures where a page still
shows the stored path (`/images/uploads/…`, kept without the base path). This release gives the WikiOS pages' uploads the
base path, but the fonts still load from the root. Check from the server that both answer (read-only).

This step runs before 4b lets the server's own requests through Cloudflare, so ask the local nginx directly:
`--resolve` sends `ixwiki.com` to `127.0.0.1` and skips Cloudflare. `-k` is there because the origin's certificate may
be Cloudflare's origin certificate, which curl does not trust; the check only reads a status and a content type.

```bash
# the upload directory: UPLOAD_DIR when IxStates' env files set it, else the checkout's public/images/uploads
grep -n '^UPLOAD_DIR=' "$IX/.env.production" "$IX/.env.production.local" 2>/dev/null
UPDIR="$IX/public/images/uploads"          # or the UPLOAD_DIR value the grep printed
UP=$(ls -p "$UPDIR" 2>/dev/null | grep -v / | head -1); echo "upload: '$UP'"
[ -n "$UP" ] || echo "STOP: no upload file found in $UPDIR"
LOCAL='--resolve ixwiki.com:443:127.0.0.1 -k'
curl -s -o /dev/null $LOCAL -A IxStats-Builder -w '%{http_code} %{content_type}\n' 'https://ixwiki.com/fonts/Schibsted%20Grotesk-500.ttf'
curl -s -o /dev/null $LOCAL -A IxStats-Builder -w '%{http_code} %{content_type}\n' "https://ixwiki.com/images/uploads/$UP"
```

If the `echo` printed `STOP`, or the upload name is empty, stop: find an existing upload's file name (an uploaded flag's
`/images/uploads/<file>` in the database, for example) before going on, or the second check reads nothing. Expect `200`
with a font type (`font/ttf`, `application/font-sfnt`, `application/x-font-ttf` or `application/octet-stream`) for the
first, and `200` with an `image/…` type for the second.

- **`000`** (nothing listens for `ixwiki.com` on the server's port 443, so the request never left): run the two `curl`
  lines again without `$LOCAL`, through Cloudflare. There a `403` with `text/html` is Cloudflare's challenge or the bot
  defense, not missing files: finish step 4b first, then repeat this check.
- **A `404`, or a `text/html` answer** (classic MediaWiki's page, or a redirect to it): stop and ask the owner. The usual
  fix is an nginx `location` in the `ixwiki.com` server block that serves the checkout's files, for example
  `location ^~ /fonts/ { alias /ixwiki/public/projects/ixstats/public/fonts/; }` (and the same for `/images/uploads/`).
  The owner decides: do not edit nginx for this yourself.

The `schibsted-punct-*.woff2` fonts are tracked in git now, so the deploy carries them: they no longer need copying by
hand.

## 3. MediaWiki side: the `wikios-mirror` group, the mirror account, its bot password

The group must exist **before** the account is put into it: `createAndPromote --custom-groups` silently ignores a
group that `$wgGroupPermissions` does not define yet (it prints "is not a valid group, ignoring!"). So load the
snippet first.

### 3a. Load the snippet (article path stays `/wiki/`)

```bash
bk /ixwiki/config/LocalSettings.php LocalSettings.php.step3
sudo cp "$IX/scripts/ops/mediawiki/wikios-localsettings.php" /ixwiki/config/wikios-localsettings.php
sudo chmod 644 /ixwiki/config/wikios-localsettings.php
ls -l /ixwiki/config/wikios-localsettings.php        # must be -rw-r--r--: PHP-FPM (www-data) has to read it
php -l /ixwiki/config/wikios-localsettings.php
```

Save classic's canonical link before the change, to compare after the reload (read-only):

```bash
curl -s https://ixwiki.com/wiki/Main_Page | grep -o '<link rel="canonical"[^>]*>' | tee "$BK/canonical.before"
```

Append this one line to `/ixwiki/config/LocalSettings.php`:

```php
require_once '/ixwiki/config/wikios-localsettings.php';
```

The snippet changes neither the article path nor the canonical URL unless `WIKIOS_TAKEOVER` is defined as `true` before
the `require_once` (`define( 'WIKIOS_TAKEOVER', false )` leaves it off), and this launch never defines it (only the
deferred step 8b does). By default it adds the `wikios-mirror` group, the bot-password grants and the file types, and
the save webhook, which sends nothing until step 6
gives PHP-FPM both its secret and its URL. Until then, each web save on classic may write one line to MediaWiki's
`wikios` debug log ("sync-webhook not sent: ... not set"), when `$wgDebugLogGroups['wikios']` is configured; that is
expected.

```bash
php -l /ixwiki/config/LocalSettings.php && sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm
curl -s -o /dev/null -w '%{http_code}\n' https://ixwiki.com/wiki/Main_Page                  # still 200, still MediaWiki
# the canonical link is unchanged (no output from diff):
diff "$BK/canonical.before" <(curl -s https://ixwiki.com/wiki/Main_Page | grep -o '<link rel="canonical"[^>]*>')
# the group now exists and has the intended rights (no editinterface / editsitecss / editsitejs):
curl -s 'https://ixwiki.com/api.php?action=query&meta=siteinfo&siprop=usergroups&format=json' \
  | jq -r '.query.usergroups[] | select(.name=="wikios-mirror") | .rights | join(" ")'
```

If the `diff` prints anything, classic's canonical link moved: roll back at once (the **Rollback** line below) and look
for a `WIKIOS_TAKEOVER` define in `LocalSettings.php`.

The group's rights must include `import importupload move move-subpages suppressredirect delete undelete protect upload reupload`
(plan 407: the mirror repeats WikiOS's moves, deletions, undeletions and protections as this account; without
`delete`, `undelete` and `protect` those jobs end up dead with `permissiondenied`. Plan 411: the mirror's `upload` job
puts the files WikiOS holds in MediaWiki with `action=upload`, which needs `upload`, and `reupload` for a new version of a
file that exists; `upload_by_url` is not needed, the file travels in the request).

**MediaWiki must accept the same file types as WikiOS** (png, jpg, jpeg, gif, webp, svg, pdf; plan 411): the snippet adds
`svg` and `pdf` to `$wgFileExtensions` when they are missing, and a file the wiki cannot take ends the job dead with
`filetype-banned`. `$wgFileExtensions` is classic's setting for every uploader, not only the mirror account, so this is
a change the public does see: from this step, anyone who may upload on classic can upload SVG and PDF files. Check what the wiki accepts and what a bot password may do:

```bash
curl -s 'https://ixwiki.com/api.php?action=query&meta=siteinfo&siprop=fileextensions&format=json' | jq -r '[.query.fileextensions[].ext] | join(" ")'
```

**PHP and nginx must accept an uploaded XML file of at least 16 MB** (the same limits carry the uploads of plan 411: a
file is at most 10,000,000 bytes, sent to MediaWiki as one `action=upload` request). WikiOS mirrors a revision with `action=import`,
which uploads the page as an XML file, and XML escaping makes it bigger than the text: a 2,000,000-character page of
`&` (MediaWiki's page limit is 2 MB) is about 10 MB of XML, and a batch of revisions is capped at about 6 MB. PHP's
default `upload_max_filesize` is 2M. Set both `upload_max_filesize` and `post_max_size` to at least 16M, and check the
`client_max_body_size` of the loopback server of step 4 (WikiOS writes through it, and `wikios-render-internal.conf`
sets 16m) and of the `ixwiki.com` server block (outside bots; nginx's default is 1m). An upload that is too big does not fail quietly: the job's error shows the HTTP status and the start of the
answer, and the job ends up dead for an operator.

```bash
sudo php-fpm8.4 -i 2>/dev/null | grep -E '^(upload_max_filesize|post_max_size)'          # both must show 16M or more
printf 'upload_max_filesize = 16M\npost_max_size = 16M\n' | sudo tee /etc/php/8.4/fpm/conf.d/99-wikios-import.ini
sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm
sudo nginx -T 2>/dev/null | grep -n client_max_body_size                                # the ixwiki.com block: 16m or more (step 4 checks the loopback one)
```

**Rollback:** `sudo cp -a "$BK/LocalSettings.php.step3" /ixwiki/config/LocalSettings.php && sudo rm /ixwiki/config/wikios-localsettings.php && sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm`
(and `sudo rm -f /etc/php/8.4/fpm/conf.d/99-wikios-import.ini`, harmless to keep).

### 3b. Create the account and put it in the group

The account's password is never needed (WikiOS logs in with the bot password), but `createAndPromote` requires one
and takes it as an argument, which `ps` would show. So use a throwaway random value and replace it at once with a
second random value that goes through stdin and is never stored:

```bash
( umask 077
  mwmaint createAndPromote --force --custom-groups wikios-mirror WikiOSMirror "$(openssl rand -hex 24)"
  openssl rand -hex 24 | mwmaint changePassword --user WikiOSMirror --passwordstdin )
# verify the membership (public read-only API; expect "wikios-mirror" among the groups):
curl -s 'https://ixwiki.com/api.php?action=query&list=users&ususers=WikiOSMirror&usprop=groups&format=json' \
  | jq -r '.query.users[0].groups | join(" ")'
curl -s 'https://ixwiki.com/api.php?action=query&list=allusers&augroup=wikios-mirror&format=json' | jq -r '.query.allusers[].name'
```

If `wikios-mirror` is missing from the output, do **not** go on: step 3a did not load (check
`/ixwiki/config/LocalSettings.php`, then repeat the `createAndPromote` line).

**Rollback:** block the account on `Special:Block`, or take every member out of the group with
`mwmaint emptyUserGroup wikios-mirror` and re-run the membership check; nothing public depends on the account yet.

### 3c. Bot password, straight into the WikiOS environment

`createBotPassword` without a password argument generates one and prints it, so nothing secret is passed on a
command line and this password differs from the account's. Capture the output in a 0600 file, move the password
into `.env.production.local`, and destroy the file:

```bash
bk "$IX/.env.production.local" env.production.local
OUT=$(mktemp)
( umask 077
  mwmaint createBotPassword --appid wikios \
    --grants basic,highvolume,editpage,editprotected,createeditmovepage,uploadfile,uploadeditmovefile,import,delete,protect \
    WikiOSMirror > "$OUT" )
grep -c '^Success' "$OUT"                              # must print 1
TOKEN=$(sed -n "s/^Log in using username:'[^']*' and password:'\(.*\)'\.$/\1/p" "$OUT")
( umask 077; printf '\nWIKIOS_MEDIAWIKI_BOT_USER=WikiOSMirror@wikios\nWIKIOS_MEDIAWIKI_BOT_TOKEN=%s\n' "$TOKEN" >> "$IX/.env.production.local" )
unset TOKEN; shred -u "$OUT"
ls -l "$IX/.env.production.local"                      # still -rw------- (or the mode it had)
```

The grants are the ones a bot password can express for the group (`editsemiprotected` comes with `basic`; the move
rights, `suppressredirect` included, come with `createeditmovepage`; `delete` carries delete and undelete, `protect`
protection, for the page-operation mirror jobs of plan 407).
`editprotected`, `import` and `importupload` are intentional: see the comments in
`scripts/ops/mediawiki/wikios-localsettings.php`. **No** `editinterface` or `editsiteconfig`: WikiOS keeps
`Template:` and `Module:` admin-only, and `MediaWiki:` pages are classic-only for everyone, administrators included (spec
A8). WikiOS refuses every save, move, delete and protect of a `MediaWiki:` page, and a `MediaWiki:` page in a web XML
import (`/util/import`), with "MediaWiki: pages are edited on classic ixwiki.com, and WikiOS takes them from there."
Classic's versions come over through the inbound sync and the command-line import of classic's dump (step 5). The
mirror account never writes one either.

`WIKI_SYNC_WEBHOOK_SECRET` (at least 32 characters) already exists in that file; step 6 gives MediaWiki the same value.

**Rollback:** restore `sudo cp -a "$BK/env.production.local" "$IX/.env.production.local"`, and delete the bot password
on `Special:BotPasswords` while logged in as `WikiOSMirror` (or block the account). Nothing public depends on it yet.

### 3d. Create `Template:Sister` on classic

Cross-wiki transclusion is written as an ordinary template, `{{Sister|iiwiki|Title}}` (spec C4), optionally with
`section=Heading`, `infobox=yes` or `card=yes`. Classic shows it as a small link box ("From IIWiki: Title"). WikiOS shows
the live embed over the same box: it reads that wiki's page through the wiki's own parser, keeps it about an hour, and
says "<Wiki> could not be reached just now" in its place when the wiki does not answer. The box carries four
attributes, `data-sister-wiki`, `data-sister-title`, `data-sister-mode` and `data-sister-section`, and the WikiOS reader
mounts the embed from exactly those (`src/tests/scripts/template-sister.test.ts` pins the contract). WikiOS renders
through classic, so the template must exist there.

The text is the tracked file `scripts/ops/mediawiki/Template-Sister.wikitext`, which step 2 deployed with the checkout.
The template namespace is admin-only, so save it as an administrator with MediaWiki's `edit` script (launch-time), or
paste the file's text on classic as an administrator:

```bash
mwmaint edit --user '<your admin name>' --summary 'Sister wiki link box' Template:Sister < "$IX/scripts/ops/mediawiki/Template-Sister.wikitext"
```

Check what classic renders (read-only). The title is not looked up here, so any title will do:

```bash
curl -s 'https://ixwiki.com/api.php?action=parse&text=%7B%7BSister%7Ciiwiki%7CCaphiria%7Csection%3DHistory%7D%7D&contentmodel=wikitext&format=json' \
  | jq -r '.parse.text["*"]' | grep -o 'data-sister-[a-z]*="[^"]*"'
```

It must print four lines: `data-sister-wiki="iiwiki"`, `data-sister-title="Caphiria"`, `data-sister-mode="section"` and
`data-sister-section="History"`. Fewer lines mean classic dropped the attributes, or the saved page is not the tracked
file: compare the page's text on classic with the file, and stop and ask the owner if they match and the attributes are
still missing. Without them WikiOS shows the plain link box and no embed.

A command-line edit does not call the webhook; the `wiki-recentchanges` job brings the page into WikiOS within 10
minutes. **Rollback:** delete `Template:Sister` on classic. Pages that use it then show a red template link on both
wikis.

### 3e. The sister interwiki prefixes on classic (owner decision 2026-10-25)

Classic gets two interwiki prefixes, so editors can write `[[iiwiki:Title]]` and `[[althistory:Title]]`. Classic renders
them as `extiw` links to the same absolute URLs an external link uses, and WikiOS opens both forms in its own reader.
Pages written with external links before this step keep working. Everything here is launch-time.

Check first (read-only). This must print nothing:

```bash
curl -s 'https://ixwiki.com/api.php?action=query&meta=siteinfo&siprop=interwikimap&format=json' \
  | jq -r '.query.interwikimap[] | select(.prefix=="iiwiki" or .prefix=="althistory") | "\(.prefix) \(.url)"'
```

If it prints a prefix with the URL given below (`https://iiwiki.com/wiki/$1` or `https://althistory.fandom.com/wiki/$1`),
skip that one. If it prints a prefix with any other URL, stop and ask the owner: editors already use that prefix.

Then read how classic keeps its interwikis, as MediaWiki itself sees its settings (read-only). The one line of PHP goes
to the `eval` script on stdin:

```bash
echo '$c = MediaWiki\MediaWikiServices::getInstance()->getMainConfig(); echo json_encode( [ "InterwikiCache" => $c->get( "InterwikiCache" ), "InterwikiExpiry" => $c->get( "InterwikiExpiry" ), "MainCacheType" => $c->get( "MainCacheType" ), "MainWANCache" => $c->get( "MainWANCache" ), "DBname" => $c->get( "DBname" ), "DBprefix" => $c->get( "DBprefix" ) ] ), "\n";' | mwmaint eval
curl -s 'https://ixwiki.com/api.php?action=query&meta=siteinfo&siprop=extensions|usergroups&format=json' \
  | jq -r '"Interwiki extension: \([.query.extensions[] | select(.name=="Interwiki")] | length)", "groups with the interwiki right: \([.query.usergroups[] | select(.rights | index("interwiki")) | .name] | join(" "))"'
```

- **`InterwikiCache` is not `false`:** stop and ask the owner. Classic then reads its interwikis from a fixed file or
  array, not from the `interwiki` table, so neither way below has any effect.
- **The Interwiki extension is loaded (`1`) and a group you belong to has the `interwiki` right:** add both entries on
  classic's `Special:Interwiki`. Prefix `iiwiki`, URL `https://iiwiki.com/wiki/$1`, API `https://iiwiki.com/api.php`.
  Prefix `althistory`, URL `https://althistory.fandom.com/wiki/$1`, API `https://althistory.fandom.com/api.php`. Leave
  "forward" and "transclude" unticked, and the wiki ID empty. The form clears the interwiki cache itself, so go
  straight to the verification below. (The form keeps its own log, and you take no dump.)
- **Otherwise** (no extension, or nobody holds the right), insert the rows through the wiki's database client. Do not
  grant the right in `LocalSettings.php` for this. The commands below use `mysql ixwiki`, as step 7 does: the database
  name is the `DBname` printed above, and if `DBprefix` is not empty, put it in front of `interwiki`. The client takes
  its credentials from your `~/.my.cnf` (or use `sudo mysql` with socket authentication); never pass `-p<password>`.

  ```bash
  ( umask 077; mysqldump --single-transaction ixwiki interwiki > "$BK/interwiki.3e.sql" ) && ls -l "$BK/interwiki.3e.sql"
  mysql ixwiki <<'SQL'
  INSERT INTO interwiki (iw_prefix, iw_url, iw_api, iw_wikiid, iw_local, iw_trans) VALUES
    ('iiwiki', 'https://iiwiki.com/wiki/$1', 'https://iiwiki.com/api.php', '', 0, 0),
    ('althistory', 'https://althistory.fandom.com/wiki/$1', 'https://althistory.fandom.com/api.php', '', 0, 0);
  SQL
  ```

  Leave out the row of a prefix the first check said to skip. Then clear the interwiki cache. MediaWiki keeps each
  prefix's lookup, a miss included, in its main object cache for `InterwikiExpiry` seconds (printed above; 10800, three
  hours, is the default). The lookup's own `invalidateCache` deletes those keys:

  ```bash
  echo '$l = MediaWiki\MediaWikiServices::getInstance()->getInterwikiLookup(); foreach ( [ "iiwiki", "althistory" ] as $p ) { $l->invalidateCache( $p ); } echo "cleared\n";' | mwmaint eval
  ```

  That reaches the web requests' cache when it is shared with the command line: memcached (`MainCacheType` 2, or a
  memcached name), the database (1) or Redis. If `MainCacheType` printed 3 (`CACHE_ACCEL`) or names APCu, the web
  requests keep their own cache in PHP-FPM's memory, which the command line cannot reach: reload PHP-FPM as well,
  `sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm`. With 0 (`CACHE_NONE`) nothing is cached. If the
  verification below still fails after this, wait `InterwikiExpiry` seconds and check again; if it fails then, stop and
  ask the owner.

Verify (read-only). The siteinfo check at the top of this step now prints both prefixes with their URLs, and classic
renders both links as `extiw` links to the sister wikis:

```bash
curl -s 'https://ixwiki.com/api.php?action=parse&text=%5B%5Biiwiki%3ACaphiria%5D%5D%20%5B%5Balthistory%3AMain%20Page%5D%5D&contentmodel=wikitext&format=json' \
  | jq -r '.parse.text["*"]' | grep -o '<a [^>]*class="extiw"[^>]*>'
#   two links: href="https://iiwiki.com/wiki/Caphiria" and href="https://althistory.fandom.com/wiki/Main_Page"
```

A page that already held `[[iiwiki:...]]` or `[[althistory:...]]` was rendered as a red link to a local page, and keeps
that render until it is edited or purged. List them (read-only; MediaWiki 1.45 keeps link targets in `linktarget`):

```bash
mysql ixwiki -e "SELECT DISTINCT p.page_namespace, p.page_title FROM pagelinks pl
  JOIN linktarget lt ON lt.lt_id = pl.pl_target_id JOIN page p ON p.page_id = pl.pl_from
  WHERE lt.lt_namespace = 0 AND (lt.lt_title LIKE 'Iiwiki:%' OR lt.lt_title LIKE 'Althistory:%')"
```

Purge each page it lists (`?action=purge` on classic). WikiOS needs nothing more: its copies re-render after step 6b
anyway (step 7b), through classic, which knows the prefixes by then.

**Rollback:** delete the two entries on `Special:Interwiki`, or through the database client
(`DELETE FROM interwiki WHERE iw_prefix IN ('iiwiki','althistory');`, the dump in `$BK/interwiki.3e.sql` shows the table
as it was), then clear the cache the same way. Links written with the prefixes meanwhile show as red links again.

## 4. Private render engine on loopback

```bash
ss -ltn | grep -E ':8081 ' ; echo "exit=$?"                          # must print nothing and exit=1: the port is free
grep -nE '^\s*root\s' "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"   # the MediaWiki doc root of the public vhost
sudo cp "$IX/scripts/ops/nginx/wikios-render-internal.conf" /etc/nginx/conf.d/wikios-render-internal.conf
sudoedit /etc/nginx/conf.d/wikios-render-internal.conf               # set `root` to the value printed above
sudo nginx -t && sudo systemctl reload nginx
ss -ltnp | grep ':8081'                                              # must show 127.0.0.1:8081 only
curl -s 'http://127.0.0.1:8081/api.php?action=parse&text=%7B%7B%23expr%3A2%2B3%7D%7D&contentmodel=wikitext&format=json' | head -c 300
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/index.php    # 404: only api.php and load.php are served
```

This server carries more than renders: every server-side call to IxWiki's MediaWiki goes through it (plan 415), among them
the mirror's bot login and its `action=edit`, `action=import` (the page as an XML upload of up to about 10 MB) and
`action=upload` POSTs (plans 407 and 411). That is why its `client_max_body_size` is `16m`, matching the PHP limits of
step 3: at 8m a big import would die with a bare 413. It is also why its `/api.php` `fastcgi_read_timeout` is `130s`, just
over the mirror's 120 s import timeout (`IMPORT_TIMEOUT_MS`). PHP-FPM's `max_execution_time` for that pool (or its
`request_terminate_timeout`, whichever the pool uses) must also allow at least about 130 s for imports, or PHP cuts a big import
off first. Check the installed limit, and prove a bot login works through the loopback, with the password read from the env
file into a shell variable, never typed or echoed (it reaches `curl` on stdin, not on its command line):

```bash
sudo nginx -T 2>/dev/null | awk '/listen 127.0.0.1:8081/,/^}/' | grep client_max_body_size   # 16m
curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:8081/api.php?action=query&meta=siteinfo&format=json'   # must be 200, not 301 (see the warning)
BOT_USER=$(grep '^WIKIOS_MEDIAWIKI_BOT_USER=' "$IX/.env.production.local" | cut -d= -f2-)
BOT_PASS=$(grep '^WIKIOS_MEDIAWIKI_BOT_TOKEN=' "$IX/.env.production.local" | cut -d= -f2-)
JAR=$(mktemp); chmod 600 "$JAR"
LT=$(curl -s -c "$JAR" 'http://127.0.0.1:8081/api.php?action=query&meta=tokens&type=login&format=json' | jq -r '.query.tokens.logintoken')
printf '%s' "$BOT_PASS" | curl -s -b "$JAR" -c "$JAR" -d action=login -d format=json \
  --data-urlencode "lgname=$BOT_USER" --data-urlencode "lgtoken=$LT" --data-urlencode 'lgpassword@-' \
  http://127.0.0.1:8081/api.php | jq -r '.login.result'                  # must print Success
unset BOT_PASS BOT_USER LT; shred -u "$JAR"
```

**Warning: `$wgForceHTTPS`.** If `LocalSettings.php` sets `$wgForceHTTPS = true`, MediaWiki answers a plain-http loopback request with
a redirect to https, and every call of the mirror, the inbound sync and the renderer then fails (a 301 is not an
answer to `action=parse`, and a login POST does not survive it). Confirm the siteinfo request above prints `200`, not `301`.
If it prints `301`, stop here: the loopback needs `$wgForceHTTPS` off (or a condition that spares requests from 127.0.0.1)
before the next step.

The parse call must return JSON containing `"parse"`. Then add this line to `$IX/.env.production.local` by hand (back
it up first: `bk "$IX/.env.production.local" env.production.local.step4`):

```
WIKIOS_MEDIAWIKI_INTERNAL_URL=http://127.0.0.1:8081/api.php
```

(IxStates reads it too and starts rendering through loopback after its next restart; the `wikios` ecosystem file sets
it as well. The mirror's writes and the inbound sync's reads use it too, since every server-side call to IxWiki's MediaWiki
does (plan 415), unless `WIKIOS_MEDIAWIKI_API` names another `api.php` for the mirror; before, they went to the public host,
which after the takeover is WikiOS's own `/api.php`.)

Run the first block of this step and the env line before step 2's deploy (step 2 says why); the bot-login check above
waits for step 3c. If step 2 has already run, restart `ixstats-cron` (`pm2 restart ixstats-cron --update-env`) and
IxStates (its usual restart) now, so both read the line.

**`WIKIOS_MEDIAWIKI_API` in production must be a loopback or private host.** Check it (read-only):

```bash
grep -n '^WIKIOS_MEDIAWIKI_API=' "$IX/.env.production" "$IX/.env.production.local" 2>/dev/null   # nothing, or a 127.0.0.1 / private address
```

A value on the public wiki host (`https://ixwiki.com/api.php`, its `www.` alias, or `//ixwiki.com/...`) is refused: the
mirror waits and its admin section names the variable. So is a value that is IxStates itself, where the mirror would
write into WikiOS: a path under the base path (`http://127.0.0.1:3550/projects/ixstates/w/api.php`) or a loopback host on
IxStates' port (`PORT`, else 3550). `WIKIOS_MEDIAWIKI_INTERNAL_URL` is held to the same two rules: on the public wiki host
it counts as unset. Delete the line (back the file up with `bk` first), and the mirror
writes through the internal URL above.

**Rollback:** `sudo rm /etc/nginx/conf.d/wikios-render-internal.conf && sudo nginx -t && sudo systemctl reload nginx`, and
restore `"$BK/env.production.local.step4"` over `$IX/.env.production.local`.

## 4b. Let the server's own requests through (before step 6b)

Some of IxStates' server-side calls still reach classic through its public host, through Cloudflare and nginx: the media
proxy (images and file pages; the loopback serves only `api.php` and `load.php`), and, whenever
`WIKIOS_MEDIAWIKI_INTERNAL_URL` is missing, the low-volume reads that keep the public fallback (inbound sync, lore cards,
the Lorewards fallback, account proof). They come from the server's own
address and send `User-Agent: IxStats-Builder`. The bot-defense daemon and fail2ban must never block them. Everything
here is launch-time.

Find the server's egress addresses (read-only):

```bash
curl -4 -s https://ifconfig.me; echo            # the IPv4 address
curl -6 -s https://ifconfig.me || true; echo    # the IPv6 address, or nothing when the server has none
```

**The bot-defense daemon.** First see what its configuration offers (read-only):

```bash
sudo grep -nE 'WHITELIST|ALLOW|IGNORE|TRUSTED' /etc/ixwiki-defense.conf
sudo grep -nE 'WHITELIST|whitelist|ALLOW|ignore' /usr/local/bin/ixwiki-bot-defense.sh
```

The configuration needs both an IP whitelist and a user-agent whitelist that the script reads. **If either is missing,
stop and ask the owner.** Never edit the daemon script blind. Otherwise:

```bash
bk /etc/ixwiki-defense.conf ixwiki-defense.conf.4b
sudoedit /etc/ixwiki-defense.conf
#   IP whitelist: add 127.0.0.1, ::1 and the egress addresses printed above
#   user-agent whitelist: add IxStats-Builder
sudo systemctl restart ixwiki-bot-defense
/usr/local/bin/ixwiki-bot-defense.sh status      # none of those addresses is listed as blocked
```

If one is listed as blocked, unblock it the way the daemon's `status` output says, and remove any IP Access Rule it pushed
to Cloudflare (Security, WAF, Tools).

**fail2ban.** Read what the jails ignore now (read-only), then add the same addresses to each of the three ixwiki jails:

```bash
for j in ixwiki-bots ixwiki-diff ixwiki-probe; do echo "$j: $(sudo fail2ban-client get "$j" ignoreip | tr '\n' ' ')"; done
bk /etc/fail2ban/jail.d/ixwiki-bots.conf ixwiki-bots.jail.conf.4b
sudoedit /etc/fail2ban/jail.d/ixwiki-bots.conf
#   in each of [ixwiki-bots], [ixwiki-diff] and [ixwiki-probe] (keep any address the loop above printed):
#     ignoreip = 127.0.0.1/8 ::1 <ipv4> <ipv6>
sudo fail2ban-client reload
for j in ixwiki-bots ixwiki-diff ixwiki-probe; do echo "$j: $(sudo fail2ban-client get "$j" ignoreip | tr '\n' ' ')"; done
```

The line goes into each jail rather than a `[DEFAULT]` section of this file: fail2ban reads `jail.local` after
`jail.d/*.conf`, so a `[DEFAULT]` `ignoreip` set in `jail.local` would replace one set here, and a `[DEFAULT]` here would
also change every other jail, `sshd` included. Leave out `<ipv6>` when the server has none.

**nginx's static and dynamic block lists** must not match the server's user agent (read-only; must print nothing):

```bash
grep -niE 'builder|ixstats' /etc/nginx/conf.d/ixwiki-bots.conf /etc/nginx/conf.d/ixwiki-dynamic-bots.conf
```

If it prints a line, stop and ask the owner before changing either list.

**Cloudflare,** from the server, with the server's user agent (read-only):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -A IxStats-Builder 'https://ixwiki.com/wiki/Special:FilePath/<an existing file>'
```

200 or 302 is right. A 403 or 503 means Cloudflare challenged the server: the owner adds an IP Access Rule (Allow) for
the egress addresses in the Cloudflare dashboard (Security, WAF, Tools), then run the `curl` again.

**The mirror is no longer waiting.** After IxStates and `ixstats-cron` have restarted with step 4's env line, open
`/admin/wikios-settings`. The MediaWiki Mirror Outbox section shows no "The mirror waits for
WIKIOS_MEDIAWIKI_INTERNAL_URL" banner, and the Editing section's list of what is missing no longer names
`WIKIOS_MEDIAWIKI_INTERNAL_URL`. That banner means the process still runs without the variable: in production WikiOS
renders nothing through MediaWiki without it, and the mirror waits.

**Rollback:** `sudo cp -a "$BK/ixwiki-defense.conf.4b" /etc/ixwiki-defense.conf && sudo systemctl restart ixwiki-bot-defense`, and
`sudo cp -a "$BK/ixwiki-bots.jail.conf.4b" /etc/fail2ban/jail.d/ixwiki-bots.conf && sudo fail2ban-client reload`. Delete
any Cloudflare IP Access Rule added here in the dashboard.

## 4c. The sister wikis answer the server (read-only)

IxStates reads IIWiki and the AltHistory Wiki from the server: their pages, previews and embeds, and the public
`api.php` proxy. Everything here is read-only, and launch-time.

Production reads iiwiki directly. The relay at maps.ixwiki.com is for development only, so no production env file may
name it (each must print nothing):

```bash
grep -n '^IIWIKI_DEV_PROXY_URL=' "$IX/.env.production" "$IX/.env.production.local" 2>/dev/null
grep -n 'IIWIKI_DEV_PROXY_URL' "$IX/ecosystem.config.cjs"
```

If a line prints, stop and ask the owner before removing it.

From the server, with the server's user agent:

```bash
for u in 'https://iiwiki.com/api.php' 'https://althistory.fandom.com/api.php'; do
  curl -s -o /dev/null -w "%{http_code} %{content_type} $u\n" -A IxStats-Builder "$u?action=query&meta=siteinfo&format=json"
done
```

Each line must start `200 application/json`.

- **A `403`, or `text/html`, from iiwiki** is its Cloudflare challenge: the server's egress address (printed in step 4b) is
  not allowlisted there. Stop and tell the owner, who asks iiwiki's administrators to allow that address with the
  `IxStats-Builder` agent. Nothing on this server changes. The launch can go on meanwhile: WikiOS says "IIWiki could not
  be reached just now" on iiwiki pages, previews and embeds, and its breaker keeps the attempts down to one probe every
  few minutes (step 10).
- **Anything else that is not `200 application/json` from the AltHistory Wiki:** tell the owner the same way. Fandom
  answers the server directly, with nothing to allowlist, so a failure there is usually Fandom's own.

After step 6b, IxStates' `api.php` proxy, on loopback under its base path (use `/projects/ixstats` instead if that is the
one that answered in step 6):

```bash
for w in iiwiki althistory; do
  echo "== $w"
  curl -s -D - -o /dev/null "http://127.0.0.1:3550/projects/ixstates/api/mediawiki/$w/api.php?action=query&titles=Main_Page&format=json" \
    | grep -iE '^(HTTP/|cache-control|vary|retry-after):'
done
```

Each must show a `200`, `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=600`, and a `Vary` line
that names `Origin`: a success is cached for five minutes and never handed to another origin. A failure is never cached:

- **`503`** with `Cache-Control: no-store` and `Retry-After: 30`: the wiki could not be reached, or its breaker is open.
  Repeat the server check above.
- **`429`** with `Cache-Control: no-store` and a `Retry-After`: the wiki said busy, or the proxy's own limit refused the
  call. Wait the seconds it names and try once more.

Then open one iiwiki page in the reader, `$IXSTATES_URL/wiki/<an iiwiki title>?source=iiwiki` (step 6a says how to set
`IXSTATES_URL`): it renders. A title that does not exist on iiwiki says not found. Neither says "could not be reached".

**Rollback:** nothing to roll back (read-only).

**Note (no launch step): the development relay.** The `api.php` proxy that IxWorld serves at maps.ixwiki.com, the relay
development uses for iiwiki, gets the guard and the cache headers above at IxWorld's next ordinary deploy
(`scripts/deploy-ixworld.sh`). `deploy-production.sh` runs that script, so step 2's deploy normally brings them along;
nothing in the launch depends on it, and `ALLOWED_API_PARAMS` is unchanged. That list does not
carry `rvlimit` or `rvdir`, so the relay drops them, and an iiwiki page's author line in development shows only its
latest revision. Production reads iiwiki directly and is not affected. Fixing it in development means adding both to
`ALLOWED_API_PARAMS` (`src/app/api/mediawiki/_config.ts`) in a later release and deploying IxWorld; the owner decides.

## 5. Build and start the WikiOS process

**Deferred takeover step: not run at this launch** (see "Order matters").

**IxStates is degraded while `deploy-wikios.sh` builds.** Like `deploy-ixworld.sh`, it moves the IxStates `.next`
aside for the length of the build (several minutes) and restores it afterwards: routes IxStates has not served since
its last start fail and its static chunks 404 meanwhile. Run it off-peak. (Building elsewhere needs a separate copy
of the checkout and `node_modules`; that was judged not worth the risk of an untested build layout.)

**Find the IxStates URL that works.** Production nginx proxies `location ^~ /projects/ixstats` to port 3550, but the
repo's `next.config.js` and deploy scripts use the base path `/projects/ixstates`. Only one of the two answers:

```bash
curl -sI -o /dev/null -w '/projects/ixstats/  -> %{http_code}\n' https://ixwiki.com/projects/ixstats/
curl -sI -o /dev/null -w '/projects/ixstates/ -> %{http_code}\n' https://ixwiki.com/projects/ixstates/
```

The working one answers 200 or a redirect (307/308) to a page; the other answers 404 from MediaWiki. Use the working
one as `IXSTATES_URL` below; the WikiOS build has no default and refuses to start a redirect without it.

```bash
IXSTATES_URL=https://ixwiki.com/projects/ixstates       # <- the one that worked above, no trailing slash
```

`next.config.js` is tracked in git, and it does not carry the WikiOS edits yet: make the edits of
`deploy/wikios/next-config-snippet.md` (WikiOS branch in `resolveBasePath()`, early `return []` in `rewrites()`) in a
commit that this release carries. Do not edit the server's copy by hand: `deploy-production.sh` runs `git reset --hard`
and `git clean -fd` in `$IX`, so the next IxStates deploy would undo it. Check the file, then install the PM2 file, the
runtime env and the **build** env, and deploy.

**Two more prerequisites of this build.** Both are tracked in git now (`next.config.js`, and the font since 2026-10-06),
so check that the checkout has them:

1. **`optimizePackageImports` (plan 413).** In the same `next.config.js`, add `"iconoir-react"` and `"motion/react"` to the
   `experimental.optimizePackageImports` array. Every WikiOS page imports icons from `iconoir-react` (plan 413 measured about
   7 MB of dev chunks from it on the wiki route without the entry), and the root layout imports `motion` on every page.
   The entry is `"motion/react"`, not `"motion"`: every import in the code is `from "motion/react"`, and Next matches the
   specifier exactly, so a bare `"motion"` entry would do nothing. The file is the one the IxStates build reads too: the
   entries are harmless there, and the next IxStates deploy picks them up. Check:

   ```bash
   grep -n '"iconoir-react"\|"motion/react"' "$IX/next.config.js"   # expect two lines, both inside optimizePackageImports
   ```

2. **The brand font.** `public/fonts/HostGrotesk/HostGrotesk[wght].ttf` must exist in `$IX`. The `(wiki-os)` layout loads it
   with `next/font/local`, which resolves the file at build time and **fails the build** when it is missing. The checkout
   carries it; if it is missing, the checkout is older than the font commit:

   ```bash
   ls -l "$IX/public/fonts/HostGrotesk/HostGrotesk[wght].ttf"      # must list the file (the quotes keep the shell from globbing the brackets)
   ```

```bash
bk "$IX/next.config.js" next.config.js
git -C "$IX" status --short next.config.js      # nothing: the file is the committed one, with the edits above
( cd "$IX" && NODE_ENV=production NEXT_PUBLIC_WIKIOS_STANDALONE=true node --input-type=module -e \
    'const { default: c } = await import("./next.config.js"); console.log(JSON.stringify(c.basePath), c.assetPrefix)' )
# expect:  "" undefined

sudo mkdir -p "$WK" && sudo chown "$USER": "$WK"
cp "$IX/deploy/wikios/ecosystem.wikios.config.cjs.example" "$WK/ecosystem.wikios.config.cjs"
ln -sfn "$IX/.env.production.local" "$WK/.env.production.local"           # runtime secrets, shared with IxStates
( umask 077; printf 'NEXT_PUBLIC_IXSTATES_URL=%s\n' "$IXSTATES_URL" > "$WK/.env.wikios-build" )   # build-time, WikiOS only
ls -l "$WK"

# Uploads (plan 411): WIKIOS_UPLOAD_DIR is set at launch, in step 6a. This process reads the same env file (linked above),
# so it uses the same directory as IxStates: check it is there.
grep -c '^WIKIOS_UPLOAD_DIR=' "$IX/.env.production.local"          # 1 (step 6a)

"$IX/scripts/deploy-wikios.sh"      # builds (several GB of RAM), rsyncs, pm2 startOrReload --update-env, health probe
pm2 status wikios
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3560/wiki/Main_Page
```

> **Warning: never put `NEXT_PUBLIC_WIKIOS_STANDALONE` into `.env.production` or `.env.production.local`.**
> `deploy-production.sh` exports those files into the IxStates build, which would turn IxStates itself into a WikiOS
> that redirects everything else. The flag is set by `deploy-wikios.sh` (build) and the ecosystem file (runtime)
> only, and the script refuses to run if it finds the flag in an env file. `NEXT_PUBLIC_IXSTATES_URL` lives in
> `$WK/.env.wikios-build`, read by that script only.

The script saves and restores the IxStats `.next` and, on a failed health probe, rolls back to the previous release;
on the **first** deploy there is none, so it says so and leaves the new release in place for inspection (`pm2 logs
wikios`). Private and loopback only: `HOSTNAME=127.0.0.1` in the ecosystem file, nothing public points at port 3560 yet.

### Before a full XML import: the dump must be classic's (spec A8)

WikiOS imports only classic MediaWiki's own dumps: the `<siteinfo>` must be there, its `<generator>` must start with
`MediaWiki `, and, for IxWiki, its `<base>` must be on classic's host (the host of `NEXT_PUBLIC_MEDIAWIKI_URL`,
`ixwiki.com`). The `www.` alias (`https://www.ixwiki.com/...`) and a protocol-relative base (`//ixwiki.com/...`) are
accepted. Any other host refuses the whole dump: the summary has one `(dump)` error and nothing is written, in a dry run
too. Check the head of the dump before the full import:

```bash
zcat -f /tmp/ixwiki.xml.gz | head -c 20000 | grep -m2 -oE '<(generator|base)>[^<]*</(generator|base)>'
# expect:  <generator>MediaWiki 1.45.1</generator>  and  <base>https://ixwiki.com/wiki/Main_Page</base>
```

A WikiOS export (`Special:Export`, generator `WikiOS 1`) cannot be imported back, by design: a page must come from
classic, or it would exist in WikiOS but never on classic. A sister wiki's dump (`--source iiwiki` or `althistory`) is held
to the first two rules only.

### Optional: raise the web XML import limit

The admin page `/util/import` (route `POST /api/wiki/import`) takes a MediaWiki XML dump, plain or gzipped, as the
raw request body and streams it into the importer. It accepts **up to 10 MB** (the code's limit is 9.5 MiB of body),
and says so; anything larger is imported from the command line, which has no limit and streams the file:

```bash
bun scripts/wikios-import-xml.ts /tmp/ixwiki.xml.gz --dry-run       # read only: what would happen
bun scripts/wikios-import-xml.ts /tmp/ixwiki.xml.gz --yes           # writes to the database in DATABASE_URL
```

The limit is 9.5 MiB, not 10, because Next.js clones every request body for its proxy and caps the clone at
`experimental.proxyClientMaxBodySize` (**10 MiB by default**): a body above that arrives silently truncated, which the
route could not tell from a cut-off dump. Staying under the cap keeps "too large" a clear HTTP 413.

Raising it is an **optional operator step** (skip it unless admins really need bigger uploads in the browser):

1. In `next.config.js` (the file edited above, in a commit), set the Next.js cap to the new size, e.g. 50 MiB:

   ```js
   experimental: {
     // ...existing experimental options...
     proxyClientMaxBodySize: "50mb",
   },
   ```

2. Set the route's own limit **below** it (by at least 0.5 MiB: the default is 9.5 against 10), in
   the runtime env of the WikiOS process (`$WK/.env.production.local` is shared with IxStates, so put it in the
   `env` block of `$WK/ecosystem.wikios.config.cjs`):

   ```js
   WIKIOS_IMPORT_MAX_BYTES: String(49.5 * 1024 * 1024),   // 51904512; unset = 9.5 MiB
   ```

3. `pm2 startOrReload "$WK/ecosystem.wikios.config.cjs" --update-env`, then rebuild (`next.config.js` changed) with
   `"$IX/scripts/deploy-wikios.sh"`. The import page reads the limit from the server, so it states the new number.

Both numbers must move together: a route limit at or above the Next.js cap reintroduces silent truncation. A gzipped
dump is bounded twice, by the bytes sent (this limit) and by what it expands to (256 MiB, fixed in the route).

### The upload limit (plan 411): 10,000,000 bytes, and what must move with it

The web upload (`POST /api/wiki/upload`, the Insert Image dialog, `/util/upload`) and api.php's `action=upload` take a file
of **at most 10,000,000 bytes** (`MAX_UPLOAD_BYTES` in `src/lib/wiki-os/config.ts`; the limit is a decimal 10 MB, below the
10 MiB cap). The file is the raw request body (api.php: a multipart body of the file plus up to 64 KiB of fields), counted as it
streams. **Raising the limit means raising these, in this order, before the code constant:** (1) the Next.js
`experimental.proxyClientMaxBodySize` in `next.config.js` (above: Next clones the body for its proxy and
truncates the clone at that size, which no route can tell from a cut-off file); (2) nginx `client_max_body_size` for
`/api/wiki/upload` and `/w/` (`wikios-takeover.conf`: 11m now) and for MediaWiki's own `api.php` (the mirror sends the same
bytes); (3) PHP `upload_max_filesize` and `post_max_size` (16M now) and MediaWiki's `$wgMaxUploadSize`; only then the
constant. A raster of more than 12.5 megapixels is refused as too large (MediaWiki's `$wgMaxImageArea` default: it cannot thumbnail
a bigger one); if the wiki's `LocalSettings.php` raised `$wgMaxImageArea`, set `WIKIOS_MAX_IMAGE_AREA` (pixels) in the same
env file to the same number, or WikiOS refuses what MediaWiki would take. An SVG is refused above 5,000,000 bytes (the scan that proves it safe costs about a second at 10 MB; MediaWiki
deployments commonly cap SVGs at a few megabytes): set `WIKIOS_MAX_SVG_BYTES` (bytes) in the same env file to change it. It cannot
go above the 10,000,000-byte upload limit, which holds first. The upload directory is `WIKIOS_UPLOAD_DIR` (step 6a); the admin panel's mirror section says how many uploaded
files MediaWiki does not hold yet, and until it says none, that directory is the only copy of them. Once an hour the mirror worker deletes files in it that are older than 24 hours and that no asset is served from and no unfinished upload job (a dead one included) names: the leftovers of a crash between staging and the database commit.

**Rollback:** `pm2 delete wikios && pm2 save`. The `next.config.js` edits do not affect the IxStates build; to take them
out, revert their commit (the copy in `$BK/next.config.js` shows the file as it was).

## 5b. Lead-image paths (plan 418, optional, after the code is deployed)

At this launch that is after step 2's deploy; step 5 is not run.

`2026-09-30-wikios-lead-image-canonical-path.sql` rewrites the stored `wiki_articles."leadImageUrl"` values to the canonical
`/images/<shard>/<File>` path. Its header says to run it once **after the code is deployed**, which is why step 1 leaves it
out; it is optional (the code reads both forms, so nothing breaks if it is never run). Preview what it would change (changes
nothing), then apply it:

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c \
  "SELECT \"title\", \"leadImageUrl\" FROM wiki_articles WHERE \"leadImageUrl\" ~ '/images/[0-9a-f]/[0-9a-f]{2}/' AND \"leadImageUrl\" NOT LIKE '/images/%' LIMIT 50"
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < "$IX/prisma/manual-migrations/2026-09-30-wikios-lead-image-canonical-path.sql"
```

**Rollback:** restore the dump taken in step 1 (`pg_restore` into a scratch database first); the rewrite is idempotent, so a
second run changes nothing.

## 6. Give MediaWiki the webhook secret and URL

Until this step, classic sends no webhook at all: the snippet of step 3a needs both values below and does nothing
without either. WikiOS then picks up classic's edits only through the `wiki-recentchanges` cron job (every 10 minutes,
when it is in `CRON_ENABLED_JOBS`).

PHP-FPM clears its environment, so both values go into the pool file (`/etc/php/8.4/fpm/pool.d/www.conf`). The secret
has the **same value** as `WIKI_SYNC_WEBHOOK_SECRET` in `$IX/.env.production.local`; the URL is IxStates' own webhook
route on loopback, under its base path. That file then holds a secret, so it is made root-only.

First find the base path IxStates answers on (read-only; no secret is sent):

```bash
for p in /projects/ixstates /projects/ixstats; do
  printf '%s -> ' "$p"
  curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{}' \
    "http://127.0.0.1:3550$p/api/wiki/sync-webhook"
done
```

401 means the route answers (it refuses the request because no secret was sent): that is the base path. 404 means the
other one. A 503 means IxStates has no `WIKI_SYNC_WEBHOOK_SECRET`: stop, generate one into `$IX/.env.production.local` the way
step 1c generates its key (at least 32 characters, never typed or printed), and restart IxStates before going on. Then edit the pool file by hand, never echoing the secret:

```bash
bk /etc/php/8.4/fpm/pool.d/www.conf www.conf
sudoedit /etc/php/8.4/fpm/pool.d/www.conf
#   add:   env[WIKIOS_WEBHOOK_SECRET] = <same value as WIKI_SYNC_WEBHOOK_SECRET>
#   add:   env[WIKIOS_WEBHOOK_URL] = http://127.0.0.1:3550<the base path that answered 401>/api/wiki/sync-webhook
sudo chown root:root /etc/php/8.4/fpm/pool.d/www.conf && sudo chmod 0640 /etc/php/8.4/fpm/pool.d/www.conf
ls -l /etc/php/8.4/fpm/pool.d/www.conf                  # -rw-r----- root root
sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm
curl -s -o /dev/null -w '%{http_code}\n' https://ixwiki.com/wiki/Main_Page    # still 200, still MediaWiki
```

From now on, saving a page through the web on classic POSTs `{"title": ...}` to that URL, after the response is sent
and with a 3 second timeout, so a save never waits on IxStates. Edits made by the `wikios-mirror` group are skipped
(echo guard). Edits made from the command line, by jobs or by imports do not announce themselves (no secret in their
environment); the `wiki-recentchanges` cron job imports them. In development and on the test wiki
(`scripts/ops/wikios-test-mediawiki`) the same rule holds: the wiki's `WIKIOS_WEBHOOK_SECRET` must equal the dev server's
`WIKI_SYNC_WEBHOOK_SECRET`, and `WIKIOS_WEBHOOK_URL` names the dev server's route (that folder's README).

**Verify** with one web edit, as an administrator on classic, to a sandbox page. Then compare WikiOS's newest revision of
that page with classic's (read-only; `<page>` is the title with spaces in the SQL, with underscores in the URL):

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c \
  "select r.\"mwRevId\", r.\"createdAt\" from wiki_revisions r join wiki_articles a on a.id = r.\"articleId\"
    where a.source = 'ixwiki' and a.title = '<page>' order by r.\"createdAt\" desc limit 1"
curl -s 'http://127.0.0.1:8081/api.php?action=query&prop=revisions&titles=<page>&rvprop=ids&format=json' \
  | jq -r '.query.pages[].revisions[0].revid'
```

The two revision ids match within seconds of the save. If they match only after 10 minutes, the cron job brought the
edit over and the webhook did not: read classic's `wikios` debug log ("sync-webhook failed for ...") when
`$wgDebugLogGroups['wikios']` is configured. A 401 there means the two secrets differ.

**Rollback:** `sudo cp -a "$BK/www.conf" /etc/php/8.4/fpm/pool.d/www.conf && sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm`.
Classic sends no webhook again, and the cron job keeps WikiOS current.

## 6a. Before the first WikiOS write: the save limit, story chains and two decisions

Do this before step 6b, and before anyone turns the editing toggle on.

**This launch has no takeover.** WikiOS runs inside IxStates, and ixwiki.com stays classic. There is no separate
`wikios` process to check or restart in 6a and 6b: only IxStates and `ixstats-cron`.

**The app URL and the base path (check before step 2's build).** Feeds, permalinks, the reader purge and Discord links
are built from the app URL's origin plus the base path. Read both (read-only):

```bash
grep -n '^NEXT_PUBLIC_APP_URL=\|^APP_URL=\|^BASE_PATH=\|^NEXT_PUBLIC_BASE_PATH=' "$IX/.env.production" "$IX/.env.production.local" 2>/dev/null
```

- `NEXT_PUBLIC_APP_URL` must be `https://ixwiki.com`. A path in it is ignored, so a base path written there is never
  doubled.
- `APP_URL`, when set, wins over `NEXT_PUBLIC_APP_URL`, and the other is not tried. It must also be `https://ixwiki.com`,
  or absent. Check it on its own: `.env.example` ships `APP_URL="http://localhost:3000"`, and in production a loopback
  app URL (`localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`) counts as missing: links throw and the feed answers 503.
- `BASE_PATH` and `NEXT_PUBLIC_BASE_PATH` must be absent or `/projects/ixstates`. `deploy-production.sh` exports
  `/projects/ixstates` for both only when they are unset, so an empty `BASE_PATH=` line gives the build no base path.

To fix a line, back the file up (`bk "$IX/.env.production.local" env.production.local.6a`, or `bk "$IX/.env.production"
env.production.6a`) and change it by hand in an editor; none of these values is a secret. `NEXT_PUBLIC_APP_URL` and the
base path are written into the build, so a fix to them needs step 2's deploy (again, if it has already run). A fix to
`APP_URL` alone needs only IxStates' usual restart and `pm2 restart ixstats-cron --update-env`.

Check after step 6b (`IXSTATES_URL` is empty unless step 5 ran: set it with step 5's read-only "Find the IxStates URL
that works" check):

```bash
curl -s "$IXSTATES_URL/api/wiki/feed/recent-changes" | grep -o '<link href="[^"]*"' | head -3
#   each starts with https://ixwiki.com/projects/ixstates/wiki/ (a 503 means the app URL is missing or loopback)
curl -s "$IXSTATES_URL/wiki/Main_Page" | grep -c 'projects/ixstates/projects/ixstates'      # 0: the base path is never doubled
```

Then open an article in the IxStates reader and hover (or view the source of) a few of its links: each starts with
`/projects/ixstates/wiki/`. The reader purge of the Cloudflare guardian follows the same base path: it purges classic's
`https://ixwiki.com/wiki/<page>` and `https://ixwiki.com/projects/ixstates/wiki/<page>`. The Atom entry ids move from
`tag:ixstats.com,...` to `tag:ixwiki.com,...`, so a feed reader may show recent entries once more.

**Rollback:** restore the backed-up env file (`sudo cp -a "$BK/env.production.local.6a" "$IX/.env.production.local"`, or
`"$BK/env.production.6a"` over `$IX/.env.production`) and repeat the deploy or restart the fix needed.

**The wiki-save limit needs `RATE_LIMIT_ENABLED`.** Every person's save (the editor, api.php, revert, rollback, "Restore
my text") takes one from a per-account bucket: 8 a minute for a new account, 30 for an autoconfirmed or confirmed one,
none counted for a holder of `noratelimit` (sysop, bot). The limit lives in the shared rate limiter, which counts nothing
unless `RATE_LIMIT_ENABLED` is exactly `true`. Unset means `true`. Any other value (`false`, `1`, `True`) turns the limiter
off, and the save limit with it. Check every env file IxStates and `ixstats-cron` read:

```bash
grep -n '^RATE_LIMIT_ENABLED=' "$IX/.env.production" "$IX/.env.production.local" 2>/dev/null   # nothing, or =true / ="true"
grep -n 'RATE_LIMIT_ENABLED' "$IX/ecosystem.config.cjs"                                         # nothing, or "true"
```

If a line says anything else, change it to `RATE_LIMIT_ENABLED=true` (back the file up with `bk` first). Then restart
`ixstats-cron` (`pm2 restart ixstats-cron --update-env`) and IxStates (its usual restart).

**Story chains aimed at a `MediaWiki:` page.** An approved story chain whose wiki section is not written yet
(`wikiSyncedAt` is null) is retried by the story-chain cron job. A chain whose page is a `MediaWiki:` page is now skipped:
it is marked done with a warning in the log, and its text never reaches the wiki. List them before launch, so their
authors can be told and the chain pointed at another page (read-only):

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c \
  "select id, title, \"countryId\", \"wikiPageTitle\", \"reviewedAt\" from storylines
    where kind = 'chain' and status = 'approved' and \"wikiSyncedAt\" is null
      and \"wikiPageTitle\" ilike 'MediaWiki:%'"
```

Expect no rows. For each row, change its `wikiPageTitle` before launch (or accept that it is skipped).

**Owner decision: the site-editing rights.** WikiOS still grants `editinterface` (sysop, interface-admin) and
`editsitecss`, `editsitejs` and `editsitejson` (interface-admin) in `src/lib/wiki-os/rights.ts`, and they still show on
`Special:ListGroupRights`. Nothing reads them any more: no `MediaWiki:` page can be written through WikiOS. They are
harmless, and removing them is a code change for a later release. Ask the owner whether to keep them (matching
MediaWiki's own group table) or remove them. Do not change anything on the server for this.

**The upload directory (plan 411), before step 6b.** WikiOS keeps an uploaded file in `WIKIOS_UPLOAD_DIR` until the
mirror's `upload` job has put it in MediaWiki, and serves it from there meanwhile. Without the variable it uses
`.wikios-uploads` inside the checkout, which a deploy can replace. IxStates (which takes the uploads) and `ixstats-cron`
(which runs the mirror) must use the same directory, so it goes into the env file both read. Pick a directory outside
the checkout that the server's backups cover: it is the only copy of a file until MediaWiki holds it.

```bash
sudo mkdir -p /ixwiki/shared/wikios-uploads && sudo chown "$USER": /ixwiki/shared/wikios-uploads && chmod 750 /ixwiki/shared/wikios-uploads
bk "$IX/.env.production.local" env.production.local.uploads
grep -q '^WIKIOS_UPLOAD_DIR=' "$IX/.env.production.local" || ( umask 077; printf '\nWIKIOS_UPLOAD_DIR=/ixwiki/shared/wikios-uploads\n' >> "$IX/.env.production.local" )
grep -c '^WIKIOS_UPLOAD_DIR=' "$IX/.env.production.local"          # 1
```

If you cannot see that the backups include `/ixwiki/shared/wikios-uploads`, ask the owner before step 6b. IxStates and
`ixstats-cron` read the line on the restarts of step 6b. No migration is needed: an upload is refused until WikiOS
editing is on (step 6b), so no file can be waiting in another directory.

**Rollback:** `sudo cp -a "$BK/env.production.local.uploads" "$IX/.env.production.local"` before step 6b (the empty
directory can stay).

**`Template:Sister`** must exist on classic (step 3d).

## 6b. Switch WikiOS v1 on

Only after steps 1 (SQL), 1b (rights import and its protections marker), 3 (mirror account), 4 (render engine), 4b
(the server's own requests let through), 6 (webhook) and 6a. Without the marker the switch takes no writes: api.php keeps answering `readonly`. The switch goes into
the env file that IxStates and `ixstats-cron` both read, `$IX/.env.production.local`. This launch has no `wikios`
process (no takeover), so nothing else needs it. From here on WikiOS takes edits inside IxStates, the mirror copies them
to MediaWiki, and api.php answers. When WikiOS and classic both change a page, the later save stands on both wikis and
the overwritten editor is told (step 10d).

```bash
bk "$IX/.env.production.local" env.production.local.step6b
grep -q '^WIKIOS_V1_ENABLED=' "$IX/.env.production.local" || ( umask 077; printf '\nWIKIOS_V1_ENABLED=true\n' >> "$IX/.env.production.local" )
grep -c '^WIKIOS_V1_ENABLED=true$' "$IX/.env.production.local"          # expect 1
pm2 restart ixstats-cron --update-env
# and IxStates itself, its usual restart, so it reads the file again
# IxStates' own api.php, on loopback under its base path (use /projects/ixstats instead if that is the one that answers):
curl -s 'http://127.0.0.1:3550/projects/ixstates/w/api.php?action=query&meta=siteinfo&format=json' | jq -r '.error.code // "ok"'   # not "readonly"
```

Then add `wiki-mirror` and `wiki-render-stale` to `CRON_ENABLED_JOBS` (step 7b explains the render backlog).

**Rollback:** `sudo cp -a "$BK/env.production.local.step6b" "$IX/.env.production.local"`, the same two restarts. WikiOS
follows the editing toggle again (read-only unless it is on: turn it off in `/admin/wikios-settings` too). Jobs already
in the outbox keep draining to MediaWiki while `wiki-mirror` runs; to make them wait there, also set
`SKIP_MEDIAWIKI_SYNC=true` in the same file before the restarts, or drop `wiki-mirror` from `CRON_ENABLED_JOBS`.

## 6c. Bots on `/w/api.php` (after steps 1c and 6b)

Bots move from classic's `api.php` to IxStates' MediaWiki-compatible one. Everything here is launch-time, and only after
steps 1c (the api.php session secret, without which no bot login holds) and 6b.

- **On the server:** `http://127.0.0.1:3550/projects/ixstates/w/api.php` (the base path that answered in step 6). It
  passes neither Cloudflare nor the bot defense.
- **From outside:** `$IXSTATES_URL/w/api.php` (`https://ixwiki.com/projects/ixstates/w/api.php`). It passes Cloudflare and
  the bot defense, so a bot with a generic user agent (`python-requests`, `Go-http-client`) is blocked by the static
  list: it must send a descriptive one.

**A bot password for each bot.** The owner of the bot's account signs in to IxStates and opens `Special:BotPasswords`
(`/util/botpasswords`). The account needs a passport handle. They pick an app id and only the grants the bot needs
(from `basic`, `highvolume`, `editpage`, `createeditmovepage` and the rest the page lists). The password is shown once:
it goes straight into the bot's env file, never into a shell line. The login name is `handle@App`, or
`<approved claimed name>@App`, so a bot keeps its classic login name. Check the claim first (read-only; one row with
`APPROVED`):

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c \
  "select name, status from wiki_name_claims where source = 'ixwiki' and lower(name) = lower('<bot classic name>')"
```

Any other result means the classic name is not the account's yet: the owner approves the claim (Admin, Users, Name
claims) before the bot logs in with it, or the bot uses `handle@App`.

**The Discord bot** (`/ixwiki/shared/bots/discord`) is the Lorewards writer: nothing in IxStates writes `IxWiki:OOL`.
Find how it reaches MediaWiki, and its PM2 app (read-only; the `sed` hides any secret value the `grep` finds in an env
file):

```bash
grep -rnE "api\.php|lgname|lgpassword|BOT_?PASS|WIKI_(USER|PASS|API)" /ixwiki/shared/bots/discord \
  --include=*.js --include='.env*' --exclude-dir=node_modules | sed -E 's/((PASS|TOKEN|SECRET)[A-Z_]*=).*/\1<hidden>/I'
pm2 jlist | jq -r '.[] | select(.pm2_env.pm_cwd // "" | startswith("/ixwiki/shared/bots/discord")) | .name'
```

The API URL and the credentials must come from its `.env`. If the URL or the login is written in a `.js` file, or the
bot writes without logging in, stop and ask the owner: never edit the bot's code blind. Otherwise, after its owner has
made its bot password on `Special:BotPasswords`:

```bash
bk /ixwiki/shared/bots/discord/.env discord-bot.env.6c
sudoedit /ixwiki/shared/bots/discord/.env
#   its MediaWiki API URL:  http://127.0.0.1:3550/projects/ixstates/w/api.php
#   its user and password:  <handle or approved claimed name>@<App> and the new bot password, pasted here only
```

Smoke test through the loopback before the restart, with the password read from that file into a variable and sent on
stdin, as in step 4 (put the variable names the `grep` showed in place of `<USER_VAR>` and `<PASS_VAR>`):

```bash
API=http://127.0.0.1:3550/projects/ixstates/w/api.php
BOT_USER=$(sudo grep '^<USER_VAR>=' /ixwiki/shared/bots/discord/.env | cut -d= -f2- | tr -d '"')
BOT_PASS=$(sudo grep '^<PASS_VAR>=' /ixwiki/shared/bots/discord/.env | cut -d= -f2- | tr -d '"')
JAR=$(mktemp); chmod 600 "$JAR"
LT=$(curl -s -c "$JAR" "$API?action=query&meta=tokens&type=login&format=json" | jq -r '.query.tokens.logintoken')
printf '%s' "$BOT_PASS" | curl -s -b "$JAR" -c "$JAR" -d action=login -d format=json \
  --data-urlencode "lgname=$BOT_USER" --data-urlencode "lgtoken=$LT" --data-urlencode 'lgpassword@-' \
  "$API" | jq -r '.login.result'                                           # Success
curl -s -b "$JAR" "$API?action=query&meta=userinfo&format=json" | jq -r '.query.userinfo.name'   # the account's handle
unset BOT_PASS BOT_USER LT; shred -u "$JAR"
```

Then restart the bot (`pm2 restart <its app> --update-env`) and verify:

- Its next write (an OOL update, or a test edit to its sandbox page) shows in WikiOS with `origin = 'wikios'`, and after
  the mirror has run (a minute or so) it carries a `mwRevId` that classic's `8081` API shows as the page's revision (the
  two queries of step 6, with `r.origin, r."revId"` added to the select).
- Its reads (its wiki feeds) still answer: `pm2 logs <its app> --lines 50 --nostream` shows no API errors.

A throttled bot sees MediaWiki's `ratelimited` error (buckets in [rate-limiting.md](rate-limiting.md#wikios-buckets)).

**Other bot owners** (Pywikibot, AWB): send them the outside URL above and point them to `Special:BotPasswords`.
Classic's `api.php` keeps working, and edits made there arrive through the inbound sync under the conflict rule (step
10d).

**Rollback:** `sudo cp -a "$BK/discord-bot.env.6c" /ixwiki/shared/bots/discord/.env` and `pm2 restart <its app>
--update-env`; the bot's owner deletes the bot password on `Special:BotPasswords`.

## 6d. IxStates' robots rules on classic (after this release's deploy)

Crawlers read `robots.txt` only at the host root, so IxStates' own file (`/projects/ixstates/robots.txt`) is never read.
Its rules go into classic's root `robots.txt`. Everything here is launch-time, and only after step 2 has deployed this
release: before it, IxStates' file still holds the old root rules and a `Sitemap:` line, which must not be copied.

First see what classic serves and where it comes from (read-only; `DOCROOT` is the `root` printed in step 4):

```bash
DOCROOT=<the root value printed in step 4>
curl -s https://ixwiki.com/robots.txt | tee "$BK/robots.public.before"
ls -l "$DOCROOT/robots.txt"
diff "$BK/robots.public.before" "$DOCROOT/robots.txt" && echo "served from the static file"
# the User-agent: * group only (from its line to the next User-agent line that follows a rule):
awk 'tolower($0) ~ /^[[:space:]]*user-agent:/ { if (rules) star = 0; rules = 0; if ($0 ~ /:[[:space:]]*\*[[:space:]]*$/) star = 1; next }
     NF { rules = 1 } star' "$DOCROOT/robots.txt" | grep -niE '^\s*disallow:\s*/(projects|\s*$)'    # must print nothing
```

- **If there is no static file, or the `diff` shows that something else serves `/robots.txt`** (MediaWiki, an extension,
  an nginx rule, or Cloudflare's managed `robots.txt`), stop and ask the owner.
- **If the last `grep` prints a line,** classic's `User-agent: *` group already keeps crawlers out of `/projects/` (or out
  of everything). Stop and ask the owner to confirm that IxStates' wiki pages should be crawled before adding an `Allow`
  for them. A site-wide `Disallow: /` in a named group (an AI-bot group, say) is expected and is not a stop: the check
  reads only the `User-agent: *` group, and such a group is left as it is below.

Take the rules from IxStates on loopback and check them (read-only):

```bash
curl -s http://127.0.0.1:3550/projects/ixstates/robots.txt | tee "$BK/ixstates-robots.txt"
grep -c Sitemap "$BK/ixstates-robots.txt"                # 0
grep -c '/projects/ixstates/' "$BK/ixstates-robots.txt"  # 13 (one Allow, twelve Disallow)
```

Any other count means the deploy does not carry this release yet: stop. A crawler obeys only the most specific group
that names it, so a `User-agent: Googlebot` group means Googlebot never reads the `User-agent: *` rules. List the groups
(read-only):

```bash
grep -niE '^\s*user-agent:' "$DOCROOT/robots.txt"
```

Paste the 13 `Allow` and `Disallow` lines into the existing `User-agent: *` group of classic's file, so there is no second
`User-agent: *` group (if the file has no such group, add the whole block at the end). Then paste the same 13 lines into
every named crawler group (Googlebot, Bingbot and so on), except a group that blocks the whole site (`Disallow: /`): its
`Allow` would open IxStates' pages to a crawler classic keeps out, so leave that group as it is. If a group shares its
rules among several `User-agent` lines, or you cannot tell where a group ends, stop and ask the owner.

```bash
bk "$DOCROOT/robots.txt" robots.txt.6d
sudoedit "$DOCROOT/robots.txt"
```

Purge `https://ixwiki.com/robots.txt` in Cloudflare (Caching, Configuration, Custom Purge, by URL), then check:

```bash
curl -s https://ixwiki.com/robots.txt | grep -c '/projects/ixstates/'     # 13 × the number of groups you edited
```

The count is 13 times the number of groups that received the lines: 13 for `User-agent: *` alone, 26 with one named
group as well, and so on.

A `Disallow` stops crawling, not indexing: a `?source=` URL a search engine has already indexed is not removed by it, and
the crawler no longer fetches the page to see its `noindex`. To drop one that shows in results, use the search engine's
removal tool (Google Search Console, Removals).

**Rollback:** `sudo cp -a "$BK/robots.txt.6d" "$DOCROOT/robots.txt"`, and purge `https://ixwiki.com/robots.txt` again.

## 7. Pre-cutover checks (nothing public yet)

**Deferred takeover step: not run at this launch** (see "Order matters").

Pick real examples for the gate rows (they must exist: a page and one of its revisions, a template subpage, a category,
a file and an upload), using the private render engine:

```bash
IXSTATES_URL=$(sed -n 's/^NEXT_PUBLIC_IXSTATES_URL=//p' "$WK/.env.wikios-build")
R='http://127.0.0.1:8081/api.php?format=json&action=query'
curl -s "$R&prop=revisions&titles=Main_Page&rvprop=ids&rvlimit=1&rvdir=newer" | jq -r '.query.pages[].revisions[0].revid'   # -> REVID
curl -s "$R&titles=Template:Infobox_country/doc%7CCategory:Countries" | jq -c '.query.pages[] | {title, missing: has("missing")}'
find /ixwiki/shared/images -maxdepth 3 -type f -name '*.png' | head -3
ls "$IX"/public/images/uploads | head -3      # an IxStates upload (a country's flag): the --upload row
```

```bash
( cd "$IX" && bun scripts/ops/verify-wikios-takeover.ts --base http://127.0.0.1:3560 --ixstates "$IXSTATES_URL" \
    --internal http://127.0.0.1:8081 --standalone --page Main_Page --revid <REVID> \
    --subpage Template:Infobox_country/doc --category Category:Countries \
    --upload /images/uploads/<a file of $IX/public/images/uploads> )
```

Every row must PASS: `/` (302 to `/wiki/Main_Page`), `/wiki/Main_Page`, `/robots.txt`, `/wiki-sitemap`, a template subpage, a
category page, `Special:Search`, `?action=raw` (as `text/x-wiki`), `?oldid=`, the runtime requests WikiOS pages make that
are not routes (`/api/ixtime/current`, `/maplibre/maplibre-gl-worker.mjs`, `/flags/...`, `/images/flags/placeholder.svg`, an IxStates upload under `/images/uploads/` (the `--upload` row),
`/fonts/...`), `/maps?embed=true` (302 to the IxStates map that article map embeds load), the configured IxStates URL
(not 404) and the loopback `action=parse`. The routes of plans 410 and 412 (robots, sitemap, subpages, raw, oldid,
Special:Search) fail until those plans are deployed into the WikiOS build. Then open
`http://127.0.0.1:3560/wiki/Main_Page` through an SSH tunnel (`ssh -L 3560:127.0.0.1:3560 ixwiki`) with the browser
devtools network tab open: **no asset may 404 or redirect to IxStates** (the allowed prefixes are
`WIKIOS_ALLOWED_PREFIXES` in `src/lib/system/wikios-standalone.ts`; `wikios-takeover.conf` routes the same set). A
missing prefix must be added to both before step 8.

**An upload (plan 411).** Sign in to the loopback WikiOS as a user with the upload right, upload a small PNG on
`/util/upload` (through the SSH tunnel), and check, against the private MediaWiki, that the mirror's `upload` job
put the same bytes there and that WikiOS now serves the file from MediaWiki's path (the asset's URL is its `/images/` path
and the staged copy is gone):

```bash
ls -l /ixwiki/shared/wikios-uploads/                                       # the staged file, until the job has run (within a minute or so)
curl -s 'http://127.0.0.1:8081/api.php?action=query&titles=File:<Name>&prop=imageinfo&iiprop=url|sha1&format=json' | jq -c '.query.pages[].imageinfo'
sha1sum /ixwiki/shared/images/<a>/<ab>/<Name>                              # equals the imageinfo sha1
```

A job that ended dead (`permissiondenied`, `filetype-banned`, a PHP or nginx size refusal) shows in the admin panel's
mirror section with MediaWiki's answer.

**Uploaded files under `/images/` (plan 411; do this before uploads are opened to users).** Once the `upload` job has run, an
uploaded file is served by nginx from MediaWiki's `/images/` tree on the wiki's origin, with the content type nginx guesses
from the name. A PDF or an SVG opened there directly is a document on that origin, so make nginx say that it is a download
and that its type is not to be guessed. An SVG used as `<img src>` still renders (`Content-Disposition` does not touch an
image load). Add the map in `http` context and the two `add_header` lines in the vhost's existing `location` that serves
`/images/` (an `add_header` in a `location` replaces the ones it would inherit, so put them with that location's own):

```bash
sudo tee /etc/nginx/conf.d/wikios-images-headers.conf >/dev/null <<'EOF'
# plan 411: an uploaded PDF or SVG opened directly is a download; nothing under /images/ has its type guessed
map $uri $wikios_image_disposition {
    default           "";
    ~*\.(?:pdf|svg)$  "attachment";
}
EOF
sudoedit "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"     # in the location that serves /images/, add:
#     add_header X-Content-Type-Options "nosniff" always;
#     add_header Content-Disposition $wikios_image_disposition always;    # an empty value adds no header
sudo nginx -t && sudo systemctl reload nginx
curl -sI "https://<the wiki host>/images/<a>/<ab>/<Name>.svg" | grep -iE '^(content-disposition|x-content-type-options)'   # attachment + nosniff
curl -sI "https://<the wiki host>/images/<a>/<ab>/<Name>.png" | grep -iE '^(content-disposition|x-content-type-options)'   # nosniff only
```

**Rollback:** remove the two `add_header` lines and `sudo rm /etc/nginx/conf.d/wikios-images-headers.conf`, then
`sudo nginx -t && sudo systemctl reload nginx`.

**Shadowing checks.** nginx will send `/robots.txt`, `/sitemap*`, `/wiki-sitemap*`, `/images/flags/`, `/images/uploads/`, `= /maps`, `/sign-in`,
`/sign-up` and `/sso-callback` to WikiOS, in front of anything MediaWiki served there. Check that nothing real is
hidden by that (each command should report "No such file" or print nothing):

```bash
DOCROOT=<the root value printed in step 4>
ls -l "$DOCROOT"/robots.txt "$DOCROOT"/sitemap* "$DOCROOT"/wiki-sitemap* 2>&1     # static files would be shadowed
ls -ld /ixwiki/shared/images/flags /ixwiki/shared/images/uploads 2>&1             # an upload directory named "flags" or "uploads" would be shadowed
mysql ixwiki -e "SELECT page_title FROM page WHERE page_namespace = 0 AND (page_title IN ('Maps','Sign-in','Sign-up','Sso-callback') OR page_title LIKE 'Sitemap%')"
```

(read-only, local database `ixwiki`, no table prefix; MediaWiki capitalises the first letter, so these are the
lower-case paths' articles). Root-level short URLs such as `ixwiki.com/Foo` keep serving classic MediaWiki.

Other links WikiOS pages render to IxStates-only routes (`/blurbs`, `/mycountry`, `/dashboard`, `/countries`,
`/vault/achievements`, `/settings`, `/messages`) are root-relative in the standalone build and are **not** forwarded: on
ixwiki.com they reach MediaWiki until they are prefixed with the IxStates URL in the app or forwarded in nginx.

**Rollback:** not needed (nothing changed).

## 7b. Render convergence after the deploy (finish it before step 8)

WikiOS shows an article from its **view bundle** (`wiki_articles."renderedView"`), built by sending the page's Postgres wikitext
to the private MediaWiki. The same render also stores what MediaWiki reports about the page: **`wiki_links`,
`wiki_template_links` and `wiki_image_links`**, categories and page properties. Those tables are empty for a page until it has
rendered under this code, and four things read them: backlinks (`Special:WhatLinksHere`), page images and lore-card images,
and api.php's `list=embeddedin` and `list=imageusage` (with `prop=templates|images`). So after the deploy the wiki is complete
only once every page has rendered; how fast that happens depends on which kind of work each page is:

| Page is | Served meanwhile | Rendered by | Rate |
|---------|------------------|-------------|------|
| **never rendered**, or stale (`"htmlSyncedAt"` NULL; step 1's `rendered-view.sql` marks every row without a bundle so) | the reader waits up to 6 s for its render, else a locally compiled fallback marked stale | the first reader, a save, or the `wiki-render-stale` job (every minute, oldest first) | **20 per minute** |
| **outdated**: its bundle was built by another renderer version (`RENDERER_VERSION` = transform version + sanitizer fingerprint; this release changes it, and so does any later sanitizer change or the `WIKIOS_TEMPLATESTYLES` lever, step 10c) | at once, the old bundle re-sanitized by the current rules and marked stale; a reader's visit also queues its background render | `wiki-render-stale` (one scan per process finds the backlog, at the first batch with room, so a minute or so after `ixstats-cron` starts) and readers' background renders | up to **60 per minute** when no never-rendered page is waiting; otherwise what is left of the 20 |

Renders run two at a time at background priority (a reader's or an editor's render goes first), a batch starts none after 45
seconds, and a page MediaWiki fails to render is left alone for a while (doubling up to an hour) so it never holds up the
rest. A page with no text (`wikitext` empty) is never queued.

**This launch's re-render (plan 2026-10-25).** The integration and hosts work and the sister-wiki work deploy together,
so the renderer version moves from 4 to 6 in one deploy and the corpus re-renders once. Outdated pages go through
`wiki-render-stale` at up to 60 a minute, two at a time, once step 6b has turned the switch on (the job does nothing
before). Forum posts re-render too, through `forum-render-stale`, 10 posts every 2 minutes. Both run on the loopback
engine of step 4 and never reach the public MediaWiki; without `WIKIOS_MEDIAWIKI_INTERNAL_URL` neither job renders
through MediaWiki.

**`wiki-render-stale` must be in `CRON_ENABLED_JOBS`.** Jobs run in the PM2 app `ixstats-cron` and only those named in
`CRON_ENABLED_JOBS` (in its `env`, in `ecosystem.config.cjs`; empty means none) are scheduled. Without it nothing renders in
the background: only the pages a reader opens or an editor saves render, and the link tables stay empty for the rest. The
cutover also needs `wiki-mirror` (step 3's mirror account; the outbox of WikiOS writes) and `wiki-recentchanges` (step 7's
inbound sync) in the same list. The job runs inside `ixstats-cron`, so that process needs the render engine's URL
(`WIKIOS_MEDIAWIKI_INTERNAL_URL`, step 4) in the env file it reads. Restart it after changing either:

```bash
grep -n 'CRON_ENABLED_JOBS' "$IX/ecosystem.config.cjs"                    # the list for ixstats-cron: it must name wiki-render-stale
pm2 restart ixstats-cron --update-env && pm2 logs ixstats-cron --lines 30 --nostream
```

**How long it will take.** Count what is left (`unrendered` counts the stale pages, `outdated` the ones that have a current-looking
timestamp and an older bundle; no page is in both), then divide by the rates above (never-rendered first, at 20 a minute,
then outdated, up to 60 a minute). Read-only; run it against the database the app uses:

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 <<'SQL'
-- which renderer versions the stored bundles carry, newest render first: the first row is the current version
-- once any page has rendered under the new code (read a page, or wait a minute for the batch); every other row is outdated
select "renderedView"->>'rendererVersion' as version, count(*) as pages, max("htmlSyncedAt") as newest_render
from wiki_articles
where status = 'PUBLISHED' and wikitext <> '' and "renderedView" is not null
group by 1 order by newest_render desc nulls last;

-- what is still to do: never rendered or stale, and outdated (against the version of the newest render)
with latest as (
  select "renderedView"->>'rendererVersion' as version
  from wiki_articles where "renderedView" is not null and "htmlSyncedAt" is not null
  order by "htmlSyncedAt" desc limit 1
)
select count(*) filter (where "htmlSyncedAt" is null)                                  as unrendered,
       count(*) filter (where "htmlSyncedAt" is not null and "renderedView" is not null
                          and "renderedView"->>'rendererVersion' <> (select version from latest)) as outdated,
       count(*)                                                                         as published_with_text
from wiki_articles
where status = 'PUBLISHED' and wikitext <> '';
SQL
```

Minutes to go is about `unrendered ÷ 20 + outdated ÷ 60`. The 60 is a ceiling (a batch must finish its renders inside 45
seconds, two at a time, so it assumes MediaWiki parses a page in about a second and a half or less), and 20 is the rate however fast
MediaWiki is: measure instead of trusting either. Run the second query again after ten minutes and divide what fell by ten.
Do not "speed it up" by setting `"htmlSyncedAt"` to NULL on pages that already have a bundle: that moves them from the 60 a
minute lane to the 20 a minute one, and readers would wait for them instead of being shown the old bundle. (The
`rendered-view.sql` migration already did that for the pages that had none.)

**Verify (done when both hold).** `unrendered` is 0 and `outdated` is 0 (a page MediaWiki cannot render keeps one of them above
0: find it with `pm2 logs ixstats-cron --lines 500 --nostream | grep 'WikiOS:render'` and fix or ignore it knowingly), and the derived tables are no
longer empty:

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 <<'SQL'
select (select count(*) from wiki_links)          as links,
       (select count(*) from wiki_template_links) as template_links,
       (select count(*) from wiki_image_links)    as image_links;                    -- each must be above 0
select count(distinct "sourceArticleId") as pages_with_links from wiki_links;       -- approaches published_with_text (a page with no links has no row)
SQL
# the two api.php lists that read them, against IxStates' api.php on loopback (each must list pages):
curl -s 'http://127.0.0.1:3550/projects/ixstates/w/api.php?action=query&list=embeddedin&eititle=Template:Infobox_country&eilimit=5&format=json' | jq -c '.query.embeddedin | length'
curl -s 'http://127.0.0.1:3550/projects/ixstates/w/api.php?action=query&list=imageusage&iutitle=File:<an existing file>&iulimit=5&format=json' | jq -c '.query.imageusage | length'
```

**Rollback:** nothing to undo; stopping early only leaves some pages on their older bundle and without link data, which
readers do not see (they get the bundle) and the four features above show as empty.

## 8. Cut over

**Deferred takeover step: not run at this launch** (see "Order matters").

Do step 10a (PHP-FPM watchdog) **before** this step. Then install the nginx takeover and, right after the nginx reload,
flip the MediaWiki article path: nginx first, because `/classic/` and the WikiOS `/wiki/` must exist before MediaWiki
starts generating `/classic/` links (until the flip it still emits `/wiki/` links, which now reach WikiOS: no broken
window). Run 8a and 8b back to back.

### 8a. nginx

```bash
bk "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)" ixwiki.com.nginx
sudo cp "$IX/scripts/ops/nginx/wikios-upstream.conf"     /etc/nginx/conf.d/wikios-upstream.conf
sudo cp "$IX/scripts/ops/nginx/wikios-proxy-params.conf" /etc/nginx/snippets/wikios-proxy-params.conf
sudo cp "$IX/scripts/ops/nginx/wikios-takeover.conf"     /etc/nginx/snippets/wikios-takeover.conf
#   step 10b: route the chatty locations to their own log (the sed on the copied snippet), before nginx -t
sudoedit "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"
#   - add  `include snippets/wikios-takeover.conf;`  at the top of the ixwiki.com server block
#     (it also holds `location ^~ /w/`, which sends WikiOS's api.php, /w/api.php, to WikiOS with a 5m body limit;
#      classic MediaWiki does not use /w/ on this server, so nothing is replaced for it)
#   - delete what the header of wikios-takeover.conf lists as replaced:
#       * location ^~ /wiki/ { try_files $uri @mediawiki; }
#       * the ^/wiki/(.*)$ rewrite line inside location @mediawiki  (keep the /search/ and /([^/]+) rewrites)
#       * any existing `location = /`
sudo nginx -t && sudo systemctl reload nginx     # duplicate-location errors mean one of the deletions above was missed
```

### 8b. MediaWiki article path, then caches

```bash
bk /ixwiki/config/LocalSettings.php LocalSettings.php.step8
sudoedit /ixwiki/config/LocalSettings.php
#   add  define( 'WIKIOS_TAKEOVER', true );  on the line before  require_once '/ixwiki/config/wikios-localsettings.php';
#   so the snippet sets $wgArticlePath = '/classic/$1' and its canonical hook
php -l /ixwiki/config/LocalSettings.php && sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm
```

Cached HTML still carries `/wiki/` links. Editing `LocalSettings.php` invalidates it when
`$wgInvalidateCacheOnLocalSettingsChange` is true (the default): check that the server has not turned it off, and free
the parser cache rows either way (this only works when the parser cache is in the database):

```bash
grep -n 'InvalidateCacheOnLocalSettingsChange\|CacheEpoch' /ixwiki/config/LocalSettings.php    # nothing, or "true"
mwmaint purgeParserCache --age 0
```

If the first command shows the setting as `false`, set `$wgCacheEpoch` to now (`date +%Y%m%d%H%M%S`) in
`LocalSettings.php` and reload PHP-FPM instead. Then purge Cloudflare's cache for `/wiki/*` so stale MediaWiki HTML is
not served at the new URLs: dashboard Caching, Configuration, Custom Purge (prefix `ixwiki.com/wiki/`, available on
Enterprise) or Purge Everything. The API equivalent needs a token with the **Cache Purge** permission (the bot-defense
token in `/etc/ixwiki-defense.conf` only has firewall/WAF rights; do not reuse it):

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_PURGE_TOKEN" -H "Content-Type: application/json" --data '{"purge_everything":true}'
```

**Rollback:** step 12 (it restores `$BK/ixwiki.com.nginx` and `$BK/LocalSettings.php.step8`).

## 9. Verify the public site

**Deferred takeover step: not run at this launch** (see "Order matters").

```bash
( cd "$IX" && bun scripts/ops/verify-wikios-takeover.ts --base https://ixwiki.com --ixstates "$IXSTATES_URL" \
    --internal http://127.0.0.1:8081 --page Main_Page --revid <REVID> \
    --subpage Template:Infobox_country/doc --category Category:Countries \
    --file <ExistingFile.png> --image /images/<a>/<ab>/<ExistingFile.png> \
    --upload /images/uploads/<a file of $IX/public/images/uploads> )
```

Every row must PASS (exit code 0). The public `/api.php` row still expects MediaWiki's `sitename`: `/api.php` stays
MediaWiki's, and WikiOS's own api.php has two rows of its own at `/w/api.php` (siteinfo, and a login token, which
answers `sessionsecretmissing` and so fails while `WIKIOS_API_SESSION_SECRET` is missing). A bot's smoke test: `curl -s
'https://ixwiki.com/w/api.php?action=query&meta=siteinfo&format=json'` answers JSON with the site name, and a
Pywikibot login with a bot password made on `Special:BotPasswords` succeeds. Also click through by hand: an article, an old revision
(`/index.php?title=Foo&oldid=N` redirects to `/wiki/Foo?oldid=N`), `action=edit` on classic, a classic
`Special:` page, an image, login, and one `?action=purge` (`/wiki/Foo?action=purge` is answered by classic MediaWiki).

**Rollback:** step 12.

## 9a. Lean flight (after step 9, optional but recommended)

**Deferred takeover step: not run at this launch** (see "Order matters").

A server-rendered article page carries its HTML twice: as DOM and again in the page data the browser hydrates from. In
**lean flight** mode (`WIKIOS_LEAN_FLIGHT=1`, off in the code) the page data of an **anonymous page load** of a large article
carries short markers instead, and the browser reads the article back from the DOM that was already sent. It was checked in a
browser on a development build: the HTML of a long article (Pelaxia) fell from 804 KB to 479 KB raw and from 149 KB to 85 KB
gzipped, soft navigation, back/forward and concurrent anonymous loads were correct, and there were no hydration errors. It
only touches an anonymous `Accept: text/html` document request for an article of 20,000 or more characters of HTML
(`LEAN_MIN_CHARS` in `src/app/(wiki-os)/wiki/[...slug]/_lib/lean-flight.ts`); signed-in readers and client-side navigations
are served as before. The server hands the article to its own render through a per-process stash, so it needs the single
`wikios` process the ecosystem file starts (`instances: 1`); do not turn it on behind more than one.

The flag is read at run time: no rebuild, only a reload of the WikiOS process. Put it in the `env` block of
`$WK/ecosystem.wikios.config.cjs` (the runtime env file `$WK/.env.production.local` is shared with IxStates):

```bash
bk "$WK/ecosystem.wikios.config.cjs" ecosystem.wikios.config.cjs.9a
sudoedit "$WK/ecosystem.wikios.config.cjs"            # add to env:   WIKIOS_LEAN_FLIGHT: "1",
pm2 startOrReload "$WK/ecosystem.wikios.config.cjs" --update-env
```

**Verify, and keep it only if it passes.** Pick a long article (the one you would open to show someone WikiOS) and one plain
sentence from **deep in its body, not from the lead paragraph**: words only, no quotes, ampersands or links. The lead paragraph
is also the page's meta description and its og and twitter text, and it is in the page data, so a lead sentence would be found
on a page that has no article body at all. The row asks the loopback WikiOS for the article as an anonymous page load and
requires the sentence inside the article element of the first HTML (meta tags, titles and scripts are ignored), which is exactly
what an SSR stash miss (the page served with no article body) would lack; every other row would still call that page a 200:

```bash
( cd "$IX" && bun scripts/ops/verify-wikios-takeover.ts --base http://127.0.0.1:3560 --ixstates "$IXSTATES_URL" --standalone \
    --article <Long_article> --article-text "<a plain sentence from deep in its body>" )
curl -s -H 'Accept: text/html' "http://127.0.0.1:3560/wiki/<Long_article>" | grep -c 'id="wikios-lean-'     # 1 or more: the mode is on for this page
```

All rows must PASS and the `grep` must print 1 or more (0 means the mode is off, or the article is shorter than the
threshold: pick a longer one). Then open the article in a browser, signed out, with the console open: **no hydration error**,
and the article is there.

**If the row fails, or the console shows a hydration error: unset the variable.** Remove the line from the ecosystem file
(`sudo cp -a "$BK/ecosystem.wikios.config.cjs.9a" "$WK/ecosystem.wikios.config.cjs"`) and `pm2 startOrReload
"$WK/ecosystem.wikios.config.cjs" --update-env`; nothing else changed, and every page is served as before.

## 10. Monitor (first 24 hours)

| Watch | How |
|-------|-----|
| WikiOS process | `pm2 logs wikios`, `pm2 status wikios` (restarts column), `pm2 jlist` RSS |
| nginx | `tail -f /var/log/nginx/error.log`; 5xx on `/wiki/`: `awk '$9>=500 && $7 ~ "^/wiki/"' /var/log/nginx/access.log \| tail` |
| Bot defense, fail2ban | step 10b; afterwards `/usr/local/bin/ixwiki-bot-defense.sh status`, `tail -f /var/log/ixwiki-bot-defense.log`, `fail2ban-client status ixwiki-bots` |
| PHP-FPM watchdog | step 10a; afterwards `tail -f /ixwiki/private/logs/php-fpm-watchdog.log` |
| Webhook | IxStates' own log (its usual start, see `docs/operations/monitoring.md`): `[wiki/sync-webhook]` lines; classic's `wikios` debug log (`sync-webhook failed for ...`) when configured. 401 means the two secrets differ, 503 means IxStates has none, 429 means more than 600 a minute |
| Discord DMs | disk alert, PHP-FPM watchdog and bot-defense alerts reach the admin through `ixwiki-notify.sh` |
| Disk | `df -h /` (WikiOS logs go to `/var/log/pm2/`, rotated at 50M x 5; nginx logs rotate through `/etc/logrotate.d/nginx`) |
| Conflicts and queues | `/admin/wikios-settings`: Conflict log, Inbound sync quarantine and MediaWiki Mirror Outbox (step 10d) |
| Sister wikis | IxStates' own log (as for the webhook) and `pm2 logs ixstats-cron --lines 500 --nostream`, through `grep -iE 'circuit (open\|closed)\|could not be reached'`. `[upstream-guard] <Wiki> (<host>): circuit open after N failures in a row` and `... circuit closed; requests resume.` cover WikiOS's reads and the `api.php` proxy alike; a search across all wikis also warns `<Wiki> could not be reached`, at most once a minute per wiki. A breaker that opens and never closes means that wiki, or the server's route to it, is down: repeat step 4c's server check |

### 10a. PHP-FPM watchdog: make it probe MediaWiki, not WikiOS (before step 8)

**Deferred takeover step: not run at this launch** (see "Order matters").

The watchdog (`/ixwiki/private/scripts/php-fpm-watchdog.sh`, service `php-fpm-watchdog`) restarts PHP-FPM when the
wiki answers HTTP 500. After the cutover `/wiki/*` is WikiOS, so a probe of `/wiki/Main_Page` would restart PHP-FPM
(and DM the admin) for WikiOS errors PHP-FPM cannot fix, and would stop noticing real MediaWiki failures. Its other
trigger, more than 50 `upstream prematurely closed` lines in 60 seconds of `/var/log/nginx/error.log`, stays valid.

```bash
grep -nE 'curl|https?://|Main_Page|/wiki/' /ixwiki/private/scripts/php-fpm-watchdog.sh     # find the probe URL
bk /ixwiki/private/scripts/php-fpm-watchdog.sh php-fpm-watchdog.sh
sudoedit /ixwiki/private/scripts/php-fpm-watchdog.sh
```

Replace the probe URL the `grep` showed with the private render engine (up since step 4, always MediaWiki, not
subject to Cloudflare or the public rate limits):

```
http://127.0.0.1:8081/api.php?action=query&meta=siteinfo&format=json
```

If the script also greps the response body for a string from the old page, use `sitename`. Acceptable alternative
once step 8 is done: `https://ixwiki.com/classic/Main_Page`. Do **not** use the public `https://ixwiki.com/api.php`:
it moves to WikiOS when WikiOS serves its own `api.php` subset.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:8081/api.php?action=query&meta=siteinfo&format=json'   # 200
sudo bash -n /ixwiki/private/scripts/php-fpm-watchdog.sh
sudo systemctl restart php-fpm-watchdog
systemctl status php-fpm-watchdog --no-pager | head -5
tail -n 20 /ixwiki/private/logs/php-fpm-watchdog.log        # no restart entry after the edit
```

**Rollback:** `sudo cp -a "$BK/php-fpm-watchdog.sh" /ixwiki/private/scripts/php-fpm-watchdog.sh && sudo systemctl restart php-fpm-watchdog`.

### 10b. Bot defense and fail2ban: do not count WikiOS' chatty requests (before step 8)

**Deferred takeover step: not run at this launch** (see "Order matters").

The bot-defense daemon (`/usr/local/bin/ixwiki-bot-defense.sh`, 60 requests per minute per IP, set in
`/etc/ixwiki-defense.conf`) and the fail2ban jail `ixwiki-bots` (more than 60 requests per minute, one-hour ban) both
read `/var/log/nginx/access.log`. One cold WikiOS page load is a document plus dozens of `/_next/static/` chunks, fonts
and flag files, and every page then sends tRPC batches (`/api/trpc/`) and an IxTime refresh (`/api/ixtime/current`). Two
article views in a minute can cross 60, and a real reader would be blocked at the Cloudflare edge. Two changes, both
default:

**1. Keep the chatty locations out of the counted log.** They are still logged, in their own file, which the daemon and
fail2ban do not read and Debian's nginx logrotate already rotates (`/var/log/nginx/*.log`). Run this on the copy of the
snippet in step 8a, before `nginx -t`:

```bash
grep -n 'var/log/nginx' /etc/logrotate.d/nginx              # expect the /var/log/nginx/*.log glob: the new file rotates too
sudo sed -i -E '/^location (\^~|=) \/(_next|fonts|flags|maplibre|images\/flags|images\/wikios|wikios-|favicon-wikios|api\/trpc|api\/ixtime\/current)[^ ]* \{$/a\    access_log /var/log/nginx/wikios-quiet.log;' /etc/nginx/snippets/wikios-takeover.conf
grep -c 'wikios-quiet.log' /etc/nginx/snippets/wikios-takeover.conf     # must print 10 (run the sed once only)
```

**2. Raise the per-IP limits.** Dynamic `/wiki/` views still count, and a reader who opens several articles quickly
must not be banned:

```bash
bk /etc/ixwiki-defense.conf ixwiki-defense.conf
bk /etc/fail2ban/jail.d/ixwiki-bots.conf ixwiki-bots.jail.conf
grep -niE 'ip|per' /etc/ixwiki-defense.conf                 # the per-IP requests-per-minute value (default 60)
sudoedit /etc/ixwiki-defense.conf                           # set it to 240
sudoedit /etc/fail2ban/jail.d/ixwiki-bots.conf              # multiply the ixwiki-bots maxretry by 4 (same findtime)
sudo systemctl restart ixwiki-bot-defense && sudo fail2ban-client reload
```

Check after the cutover, from a browser with a cold cache: open `https://ixwiki.com/wiki/Main_Page` and three more
articles within a minute, then

```bash
/usr/local/bin/ixwiki-bot-defense.sh status               # your IP must not be listed as blocked
fail2ban-client status ixwiki-bots                        # your IP must not be banned
```

If a reader is blocked: `sudo fail2ban-client set ixwiki-bots unbanip <ip>`, and remove the IP under Cloudflare,
Security, WAF, Tools (IP Access Rules). Trade-off of change 1: a flood of requests to the quiet locations is no longer
seen by the daemon and fail2ban (Cloudflare still sees it, and `wikios-quiet.log` has it).

**Rollback:** `sudo cp -a "$BK/ixwiki-defense.conf" /etc/ixwiki-defense.conf && sudo cp -a "$BK/ixwiki-bots.jail.conf" /etc/fail2ban/jail.d/ixwiki-bots.conf && sudo systemctl restart ixwiki-bot-defense && sudo fail2ban-client reload`;
for change 1, re-copy the snippet from the checkout (step 8a) and `sudo nginx -t && sudo systemctl reload nginx`.

### 10c. Emergency lever: turn TemplateStyles off

Articles keep the `<style>` blocks that MediaWiki's TemplateStyles extension writes, after the sanitizer has scoped every
selector under `.mw-parser-output` and filtered each declaration (`src/lib/utils/scope-template-styles.ts`; plan 415).
If a CSS bypass is ever reported (a template's sheet styling the reader's chrome, hiding the page, or loading a host
other than the wiki's), do not debug it first: switch the feature off, then fix it. With `WIKIOS_TEMPLATESTYLES=0` the
sanitizer removes **every** `<style>` from article HTML, the behaviour before plan 415 (templates that lay themselves out
with TemplateStyles then render unstyled, which is ugly but safe). The lever **fails closed**: only unset, empty, `1`,
`true`, `on` and `yes` (any case) leave TemplateStyles on; every other value, `0` and `off` and a typo alike, turns it off.

```bash
bk "$IX/.env.production.local" env.production.local
( umask 077; printf '\nWIKIOS_TEMPLATESTYLES=0\n' >> "$IX/.env.production.local" )
ls -l "$IX/.env.production.local"                      # same mode as before (-rw-------)
# the setting is read once at start by config.ts: restart IxStates (its usual restart) and WikiOS
pm2 restart wikios --update-env
```

The setting is part of the sanitizer fingerprint that every stored article bundle carries (`RENDERER_VERSION`), so no
purge is needed: a bundle built under the other setting counts as outdated, so a reader gets it re-sanitized by the current
rules at once (with the lever pulled, the styles are gone from the first read after the restart) and the article is
re-rendered in the background, and the `wiki-render-stale` job works through the rest (sister-wiki renders live in memory and
go with the restart). Check an article whose
templates use TemplateStyles (`<Title>` below; it printed 1 or more before):

```bash
curl -s "https://ixwiki.com/wiki/<Title>" | grep -c 'data-mw-deduplicate'     # 0 once the lever is pulled
```

**Turning it back on** (after the scoper is fixed and `bun run audit:template-styles` reports 0 violations and 0
non-idempotent outputs): restore the file (`sudo cp -a "$BK/env.production.local" "$IX/.env.production.local"`) or delete the
`WIKIOS_TEMPLATESTYLES` line (or set it to `1`), and restart both processes as above; the outdated bundles are re-rendered in the background and the styles come back as they are. A misspelt
value (`ture`, `enabled`) keeps it **off**: check with the `curl` above that the styles are back.

**Rollback:** the same lines, in reverse.

### 10d. Conflicts between WikiOS and classic, and the known limits

When WikiOS and classic both change a page (an edit, a delete, a move or an undelete), the later save by its actual save
time wins on both wikis; a tie within the same second goes to classic. Every overwritten editor is told: an in-app notice
(and a Discord DM when their account is linked) with a "Restore my text" button, a short note on their classic user talk
page, and an edit-summary trail on the winning revision. Each collision is one row of the Conflict log in
`/admin/wikios-settings`. The overwritten revision stays in both histories. An inbound step that keeps failing is
quarantined (Inbound sync quarantine), and a mirror job that fails eight times is dead (MediaWiki Mirror Outbox); both
sections say what failed and offer a retry.

WikiOS's own writes (the trail edits and the talk notes) never win or lose by time. The trail of a classic edit that won
is written only while that edit is still the page's head. If a classic editor saved again before a trail or a note
reached classic, the mirror job sends nothing and finishes with a note saying so, and the next inbound cycle brings the
classic edit over. A talk note that someone's classic edit of their talk page left out is written again on top of that
edit by the next settling. Only the newest copy of a note counts: an older copy that never reached classic stays in
WikiOS's history and is never written again, so a person who archived the newer copy is not sent the note a third time.

Known limits. None of them loses text; each can leave someone untold or a page needing a hand fix:

- **Two classic moves after one WikiOS move.** When classic moves a page twice after a WikiOS move of it, only the first
  classic move is judged against the WikiOS move. The page ends up where the second move put it, but the second mover is
  not told that a WikiOS move was overwritten.
- **A talk note that cannot be delivered.** When the overwritten editor's classic user talk page is deleted, the note is
  recorded as undelivered (the Conflict log says "Not delivered: talk page deleted") and is never retried. A talk page
  that refuses the note for a day, and a Discord DM that fails for a day, are given up the same way ("Not delivered: the
  talk page refused the note for a day", "Not delivered: the Discord DM failed for a day"). Their other notices still go
  out.
- **A same-millisecond tie.** A classic revision that a classic restore brought back, dated to the same millisecond as a
  WikiOS revision, can stay below it instead of becoming the head. Fix the page by hand: if its step is in Inbound sync
  quarantine, use "Resync page from classic"; otherwise open the page's history in WikiOS and revert to that classic
  revision (a new edit, which the mirror copies to classic).
- **A classic recreate quarantined after a WikiOS delete.** If a classic editor recreated a page that WikiOS deleted, and
  that step is quarantined, resync the page from classic before you retry the step.
- **A second classic move after a dead WikiOS move.** Before you requeue a dead WikiOS move job, open the page's classic
  move log (`Special:Log/move` for the page). If classic moved the page more than once since, the requeued move is judged
  against the first classic move only, so check where the page is and move it by hand if needed.

What the operator does:

- **"Not delivered" in the Conflict log.** For every notice marked "Not delivered", tell the person by hand: on their
  classic talk page, or by Discord, with a link to the page's history.
- **After you discard a dead WikiOS move**, classic keeps the page at its old title. Later WikiOS edits and protections
  of the page are mirrored to that classic page (found by its page id), never to a second page at the new title. Move it
  by hand on classic if both wikis should use the new title.
- **Every outbox and quarantine action is audited.** Requeue, discard (one job or in bulk), retry, dismiss and resync
  each write an admin audit log row naming who did it and which ids or how many.

## 11. Footprint measurement

**Deferred takeover step: not run at this launch** (see "Order matters").

Compare with `baseline.txt` from step 0 (run once traffic has settled, then again a day later):

```bash
{
  date -Is
  echo "--- php-fpm pool RSS (MB):"
  ps -C php-fpm8.4 -o rss= | awk '{s+=$1} END {printf "%.0f\n", s/1024}'
  echo "--- wikios:"
  pm2 jlist | jq -r '.[] | select(.name=="wikios") | "rss=\((.monit.memory/1048576)|floor)MB cpu=\(.monit.cpu)%"'
  echo "--- free -m:";  free -m
  echo "--- uptime:";   uptime
  curl -s -o /dev/null -w "Main_Page total: %{time_total}s\n" "https://ixwiki.com/wiki/Main_Page"
} | tee /ixwiki/private/logs/wikios-cutover/after.txt
diff /ixwiki/private/logs/wikios-cutover/baseline.txt /ixwiki/private/logs/wikios-cutover/after.txt
```

Expectations: the `wikios` RSS stays below the 1400 MB PM2 restart limit of the example ecosystem file (Node heap
limit 1536 MB), the PHP-FPM pool RSS drops because `/wiki/*` views no longer run PHP, and the page time does not get worse.

## 12. Rollback (full)

**Deferred takeover step: not run at this launch** (see "Order matters").

Reverses step 8 only; WikiOS keeps running harmlessly on loopback. Undo in the opposite order of step 8, MediaWiki
first (so MediaWiki stops emitting `/classic/` links before `/classic/` disappears):

```bash
sudo cp -a "$BK/LocalSettings.php.step8" /ixwiki/config/LocalSettings.php        # article path back to /wiki/
php -l /ixwiki/config/LocalSettings.php && sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm
sudo cp -a "$BK/ixwiki.com.nginx" "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"
sudo nginx -t && sudo systemctl reload nginx
mwmaint purgeParserCache --age 0                                                 # /classic/ links out of cached HTML
# then purge the Cloudflare cache for /wiki/* again (step 8b)
curl -s -o /dev/null -w '%{http_code}\n' https://ixwiki.com/wiki/Main_Page      # MediaWiki again
```

To stop WikiOS taking edits as well, turn the switch off (step 6b's rollback line).

(The files in `/etc/nginx/conf.d/` and `/etc/nginx/snippets/` are inert without the `include`; the `wikios-upstream.conf`
`map`s and `upstream` are harmless.) Undo steps 10a and 10b from their own rollback lines if the watchers misbehave.
To also stop WikiOS: `pm2 delete wikios && pm2 save`.

## Server-local files this cutover edits

Every one of them is copied into `$BK` before its first edit. The first two rows are tracked in git now: their changes
arrive in a commit, never as a hand edit on the server (`deploy-production.sh` resets the checkout).

| File | Edit | Step |
|------|------|------|
| `/ixwiki/public/projects/ixstats/next.config.js` | tracked: `resolveBasePath()` WikiOS branch; `rewrites()` early return; `"iconoir-react"` and `"motion/react"` added to `experimental.optimizePackageImports` (deferred takeover build) | 5 |
| `/ixwiki/public/projects/ixstats/public/fonts/HostGrotesk/HostGrotesk[wght].ttf` | tracked since 2026-10-06; must exist: `next/font/local` fails the build without it | 5 |
| `/ixwiki/public/projects/ixstats/.env.production.local` | `WIKIOS_API_SESSION_SECRET` (1c); `WIKIOS_MEDIAWIKI_BOT_USER`, `WIKIOS_MEDIAWIKI_BOT_TOKEN`, `WIKIOS_MEDIAWIKI_INTERNAL_URL` (never `NEXT_PUBLIC_WIKIOS_STANDALONE`; `WIKIOS_MEDIAWIKI_API` absent or private, 4); `WIKIOS_UPLOAD_DIR` (plan 411, 6a); `NEXT_PUBLIC_APP_URL` / `APP_URL` `https://ixwiki.com`, base path absent or `/projects/ixstates`, the same in `.env.production` (6a); `RATE_LIMIT_ENABLED` unset or `true` (6a); `WIKIOS_V1_ENABLED=true` (6b) | 1c, 3c, 4, 5, 6a, 6b |
| `/ixwiki/shared/wikios-uploads/` | new directory (750): the staging directory of uploads waiting for the mirror; in the backups until none is waiting | 5 |
| `/ixwiki/public/projects/ixstats/ecosystem.config.cjs` | `CRON_ENABLED_JOBS` for `ixstats-cron` names `wiki-render-stale`, `wiki-mirror` and `wiki-recentchanges` (then `pm2 restart ixstats-cron --update-env`) | 7b |
| `/ixwiki/public/wikios/ecosystem.wikios.config.cjs` | new, from the `.example`; `WIKIOS_LEAN_FLIGHT: "1"` added to `env` in 9a | 5, 9a |
| `/ixwiki/public/wikios/.env.wikios-build` | new: `NEXT_PUBLIC_IXSTATES_URL` (build-time, WikiOS only) | 5 |
| `/etc/nginx/conf.d/wikios-render-internal.conf`, `wikios-upstream.conf` | new | 4, 8 |
| `/etc/nginx/snippets/wikios-proxy-params.conf`, `wikios-takeover.conf` | new | 8 |
| target of `/etc/nginx/sites-enabled/ixwiki.com` | `include` added; `/wiki/` location, `@mediawiki` `/wiki/` rewrite and any `location = /` removed | 8 |
| `/ixwiki/config/LocalSettings.php` | `require_once` of the snippet (3a); `define( 'WIKIOS_TAKEOVER', true );` added before the require only in the deferred 8b | 3a, 8b |
| `/ixwiki/config/wikios-localsettings.php` | new, copy of the tracked snippet (mode 644) | 3a |
| `/etc/php/8.4/fpm/pool.d/www.conf` | `env[WIKIOS_WEBHOOK_SECRET]`, `env[WIKIOS_WEBHOOK_URL]`; mode 0640 root:root | 6 |
| `/ixwiki/private/scripts/php-fpm-watchdog.sh` | probe URL `http://127.0.0.1:8081/api.php?...` | 10a |
| `/etc/ixwiki-defense.conf` | IP whitelist (127.0.0.1, ::1, the egress addresses) and user-agent whitelist (`IxStats-Builder`) | 4b |
| `/etc/fail2ban/jail.d/ixwiki-bots.conf` | `ignoreip` in the three ixwiki jails | 4b |
| `/etc/ixwiki-defense.conf`, `/etc/fail2ban/jail.d/ixwiki-bots.conf` | per-IP limit 240; `maxretry` x 4 | 10b |
| `/ixwiki/shared/bots/discord/.env` | MediaWiki API URL on IxStates' loopback `/w/api.php`; the new bot password | 6c |
| classic's database, table `interwiki` (not a file; dumped to `$BK/interwiki.3e.sql` first) | rows for `iiwiki` and `althistory`, when they are not added on `Special:Interwiki` | 3e |
| classic's `robots.txt` (`$DOCROOT/robots.txt`) | IxStates' 13 `Allow` / `Disallow` lines in its `User-agent: *` group and each named crawler group that does not block the whole site | 6d |

## Later

IxStates moves to ixstates.com (owner decision D11): then `NEXT_PUBLIC_IXSTATES_URL` in `$WK/.env.wikios-build`
changes, the WikiOS build is redeployed, and classic MediaWiki moves to `classic.ixwiki.com`. WikiOS's api.php already
answers at `/w/api.php` (step 8a); when bots have moved to it, `/api.php` can join the WikiOS locations in
`wikios-takeover.conf` and the matching row of `verify-wikios-takeover.ts` changes.
