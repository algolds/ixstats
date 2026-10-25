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
