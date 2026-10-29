# Release guide: build and deploy IxStats from `master`

**For:** whoever releases IxStats to production (`ssh ixwiki`, root). **Last updated:** 2026-10-27.

This is the one place to start a release. Part A is the procedure for **every** release. The one-off steps of
**1.5 "Lobster Crosby"** (internal 1.5.0, public 1.0.0 Stable), which ran on production 2026-10-26/27, used to be
Part B here; they now live in [release-1.5-lobster-crosby.md](../history/operations/release-1.5-lobster-crosby.md),
with the deviations its production-copy rehearsal found. A release with its own one-off steps writes them the same way,
as a runbook under `docs/history/operations/` that links to the owning runbooks. Part A absorbed the useful checks of the old deployment
checklist (now [retired](../history/operations/deployment-checklist.md)); the production reference is
[deployment.md](deployment.md).

Branches: `rose-garden` (nightly) → `development` (stable-experimental) → `master` (production); see
[contributing.md](../processes/contributing.md#branches). Production only ever runs `master`.

---

## Part A — Every release

### A1. Pre-deploy checklist (GitHub, before you touch the server)

- [ ] **Branch protection** is on for `development` and `master` (Settings → Branches): PR required, the `verify`
      check required, force-pushes and deletions blocked, admins may bypass. Don't require `review-pr` (the Gemini
      job) until it has an API key.
- [ ] **CI is green** (`verify`) on the head of `rose-garden`. Every gate runs even after one fails, so read the whole
      job, not only the first red step.
- [ ] **Promotion PR `rose-garden` → `development`** is open, CI green, and you've read what it brings in
      (`git log origin/development..origin/rose-garden --oneline`). Merge it.
- [ ] **Promotion PR `development` → `master`** is open and CI green. **Don't merge it yet**: merge it at A3, right
      before you deploy, so `master` is always what production runs.
- [ ] **Schema changes:** list them with `git diff origin/master origin/development -- prisma/schema`. The deploy
      applies the additive part first (the additive step, A4 step 5), then the release's hand-written SQL, then
      `prisma db push`, which **stops** on anything that would drop data. Anything that drops a table or column, or adds
      a unique constraint over existing data, needs a SQL file in the deploy script or a hand step in the release's own runbook (1.5's:
      [release-1.5-lobster-crosby.md](../history/operations/release-1.5-lobster-crosby.md)).
- [ ] **See production's real schema state** before the window. Production may be well behind `master`. On the server,
      with the release checked out (A3) and the production env loaded
      (`set -a; source .env.production; source .env.production.local; set +a`):
      ```bash
      bunx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema --script > /tmp/prod-schema-diff.sql
      grep -nE '^(ALTER TABLE|CREATE|DROP)' /tmp/prod-schema-diff.sql
      bun scripts/deployment/apply-additive-schema.ts      # dry run: writes nothing
      ```
      The dry run prints a `+` line for each change the deploy will apply before its SQL, and a `-` line, with the
      reason, for each change it leaves to the SQL and the push. Both commands only read.
- [ ] **Rehearse the release on a restored copy of the production dump** when it carries hand SQL or data steps (1.5
      did). Use the `ixstats_dryrun` recipe in
      [deploy-mycountry-2026-10.md](../history/operations/deploy-mycountry-2026-10.md#7-stat-progression-dry-run-on-a-production-copy) to make
      the copy, then run the deploy's schema steps and the release's hand steps against it, in order, with
      `DATABASE_URL` pointing at `ixstats_dryrun` in that shell:
      1. `bun scripts/deployment/apply-additive-schema.ts --apply`;
      2. every `bunx prisma db execute …` and `bun scripts/…` line of `scripts/deploy-production.sh` between the WikiOS
         proof check and `bun run db:push:force` (`scripts/refresh-local-db.sh` lists the same lines, which
         `src/tests/scripts/deploy-sql.test.ts` keeps in step), with the release's hand steps among them;
      3. `bun run db:push:force`, then the three files the script runs after it.

      **Never run `deploy-production.sh` for a rehearsal:** it loads `.env.production` over your shell, so its
      `DATABASE_URL` is production's. Note how long each step takes and every warning the push prints. Drop the copy
      afterwards (`dropdb`). A developer machine can rehearse too: `scripts/refresh-local-db.sh` restores a fresh
      production dump into the local container and runs the same chain.
- [ ] **New env vars:** `git diff origin/master origin/development -- src/env.ts .env.example`. Anything newly
      required in production must be on the server before A4 (A2 has the full list).
- [ ] **One-off scripts:** check the PR descriptions and `scripts/migrations/` for anything the release says to run
      (dry run first), and the release's own runbook if it has one.
- [ ] **Version and changelog:** the version in `src/lib/buildVersion.ts` is the one you're releasing, and
      `CHANGELOG.md` has its entry, with breaking changes called out.
- [ ] **Tag (optional):** `git tag -a v<version> -m "Release IxStats <version>"` on the `master` merge, so a
      rollback has a named target.
- [ ] **Announce** the maintenance window to players. An ordinary release is down from the build until the new server
      answers (A4): the time of one build plus the start, about 5 minutes. A release with a stop-the-app window (as 1.5 had)
      is down from the stop.

### A2. Server prep

```bash
ssh ixwiki
cd /ixwiki/public/projects/ixstats
tmux new -s deploy            # the deploy runs for many minutes, and without ixstats-web it ends in the foreground
```

- [ ] **Disk:** `df -h /` — keep at least a few GB free. A full disk puts Postgres into recovery mode.
- [ ] **Memory for the build:** since React Compiler went on (#125), `next build` needs more than the server's RAM
      plus the standing swap leaves free (MariaDB, an open IDE's TypeScript server and the PM2 apps already hold
      several GB of swap). `earlyoom` then kills `next-build` mid-compile: the deploy prints `exited with code 137` and
      `Build failed`, puts the old build back, and `journalctl -u earlyoom` names the kill (there is no kernel OOM
      line). Before A4, add temporary swap:
      `fallocate -l 12G /swapfile-build && chmod 600 /swapfile-build && mkswap /swapfile-build && swapon -p -4 /swapfile-build`.
      After the deploy: `swapoff /swapfile-build && rm /swapfile-build`. On 2026-10-29 the compile took 6 minutes with
      it.
- [ ] **Services up:** `docker ps --filter name=ixstats-postgres` shows the container Up;
      `docker exec ixstats-redis-cache redis-cli ping` returns `PONG`; `pm2 status` lists `ixstats-web`,
      `ixstats-cron`, `ixstats-ws` and `ixstats-ixtwitter` online (`ixworld` stays stopped: there is no separate IxWorld
      build).
- [ ] **TLS certificate** isn't about to expire:
      `openssl s_client -connect beta.ixwiki.com:443 -servername beta.ixwiki.com </dev/null 2>/dev/null | openssl x509 -noout -dates`.
- [ ] **Note the running commit** for rollback: `git log -1 --oneline` → write it down (the last line of
      `backups/deploy-history.log` also has it).
- [ ] **Back up:** `bun run db:backup` → `backups/ixstats-<UTC timestamp>.dump` (via the `ixstats-postgres`
      container). The deploy script takes another one before its schema steps; this one is your pre-deploy copy.
      Check it: `ls -lh backups/ | tail -3` (a healthy dump is not tiny). `db:backup` keeps the newest 14 dumps.
- [ ] **Back up the env files:** `cp .env.production .env.production.backup-$(date +%Y%m%d)` and the same for
      `.env.production.local`.
- [ ] **Env** in `.env.production` / `.env.production.local`. The web app refuses to start in production without:

      | Variable | Notes |
      |---|---|
      | `DATABASE_URL` | PostgreSQL URL |
      | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production keys (`sk_live_…`, `pk_live_…`); the deploy script rejects test keys |
      | `CRON_SECRET` | At least 32 characters |
      | `WIKI_SYNC_WEBHOOK_SECRET` | At least 32 characters; MediaWiki sends it to the wiki webhooks |
      | `IXTIME_BOT_SECRET` | Must match what the IxTime bot sends |

      Also needed for everything to work:

      | Variable | Notes |
      |---|---|
      | `BASE_PATH=""`, `NEXT_PUBLIC_BASE_PATH=""` (`.env.production`) | The app is served at the root of beta.ixwiki.com. Unset, the deploy script falls back to `/projects/ixstates`, so keep them set, empty |
      | `NEXT_PUBLIC_APP_URL=https://beta.ixwiki.com` | Canonical URLs and the WebSocket origin check. Written into the build: set it before A4 |
      | `WS_ALLOWED_ORIGINS=https://beta.ixwiki.com,https://maps.ixwiki.com,https://ixwiki.com` | Browsers allowed to open the ThinkPages socket |
      | `REDIS_ENABLED=true`, `REDIS_URL=redis://localhost:6379` | Cross-process realtime and rate limits (`ixstats-redis-cache`) |
      | `DISCORD_GUILD_ID=552179975769161729` | Discord nicknames in reaction lists |
      | `BOT_API_KEY` | Discord bot → `/api/bot/lorewards/sync` |

      Forum account linking is admin-only, so no forum verification secret is needed (`FORUM_VERIFICATION_SECRET` is
      read by nothing; remove it if it is still set).

      Generate secrets on the server (`openssl rand -hex 32`) and never paste them elsewhere. Check them with
      `bun run verify:environment` in a shell that has the production env loaded
      (`set -a; source .env.production; source .env.production.local; set +a; NODE_ENV=production bun run verify:environment`):
      it fails when a secret from the first table is missing or too short, and warns about missing Redis,
      `NEXT_PUBLIC_APP_URL` and Discord settings. `bun run auth:check:prod` checks the Clerk configuration the same
      way.
- [ ] **PM2 env:** `ecosystem.config.cjs` (git-ignored; template `ecosystem.config.example.cjs`) gives each app its
      env. `ixstats-cron` and `ixstats-ws` need the same Redis settings as the web app, and `ixstats-cron` needs
      `CRON_ENABLED_JOBS` (see A7). Every app runs with `NODE_ENV: "production"`. Production defines the template's `ixstats-web` block
      (`bash start-production.sh`, `PORT: "3550"`, `kill_timeout` 15 s, restart limits), so the deploy reloads the web
      app with the other apps and waits for it to answer, and nothing needs to stay in the foreground. Without that
      block the deploy ends by running `start-production.sh` in the foreground.
- [ ] **Tracked config:** `next.config.js` and `postcss.config.js` are tracked, so A3's checkout and the deploy's
      `reset --hard` put the release's copies in place. A production-only edit to either is lost; check for one
      before the checkout (the diff in [1.5's B2](../history/operations/release-1.5-lobster-crosby.md#b2-pre-window-checks-read-only-the-old-build-still-serving)).
- [ ] **Hand database steps** the release needs before the deploy (its own runbook) are done.

### A3. Promote to `master`

Merge the `development` → `master` PR on GitHub (CI green). Then on the server:

```bash
git fetch master master
git checkout -B master master/master
git log -1 --oneline          # the merge you just made
```

(The git remote on the VPS is itself called `master`, so `master/master` is the `master` branch.) Checking out does not
touch the running servers: `next start` serves from `.next`.

### A4. Build and deploy

```bash
./scripts/deploy-production.sh
```

**A change to `deploy-production.sh` takes effect on the next deploy, not this one.** Step 1 fetches `master` and
`git reset --hard`s the checkout, the script included, while bash keeps reading the copy it started with. A release
that changes the deploy script runs the old script's steps; when the new steps matter (a new SQL file, say), run the
deploy a second time, or run the new lines by hand. A retry after a failed first attempt already runs the new copy, so
check the log (each `prisma db execute` prints `Script executed successfully`) and the data before running any line by
hand.

What it does, in order (and what to watch for). Steps marked **[schema]** are skipped with `SKIP_SCHEMA_SYNC=1` (see
below).

1. **Git sync** (on the production checkout only): refuses any branch but `master` (override:
   `ALLOW_NON_MASTER_DEPLOY=1`, for rollbacks only), fetches it from the `master` remote, `reset --hard` and
   `git clean -fd` (git-ignored files such as `.env*`, `backups/` and `ecosystem.config.cjs` are kept). It exports the
   commit as `IXSTATS_DEPLOY_COMMIT`, so cron and the websockets (and a manual `deploy-ixworld.sh`) run the same
   commit as the web app.
2. **Env:** loads `.env.production` and `.env.production.local`, checks `DATABASE_URL` is PostgreSQL and the Clerk
   keys are live keys.
3. `bun install --frozen-lockfile`, `bun run db:generate`.
4. `bun run db:backup` — aborts the deploy if the dump fails; on success it appends the time, commit and dump to
   `backups/deploy-history.log`.
5. **[schema] The additive step:** `bun scripts/deployment/apply-additive-schema.ts --apply`. It applies, in one
   transaction, only the purely additive part of `prisma migrate diff --from-url` (new enums and enum values, new
   tables with their indexes and foreign keys between them, nullable columns or columns with a default). It leaves to
   the SQL and the push everything else, every table, column and type a deploy SQL file creates or converts, and
   `wiki_revisions.origin` (whose labelling only runs when the WikiOS SQL adds it). The SQL below reads tables and
   columns only it creates. A failure changes nothing and stops the deploy.
6. **WikiOS proof check:** `bun scripts/audit/wikios-proof.ts predeploy` refuses a release whose WikiOS code has no
   committed passing proof, or whose editor round trip changes a byte of the production corpus
   ([wikios-proof](../audits/wikios-proof/README.md)). It holds the `wikios-proof` job lease until the end of the
   deploy (a database without `job_leases` yet has no lease to hold). `WIKIOS_PROOF_OVERRIDE=1` deploys anyway: use it
   when the committed proof's tree digest is stale (a commit after the proof touched a file the digest covers) and
   the check's own lines (`roundTrip.nonIdentical`, `incomplete`, `errors`) read `ok`; then commit a fresh proof.
7. **[schema] The hand-written SQL, before the push,** in this order. Every file is idempotent, so a re-run is a no-op:
   - `scripts/migrations/2026-10-realms/drop-world-configs.sql`: drops `world_configs` and `territory_claims`, an
     owner-approved drop that `db push` would stop on;
   - the twelve ThinkPages forum files, `20261008120000_thinkpages_forum` to `20261018120000_thinkpages_realm_adverts`;
   - `20261023120000_atlas_studio`, `20261024120000_vault_hub`, `20261027120000_drop_forum_readers`;
   - the cards chain: `20261027120000_cards_foundations`, `bun scripts/cards/backfill-cards-refresh.ts --apply`,
     `20261027120001_cards_foundations_constraints`, `20261028120000_cards_admin`, `20261031120000_cards_face_hub`,
     `20261101120000_cards_economy`, `20261102120000_cards_categories`;
   - IxnayID: `20261103120000_ixnayid_claims`, `bun scripts/identity/convert-wiki-name-claims.ts --apply`,
     `20261103120001_ixnayid_drop_legacy`;
   - `20261104120000_country_lore`, `20261105120000_wikios_conflicts`, `20261105120001_wikios_sync_dead_letters`;
   - the MyCountry and realm-time SQL in their runbooks' order (`h`, `a1`, `a2`, `de`, `f-defense`, `r1`, then `t1`,
     `t3`, `t3b`, `d2a`, `d3`, `d1`, `r3`).

   A file that refuses (a guard's `RAISE EXCEPTION`) names what to fix first; fix it and run the deploy again.
8. **[schema] `bun run db:push:force`** — applies the rest of the schema. Without `--accept-data-loss` it stops on
   any data-loss warning instead of prompting. **If it stops, read the message**; never add `--accept-data-loss`
   blindly. When every warning is a unique constraint, the push can only fail on duplicates, never drop data: check
   each one it names (`SELECT <columns>, count(*) FROM <table> WHERE <columns> IS NOT NULL GROUP BY <columns> HAVING
   count(*) > 1;` must be empty), apply it with `bunx prisma db push --accept-data-loss --skip-generate`, then run the
   deploy again (every SQL file is a no-op and the push has nothing left). A warning that drops a column or table
   with data means a step was skipped: stop. Then the post-push SQL: `20261019120000_rename_ixworld_realm_ixnay`, `20261021120000_atlas_r0`,
   `20261022120000_atlas_ra`. Prisma 6.19's push never reads partial indexes, triggers or rules, so the ones the SQL
   created (the forum's, IxnayID's, the cards triggers) survive it and need no re-apply.
9. **Build:** moves the live `.next` to `.next.prev` (see "When it fails" below), then `bun run build`.
10. **No IxWorld build.** maps.ixwiki.com is the main app's `/maps` page (nginx proxies the map and its requests to
    `ixstats-web`, every other page to beta.ixwiki.com), so the deploy builds nothing else. `scripts/deploy-ixworld.sh`
    stays for a manual standalone build.
11. **PM2:** `pm2 startOrReload ecosystem.config.cjs --update-env` (cron, websockets, IxTwitter sync, and `ixstats-web`
    when it is defined). The first time `ixstats-web` is defined, the deploy first stops the foreground server
    `start-production.sh` left on the port. A failed reload stops the deploy; a missing `pm2` or `ecosystem.config.cjs`
    is reported and skipped. Then it releases the WikiOS proof lease.
12. **The web server:**
    - **With `ixstats-web`:** waits up to 2 minutes for a non-5xx answer on `http://127.0.0.1:3550` (`BASE_PATH` is empty).
      When it answers, the deploy deletes `.next.prev`, runs the post-deploy SQL (below) and exits 0 — **downtime
      ends**. No answer: it exits 1 and keeps the previous build in `.next.prev` (`pm2 logs ixstats-web`).
    - **Without it:** stops the old server on port 3550 and runs `start-production.sh` in the foreground; a background
      check deletes `.next.prev` and runs the post-deploy SQL once the server answers — **downtime ends** then.
      Detach from tmux with `Ctrl+B D`; reattach later with `tmux attach -t deploy`.

    The post-deploy SQL is data that must wait for the new code:
    `20261028120000_rewrite_legacy_notification_links` rewrites stored notification links to legacy URLs. It is
    idempotent, and a failure only warns (run the file again by hand).

Every stop of the old web server is graceful: `SIGTERM`, up to 30 seconds to exit, then `SIGKILL`. Nothing runs
`bun run clean` any more.

**Where downtime starts.** Nothing before the build touches the live build, so a deploy that stops in steps 1–8 leaves
a running old server serving what it has loaded. Step 3 has already replaced `node_modules` with the release's,
though: a module the old server loads for the first time comes from there, and a stopped server must not be started on
this checkout (see "When it fails"). From step 9 the old server keeps running, but its build has moved to
`.next.prev`, so pages it has not loaded yet and its static files stop resolving: count the window from the build. Under PM2 the old server is
restarted at step 11; in the foreground it is stopped at step 12.

**When it fails.**

- **Steps 1–8:** the live build is untouched, but from step 3 `node_modules` and the Prisma client are the
  release's, so the same rule holds as below: never start a stopped server on this checkout. The schema may be partly
  changed (the additive step, some SQL files): fix the cause and run the deploy again; every step is idempotent. The
  backup of step 4 is the way back. The old server only keeps working if the SQL that ran changed nothing it reads; a
  release whose SQL converts such data stops the app before the deploy (as
  [1.5 did](../history/operations/release-1.5-lobster-crosby.md#b3-the-window-the-app-stopped)).
- **Build or PM2 reload (steps 9–11), or `Ctrl+C`:** an exit trap moves `.next.prev` back to `.next`. A
  server still running keeps serving what it has loaded, but a module it loads for the first time comes from the
  release's `node_modules` (step 3). Never start a stopped server on this checkout: the old build would run on the
  release's `next` and Prisma client. Fix the cause and run the deploy again, or roll back (below), which rebuilds the
  old release on its own dependencies.
- **The deploy was killed outright** (the box rebooted, `kill -9`): `.next.prev` stays. The next deploy puts it back
  first (or drops it when `.next` is a finished build, with a `BUILD_ID`). To serve the old build at once:
  first `git reset --hard <previous commit from backups/deploy-history.log> && bun install --frozen-lockfile && bun run db:generate`,
  and only for a release whose SQL changed nothing the old code reads; then `rm -rf .next && mv .next.prev .next`
  and start the web app.
- **The new server does not answer (step 12):** the previous build stays in `.next.prev`. Read the logs first. To put
  it back by hand, first `git reset --hard <previous commit from backups/deploy-history.log> && bun install --frozen-lockfile && bun run db:generate`,
  and only for a release whose SQL changed nothing the old code reads; then `rm -rf .next && mv .next.prev .next` and
  start it. Otherwise roll back (below).

**`SKIP_SCHEMA_SYNC=1`** runs everything but the schema work: the additive step, the SQL, the push, the post-push SQL
and the post-deploy SQL are skipped; the backup and the WikiOS proof check still run. It exists for rollbacks, where an
older schema must never be pushed over a newer one.

### A5. Verify

```bash
pm2 jlist | python3 -c "import sys,json;[print(p['name'],p['pm2_env'].get('NODE_ENV')) for p in json.load(sys.stdin) if p['name'].startswith('ixstats')]"
pm2 logs ixstats-web --lines 30 --nostream      # the start banner names the release, no errors
pm2 logs ixstats-cron --lines 30 --nostream     # no import errors; lists the scheduled jobs
pm2 logs ixstats-ws --lines 30 --nostream       # "[WS] ✓ ThinkPages WebSocket initialized", no "Redis disabled"
curl -sI https://beta.ixwiki.com/ | head -5
curl -sI https://maps.ixwiki.com/maps | head -3              # the map, proxied to ixstats-web
curl -s http://127.0.0.1:3550/api/health                     # 200 ok / 503 degraded: db, Redis, memory, cron runs
curl -s http://127.0.0.1:3551/healthz                        # ixstats-ws
ls .next.prev 2>/dev/null                                    # nothing: the deploy removed it once the server answered
```

Every app in the list reads `production`, `ixstats-web` included. `ixstats-ws` exits (and PM2 restarts
it) when a socket server fails to start, so a climbing restart count in `pm2 status` means read its log.

**The fonts.** With `BASE_PATH=""` the stylesheets' `url("/fonts/…")` are already right, and the PostCSS pass that
prefixes them (`scripts/setup/postcss-base-path-urls.cjs`, loaded by `postcss.config.js`) has nothing to add. Check
they are served:

```bash
CSS=$(curl -sL http://127.0.0.1:3550/ | grep -o '/_next/static/[^"]*\.css' | sort -u); echo "$CSS"
F=$(for c in $CSS; do curl -s "http://127.0.0.1:3550$c" | grep -o '/fonts/[^")]*'; done | sort -u | head -1); echo "$F"
curl -sI "http://127.0.0.1:3550$F" | head -1    # 200
```

No stylesheets listed means the page or the pattern is wrong, not the fonts. A 404 is cosmetic (the text falls back
to the system font); do not roll back for it. If a base path ever comes back, the served CSS must carry it
(`/<base>/fonts/…`): `postcss.config.js` must name the pass by its absolute path, and the build must run with
`NODE_ENV=production` or `BASE_PATH` set and without the IxWorld standalone flag (`scripts/setup/base-path.cjs`).

In a browser (console open):

- [ ] `/`, `/dashboard`, `/mycountry`, `/maps` load with no console errors, and **no "Refused to execute inline
      script" / CSP violations**.
- [ ] Sign in and out; `/admin` works for an admin.
- [ ] Send a message and see it arrive in a second browser (Redis bridge); DevTools → Network → WS shows the
      socket connected.
- [ ] The Vault store loads; a purchase shows the right price.
- [ ] Whatever this release changed (see the promotion PRs).

The September runbook's [smoke checks](../history/operations/deploy-rose-garden-2026-09.md#6-smoke-checks-browser) are a fuller list.

### A6. One-off scripts

Run anything the release lists, **dry run first**, then `--apply` after reading the output. Scripts that open a
Redis client may hang on exit with `REDIS_ENABLED=true` (1.5's `backfill-foundation.ts` and `merge-weekly-keys.ts`
did): run such one-offs with `REDIS_ENABLED=false` in front.

**Next release (IIWiki gate, PR #126 and its follow-up): stored IIWiki flag URLs.**

- **What it does:** country flags and arms stored as raw `https://iiwiki.com/...` URLs load straight from iiwiki.com, past the IIWiki switch. This script rewrites them to media-proxy paths. It is idempotent.
- **Dry run:** `REDIS_ENABLED=false bun scripts/realms/backfill-iiwiki-image-paths.ts`. It prints the database it targets and the rows it would change.
- **Write:** run it again with `--apply`.
- **SKIP lines:** a `SKIP` line is an IIWiki page link, not a file. Fix those by hand or leave them.
- **Local clones:** none of them held such rows on 2026-10-28.

### A7. Cron jobs

`cron-runner.mjs` (PM2 `ixstats-cron`) runs only the jobs named in `CRON_ENABLED_JOBS` (comma-separated, or `*`), and
exits on any unknown name. Add new jobs one per cycle, edit `ecosystem.config.cjs`, then restart the runner from the
ecosystem file,
`( cd /ixwiki/public/projects/ixstats && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save` (a restart by name keeps the environment PM2 stored, so the runner would not read the new list), read back the list it got,
`pm2 jlist | jq -r '.[] | select(.name == "ixstats-cron") | .pm2_env.CRON_ENABLED_JOBS'`, and read its log. The job table is `src/server/cron/jobs.ts` (listed in
[events.md](../reference/events.md#scheduled--batch-jobs)); the order to enable them is in the
[September runbook, step 7](../history/operations/deploy-rose-garden-2026-09.md#7-turn-cron-jobs-on-one-per-cycle), ending with
`thinkpages-trending` → `achievements-evaluate` → `stat-progression`. Production runs
`db-backup,log-retention,wiki-recentchanges,wiki-mirror,wiki-render-stale,forum-render-stale` (2026-10-27). After each change, check the job's last run in
`/api/health` (`cron.<job>.lastStatus`) or `pm2 logs ixstats-cron`; a failed run also posts to the Discord webhook.

### A8. After the release

- [ ] Tell players it's done.
- [ ] Merge `development` back into `rose-garden` if junior work landed only on `development`.
- [ ] Keep an eye on `pm2 logs`, the web app's output (`pm2 logs ixstats-web`, or the `start-production.sh` session;
      `[ERROR_LOGGER]`, `[RATE_LIMIT]` and `[SECURITY_AUDIT]` lines), `docker logs --tail 100 ixstats-postgres` and the
      admin audit log for the first hours. Only `ERROR`-level logs reach the Discord webhook; the deploy itself sends
      no notification.

### Rollback

Roll back when a critical path is broken (sign-in, data loss, the Vault ledger), errors or latency jump and stay up,
data looks corrupted, or the release opened a security hole. Note why before you start.

If the release is broken and a fix-forward isn't quick, push a branch at the commit you noted in A2 (for example
`rollback-<date>`: `git push origin <sha>:refs/heads/rollback-<date>`), then on the server:

```bash
./scripts/deployment/rollback-deployment.sh rollback-<date>                                        # code only
./scripts/deployment/rollback-deployment.sh rollback-<date> --restore backups/ixstats-<stamp>.dump  # restore, then deploy
```

(`bun run deploy:rollback -- <branch> …` is the same.) The script:

1. copies **this** release's `scripts/deploy-production.sh` aside, before the checkout replaces it (an older commit's
   copy may still delete the live build first, or push its schema);
2. fetches the branch from the `master` remote and checks it out;
3. with `--restore`, restores the dump into the running container (with the production confirmation flags);
4. runs the copied deploy script with `ALLOW_NON_MASTER_DEPLOY=1 SKIP_SCHEMA_SYNC=1`: the same backup, build (the live
   build is kept until the new one answers), PM2 reload and restart as a release, and **no schema change**.

It asks for confirmation unless given `--yes`. It never pushes the older schema: without `--restore` the old code runs
against the release's newer additive columns and tables, which it ignores; with `--restore` the database is already at
the old schema (the dump was taken before the release's SQL and push).

**Code only, or restore?** Code only works when the release only added to the schema. A release that dropped, converted
or rewrote data needs `--restore` (1.5 does: its SQL dropped and converted data, see
[release-1.5-lobster-crosby.md](../history/operations/release-1.5-lobster-crosby.md)). Pick the dump from `backups/deploy-history.log`: each line is
the time, the commit that went live and the dump taken just before. A restore loses everything written since that dump.

After a restore, spot-check it:
`docker exec ixstats-postgres psql -U postgres -d ixstats -c 'SELECT count(*) FROM "Country";'`.
To restore by hand instead, `bun run db:restore` lists `backups/` and prints the `pg_restore` command; add `--yes
--i-know-this-is-production` to run it ([deployment.md](deployment.md#backups-and-restore)).

The copied script runs the old checkout's own files. A commit older than the WikiOS proof CLI
(`scripts/audit/wikios-proof.ts`, added 2026-10-25) has no proof to check, so the script skips that step and says so.

Then revert or fix on `master` (via `development`), deploy `master` again, re-run the A5 checks, watch the logs for a
while, and write down what failed and why.

### Open operations items

Owner work still open after 1.5 (from its B5; [SYSTEM_STATUS](../systems/SYSTEM_STATUS.md#known-blockers-on-rose-garden)
tracks the rest):

- [ ] **Rotate the `ixstats_readonly` Postgres password** (plan 325): the old one is in git history.
- [ ] **Test a `db:backup` restore** into a scratch database (the M0 exit criterion):
      ```bash
      docker exec ixstats-postgres createdb -U postgres ixstats_restore_test
      docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats_restore_test --no-owner \
        < "$(ls -t backups/ixstats-*.dump | head -1)"
      docker exec ixstats-postgres psql -U postgres -d ixstats_restore_test -c 'SELECT count(*) FROM "Country";'
      docker exec ixstats-postgres dropdb -U postgres ixstats_restore_test
      ```
- [ ] **Copy `backups/` off the server** (another host or object storage); the dumps sit on the same disk as the
      database.
- [ ] **Review `bun run audit:vault-exploits`, then `bun run audit:vault-exploits:apply`** (take `bun run db:backup`
      first).
- [ ] **Review `bun run audit:forum-links`** (read-only: forum accounts linked without proof).
- [ ] **Enable the remaining cron jobs, one per cycle** (A7).

<a id="b6-csp-remove-the-nginx-override"></a>

#### CSP: the app's header, then `'unsafe-inline'`

The app sends a per-request nonce (PL-2). On beta.ixwiki.com nothing replaces it: the nginx site
(`/etc/nginx/sites-enabled/beta.ixwiki.com`) sets a `Content-Security-Policy` only on `/embed.html`
(`frame-ancestors`), and the served header carries `'nonce-` (checked 2026-10-27). To re-check after an nginx or
Cloudflare change:

```bash
curl -sI https://beta.ixwiki.com/ | grep -i content-security-policy    # contains 'nonce-
```

With the browser console open, go through A5's pages plus sign-in, the map editor and a wiki article. Any
"Refused to …" message names the blocked source: add it to `src/lib/security/csp.ts` and release again. Once no
violations show up, drop `'unsafe-inline'` from production `script-src` in `csp.ts` (browsers already ignore it when
a nonce is present, so this only affects very old browsers).

---

## Part B — moved

1.5's one-off steps are history now:
[release-1.5-lobster-crosby.md](../history/operations/release-1.5-lobster-crosby.md). The anchors below keep old
links working.

<a id="part-b--this-release-15-lobster-crosby-the-rose-garden-rc"></a>
<a id="b1-before-deploy-day"></a>
<a id="b2-pre-window-checks-read-only-the-old-build-still-serving"></a>
<a id="b3-the-window-the-app-stopped"></a>
<a id="b4-right-after-the-deploy-in-order"></a>
<a id="b5-ops-prerequisites-still-open"></a>

- [B1. Before deploy day](../history/operations/release-1.5-lobster-crosby.md#b1-before-deploy-day)
- [B2. Pre-window checks](../history/operations/release-1.5-lobster-crosby.md#b2-pre-window-checks-read-only-the-old-build-still-serving)
- [B3. The window](../history/operations/release-1.5-lobster-crosby.md#b3-the-window-the-app-stopped)
- [B4. Right after the deploy](../history/operations/release-1.5-lobster-crosby.md#b4-right-after-the-deploy-in-order)
- [B5. Ops prerequisites](../history/operations/release-1.5-lobster-crosby.md#b5-ops-prerequisites-still-open) (the open ones are [above](#open-operations-items))
- [B6. CSP](../history/operations/release-1.5-lobster-crosby.md#b6-csp-remove-the-nginx-override) (living: [above](#b6-csp-remove-the-nginx-override))
