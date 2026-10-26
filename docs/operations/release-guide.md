# Release guide: build and deploy IxStats from `master`

**For:** whoever releases IxStats to production (`ssh ixwiki`, root). **Last updated:** 2026-10-26.

This is the one place to start a release. Part A is the procedure for **every** release. Part B lists the one-off
steps for **1.5 "Lobster Crosby"** (the `rose-garden` release candidate), the first release under the new branch model.
The 1.4 plan this guide used to give never reached production, so 1.5 also carries the September plan wave's one-off
steps. Where a step is long, Part B
links to the runbook that owns it instead of repeating it. Part A absorbed the useful checks of the old deployment
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
      a unique constraint over existing data, needs a SQL file in the deploy script or a hand step (Part B has this
      release's).
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
      does). Use the `ixstats_dryrun` recipe in
      [deploy-mycountry-2026-10.md](deploy-mycountry-2026-10.md#7-stat-progression-dry-run-on-a-production-copy) to make
      the copy, then run the deploy's schema steps and Part B's hand steps against it, in order, with
      `DATABASE_URL` pointing at `ixstats_dryrun` in that shell:
      1. `bun scripts/deployment/apply-additive-schema.ts --apply`;
      2. every `bunx prisma db execute …` and `bun scripts/…` line of `scripts/deploy-production.sh` between the WikiOS
         proof check and `bun run db:push:force` (`scripts/refresh-local-db.sh` lists the same lines, which
         `src/tests/scripts/deploy-sql.test.ts` keeps in step), with the hand steps Part B puts among them;
      3. `bun run db:push:force`, then the three files the script runs after it.

      **Never run `deploy-production.sh` for a rehearsal:** it loads `.env.production` over your shell, so its
      `DATABASE_URL` is production's. Note how long each step takes and every warning the push prints. Drop the copy
      afterwards (`dropdb`). A developer machine can rehearse too: `scripts/refresh-local-db.sh` restores a fresh
      production dump into the local container and runs the same chain.
- [ ] **New env vars:** `git diff origin/master origin/development -- src/env.ts .env.example`. Anything newly
      required in production must be on the server before A4 (A2 has the full list).
- [ ] **One-off scripts:** check the PR descriptions and `scripts/migrations/` for anything the release says to run
      (dry run first). Part B has this release's.
- [ ] **Version and changelog:** the version in `src/lib/buildVersion.ts` is the one you're releasing, and
      `CHANGELOG.md` has its entry, with breaking changes called out.
- [ ] **Tag (optional):** `git tag -a v<version> -m "Release IxStats <version>"` on the `master` merge, so a
      rollback has a named target.
- [ ] **Announce** the maintenance window to players. An ordinary release is down from the build until the new server
      answers (A4): the time of two builds (IxStats and IxWorld) plus the start, about 5–10 minutes. A release with a
      stop-the-app window (Part B) is down from the stop.

### A2. Server prep

```bash
ssh ixwiki
cd /ixwiki/public/projects/ixstats
tmux new -s deploy            # the deploy runs for many minutes, and without ixstats-web it ends in the foreground
```

- [ ] **Disk:** `df -h /` — keep at least a few GB free. A full disk puts Postgres into recovery mode.
- [ ] **Services up:** `docker ps --filter name=ixstats-postgres` shows the container Up;
      `docker exec ixstats-redis-cache redis-cli ping` returns `PONG`; `pm2 status` lists `ixstats-cron`,
      `ixstats-ws` and `ixstats-ixtwitter`, and `ixstats-web` once the web app runs under PM2.
- [ ] **TLS certificate** isn't about to expire:
      `openssl s_client -connect ixwiki.com:443 -servername ixwiki.com </dev/null 2>/dev/null | openssl x509 -noout -dates`.
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
      | `NEXT_PUBLIC_APP_URL=https://ixwiki.com` | Canonical URLs and the WebSocket origin check. Written into the build: set it before A4 |
      | `WS_ALLOWED_ORIGINS=https://ixwiki.com,https://maps.ixwiki.com` | Browsers allowed to open the ThinkPages socket |
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
      `CRON_ENABLED_JOBS` (see A7). Every app runs with `NODE_ENV: "production"`. To have PM2 supervise the web app,
      copy the template's `ixstats-web` block (`bash start-production.sh`, `PORT: "3550"`, `kill_timeout` 15 s,
      restart limits): the deploy then reloads it with the other apps and waits for it to answer, and nothing needs to
      stay in the foreground. Without that block the deploy ends by running `start-production.sh` in the foreground, as
      before.
- [ ] **Server-only config:** `next.config.js` is not tracked; if the release changes rewrites/redirects, edit the
      server copy by hand and check it with `node --check next.config.js`.
- [ ] **Hand database steps** the release needs before the deploy (Part B for this one) are done.

### A3. Promote to `master`

Merge the `development` → `master` PR on GitHub (CI green). Then on the server:

```bash
git fetch master master
git checkout -B master master/master
git log -1 --oneline          # the merge you just made
```

(The git remote on the VPS is itself called `master`, so `master/master` is the `master` branch.) Checking out does not
touch the running servers: `next start` serves from `.next`, and IxWorld from its own directory.

### A4. Build and deploy

```bash
./scripts/deploy-production.sh
```

What it does, in order (and what to watch for). Steps marked **[schema]** are skipped with `SKIP_SCHEMA_SYNC=1` (see
below).

1. **Git sync** (on the production checkout only): refuses any branch but `master` (override:
   `ALLOW_NON_MASTER_DEPLOY=1`, for rollbacks only), fetches it from the `master` remote, `reset --hard` and
   `git clean -fd` (git-ignored files such as `.env*`, `backups/` and `next.config.js` are kept). It exports the
   commit as `IXSTATS_DEPLOY_COMMIT`, so IxWorld, cron and the websockets are built from the same commit as the web app.
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
   deploy (a database without `job_leases` yet has no lease to hold). `WIKIOS_PROOF_OVERRIDE=1` deploys anyway.
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
   blindly. Then the post-push SQL: `20261019120000_rename_ixworld_realm_ixnay`, `20261021120000_atlas_r0`,
   `20261022120000_atlas_ra`. Prisma 6.19's push never reads partial indexes, triggers or rules, so the ones the SQL
   created (the forum's, IxnayID's, the cards triggers) survive it and need no re-apply.
9. **Build:** moves the live `.next` to `.next.prev` (see "When it fails" below), then `bun run build`.
10. **IxWorld:** `scripts/deploy-ixworld.sh` builds the same commit (it refuses if the checkout moved), swaps it into
    `/ixwiki/public/maps/ixworld`, reloads PM2 `ixworld` and rolls itself back if its health check fails.
11. **PM2:** `pm2 startOrReload ecosystem.config.cjs --update-env` (cron, websockets, IxTwitter sync, and `ixstats-web`
    when it is defined). The first time `ixstats-web` is defined, the deploy first stops the foreground server
    `start-production.sh` left on the port. A failed reload stops the deploy; a missing `pm2` or `ecosystem.config.cjs`
    is reported and skipped. Then it releases the WikiOS proof lease.
12. **The web server:**
    - **With `ixstats-web`:** waits up to 2 minutes for a non-5xx answer on `http://127.0.0.1:3550/projects/ixstates`.
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
the old server serving. From step 9 the old server keeps running, but its build has moved to `.next.prev`, so pages it
has not loaded yet and its static files stop resolving: count the window from the build. Under PM2 the old server is
restarted at step 11; in the foreground it is stopped at step 12.

**When it fails.**

- **Steps 1–8:** the live build is untouched. The schema may be partly changed (the additive step, some SQL files):
  fix the cause and run the deploy again; every step is idempotent. The backup of step 4 is the way back.
- **Build, IxWorld or PM2 reload (steps 9–11), or `Ctrl+C`:** an exit trap moves `.next.prev` back to `.next`, so the
  old build is in place again. Its server serves again if it is still running; start it if it was stopped.
- **The deploy was killed outright** (the box rebooted, `kill -9`): `.next.prev` stays. The next deploy puts it back
  first (or drops it when `.next` is a finished build, with a `BUILD_ID`). To serve the old build at once:
  `rm -rf .next && mv .next.prev .next`, then start the web app.
- **The new server does not answer (step 12):** the previous build stays in `.next.prev`. Read the logs first. Put it
  back by hand only for a release whose schema the old code still reads; otherwise roll back (below).

**`SKIP_SCHEMA_SYNC=1`** runs everything but the schema work: the additive step, the SQL, the push, the post-push SQL
and the post-deploy SQL are skipped; the backup and the WikiOS proof check still run. It exists for rollbacks, where an
older schema must never be pushed over a newer one.

### A5. Verify

```bash
pm2 jlist | python3 -c "import sys,json;[print(p['name'],p['pm2_env'].get('NODE_ENV')) for p in json.load(sys.stdin) if p['name'].startswith('ixstats')]"
pm2 logs ixstats-web --lines 30 --nostream      # when the web app runs under PM2: the start banner names 1.5.0, no errors
pm2 logs ixstats-cron --lines 30 --nostream     # no import errors; lists the scheduled jobs
pm2 logs ixstats-ws --lines 30 --nostream       # "[WS] ✓ ThinkPages WebSocket initialized", no "Redis disabled"
curl -sI https://ixwiki.com/projects/ixstates/ | head -5
curl -s http://localhost:3550/projects/ixstates/api/health   # 200 ok / 503 degraded: db, Redis, memory, cron runs
curl -s http://localhost:3551/healthz                        # ixstats-ws
ls .next.prev 2>/dev/null                                    # nothing: the deploy removed it once the server answered
```

Every app in the list reads `production`, `ixstats-web` included when defined. `ixstats-ws` exits (and PM2 restarts
it) when a socket server fails to start, so a climbing restart count in `pm2 status` means read its log.

In a browser (console open):

- [ ] `/`, `/dashboard`, `/mycountry`, `/maps` load with no console errors, and **no "Refused to execute inline
      script" / CSP violations**.
- [ ] Sign in and out; `/admin` works for an admin.
- [ ] Send a message and see it arrive in a second browser (Redis bridge); DevTools → Network → WS shows the
      socket connected.
- [ ] The Vault store loads; a purchase shows the right price.
- [ ] Whatever this release changed (see the promotion PRs).

The September runbook's [smoke checks](deploy-rose-garden-2026-09.md#6-smoke-checks-browser) are a fuller list.

### A6. One-off scripts

Run anything the release lists, **dry run first**, then `--apply` after reading the output. Part B has this
release's.

### A7. Cron jobs

`cron-runner.mjs` (PM2 `ixstats-cron`) runs only the jobs named in `CRON_ENABLED_JOBS` (comma-separated, or `*`), and
exits on any unknown name. Add new jobs one per cycle, edit `ecosystem.config.cjs`, then
`pm2 restart ixstats-cron --update-env` and read its log. The job table is `src/server/cron/jobs.ts` (listed in
[events.md](../reference/events.md#scheduled--batch-jobs)); the order to enable them is in the
[September runbook, step 7](deploy-rose-garden-2026-09.md#7-turn-cron-jobs-on-one-per-cycle), ending with
`thinkpages-trending` → `achievements-evaluate` → `stat-progression`. After each change, check the job's last run in
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
or rewrote data needs `--restore` (1.5 does: see Part B). Pick the dump from `backups/deploy-history.log`: each line is
the time, the commit that went live and the dump taken just before. A restore loses everything written since that dump.

After a restore, spot-check it:
`docker exec ixstats-postgres psql -U postgres -d ixstats -c 'SELECT count(*) FROM "Country";'`.
To restore by hand instead, `bun run db:restore` lists `backups/` and prints the `pg_restore` command; add `--yes
--i-know-this-is-production` to run it ([deployment.md](deployment.md#backups-and-restore)).

The copied script runs the old checkout's own files, so the old commit must have what it calls. A commit older than
the WikiOS proof CLI (`scripts/audit/wikios-proof.ts`, added 2026-10-25) stops at the proof check, and
`WIKIOS_PROOF_OVERRIDE=1` does not help when the file is missing. For such a target, restore by hand and build and
start the old commit by hand (`bun install --frozen-lockfile`, `bun run db:generate`, `bun run build`,
`./scripts/deploy-ixworld.sh`, `pm2 startOrReload ecosystem.config.cjs --update-env`, then the web app).

Then revert or fix on `master` (via `development`), deploy `master` again, re-run the A5 checks, watch the logs for a
while, and write down what failed and why.

---

## Part B — This release (1.5 "Lobster Crosby", the `rose-garden` RC)

The 1.4 plan (PRs #44 and #45) was never completed on production. On 2026-09-27 production's checkout was
`development` @ `7877d620`, and on 2026-10-25 the main app on port 3550 had no build: the IxWorld standalone (built
2026-08-04, maps.ixwiki.com) served every page, and `ixstats-cron` and `ixstats-ws` ran with `NODE_ENV=development`
and a read-only database ([MyCountry runbook](deploy-mycountry-2026-10.md)). So 1.5 brings everything since: the September plan wave, roadmap
M0, the cards refresh, IxnayID, MyCountry fixes, realm time, native lore and WikiOS data safety. Its SQL drops and
converts data, so **a rollback to pre-1.5 code is a restore** (`--restore`).

This part gives the order. The detail stays in each runbook:

| Area | Runbook |
| --- | --- |
| Environment, `next.config.js`, WikiRevision dedupe, Realms backfill, relief, Vault hub backfills, Eurth, cron order | [deploy-rose-garden-2026-09.md](deploy-rose-garden-2026-09.md) (its order is superseded by this part) |
| Cards Phases 1 to 4 and categories | [cards.md](../systems/cards.md#deploy-runbook-notes) and the phase runbooks after it |
| IxnayID and Lorewards | [ixnayid-passport.md](../systems/ixnayid-passport.md#ixnayid-identity-deploy-runbook-owner) |
| MyCountry fixes | [deploy-mycountry-2026-10.md](deploy-mycountry-2026-10.md) |
| Realm time | [deploy-realm-time-2026-10.md](deploy-realm-time-2026-10.md) |
| Native lore | [explore-and-country-profiles.md](../systems/explore-and-country-profiles.md#native-lore-deploy-runbook-owner) |
| WikiOS v1 and data safety | [wikios-v1-cutover.md](wikios-v1-cutover.md) |

### B1. Before deploy day

- [ ] Read the runbooks above once end to end.
- [ ] **Owner decisions,** written down before the window:
      - realm time D2a **deletes every `MilitaryAsset` whose `catalogKey` is NULL** (every asset today), and the
        starter-force reset replaces every nation's forces with a starter force (realm-time step 4);
      - the drop of `world_configs` (1 row) and `territory_claims` (0 rows) by the deploy's
        `drop-world-configs.sql`;
      - who owns each Realms ownership **collision** (the dev rehearsal had one, Faneria; Caphiria needs the hand fix in
        [5a](deploy-rose-garden-2026-09.md#5a-realms-schema--ownership-backfill-before-the-deploy-script));
      - how to settle each card copy held as `quantity > 1` (B2);
      - the admin who confirmed each IxWiki link by hand (B3 step 7).
- [ ] **Env** (A2) and the new values since production's last deploy: `WIKI_SYNC_WEBHOOK_SECRET`, `IXTIME_BOT_SECRET`,
      `NEXT_PUBLIC_APP_URL` (before the build), `WS_ALLOWED_ORIGINS`, `REDIS_ENABLED`, `REDIS_URL`, `DISCORD_GUILD_ID`,
      `MAP_TILE_DIR` and `MAP_RASTER_DIR` ([September step 2](deploy-rose-garden-2026-09.md#2-environment) and
      [5c](deploy-rose-garden-2026-09.md#5c-relief-for-ixnay-and-eurth-after-the-deploy-script)),
      `WIKIOS_MEDIAWIKI_INTERNAL_URL` with its loopback server
      ([cutover step 2](wikios-v1-cutover.md#2-deploy-ixstates-as-usual)), and optionally `COMBAT_SEED_SECRET`, email
      and push. Check `CRON_SECRET` is at least 32 characters.
- [ ] **`ecosystem.config.cjs`:** `NODE_ENV: "production"` for every app, `CRON_ENABLED_JOBS: ""` for `ixstats-cron`
      (the new runner exits on old names such as `passive-income`, `scheduled-changes` and `lorewards-state-sync`),
      and the `ixstats-web` block if the web app should run under PM2 (A2).
- [ ] **`next.config.js`:** the canonical `/@user` edit,
      [September step 3](deploy-rose-garden-2026-09.md#3-nextconfigjs-on-the-server-canonical-user-urls).
- [ ] **Drain the card market** a few days ahead: switch off auctions (`vault_isAuctionsEnabled`) and trading
      (`vault_isTradingEnabled`) in the Vault admin
      ([cards refresh spec §5.5](../specs/2026-10-15-cards-refresh-design.md#55-migration-and-deploy-order)). Production's
      cron may not settle anything (it runs read-only), and open auctions and pending trades carry over the deploy
      ([Phase 4](../systems/cards.md#phase-4-deploy-runbook-owner), "What carries over"), so draining shrinks what
      crosses the window; it is not a guard.
- [ ] **Rehearse** B2 to B4 on `ixstats_dryrun` (A1), hand steps included. `reset-starter-forces.ts` needs no
      `--i-know` there (it is a known clone). Note the time of each step, every refusal and every warning the push
      prints.

### B2. Pre-window checks (read-only; the old build still serving)

Do A3 first (the checkout does not touch the running servers), load the production env, then:

1. **Schema state.** The `migrate diff` and the additive dry run of A1. Note whether the diff adds
   `Country.ownerUserId` (the Realms schema has not reached production), `wiki_revisions.revId`, the
   `wiki_revisions (source, mwRevId)` unique index and the `Alliance (realmId, name)` unique key. B3 depends on it.
2. **Cards guards.** The constraint and economy SQL refuse, changing nothing, until these hold:
   ```sql
   SELECT id, "cardId", "ownerId", quantity FROM "CardOwnership" WHERE quantity > 1;   -- must be empty
   SELECT status, count(*) FROM "TradeOffer" GROUP BY 1;    -- only PENDING, ACCEPTED, REJECTED, CANCELLED, EXPIRED
   SELECT status, count(*) FROM "CardAuction" GROUP BY 1;   -- only ACTIVE, COMPLETED, CANCELLED
   ```
   Settle each `quantity > 1` row by hand (nothing splits them). An old `COUNTERED` trade becomes `REJECTED` (B3
   step 3). Also run the read-only checks of
   [Phase 2 step 2](../systems/cards.md#phase-2-deploy-runbook-owner) and the pack odds of
   [Phase 4 step 2](../systems/cards.md#phase-4-deploy-runbook-owner).
3. **WikiRevision duplicates**, if the diff adds the `(source, mwRevId)` unique index: sections 1 and 1b of
   [September step 4](deploy-rose-garden-2026-09.md#4-database-steps-that-must-happen-before-the-deploy).
4. **PvP challenges:** `SELECT count(*) FROM "MilitaryConflict" WHERE type = 'pvp' AND status = 'proposed';`. The
   deploy's `f-defense.sql` ends every one whose defender has no owner, so the ownership backfill must be in place
   first (B3 step 8).
5. **IxnayID:** the counts and the conversion dry run,
   [IxnayID step 1](../systems/ixnayid-passport.md#ixnayid-identity-deploy-runbook-owner) (on the rehearsal copy if
   production lacks the tables it reads). **Lorewards:** its step 1 counts
   ([Lorewards runbook](../systems/ixnayid-passport.md#lorewards-deploy-runbook-owner)).

### B3. The window (the app stopped)

1. **Stop everything that serves or writes with the old code. Downtime starts here.** Announce it first.
   ```bash
   pm2 stop ixworld ixstats-cron ixstats-ws ixstats-ixtwitter
   pm2 stop ixstats-web 2>/dev/null    # or stop the start-production.sh session, if 3550 runs at all
   ```
   The cards SQL rewrites and drops columns the old code reads, and the realm-time SQL converts timestamps the old
   jobs would fire on, so no old code may run between the SQL and the new build. The deploy starts them all again.
   Remove the server crontab's call to `/api/lorewards/sync` (Lorewards step 2).
2. **`bun run db:backup`.** Keep the path: it is the rollback point for everything below.
3. **Data the guards need:**
   `UPDATE "TradeOffer" SET status = 'REJECTED' WHERE status = 'COUNTERED';`, the `quantity > 1` rows settled, the
   WikiRevision dedupe (sections 2 and 3, if B2.3 applied) and, if the diff adds the `Alliance (realmId, name)` key,
   `prisma/migrations/20261007120000_realm_source_sync/migration.sql`
   ([September step 4](deploy-rose-garden-2026-09.md#4-database-steps-that-must-happen-before-the-deploy)).
4. **The additive step, by hand:** `bun scripts/deployment/apply-additive-schema.ts --apply`. The steps below read
   columns only it creates (`Country.ownerUserId`, `wiki_account_links."verifiedById"`, …). The deploy runs it again
   and finds nothing to do. It never adds `wiki_revisions.origin`.
5. **The Lorewards weekly merge:** `bun scripts/lorewards/merge-weekly-keys.ts`, then `--apply`, then the dry run again
   (Lorewards step 3).
6. **The WikiOS SQL,** [cutover step 1](wikios-v1-cutover.md#1-apply-the-wikios-sql-migrations): the canonical titles
   procedure, then the `prisma/manual-migrations/*wikios*.sql` loop (without the lead-image file).
   **`2026-09-30-wikios-api.sql` must run before the deploy**: the deploy's `20261105120000_wikios_conflicts` labels
   each existing revision `classic` or `wikios` once, when it adds `origin`, and needs `revId = mwRevId` filled for
   MediaWiki's revisions. The additive step adds `revId` empty; only the api.php file fills it. The read-only check is
   in the cutover runbook ("The data-safety SQL runs before the push").
7. **IxWiki links an administrator confirmed:** record the confirming admin in `wiki_account_links."verifiedById"`
   ([cutover step 1b](wikios-v1-cutover.md#1b-import-the-mediawiki-rights-plan-409-after-checking-who-vouched-for-each-name),
   "If the IxnayID identity deploy has not run yet"). The deploy's conversion reads it: a link left NULL converts as
   self-proved and passes that name's MediaWiki groups to the account.
8. **The Realms ownership backfill,** if `Country.ownerUserId` is new or still empty:
   `bun scripts/realms/backfill-foundation.ts` (dry run), resolve each collision, the Caphiria fix, then `--apply`
   ([5a](deploy-rose-garden-2026-09.md#5a-realms-schema--ownership-backfill-before-the-deploy-script)). It must run
   before the deploy: the deploy's `f-defense.sql` and the starter-force reset treat a nation with no owner as an NPC.
   `--apply` writes through the new Prisma client, which reads back every `Country` and `realms` column the schema
   declares; columns that only deploy SQL adds (`Country."ownedSince"` from the Vault hub file, `realms."isSystem"`
   from the cards foundations file, the realm board columns from `20261014120000_thinkpages_realm_board`) do not exist
   yet, and `--apply` fails on the first one with "column does not exist", writing nothing. The rehearsal shows which
   are missing on production's schema. Apply those files by hand first (each is idempotent and the deploy runs it
   again; the forum file needs the forum files before it, in order), then `--apply`.
9. **MyCountry and realm-time SQL:** the deploy runs them in the runbooks' order, after the steps above. Running the
   runbooks' `run_sql` steps by hand first also works once steps 4 and 8 are done (the deploy re-runs each as a
   no-op); see the [realm-time runbook](deploy-realm-time-2026-10.md#4-the-deploy-window-old-build-stopped).
10. **Deploy** (A4): `./scripts/deploy-production.sh`. As soon as it prints **"Database sync completed
    successfully"**, open a second tmux window (`Ctrl+B C`) and run, during the build:
    ```bash
    bun run db:mark-match-revenue-collected             # dry run: how many completed matches
    bun run db:mark-match-revenue-collected -- --apply
    ```
    This marks every match that finished before this release as paid. Skip it and each club's first "Collect
    Revenue" pays its whole match history (SL-14). Run it once; never add it to routine deploys.

    **If the push stops on a warning,** the live build is untouched and every SQL file before it has run (the WikiOS
    labelling included). Read every line. If they are only the expected unique constraints on new columns (for
    example `wiki_logs.mwLogId`, or WikiOS's `lore_stash_items` key if the stash-key file has not run), run
    `bun run db:push:force` by hand, answer yes, and run the deploy again: each file is then a no-op and the push has
    nothing left. Anything that drops a column or table with data means a step was skipped: stop.

### B4. Right after the deploy, in order

1. **Checks.**
   - A5, and `ls -l /ixwiki/public/maps/ixworld/.next/BUILD_ID` is dated today
     ([realm-time step 5](deploy-realm-time-2026-10.md#5-the-code-deploy)). If `ixstats-ws` did not come back:
     `pm2 start ecosystem.config.cjs --only ixstats-ws`.
   - WikiOS labels: `select origin, count(*) from wiki_revisions group by origin` shows mostly `classic`. Every row
     `wikios` means the labelling was skipped; the cutover runbook has the one-off fix.
   - IxnayID's partial unique indexes exist (`\d wiki_name_claims`; IxnayID step 2).
   - The cards checks: [Phase 2 step 4](../systems/cards.md#phase-2-deploy-runbook-owner),
     [Phase 3 step 4](../systems/cards.md#phase-3-deploy-runbook-owner),
     [Phase 4 step 6](../systems/cards.md#phase-4-deploy-runbook-owner),
     [categories step 3](../systems/cards.md#card-categories-deploy-runbook-owner).
   - Native lore: `SELECT to_regclass('country_lore_authors'), to_regclass('country_lore_pages');` names both tables.
   - The notification links: run
     `prisma/migrations/20261028120000_rewrite_legacy_notification_links/migration.sql` again; every line reads
     `UPDATE 0` ([September 5e](deploy-rose-garden-2026-09.md#5e-stored-notification-links-after-the-deploy-script)).
2. **Starter forces** (owner decision): `bun scripts/defense/reset-starter-forces.ts --apply --i-know ixstats`. Read
   the report; stop if a nation falls outside the 0.2–1.1% band. A nation read before this already has the same force
   (the new build creates it on first read), and the reset skips it.
3. **Production mode for cron and the websockets:** [MyCountry step 5](deploy-mycountry-2026-10.md#5-recreate-ixstats-cron-and-ixstats-ws-in-production-mode-p0-03),
   then the bot clock, [step 6](deploy-mycountry-2026-10.md#6-the-bot-clock-p1-32).
4. **IxnayID:** tag the claimed names' past revisions (`tag-claimed-revisions.ts`, step 3), the curated alt (step 4),
   the counts after (step 6).
5. **Cards one-offs,** each a dry run first: `backfill-card-compliance.ts` then `--apply --fetch`,
   `import-special-cards.ts` then `--apply` and the `specialKind` check, `convert-lore-requests.ts`,
   `refund-lore-tokens.ts` (after `audit:vault-exploits:apply`)
   ([Phase 2 step 6](../systems/cards.md#phase-2-deploy-runbook-owner)); the seed-card retirement and the category
   backfill ([categories steps 4 to 8](../systems/cards.md#card-categories-deploy-runbook-owner)); revalue once
   ([Phase 4 step 9](../systems/cards.md#phase-4-deploy-runbook-owner)). Then switch auctions and trading back on.
6. **Realms and Atlas:** the geometry triggers
   ([5b](deploy-rose-garden-2026-09.md#5b-map-geometry-triggers-after-the-deploy-script)), relief
   ([5c](deploy-rose-garden-2026-09.md#5c-relief-for-ixnay-and-eurth-after-the-deploy-script)), the Vault hub
   backfills `backfill-country-owned-since.ts` and `backfill-loreward-trophy-cards.ts`
   ([5d](deploy-rose-garden-2026-09.md#5d-vault-hub-backfills-and-restart-after-the-deploy-script)), and the
   ownership backfill's dry run again: expect `owners: 0 to assign, 0 collisions`.
7. **Data fixes,** each a dry run first (take `bun run db:backup` before the first `--apply`):
   ```bash
   bun run audit:vault-exploits                      # exploit rows + the corrections it would make (VT-1/2/6/11)
   bun run audit:vault-exploits:apply                # idempotent ADMIN_ADJUSTMENT rows; never below a zero balance
   bun run db:refund-retired-store-items             # then -- --apply (after the exploit corrections)
   bun run audit:forum-links                         # read-only: forum accounts linked without proof (WK-1)
   bun scripts/fix-storyteller-effect-timestamps.ts  # plan 329; then --apply
   bun run wiki:backfill:blurhash                    # then -- --apply
   ```
   The deploy's MyCountry `a1` SQL already retired the unkeyed `[GovComponent]`/`[BrokerComponent]` rows, so read
   the storyteller dry run for what is left to re-date before announcing it.
8. **The budget-year remap** (MC-1). Its tool `db:remap-budget-years` was retired; restore it from `65fd9dcdc^`, dry
   run, apply, remove it ([MyCountry step 8](deploy-mycountry-2026-10.md#8-turn-the-jobs-on)). Skip it if every
   `BudgetAllocation.budgetYear` is already 2041 or later.
9. **Cron, one job per cycle (A7).** First `db-backup` and `log-retention`; then the
   [September order](deploy-rose-garden-2026-09.md#7-turn-cron-jobs-on-one-per-cycle) with `vault-dividend`; the cards
   jobs (`card-import-jobs`, `listing-expiry`, `card-holding-xp`, with `card-values`, `auction-completion` and
   `trade-expiry`); the MyCountry jobs in [MyCountry step 8](deploy-mycountry-2026-10.md#8-turn-the-jobs-on)'s order
   with the [realm-time notes](deploy-realm-time-2026-10.md#7-cron-back-on); `budget-year-rollover` only after step 8.
   Size the money jobs' backlogs first (September step 7). Leave `wiki-mirror` and `wiki-render-stale` to the WikiOS
   launch.
10. **The WikiOS launch:** the rest of the cutover runbook's launch steps, from 1b's rights import on, in its order.
    WikiOS editing stays off until its step 6b.
11. **Later:** Eurth ([6b](deploy-rose-garden-2026-09.md#6b-serve-eurth-the-first-outside-realm)) and the CSP (B6).

### B5. Ops prerequisites still open

From [SYSTEM_STATUS](../systems/SYSTEM_STATUS.md#known-blockers-on-rose-garden). The steps above cover some; the rest
are owner work around the release:

- [ ] **Rotate the `ixstats_readonly` Postgres password** (plan 325): the old one is in git history.
- [ ] **Test a `db:backup` restore** into a scratch database (the M0 exit criterion):
      ```bash
      docker exec ixstats-postgres createdb -U postgres ixstats_restore_test
      docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats_restore_test --no-owner \
        < "$(ls -t backups/ixstats-*.dump | head -1)"
      docker exec ixstats-postgres psql -U postgres -d ixstats_restore_test -c 'SELECT count(*) FROM "Country";'
      docker exec ixstats-postgres dropdb -U postgres ixstats_restore_test
      ```
      The A1 rehearsal restores a dump too; it counts once its copy checks out.
- [ ] **Copy `backups/` off the server** (another host or object storage); the dumps sit on the same disk as the
      database.
- [ ] **Review `audit:vault-exploits`, then `audit:vault-exploits:apply`** (B4 step 7).
- [ ] **Review `audit:forum-links`** (B4 step 7).
- [ ] **`CRON_ENABLED_JOBS`:** `db-backup`, `log-retention` and `budget-year-rollover` (after the remap) (B4 step 9).
- [ ] **`DISCORD_GUILD_ID`** set (A2).
- [ ] **`db:mark-match-revenue-collected`** right after the push (B3 step 10).
- [ ] **The budget-year remap,** with the retired `db:remap-budget-years` restored from `65fd9dcdc^` (B4 step 8).

### B6. CSP: remove the nginx override

The app now sends a per-request nonce that reaches the page (PL-2), but nginx or a Cloudflare transform rule still
replaces the app's `Content-Security-Policy` header. Once this release has been stable for a day:

1. Remove the override (nginx `add_header Content-Security-Policy …` for `/projects/ixstates`, or the Cloudflare
   transform rule), then reload nginx (`nginx -t && systemctl reload nginx`).
2. Check the header now comes from the app — it contains `'nonce-`:
   ```bash
   curl -sI https://ixwiki.com/projects/ixstates/ | grep -i content-security-policy
   ```
3. With the browser console open, go through A5's pages plus sign-in, the map editor and a wiki article. Any
   "Refused to …" message names the blocked source: add it to `src/lib/security/csp.ts` (on `rose-garden`) and
   release again. To back out quickly, restore the nginx override.
4. Later, once no violations show up, drop `'unsafe-inline'` from production `script-src` in `csp.ts` (browsers
   already ignore it when a nonce is present, so this only affects very old browsers).
