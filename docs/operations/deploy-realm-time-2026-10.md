# Deploy runbook: realm time (2026-10)

Draft; WP-T5 owns the final shape. Each work package adds its steps under its own heading. SQL files live in
`scripts/migrations/2026-10-realm-time/` and are idempotent.

```bash
cd /ixwiki/public/projects/ixstats
run_sql() { docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < "$1"; }
```

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
  playoff gaps were IxTime days (12 real hours at 2x) and are now real days. Exchange bidding windows were already
  real days; the award grace (3 days) and decision delay (1 day) are now real days too (they were IxTime days).
