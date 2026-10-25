# Deploy runbook: MyCountry fixes (2026-10)

Data fixes for the MyCountry fix plan (`plans/mycountry-audit/fix-plan.md`). Each step is an idempotent SQL file under
`scripts/migrations/2026-10-mycountry/`. Take a `db:backup` first. WP-H owns the final shape of this runbook.

## Before the code deploy

1. **WP-A1, engine effects** (`a1-storyteller-effects.sql`). Run it before the new code starts: the code reads the new
   `GovernmentStructure."componentMetricsSnapshot"` column. It adds that column, retires StorytellerEffect (`DmInputs`)
   rows no engine reads (transport, resource, Technocrats/Party/Generals broker rows, the unkeyed pre-level
   `[GovComponent]`/`[BrokerComponent]` rows), converts active growth-type rows (`gdp_adjustment`,
   `growth_rate_modifier`, `economic_policy`, `population_adjustment`, admin world-event types) to level effects, and
   re-stamps active rows written with wall-clock time with their IxTime.
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-mycountry/a1-storyteller-effects.sql`
   Expect MyCountry GDP to move for nations with sanctions, embargoes, trade agreements, alliances, wars, operations
   or election results: those effects start applying now, phased in over their duration.

2. **WP-A2, units and scales** (`a2-units-and-scales.sql`). Run it right after step 1 and before the new code starts:
   the old code clamps political stability to 0-1 and would undo the conversion.
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-mycountry/a2-units-and-scales.sql`
   It converts fraction `inflationRate` rows to percent and nulls the corrupt ones (about 1e-34), restores the
   legacy corrupt `adjustedGdpGrowth`/`actualGdpGrowth` values (3e-34 becomes 0.03) and nulls the corrupt
   `realGDPGrowthRate`, moves `GovernmentStructure.politicalStability` (and its `componentMetricsSnapshot` shift) from
   0-1 to 0-100 with a column default of 50, re-stamps the `baselineDate` rows that default wrote in wall-clock time
   with their IxTime, and drops `Country.baselineDate`'s wall-clock default. The schema
   carries the same two default changes, so run `db:generate` with the deploy. Expect MyCountry inflation to show the
   stored figure (every read showed a fixed 0.02), and the "Foreign investment boom" and "Crisis mediation" issues to
   become possible for nations with political stability above 50. On the clone: 3 inflation rows converted, 3
   nulled, 5 growth rows restored, 16 stability rows (0.35-0.6 became 35-60), 3 baselines re-stamped (the E2E and
   test nations, 2026 became 2041-2042).

## Any time (before or after the code deploy)

- **WP-F, defense** (`f-defense.sql`). Clamps `MilitaryUnit.readiness` to 0-100 (deployments had no floor) and ends
  PvP challenges that can never be answered (sent to an NPC nation, or unanswered for 14 days) as `winner = 'expired'`,
  which unblocks new challenges between those pairs. The local clone had no such rows; expect 0 or a handful.
  `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-mycountry/f-defense.sql`
  No other WP-F data step: the defense budget starts empty (the card shows the 2% estimate until an owner saves one), the
  legacy `SecurityAssessment` / `BorderSecurity` rows are no longer read (all were defaults), and the equipment catalog is
  already seeded in prod (an admin's first catalog create seeds an empty one).
