# Deploy runbook: realm time (2026-10)

The single ordered procedure for the realm time plan (`docs/superpowers/specs/2026-10-25-realm-time-design.md`):
every realm owns its clock, the platform runs on real time, the defense model runs on the nation's clock, and nations
of two realms no longer interact as countries. Every SQL file lives in `scripts/migrations/2026-10-realm-time/` and is
idempotent (a re-run changes nothing); `src/tests/architecture/realm-time-runbook.test.ts` checks that each one is
named here and that every job named in step 7 exists.

```bash
cd /ixwiki/public/projects/ixstats
run_sql() { docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < "$1"; }
```

| Step | When | What |
| --- | --- | --- |
| 1 | First | The MyCountry runbook, then the checks |
| 2 | Before the window | Backup, stop cron |
| 3 | Before the window, old build still serving | T1 clocks, the schema read-out |
| 4 | Deploy window (old build stopped) | T3, t3b, D2a, D3 combat columns, the starter forces, D1, D2b placeholder |
| 5 | Deploy window | The code deploy and the IxWorld rebuild |
| 6 | After the code | Nothing required (D1 moved into step 4); D2b placeholder |
| 7 | After the code | Cron back on, job by job |
| 8 | After the first runs | Smoke checks |
| – | If needed | Rollback |

## 1. Prerequisites

1. **The MyCountry runbook first** ([deploy-mycountry-2026-10.md](deploy-mycountry-2026-10.md)). Realm time is cut
   from `audit/mycountry`: its schema step, the `a1`/`a2` data fixes and `f-defense.sql` (which clamps
   `MilitaryUnit.readiness`, a column D2a drops) must be in place first. If both ship in one deploy: MyCountry steps 1
   to 3, then steps 2 to 4 here, then MyCountry step 4 (the deploy script) as step 5 here, then MyCountry steps 5 and
   6, then steps 7 and 8 here in place of MyCountry steps 8 and 9 (step 7 here keeps the MyCountry job order).
2. `df -h /` must show room for two dumps and a build (a full root disk puts Postgres into recovery mode).
3. The bot clock is wired (MyCountry step 6): Ixnay's clock is the bot-synced IxTime, read from the SystemConfig row
   `ixtime_clock_state` by every process, and the T1 and T3 SQL read that row too.
4. The production checkout is the realm-time merge, with `bun install` done (the deploy script builds it;
   `reset-starter-forces.ts` in step 4 runs from it).

## 2. Backup and stop cron

1. `bun run db:backup`. Keep the dump's path: it is the rollback point for every destructive step below.
2. `pm2 stop ixstats-cron`. Nothing may run between the T3 conversion and the new code: the sports and exchange jobs
   would read converted deadlines as IxTime and fire them at once, and `stat-progression` would project nations on a
   half-converted defense schema.
3. In `ecosystem.config.cjs` set `CRON_ENABLED_JOBS: ""` for `ixstats-cron` (MyCountry step 1.3 does the same), so the
   runner the deploy script starts schedules nothing until step 7.

## 3. SQL before the code (old build still serving)

1. **T1, every realm has a clock.** `run_sql scripts/migrations/2026-10-realm-time/t1-realm-clocks.sql`.
   The old build ignores `settings.clock` beyond the realm header, so this is safe while it serves. Every realm but
   Ixnay without `settings.clock` gets one, continuous with Ixnay's IxTime now (read from the `ixtime_clock_state`
   override when the bot set one), at ×2, Gregorian, with no speed cooldown. The retired in-world date keeps its year
   and era (offset mode: this year + offset; fixed label: its last number and the text after it) on today's month and
   day, and the `inWorldDate` key is removed. The final `SELECT` must print `realms_without_clock = 0`. Dry run on the
   clone `ixstats_wv1` (2026-10-25, rolled back): 3 realms updated (an offset label read "25 October 1203 AE", a fixed
   label "14 Harvest 1203 Second Age" kept 1203 and its era, a realm without a label read IxTime's date); a second
   pass updated 0 rows. After the deploy, a realm still missing its clock logs `[realm-time] Realm <id> has no clock`
   and shows Ixnay's date; its founder or site staff fix it in Manage → Time ("Set the clock").
2. **Schema read-out (introspection only, writes nothing).** The realm-time schema changes are the defense model (D2a)
   and the dropped legacy security tables (D1); T1 to T4 add no columns (realm clocks live in `Realm.settings`, JSON).
   Read the diff the deploy script's `db push` would apply:

   ```bash
   bunx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema --script > /tmp/rt-schema-diff.sql
   grep -nE '^(ALTER TABLE|CREATE|DROP)' /tmp/rt-schema-diff.sql
   ```

   Before step 4 it lists the D2a and D1 changes (`DROP TABLE "DefenseBudget"`, `ALTER TABLE "MilitaryBranch" DROP
   COLUMN "branchType"`, `CREATE TABLE "DefensePolicy"`, and so on) plus whatever the rose-garden and MyCountry
   migrations still owe. Run nothing from it for the military or security tables: `db push` refuses to drop a
   non-empty table or column without `--accept-data-loss`, which is why D2a and D1 run as SQL in step 4, before the
   push. Additive statements on other tables may be saved and run with `run_sql`, as the MyCountry runbook's step 2
   describes; the push adds any left.

## 4. The deploy window (old build stopped)

Stop every process that serves or writes with the old code: `pm2 stop ixworld` (maps.ixwiki.com, the live app), and
`ixstats` and `ixstats-ws` where they run. The site is down from here until step 5 reloads IxWorld (the build takes
several minutes): announce the window. `ixstats-cron` is already stopped (step 2).

1. **T3, platform systems on real time.** `run_sql scripts/migrations/2026-10-realm-time/t3-platform-real-time.sql`.
   It converts the exchange and sports `*IxTime` / `ixTime` Float columns from IxTime to real epoch-ms (the inverse of
   `IxTime.convertToIxTime`, honouring the bot's `ixtime_clock_state` override) and gives ThinkTank posts stamped with
   IxTime their `createdAt`. Only values above 2035-01-01 convert, so a re-run changes nothing. Dry run on the clone
   (2026-10-25, rolled back): `exchange_transactions` 46, `sport_seasons` 7, `sport_matches` 2126,
   `sport_rookie_classes` 5, `sport_teams` 18 rows; converted transaction stamps land within 1 ms of `createdAt`; a
   second pass updates 0 rows.
2. **t3b, sports intervals.** `run_sql scripts/migrations/2026-10-realm-time/t3b-sports-intervals.sql`. Sports
   intervals were IxTime days (12 real hours at ×2) and are now real days, so this halves each league's stored
   `matchIntervalDays` / `raceIntervalDays` once (marker `intervalsInRealDays`) to keep its pace. New leagues default to
   12 hours between matchdays and 1.5 days between races. On the clone: 1 league (7 → 3.5 days). The exchange keeps its
   pace without a step: its bidding window, award grace, decision delay and activity window were real days already.
3. **D2a, the defense model.** `run_sql scripts/migrations/2026-10-realm-time/d2a-defense-model.sql`. It gives
   `MilitaryBranch` a `domain` (from the old `branchType`: navy and coast guard → sea, air force → air, marines →
   marines, space force → space, everything else → land) and the model's state columns (effort share, capital,
   readiness sub-scores, mobilisation, `lastTickClockMs`; headcounts become fractional), drops `branchType`, the
   `BranchType` enum and the typed `readinessLevel`, `technologyLevel`, `trainingLevel`, `morale`, `annualBudget`,
   `budgetPercent`, `deploymentCapacity`, `sustainmentCapacity`, `MilitaryUnit.readiness` and
   `MilitaryAsset.modernizationLevel`, adds `MilitaryAsset.catalogKey`/`designYear`, `MilitaryConflict.startClockMs`,
   the `DefensePolicy` and `ProcurementOrder` tables and their enums, and **deletes free assets** (rows without a
   catalog key: every asset today; owner decision). Branch names, mottos, images and units are kept.
4. **D3, combat and economic feedback.** `run_sql scripts/migrations/2026-10-realm-time/d3-combat.sql` (right after 4.3,
   which creates `DefensePolicy`, and before the reset: the new client reads D3's policy columns). Additive and
   idempotent: `DefensePolicy.terrainProfile` (a nation's declared terrain, used where the realm map has no data) and
   `npcBurdenAdjustment` (an NPC's Richardson response, default 0); on `MilitaryConflict` the orders, their hash, the
   commit time, the HMAC seed, the inputs snapshot and the result (`outcomeBand`, `margin`, `engagementDays`); on
   `MilitaryOperation` an intervention's orders, hash, commit time, seed, snapshot and band. No data moves. Optional:
   set `COMBAT_SEED_SECRET` in `.env.production.local` (without it seeds use `CRON_SECRET`); changing either later only
   changes seeds of battles committed after.
5. **Starter forces**, from the new checkout, after D2a and D3:

   ```bash
   bun scripts/defense/reset-starter-forces.ts --apply --i-know ixstats
   ```

   The script refuses a database that is not a known clone unless `--i-know` names the database it is connected to.
   Every nation without a `DefensePolicy` gets its starter force: the equilibrium of its defense budget
   (the Defense department lines summed, else the builder's Defense figure, else its government form's Defense share of
   spending, else 2% of GDP), on its existing branches or a new army, navy and air force; NPCs get the same from their
   economy (conscript-heavy forms take the territorial split). Idempotent: nations with a policy are skipped, and a
   nation the new build reads first gets the same force lazily. The report prints the active-share distribution (sanity
   band 0.2–1.1% of population), budget sources, C-levels and sample nations. Dry run on the clone (2026-10-25, the D2a
   and D3 SQL and the reset in one transaction, rolled back; the dry run applies both files itself): 407 nations, active
   share min 0.24% / median 0.28% / max 0.47%, none outside the band; budget sources estimate 316, government form 89,
   Defense department 1, builder 1; C-2 404, C-3 3; Caphiria 1,880,297 active (0.30%), 2,256,356 reserves, 2,818bn
   capital, C-2. Stop and read the report if any nation falls outside the band.
6. **D1, legacy security tables.** `run_sql scripts/migrations/2026-10-realm-time/d1-drop-legacy-security.sql`. It
   drops `NeighborThreatAssessment`, `BorderSecurity`, `ThreatIncident`, `SecurityThreat`, `SecurityEvent`,
   `SecurityAssessment` and `DefenseBudget` (`CASCADE`, children first) and the `ThreatType`, `ThreatSeverity` and
   `ThreatStatus` enums. Nothing is migrated: the assessment and border rows were never written past their defaults,
   and the defense budget is now the nation's Defense department allocation in the National budget. Clone row counts
   (2026-10-25): `DefenseBudget` 1 (the E2E Testland test row), `SecurityAssessment` 15, `BorderSecurity` 7, the rest
   0. D1 was written to run after the code deploy (the old build reads these tables), but the old build is stopped
   here and the push in step 5 would abort on the non-empty tables, so it runs now.
7. **D2b, the Defense page.** _Placeholder: any SQL D2b adds to `scripts/migrations/2026-10-realm-time/` goes here._
8. Re-run the step 3.2 read-out: no `DROP` on military or security tables may remain.

## 5. The code deploy

Run the deploy script (rose-garden step 5): `./scripts/deploy-production.sh`. It backs up, runs the rose-garden SQL,
`db push` (stop and read the message if it reports data loss: a realm-time step was skipped), `db:generate`, the
build, `scripts/deploy-ixworld.sh` (which reloads PM2 `ixworld`, ending the window) and
`pm2 startOrReload ecosystem.config.cjs --update-env` (the cron runner starts with no jobs). Then check the rebuild:

```bash
ls -l /ixwiki/public/maps/ixworld/.next/BUILD_ID                    # dated today
pm2 describe ixworld | grep -E 'status|restarts'                    # online
grep -h "has no clock" /ixwiki/private/logs/ixworld-*.log | tail    # nothing new (T1 gave every realm a clock)
```

If `ixstats-ws` was stopped in step 4 and the deploy script did not start it, run
`pm2 start ecosystem.config.cjs --only ixstats-ws`. When both runbooks ship together, MyCountry step 5 (recreating
`ixstats-cron` and `ixstats-ws` in production mode) runs here.

## 6. SQL after the code

No realm-time SQL is left for after the code: D1, first planned here, runs in step 4 (see 4.6).

- **D2b.** _Placeholder: a post-deploy data step D2b adds goes here._
- **D3.** Nothing: the combat columns need no backfill. PvP conflicts accepted before the deploy have no seed; they
  seal from their start when concluded. The economic feedback (crowd-out, R&D spillover, labour hit, NPC
  Richardson burden) writes its keyed levels on each nation's next in-game month as its defense syncs.

## 7. Cron back on

Add one name per full cycle to `CRON_ENABLED_JOBS` in `ecosystem.config.cjs`, run
`pm2 restart ixstats-cron --update-env`, and watch `pm2 logs ixstats-cron` and `/api/health` (CronRun rows) through
one run before adding the next. `cron-runner.mjs` exits on an unknown name; the runbook test checks every name in the
line below. Bring back the rose-garden list first (rose-garden step 7), then the MyCountry jobs in MyCountry step 8's
order, with these realm-time notes:

- `sports-season-advance`, `exchange-market`, `exchange-contract-expiry`: safe once T3 and t3b ran (step 4). Sports run
  on real days now; fixtures that fell due during the window play on the first run.
- `stat-progression`: groups nations by realm and reads each realm's clock once per run. The first run writes each
  paused realm's nations once (bringing them to their realm's time) and skips them afterwards until the realm runs or
  jumps; a nation whose realm passed months without a run gets a history point for each, at most 120 per run.
- `budget-year-rollover`, `policy-maintenance`, `politics-drift`, `national-issues`, `elections`: read each realm's
  clock once per run; politics drift and issue generation skip paused realms. `budget-year-rollover` still waits for
  the MyCountry budget-year remap.
- `diplomatic-drift`: unchanged by realm time; relations across realms from before the rule still drift and expire.
- `vault-dividend`, `achievements-evaluate`, `trade-expiry`, `card-values`: platform jobs on real time, nothing to do.

With the realm-time jobs on, the line includes:

```bash
CRON_ENABLED_JOBS="sports-season-advance,exchange-market,exchange-contract-expiry,national-issues,elections,diplomatic-drift,politics-drift,policy-maintenance,achievements-evaluate,stat-progression"
```

## 8. Smoke checks

Use a non-Ixnay realm whose founder agrees, or a staff test realm; site staff skip the 7-day speed and jump
cooldowns. To read the clocks: `SELECT id, slug, settings->'clock' FROM realms;`.

1. **Two realms at different speeds.** Manage → Time on the test realm: set ×6 (preview, save). Its header date moves
   three times as fast as Ixnay's (×2). One of its nations: MyCountry shows the realm date and calendar, and after the
   next `stat-progression` run its `lastCalculated` and latest history point sit at the realm's time while an Ixnay
   nation's sit at IxTime's. The leaderboards page's realm selector ranks each realm on its own.
2. **A paused realm.** Set the speed to 0. The header reads "Paused"; the next two `stat-progression` runs write its
   nations once, then not at all (`lastCalculated` unchanged); a defense operation's countdown in that realm waits.
   Set the speed back.
3. **A jump.** Manage → Time → Jump ahead: pick a date about a year on, read the preview, confirm. The realm date
   moves; the next `stat-progression` run writes a history point per passed month; the budget year rolls (the
   National budget's year picker shows the realm calendar's year, never a bare game year on a custom calendar); due
   elections resolve on the `elections` run and read "General Election (<realm year>)".
4. **The Ixnay bot clock.**
   `docker exec ixstats-postgres psql -U postgres -d ixstats -tAc "SELECT value FROM \"SystemConfig\" WHERE key = 'ixtime_clock_state';"`
   matches the bot's time (an override shows its `timeOverride`; a natural clock shows three `null`s). An Ixnay page's
   header clock reads the bot's date; the home page and the Vault show real local time. Admin → System's epoch sync
   moves only Ixnay's nations.
5. **The cross-realm rule.** As an Ixnay nation, open a nation of the test realm: the dossier's embassy, meeting and
   proposal rows are off with "Both nations must be in the same realm"; the embassy and exchange pickers list only
   Ixnay's nations. Following and messages still work.
6. **Defense.** An owned nation's Defense page shows its starter force and a budget read from its Defense department
   line. _Placeholder: D2b's checks (levers, procurement) go here._ D3: Operations → PvNPC strike → pick a related
   NPC: the odds screen shows the factor breakdown, odds and band probabilities as ranges, and the preview (1,000
   runs); commit and the result shows the seed, band and losses; the target NPC's alert reads High afterwards.
   The effects live in the `"DmInputs"` table (the `StorytellerEffect` model's table):

   ```sql
   SELECT "createdBy", "inputType", value FROM "DmInputs"
   WHERE "createdBy" LIKE 'conflict:%' OR "createdBy" LIKE 'operation:%' OR "createdBy" LIKE 'defense:%'
   ORDER BY "createdAt" DESC LIMIT 10;
   ```

   The strike writes `conflict:<id>:casualties` (population, both sides) and `conflict:<id>:war-damage` (the target's
   GDP); an intervention writes the same under `operation:<id>:`. A nation above 2% of GDP gets `defense:crowd-out`
   once its defense has ticked a month (with `defense:rd-spillover`, `defense:labour` and `defense:collapse:<month>`
   where they apply). On the clone the strike's three rows showed; no crowd-out row did, as no nation above 2% ticked a
   month during the check.

## Rollback

- **Before step 4:** nothing to undo. T1 is harmless to the old build (it reads only the realm header); leave it.
- **From step 4 on:** T3 converts timestamps in place, D2a drops columns and deletes free assets, and D1 drops
  tables, so the way back is the step 2 dump plus the previous build: stop `ixworld`, `ixstats-cron` and `ixstats-ws`,
  restore the dump into an emptied `ixstats` database (`psql` for a plain dump, `pg_restore` for a custom-format one),
  check out the pre-realm-time commit and run the deploy script again. A partial window (some of step 4 applied, no
  code deploy) is restored the same way.
- **After the code, a job misbehaves:** remove its name from `CRON_ENABLED_JOBS` and
  `pm2 restart ixstats-cron --update-env`. A realm clock set wrong is fixed in Manage → Time (its speed, or a jump),
  never by editing `settings.clock` in SQL while the app runs (each process caches clocks for 30 seconds).
