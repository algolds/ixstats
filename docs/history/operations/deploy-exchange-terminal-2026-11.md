# Deploy runbook: Exchange terminal, Release 1 (2026-11)

The deploy notes for the Exchange overhaul, Release 1 ([design](../../specs/2026-11-06-exchange-overhaul-design.md),
[system doc](../../systems/exchange.md)). The Exchange becomes its own app at `/exchange`, public to watch, with nation
bonds, business news and policy headlines. **No hand-written SQL.** The schema is additive, and the deploy script
applies it.

| Step | When | What |
| --- | --- | --- |
| 1 | Before the deploy | Disk room |
| 2 | The deploy | `./scripts/deploy-production.sh` |
| 3 | After the reload | Turn the two Exchange cron jobs on |
| 4 | After the reload | Checks |
| – | If needed | Rollback |

## 1. Before the deploy

`df -h /` must show room for a dump and a build. A full root disk puts Postgres into recovery mode. The deploy script
takes its own backup (`backups/ixstats-<stamp>.dump`, now zstd).

## 2. The deploy

Promote the release to the deploy branch and run `./scripts/deploy-production.sh`
([release guide A4](../../operations/release-guide.md#a4-build-and-deploy)). The schema changes:

- **The additive step creates six tables:**
  - `exchange_nation_bonds`
  - `exchange_bond_holdings`
  - `exchange_bond_listings`
  - `exchange_news_items`
  - `exchange_nation_snapshots`
  - `exchange_watches`
- **`db push` adds two columns to `exchange_nation_treasuries`:** `creditRating` (default `A`) and `bondBanUntil`
  (nullable). The additive step leaves columns on existing tables to the push, and neither column needs a backfill.

Nothing else changes in the database. No data script runs.

## 3. Turn the cron jobs on

The market tick pays bond coupons, publishes policy headlines and moves the realm index. Without it, bonds never pay
and the front page never moves. The beta feedback release planned this change (owner ruling, 2026-10-30). Production
ran without these jobs on 2026-10-27.

1. Add `exchange-market` and `exchange-contract-expiry` to `CRON_ENABLED_JOBS` in the `ixstats-cron` app of
   `ecosystem.config.cjs`.
2. Restart the runner from the file, so it reads the new list
   ([release guide A7](../../operations/release-guide.md#a7-cron-jobs)):
   ```bash
   ( cd /ixwiki/public/projects/ixstats && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save
   pm2 jlist | jq -r '.[] | select(.name == "ixstats-cron") | .pm2_env.CRON_ENABLED_JOBS'
   ```

`exchange-market` runs at 7 minutes past every sixth hour, and `exchange-contract-expiry` every 15 minutes.

## 4. Checks

Run these signed out first, then signed in:

- [ ] `https://<host>/exchange` answers 200 signed out and shows the front page.
- [ ] `/labs/exchange?realm=default` answers 308 to `/exchange?realm=default`.
- [ ] The sidebar lists Exchange with these sections:
  - signed out: Front page, Markets, Tenders, Leaderboards;
  - signed in, add: Portfolio, My companies;
  - a nation owner also sees Treasury.
- [ ] MyCountry, Economy, Corporations: "Open the Treasury" goes to `/exchange/treasury`.
- [ ] After the first market tick:
  - `/api/health` shows `cron.exchange-market.lastStatus` as `ok`;
  - `exchange_nation_snapshots` has a row per followed nation.

  The first snapshot publishes no headlines. Policy news starts with the second tick.
- [ ] The ₷ sign renders in your browser. The interface fonts don't include it, so it falls back to a system font.

## Rollback

`scripts/deployment/rollback-deployment.sh` runs the previous release with `SKIP_SCHEMA_SYNC=1`. The six tables and two
columns are additive, and the old code ignores them, so no restore is needed unless bonds were issued and should be
undone. Old bookmarks to `/exchange` would then 404, since the old release served the Exchange at `/labs/exchange`.
