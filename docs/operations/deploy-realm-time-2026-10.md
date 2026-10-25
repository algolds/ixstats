# Deploy runbook: realm time (2026-10)

Draft; WP-T5 owns the final shape. Each work package adds its steps under its own heading. SQL files live in
`scripts/migrations/2026-10-realm-time/` and are idempotent.

```bash
cd /ixwiki/public/projects/ixstats
run_sql() { docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < "$1"; }
```

## T1: every realm has a clock

- **Before the realm-time code is deployed** (the old build ignores `settings.clock` beyond the realm header), after
  `bun run db:backup`: `run_sql scripts/migrations/2026-10-realm-time/t1-realm-clocks.sql`. Every realm but Ixnay
  without `settings.clock` gets one, continuous with Ixnay's IxTime now (read from the `ixtime_clock_state` override
  when the bot set one), at ×2, Gregorian, with no speed cooldown. The retired in-world date keeps its year and era
  (offset mode: this year + offset; fixed label: its last number and the text after it) on today's month and day, and
  the `inWorldDate` key is removed. The final `SELECT` must print `realms_without_clock = 0`. A re-run changes
  nothing. Dry run on the clone `ixstats_wv1` (2026-10-25, rolled back): 3 realms updated (an offset label read
  "25 October 1203 AE", a fixed label "14 Harvest 1203 Second Age" kept 1203 and its era, a realm without a label
  read IxTime's date); a second pass updated 0 rows.
- After the deploy, a realm still missing its clock logs `[realm-time] Realm <id> has no clock` and shows Ixnay's
  date; its founder or site staff fix it in Manage → Time ("Set the clock").

## T3: platform systems on real time

- **In the same window as the realm-time code deploy** (between stopping the old build and starting the new one, with
  `ixstats-cron` stopped so the sports and exchange jobs don't run against half-converted rows), after
  `bun run db:backup`: `run_sql scripts/migrations/2026-10-realm-time/t3-platform-real-time.sql`. It converts the
  exchange and sports `*IxTime` / `ixTime` Float columns from IxTime to real epoch-ms (the inverse of
  `IxTime.convertToIxTime`, honouring the bot's `ixtime_clock_state` override) and gives ThinkTank posts stamped with
  IxTime their `createdAt`. Only values above 2035-01-01 convert, so a re-run changes nothing. Dry run on the clone
  `ixstats_wv1` (2026-10-25, rolled back): `exchange_transactions` 46, `sport_seasons` 7, `sport_matches` 2126,
  `sport_rookie_classes` 5, `sport_teams` 18 rows; the converted transaction stamps land within 1 ms of `createdAt`;
  a second pass updates 0 rows.
- Expect sports to run at half their old real-time pace: `matchIntervalDays` / `raceIntervalDays` and the bracket and
  playoff gaps were IxTime days (12 real hours at 2x) and are now real days. The exchange keeps its pace: its bidding
  window, award grace, decision delay and activity window were already real days scaled into IxTime.

## D1: defense budget and legacy security tables

- **After the realm-time code is deployed** (the old build still reads these tables), and after `bun run db:backup`:
  `run_sql scripts/migrations/2026-10-realm-time/d1-drop-legacy-security.sql`. It drops `NeighborThreatAssessment`,
  `BorderSecurity`, `ThreatIncident`, `SecurityThreat`, `SecurityEvent`, `SecurityAssessment` and `DefenseBudget`
  (with `CASCADE`, children first) and the `ThreatType`, `ThreatSeverity` and `ThreatStatus` enums. Row counts on the
  clone `ixstats_wv1` (2026-10-25): `DefenseBudget` 1, `SecurityAssessment` 15, `BorderSecurity` 7,
  `NeighborThreatAssessment` 0, `SecurityThreat` 0, `ThreatIncident` 0, `SecurityEvent` 0. Nothing is migrated: the
  assessment and border rows were never written past their defaults, and the one `DefenseBudget` row is replaced by
  the nation's Defense department allocation in the National budget (on the clone it is the E2E Testland test row).

## T2: nation simulation on realm clocks

- No SQL. Every stored IxTime column stays valid: each realm's clock runs on the same timeline, so budget years,
  history months and effect stamps already recorded keep their meaning.
- The first `stat-progression` run after the deploy writes each paused realm's nations once (bringing them to their
  realm's time, so `lastCalculated` marks them done) and skips them afterwards until the realm runs or jumps. A
  nation whose realm passed months with no run (a date jump, a stopped cron) gets a history point for each of them,
  at most 120 per run.
- The budget-year rollover, policy maintenance, politics drift, national-issue generation and elections jobs read
  each realm's clock once per run; politics drift and issue generation skip paused realms.
- The admin epoch sync (Admin → System) now moves only Ixnay's nations.
