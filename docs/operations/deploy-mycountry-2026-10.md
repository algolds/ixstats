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

## Any time (before or after the code deploy)

- **WP-F, defense** (`f-defense.sql`). Clamps `MilitaryUnit.readiness` to 0-100 (deployments had no floor) and ends
  PvP challenges that can never be answered (sent to an NPC nation, or unanswered for 14 days) as `winner = 'expired'`,
  which unblocks new challenges between those pairs. The local clone had no such rows; expect 0 or a handful.
  `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-mycountry/f-defense.sql`
  No other WP-F data step: the defense budget starts empty (the card shows the 2% estimate until an owner saves one), the
  legacy `SecurityAssessment` / `BorderSecurity` rows are no longer read (all were defaults), and the equipment catalog is
  already seeded in prod (an admin's first catalog create seeds an empty one).
