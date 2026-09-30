# Release guide: build and deploy IxStats from `master`

**For:** whoever releases IxStats to production (`ssh ixwiki`, root). **Last updated:** 2026-09-30.

This is the one place to start a release. Part A is the procedure for **every** release. Part B lists the one-off
steps for the **first release under the new branch model** (1.4, promoting the September `rose-garden` work),
which carries schema changes and data fixes that later releases won't. Where a step is long, this guide links to the
[September runbook](deploy-rose-garden-2026-09.md) instead of repeating it.

Branches: `rose-garden` (nightly) → `development` (stable-experimental) → `master` (production); see
[contributing.md](../processes/contributing.md#branches). Production only ever runs `master`.

---

## Part A — Every release

### A1. Pre-deploy checklist (GitHub, before you touch the server)

- [ ] **Branch protection** is on for `development` and `master` (Settings → Branches): PR required, the `verify`
      check required, force-pushes and deletions blocked, admins may bypass. Don't require `review-pr` (the Gemini
      job) until it has an API key.
- [ ] **CI is green** (`verify`) on the head of `rose-garden`.
- [ ] **Promotion PR `rose-garden` → `development`** is open, CI green, and you've read what it brings in
      (`git log origin/development..origin/rose-garden --oneline`). Merge it.
- [ ] **Promotion PR `development` → `master`** is open and CI green. **Don't merge it yet**: merge it at A4, right
      before you deploy, so `master` is always what production runs.
- [ ] **Schema changes:** list them with
      `git diff origin/master origin/development -- prisma/schema`. The deploy runs `prisma db push`, which applies
      additive changes by itself and **stops** on anything that would drop data. Anything that drops a table or column,
      or adds a unique constraint over existing data, needs a hand step first (see Part B for this release's).
- [ ] **New env vars:** `git diff origin/master origin/development -- src/env.ts .env.example`. Anything newly
      required in production must be on the server before A4 (A2 has the full list).
- [ ] **One-off scripts:** check the PR descriptions and `scripts/migrations/` for anything the release says to run
      (dry run first). Part B has this release's.
- [ ] **Announce** the maintenance window to players. Expect about 5–10 minutes of downtime (see A4).

### A2. Server prep

```bash
ssh ixwiki
cd /ixwiki/public/projects/ixstats
tmux new -s deploy            # the deploy ends by running the server in the foreground; keep it in tmux
```

- [ ] **Disk:** `df -h /` — keep at least a few GB free. A full disk puts Postgres into recovery mode.
- [ ] **Note the running commit** for rollback: `git log -1 --oneline` → write it down.
- [ ] **Back up:** `bun run db:backup` → `backups/ixstats-<UTC timestamp>.dump` (via the `ixstats-postgres`
      container). The deploy script takes another one before `db push`; this one is your pre-deploy copy.
      Check it: `ls -lh backups/ | tail -3` (a healthy dump is not tiny).
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
      | `NEXT_PUBLIC_APP_URL=https://ixwiki.com` | Canonical URLs and the WebSocket origin check |
      | `WS_ALLOWED_ORIGINS=https://ixwiki.com,https://maps.ixwiki.com` | Browsers allowed to open the ThinkPages socket |
      | `REDIS_ENABLED=true`, `REDIS_URL=redis://localhost:6379` | Cross-process realtime and rate limits (`ixstats-redis-cache`) |
      | `DISCORD_GUILD_ID=552179975769161729` | Discord nicknames in reaction lists |
      | `FORUM_VERIFICATION_SECRET` | Optional; forum-link codes fall back to `CRON_SECRET` |
      | `BOT_API_KEY` | Discord bot → `/api/bot/lorewards/sync` |

      Generate secrets on the server (`openssl rand -hex 32`) and never paste them elsewhere.
- [ ] **PM2 env:** `ecosystem.config.cjs` (git-ignored) gives `ixstats-cron` and `ixstats-ws` their env. They need
      the same Redis settings, and `ixstats-cron` needs `CRON_ENABLED_JOBS` (see A7).
- [ ] **Server-only config:** `next.config.js` is not tracked; if the release changes rewrites/redirects, edit the
      server copy by hand and check it with `node --check next.config.js`.
- [ ] **Hand database steps** the release needs (Part B for this one) are done.

### A3. Promote to `master`

Merge the `development` → `master` PR on GitHub (CI green). Then on the server:

```bash
git fetch master master
git checkout -B master master/master
git log -1 --oneline          # the merge you just made
```

(The git remote on the VPS is itself called `master`, so `master/master` is the `master` branch.)

### A4. Build and deploy

```bash
./scripts/deploy-production.sh
```

What it does, in order (and what to watch for):

1. Refuses any branch but `master` (override: `ALLOW_NON_MASTER_DEPLOY=1`, for rollbacks only), then hard-resets the
   checkout to the remote branch and `git clean -fd` (git-ignored files such as `.env*`, `backups/` and
   `next.config.js` are kept).
2. Loads `.env.production` and `.env.production.local`, checks `DATABASE_URL` is PostgreSQL and the Clerk keys are
   live keys.
3. `bun run clean` — **downtime starts here**: the old build is deleted while the old server is still running.
4. `bun install --frozen-lockfile`, `bun run db:generate`.
5. `bun run db:backup` — aborts the deploy if the dump fails.
6. `bun run db:push:force` — applies the schema. **If it reports possible data loss, stop (Ctrl+C) and read the
   message**; never add `--accept-data-loss` blindly. Restore from A2's dump if in doubt.
7. `bun run build`, then `scripts/deploy-ixworld.sh` (the standalone maps app).
8. `pm2 startOrReload ecosystem.config.cjs --update-env` (cron, websockets, IxTwitter sync).
9. Frees port 3550 and runs `start-production.sh` in the foreground — **downtime ends** when it's listening.
   Detach from tmux with `Ctrl+B D`; reattach later with `tmux attach -t deploy`.

### A5. Verify

```bash
pm2 jlist | python3 -c "import sys,json;[print(p['name'],p['pm2_env'].get('NODE_ENV')) for p in json.load(sys.stdin) if p['name'].startswith('ixstats')]"
pm2 logs ixstats-cron --lines 30 --nostream     # no import errors; lists the scheduled jobs
pm2 logs ixstats-ws --lines 30 --nostream       # "[WS] ✓ ThinkPages WebSocket initialized", no "Redis disabled"
curl -sI https://ixwiki.com/projects/ixstates/ | head -5
```

In a browser (console open):

- [ ] `/`, `/dashboard`, `/mycountry`, `/maps` load with no console errors, and **no "Refused to execute inline
      script" / CSP violations**.
- [ ] Sign in and out; `/admin` works for an admin.
- [ ] Send a message and see it arrive in a second browser (Redis bridge).
- [ ] The Vault store loads; a purchase shows the right price.
- [ ] Whatever this release changed (see the promotion PRs).

The September runbook's [smoke checks](deploy-rose-garden-2026-09.md#6-smoke-checks-browser) are a fuller list.

### A6. One-off scripts

Run anything the release lists, **dry run first**, then `--apply` after reading the output. Part B has this
release's.

### A7. Cron jobs

`cron-runner.mjs` (PM2 `ixstats-cron`) runs only the jobs named in `CRON_ENABLED_JOBS` (comma-separated, or `*`).
Add new jobs one per cycle, edit `ecosystem.config.cjs`, then `pm2 restart ixstats-cron --update-env` and read its
log. The job table is `src/server/cron/jobs.ts`; the order to enable them is in the
[September runbook, step 7](deploy-rose-garden-2026-09.md#7-turn-cron-jobs-on-one-per-cycle).

### A8. After the release

- [ ] Tell players it's done.
- [ ] Merge `development` back into `rose-garden` if junior work landed only on `development`.
- [ ] Keep an eye on `pm2 logs` and the admin audit log for the first hours.

### Rollback

If the release is broken and a fix-forward isn't quick:

1. Push a branch at the commit you noted in A2 (for example `rollback-<date>`), then on the server:
   ```bash
   git fetch master rollback-<date>
   git checkout -B rollback-<date> master/rollback-<date>
   ALLOW_NON_MASTER_DEPLOY=1 ./scripts/deploy-production.sh
   ```
2. **Schema:** old code runs against additive schema changes. If the release dropped or rewrote data, restore the
   pre-deploy dump instead:
   ```bash
   bun run db:restore                                   # lists backups/
   bun run db:restore -- backups/ixstats-<stamp>.dump   # prints the pg_restore command
   bun run db:restore -- backups/ixstats-<stamp>.dump --yes --i-know-this-is-production
   ```
3. Revert or fix on `master` (via `development`), then deploy `master` again.

---

## Part B — This release (1.4: promoting the September `rose-garden` work)

Production last ran `development` @ `7877d620`. This release brings in the September plan wave (Realms, WikiOS,
the cron runner and more), the docs audit, and all of roadmap M0: Vault exploit fixes and balance corrections,
authorization fixes, budget years on IxTime, backups, security hardening, match revenue, and the CSP nonce. The
promotion PRs are [#44](https://github.com/algolds/ixstats/pull/44) (`rose-garden` → `development`) and
[#45](https://github.com/algolds/ixstats/pull/45) (`development` → `master`).

### B1. Before deploy day

- [ ] Read the [September runbook](deploy-rose-garden-2026-09.md) once end to end.
- [ ] Decide how to handle any Realms ownership **collisions** (runbook 5a); the dev rehearsal had one (Faneria).
- [ ] Prepare the new secrets and env from A2; these are new since the last deploy:
      `WIKI_SYNC_WEBHOOK_SECRET`, `IXTIME_BOT_SECRET`, `NEXT_PUBLIC_APP_URL`, `WS_ALLOWED_ORIGINS`, `REDIS_ENABLED`,
      `REDIS_URL`, `DISCORD_GUILD_ID`, `FORUM_VERIFICATION_SECRET` (optional), and `CRON_ENABLED_JOBS: ''` in the
      `ixstats-cron` block of `ecosystem.config.cjs`. Check `CRON_SECRET` is set and at least 32 characters.
- [ ] Rotate the `ixstats_readonly` Postgres password (plan 325); the old one is in git history.

### B2. On the server, before the deploy script (after A2)

1. **`next.config.js`** (canonical `/@user` URLs): [runbook step 3](deploy-rose-garden-2026-09.md#3-nextconfigjs-on-the-server-canonical-user-urls).
2. **WikiRevision dedupe**, one section at a time in `psql`:
   [runbook step 4](deploy-rose-garden-2026-09.md#4-database-steps-that-must-happen-before-the-deploy).
3. **Promote** (A3), then the **Realms schema and ownership backfill** by hand, because its schema change drops two
   tables and `db push` would stop on it:
   [runbook step 5a](deploy-rose-garden-2026-09.md#5a-realms-schema--ownership-backfill-before-the-deploy-script).

### B3. Deploy (A4) — plus one step during the build

As soon as the deploy script prints **"Database sync completed successfully"**, open a second tmux window
(`Ctrl+B C`) and run:

```bash
bun run db:mark-match-revenue-collected             # dry run: how many completed matches
bun run db:mark-match-revenue-collected -- --apply
```

This marks every match that finished before this release as already paid. Skip it and each club's first "Collect
Revenue" pays out its whole match history (SL-14). Run it once only; it's safe to re-run, but never add it to
routine deploys.

### B4. Data fixes (after A5), each a dry run first

```bash
bun run db:remap-budget-years                     # budget years: real calendar → IxTime (MC-1); resolve any CONFLICT lines by hand
bun run db:remap-budget-years -- --apply

bun run audit:vault-exploits                      # exploit rows + the corrections it would make (VT-1/2/6/11)
bun run audit:vault-exploits:apply                # writes idempotent ADMIN_ADJUSTMENT rows; never below a zero balance

bun run audit:forum-links                         # read-only: forum accounts linked without proof (WK-1)

bun scripts/fix-storyteller-effect-timestamps.ts            # plan 329; announce to players before --apply
bun scripts/fix-storyteller-effect-timestamps.ts --apply
```

### B5. Cron (A7)

Start with `db-backup` (daily dump). Then follow the
[runbook's order](deploy-rose-garden-2026-09.md#7-turn-cron-jobs-on-one-per-cycle), and add
`budget-year-rollover` (new-fiscal-year reminders) once B4's remap is applied. Before the money jobs
(`auction-completion`, `trade-expiry`, `policy-maintenance`, `passive-income`), size their backlogs as the
runbook describes.

### B6. After this release

- [ ] **Test a restore** into a scratch database (the M0 exit criterion):
      ```bash
      docker exec ixstats-postgres createdb -U postgres ixstats_restore_test
      docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats_restore_test --no-owner \
        < "$(ls -t backups/ixstats-*.dump | head -1)"
      docker exec ixstats-postgres psql -U postgres -d ixstats_restore_test -c 'SELECT count(*) FROM "Country";'
      docker exec ixstats-postgres dropdb -U postgres ixstats_restore_test
      ```
- [ ] **Copy `backups/` off the server** (another host or object storage); the dumps sit on the same disk as the
      database.
- [ ] **Serve Eurth**: [runbook step 6b](deploy-rose-garden-2026-09.md#6b-serve-eurth-the-first-outside-realm).
- [ ] **CSP** — see B7.

### B7. CSP: remove the nginx override

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
