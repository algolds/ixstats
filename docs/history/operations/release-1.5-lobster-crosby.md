# Release 1.5 "Lobster Crosby": the one-off steps

**Ran on production 2026-10-26/27.** Internal platform 1.5.0, shown to players as 1.0.0 "Lobster Crosby" (Stable).
This is history: Part B of the [release guide](../../operations/release-guide.md), moved here verbatim once the
release was live. The procedure for every release stays in the guide's Part A; references below to A1–A7 and to
"Part A" mean that part as it stood then. Its still-open owner items moved to the guide's
[open operations items](../../operations/release-guide.md#open-operations-items).

## Deviations found by the production-copy rehearsal (PR #100)

The rehearsal on a restored copy of the production dump changed the plan below in these places (most are already
folded into the steps):

- **Cards pre-refresh column shim.** Production's database predated the September schema (NS facts in
  `metadata.nsData`, its own taxonomy in `metadata.category`), so the backfill and the constraints stopped on the first
  missing pre-refresh column. `20261027120000_cards_foundations` now adds those columns, nullable and empty, while
  `cards.cardType` is not yet the `CardType` enum.
- **`searchVector` trigger.** `wiki_articles."searchVector"` became a plain column a trigger keeps current instead of a
  `GENERATED` column: Prisma 6.19 read the expression as a default, and every push stopped on dropping it. An existing
  generated column is converted in place.
- **The Lorewards weekly merge moved after the push** (B3 steps 5 and 10): its Prisma client reads columns only the
  deploy's cards SQL creates.
- **`--accept-data-loss` after a duplicate check** (B3 step 10): the push stopped on eight unique constraints; each was
  checked for duplicates, then applied with `bunx prisma db push --accept-data-loss --skip-generate`.
- **`WIKIOS_PROOF_OVERRIDE=1`** (B3 step 10): production had no corpus yet, so no commit could pass the WikiOS proof's
  round trip.
- **`backfill-foundation.ts` and `merge-weekly-keys.ts` hang on exit when `REDIS_ENABLED=true`** (the Redis client
  keeps the process alive after the work is done). Run them with `REDIS_ENABLED=false` in front of the command.

---

## Part B — This release (1.5 "Lobster Crosby", the `rose-garden` RC)

The 1.4 plan (PRs #44 and #45) was never completed on production. On 2026-09-27 production's checkout was
`development` @ `7877d620`, and on 2026-10-25 the main app on port 3550 had no build: the IxWorld standalone (built
2026-08-04, maps.ixwiki.com) served every page, and `ixstats-cron` and `ixstats-ws` ran with `NODE_ENV=development`
and a read-only database ([MyCountry runbook](deploy-mycountry-2026-10.md)). So 1.5 brings everything since: the
September plan wave, roadmap M0, the cards refresh, IxnayID, MyCountry fixes, realm time, native lore and WikiOS data
safety. Its SQL drops and converts data, so **a rollback to pre-1.5 code is a restore** (`--restore`).

This part gives the order. The detail stays in each runbook:

| Area | Runbook |
| --- | --- |
| Environment, WikiRevision dedupe, Realms backfill, relief, Vault hub backfills, Eurth, cron order | [deploy-rose-garden-2026-09.md](deploy-rose-garden-2026-09.md) (its order is superseded by this part) |
| Cards Phases 1 to 4 and categories | [cards.md](../../systems/cards.md#deploy-runbook-notes) and the phase runbooks after it |
| IxnayID and Lorewards | [ixnayid-passport.md](ixnayid-lorewards-runbooks-1.5.md#ixnayid-identity-deploy-runbook-owner) |
| MyCountry fixes | [deploy-mycountry-2026-10.md](deploy-mycountry-2026-10.md) |
| Realm time | [deploy-realm-time-2026-10.md](deploy-realm-time-2026-10.md) |
| Native lore | [explore-and-country-profiles.md](../../systems/explore-and-country-profiles.md#native-lore-deploy-runbook-owner) |
| WikiOS v1 and data safety | [wikios-v1-cutover.md](wikios-v1-cutover.md) |
| Unused models (D9) | [drop-unused-models.md](drop-unused-models.md) |

### B1. Before deploy day

- [ ] Read the runbooks above once end to end.
- [ ] **Owner decisions,** written down before the window:
      - realm time D2a **deletes every `MilitaryAsset` whose `catalogKey` is NULL** (every asset today), and the
        starter-force reset replaces every nation's forces with a starter force (realm-time step 4);
      - the drop of `world_configs` (1 row) and `territory_claims` (0 rows) by the deploy's
        `drop-world-configs.sql`;
      - who owns each Realms ownership **collision** (the dev rehearsal had one, Faneria; Caphiria needs the hand fix in
        [5a](deploy-rose-garden-2026-09.md#5a-realms-schema--ownership-backfill-before-the-deploy-script));
      - how to settle each card copy held as `quantity > 1` (B2);
      - the admin who confirmed each IxWiki link by hand (B3 step 7).
- [ ] **Env** (A2) and the new values since production's last deploy: `WIKI_SYNC_WEBHOOK_SECRET`, `IXTIME_BOT_SECRET`,
      `NEXT_PUBLIC_APP_URL` (before the build), `WS_ALLOWED_ORIGINS`, `REDIS_ENABLED`, `REDIS_URL`, `DISCORD_GUILD_ID`,
      `MAP_TILE_DIR` and `MAP_RASTER_DIR` ([September step 2](deploy-rose-garden-2026-09.md#2-environment) and
      [5c](deploy-rose-garden-2026-09.md#5c-relief-for-ixnay-and-eurth-after-the-deploy-script)),
      `WIKIOS_MEDIAWIKI_INTERNAL_URL` with its loopback server
      ([cutover step 2](wikios-v1-cutover.md#2-deploy-ixstates-as-usual)), `WIKIOS_API_SESSION_SECRET`
      ([cutover step 1c](wikios-v1-cutover.md#1c-the-apiphp-session-secret-plan-410-before-bots-use-wapiphp): generated
      on the server, never typed or printed), and optionally `COMBAT_SEED_SECRET`, email and push. Check `CRON_SECRET`
      is at least 32 characters.
- [ ] **`ecosystem.config.cjs`:** `NODE_ENV: "production"` for every app, `CRON_ENABLED_JOBS: ""` for `ixstats-cron`
      (the new runner exits on old names such as `passive-income`, `scheduled-changes` and `lorewards-state-sync`),
      and the `ixstats-web` block if the web app should run under PM2 (A2).
- [ ] **Drain the card market** a few days ahead: switch off auctions (`vault_isAuctionsEnabled`) and trading
      (`vault_isTradingEnabled`) in the Vault admin
      ([cards refresh spec §5.5](../../specs/2026-10-15-cards-refresh-design.md#55-migration-and-deploy-order)). Production's
      cron may not settle anything (it runs read-only), and open auctions and pending trades carry over the deploy
      ([Phase 4](cards-refresh-runbooks-1.5.md#phase-4-deploy-runbook-owner), "What carries over"), so draining shrinks what
      crosses the window; it is not a guard.
- [ ] **Rehearse** B2 to B4 on `ixstats_dryrun` (A1), hand steps included. `reset-starter-forces.ts` needs no
      `--i-know` there (it is a known clone). Note the time of each step, every refusal and every warning the push
      prints.

### B2. Pre-window checks (read-only; the old build still serving)

**Before A3, production-only config.** `next.config.js` and `postcss.config.js` are tracked now, and A3's checkout
(then the deploy's `reset --hard`) replaces the server's copies with the release's without a word: production's old
checkout ignores them. Compare them first, and keep a copy:

```bash
git fetch master master
mkdir -p "backups/config-$(date +%F)" && cp next.config.js postcss.config.js "backups/config-$(date +%F)/"
for f in next.config.js postcss.config.js; do diff -u <(git show master/master:"$f") "$f" && echo "$f: same as the release"; done
```

Most of the diff is the release's own changes. Look for `+` lines, the ones only production has (a rewrite, a
header, a plugin): they are lost at A3 unless the release carries them, so commit them on `development` first, or decide they can go.

Then do A3 (the checkout does not touch the running servers), load the production env, and:

1. **Schema state.** The `migrate diff` and the additive dry run of A1. Note whether the diff adds
   `Country.ownerUserId` (the Realms schema has not reached production), `wiki_revisions.revId`, the
   `wiki_revisions (source, mwRevId)` unique index and the `Alliance (realmId, name)` unique key. B3 depends on it.
2. **Cards guards.** The constraint and economy SQL refuse, changing nothing, until these hold:
   ```sql
   SELECT id, "cardId", "ownerId", quantity FROM "CardOwnership" WHERE quantity > 1;   -- must be empty
   SELECT status, count(*) FROM "TradeOffer" GROUP BY 1;    -- only PENDING, ACCEPTED, REJECTED, CANCELLED, EXPIRED
   SELECT status, count(*) FROM "CardAuction" GROUP BY 1;   -- only ACTIVE, COMPLETED, CANCELLED
   ```
   Settle each `quantity > 1` row by hand (nothing splits them). An old `COUNTERED` trade becomes `REJECTED` (B3
   step 3). Also run the read-only checks of
   [Phase 2 step 2](cards-refresh-runbooks-1.5.md#phase-2-deploy-runbook-owner) and the pack odds of
   [Phase 4 step 2](cards-refresh-runbooks-1.5.md#phase-4-deploy-runbook-owner).
3. **WikiRevision duplicates**, if the diff adds the `(source, mwRevId)` unique index: sections 1 and 1b of
   [September step 4](deploy-rose-garden-2026-09.md#4-database-steps-that-must-happen-before-the-deploy).
4. **PvP challenges:** `SELECT count(*) FROM "MilitaryConflict" WHERE type = 'pvp' AND status = 'proposed';`. The
   deploy's `f-defense.sql` ends every one whose defender has no owner, so the ownership backfill must be in place
   first (B3 step 8).
5. **IxnayID:** the counts and the conversion dry run,
   [IxnayID step 1](ixnayid-lorewards-runbooks-1.5.md#ixnayid-identity-deploy-runbook-owner) (on the rehearsal copy if
   production lacks the tables it reads). **Lorewards:** its step 1 counts
   ([Lorewards runbook](ixnayid-lorewards-runbooks-1.5.md#lorewards-deploy-runbook-owner)).
6. **Unused models (D9):** the row counts and dependents check in
   [drop-unused-models.md](drop-unused-models.md#3-pre-window-check-b2-read-only). Note every table whose count is
   not 0: B3 step 2 exports its rows, then drops it. A row in the dependents check means stop and ask the owner. The
   deploy's push drops the empty tables, and stops on one that still has rows.

### B3. The window (the app stopped)

1. **Stop everything that serves or writes with the old code. Downtime starts here.** Announce it first.
   ```bash
   pm2 stop ixworld ixstats-cron ixstats-ws ixstats-ixtwitter
   pm2 stop ixstats-web 2>/dev/null    # or stop the start-production.sh session, if 3550 runs at all
   ```
   The cards SQL rewrites and drops columns the old code reads, and the realm-time SQL converts timestamps the old
   jobs would fire on, so no old code may run between the SQL and the new build. The deploy starts them all again.
   Remove the server crontab's call to `/api/lorewards/sync` (Lorewards step 2).
2. **`bun run db:backup`.** Keep the path: it is the rollback point for everything below. Then the D9 tables that B2
   step 6 found with rows: export them to their own dump, check it, then drop them (owner ruling 2026-10-27: keep the
   rows as an export; [drop-unused-models.md](drop-unused-models.md#3-pre-window-check-b2-read-only) has the commands).
   A table left with rows stops the deploy's push.
3. **Data the guards need:**
   `UPDATE "TradeOffer" SET status = 'REJECTED' WHERE status = 'COUNTERED';`, the `quantity > 1` rows settled, the
   WikiRevision dedupe (sections 2 and 3, if B2.3 applied) and, if the diff adds the `Alliance (realmId, name)` key,
   `prisma/migrations/20261007120000_realm_source_sync/migration.sql`
   ([September step 4](deploy-rose-garden-2026-09.md#4-database-steps-that-must-happen-before-the-deploy)).
4. **The additive step, by hand:** `bun scripts/deployment/apply-additive-schema.ts --apply`. The steps below read
   columns only it creates (`Country.ownerUserId`, `wiki_account_links."verifiedById"`, …). The deploy runs it again
   and finds nothing to do. It never adds `wiki_revisions.origin`.
5. **The Lorewards weekly merge is not here any more: it runs at step 10.** Its Prisma client reads columns only the
   deploy's cards SQL creates (`loreward_entries."overriddenAt"`, `cards."lorewardEntryId"`), so before the deploy it
   stops on the first of them (the 2026-10-26 rehearsal on a production copy).
6. **The WikiOS SQL,** [cutover step 1](wikios-v1-cutover.md#1-apply-the-wikios-sql-migrations): the canonical titles
   procedure, then the `prisma/manual-migrations/*wikios*.sql` loop (without the lead-image file).
   **`2026-09-30-wikios-api.sql` must run before the deploy**: the deploy's `20261105120000_wikios_conflicts` labels
   each existing revision `classic` or `wikios` once, when it adds `origin`, and needs `revId = mwRevId` filled for
   MediaWiki's revisions. The additive step adds `revId` empty; only the api.php file fills it. The read-only check is
   in the cutover runbook ("The data-safety SQL runs before the push").
7. **IxWiki links an administrator confirmed:** record the confirming admin in `wiki_account_links."verifiedById"`
   ([cutover step 1b](wikios-v1-cutover.md#1b-import-the-mediawiki-rights-plan-409-after-checking-who-vouched-for-each-name),
   "If the IxnayID identity deploy has not run yet"). The deploy's conversion reads it: a link left NULL converts as
   self-proved and passes that name's MediaWiki groups to the account.
8. **The Realms ownership backfill,** if `Country.ownerUserId` is new or still empty:
   `bun scripts/realms/backfill-foundation.ts` (dry run), resolve each collision, the Caphiria fix, then `--apply`
   ([5a](deploy-rose-garden-2026-09.md#5a-realms-schema--ownership-backfill-before-the-deploy-script)). It must run
   before the deploy: the deploy's `f-defense.sql` and the starter-force reset treat a nation with no owner as an NPC.
   Its writes read back only the row id, so columns that only the deploy SQL adds (`Country."ownedSince"`,
   `realms."isSystem"`, the realm board columns) may still be missing when it runs.
9. **MyCountry and realm-time SQL:** the deploy runs them in the runbooks' order, after the steps above. Running the
   runbooks' `run_sql` steps by hand first also works once steps 4 and 8 are done (the deploy re-runs each as a
   no-op); see the [realm-time runbook](deploy-realm-time-2026-10.md#4-the-deploy-window-old-build-stopped).
10. **Deploy** (A4): `WIKIOS_PROOF_OVERRIDE=1 ./scripts/deploy-production.sh`. The override is for this release
    only: the WikiOS proof check's round trip needs at least 11,435 pages and production holds 3 (`wiki_articles`
    is filled at the WikiOS launch, B4 step 10), so no commit can pass it before then. Read its lines anyway:
    `roundTrip.nonIdentical`, `incomplete` and `errors` must be `ok`. The two data steps below need the release's whole schema and
    must finish before the new server serves, so run them once the schema is in place: in the stop the push makes
    (below, the case on production), or, if the deploy prints **"Database sync completed successfully"**, in a second
    tmux window (`Ctrl+B C`) during the build:
    ```bash
    bun scripts/lorewards/merge-weekly-keys.ts           # dry run (Lorewards step 3): merges, folds, skipped
    bun scripts/lorewards/merge-weekly-keys.ts --apply
    bun scripts/lorewards/merge-weekly-keys.ts           # again: 0 merges
    bun run db:mark-match-revenue-collected             # dry run: how many completed matches
    bun run db:mark-match-revenue-collected -- --apply
    ```
    The merge folds the date-keyed weeklies into ISO weeks (the production copy: 215 merges, 27 folds) and skips, for
    an admin, the weeks whose rows disagree on the first day or the holder (the copy: 2024-W20, 2026-W01, W13, W14, W18,
    W43); keep its JSON. The second marks every match that finished before this release as paid. Skip it and each
    club's first "Collect Revenue" pays its whole match history (SL-14). Run both once; never add them to routine
    deploys.

    **If the push stops on a warning** (on production it does), the live build is untouched and every SQL file before
    it has run (the WikiOS labelling included). Read every line. If they are only unique constraints, the push can only
    fail on duplicates, never drop data; the production copy listed eight: `Country (realmId, name)`, `User (handle)`,
    `idempotencyKey` on `exchange_contracts`, `exchange_conversion_logs`, `exchange_transactions` and
    `vault_transactions`, `map_layers (worldId, layerType, featureId)` and `wiki_revisions (source, mwRevId)`, all
    without duplicates. Check each one the push names (`SELECT <columns>, count(*) FROM <table> WHERE <columns> IS NOT
    NULL GROUP BY <columns> HAVING count(*) > 1;` must be empty), then apply it by hand with
    `bunx prisma db push --accept-data-loss --skip-generate` (`db:push:force` never prompts: it stops), run the data
    steps above, and run the deploy again: each file is then a no-op and the push has nothing left. Anything that
    drops a column or table with data means a step was skipped: stop.

### B4. Right after the deploy, in order

1. **Checks.**
   - A5, and `ls -l /ixwiki/public/maps/ixworld/.next/BUILD_ID` is dated today
     ([realm-time step 5](deploy-realm-time-2026-10.md#5-the-code-deploy)). If `ixstats-ws` did not come back:
     `pm2 start ecosystem.config.cjs --only ixstats-ws`.
   - WikiOS labels: `select origin, count(*) from wiki_revisions group by origin` shows mostly `classic`. Every row
     `wikios` means the labelling was skipped; the cutover runbook has the one-off fix.
   - IxnayID's partial unique indexes exist (`\d wiki_name_claims`; IxnayID step 2).
   - The cards checks: [Phase 2 step 4](cards-refresh-runbooks-1.5.md#phase-2-deploy-runbook-owner),
     [Phase 3 step 4](cards-refresh-runbooks-1.5.md#phase-3-deploy-runbook-owner),
     [Phase 4 step 6](cards-refresh-runbooks-1.5.md#phase-4-deploy-runbook-owner),
     [categories step 3](cards-refresh-runbooks-1.5.md#card-categories-deploy-runbook-owner).
   - Native lore: `SELECT to_regclass('country_lore_authors'), to_regclass('country_lore_pages');` names both tables.
   - The notification links: run
     `prisma/migrations/20261028120000_rewrite_legacy_notification_links/migration.sql` again; every line reads
     `UPDATE 0` ([September 5e](deploy-rose-garden-2026-09.md#5e-stored-notification-links-after-the-deploy-script)).
2. **Starter forces** (owner decision): `bun scripts/defense/reset-starter-forces.ts --apply --i-know ixstats`. Read
   the report; stop if a nation falls outside the 0.2–1.1% band. A nation read before this already has the same force
   (the new build creates it on first read), and the reset skips it.
3. **Production mode for cron and the websockets:** [MyCountry step 5](deploy-mycountry-2026-10.md#5-recreate-ixstats-cron-and-ixstats-ws-in-production-mode-p0-03),
   then the bot clock, [step 6](deploy-mycountry-2026-10.md#6-the-bot-clock-p1-32).
4. **IxnayID:** tag the claimed names' past revisions (`tag-claimed-revisions.ts`, step 3), the curated alt (step 4),
   the counts after (step 6).
5. **Cards one-offs,** each a dry run first: `backfill-card-compliance.ts` then `--apply --fetch`,
   `import-special-cards.ts` then `--apply` and the `specialKind` check, `convert-lore-requests.ts`,
   `refund-lore-tokens.ts` (after `audit:vault-exploits:apply`)
   ([Phase 2 step 6](cards-refresh-runbooks-1.5.md#phase-2-deploy-runbook-owner)); the seed-card retirement and the category
   backfill ([categories steps 4 to 8](cards-refresh-runbooks-1.5.md#card-categories-deploy-runbook-owner)); revalue once
   ([Phase 4 step 9](cards-refresh-runbooks-1.5.md#phase-4-deploy-runbook-owner)). Then switch auctions and trading back on.
6. **Realms and Atlas:** the geometry triggers
   ([5b](deploy-rose-garden-2026-09.md#5b-map-geometry-triggers-after-the-deploy-script)), relief
   ([5c](deploy-rose-garden-2026-09.md#5c-relief-for-ixnay-and-eurth-after-the-deploy-script)), the Vault hub
   backfills `backfill-country-owned-since.ts` and `backfill-loreward-trophy-cards.ts`
   ([5d](deploy-rose-garden-2026-09.md#5d-vault-hub-backfills-and-restart-after-the-deploy-script)), and the
   ownership backfill's dry run again: expect `owners: 0 to assign, 0 collisions`.
7. **Data fixes,** each a dry run first (take `bun run db:backup` before the first `--apply`):
   ```bash
   bun run audit:vault-exploits                      # exploit rows + the corrections it would make (VT-1/2/6/11)
   bun run audit:vault-exploits:apply                # idempotent ADMIN_ADJUSTMENT rows; never below a zero balance
   bun run db:refund-retired-store-items             # then -- --apply (after the exploit corrections)
   bun run audit:forum-links                         # read-only: forum accounts linked without proof (WK-1)
   bun scripts/fix-storyteller-effect-timestamps.ts  # plan 329; then --apply
   bun run wiki:backfill:blurhash                    # then -- --apply
   ```
   The deploy's MyCountry `a1` SQL already retired the unkeyed `[GovComponent]`/`[BrokerComponent]` rows, so read
   the storyteller dry run for what is left to re-date before announcing it.
8. **The budget-year remap** (MC-1). Its tool `db:remap-budget-years` was retired; restore it from `65fd9dcdc^`, dry
   run, apply, remove it ([MyCountry step 8](deploy-mycountry-2026-10.md#8-turn-the-jobs-on)). Skip it if every
   `BudgetAllocation.budgetYear` is already 2041 or later.
9. **Cron, one job per cycle (A7).** First `db-backup` and `log-retention`; then the
   [September order](deploy-rose-garden-2026-09.md#7-turn-cron-jobs-on-one-per-cycle) with `vault-dividend`; the cards
   jobs (`card-import-jobs`, `listing-expiry`, `card-holding-xp`, with `card-values`, `auction-completion` and
   `trade-expiry`); the MyCountry jobs in [MyCountry step 8](deploy-mycountry-2026-10.md#8-turn-the-jobs-on)'s order
   with the [realm-time notes](deploy-realm-time-2026-10.md#7-cron-back-on); `budget-year-rollover` only after step 8.
   Size the money jobs' backlogs first (September step 7). Leave `wiki-mirror` and `wiki-render-stale` to the WikiOS
   launch.
10. **The WikiOS launch:** the rest of the cutover runbook's launch steps, from 1b's rights import on, in its order
    (the identity deploy has run by now, so read the claims that pass groups first, as 1b says). WikiOS editing stays
    off until its step 6b.
11. **Later:** Eurth ([6b](deploy-rose-garden-2026-09.md#6b-serve-eurth-the-first-outside-realm)) and the CSP (B6).

### B5. Ops prerequisites still open

From [SYSTEM_STATUS](../../systems/SYSTEM_STATUS.md#known-blockers-on-rose-garden). The steps above cover some; the rest
are owner work around the release:

- [ ] **Rotate the `ixstats_readonly` Postgres password** (plan 325): the old one is in git history.
- [ ] **Test a `db:backup` restore** into a scratch database (the M0 exit criterion):
      ```bash
      docker exec ixstats-postgres createdb -U postgres ixstats_restore_test
      docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats_restore_test --no-owner \
        < "$(ls -t backups/ixstats-*.dump | head -1)"
      docker exec ixstats-postgres psql -U postgres -d ixstats_restore_test -c 'SELECT count(*) FROM "Country";'
      docker exec ixstats-postgres dropdb -U postgres ixstats_restore_test
      ```
      The A1 rehearsal restores a dump too; it counts once its copy checks out.
- [ ] **Copy `backups/` off the server** (another host or object storage); the dumps sit on the same disk as the
      database.
- [ ] **Review `audit:vault-exploits`, then `audit:vault-exploits:apply`** (B4 step 7).
- [ ] **Review `audit:forum-links`** (B4 step 7).
- [ ] **`CRON_ENABLED_JOBS`:** `db-backup`, `log-retention` and `budget-year-rollover` (after the remap) (B4 step 9).
- [ ] **`DISCORD_GUILD_ID`** set (A2).
- [ ] **`db:mark-match-revenue-collected`** right after the push (B3 step 10).
- [ ] **The budget-year remap,** with the retired `db:remap-budget-years` restored from `65fd9dcdc^` (B4 step 8).

### B6. CSP: remove the nginx override

The app now sends a per-request nonce that reaches the page (PL-2), but nginx or a Cloudflare transform rule still
replaces the app's `Content-Security-Policy` header. Once this release has been stable for a day:

1. Remove the override (nginx `add_header Content-Security-Policy …` for `/projects/ixstates`, or the Cloudflare
   transform rule), then reload nginx (`nginx -t && systemctl reload nginx`).
2. Check the header now comes from the app — it contains `'nonce-`:
   ```bash
   curl -sI https://ixwiki.com/projects/ixstates/ | grep -i content-security-policy
   ```
3. With the browser console open, go through A5's pages plus sign-in, the map editor and a wiki article. Any
   "Refused to …" message names the blocked source: add it to `src/lib/security/csp.ts` (on `rose-garden`) and
   release again. To back out quickly, restore the nginx override.
4. Later, once no violations show up, drop `'unsafe-inline'` from production `script-src` in `csp.ts` (browsers
   already ignore it when a nonce is present, so this only affects very old browsers).
