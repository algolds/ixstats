# IxnayID identity and Lorewards deploy runbooks (release 1.5)

> **Ran on production 2026-10-26/27 as part of release 1.5.** Kept as the record of what was run. The live system is
> described in [ixnayid-passport.md](../../systems/ixnayid-passport.md) and [achievements.md](../../systems/achievements.md).

## IxnayID identity deploy runbook (owner)

Plan A ships as one deploy (plan B, Lorewards, follows). Nothing here runs from a development machine; every command runs
in the production app directory. The conversion, the removal SQL and the tag backfill write; the counts and the dry runs
only read.

1. **Before: counts and the conversion dry run.** Check the release out on the server without deploying it (the same
   `git fetch` and `git reset --hard FETCH_HEAD` the deploy script starts with; the running app is not touched), then:

   ```bash
   bun scripts/identity/count-legacy-identity.ts > ~/ixnayid-counts-before.json   # read-only
   bun scripts/identity/convert-wiki-name-claims.ts                                # dry run: prints the plan, writes nothing
   ```

   In the counts, read:
   - `hiddenUsersWithNames`: players who had `showWikiAttribution` off. Their converted claims start hidden and stay
     private until each player turns the name on in Settings.
   - `contestedNames`: names two or more accounts hold or asked for (on the `ixstats_cards` clone: `Heku`).
   - `links`: verified by token, by an administrator, by a system owner, and unverified.

   In the dry run, read `conflicts` (a contested name becomes a `PENDING` claim for each account, none approved), the
   skips (`EXISTS`, `NAME_TAKEN`, `INVALID`) and the counts by note. A verified link becomes an `APPROVED` claim that
   keeps who verified it; its imported MediaWiki groups pass only when the account proved the link with its own token or
   a system owner confirmed it (an administrator's confirmation converts with `rightsPass` off). A link confirmed by hand
   before `wiki_account_links."verifiedById"` existed reads as self-proved, so record its confirming admin first
   ([wikios-v1-cutover.md](wikios-v1-cutover.md) step 1b). An unverified link or a legacy `wikiUsername`
   becomes `PENDING`. Settle anything surprising after the deploy in Admin, Users, Name claims:
   approve the right claim of a contested name and reject the others.

2. **Deploy.** `scripts/deploy-production.sh` runs, before `db push`, in order: the claims SQL
   (`20261103120000_ixnayid_claims`, additive), the conversion with `--apply` (claims plus one
   `WIKI_NAME_CLAIMS_CONVERTED` audit row; a re-run writes nothing, and a revoked or rejected claim never comes back),
   then the removal SQL (`20261103120001_ixnayid_drop_legacy`: deletes the IxWiki `wiki_account_links` rows; it refuses
   to run while one is there and the conversion left no marker). The deploy's `db:backup` dump comes first and is the
   way back. `"User"."wikiUsername"`, `"wikiUserId"` and `"lastWikiSync"` stay for this release: the old app reads every
   User column while the new one builds, and the new schema keeps them as `@ignore` fields it never reads.

   Then check that both partial unique indexes are there. Prisma 6.19's push never reads partial indexes, so it leaves
   them alone; if either is missing anyway, re-apply the claims SQL (idempotent):

   ```bash
   docker exec -i ixstats-postgres psql -U postgres -d ixstats -c '\d wiki_name_claims'
   # lists wiki_name_claims_one_approved_key and wiki_name_claims_one_pending_key
   bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261103120000_ixnayid_claims/migration.sql
   ```

3. **Tag the claimed names' past revisions, once.** The conversion tags nothing, so the converted approved claims' old
   edits still have no author:

   ```bash
   bun scripts/identity/tag-claimed-revisions.ts           # dry run: each approved claim and how many revisions it would tag
   bun scripts/identity/tag-claimed-revisions.ts --apply   # tags; a second --apply tags 0
   ```

   Claims approved in the app later tag their own revisions, so this is a one-off. **`--undo`** takes back **every**
   live tag, not only this run's: the tags of claims approved or linked in the app since, and of revisions the inbound
   sync tagged, too. The claims stay approved and the revisions keep their text; only `authorId` returns to null, so
   contributions lose those edits until `--apply` is run again, which puts back every approved claim's tags. Use it
   only to back the whole backfill out.

4. **The curated alt.** The removed `KNOWN_WIKI_ALTS` mapped `Carthinova` (and `ixnet>Drunk Uncle Kir`) to `Kir`. Link
   `Carthinova` to Kir's account by hand: Admin, Users, Name claims, **Link an old name**. Make the link as a system
   owner if the name's imported groups should pass. The `ixnet>` name is an import label, not a claimable name.

5. **The handle cache is per process.** When a player picks a handle (`ixnayid.setHandle`, also from the WikiOS
   first-save dialog), the request-context cache entry for them is cleared only in the process that served the pick;
   another process keeps its cached copy for up to 5 seconds and would refuse their save as handle-less meanwhile. That
   is fine while production runs one app process; if it ever runs several, expect that short window.

6. **After.** Run the counts again (`bun scripts/identity/count-legacy-identity.ts > ~/ixnayid-counts-after.json`):
   `revisionsWithAuthorId` grows by the tagged revisions, and the IxWiki link counts read 0 (the legacy column values
   stay until the next release drops them). Check a few approved names: `User:<name>` opens the passport, and contributions list the old edits.

7. **The external Discord bot** (`/ixwiki/shared/bots/discord`, outside this repo) needs no change unless it reads the
   old link data straight from the database: check with
   `grep -rnE "wiki_account_links|wikiUsername|wikiUserId" /ixwiki/shared/bots/discord --include=*.js`. A read of
   `"User"."wikiUsername"` or of IxWiki `wiki_account_links` rows now fails or finds nothing; read approved
   `wiki_name_claims` instead (`status = 'APPROVED'`, and `visible` for anything shown in public). If it logs in to
   WikiOS's `/w/api.php` with a bot password, its old wiki-name login keeps working as an alias of the owner's handle.

8. **The next release drops the legacy columns.** Once this release runs in production, delete the three `@ignore`
   lines (`wikiUserId`, `wikiUsername`, `lastWikiSync`) from `model User` in `prisma/schema/core.prisma` and add, before
   the push in `scripts/deploy-production.sh` and the dev chain, an idempotent SQL file with
   `ALTER TABLE "User" DROP COLUMN IF EXISTS` for each. The app then running no longer reads them, so dropping them
   before the build is safe.

---

## Lorewards deploy runbook (owner)

Plan B (Lorewards) goes out in the same deploy as plan A and has no SQL. Nothing here runs from a development machine;
every command runs in the production app directory, and the read-only checks run with
`docker exec ixstats-postgres psql -U postgres -d ixstats -c "<query>"`. Steps 1 and 2 run before the deploy, once the
release is checked out on the server (plan A's step 1; the running app is not touched); step 3 needs the release's
schema, so it runs inside the deploy, once the schema is in place and before the new server serves.

1. **Before: counts and duplicate spellings.** Keep these counts for step 9:

   ```sql
   select type, date ~ '^\d{4}-W\d{2}$' as iso, count(*) from loreward_entries group by 1,2;
   select count(*) from cards where "lorewardEntryId" is not null;
   select count(*), sum(credits) from vault_transactions where source like 'bonus:loreward:%';
   ```

   Then look for one name kept under two spellings in the stats table:

   ```sql
   SELECT lower(replace(username,'_',' ')), count(*), string_agg(username,' | ') FROM loreward_user_stats GROUP BY 1 HAVING count(*)>1;
   ```

   The Passport stat and the Lorewards achievements add up every spelling of a name (`lorewardStatsOfNames`), so a
   stale duplicate counts twice. Wins add up correctly, since each row counts only the entries recorded under its own
   spelling, but `totalScore` comes from the main OOL page, and a row left under an older spelling keeps its old score.
   Merge each pair the query finds: keep the spelling the OOL page uses now, and delete the other row (or set its
   `totalScore` to 0 while entries still record that spelling). `lower()` also pairs names that differ in case after
   the first letter, which MediaWiki treats as different people: leave those. The `ixstats_cards` clone has none.

   Then look for bot monthlies with no range. The new webhook gives a monthly keyed `YYYY-MM` its first and last day
   (UTC), so it is the same contest as the OOL page's `YYYY-MM-01` row; a row stored before has none:

   ```sql
   SELECT id, date FROM loreward_entries WHERE type='monthly' AND date ~ '^\d{4}-\d{2}$' AND "dateStart" IS NULL;
   ```

   Each row found is a second contest for its month and needs an admin fix. The clone has none.

   Then look for stats rows with points and no place (read-only): they show in the standings with nothing behind them.
   On the clone, Castadilla (778 points, no entry anywhere) was a fixture and was deleted there:

   ```sql
   SELECT username, "totalScore", "dailyWins", "dailyRunnerUps", "weeklyWins", "monthlyWins" FROM loreward_user_stats
   WHERE "totalScore" > 0 AND "dailyWins" + "dailyRunnerUps" + "weeklyWins" + "monthlyWins" = 0 ORDER BY "totalScore" DESC;
   ```

   Before deleting a row, check that no `loreward_entries` row names it as winner or runner-up; a real name with points
   and no place yet is fine.

2. **The old endpoint and the cron runner.** `/api/lorewards/sync` is deleted. Look for a call to it in the server's
   crontab and remove the line:

   ```bash
   crontab -l | grep -n "lorewards/sync"
   grep -rn "lorewards/sync" /etc/cron.d /etc/crontab
   ```

   (`/api/bot/lorewards/sync` is the bot webhook and stays.) Then stop the cron runner, `pm2 stop ixstats-cron`, so the
   old 10-minute state sync stops writing date-keyed weekly rows while the merge runs, and change its job list for the
   new code: in `ecosystem.config.cjs`, replace `lorewards-state-sync` with `lorewards-ool-backfill` in
   `CRON_ENABLED_JOBS` and keep `lorewards-full-sync`. The deploy starts it again (step 5).

3. **The weekly merge, after the schema and before the new code goes live** (release guide B3 step 10: its client reads
   `loreward_entries."overriddenAt"` and `cards."lorewardEntryId"`, which the deploy's cards SQL creates). The new
   syncs key every weekly by its UTC ISO week, so merge the date-keyed rows first:

   ```bash
   bun scripts/lorewards/merge-weekly-keys.ts           # dry run: prints counts, skipped and folds as JSON, writes nothing
   bun scripts/lorewards/merge-weekly-keys.ts --apply   # applies each merge in its own transaction
   bun scripts/lorewards/merge-weekly-keys.ts           # again: 0 merges
   ```

   Read `skipped` in the dry run: each week it leaves alone, with the reason (`different first days`,
   `different holders`, `paid twice`, `carded twice`, `overridden or not approved`, `no first day`). On the clone the
   merge made 211 merges and skipped five weeks: 2024-W20, 2026-W01, 2026-W13, 2026-W14 and 2026-W18. Production may
   differ, so work from its own list. Each skipped week is settled by an admin override in step 6.

4. **Deploy.** `scripts/deploy-production.sh`, with plan A's steps (plan B adds no SQL).

5. **Cron.** The deploy script's `pm2 startOrReload ecosystem.config.cjs --update-env` starts the cron runner with the
   list from step 2 (if it did not,
   `( cd /ixwiki/public/projects/ixstats && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save`, not a restart by name, which keeps the old list; read it back with
   `pm2 jlist | jq -r '.[] | select(.name == "ixstats-cron") | .pm2_env.CRON_ENABLED_JOBS'`). The OOL backfill runs hourly at
   `20 * * * *` (the current year's OOL page, then it settles what it wrote); the full sync runs at 06:00 UTC. The
   runner exits on any unknown name left in the list (`[Cron] FATAL: unknown job name(s)`), so check
   `pm2 logs ixstats-cron` after the restart.

6. **Skipped weeks.** Run the merge's dry run again: the old app, until the restart, could still write a date-keyed
   weekly (the old webhook, or the OOL read inside a page view), so apply again if it plans any merge. Then settle each
   skipped week in Admin, Bot, Lorewards, **Manual winner override tool**: an override of the week's winner is written
   to every row of its contest and no sync writes over it.

7. **The trophy backfill.**

   ```bash
   bun scripts/backfill-loreward-trophy-cards.ts           # dry run: the places missing a card, and the cards waiting for a claim
   bun scripts/backfill-loreward-trophy-cards.ts --apply   # mints and gives; a second --apply mints 0
   ```

   It mints a card for every place since 2017 and gives the ones whose name has an approved claim (or whose `wikios>`
   name resolves); the rest wait, and each later claim approval gives them out. It pays nothing. On the clone the first
   apply minted 2,846 cards and granted 0 (no claims were approved), and a second run minted 0.

8. **Pay.** Check bonuses are on (Admin, Cards, Economy), then press **Pay now** (there in Loreward payouts, or in
   Admin, Bot, Lorewards), or wait for the 06:00 UTC full sync. Places from 15 October 2026 whose names have approved
   claims (the conversion's included: the conversion runs no hooks) pay once; the toast says how many places were paid
   and how many trophy cards were minted and given, or "Loreward bonuses are off". Pressing it again pays 0.

9. **After.** Run the counts of step 1 again: no date-keyed weekly rows beyond the skipped weeks'
   (`select count(*) from loreward_entries where type='weekly' and date !~ '^\d{4}-W\d{2}$'`), about one trophy card
   per contest place, and new `bonus:loreward:` rows only for places from 15 October 2026. Open the Vault Lorewards tab
   as a player with an approved claim and check their cards and payouts.

10. **The Discord bot** (`/ixwiki/shared/bots/discord`, outside this repo). The bot must POST every approved daily,
    weekly and monthly result to `https://beta.ixwiki.com/api/bot/lorewards/sync` with
    `Authorization: Bearer <BOT_API_KEY>` (or `x-bot-api-key`) and the body fields the route reads (`date`, `type`,
    `winnerUser`, `winnerPage`, `winnerScore`, `winnerBytes`, `runnerUpUser`, `runnerUpPage`, `runnerUpScore`,
    `runnerUpBytes`, `status`, `metadata`). A weekly's `date` is its ISO week in UTC (`2026-W43`) or its first day; a
    monthly's stays as it sends it today (a `YYYY-MM` key gets its first and last day as its range). Check whether it
    posts already (`grep -rn "lorewards/sync" /ixwiki/shared/bots/discord`); if it only writes `lorewards-state.json`,
    add the POST after it approves a result. Answers: 200 with the stored entry and what was settled; 400 when the date
    cannot be read; 409 when the week's key holds another week (another first day), which needs an admin override of
    that week.
    As run: the bot does not POST. After it approves a result it runs the sync locally on the server
    (`syncDownstream` in `shared/bots/discord/lib/lorewards.js` calls `syncFromStateFile` from
    `src/lib/lorewards/sync.ts` in the app directory), so the route above is only for a bot on another host.

11. **The admin blacklist still reads the bot's state file.** `lorewards.getBlacklist` (Admin, Bot, Lorewards,
    **Silent blacklist manager**) reads `/ixwiki/shared/bots/discord/lorewards-state.json`, by design (plan B's open
    decision 7: it is not a results sync). The bot may keep writing the file.

12. **Watch `exclusiveWikiosNames`.** The Lorewards achievements loader runs it for an account on every evaluation
    (`src/lib/lorewards/account-names.ts`): it groups the account's ixwiki revisions by author and checks each author
    against other accounts' revisions. Its cost grows with tagged revisions, so once plan A's tag backfill (step 3) has
    run, watch it in the weekly slow-query digest.
