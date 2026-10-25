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

## D2a: defense model core

- **In the deploy window** (old build stopped: it reads the dropped columns; new build not started: it reads the new
  ones; `ixstats-cron` stopped), after `bun run db:backup`:
  `run_sql scripts/migrations/2026-10-realm-time/d2a-defense-model.sql`. It gives `MilitaryBranch` a `domain`
  (from the old `branchType`: navy and coast guard → sea, air force → air, marines → marines, space force → space,
  everything else → land) and the model's state columns (effort share, capital, readiness sub-scores, mobilisation,
  `lastTickClockMs`; headcounts become fractional), drops `branchType`, the `BranchType` enum and the typed
  `readinessLevel`, `technologyLevel`, `trainingLevel`, `morale`, `annualBudget`, `budgetPercent`,
  `deploymentCapacity`, `sustainmentCapacity`, `MilitaryUnit.readiness` and `MilitaryAsset.modernizationLevel`, adds
  `MilitaryAsset.catalogKey`/`designYear`, `MilitaryConflict.startClockMs`, the `DefensePolicy` and
  `ProcurementOrder` tables and their enums, and **deletes free assets** (rows without a catalog key: every asset
  today; owner decision). Branch names, mottos, images and units are kept. A re-run changes nothing.
- Then, from the new build's checkout (same window): `bun scripts/defense/reset-starter-forces.ts --apply`. Every
  nation without a `DefensePolicy` gets its starter force: the equilibrium of its defense budget (the Defense
  department lines summed, else the builder's Defense figure, else its government form's Defense share of spending,
  else 2% of GDP), on its existing branches or a new army, navy and air force; NPCs get the same from their economy
  (conscript-heavy forms take the territorial split). Idempotent: nations with a policy are skipped, and a nation the
  new build reads first gets the same starter force lazily. The report prints the active-share distribution (sanity
  band 0.2–1.1% of population), budget sources, C-levels and sample nations.
- Dry run on the clone `ixstats_wv1` (2026-10-25, `bun scripts/defense/reset-starter-forces.ts`, the SQL and the
  reset inside one transaction, rolled back; `DefensePolicy` absent and `readinessLevel` still present afterwards):
  407 nations reset, active share min 0.24% / median 0.28% / max 0.47%, none outside the band; budget sources
  estimate 316, government form 89, Defense department 1, builder 1; C-2 404, C-3 3. Caphiria 1,880,297 active
  (0.30%), 2,256,356 reserves, 2,818bn capital, C-2 (3.63% of GDP from its form's share of recorded spending); E2E
  Testland 14,205 active (0.28%), 17,045 reserves, 7.9bn, C-2 (its 3bn Defense line); Iles Evangeline (1.5M, military
  government) 7,085 active (0.47%), 101,746 reserves, C-2; Rapa Rapa (5,635 people) 16 active.
- Expect the realm clocks to log `[realm-time] Realm <id> has no clock` on a database without the T1 SQL; the
  defense sync then reads Ixnay's clock for those nations.
