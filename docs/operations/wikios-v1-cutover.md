# WikiOS launch runbook (launch without takeover)

**Status:** nothing in this runbook has been run. Every command in it is for the launch deploy on the production server
(`ssh ixwiki`), run step by step with the owner (the no-touch exception of 2026-10-24): read-only checks and dry runs
first, and stop at anything unexpected. Plan 417 (September 30, 2026) wrote it as the takeover runbook, and the owner's
launch shape of 2026-10-24 made it this one. It replaces the superseded
[Stage 3 config plan](../systems/wikios/wikios-stage3-config-plan.md).

**What changes.**

- WikiOS serves the wiki inside IxStates, at `https://ixwiki.com/projects/ixstates/wiki/…` (port 3550, under IxStates'
  base path).
- Classic MediaWiki stays public and editable at `ixwiki.com/wiki/*`, and canonical links stay on classic.
- MediaWiki also becomes WikiOS's private render engine on `127.0.0.1:8081` (`action=parse&text=`, step 4).
- Classic's saves reach IxStates through the webhook (`WIKIOS_WEBHOOK_URL`, step 6), and WikiOS's edits are mirrored to
  classic (step 6b).
- Bots move to IxStates' `/w/api.php` (step 6c).
- There is no `wikios` process, no nginx takeover and no `/classic/` article path. Those belong to the takeover, which
  the owner deferred: they are the last section, "Deferred: the ixwiki.com takeover (do not run)".

IxWorld (port 3002) is untouched.

**Order matters.** Run the launch steps by hand, one at a time, in this order:

- 0, then 0b (owner-approved: it moves the checkout to the release, whose files steps 1, 1b and 4 run), then 1, step
  1b's `verifiedById` fix-up, 1c. All of them come before step 2's deploy: step 1's `2026-09-30-wikios-api.sql` above
  all (see "The data-safety SQL runs before the push"), and the `verifiedById` fix-up while the IxnayID identity deploy
  has not run (that deploy's conversion reads it).
- Before step 2's deploy: step 4's loopback server and its env line, step 6a's app URL check and the `ixstats-cron`
  job list (step 2 says why).
- 2, then step 1b's rights import (its dry run and `--yes` run), then 2a. The import runs after the deploy, as in the
  [release guide](release-guide.md#b4-right-after-the-deploy-in-order) (B4 step 10). That is safe: WikiOS editing stays
  off until step 6b (`WIKIOS_V1_ENABLED`), and WikiOS takes no write before the import's protections marker anyway.
- 3 (3a to 3e), then step 4's bot-login check, which needs 3c.
- 4b, 4c (its proxy check waits for 6b), 4d.
- 5b (optional, any time after step 2). 5c is a reference: use it only when an import or the upload limit needs it.
- 6, 6a, the `/images/` headers of 7c, then 10b. All of them come before 6b.
- 6b, then 6c and 6d.
- 7b, then 7c's upload check.
- 7d, then 7e (off-peak, about 2 hours). 7e turns the weekly proof job on only after its launch proof has passed.
- 10 (monitor), with 10c and 10d as references.

Few of these steps change what the public sees on ixwiki.com: loading the snippet in step 3 changes neither classic's
article path nor its canonical link, though it lets every uploader on classic upload SVG and PDF files (3a); step 3e
lets classic's editors write `[[iiwiki:...]]` and `[[althistory:...]]` links; step 7c makes nginx send uploaded PDF and
SVG files under `/images/` as downloads; and step 6d only adds IxStates' rules to classic's `robots.txt`. Step 6b lets
the wiki inside IxStates take edits, and step 6c moves the bots to it.

Every step has a rollback line that names the backup it restores.

## Before the launch

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

**Incomplete until the launch steps run (nothing breaks):**

- With no background render, WikiOS fills its link, template and image tables only for pages someone opens. "What links
  here" and page images stay incomplete until step 7b; feed cards then fall back to the picture in the article's intro.
- Until step 1's manual SQL runs (before the deploy), these are missing: integer ids for api.php (`pageId`, `revId`,
  `logId` sequences, triggers and backfills), the generated search vector and its GIN and trigram indexes, the redirect
  backfill and the default protections. Every file is idempotent and safe to apply before the switch;
  `2026-09-30-wikios-stash-key.sql` can run at any time.

**Unsafe before the launch steps:**

- Turning `WIKIOS_V1_ENABLED` on before steps 1, 3 and 4. Writes would queue in an outbox with no mirror account, api.php
  would hand out pages without ids, and background renders would have no render engine (in production they refuse the
  public MediaWiki and wait for step 4). (Writes themselves wait for the protections marker of steps 1 and 1b, see
  below, but the renders do not.)
- Steps 1 and 1b are mandatory before any WikiOS write. Until step 1b's `--yes` run has written the protections marker,
  WikiOS refuses every write in both modes, `WIKIOS_V1_ENABLED` included, and the editing toggle refuses to turn on.
- `NEXT_PUBLIC_WIKIOS_STANDALONE` in any env file, at any time: it would turn the IxStates build into the deferred
  takeover's standalone WikiOS (deferred step T5 explains).

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

**The editing toggle (before step 6b):**

- **Where.** `/admin/wikios-settings`, Editing section; stored as the SystemConfig row `wikios_editing_enabled`
  (`src/lib/wiki-os/editing-switch.ts`). Both processes (IxStates and `ixstats-cron`) read the row at most every 15
  seconds, so a flip reaches both within 15 seconds. Each flip is written to the admin audit log and DMed to
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
  wait instead, set `SKIP_MEDIAWIKI_SYNC=true` in `.env.production.local` (then `pm2 restart ixstats-cron --update-env`
  and `pm2 restart "$IXAPP" --update-env`: both read the file at start), or drop `wiki-mirror` from `CRON_ENABLED_JOBS`
  in `ecosystem.config.cjs` and restart `ixstats-cron` from the file (Conventions): `( cd "$IX" && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save`,
  then read the list back with `pm2 jlist | jq -r '.[] | select(.name == "ixstats-cron") | .pm2_env.CRON_ENABLED_JOBS'`.

Files the launch installs (all in the IxStats checkout, `/ixwiki/public/projects/ixstats/`, which step 0b brings to the
release and step 2 deploys):

| File | Installed as | Step |
|------|--------------|------|
| `scripts/ops/mediawiki/wikios-localsettings.php` | `/ixwiki/config/wikios-localsettings.php` | 3a |
| `scripts/ops/mediawiki/Template-Sister.wikitext` | the text of `Template:Sister` on classic | 3d |
| `scripts/ops/nginx/wikios-render-internal.conf` | `/etc/nginx/conf.d/wikios-render-internal.conf` | 4 |

The rest of plan 417's kit (the standalone build, its PM2 file, the nginx takeover snippets and the takeover verifier)
serves only the deferred takeover. Its table is in the deferred section.

## Conventions (read once)

- **Shell setup.** Paste this at the top of every new shell before any step. It defines absolute paths only: no step
  changes directory without a subshell `( cd ...; ... )`, so a pasted block never leaves you somewhere else.

  ```bash
  IX=/ixwiki/public/projects/ixstats                          # the IxStats checkout
  MW=/ixwiki/mediawiki/releases/1.45.1                        # the MediaWiki install (adjust if it differs)
  BK=$(cat /ixwiki/private/backups/wikios-cutover.latest)     # the backup directory created in step 0
  IXSTATES_URL=https://ixwiki.com/projects/ixstates           # the public IxStates URL that answers (see below)
  IXAPP=ixstates                                              # the IxStates web app's PM2 name (see below)
  # MediaWiki maintenance scripts run as the web user and read the production settings file:
  mwmaint() { sudo -u www-data env MW_CONFIG_FILE=/ixwiki/config/LocalSettings.php php "$MW/maintenance/run.php" "$@"; }
  # keep a copy of a file in $BK under a given name before editing it:  bk <file> <name>
  bk() { sudo cp -a "$1" "$BK/$2" && ls -l "$BK/$2"; }
  ```

  Step 0 creates `$BK`, so it skips the `BK=` line (it fails on the first run) and sets `BK` itself.
- **The IxStates URL (read-only, once).** Production nginx proxies `location ^~ /projects/ixstats` to port 3550, but the
  repo's `next.config.js` and deploy scripts use the base path `/projects/ixstates`. Only one of the two answers:

  ```bash
  curl -sI -o /dev/null -w '/projects/ixstats/  -> %{http_code}\n' https://ixwiki.com/projects/ixstats/
  curl -sI -o /dev/null -w '/projects/ixstates/ -> %{http_code}\n' https://ixwiki.com/projects/ixstates/
  ```

  The working one answers 200 or a redirect (307/308) to a page; the other answers 404 from MediaWiki. Put the working
  one, with no trailing slash, in the `IXSTATES_URL=` line above. If neither answers because IxStates is not running,
  keep the default and run the check again after step 2.
- **The IxStates process (read-only, once).** List the PM2 apps:

  ```bash
  pm2 jlist | jq -r '.[].name'
  pm2 jlist | jq -r '.[] | "\(.name) \(.pm2_env.status) \(.pm2_env.pm_cwd // "")"'     # the same, with status and directory
  ```

  Put the IxStates web app's name in the `IXAPP=` line above. The 2026-10-24 check saw `ixstates`, stopped;
  `ixstats-cron` is the cron runner, not the web app. If no PM2 app runs IxStates from `$IX`, stop and ask the owner how
  IxStates is started: every restart and log line below assumes PM2. If the app is listed as stopped, ask the owner
  before the first restart, because a restart starts it.
- **Restarting IxStates** is always `pm2 restart "$IXAPP" --update-env`, so it reads its env files again. `ixstats-cron`
  restarts the same way: `pm2 restart ixstats-cron --update-env`. After an edit to `ecosystem.config.cjs` (its
  `CRON_ENABLED_JOBS`), restart it from the file instead, because PM2 keeps a process's stored environment across a
  restart by name: `( cd "$IX" && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save`.
  Steps 6b, 7b and 7e then check which jobs the runner scheduled.
- **IxStates' logs** are read with `pm2 logs "$IXAPP" --lines <n> --nostream`, piped to `grep`.
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
git -C "$IX" log -1 --oneline   # the commit running now; step 0b moves the checkout to the release
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

The baseline is for comparing the server a day after the launch: run the same block again into `after.txt` and
`diff` the two. **Rollback:** nothing changed.

## 0b. Bring the checkout to the release (owner-approved, no build)

Steps 1, 1b and 4 run files from `$IX` that only the release has (step 1's SQL, step 1b's rights import, step 4's
nginx file), but only step 2's deploy moves the checkout. So the checkout moves to the release here, as the deploy
moves it (`scripts/deploy-production.sh`: fetch, `reset --hard`, `bun install --frozen-lockfile`, `bun run db:generate`),
with nothing else the deploy does: no backup, no additive schema step, no build, no migration, no PM2 reload. Ask the owner before
running it: from here to step 2 the checkout holds code that is not running.

- **IxStates keeps running its old build.** `.next` is not touched (only the deploy moves it aside, when its build
  starts), and
  what the app has loaded stays loaded, though a module it loads for the first time comes from the new `node_modules`.
  Keep the time from here to step 2 to one sitting. The other apps of `ecosystem.config.cjs` (websockets, sync) keep the
  code they loaded at start, unless PM2 restarts one (a crash, a memory restart): it would then start on the release's
  code against the old schema. If `pm2 jlist` shows a restart in this window, go straight on to step 2, or run the
  rollback below. `git -C "$IX" diff "$(cat "$BK/previous-release.sha")" "$(cat "$BK/release.sha")" -- bun.lock | grep -E '"(next|react|@prisma/client)"'`
  shows whether the core packages changed, which is how much a first-time module load risks.
- **`ixstats-cron` stops until step 2.** The runner imports a job's module the first time the job runs, so a running
  `ixstats-cron` would load the release's job code against the old schema. No scheduled job runs from here to step 2's
  PM2 reload, which starts it again; each job runs at its next slot after that.

```bash
B=$(git -C "$IX" branch --show-current); echo "$B"            # master: the deploy refuses any other branch
git -C "$IX" status --short                                  # only " M src/lib/buildVersion.generated.ts" (every build rewrites it), or ask the owner: reset --hard drops a changed tracked file, the deploy's clean -fd an untracked one
git -C "$IX" rev-parse HEAD | tee "$BK/previous-release.sha"  # the commit running now, for the rollback
bk "$IX/next.config.js" next.config.js.0b; bk "$IX/postcss.config.js" postcss.config.js.0b  # the release tracks both, so the reset replaces production's copies: diff them with the release's (release guide B2) and ask the owner about any production-only line
git -C "$IX" fetch master "$B"                               # the deploy's own fetch
git -C "$IX" log -1 --oneline FETCH_HEAD                     # the release: the owner confirms it before the reset
git -C "$IX" rev-parse FETCH_HEAD | tee "$BK/release.sha"
pm2 stop ixstats-cron
git -C "$IX" reset --hard "$(cat "$BK/release.sha")"
( cd "$IX" && bun install --frozen-lockfile && bun run db:generate )
git -C "$IX" log -1 --oneline                                # the release
```

**Rollback (before step 2):** put the checkout back on the commit that is running and start the runner again:
`git -C "$IX" reset --hard "$(cat "$BK/previous-release.sha")"`, then
`( cd "$IX" && bun install --frozen-lockfile && bun run db:generate )`, then
`( cd "$IX" && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save`. The old build was never
removed, so nothing needs building. Step 1's SQL, if it ran, is additive and the old code ignores it. After step 2, use
step 2's rollback instead.

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

**When.** Two parts, at two times (the order list at the top). The `verifiedById` fix-up comes before step 2's deploy
while the IxnayID identity deploy has not run: that deploy's conversion reads it. The import itself (the dry run and
the `--yes` run, "Then dry-run the import" below) comes after step 2's deploy, as in the
[release guide](release-guide.md#b4-right-after-the-deploy-in-order) (B4 step 10). Running it then is safe: WikiOS
editing stays off until step 6b, and no WikiOS write is taken before the marker exists.

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
  before it is set takes nothing down. Without it, api.php answers `action=login`, a login token
  (`meta=tokens&type=login`) and any request that carries a session cookie with the MediaWiki error
  `sessionsecretmissing`; it never signs or accepts a session with a fallback key, in development either. Anonymous
  reads (`meta=siteinfo`, `list=allpages`, `action=parse&page=`, ...) keep working, and one warning is logged the first
  time the missing key is needed. Set it before step 6c so bots can log in (step 6c's bot login fails until then).
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
stored that cannot be recreated): rotate it if it may have leaked, then restart IxStates
(`pm2 restart "$IXAPP" --update-env`). Bot passwords themselves are not affected: users create them on
`Special:BotPasswords` in WikiOS, and each is stored as a salted scrypt hash.

**Rate limits.** api.php counts requests per client in the buckets `wiki_api`, `wiki_api_write`, `wiki_api_login` and
`wiki_api_render` (limits and keys in [rate-limiting.md](rate-limiting.md#wikios-buckets)); there is nothing to
configure, but a bot that is throttled sees MediaWiki's `ratelimited` error, and a client that logs in over and over sees
`Throttled`. The same file lists the other WikiOS buckets (`wiki_upload`, `wiki_media`, `wiki_export`, `wiki_raw`,
`wiki_read`, `wiki_proxy` and the two webhook ones).

**Rollback:** `sudo cp -a "$BK/env.production.local.1c" "$IX/.env.production.local"` and restart IxStates (`pm2 restart "$IXAPP" --update-env`): bots
get `sessionsecretmissing` again and nothing else changes.

## 2. Deploy IxStates as usual

**Before this deploy:** step 1 (at least `2026-09-30-wikios-api.sql`, see "The data-safety SQL runs before the push"),
and step 1b's `verifiedById` fix-up if the IxnayID identity deploy has not run (the deploy's conversion reads it).

**Before this deploy (launch time), when the release carries the integration and hosts work (plan 2026-10-25):**

1. Step 4's loopback server and its `WIKIOS_MEDIAWIKI_INTERNAL_URL` line. They use plan 417's files, which the checkout
   holds since step 0b. Step 4's bot-login check needs step 3c, so run that check after step 3. Without the variable,
   production renders nothing through MediaWiki: forum posts, template previews and revision views are compiled locally
   until it is set ("Before the launch" above).
2. Step 6a's app URL check. `NEXT_PUBLIC_APP_URL` is written into the build, so a value fixed after the build needs
   this deploy again, not only a restart.
3. The read-only checks of the WikiOS proof check, below.
4. The `ixstats-cron` job list. The deploy's PM2 reload (`pm2 startOrReload ecosystem.config.cjs --update-env`) starts
   `ixstats-cron` with the `CRON_ENABLED_JOBS` of `ecosystem.config.cjs`, and `"*"` there enables every job of this
   release, `wikios-proof`, `wiki-mirror` and `wiki-render-stale` among them, long before steps 6b and 7e want them.
   Replace a `"*"` with the explicit list (the reload reads the file, so no restart here):

   ```bash
   grep -n 'CRON_ENABLED_JOBS' "$IX/ecosystem.config.cjs"     # an explicit list: nothing to do. "*": the next three lines
   # every job of this release but those three, as the list to put in place of "*"
   grep -oE '^\s+name: "[a-z0-9-]+"' "$IX/src/server/cron/jobs.ts" | sed -E 's/.*"(.*)"/\1/' \
     | grep -vxE 'wikios-proof|wiki-mirror|wiki-render-stale' | paste -sd, -
   bk "$IX/ecosystem.config.cjs" ecosystem.config.cjs.2
   "${EDITOR:-nano}" "$IX/ecosystem.config.cjs"               # CRON_ENABLED_JOBS: "<the printed list>"
   ```

   **Rollback:** `sudo cp -a "$BK/ecosystem.config.cjs.2" "$IX/ecosystem.config.cjs"`, then restart `ixstats-cron` from
   the file (Conventions).

**The WikiOS proof check (launch time).** The deploy runs `bun scripts/audit/wikios-proof.ts predeploy` after its
database backup and its additive schema step, before its SQL files and `db push`
([the proof's README](../audits/wikios-proof/README.md)). It takes the `wikios-proof` job lease (the additive step
creates `job_leases` on a database that lacks it, and a check that still finds no such table takes no lease, since no
weekly proof can hold one), checks that `docs/audits/wikios-proof/latest.json` is a clean, passing proof of this
release's WikiOS files (its tree key), and runs the editor round trip over every page of the production database (about
15 seconds). It prints one line per check, `ok   <check>: ...` or `FAIL <check>: ... Fix: ...`, and the deploy stops on
any `FAIL`. A refused deploy changes no rows, reads only and gives its lease back, and it leaves the live build in place:
the deploy no longer deletes `.next` (it moves it aside only when the build starts, after the check). What stays done:
the checkout is reset to the release (`reset --hard`, `clean -fd`), its dependencies are installed and its Prisma client
generated, the database is backed up and the additive schema changes are applied (new types, tables and nullable or
defaulted columns only). A server still running keeps serving the old build, but IxStates is stopped for this launch
(release guide B3 step 1), and a stopped server must not be started on that checkout: its `node_modules` are the
release's, not the old build's. So IxStates stays down until a deploy builds; recover at once (below). Its reports
are `predeploy-<stamp>.json` and `.txt`, in `$IX/.bench-out/proof` until step 7e sets `WIKIOS_PROOF_DIR`, and in
`/ixwiki/private/logs/wikios-proof` after.

Read first (read-only, besides the fetch, which the deploy runs anyway and which changes no file of the checkout):

```bash
B=$(git -C "$IX" branch --show-current); echo "$B"       # the branch the deploy fetches (master)
git -C "$IX" fetch master "$B"                           # the deploy's own fetch (scripts/deploy-production.sh): moves FETCH_HEAD only
[ "$(git -C "$IX" rev-parse FETCH_HEAD)" = "$(cat "$BK/release.sha")" ] && echo "the release of step 0b" || echo "master moved since step 0b: stop and ask the owner"
git -C "$IX" show FETCH_HEAD:docs/audits/wikios-proof/latest.json | jq '{profile, passed, dirty, commit, treeDigest}'
git -C "$IX" show FETCH_HEAD:scripts/audit/wikios-proof-thresholds.json | jq '.roundTrip.minPages'    # the page floor
# the columns the round trip reads: id, source, namespace, title, wikitext
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c \
  "select count(id) as pages, count(*) filter (where namespace = 0) as articles, count(wikitext) as with_text
     from wiki_articles where source = 'ixwiki' and title is not null"
# the table the check's lease lives in: job_leases, or empty when production predates it (2026-10-05; the additive step creates it)
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c "select to_regclass('public.job_leases')"
```

- **`latest.json`** must show `profile` `local` or `launch`, `passed` true and `dirty` false. A `fatal: path ... does
  not exist` means the release carries no proof, and the deploy would refuse it: stop and tell the owner. The deploy
  compares the tree key itself.
- **The query prints counts, `pages` is at or above the floor and `to_regclass` prints `job_leases`:** deploy as usual
  (below).
- **`to_regclass` prints an empty value:** nothing to do. The deploy's additive step creates `job_leases` before the
  check, and a check that finds none takes no lease (no weekly proof can hold one).
- **The query errors with `column "..." does not exist`:** production's `wiki_articles` (2026-09-03) is older than this
  release's schema. The additive step, which runs before the check (and by hand in release guide B3 step 4), adds a
  missing column that is nullable or has a default; one that is required with no default waits for `db push`, after the
  check, and then the round trip cannot read it. Look for the column in the additive dry run
  (`( cd "$IX" && bun scripts/deployment/apply-additive-schema.ts )`, release guide A1): if it is there, apply the step
  (B3 step 4) and run the query again. If it is not, this is the one case for the override, and only for this first
  launch deploy: `( cd "$IX" && WIKIOS_PROOF_OVERRIDE=1 bun run deploy:prod )`. Every failing line then starts
  `WIKIOS PROOF OVERRIDDEN:`. The expected ones are `harness.roundtrip` and `roundTrip.*`. Any other overridden line
  (`proof.committed`, or `proof.lease`) went past a check this case does not explain: tell the owner at once. After the
  deploy, run the query again: it must print counts now. Step 7e's launch proof then runs the full round trip on the
  pushed database. Never set the override because a deploy was refused without first reading which check failed.
- **`pages` is below the floor:** every deploy and every weekly run would fail `roundTrip.pages`. Stop and ask the
  owner; do not override.

If the deploy refuses:

- **`FAIL proof.committed`:** this release's WikiOS files differ from the committed proof's, or there is no proof. The
  fix is a new local proof, committed, then the deploy again (the README says how). Ask the owner before ever
  overriding it.
- **`FAIL proof.lease: the weekly proof is running (lease held by ... until ...)`:** the weekly job (Monday 05:30 UTC,
  once step 7e has turned it on) is in progress. Wait for it to finish (at most 80 minutes;
  `pm2 logs ixstats-cron --lines 100 --nostream | grep -i wikios-proof`) and deploy again, or deploy with
  `WIKIOS_PROOF_OVERRIDE=1`: the PM2 reload ends the weekly run, and its lease lapses on its own within 90 minutes.
- **`FAIL harness.roundtrip` or `FAIL roundTrip.*` while the query above prints counts:** the new editor code would
  change saved text. Stop and give the owner the `predeploy-<stamp>.json` in the reports directory above. Do not
  override.

Whatever the refusal, IxStates (stopped for the window) stays down until a deploy builds again, so recover within
minutes, one of two ways:

- **The refusal is an expected override case** (the read-first block above says when: `roundTrip.*` on a column only
  the push adds): run the deploy again with `WIKIOS_PROOF_OVERRIDE=1`. It builds and reloads as usual.
- **Anything else** (do not override): roll back to the release that was running. The owner pushes a branch at
  `$BK/previous-release.sha` to the server's `master` remote
  (`git push origin "$(cat "$BK/previous-release.sha")":refs/heads/rollback-<date>`, from a checkout that has that
  commit), then run `( cd "$IX" && ./scripts/deployment/rollback-deployment.sh rollback-<date> )`, which deploys
  and rebuilds it with `SKIP_SCHEMA_SYNC=1` (no schema change; the refused deploy's SQL never ran, and the old code
  ignores the additive step's tables and columns). A release older than the proof CLI skips the proof check, and the
  script says so; if an older release that has it stops on a proof check, it has no committed proof: run it again with
  `WIKIOS_PROOF_OVERRIDE=1`. Then hand the owner the `predeploy-<stamp>.json`.

A deploy that dies after the check leaves the lease to lapse within 2 hours (a weekly run in that window is recorded
as `skipped`), and the next deploy takes it over. A finished deploy prints `Released the wikios-proof lease` after
its PM2 reload.

```bash
( cd "$IX" && bun run deploy:prod )     # scripts/deploy-production.sh (master only; takes its own db backup)
```

After the deploy, check (read-only) that no process logged the loopback warning. Each process logs it once, the first
time it would have rendered without `WIKIOS_MEDIAWIKI_INTERNAL_URL`:

```bash
pm2 logs ixstats-cron --lines 2000 --nostream | grep -c 'WIKIOS_MEDIAWIKI_INTERNAL_URL is not set'     # 0
pm2 logs "$IXAPP" --lines 2000 --nostream | grep -c 'WIKIOS_MEDIAWIKI_INTERNAL_URL is not set'        # 0
```

A hit means a process started without the variable: fix the env file (step 4) and restart that process.

The release arrives with `WIKIOS_V1_ENABLED` off (see "Before the launch"); leave it off until step 6b. If `db push`
stops on a unique-constraint warning, the deploy has already run its SQL, the data-safety files included, and left the
live build untouched: read every line, run `bun run db:push:force` by hand and answer yes only if each is an expected
unique constraint on a new column, then run the deploy again.

`ixstats-cron`, stopped since step 0b, is started again by the deploy's PM2 reload. Check it (read-only):
`pm2 jlist | jq -r '.[] | select(.name == "ixstats-cron") | .pm2_env.status'` prints `online`; if it prints `stopped`,
restart it from the file (Conventions).

This also runs `deploy-ixworld.sh`. WikiOS is part of IxStates at this launch, so this deploy is WikiOS's deploy as
well, and every later IxStates release carries its WikiOS code the same way.

**Rollback:** the usual IxStates rollback: `./scripts/deployment/rollback-deployment.sh <remote-branch>` (what
`bun run deploy:rollback` runs), with the branch at `$BK/previous-release.sha` pushed as in "If the deploy refuses"
above. Once the deploy's SQL has run, add `--restore` with the dump the deploy took (the last line of
`backups/deploy-history.log`): this release's SQL converts data the old code reads
([release guide, Rollback](release-guide.md#rollback)). The proof check has none of its own: it reads only, and its lease is given back on a refusal and released after
the PM2 reload.

## 2a. Fonts under the base path, uploads at the site root (read-only, after step 2)

The reader's fonts load under the base path now: the stylesheets' `url("/fonts/…")` (`src/styles/typography.css`) get
it from a PostCSS pass at build time (`scripts/setup/postcss-base-path-urls.cjs`, the same rule as next.config.js's
`basePath`), and the font preloads ask for the same URLs, so they are `/projects/ixstates/fonts/…`, served by IxStates
from its `public/fonts`, and the root `/fonts/` is no longer asked for. Uploaded flags and pictures where a page still
shows the stored path (`/images/uploads/…`, kept without the base path) are still asked for at the root of ixwiki.com.
Check from the server that both answer (read-only).

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
curl -s -o /dev/null $LOCAL -A IxStats-Builder -w '%{http_code} %{content_type}\n' 'https://ixwiki.com/projects/ixstates/fonts/Schibsted%20Grotesk-500.ttf'
curl -s -o /dev/null $LOCAL -A IxStats-Builder -w '%{http_code} %{content_type}\n' "https://ixwiki.com/images/uploads/$UP"
```

If the `echo` printed `STOP`, or the upload name is empty, stop: find an existing upload's file name (an uploaded flag's
`/images/uploads/<file>` in the database, for example) before going on, or the second check reads nothing. Expect `200`
with a font type (`font/ttf`, `application/font-sfnt`, `application/x-font-ttf` or `application/octet-stream`) for the
first, and `200` with an `image/…` type for the second.

- **`000`** (nothing listens for `ixwiki.com` on the server's port 443, so the request never left): run the two `curl`
  lines again without `$LOCAL`, through Cloudflare. There a `403` with `text/html` is Cloudflare's challenge or the bot
  defense, not missing files: finish step 4b first, then repeat this check.
- **A `404`, or a `text/html` answer, for the font**: IxStates did not serve it (`$IX/public/fonts` is missing the file,
  or nginx does not send `/projects/ixstates/` to IxStates). Stop and ask the owner.
- **The stylesheet** must ask for the same URL: in the browser, an IxStates page's stylesheet has `@font-face` URLs that
  start `/projects/ixstates/fonts/`, and the network tab shows no request to the root `/fonts/`. A root URL there means
  the build ran without the base path (no `BASE_PATH`, or the IxWorld standalone flag): stop and ask the owner.
- **A `404`, or a `text/html` answer, for the upload** (classic MediaWiki's page, or a redirect to it): stop and ask the
  owner. The usual fix is an nginx `location` in the `ixwiki.com` server block that serves the checkout's files, for
  example `location ^~ /images/uploads/ { alias /ixwiki/public/projects/ixstats/public/images/uploads/; }`. The owner
  decides: do not edit nginx for this yourself.

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
deferred step T8b does). By default it adds the `wikios-mirror` group, the bot-password grants and the file types, and
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
Classic's versions come over through the inbound sync and the command-line import of classic's dump (step 5c). The
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

A command-line edit does not call the webhook. The `wiki-recentchanges` job brings the page into WikiOS, but that job
starts only at step 6b: the page arrives within about 10 minutes of that step, which says to check it. **Rollback:** delete `Template:Sister` on classic. Pages that use it then show a red template link on both
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
echo '$c = MediaWiki\MediaWikiServices::getInstance()->getMainConfig(); echo json_encode( [ "InterwikiCache" => $c->get( "InterwikiCache" ), "InterwikiExpiry" => $c->get( "InterwikiExpiry" ), "MainCacheType" => $c->get( "MainCacheType" ), "DBname" => $c->get( "DBname" ), "DBprefix" => $c->get( "DBprefix" ) ] ), "\n";' | mwmaint eval
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
  grant the right in `LocalSettings.php` for this. The commands below use `mysql ixwiki`: the database
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

(IxStates and `ixstats-cron` both read this file, and start rendering through loopback after their next restart. The
mirror's writes and the inbound sync's reads use it too, since every server-side call to IxWiki's MediaWiki does (plan
415), unless `WIKIOS_MEDIAWIKI_API` names another `api.php` for the mirror; before, they went to the public host.)

Run the first block of this step and the env line before step 2's deploy (step 2 says why); the bot-login check above
waits for step 3c. If step 2 has already run, restart `ixstats-cron` (`pm2 restart ixstats-cron --update-env`) and
IxStates (`pm2 restart "$IXAPP" --update-env`) now, so both read the line.

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

Then open one iiwiki page in the reader, `$IXSTATES_URL/wiki/<an iiwiki title>?source=iiwiki` (`IXSTATES_URL` is set in
Conventions): it renders. A title that does not exist on iiwiki says not found. Neither says "could not be reached".

**Rollback:** nothing to roll back (read-only).

**Note (no launch step): the development relay.** The `api.php` proxy that IxWorld serves at maps.ixwiki.com, the relay
development uses for iiwiki, gets the guard and the cache headers above at IxWorld's next ordinary deploy
(`scripts/deploy-ixworld.sh`). `deploy-production.sh` runs that script, so step 2's deploy normally brings them along;
nothing in the launch depends on it, and `ALLOWED_API_PARAMS` is unchanged. That list does not
carry `rvlimit` or `rvdir`, so the relay drops them, and an iiwiki page's author line in development shows only its
latest revision. Production reads iiwiki directly and is not affected. Fixing it in development means adding both to
`ALLOWED_API_PARAMS` (`src/app/api/mediawiki/_config.ts`) in a later release and deploying IxWorld; the owner decides.

## 4d. The uploads directory (plan 411, before step 6b)

WikiOS keeps an uploaded file in `WIKIOS_UPLOAD_DIR` until the mirror's `upload` job has put it in MediaWiki, and serves
it from there meanwhile. Without the variable it uses `.wikios-uploads` inside the checkout, which a deploy can replace.
IxStates takes the uploads and `ixstats-cron` runs the mirror, so both must use the same directory: it goes into
`.env.production.local`, which both read. Pick a directory outside the checkout that the server's backups cover: it is
the only copy of a file until MediaWiki holds it. Everything here is launch-time.

The directory must belong to the user PM2 runs IxStates and `ixstats-cron` as. Check that it is you (read-only):

```bash
ps -o user= -p "$(pm2 pid ixstats-cron)"; whoami      # the same name twice; otherwise use that user in the chown below
```

```bash
sudo mkdir -p /ixwiki/shared/wikios-uploads && sudo chown "$USER": /ixwiki/shared/wikios-uploads && chmod 750 /ixwiki/shared/wikios-uploads
bk "$IX/.env.production.local" env.production.local.uploads
grep -q '^WIKIOS_UPLOAD_DIR=' "$IX/.env.production.local" || ( umask 077; printf '\nWIKIOS_UPLOAD_DIR=/ixwiki/shared/wikios-uploads\n' >> "$IX/.env.production.local" )
grep -c '^WIKIOS_UPLOAD_DIR=' "$IX/.env.production.local"          # 1
```

The upload size must also get through nginx. Read the limits (read-only):

```bash
sudo nginx -T 2>/dev/null | grep -nE 'server_name|location \^~ /projects/ixstat|client_max_body_size'
```

The IxStates location (`location ^~ /projects/ixstats` or `/projects/ixstates`) must show no `client_max_body_size` of
its own, so it inherits the `ixwiki.com` server block's (16m or more after step 3a), or one of 11m or more. A smaller
value refuses uploads near the 10 MB limit with a bare 413: stop and ask the owner (5c lists what moves together).

If you cannot see that the backups include `/ixwiki/shared/wikios-uploads`, ask the owner before step 6b. IxStates and
`ixstats-cron` read the line on the restarts of step 6b. No migration is needed: an upload is refused until WikiOS
editing is on (step 6b), so no file can be waiting in another directory. Step 7c checks one upload end to end.

**Rollback:** `sudo cp -a "$BK/env.production.local.uploads" "$IX/.env.production.local"` before step 6b (the empty
directory can stay).

## 5b. Lead-image paths (plan 418, optional, after step 2)

Run it any time after step 2's deploy.

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

## 5c. XML imports and the upload limit (reference)

Nothing here is needed for the launch itself. Use it when an administrator imports a dump, or when the owner wants
bigger imports or uploads than the defaults. Every command is for the server, launch-time or later, with the owner.

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
( cd "$IX" && bun scripts/wikios-import-xml.ts /tmp/ixwiki.xml.gz --dry-run )     # read only: what would happen
( cd "$IX" && bun scripts/wikios-import-xml.ts /tmp/ixwiki.xml.gz --yes )         # writes to the database in DATABASE_URL
```

The limit is 9.5 MiB, not 10, because Next.js clones every request body for its proxy and caps the clone at
`experimental.proxyClientMaxBodySize` (**10 MiB by default**): a body above that arrives silently truncated, which the
route could not tell from a cut-off dump. Staying under the cap keeps "too large" a clear HTTP 413.

Raising it is an **optional** change (skip it unless admins really need bigger uploads in the browser), made in this
order:

1. `next.config.js` is tracked in git, so the Next.js cap is a code change, not a server edit: set it in a commit that a
   release carries (for example 50 MiB), and step 2's deploy ships it. Never edit the server's copy:
   `deploy-production.sh` runs `git reset --hard` and `git clean -fd` in `$IX`, so the next deploy would undo it.

   ```js
   experimental: {
     // ...existing experimental options...
     proxyClientMaxBodySize: "50mb",
   },
   ```

2. Set the route's own limit **below** it (by at least 0.5 MiB: the default is 9.5 against 10) in
   `$IX/.env.production.local`, which IxStates reads (launch-time or later):

   ```bash
   bk "$IX/.env.production.local" env.production.local.5c
   grep -c '^WIKIOS_IMPORT_MAX_BYTES=' "$IX/.env.production.local"      # 0 = not set yet; 1 = change that line by hand instead
   ( umask 077; printf '\nWIKIOS_IMPORT_MAX_BYTES=51904512\n' >> "$IX/.env.production.local" )   # 49.5 MiB; unset = 9.5 MiB
   ```

3. The deploy that carries the `next.config.js` commit restarts IxStates, which then reads the new line; if the line
   was added after that deploy, `pm2 restart "$IXAPP" --update-env`. The import page reads the limit from the server, so
   it states the new number. nginx must let the bigger body through as well (the upload limit below, item 2).

Both numbers must move together: a route limit at or above the Next.js cap reintroduces silent truncation. A gzipped
dump is bounded twice, by the bytes sent (this limit) and by what it expands to (256 MiB, fixed in the route).

### The upload limit (plan 411): 10,000,000 bytes, and what must move with it

The web upload (`POST /api/wiki/upload`, the Insert Image dialog, `/util/upload`) and api.php's `action=upload` take a file
of **at most 10,000,000 bytes** (`MAX_UPLOAD_BYTES` in `src/lib/wiki-os/config.ts`; the limit is a decimal 10 MB, below the
10 MiB cap). The file is the raw request body (api.php: a multipart body of the file plus up to 64 KiB of fields), counted as it
streams. **Raising the limit means raising these, in this order, before the code constant:** (1) the Next.js
`experimental.proxyClientMaxBodySize` in `next.config.js` (above: Next clones the body for its proxy and
truncates the clone at that size, which no route can tell from a cut-off file); (2) nginx `client_max_body_size` for
the `ixwiki.com` vhost's IxStates location (`location ^~ /projects/ixstats` or `/projects/ixstates`, whichever the server
uses: `/api/wiki/upload` and `/w/api.php` are under it; step 4d reads it) and for MediaWiki's own `api.php` (the mirror
sends the same bytes); (3) PHP `upload_max_filesize` and `post_max_size` (16M now) and MediaWiki's `$wgMaxUploadSize`; only then the
constant. A raster of more than 12.5 megapixels is refused as too large (MediaWiki's `$wgMaxImageArea` default: it cannot thumbnail
a bigger one); if the wiki's `LocalSettings.php` raised `$wgMaxImageArea`, set `WIKIOS_MAX_IMAGE_AREA` (pixels) in
`$IX/.env.production.local` to the same number, or WikiOS refuses what MediaWiki would take. An SVG is refused above 5,000,000 bytes (the scan that proves it safe costs about a second at 10 MB; MediaWiki
deployments commonly cap SVGs at a few megabytes): set `WIKIOS_MAX_SVG_BYTES` (bytes) in `$IX/.env.production.local` to change it. It cannot
go above the 10,000,000-byte upload limit, which holds first. The upload directory is `WIKIOS_UPLOAD_DIR` (step 4d); the admin panel's mirror section says how many uploaded
files MediaWiki does not hold yet, and until it says none, that directory is the only copy of them. Once an hour the mirror worker deletes files in it that are older than 24 hours and that no asset is served from and no unfinished upload job (a dead one included) names: the leftovers of a crash between staging and the database commit.

**Rollback:** restore `"$BK/env.production.local.5c"` over `$IX/.env.production.local` and restart IxStates; revert the
`next.config.js` commit in a later release. The two numbers go back together.

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
step 1c generates its key (at least 32 characters, never typed or printed), and restart IxStates (`pm2 restart "$IXAPP" --update-env`) before going on. Then edit the pool file by hand, never echoing the secret:

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
`APP_URL` alone needs only `pm2 restart "$IXAPP" --update-env` and `pm2 restart ixstats-cron --update-env`.

Check after step 6b (`IXSTATES_URL` is set in Conventions):

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
IxStates (`pm2 restart "$IXAPP" --update-env`) and `ixstats-cron`: by name (`pm2 restart ixstats-cron --update-env`)
after a fix to an env file, which it reads at start; from the file after a fix to `ecosystem.config.cjs`, since a
restart by name keeps PM2's stored environment (Conventions): `( cd "$IX" && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save`,
then read it back with `pm2 jlist | jq -r '.[] | select(.name == "ixstats-cron") | .pm2_env.RATE_LIMIT_ENABLED'`
(`null` when the file does not set it, or `true`).

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

**The upload directory** is step 4d. Check it is set before step 6b (read-only):
`grep -c '^WIKIOS_UPLOAD_DIR=' "$IX/.env.production.local"` prints 1.

**`Template:Sister`** must exist on classic (step 3d).

## 6b. Switch WikiOS v1 on

Only after steps 1 (SQL), 1b (rights import and its protections marker), 3 (mirror account), 4 (render engine), 4b
(the server's own requests let through), 4d (uploads directory), 6 (webhook), 6a, the `/images/` headers of 7c and
10b (room for readers). Without the marker the switch takes no writes: api.php keeps answering `readonly`. The switch goes into
the env file that IxStates and `ixstats-cron` both read, `$IX/.env.production.local`. This launch has no `wikios`
process (no takeover), so nothing else needs it. From here on WikiOS takes edits inside IxStates, the mirror copies them
to MediaWiki, and api.php answers. When WikiOS and classic both change a page, the later save stands on both wikis and
the overwritten editor is told (step 10d).

```bash
bk "$IX/.env.production.local" env.production.local.step6b
grep -q '^WIKIOS_V1_ENABLED=' "$IX/.env.production.local" || ( umask 077; printf '\nWIKIOS_V1_ENABLED=true\n' >> "$IX/.env.production.local" )
grep -c '^WIKIOS_V1_ENABLED=true$' "$IX/.env.production.local"          # expect 1
# the cron jobs the launch needs (step 7b explains the render backlog): wiki-mirror, wiki-render-stale, wiki-recentchanges
bk "$IX/ecosystem.config.cjs" ecosystem.config.cjs.6b
grep -n 'CRON_ENABLED_JOBS' "$IX/ecosystem.config.cjs"             # the ixstats-cron list (explicit since step 2, never "*"); skip the edit if it names all three
"${EDITOR:-nano}" "$IX/ecosystem.config.cjs"                       # add whichever of the three is missing
# restart from the file, so ixstats-cron reads the new list and the env line above
( cd "$IX" && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save
# read-only: the list PM2 now hands the runner, and the jobs it scheduled at this start ("[Cron] ✓ <job> (<schedule>)")
pm2 jlist | jq -r '.[] | select(.name == "ixstats-cron") | .pm2_env.CRON_ENABLED_JOBS'
pm2 logs ixstats-cron --lines 60 --nostream | grep -E '\[Cron\] (✓|Standalone cron runner started|FATAL|CRON_ENABLED_JOBS is empty)'
pm2 restart "$IXAPP" --update-env
# IxStates' own api.php, on loopback under its base path (use /projects/ixstats instead if that is the one that answers):
curl -s 'http://127.0.0.1:3550/projects/ixstates/w/api.php?action=query&meta=siteinfo&format=json' | jq -r '.error.code // "ok"'   # not "readonly"
```

The newest `[Cron] ✓` lines must name `wiki-mirror`, `wiki-render-stale` and `wiki-recentchanges`, followed by
`Standalone cron runner started`. A `FATAL: unknown job name(s)` line means a misspelt name, and the runner did not
start: fix the list and restart from the file again. If the `jq` line still shows the old list, PM2 did not read the
file: stop and ask the owner.

Now run step 4c's `api.php` proxy check, which waits for this step. About 10 minutes after the restart,
`wiki-recentchanges` has brought `Template:Sister` (step 3d) into WikiOS; step 7d checks that a page using it shows the
embed.

**Rollback:** `sudo cp -a "$BK/env.production.local.step6b" "$IX/.env.production.local"`, the same two restarts
(`ixstats-cron` from the file). The cron list stays as it is, so the outbox keeps draining (`ecosystem.config.cjs.6b`
holds the old list). WikiOS
follows the editing toggle again (read-only unless it is on: turn it off in `/admin/wikios-settings` too). Jobs already
in the outbox keep draining to MediaWiki while `wiki-mirror` runs; to make them wait there, also set
`SKIP_MEDIAWIKI_SYNC=true` in the same file before the restarts, or drop `wiki-mirror` from `CRON_ENABLED_JOBS` in
`ecosystem.config.cjs` (back it up first) and restart `ixstats-cron` from the file, `( cd "$IX" && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save`,
then read the list back with `pm2 jlist | jq -r '.[] | select(.name == "ixstats-cron") | .pm2_env.CRON_ENABLED_JOBS'`.

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

## 7b. Render convergence (after step 6b)

WikiOS shows an article from its **view bundle** (`wiki_articles."renderedView"`), built by sending the page's Postgres wikitext
to the private MediaWiki. The same render also stores what MediaWiki reports about the page: **`wiki_links`,
`wiki_template_links` and `wiki_image_links`**, categories and page properties. Those tables are empty for a page until it has
rendered under this code, and four things read them: backlinks (`Special:WhatLinksHere`), page images and lore-card images,
and api.php's `list=embeddedin` and `list=imageusage` (with `prop=templates|images`). So after the deploy the wiki is complete
only once every page has rendered; how fast that happens depends on which kind of work each page is:

| Page is | Served meanwhile | Rendered by | Rate |
|---------|------------------|-------------|------|
| **never rendered**, or stale (`"htmlSyncedAt"` NULL; step 1's `rendered-view.sql` marks every row without a bundle so) | the reader waits up to 6 s for its render, else a locally compiled fallback marked stale | the first reader, a save, or the `wiki-render-stale` job (every minute, oldest first) | **20 per minute** |
| **outdated**: its bundle was built by another renderer version (`RENDERER_VERSION` = transform version + sanitizer fingerprint; this release changes it, and so does any later sanitizer change or the `WIKIOS_TEMPLATESTYLES` lever, step 10c); or, on a read only, its render could not show a file and is due again (a day after a first render, a week after a later one; below) | at once, the old bundle re-sanitized by the current rules and marked stale; a reader's visit also queues its background render | `wiki-render-stale` (one scan per process finds the backlog, at the first batch with room, so a minute or so after `ixstats-cron` starts) and readers' background renders | up to **60 per minute** when no never-rendered page is waiting; otherwise what is left of the 20 |

**A render that could not show a file** (`mw:Error` in a media element's `typeof`: a missing-file link whose `href` goes
to `Special:Upload` with `wpDestFile=`, or "Error creating thumbnail") is outdated too once it is due, but only when a
reader opens the page: it is served at once, marked stale, while a background render replaces it. The bundle records since
when the page could not show a file (`mediaErrorSince`): a first broken render (broken since less than a day before it,
or a bundle stored before this release, which has no record) is due a day after it was made; a re-render that still
could not show the file a week after; a clean render drops the record. Classic's own lookup of a Commons file can fail for one
render and work for the next, and this heals the pages whose images came out broken. Neither `wiki-render-stale`'s scan
nor the SQL below sees these pages (both compare renderer versions only), so they never count in `outdated`. A file that
is really missing costs one render a week per page read, never a loop. Only markup matches: page text that quotes
`wpDestFile=` or `mw:Error` (a code sample, say) never does.

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
launch also needs `wiki-mirror` (step 3's mirror account; the outbox of WikiOS writes) and `wiki-recentchanges` (the
inbound sync) in the same list. The job runs inside `ixstats-cron`, so that process needs the render engine's URL
(`WIKIOS_MEDIAWIKI_INTERNAL_URL`, step 4) in the env file it reads. Restart it after changing either:

```bash
grep -n 'CRON_ENABLED_JOBS' "$IX/ecosystem.config.cjs"                    # the list for ixstats-cron: it must name wiki-render-stale
# after a change to either file, restart from the file (Conventions): a restart by name keeps PM2's old list
( cd "$IX" && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save
# read-only: the list PM2 hands the runner, and the jobs it scheduled at this start ("[Cron] ✓ <job> (<schedule>)")
pm2 jlist | jq -r '.[] | select(.name == "ixstats-cron") | .pm2_env.CRON_ENABLED_JOBS'
pm2 logs ixstats-cron --lines 60 --nostream | grep -E '\[Cron\] (✓|Standalone cron runner started|FATAL|CRON_ENABLED_JOBS is empty)'
```

The newest `[Cron] ✓` lines must name `wiki-render-stale`, `wiki-mirror` and `wiki-recentchanges`. A
`CRON_ENABLED_JOBS is empty` or `FATAL` line, or a `jq` line without them, means they are not scheduled: fix the list
(step 6b) and restart from the file again.

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
# the two api.php lists that read them, against IxStates' api.php on loopback, http://127.0.0.1:3550<base path>/w/api.php
# (the base path that answered in step 6; /projects/ixstates below). Each must list pages:
curl -s 'http://127.0.0.1:3550/projects/ixstates/w/api.php?action=query&list=embeddedin&eititle=Template:Infobox_country&eilimit=5&format=json' | jq -c '.query.embeddedin | length'
curl -s 'http://127.0.0.1:3550/projects/ixstates/w/api.php?action=query&list=imageusage&iutitle=File:<an existing file>&iulimit=5&format=json' | jq -c '.query.imageusage | length'
```

**Rollback:** nothing to undo; stopping early only leaves some pages on their older bundle and without link data, which
readers do not see (they get the bundle) and the four features above show as empty.

## 7c. Uploads in practice

Uploads open with step 6b. Everything here is launch-time.

### Before step 6b: headers for uploaded files under `/images/` (plan 411)

Once the mirror's `upload` job has run, an uploaded file is served by nginx from classic MediaWiki's `/images/` tree on
ixwiki.com, which the mirror fills, with the content type nginx guesses from the name. A PDF or an SVG opened there
directly is a document on that origin, so make nginx say that it is a download
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
bk "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)" ixwiki.com.nginx.7c
sudoedit "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"     # in the location that serves /images/, add:
#     add_header X-Content-Type-Options "nosniff" always;
#     add_header Content-Disposition $wikios_image_disposition always;    # an empty value adds no header
sudo nginx -t && sudo systemctl reload nginx
curl -sI "https://ixwiki.com/images/<a>/<ab>/<Name>.svg" | grep -iE '^(content-disposition|x-content-type-options)'   # attachment + nosniff
curl -sI "https://ixwiki.com/images/<a>/<ab>/<Name>.png" | grep -iE '^(content-disposition|x-content-type-options)'   # nosniff only
```

If classic holds no SVG file yet, check the SVG line after the first SVG upload.

**Rollback:** `sudo cp -a "$BK/ixwiki.com.nginx.7c" "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"` and
`sudo rm /etc/nginx/conf.d/wikios-images-headers.conf`, then `sudo nginx -t && sudo systemctl reload nginx`.

### After step 6b: one upload, end to end

Sign in to IxStates in a browser as a user with the upload right, open `$IXSTATES_URL/util/upload`, upload a small
PNG, and check (read-only), against the private MediaWiki, that the mirror's `upload` job put the same bytes there and
that WikiOS now serves the file from MediaWiki's path (the asset's URL is its `/images/` path and the staged copy is
gone):

```bash
ls -l /ixwiki/shared/wikios-uploads/                                       # the staged file, until the job has run (within a minute or so)
curl -s 'http://127.0.0.1:8081/api.php?action=query&titles=File:<Name>&prop=imageinfo&iiprop=url|sha1&format=json' | jq -c '.query.pages[].imageinfo'
sha1sum /ixwiki/shared/images/<a>/<ab>/<Name>                              # equals the imageinfo sha1
```

A job that ended dead (`permissiondenied`, `filetype-banned`, a PHP or nginx size refusal) shows in the admin panel's
mirror section with MediaWiki's answer.

**Rollback:** the test file can stay. To remove it, delete it in WikiOS; the mirror repeats the deletion on classic.

## 7d. End to end inside IxStates (after steps 6b to 6d)

Everything here is launch-time and read-only, except two test edits to a sandbox page. First the reader, through the
public URL (`IXSTATES_URL` is set in Conventions):

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$IXSTATES_URL/wiki/Main_Page"                 # 200
curl -s "$IXSTATES_URL/wiki/Main_Page" | grep -oE '<link[^>]*rel="canonical"[^>]*>'      # href="https://ixwiki.com/wiki/Main_Page"
```

A canonical link that names IxStates' URL, or none, means search engines would index the copy instead of classic: stop
and ask the owner.

**WikiOS to classic.** The owner, signed in to IxStates, saves one small change to a sandbox page in WikiOS
(`$IXSTATES_URL/wiki/<page>`, then edit). Within about a minute the mirror has copied it to classic. Compare WikiOS's
newest revision of that page with classic's, the two queries of step 6 with the revision's origin added (`<page>` is the
title with spaces in the SQL, with underscores in the URL):

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c \
  "select r.origin, r.\"revId\", r.\"mwRevId\", r.\"createdAt\" from wiki_revisions r join wiki_articles a on a.id = r.\"articleId\"
    where a.source = 'ixwiki' and a.title = '<page>' order by r.\"createdAt\" desc limit 1"
curl -s 'http://127.0.0.1:8081/api.php?action=query&prop=revisions&titles=<page>&rvprop=ids&format=json' \
  | jq -r '.query.pages[].revisions[0].revid'
```

Expect `origin` `wikios` and a `mwRevId` equal to the revision id classic prints. If `mwRevId` is still empty after a few
minutes, the mirror has not run: open `/admin/wikios-settings`, MediaWiki Mirror Outbox (the job and MediaWiki's answer),
and check that `wiki-mirror` is in `CRON_ENABLED_JOBS` (step 6b). Fix it before step 7e.

**Classic to WikiOS.** Step 6's own check: one web edit on classic to a sandbox page, and the two revision ids match
within seconds. If step 6's check has passed already, it stands; otherwise run it now. It is not repeated here.

**Sister wikis.** If step 4c's `api.php` proxy check has not run since step 6b, run it now. Then open a page that uses
`{{Sister|...}}` in the reader (`$IXSTATES_URL/wiki/<page>`): the box shows the live embed, or "<Wiki> could not be
reached just now" when that wiki is down. A plain link box with no embed means `Template:Sister` is not in WikiOS yet:
wait for `wiki-recentchanges` (step 6b, every 10 minutes) and check again, then repeat step 3d's attribute check.

**Rollback:** revert the two test edits: the WikiOS one in WikiOS's page history (the mirror copies the revert to
classic), the classic one on classic (the webhook brings the revert over).

## 7e. The gold proof at launch (after step 7b, off-peak)

The proof's launch profile ([the proof's README](../audits/wikios-proof/README.md)) measures the live site from the
server: the editor round trip over every page of the production database, render parity over the whole corpus (IxStates
on loopback against the private MediaWiki of step 4), and the bench, 200 pages × 2 runs through the public URLs. It
takes about 2 hours: about 1 hour of parity, then about 1 hour of bench. Everything here is launch-time.

Run it only when step 7b shows `unrendered` and `outdated` at 0 (a page still waiting for its render is scored as a
fallback and fails parity), and off-peak (the bench times public pages). Do not deploy or restart IxStates while it
runs: this run holds no lease, and a restart in the middle fails it. The bench's requests leave the server with
`User-Agent: IxStats-Builder`, which step 4b let through.

**The reports directory** is `/ixwiki/private/logs/wikios-proof`, outside the checkout. The deploy (its proof check)
and `ixstats-cron` (the weekly job) both write there, so it must belong to the user both run as. Check that it is you
(read-only), the same check as step 4d:

```bash
ps -o user= -p "$(pm2 pid ixstats-cron)"; whoami      # the same name twice: the deploy and ixstats-cron run as you
```

If the two names differ, stop and ask the owner who should own the directory. Otherwise:

```bash
sudo install -d -m 750 -o "$USER" -g "$(id -gn)" /ixwiki/private/logs/wikios-proof
stat -c '%U:%G %a %n' /ixwiki/private/logs/wikios-proof     # you, 750
df -h /                                                       # a few hundred MB free at least
```

**What the run and `ixstats-cron` read (read-only).** The proof loads the same env files, in the same order, as
`ixstats-cron` (`load-env.mjs`'s production list: the first file that sets a name wins), so nothing is sourced or
printed by hand. It needs `WIKIOS_MEDIAWIKI_INTERNAL_URL` (step 4), `APP_URL` or `NEXT_PUBLIC_APP_URL` (step 6a) and,
for the weekly job, `WIKIOS_PROOF_DIR` (below). None of them is a secret:

```bash
grep -nE '^(WIKIOS_MEDIAWIKI_INTERNAL_URL|APP_URL|NEXT_PUBLIC_APP_URL|WIKIOS_PROOF_DIR|PORT|BASE_PATH)=' \
  "$IX/.env.production.local" "$IX/.env.local" "$IX/.env.production" "$IX/.env" 2>/dev/null
grep -lE '^DATABASE_URL=' "$IX/.env.production.local" "$IX/.env.local" "$IX/.env.production" "$IX/.env" 2>/dev/null   # file names only
# what PM2 itself hands ixstats-cron: its directory and these names only, never the rest of its environment
pm2 jlist | jq '.[] | select(.name == "ixstats-cron") | .pm2_env | {cwd: .pm_cwd, NODE_ENV, CRON_ENABLED_JOBS,
  WIKIOS_MEDIAWIKI_INTERNAL_URL, APP_URL, NEXT_PUBLIC_APP_URL, WIKIOS_PROOF_DIR, DATABASE_URL_set: (.DATABASE_URL != null)}'
```

- `WIKIOS_MEDIAWIKI_INTERNAL_URL` is `http://127.0.0.1:8081/api.php`.
- The first file that sets `APP_URL` gives `https://ixwiki.com`; if no file sets it, the first that sets
  `NEXT_PUBLIC_APP_URL` does. `.env.example` ships `APP_URL="http://localhost:3000"`, and a loopback value there sends
  the bench to the wrong host (the CLI refuses a missing one).
- `cwd` is `$IX` and `NODE_ENV` is `production`: the weekly job runs the CLI from the runner's directory.
- If a name the run needs is set only in PM2's environment (the `jq` line shows it, no file has it), or no file sets
  `DATABASE_URL`, stop and ask the owner: a run by hand would not see it.
- A `PORT` or `BASE_PATH` line does not matter: the run below and the weekly job both set port 3550 and
  `/projects/ixstates` themselves.

**The run.** `PORT` and `BASE_PATH` are set on the line because `.env` may carry a development `PORT=3000`; use
`/projects/ixstats` instead if that is the base path that answered in Conventions:

```bash
( cd "$IX" || exit 1
  NODE_ENV=production PORT=3550 BASE_PATH=/projects/ixstates WIKIOS_PROOF_DIR=/ixwiki/private/logs/wikios-proof \
    nohup bun scripts/audit/wikios-proof.ts run --profile launch > /ixwiki/private/logs/wikios-proof/launch.out 2>&1 &
  echo "proof pid $!" )
tail -f /ixwiki/private/logs/wikios-proof/launch.out          # Ctrl-C stops the tail, not the proof
uptime                                                        # every few minutes: a load above 2.0 means stop it (below)
```

If the load stays above 2.0, `kill <proof pid>` (the CLI stops its running harness and exits), wait a minute (a new run
refuses a directory that exists, and the directory is named to the minute), and start it again with
`--parity-interval-ms 1000` after `--profile launch` (the default is 200). At that pace parity alone takes about 3 to 4
hours over the corpus's 4,771 articles (a second between pages plus each page's render), so start it early in the
off-peak window or wait for the next one. If the CLI refuses to start (a
`DATABASE_URL` that is not local, or a missing variable), it says which: stop and ask the owner.

The run ends with its checks table, `PASSED` or `FAILED`, and `Proof written to <dir>`:

```bash
D=$(sed -n 's/^Proof written to //p' /ixwiki/private/logs/wikios-proof/launch.out); echo "$D"
jq '{profile, passed, dirty, corpus}' "$D/summary.json"
```

- **`passed` true and `dirty` false:** go on.
- **A failing round-trip or parity check:** stop. Give the owner the summary's lowest pages and templates (`$D/summary.md`)
  and leave the weekly job off: it would fail every week.
- **A failing bench check only:** give the owner the p95 table from `$D/summary.md`. Going on is the owner's call.
- **`bench.failures.wikios` failing, its errors "redirected too many times":** IxStates is running Clerk development
  keys. A development instance redirects a cookie-less `accept: text/html` request to its handshake, so every WikiOS
  page request of the bench loops (the local proof saw exactly this); production keys answer 200. It is not a WikiOS
  fault: stop, and check the keys' kind without printing them, then ask the owner:

  ```bash
  jq -r '.failures[] | select(.system == "wikios") | "\(.kind) \(.error)"' "$D/bench.json" | sort | uniq -c
  grep -hoE '^(NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY|CLERK_SECRET_KEY)="?(pk|sk)_(live|test)_' \
    "$IX/.env.production.local" "$IX/.env.local" "$IX/.env.production" "$IX/.env" 2>/dev/null   # live, never test
  ```
- **`dirty` true:** the server checkout has uncommitted WikiOS changes. Stop and ask the owner.

Bring the summary to the dev machine, read-only on the server (run this on the dev machine, in the repository):

```bash
scp ixwiki:/ixwiki/private/logs/wikios-proof/<dir>/summary.md docs/audits/wikios-proof/<yyyy-mm-dd>-launch.md
```

It is committed later from the dev machine, never on the server (the next deploy's `reset --hard` would drop it).

**Then the weekly job,** only after a launch proof has passed. It stays off until `wikios-proof` is in
`CRON_ENABLED_JOBS`. First the reports directory for the deploy and the weekly job, then the job:

```bash
bk "$IX/.env.production.local" env.production.local.7e
grep -c '^WIKIOS_PROOF_DIR=' "$IX/.env.production.local"          # 0 = not set yet; 1 = already there, skip the next line
( umask 077; printf '\nWIKIOS_PROOF_DIR=/ixwiki/private/logs/wikios-proof\n' >> "$IX/.env.production.local" )
ls -l "$IX/.env.production.local"                                  # same mode as before (-rw-------)
bk "$IX/ecosystem.config.cjs" ecosystem.config.cjs.7e
grep -n 'CRON_ENABLED_JOBS' "$IX/ecosystem.config.cjs"             # the ixstats-cron list, explicit since step 2 (a "*" would have run the weekly proof since then)
"${EDITOR:-nano}" "$IX/ecosystem.config.cjs"                       # add wikios-proof to that list
# PM2 keeps a process's environment across a plain restart: restart from the file so the new list is read
( cd "$IX" && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save
pm2 logs ixstats-cron --lines 60 --nostream | grep -i wikios-proof    # scheduled: 30 5 * * 1 (Monday 05:30 UTC)
```

The weekly job pins IxStates at `PORT=3550` and `BASE_PATH=/projects/ixstates` (`src/server/cron/wikios-proof-cron.ts`).
If production moves off port 3550, or `/projects/ixstats` is the base path that answered in Conventions, change that pin
in a release first and keep the job off until then: it would measure the wrong server and fail every week. The
SystemConfig key `cronSchedule_wikiosProof` moves the schedule (restart `ixstats-cron` after changing it).

**Old predeploy reports.** Step 2's deploy ran before `WIKIOS_PROOF_DIR` was set, so its proof check wrote its reports
into the checkout. From the next deploy on they go to `/ixwiki/private/logs/wikios-proof`. List what is left in the
checkout (read-only), then keep a copy and remove it:

```bash
ls -la "$IX/.bench-out/proof" 2>/dev/null       # predeploy-<stamp>.json and .txt files only
bk "$IX/.bench-out/proof" bench-out-proof.7e
rm -r "$IX/.bench-out/proof"
```

If the listing shows anything else (a run directory, another file), leave the directory and ask the owner.

**Optional, overnight:** the full-corpus bench, about 9 hours, with the same line as the run above but
`run --profile launch --parity-sample 1 --bench-pages all --bench-runs 1` and its own output file
(`launch-full-bench.out`). Its parity part is a token one-page run, so its summary reads `FAILED` on the parity page
floor by design: read only its bench rows. It never replaces the launch proof. Once the weekly job is on, do not start it
on a Sunday night: it would overlap Monday's 05:30 UTC run.

**Rollback:** `sudo cp -a "$BK/ecosystem.config.cjs.7e" "$IX/ecosystem.config.cjs"` and
`sudo cp -a "$BK/env.production.local.7e" "$IX/.env.production.local"`, then
`( cd "$IX" && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save`: the weekly job is off
again, and the deploy's reports go back into the checkout. The reports are files only; the directory can stay.

## 10. Monitor (first 24 hours)

| Watch | How |
|-------|-----|
| IxStates | `pm2 logs "$IXAPP" --lines 200 --nostream`, `pm2 status "$IXAPP"` (restarts column), `pm2 jlist` RSS |
| `ixstats-cron` | `pm2 logs ixstats-cron --lines 500 --nostream \| grep -iE 'wiki-(mirror\|render-stale\|recentchanges)\|WikiOS:render'`; a job that throws is recorded in `CronRun` and alerted to the admin webhook |
| nginx | `tail -f /var/log/nginx/error.log`; 5xx under IxStates: `awk '$9>=500 && $7 ~ "^/projects/ixstat"' /var/log/nginx/access.log \| tail` |
| Bot defense, fail2ban | step 10b; afterwards `/usr/local/bin/ixwiki-bot-defense.sh status`, `tail -f /var/log/ixwiki-bot-defense.log`, `fail2ban-client status ixwiki-bots` |
| PHP-FPM watchdog | `tail -f /ixwiki/private/logs/php-fpm-watchdog.log` (it still probes classic's `/wiki/Main_Page`, which stays MediaWiki) |
| Webhook | `pm2 logs "$IXAPP" --lines 500 --nostream \| grep 'wiki/sync-webhook'`; classic's `wikios` debug log (`sync-webhook failed for ...`) when configured. 401 means the two secrets differ, 503 means IxStates has none, 429 means more than 600 a minute |
| Discord DMs | disk alert, PHP-FPM watchdog and bot-defense alerts reach the admin through `ixwiki-notify.sh` |
| Disk | `df -h /` (the PM2 logs of IxStates and `ixstats-cron` go to `/var/log/pm2/`, rotated at 50M x 5; nginx logs rotate through `/etc/logrotate.d/nginx`) |
| Conflicts and queues | `/admin/wikios-settings`: Conflict log, Inbound sync quarantine and MediaWiki Mirror Outbox (step 10d) |
| Proof | the weekly `wikios-proof` job, once step 7e has turned it on (Monday 05:30 UTC): `pm2 logs ixstats-cron --lines 500 --nostream \| grep -i wikios-proof`. A failure posts `Cron job failed: wikios-proof` with the failing checks to the admin webhook and leaves its report in `/ixwiki/private/logs/wikios-proof/`. The job pins IxStates at port 3550 and `/projects/ixstates` (step 7e) |
| Deploys | a refused deploy prints the WikiOS proof check's `FAIL <check>: ...` lines and stops before its backup; an overridden one prints `WIKIOS PROOF OVERRIDDEN:` lines and goes on (step 2). `FAIL proof.lease` means the weekly proof is running |
| Sister wikis | `pm2 logs "$IXAPP" --lines 500 --nostream` and `pm2 logs ixstats-cron --lines 500 --nostream`, through `grep -iE 'circuit (open\|closed)\|could not be reached'`. `[upstream-guard] <Wiki> (<host>): circuit open after N failures in a row` and `... circuit closed; requests resume.` cover WikiOS's reads and the `api.php` proxy alike; a search across all wikis also warns `<Wiki> could not be reached`, at most once a minute per wiki. A breaker that opens and never closes means that wiki, or the server's route to it, is down: repeat step 4c's server check |

### 10b. Bot defense and fail2ban: room for IxStates' readers (before step 6b)

The bot-defense daemon (`/usr/local/bin/ixwiki-bot-defense.sh`, 60 requests per minute per IP, set in
`/etc/ixwiki-defense.conf`) and the fail2ban jail `ixwiki-bots` (more than 60 requests per minute, one-hour ban) both
read `/var/log/nginx/access.log`. One cold load of a wiki page inside IxStates is a document plus dozens of `_next`
chunks, fonts and flag files, and every page then sends tRPC batches (`api/trpc`) and an IxTime refresh
(`api/ixtime/current`), all under IxStates' base path. A reader who opens a few articles in a minute can cross 60 and be
blocked at the Cloudflare edge. Everything here is launch-time. Run it before step 6b, so it is in place when the wiki
takes edits and the bots move.

Step 4b already edited the same two files (its IP and user-agent whitelists, and `ignoreip`) under the backup names
`ixwiki-defense.conf.4b` and `ixwiki-bots.jail.conf.4b`. This step backs them up again under names of its own, so each
rollback restores its own step: restoring this step's copies keeps 4b's edits.

Change 2 always runs. Change 1 runs only when its measurement says so.

**1. Keep the chatty locations out of the counted log (only if a reader crosses the limit).** First measure (read-only):
the busiest minutes per IP under IxStates' `_next`, `api/trpc` and `api/ixtime` paths in the current log.

```bash
sudo awk '$7 ~ "^/projects/ixstat(e)?s/(_next|api/trpc|api/ixtime)" { split($4, t, ":"); n[$1 " " t[1] ":" t[2] ":" t[3]]++ }
  END { for (k in n) print n[k], k }' /var/log/nginx/access.log | sort -rn | head -10
#   each line: requests, IP, [day:hour:minute
```

If no reader's minute comes near the limit change 2 sets (240), skip the rest of change 1. IxStates may have had little
traffic before the launch, so measure again a day after step 6b. Only when a real reader (not a bot) crosses the limit,
send those paths to their own log, which the daemon and fail2ban do not read and Debian's nginx logrotate already
rotates (`/var/log/nginx/*.log`). Read the IxStates location in full first:

```bash
grep -n 'var/log/nginx' /etc/logrotate.d/nginx              # expect the /var/log/nginx/*.log glob: the new file rotates too
sudo nginx -T 2>/dev/null | grep -n -A40 'location \^~ /projects/ixstat'    # the IxStates location and every line in it
bk "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)" ixwiki.com.nginx.10b
sudoedit "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"
#   inside the IxStates location, using its own prefix (shown here as /projects/ixstates), add two nested blocks:
#     location ^~ /projects/ixstates/_next/ {
#         access_log /var/log/nginx/wikios-quiet.log;
#         <every line of the parent block, repeated exactly: proxy_pass, proxy_set_header, include, timeouts>
#     }
#     location ^~ /projects/ixstates/api/trpc/ {
#         access_log /var/log/nginx/wikios-quiet.log;
#         <the same lines>
#     }
sudo nginx -t && sudo systemctl reload nginx
curl -s -o /dev/null -w '%{http_code}\n' "$IXSTATES_URL/wiki/Main_Page"     # still 200
sudo tail -3 /var/log/nginx/wikios-quiet.log                                 # that page's chunks and tRPC calls land here
```

nginx does not carry `proxy_pass` into a nested location, so each nested block repeats the parent's lines exactly. If
the parent block holds anything that cannot be repeated exactly (a `proxy_pass` with a variable, `if` blocks, nested
locations of its own), stop and ask the owner. The trade-off: a flood of requests to those paths is no longer seen by
the daemon and fail2ban (Cloudflare still sees it, and `wikios-quiet.log` has it).

**2. Raise the per-IP limits.** Dynamic page views still count, and a reader who opens several articles quickly must not
be banned:

```bash
bk /etc/ixwiki-defense.conf ixwiki-defense.conf.10b
bk /etc/fail2ban/jail.d/ixwiki-bots.conf ixwiki-bots.jail.conf.10b
grep -niE 'ip|per' /etc/ixwiki-defense.conf                 # the per-IP requests-per-minute value (default 60)
sudoedit /etc/ixwiki-defense.conf                           # set it to 240
sudoedit /etc/fail2ban/jail.d/ixwiki-bots.conf              # multiply the ixwiki-bots maxretry by 4 (same findtime)
sudo systemctl restart ixwiki-bot-defense && sudo fail2ban-client reload
```

Check after step 6b, from a browser with a cold cache: open `$IXSTATES_URL/wiki/Main_Page` and three more articles within
a minute, then

```bash
/usr/local/bin/ixwiki-bot-defense.sh status               # your IP must not be listed as blocked
fail2ban-client status ixwiki-bots                        # your IP must not be banned
```

If a reader is blocked: `sudo fail2ban-client set ixwiki-bots unbanip <ip>`, and remove the IP under Cloudflare,
Security, WAF, Tools (IP Access Rules).

**Rollback:** change 2: `sudo cp -a "$BK/ixwiki-defense.conf.10b" /etc/ixwiki-defense.conf && sudo cp -a "$BK/ixwiki-bots.jail.conf.10b" /etc/fail2ban/jail.d/ixwiki-bots.conf && sudo systemctl restart ixwiki-bot-defense && sudo fail2ban-client reload`.
Change 1, if it ran: `sudo cp -a "$BK/ixwiki.com.nginx.10b" "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)" && sudo nginx -t && sudo systemctl reload nginx`.

### 10c. Emergency lever: turn TemplateStyles off

Articles keep the `<style>` blocks that MediaWiki's TemplateStyles extension writes, after the sanitizer has scoped every
selector under `.mw-parser-output` and filtered each declaration (`src/lib/utils/scope-template-styles.ts`; plan 415).
If a CSS bypass is ever reported (a template's sheet styling the reader's chrome, hiding the page, or loading a host
other than the wiki's), do not debug it first: switch the feature off, then fix it. With `WIKIOS_TEMPLATESTYLES=0` the
sanitizer removes **every** `<style>` from article HTML, the behaviour before plan 415 (templates that lay themselves out
with TemplateStyles then render unstyled, which is ugly but safe). The lever **fails closed**: only unset, empty, `1`,
`true`, `on` and `yes` (any case) leave TemplateStyles on; every other value, `0` and `off` and a typo alike, turns it off.

```bash
bk "$IX/.env.production.local" env.production.local.10c
( umask 077; printf '\nWIKIOS_TEMPLATESTYLES=0\n' >> "$IX/.env.production.local" )
ls -l "$IX/.env.production.local"                      # same mode as before (-rw-------)
# the setting is read once at start by config.ts: restart IxStates and ixstats-cron
pm2 restart "$IXAPP" --update-env
pm2 restart ixstats-cron --update-env
```

The setting is part of the sanitizer fingerprint that every stored article bundle carries (`RENDERER_VERSION`), so no
purge is needed: a bundle built under the other setting counts as outdated, so a reader gets it re-sanitized by the current
rules at once (with the lever pulled, the styles are gone from the first read after the restart) and the article is
re-rendered in the background, and the `wiki-render-stale` job works through the rest (sister-wiki renders live in memory and
go with the restart). Check an article whose
templates use TemplateStyles (`<Title>` below; it printed 1 or more before):

```bash
curl -s "$IXSTATES_URL/wiki/<Title>" | grep -c 'data-mw-deduplicate'     # 0 once the lever is pulled
```

**Turning it back on** (after the scoper is fixed and `bun run audit:template-styles` reports 0 violations and 0
non-idempotent outputs): restore the file (`sudo cp -a "$BK/env.production.local.10c" "$IX/.env.production.local"`) or delete the
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

## Server-local files the launch edits

Every one of them is copied into `$BK` before its first edit (classic's database rows are dumped first).

| File | Edit | Step |
|------|------|------|
| `/ixwiki/public/projects/ixstats/.env.production.local` | `WIKIOS_API_SESSION_SECRET` (1c); `WIKIOS_MEDIAWIKI_BOT_USER`, `WIKIOS_MEDIAWIKI_BOT_TOKEN` (3c); `WIKIOS_MEDIAWIKI_INTERNAL_URL` (never `NEXT_PUBLIC_WIKIOS_STANDALONE`; `WIKIOS_MEDIAWIKI_API` absent or private, 4); `WIKIOS_UPLOAD_DIR` (plan 411, 4d); `WIKIOS_IMPORT_MAX_BYTES`, only when raised (5c); `NEXT_PUBLIC_APP_URL` / `APP_URL` `https://ixwiki.com`, base path absent or `/projects/ixstates`, the same in `.env.production` (6a); `RATE_LIMIT_ENABLED` unset or `true` (6a); `WIKIOS_V1_ENABLED=true` (6b); `WIKIOS_PROOF_DIR=/ixwiki/private/logs/wikios-proof`, after the first passing launch proof (7e); `WIKIOS_TEMPLATESTYLES=0`, only when the lever is pulled (10c) | 1c, 3c, 4, 4d, 5c, 6a, 6b, 7e, 10c |
| `/ixwiki/shared/wikios-uploads/` | new directory (750): the staging directory of uploads waiting for the mirror; in the backups until none is waiting | 4d |
| `/ixwiki/private/logs/wikios-proof/` | new directory (750, owned by the user the deploy and `ixstats-cron` run as): the launch and weekly proof runs, pruned to the newest 12 by the CLI, and the newest 12 predeploy reports; the old predeploy reports in `$IX/.bench-out/proof` are removed once it is set | 7e |
| `/ixwiki/public/projects/ixstats/ecosystem.config.cjs` | `CRON_ENABLED_JOBS` for `ixstats-cron`: an explicit list in place of `"*"`, only when it was `"*"` (backup `ecosystem.config.cjs.2`; the deploy's PM2 reload reads it) (2); it names `wiki-render-stale`, `wiki-mirror` and `wiki-recentchanges` (backup `ecosystem.config.cjs.6b`; then, in `$IX`, `pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env && pm2 save`, and the read-only check of the scheduled jobs) (6b, 7b); `wikios-proof`, after the first passing launch proof (then 7e's restart from the file) (7e) | 2, 6b, 7b, 7e |
| `/ixwiki/config/LocalSettings.php` | `require_once` of the snippet; never a `WIKIOS_TAKEOVER` define | 3a |
| `/ixwiki/config/wikios-localsettings.php` | new, copy of the tracked snippet (mode 644) | 3a |
| `/etc/php/8.4/fpm/conf.d/99-wikios-import.ini` | new: `upload_max_filesize` and `post_max_size` 16M | 3a |
| `/etc/nginx/conf.d/wikios-render-internal.conf` | new | 4 |
| `/etc/nginx/conf.d/wikios-images-headers.conf` | new: the `/images/` download map | 7c |
| target of `/etc/nginx/sites-enabled/ixwiki.com` | two `add_header` lines in the location that serves `/images/` (7c); nested quiet-log locations in the IxStates location, only when 10b's measurement calls for them (10b) | 7c, 10b |
| `/etc/php/8.4/fpm/pool.d/www.conf` | `env[WIKIOS_WEBHOOK_SECRET]`, `env[WIKIOS_WEBHOOK_URL]`; mode 0640 root:root | 6 |
| `/etc/ixwiki-defense.conf` | IP whitelist (127.0.0.1, ::1, the egress addresses) and user-agent whitelist (`IxStats-Builder`) (4b); per-IP limit 240 (10b) | 4b, 10b |
| `/etc/fail2ban/jail.d/ixwiki-bots.conf` | `ignoreip` in the three ixwiki jails (4b); `ixwiki-bots` `maxretry` x 4 (10b) | 4b, 10b |
| `/ixwiki/shared/bots/discord/.env` | MediaWiki API URL on IxStates' loopback `/w/api.php`; the new bot password | 6c |
| classic's page `Template:Sister` (a wiki page, not a file) | created from `scripts/ops/mediawiki/Template-Sister.wikitext` | 3d |
| classic's database, table `interwiki` (not a file; dumped to `$BK/interwiki.3e.sql` first) | rows for `iiwiki` and `althistory`, when they are not added on `Special:Interwiki` | 3e |
| classic's `robots.txt` (`$DOCROOT/robots.txt`) | IxStates' 13 `Allow` / `Disallow` lines in its `User-agent: *` group and each named crawler group that does not block the whole site | 6d |

## Deferred: the ixwiki.com takeover (do not run)

**Do not run anything in this section.** The owner deferred the takeover on 2026-10-24. Nothing in the launch defines
`WIKIOS_TAKEOVER` (launch hardening B1), so the snippet of step 3a cannot move classic's article path or its canonical
link. The steps below assume a standalone `wikios` process on `127.0.0.1:3560` that the launch does not build, and they
were written against the code of September 2026. Running any of them needs a new decision by the owner and a rewrite
against the code of that day. They stay here as the record of what the takeover needs. Where a T-step uses `$WK`, it
means `WK=/ixwiki/public/wikios`, which the launch's shell setup does not set.

Files plan 417 shipped for the takeover (in the IxStats checkout, `/ixwiki/public/projects/ixstats/`):

| File | Installed as |
|------|--------------|
| `scripts/deploy-wikios.sh` | run in place |
| `deploy/wikios/ecosystem.wikios.config.cjs.example` | `/ixwiki/public/wikios/ecosystem.wikios.config.cjs` |
| `deploy/wikios/next-config-snippet.md` | edits to `next.config.js` (tracked in git) for the takeover build |
| `scripts/ops/nginx/wikios-upstream.conf` | `/etc/nginx/conf.d/wikios-upstream.conf` |
| `scripts/ops/nginx/wikios-proxy-params.conf` | `/etc/nginx/snippets/wikios-proxy-params.conf` |
| `scripts/ops/nginx/wikios-takeover.conf` | `/etc/nginx/snippets/wikios-takeover.conf` |
| `scripts/ops/verify-wikios-takeover.ts` | run in place with `bun` |

## T5. Build and start the WikiOS process

**IxStates is degraded while `deploy-wikios.sh` builds.** Like `deploy-ixworld.sh`, it moves the IxStates `.next`
aside for the length of the build (several minutes) and restores it afterwards: routes IxStates has not served since
its last start fail and its static chunks 404 meanwhile. Run it off-peak. (Building elsewhere needs a separate copy
of the checkout and `node_modules`; that was judged not worth the risk of an untested build layout.)

**The IxStates URL.** Use the one the launch found (Conventions, "The IxStates URL") as `IXSTATES_URL`; the WikiOS
build has no default and refuses to start a redirect without it.

`next.config.js` and `scripts/setup/base-path.cjs` are tracked in git, and they do not carry the WikiOS edits yet:
make the edits of `deploy/wikios/next-config-snippet.md` (WikiOS branch in `resolveBasePath()` in
`scripts/setup/base-path.cjs`, which the stylesheets' PostCSS base-path pass follows too; early `return []` in
`next.config.js`'s `rewrites()`) in a commit that this release carries. Do not edit the server's copy by hand: `deploy-production.sh` runs `git reset --hard`
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
WK=/ixwiki/public/wikios
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

# Uploads (plan 411): WIKIOS_UPLOAD_DIR is set at launch, in step 4d. This process reads the same env file (linked above),
# so it uses the same directory as IxStates: check it is there.
grep -c '^WIKIOS_UPLOAD_DIR=' "$IX/.env.production.local"          # 1 (step 4d)

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

The `wikios` process keeps serving the code it was built from until `scripts/deploy-wikios.sh` runs again, so that
script runs after every IxStates release that touches WikiOS code. `deploy-production.sh` has no lock: never run it
while `deploy-wikios.sh` runs (the WikiOS script refuses to start while `deploy-production.sh` is running).

Imports and the upload limit are launch step 5c. For this process, `WIKIOS_IMPORT_MAX_BYTES` goes in the `env` block of
`$WK/ecosystem.wikios.config.cjs` instead (its `.env.production.local` is the link to IxStates' file), a raised
`next.config.js` cap needs `"$IX/scripts/deploy-wikios.sh"` again, and the nginx body limits are the ones in
`wikios-takeover.conf`.

**Rollback:** `pm2 delete wikios && pm2 save`. The `next.config.js` edits do not affect the IxStates build; to take them
out, revert their commit (the copy in `$BK/next.config.js` shows the file as it was).

## T7. Pre-takeover checks (nothing public yet)

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
missing prefix must be added to both before step T8.

The upload check and the `/images/` headers that were part of this step are launch step 7c. For the takeover, repeat
7c's upload check on the loopback WikiOS through the SSH tunnel.

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

## T8. Cut over

Do step T10a (PHP-FPM watchdog) **before** this step. Then install the nginx takeover and, right after the nginx reload,
flip the MediaWiki article path: nginx first, because `/classic/` and the WikiOS `/wiki/` must exist before MediaWiki
starts generating `/classic/` links (until the flip it still emits `/wiki/` links, which now reach WikiOS: no broken
window). Run T8a and T8b back to back.

### T8a. nginx

```bash
bk "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)" ixwiki.com.nginx
sudo cp "$IX/scripts/ops/nginx/wikios-upstream.conf"     /etc/nginx/conf.d/wikios-upstream.conf
sudo cp "$IX/scripts/ops/nginx/wikios-proxy-params.conf" /etc/nginx/snippets/wikios-proxy-params.conf
sudo cp "$IX/scripts/ops/nginx/wikios-takeover.conf"     /etc/nginx/snippets/wikios-takeover.conf
#   the takeover's quiet log (launch step 10b covers only IxStates' location): before nginx -t, send the chatty
#   locations of the copied snippet to their own log
grep -n 'var/log/nginx' /etc/logrotate.d/nginx              # expect the /var/log/nginx/*.log glob: the new file rotates too
sudo sed -i -E '/^location (\^~|=) \/(_next|fonts|flags|maplibre|images\/flags|images\/wikios|wikios-|favicon-wikios|api\/trpc|api\/ixtime\/current)[^ ]* \{$/a\    access_log /var/log/nginx/wikios-quiet.log;' /etc/nginx/snippets/wikios-takeover.conf
grep -c 'wikios-quiet.log' /etc/nginx/snippets/wikios-takeover.conf     # must print 10 (run the sed once only)
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

### T8b. MediaWiki article path, then caches

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

**Rollback:** step T12 (it restores `$BK/ixwiki.com.nginx` and `$BK/LocalSettings.php.step8`).

## T9. Verify the public site

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

**Rollback:** step T12.

## T9a. Lean flight (after step T9, optional but recommended)

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

## T10a. PHP-FPM watchdog: make it probe MediaWiki, not WikiOS (before step T8)

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
once step T8 is done: `https://ixwiki.com/classic/Main_Page`. Do **not** use the public `https://ixwiki.com/api.php`:
it moves to WikiOS when WikiOS serves its own `api.php` subset.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:8081/api.php?action=query&meta=siteinfo&format=json'   # 200
sudo bash -n /ixwiki/private/scripts/php-fpm-watchdog.sh
sudo systemctl restart php-fpm-watchdog
systemctl status php-fpm-watchdog --no-pager | head -5
tail -n 20 /ixwiki/private/logs/php-fpm-watchdog.log        # no restart entry after the edit
```

**Rollback:** `sudo cp -a "$BK/php-fpm-watchdog.sh" /ixwiki/private/scripts/php-fpm-watchdog.sh && sudo systemctl restart php-fpm-watchdog`.

## T11. Footprint measurement

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

## T12. Rollback (full)

Reverses step T8 only; WikiOS keeps running harmlessly on loopback. Undo in the opposite order of step T8, MediaWiki
first (so MediaWiki stops emitting `/classic/` links before `/classic/` disappears):

```bash
sudo cp -a "$BK/LocalSettings.php.step8" /ixwiki/config/LocalSettings.php        # article path back to /wiki/
php -l /ixwiki/config/LocalSettings.php && sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm
sudo cp -a "$BK/ixwiki.com.nginx" "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"
sudo nginx -t && sudo systemctl reload nginx
mwmaint purgeParserCache --age 0                                                 # /classic/ links out of cached HTML
# then purge the Cloudflare cache for /wiki/* again (step T8b)
curl -s -o /dev/null -w '%{http_code}\n' https://ixwiki.com/wiki/Main_Page      # MediaWiki again
```

To stop WikiOS taking edits as well, turn the switch off (step 6b's rollback line).

(The files in `/etc/nginx/conf.d/` and `/etc/nginx/snippets/` are inert without the `include`; the `wikios-upstream.conf`
`map`s and `upstream` are harmless.) Undo step T10a from its own rollback line if the watchdog misbehaves (launch step 10b stays).
To also stop WikiOS: `pm2 delete wikios && pm2 save`.

### Server-local files the takeover would edit

| File | Edit | Step |
|------|------|------|
| `/ixwiki/public/projects/ixstats/next.config.js` and `scripts/setup/base-path.cjs` | tracked: `resolveBasePath()` WikiOS branch (base-path.cjs); `rewrites()` early return; `"iconoir-react"` and `"motion/react"` in `experimental.optimizePackageImports` | T5 |
| `/ixwiki/public/projects/ixstats/public/fonts/HostGrotesk/HostGrotesk[wght].ttf` | tracked since 2026-10-06; must exist: `next/font/local` fails the build without it | T5 |
| `/ixwiki/public/wikios/ecosystem.wikios.config.cjs` | new, from the `.example`; `WIKIOS_LEAN_FLIGHT: "1"` added to `env` in T9a | T5, T9a |
| `/ixwiki/public/wikios/.env.wikios-build` | new: `NEXT_PUBLIC_IXSTATES_URL` (build-time, WikiOS only) | T5 |
| `/etc/nginx/conf.d/wikios-upstream.conf` | new | T8 |
| `/etc/nginx/snippets/wikios-proxy-params.conf`, `wikios-takeover.conf` | new (the quiet-log `sed` runs on the copy) | T8 |
| target of `/etc/nginx/sites-enabled/ixwiki.com` | `include` added; `/wiki/` location, `@mediawiki` `/wiki/` rewrite and any `location = /` removed | T8 |
| `/ixwiki/config/LocalSettings.php` | `define( 'WIKIOS_TAKEOVER', true );` before the `require_once` | T8b |
| `/ixwiki/private/scripts/php-fpm-watchdog.sh` | probe URL `http://127.0.0.1:8081/api.php?...` | T10a |

### Later (with the takeover)

IxStates moves to ixstates.com (owner decision D11): then `NEXT_PUBLIC_IXSTATES_URL` in `$WK/.env.wikios-build`
changes, the WikiOS build is redeployed, and classic MediaWiki moves to `classic.ixwiki.com`. WikiOS's api.php already
answers at `/w/api.php` (step T8a); when bots have moved to it, `/api.php` can join the WikiOS locations in
`wikios-takeover.conf` and the matching row of `verify-wikios-takeover.ts` changes.
