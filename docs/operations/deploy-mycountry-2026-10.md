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

## Any time around the code deploy

- **WP-DE, relationship standing** (`de-relation-bands.sql`). Relations an embassy opened at strength 25 and nothing
  has moved since go to 55 (where a new embassy's relation now starts: neutral with a little goodwill), and every
  relation's stored `relationship` becomes the lower-case band of its strength (`allied` ≥ 80, `friendly` ≥ 60,
  `neutral` ≥ 40, `tense` ≥ 20, else `hostile`). On the `ixstats_wv1` clone (dry run, rolled back): 12 rows moved to
  55, 4 labels changed.
  `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-mycountry/de-relation-bands.sql`
  When `diplomatic-drift` is enabled it now also expires sanctions, embargoes and blockades older than their 4-year
  IxTime effect window (their GDP effects unwind), moves cultural exchanges planning → active → completed, and pays
  completed embassy missions' rewards into their embassy. Expect a first run to expire any such action enacted before
  roughly two real years ago.
