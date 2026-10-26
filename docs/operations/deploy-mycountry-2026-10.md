# Deploy runbook: MyCountry fixes (2026-10)

The single ordered runbook for the MyCountry fix plan (`plans/mycountry-audit/fix-plan.md`). It runs inside the 1.5
release, whose order is the [release guide](release-guide.md#part-b--this-release-15-lobster-crosby-the-rose-garden-rc)'s
Part B; the environment, realms, Vault, cards and WikiOS steps belong to their own runbooks, which Part B links. Where
they meet, this one names the step to run.

What production looks like (read-only review, 2026-10-25):

- The live app is the IxWorld standalone (`/ixwiki/public/maps/ixworld`, PM2 `ixworld`, port 3002, maps.ixwiki.com),
  built 2026-08-04. The main app on port 3550 is down (no build). Every MyCountry page is served by IxWorld.
- The database lacks `CabinetMeeting."intentId"` and `MeetingAgendaItem."linkedIntentId"`, so `meetings.getMeetings`
  and the intelligence overview fail for everyone.
- `ixstats-cron` is the pre-plan-330 runner (no job leases, no MyCountry jobs). It and `ixstats-ws` run with
  `NODE_ENV=development`, so they load `.env.local.dev` and its `DATABASE_READONLY="true"`: every write is refused.

Every SQL file below is idempotent and lives in `scripts/migrations/2026-10-mycountry/`. The commands use the
container directly; `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <file>` does the same.

```bash
cd /ixwiki/public/projects/ixstats
run_sql() { docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < "$1"; }
```

## 1. Before you start

1. `df -h /` must show room for a dump and a build (a full root disk puts Postgres into recovery mode). Then
   `bun run db:backup`.
2. Stop the old cron runner before anything else writes: `pm2 stop ixstats-cron`. It predates the job leases, so
   beside the new runner auctions, trades and card values would run twice. Its jobs come back one per cycle in step 8.
3. In `ecosystem.config.cjs` (git-ignored, copied from `ecosystem.config.example.cjs`), set `NODE_ENV: "production"`
   for `ixstats-cron`, `ixstats-ws` and `ixstats-ixtwitter`, and `CRON_ENABLED_JOBS: ""` for `ixstats-cron`. The deploy
   script (step 4) reloads these apps from this file, and the new runner exits on any unknown job name left in an old
   list (`passive-income`, `scheduled-changes`, `lorewards-state-sync`).

## 2. Schema: the additive columns production lacks (P0-02)

Run this first. The old build never reads these columns, so it is safe while IxWorld still serves the August build,
and it ends the live `meetings.getMeetings` / `intelCore.getOverview` errors at once:

```bash
run_sql scripts/migrations/2026-10-mycountry/h-meeting-intent-columns.sql
```

It adds `CabinetMeeting."intentId"` and `MeetingAgendaItem."linkedIntentId"` with their indexes and `ON DELETE SET
NULL` foreign keys to `intents`. Check that this returns 2 rows:

```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE column_name IN ('intentId', 'linkedIntentId') AND table_name IN ('CabinetMeeting', 'MeetingAgendaItem');
```

The file was written from the local clone (`ixstats_wv1`), which already has both columns, so production may lack
more. Produce the real diff on the production box (introspection only, it writes nothing) and read it before the
deploy:

```bash
bunx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema --script > /tmp/prod-schema-diff.sql
grep -nE '^(ALTER TABLE|CREATE|DROP)' /tmp/prod-schema-diff.sql
```

Do not pick statements out of it by hand. `bun scripts/deployment/apply-additive-schema.ts` (a dry run) lists the
additive part the deploy applies first, and `--apply` applies it in one transaction; it leaves every `DROP`, enum change
and conversion to the SQL files and `db push`, which the deploy script runs in order. The deploy runs that step itself
(step 4); running it here first, with the old build stopped, only shortens the time the old build errors, and it is what
the hand SQL of step 3 needs on a database that lacks the columns those files read (`f-defense.sql` reads
`Country."ownerUserId"`, which the Realms schema adds). On the clone the MyCountry part of the diff was only what steps
3.1 and 3.2 already do (`GovernmentStructure."componentMetricsSnapshot"`, the `politicalStability` default of 50,
`Country."baselineDate"` without a default).

## 3. Data fixes, in order

The deploy script runs every file below, in this order, right before its `db push` (step 4), so running them by hand
first is optional; each is a no-op once applied. Run them by hand only after the additive step (step 2) and the Realms
ownership backfill ([release guide B3](release-guide.md#b3-the-window-the-app-stopped), step 8): `f-defense.sql` ends every
proposed PvP challenge whose defender has no owner, and before the backfill no nation has one.

1. **a1, engine effects** (`a1-storyteller-effects.sql`). Before the new code starts: it adds
   `GovernmentStructure."componentMetricsSnapshot"`, which the code reads. It retires StorytellerEffect (`DmInputs`)
   rows no engine reads (transport, resource, Technocrats/Party/Generals broker rows, the unkeyed pre-level
   `[GovComponent]`/`[BrokerComponent]` rows), converts active growth-type rows (`gdp_adjustment`,
   `growth_rate_modifier`, `economic_policy`, `population_adjustment`, admin world-event types) to level effects, and
   re-stamps active rows written with wall-clock time with their IxTime.
   `run_sql scripts/migrations/2026-10-mycountry/a1-storyteller-effects.sql`
   Expect MyCountry GDP to move for nations with sanctions, embargoes, trade agreements, alliances, wars, operations
   or election results: those effects start applying now, phased in over their duration.

2. **a2, units and scales** (`a2-units-and-scales.sql`). Right after a1 and before the new code starts: the old code
   clamps political stability to 0-1 and would undo the conversion, so keep the time between this step and step 4
   short. `run_sql scripts/migrations/2026-10-mycountry/a2-units-and-scales.sql`
   It converts fraction `inflationRate` rows to percent and nulls the corrupt ones (about 1e-34), restores the legacy
   corrupt `adjustedGdpGrowth`/`actualGdpGrowth` values (3e-34 becomes 0.03) and nulls the corrupt
   `realGDPGrowthRate`, moves `GovernmentStructure.politicalStability` (and its `componentMetricsSnapshot` shift) from
   0-1 to 0-100 with a column default of 50, re-stamps the `baselineDate` rows that the old default wrote in wall-clock
   time with their IxTime, and drops that default. Expect MyCountry inflation to show the stored figure (every read
   showed a fixed 0.02), and the "Foreign investment boom" and "Crisis mediation" issues to become possible. On the
   clone: 3 inflation rows converted, 3 nulled, 5 growth rows restored, 16 stability rows (0.35-0.6 became 35-60), 3
   baselines re-stamped (the E2E and test nations, 2026 became 2041-2042).

3. **B2 and G**: no SQL (both merged into `audit/mycountry`, ac1207b2d, without a data step).
   _Placeholder: a file a later merge adds to `scripts/migrations/2026-10-mycountry/` goes here, in order._

4. **de, relationship standing** (`de-relation-bands.sql`). Any time. Relations an embassy opened at strength 25 that
   nothing has moved since go to 55 (where a new embassy's relation now starts), and every relation's stored
   `relationship` becomes the lower-case band of its strength (`allied` ≥ 80, `friendly` ≥ 60, `neutral` ≥ 40,
   `tense` ≥ 20, else `hostile`). Clone dry run: 12 rows moved to 55, 4 labels changed.
   `run_sql scripts/migrations/2026-10-mycountry/de-relation-bands.sql`

5. **f, defense** (`f-defense.sql`). Any time. Clamps `MilitaryUnit.readiness` to 0-100 and ends PvP challenges that
   can never be answered (sent to an NPC nation, or unanswered for 14 days) as `winner = 'expired'`. The clone had no
   such rows. No other defense data step: the defense budget starts empty (the card shows the 2% estimate until an
   owner saves one), the legacy `SecurityAssessment` / `BorderSecurity` rows are no longer read, and the equipment
   catalog is already seeded.
   `run_sql scripts/migrations/2026-10-mycountry/f-defense.sql`

6. **r1, sanctions in force** (`r1-coercive-fp-effects.sql`). Any time; run it again after the code deploy if a
   sanction, embargo or blockade was imposed in between. Re-values the GDP level effects of the coercive actions
   still in force with the new rule: the target takes the main hit (moderate sanction between equal economies:
   target -1%, initiator -0.25%), both scaled by relative size. The old rule charged the initiator 0.5-1.2% and the
   target a few millionths. Lifting or expiry still unwinds them exactly. Clone dry run (read-only preview): 2
   actions, Maresteyn's severe sanction on Varshan (target -1.05%, initiator -0.53%) and Caphiria's moderate embargo
   on Pelaxia (target -3%, initiator -0.19%), one effect row per side each.
   `run_sql scripts/migrations/2026-10-mycountry/r1-coercive-fp-effects.sql`

## 4. Code deploy and the IxWorld rebuild

Run the deploy script, `./scripts/deploy-production.sh` ([release guide A4](release-guide.md#a4-build-and-deploy)). It
runs this runbook's data SQL (and the realm-time runbook's) right before its `db push`; each file is a no-op once
applied, so steps run by hand above change nothing there. In order it runs `db:generate`, the backup, the additive schema
step, the WikiOS proof check, the migration SQL files, `db push` (stop and read the message if it reports data loss), the
build, `scripts/deploy-ixworld.sh`, `pm2 startOrReload ecosystem.config.cjs --update-env` (which starts the new
`cron-runner.mjs` with no jobs), and the web app.

The live app is IxWorld, so the fixes reach players only when IxWorld is rebuilt. Check that it was:

```bash
ls -l /ixwiki/public/maps/ixworld/.next/BUILD_ID      # dated today, not 2026-08-04
pm2 describe ixworld | grep -E 'status|restarts'      # online
```

If the date did not move, run `./scripts/deploy-ixworld.sh` yourself. It builds with an empty base path, rsyncs the
standalone output into `/ixwiki/public/maps/ixworld`, reloads PM2 `ixworld`, and rolls back if the health check fails.

## 5. Recreate `ixstats-cron` and `ixstats-ws` in production mode (P0-03)

PM2 keeps a process's original environment across restarts. Delete both and start them again from the file, so
nothing of the `NODE_ENV=development` processes survives:

```bash
node -e 'for (const a of require("./ecosystem.config.cjs").apps) console.log(a.name, a.env.NODE_ENV, a.env.CRON_ENABLED_JOBS ?? "")'
#   expect every app "production", and ixstats-cron with an empty job list
pm2 delete ixstats-cron ixstats-ws
pm2 start ecosystem.config.cjs --only ixstats-cron,ixstats-ws
pm2 save
pm2 jlist | python3 -c "import sys,json;[print(p['name'],p['pm2_env'].get('NODE_ENV')) for p in json.load(sys.stdin) if p['name'].startswith('ixstats')]"
```

In production mode `load-env.mjs` reads `.env.production.local`, `.env.local`, `.env.production` and `.env`, never
`.env.local.dev`. Make sure no prod process can run read-only:

```bash
grep -n DATABASE_READONLY .env.production.local .env.local .env.production .env 2>/dev/null   # expect nothing, or "false"
mv .env.local.dev .env.local.dev.disabled 2>/dev/null || true                                    # nothing in prod should read it
pm2 logs ixstats-cron --lines 30 --nostream   # "CRON_ENABLED_JOBS is empty — no jobs scheduled", no import errors
pm2 logs ixstats-ws --lines 30 --nostream     # no "[READ-ONLY MODE]" lines
```

## 6. The bot clock (P1-32)

IxTime used to follow the Discord bot only in the web process the bot pushed to; the cron runner and a restarted web
process ran the canonical clock. Now the process that adopts the bot's clock writes it to the SystemConfig row
`ixtime_clock_state`, the web processes reload it at most every 30 seconds, and the cron runner reloads it before every
job (`src/lib/ixtime/shared-clock.ts`).

1. The bot must reach a running web process: `/api/ixtime/sync-from-bot` needs `IXTIME_BOT_SECRET` in production, and
   the bot's sync URL must point at a process that is up (IxWorld on 3002 while 3550 is down). One process is enough.
2. If the bot runs a time or speed override (audit open question 8), push it once after the deploy (the bot's time sync
   command, or Admin → Bot → Sync), then check the row:
   `docker exec ixstats-postgres psql -U postgres -d ixstats -tAc "SELECT value FROM \"SystemConfig\" WHERE key = 'ixtime_clock_state';"`
   A paused or set clock shows its `timeOverride`; a natural clock shows all three values `null`.
3. No row means the bot never pushed an override: every process runs the canonical clock, which is correct.

## 7. Stat-progression dry run on a production copy

`stat-progression` rewrites every country's stored figures on its first run. Size it on a copy taken after steps 2 and
3 (or apply a1 and a2 to the copy). The copy needs about the database's size in free disk:

```bash
docker exec ixstats-postgres psql -U postgres -tAc "SELECT pg_size_pretty(pg_database_size('ixstats'));"
df -h /
docker exec ixstats-postgres createdb -U postgres ixstats_dryrun
docker exec ixstats-postgres sh -c 'pg_dump -U postgres ixstats | psql -q -U postgres ixstats_dryrun'
DATABASE_URL="$(echo "$DATABASE_URL" | sed -E 's#/ixstats(\?|$)#/ixstats_dryrun\1#')" \
  bun scripts/cron/dry-run-stat-progression.ts
docker exec ixstats-postgres dropdb -U postgres ixstats_dryrun
```

The script only reads, and exits once it has printed. It projects every country the way the job does (on the shared
clock) and prints how many rows the run would write, the economic and population tier change counts with one
`tier change:` line per nation (each economic tier change posts an activity-feed milestone), the median GDP change and
the ten largest. On the local clone, before a1/a2: 406 of 407 rows, median total
GDP +0.20%, 0 economic tier changes, 5 population tier changes; the two E2E nations jumped about 87% because their
baselines were wall-clock dates, which a2 re-stamps. Look at any owned nation with a large jump or an economic tier
change before enabling the job.

## 8. Turn the jobs on

Add one name per full cycle to `CRON_ENABLED_JOBS` in `ecosystem.config.cjs` and run
`pm2 restart ixstats-cron --update-env`; watch `pm2 logs ixstats-cron` and `/api/health` (CronRun rows) through one run
before adding the next. `cron-runner.mjs` exits on an unknown name (`resolveEnabledJobs`, `src/server/cron/jobs.ts`);
`src/tests/architecture/runbook-cron-jobs.test.ts` checks that every name in this file and in the rose-garden list
exists. Bring the old runner's jobs back first, in the rose-garden step 7 order, then the MyCountry jobs in this order:

| Job | Verdict | What the first run does |
| --- | --- | --- |
| `national-issues` | Safe, and now required | The issue inbox no longer generates on read (P2-11), so without this job no new issues appear. Every 30 min, owned nations only, bounded by `maxIssuesPerWeek` and a per-country spacing; off when `ISSUES_AUTO_GENERATE=false`. Growth-triggered templates read the realised growth from the latest history point (so after `stat-progression` has run once). |
| `elections` | Safe | Overdue `upcoming` elections resolve once (`max(soon, last + term)` prevents back-to-back elections); legislatures with nothing queued get one after the first-election delay. |
| `diplomatic-drift` | Safe after WP-DE (run `de-relation-bands.sql` first) | Half-point steps round at random, so relations above 50 revert. It also expires sanctions, embargoes and blockades older than their 4-year IxTime window (their GDP effects unwind), moves cultural exchanges planning → active → completed, pays completed embassy missions into their embassy and expires stale proposals. Expect actions enacted before roughly two real years ago to expire. |
| `politics-drift` | Safe after WP-A1 (re-checked) | Political metrics are recomputed from the founding base plus components and event deltas (no compounding); component and broker GDP effects are level effects upserted in place, one per category, phased in over 5 IxTime years. The first run writes them for every owned nation with components: announce that government components now move GDP. Party support drift still reads the static `adjustedGdpGrowth` (follow-up). |
| `policy-maintenance` | Safe | `Policy.expiryDate` is a wall-clock `DateTime`, and `expireLapsedPolicies` compares it with wall-clock `new Date()`: the same units. Only the optional `policies.create` input sets it (no UI sends it), and the clone has no policy with one. Size it: `SELECT count(*) FROM "Policy" WHERE status IN ('active','suspended') AND "expiryDate" <= now();` (those expire on the first run and their effects end). Maintenance is a ledger entry of spending within the budget year (WP-B1), once per policy per year, never a debit of `totalBudget`. |
| `achievements-evaluate` | Safe (not re-audited here) | Evaluates up to 500 users seen in the last 90 minutes, hourly. |
| `stat-progression` | Safe after `bun run db:backup` and step 7 | Writes every country's stored figures and one history point per IxTime month; reruns are idempotent. It also evaluates intelligence alert thresholds for countries that have them (P1-08), so owners with thresholds may get alerts on the first run. |
| `budget-year-rollover` | **Not yet** | Needs the budget-year remap (below). |

With all of them on, the MyCountry part of the list (after the rose-garden names, comma-joined) is:

```bash
CRON_ENABLED_JOBS="national-issues,elections,diplomatic-drift,politics-drift,policy-maintenance,achievements-evaluate,stat-progression"
```

**The budget-year remap.** `BudgetAllocation.budgetYear` rows written before MC-1 hold real calendar years (the clone:
2025 ×15, 2026 ×10), but the app's budget year is the IxTime game year (`currentBudgetYear()`, FY2042 today). Budgets
still display (the budget in effect is the latest year at or before FY2042), but `budget-year-rollover` would see every
budget as years behind and send every owner a "set your FY2042 budget" notification. The remap moves each legacy row
forward by (IxTime year minus real year), so a 2026 budget becomes FY2042, and reports any department that already
holds the target year. Its tool was retired on 2026-10-21; restore it, dry-run, apply, remove it, then add
`budget-year-rollover`:

```bash
docker exec ixstats-postgres psql -U postgres -d ixstats -tAc 'SELECT "budgetYear", count(*) FROM "BudgetAllocation" GROUP BY 1 ORDER BY 1;'
git checkout 65fd9dcdc^ -- scripts/migrations/remap-budget-years.ts scripts/migrations/budget-year-remap-plan.ts
bun scripts/migrations/remap-budget-years.ts            # dry run
bun scripts/migrations/remap-budget-years.ts --apply
git rm -qf scripts/migrations/remap-budget-years.ts scripts/migrations/budget-year-remap-plan.ts
```

If every row is already 2041 or later, skip the remap.

## 9. Smoke checks

- `/mycountry` on maps.ixwiki.com: the overview loads; Politics lists cabinet meetings (no `intentId` error in
  `/ixwiki/private/logs/ixworld-error.log`); the intelligence overview loads.
- Settings: renaming the nation and saving a flag work. `countries.update` takes only `name` and `flag` now; the admin
  country panel saves through `countries.adminUpdate` (P0-01).
- The issues inbox: opening it creates nothing; new issues arrive from `national-issues`.
- After `stat-progression` has run: rankings match MyCountry's figures, and an owner with a threshold set sees an alert
  on the overview when a figure breaches it.

## Rollback

Restore the step 1 backup if a data step went wrong (the a1/a2 conversions are not reversible in place). The schema
step is additive and can stay. Going back to the old code takes `scripts/deployment/rollback-deployment.sh` with
`--restore` ([release guide](release-guide.md#rollback)), never the old commit's own deploy script, which would push the
older schema. To stop a job, remove its name from `CRON_ENABLED_JOBS` and
`pm2 restart ixstats-cron --update-env`.
