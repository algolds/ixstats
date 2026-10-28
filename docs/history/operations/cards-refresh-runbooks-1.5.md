# Cards refresh deploy runbooks (release 1.5)

> **Ran on production 2026-10-26/27 as part of release 1.5.** Kept as the record of what was run: Phase 2, Phase 3,
> Phase 4 and the card categories. The live system is described in [cards.md](../../systems/cards.md); the Phase 1
> notes stay in [its deploy runbook notes](../../systems/cards.md#deploy-runbook-notes).

## Phase 2 deploy runbook (owner)

Production and the `ixstats` database are touched only here, by the owner, in this order. Every script below is a dry run that writes nothing unless it is given `--apply`; read each dry run before applying it. Every step is idempotent, so a failed step is fixed and re-run. The read-only checks run with `docker exec ixstats-postgres psql -U postgres -d ixstats -c "<query>"`.

1. **Phase 1 first.** Phase 1's deploy (its additive SQL, `backfill-cards-refresh.ts --apply` and the constraint SQL; the Phase 1 plan's runbook) must be complete. If both phases go out in one deploy, follow Phase 1's window (drain auctions and trades, its dry run, the app stopped); `scripts/deploy-production.sh` runs Phase 1's lines before Phase 2's.
   - **The Lorewards chores fix comes too.** This branch carries rose-garden's Lorewards fix (one payout per contest and place, `lorewards/payout.ts`), so if rose-garden has not deployed first, that fix ships in this deploy and its owner items come with it. The details are in the Phase 2 ledger (`.superpowers/sdd/435-cards-phase-2/progress.md` in the owner's working tree, which git ignores) and the Phase 1 chores reviews beside it:
     - check how the bot writes a `wikios>` winner or runner-up on the OOL page, which the OOL sync reads names from (0 `wikios>` entries on both clones, so nothing has shown it yet);
     - check the bot webhook's weekly and monthly dates: the webhook (`src/app/api/bot/lorewards/sync/route.ts`) is a third writer of contest rows, and a weekly or monthly `wikios>` place it writes with no `dateStart` pays no one;
     - audit the payouts made through 44adbcac3's fallback, if it ever ran on production data (0 on both clones);
     - settle the W14 and W18 twins by an admin override on production (the owner's decision of 2026-10-17; [Trophy fixes](../../systems/cards.md#cards-admin)): their state-file and OOL entries name different winners (Nasastan and Urcea), and disagreeing twins pay no one until the override;
     - the state file's late twins: the OOL-only weeks from 2026-08-24 to 2026-09-21 come after the state file's last week (W34), so the next state sync twins whichever of them the file holds.
2. **Read-only checks before the deploy.** Note each result:
   - Crafted cards, which packs still exclude by a lookup (`packPoolWhere`): `SELECT count(*) FROM cards WHERE metadata->>'crafted' = 'true' OR (description LIKE 'Crafted via %' AND "totalSupply" = 1);`. If it is 0, Phase 4's pool-drawer rework drops the lookup.
   - Trophy cards with auction or trade history: `SELECT count(*) FROM "CardAuction" a JOIN "CardOwnership" o ON o.id = a."cardInstanceId" JOIN cards c ON c.id = o."cardId" WHERE c."cardType" = 'TROPHY';` and `SELECT count(*) FROM "TradeOffer" t WHERE t.status = 'PENDING' AND EXISTS (SELECT 1 FROM "CardOwnership" o JOIN cards c ON c.id = o."cardId" WHERE c."cardType" = 'TROPHY' AND (t."initiatorCardIds" ? o.id OR t."recipientCardIds" ? o.id));`. Expect 0 for both: a Loreward override that voids such a copy is refused (`PRECONDITION_FAILED`), because removing a copy never erases its market history.
   - Legacy Commons cards (from the old flag importer): `SELECT count(*) FROM cards WHERE "cardType" = 'LORE' AND metadata ? 'commonsCategory';`. The Phase 2 SQL tags them `wikiSource = 'commons'` (step 4 checks it), so the Commons importer sees them and the Library lists them under Commons.
   - Legacy NationStates takedowns: `SELECT count(*) FROM cards WHERE metadata ? 'nsTakedown';`. The compliance backfill (step 6) brings each into the Compliance queue.
3. **Back up.** `scripts/deploy-production.sh` runs `bun run db:backup` before any SQL and aborts if the dump fails. Take another `bun run db:backup` before the one-off scripts in step 6.
   - **A rollback means a restore.** Going back to pre-Phase-2 code takes the pre-deploy dump with it: `bun run deploy:rollback -- <rollback-branch> --restore backups/ixstats-<stamp>.dump` (the [release guide](../../operations/release-guide.md#rollback)). Code alone is not enough: the old pack pool has no review filter, so every import waiting in Curation (`PENDING`) would drop from packs.
4. **Deploy.** `scripts/deploy-production.sh` applies `prisma/migrations/20261028120000_cards_admin/migration.sql` right after Phase 1's constraint SQL, before the push, then builds and reloads PM2. The SQL is one transaction and a no-op when re-run. Check afterwards:
   - `SELECT to_regclass('card_takedowns'), to_regclass('card_import_jobs'), to_regclass('card_import_items'), to_regclass('card_art_licences');` names all four tables;
   - `SELECT "reviewState", count(*) FROM cards GROUP BY 1;` shows every existing card `APPROVED`;
   - `SELECT confdeltype FROM pg_constraint WHERE conname = 'card_transfer_events_ownershipId_fkey';` is `n` (ON DELETE SET NULL), and `loreward_entries."overriddenAt"` exists;
   - the legacy Commons count from step 2 now also matches `... AND "wikiSource" = 'commons'`.
5. **Cron.** After the new code is live, add `card-import-jobs` to `CRON_ENABLED_JOBS` (unless it is `*`; keep `lore-card-generation`) and restart the cron runner from the ecosystem file, `( cd /ixwiki/public/projects/ixstats && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save`, because a restart by name keeps the environment PM2 stored and the runner would not read the new list; then read back the list it got, `pm2 jlist | jq -r '.[] | select(.name == "ixstats-cron") | .pm2_env.CRON_ENABLED_JOBS'`. Not before: the old cron runner refuses to start on a job name it does not know. Without the job, the daily import's jobs are queued and never worked, and a manual import stops after the first run the Imports tab starts.
6. **One-off scripts**, each a dry run first, then `--apply`:
   1. `bun scripts/cards/backfill-card-compliance.ts`, then `bun scripts/cards/backfill-card-compliance.ts --apply --fetch` on the production server (IIWiki answers only there), which records the licence each wiki states and hides restricted art by a licence review takedown. `--apply` alone records every licence UNKNOWN, and a later `--fetch` then has nothing left to read. The `--fetch` run takes about 20 minutes, most of it reading the IIWiki cards' file pages; let it finish. Run this right after the deploy, before anyone uses the Library or Compliance: the Library's art hold reads takedown rows, so a legacy NationStates takedown is invisible to it until this has run. Re-run it if it lists cards it could not hide.
   2. `bun scripts/cards/import-special-cards.ts`: creates or points the five achievement reward Special cards (`realmId`, `isBound`, `rewardAchievementKey`) and awards each to players who already hold its achievement. Then check for Special cards with no kind that players hold: `SELECT c.id, c.title, count(o.id) FROM cards c JOIN "CardOwnership" o ON o."cardId" = c.id WHERE c."cardType" = 'SPECIAL' AND c."specialKind" IS NULL GROUP BY c.id, c.title;`. For each card listed, decide its kind and set `"specialKind"` by SQL: the Designer treats a held card with no kind as an event card and refuses to change the kind of a card players hold.
   3. `bun scripts/cards/convert-lore-requests.ts`: old paid lore requests become free suggestions (approved requests not yet made go back to waiting, open ones get a realm). No refund is paid.
   4. `bun scripts/cards/refund-lore-tokens.ts`: refunds every unused lore request token a player bought, at what they paid (a `REFUND` row keyed `retired_item_refund:<purchase id>`), and withdraws the token items from the store. Run it after `bun run audit:vault-exploits:apply` (the shortfalls that took back count as paid; run `bun run audit:vault-exploits` first if it has not run), and read the dry run's players, tokens and IxC before applying.
7. **Check.** `/admin/cards` loads all nine tabs, and old links (`?tab=explorer`, `?tab=requests`, `?tab=takedowns`) land on the tabs that replaced them; Compliance → Licence review lists the unknown licences; a backfilled NationStates takedown restores (if step 2 found any); the next daily import (02:00 UTC) queues one job per switched-on wiki (IxWiki and IIWiki by default) and the cron works it; an IIWiki category crawl works from production.
8. **Tell players.** Lore tokens and paid lore requests have ended, suggestions are free (three a day), and unused bought tokens come back as a refund in the Wallet ([the help page](../../../src/content/help/vault/lore-cards.md) says so).

Settled by the owner on 2026-10-17:

- **Mutations never retry.** `src/trpc/query-client.ts` retried every mutation once in production, so a committed money mutation whose response was lost (a bid, a purchase, a pack open) could run twice. It is `mutations.retry: 0` now, app-wide (rose-garden `8d10aa735`, merged into this branch).
- **Revoking keeps its rule.** A copy with any auction row is not revocable, because `CardAuction` and `AuctionBid` cascade on copy delete.
- **Pack-level card type editing is Phase 4.** The Packs tab cannot edit a pack's card type (`CardPack.cardType`, set on 14 of the 20 seeded packs).

Still open (no deploy step):

- No admin screen lists rejected cards to approve them again (`cards.admin.curation.review` accepts a rejected card by id).
- The pack artwork the seed names (`/images/packs/pack_*.svg`) is not in the repo (`public/images/*` is git-ignored).
- A Serialised grant of a card with unlimited supply is possible through the API only.
- When a player's used lore tokens exceed their non-retired ones, the excess is counted against archetype token purchases, which their own script refunds in full. Exploit-audit corrections of 0 IxC count as paid.
- An index on `vault_transactions(type, source)` in a later migration: the Loreward paid check scans `EARN_BONUS` rows.
- The about 19 MB of git-ignored `public/icons` game icons have no readers since the Designer rebuild.

---

## Phase 3 deploy runbook (owner)

Production and the `ixstats` database are touched only here, by the owner, in this order. Phase 3 needs Phases 1 and 2 (its SQL reads Phase 1's `cards."realmId"`); if they go out in one deploy, follow Phase 1's window, and `scripts/deploy-production.sh` runs each phase's SQL in turn. The read-only checks run with `docker exec ixstats-postgres psql -U postgres -d ixstats -c "<query>"`. This runbook describes Phase 3 as merged into `rose-garden` on 2026-10-20, with Phases 1, 2 and 4 (the ledger is `.superpowers/sdd/436-cards-phase-3/` in the owner's working tree, which git ignores).

1. **Stop the app first, as for Phase 1.** Run `pm2 stop` for the app server and the PM2 processes (`ixstats-cron`, `ixstats-ws`, `ixstats-ixtwitter`). The SQL drops `CollectionLike` and `CollectionComment`, which the old code reads, and briefly takes `ACCESS EXCLUSIVE` locks on `cards`, `CardCollection` and `User`, so no old code may run between it and the new build.
2. **Back up.** `scripts/deploy-production.sh` runs `bun run db:backup` before any SQL and aborts if the dump fails. Collection likes and comments (removed by the spec) come back only from that dump, so going back to pre-Phase-3 code is a restore: `bun run deploy:rollback -- <rollback-branch> --restore backups/ixstats-<stamp>.dump` (the [release guide](../../operations/release-guide.md#rollback)).
3. **Deploy.** The deploy script applies `prisma/migrations/20261031120000_cards_face_hub/migration.sql` right after Phase 2's SQL and before `db push` (which cannot drop the two tables), then pushes (a no-op for these tables), builds and reloads PM2. The SQL is one transaction. It numbers every card per realm in one `UPDATE`, adds the unique `(realmId, collectorNumber)` index and the `cards_assign_collector_number` trigger, adds `CardCollection.pinnedAt` and its index, removes showcase items whose copy has left its owner, adds the `card_showcase_detach_on_transfer` trigger, drops the two tables, and deletes the leftover `vault_maxStreakBonus` SystemConfig row (nothing reads it). On the `ixstats_cards` clone it numbered 70,586 cards (68,191 of them NationStates) in about 5.6 s; a rerun is a no-op (0.25 s). No cron job or one-off script comes with this phase.
4. **Read-only checks after the deploy.** Note each result:
   - every card numbered: `SELECT count(*) FROM cards WHERE "collectorNumber" IS NULL;` is 0;
   - none out of order (each realm numbered 1 to n by creation): `SELECT count(*) FROM (SELECT "collectorNumber", row_number() OVER (PARTITION BY "realmId" ORDER BY "createdAt", id) AS rk FROM cards) t WHERE "collectorNumber" <> rk;` is 0;
   - both triggers present: `SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('cards'::regclass, '"CardOwnership"'::regclass);` lists `cards_assign_collector_number` and `card_showcase_detach_on_transfer`;
   - the two tables gone: `SELECT to_regclass('"CollectionLike"'), to_regclass('"CollectionComment"');` returns two nulls;
   - no showcase holds a copy its owner gave away: `SELECT count(*) FROM "CardCollectionItem" i JOIN "CardCollection" c ON c.id = i."collectionId" JOIN "CardOwnership" o ON o.id = i."cardOwnershipId" WHERE o."ownerId" <> c."userId";` is 0;
   - the streak bonus setting gone: `SELECT count(*) FROM "SystemConfig" WHERE key = 'vault_maxStreakBonus';` is 0.
5. **Check the app.** Open `/vault/cards/mine` and `/vault/cards/explore`, open a pack from the Store's Packs tab, and open one old address (the Vault's old `inventory` page, say) to see the 308 to Mine, and the Vault's old Exchange page to see the 308 to `/labs/exchange`. Browsers cache permanent redirects, so an old address can never be reused for something else. Signed out, open a card on a Passport that shows Vault cards (the sheet opens), then a bare card link (it asks you to sign in).
6. **No service worker to clear.** `public/sw.js`, `public/manifest.json` and `public/offline.html` are deleted. No page ever registered the worker or linked the manifest, so no browser has either installed, and nothing needs unregistering.
7. **Tell players.** Cards are one hub with four tabs (Mine, Sets, Market, Explore); collections are showcases, and their likes and comments are gone; cards you have not collected show their art, muted; trophy cards are on the Lorewards tab and Passports, not in Explore; packs open in one short reveal; outbid auctions stay in Your bids with Raise bid; anyone can open the cards a Passport shows without signing in, and everything in the Vault needs sign-in; the NationStates card list left Settings ([the Vault help page](../../../src/content/help/vault/overview.md) says so).

Owner decisions (2026-10-17), and where each was built:

- **Trophies leave Explore** (overriding the plan's Q10): `exploreWhere` leaves TROPHY cards out of the grid and its count, and the shelves leave them out of their strips and counts; `CATALOGUE_WHERE` keeps them, so a bare sheet link still opens one ([The hub](../../systems/cards.md#the-hub)).
- **Explore's realm filter lists every public realm with cards:** `cards.exploreShelves` returns `realms` (every public, published realm with a card other than a trophy), the shelves stay the top 12, and the Market's realm filter reads the same list.
- **A public sheet for cards shown in public:** signed out, `cards.getSheet` answers under the read-only rate limiter for a Passport's displayed cards and trophies, a public showcase's copies and live listings, with the same art rules; any other link says "Sign in to see this card".
- **Trail and seller names follow `vaultCards`:** the sheet calls a player who hides their Vault cards "a player" (`src/lib/cards/hub/sheet.ts`).
- **"Your bids" lists outbid auctions too**, marked Winning or Outbid, with Raise bid.
- **The pack reveal tilts and shimmers** for Rare and rarer cards in its summary, with the sheet's tilt and holo, never under Reduce Motion.
- **The hub's tabs activate manually:** `SegmentedControl` takes an optional `activationMode` (automatic by default, so its other callers are unchanged), and `CardsHub` passes `manual`.
- **The Vault's old Exchange page is a proxy 308** to `/labs/exchange` (`movedPageRedirectFor`, `src/lib/navigation/moved-pages.ts`), and the old-URL ratchet lists it.
- **The service worker and manifest are deleted** (`public/sw.js`, `public/manifest.json`, and `public/offline.html`, which only the worker read).
- **The `vault_maxStreakBonus` row** goes in the Phase 3 SQL (step 3).
- **The Lorewards override:** saving it announces it through the bot; the separate Announce button is gone.
- **Sports trophies through the holder context are intended:** the holder context reveals any TROPHY copy the holder owns.
- **Later phases:** a player takedown form for cards other than NationStates', pack-level card type editing, and an end to a pack's fallback to another rarity were built in Phase 4 ([Phase 4](#phase-4-deploy-runbook-owner)); versions, the channel (Release Candidate until then) and one changelog entry come in Phase 6.

Fixed since the phase's final review:

- `resolveHandleUser` no longer treats `%` and `_` as wildcards (`likeLiteral`, `src/lib/utils/like-literal.ts`, `28bbb32ec`); Explore's title and region searches use it too.
- The `CHANGELOG.md` entries that linked to deleted card files name them in code font (`f2ed9059d`); `src/tests/scripts/sync-reference-docs.test.ts` is green.
- `bun run audit:arch` passes: `ixtwitter-sync.ts` is split below its ceiling (`d0b90f1bb`).
- Card state refreshes after every change that moves or locks a copy (`useCardsRefresh`; the final review's I2).
- One rule names players ([Naming players](../../systems/cards.md#naming-players); the final review's I1): the Passport handle while it is a real name, not the player's Clerk id; else the nation they hold; else "a player". It names the sheet's trail, signers and sellers, the showcase byline, the trade card, the offer notification and Market history, all through one batched read (`loadPlayerNames`), so no player with no stored handle, wiki name or forum name shows as "@user_…".
- A hidden card's excerpt and Commons file title no longer name its art; another player's showcase leaves retired copies out, and a link from it no longer opens one; the sell picker searches and pages, and shows a `?sell=` copy whichever page holds it; a committed pack open or import whose faces cannot be read reports success, and the reveal then says the pack is open and its cards are in Mine; the trade builder values a retired copy at 0 with the placeholder face; Halo has one Open card packs entry; the Lorewards tab marks a trophy with `?trophy=`; the sheet no longer says a Special card comes in packs; the help gives the 5% bid step.

Still open (no deploy step):

- **Drop the Lorewards tab's `?card=` fallback** one release after this one (`VaultLorewardsPanel`): new links use `?trophy=`, and an older `?card=` link still marks the trophy (and opens its sheet). The WikiOS Lorewards page keeps `?card=` for its highlight; it hosts no card sheet, so the two never clash there.
- **An integration test of the uncollected mark and the sheet's opening places on a real database** (the final review's recommendation): every such test runs on mocked Prisma. One test on a scratch schema would cover an uncollected card in Explore, the sheet and the market, a live listing, a public and a private showcase, and an expired offer.

Accepted limits (ledgered, no change planned):

- **Collector numbers can repeat** (the owner accepted it). A new card takes its realm's highest number plus one, so after a realm's top card leaves (a realm move or a deletion) the next card takes its number again.
- **Old trail actions read "Moved"** (no change). A transfer action the trail does not know (`trailLabel`) reads "Moved". Production was not checked for action strings older than the schema comment: `SELECT action, count(*) FROM card_transfer_events GROUP BY 1;` lists them.
- A copy traded between a showcase add's ownership check and its insert can stay in its old owner's showcase ([Showcases](../../systems/cards.md#showcases)).
- A double pin from two tabs leaves two pinned showcases; the display takes the latest, but another player's view of each showcase reads its own pin, so both read Pinned until one is unpinned. A per-player lock (namespace 7338) would stop it if it matters.
- Two concurrent admin overrides that move cards between the same realms can deadlock on lock 7337; Postgres aborts one, and it can be retried.
- The browser's own Back onto a history entry with no state leaves the sheet drawn until its close button or Escape.

---

## Phase 4 deploy runbook (owner)

Production and the `ixstats` database are touched only here, by the owner, in this order. Phase 4 needs Phases 1 to 3 (its SQL reads Phase 1's finishes and Phase 2's transfer-event columns and takedown origins); if they go out in one deploy, follow Phase 1's window, and `scripts/deploy-production.sh` runs each phase's SQL in turn. The read-only checks run with `docker exec ixstats-postgres psql -U postgres -d ixstats -c "<query>"`. This runbook describes Phase 4 as merged into `rose-garden` on 2026-10-20, with Phases 1 to 3 (the ledger is `.superpowers/sdd/437-cards-phase-4/` in the owner's working tree, which git ignores).

1. **Check the status columns before the deploy.** `SELECT status, count(*) FROM "TradeOffer" GROUP BY 1;` and `SELECT status, count(*) FROM "CardAuction" GROUP BY 1;`. The SQL turns both into enums and stops, changing nothing, on any value outside `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED` and `EXPIRED` (trades) or `ACTIVE`, `COMPLETED` and `CANCELLED` (auctions). Map such rows first; an old `COUNTERED` trade becomes `REJECTED`.
2. **Check the packs' odds.** `SELECT id, name, "isActive", round(("commonOdds" + "uncommonOdds" + "rareOdds" + "ultraRareOdds" + "epicOdds" + "legendaryOdds")::numeric, 2) AS total FROM "CardPack" WHERE round(("commonOdds" + "uncommonOdds" + "rareOdds" + "ultraRareOdds" + "epicOdds" + "legendaryOdds")::numeric, 2) <> 100;` should list nothing. A pack now rolls each rarity in proportion to its odds' total, as the Store scales them, so a pack that does not total 100 gives its scaled odds; fix it in the Packs tab. After the deploy, preview each pack on sale in the Packs tab: a pack whose pool has no card of a rarity it shows or guarantees is no longer sold or opened ([Packs and the reveal](../../systems/cards.md#packs-and-the-reveal)).
3. **Stop the app first, as for Phases 1 and 3.** Run `pm2 stop` for the app server and the PM2 processes (`ixstats-cron`, `ixstats-ws`, `ixstats-ixtwitter`). The SQL converts `TradeOffer.status` and `CardAuction.status` and drops `TradeOffer.counterOfferFromId` and `card_watchlist.targetPrice`, which the old code reads and writes, so no old code may run between it and the new build. If the app cannot stop, at least switch off the market (`vault_isAuctionsEnabled`) and trading (`vault_isTradingEnabled`) in the Vault admin first and let running auctions and trades settle.
4. **Back up.** `scripts/deploy-production.sh` runs `bun run db:backup` before any SQL and aborts if the dump fails. Going back to pre-Phase-4 code is a restore: the old code cannot read the enum columns or the new trade table (`bun run deploy:rollback -- <rollback-branch> --restore backups/ixstats-<stamp>.dump`, the [release guide](../../operations/release-guide.md#rollback)).
5. **Deploy: the Phase 4 SQL goes before the code.** `scripts/deploy-production.sh` applies `prisma/migrations/20261101120000_cards_economy/migration.sql` right after Phase 3's face-hub SQL and before `db push` (which would drop and re-add the status columns, losing every value), then pushes, builds and reloads PM2. Applied by hand, it is the `psql` command in the file's header, run before the new code starts. The SQL is one transaction and a no-op when re-run (on the `ixstats_cards` clone: 0.52 s, then 0.14 s). It adds the listing, dust, market price, mute and inscription report tables; `Card.firstSoldAt`; the copy's frozen signer name, import share and daily XP columns, clamping levels to 10 (XP is kept); each transfer event's finish, card and serial; the trade's proposer, revision and cross-realm flag; each auction's card, serial and stored listing fee (5, or 10 featured, for every existing auction); `ON DELETE SET NULL` on the auction's copy link; and the `PLAYER_REQUEST` takedown origin. It marks every imported NationStates copy for the import share from the import ledger, so there is no backfill script.
6. **Read-only checks after the deploy.** Note each result:
   - the enums: `SELECT table_name, udt_name FROM information_schema.columns WHERE table_name IN ('TradeOffer', 'CardAuction', 'card_listings') AND column_name = 'status';` shows `TradeOfferStatus`, `CardAuctionStatus` and `CardListingStatus`;
   - the new tables: `SELECT to_regclass('card_listings'), to_regclass('card_dust_balances'), to_regclass('card_dust_events'), to_regclass('card_market_prices'), to_regclass('card_notification_mutes'), to_regclass('card_inscription_reports');` names all six;
   - the import share matches the ledger: `SELECT count(*) FROM "CardOwnership" o WHERE o."importDiscounted" <> EXISTS (SELECT 1 FROM ns_import_ledger l WHERE l."ownershipId" = o.id);` is 0;
   - levels: `SELECT max(level) FROM "CardOwnership";` is at most 10;
   - the history keeps: `SELECT confdeltype FROM pg_constraint WHERE conname = 'CardAuction_cardInstanceId_fkey';` is `n`, and `SELECT count(*) FROM "CardAuction" WHERE "listingFee" = 0;` is 0.
7. **Repair any deploy-window auctions.** Only if old code ran after the SQL (the app was not stopped): an auction it created stored a listing fee of 0 after charging 5 or 10, so its refund would be 0. With the restart time noted: `UPDATE "CardAuction" SET "listingFee" = CASE WHEN "isFeatured" THEN 10 ELSE 5 END WHERE "listingFee" = 0 AND "createdAt" < '<restart time>';`.
8. **Cron.** After the new code is live, add `listing-expiry` and `card-holding-xp` to `CRON_ENABLED_JOBS` (unless it is `*`), make sure `card-values`, `auction-completion` and `trade-expiry` are named too, and restart the cron runner from the ecosystem file, `( cd /ixwiki/public/projects/ixstats && pm2 restart ecosystem.config.cjs --only ixstats-cron --update-env ) && pm2 save` (a restart by name keeps the stored environment, so the runner would not read the new list); then read back the list it got, `pm2 jlist | jq -r '.[] | select(.name == "ixstats-cron") | .pm2_env.CRON_ENABLED_JOBS'`. Not before: the old runner refuses to start on a job name it does not know. `card-values` keeps its name and schedule and now writes the market medians and every card's reference value. Without `listing-expiry`, listings never expire or refund; without `card-holding-xp`, copies gain no holding XP.
9. **Revalue once.** Press "Revalue every card" in the Economy tab, or run the `card-values` job once, right after the deploy. Until it runs, the sheet shows a viewer who holds no copy the stored `Card.marketValue`, which predates the new formula. On the clone the first run moved 15,848 of 70,586 cards in 1.78 s.
10. **Check the app.** List a copy from its sheet and cancel it (half the fee comes back); start a 3-day auction from Selling; break down a copy, fuse three, craft a Common; sign a copy; build a trade by handle and counter it; mute a card; open a non-NationStates card's About and see "Request a takedown".
11. **Tell players.** Fixed-price listings and a wishlist in the Market; auctions of 24 hours, 3 days or 7 days; the trade builder with counters in the same table, gifts and IxC for cards; finishes, fusion, dust and crafting; copy levels and daily XP; signing copies; the market fee on trade IxC over 100; a player can ask for a takedown of any card not from NationStates ([the help pages](../../../src/content/help/vault/trading.md) and [Dust, fusion and crafting](../../../src/content/help/vault/crafting.md) say so).

What carries over:

- Auctions created before the deploy keep their old end times and settle under the new settlement, with their backfilled listing fee.
- Pending trades keep working, with the initiator as the proposer.
- Existing copies keep the finish Phase 1 gave them until fused, and existing signatures (none on the clone) keep no frozen name and show the signer's current one.
- Auctions and listings keep their card and serial when their copy is broken down or fused, so market history and a seller's sales survive.
- Players can now ask for takedowns of cards not from NationStates; they arrive in Compliance with origin Player and "Asked by", with the 14-day deadline.

Staff rules:

- **A player's open takedown request blocks an admin's.** While a player's request is open on a card, an admin's author request for the same card gets CONFLICT. Act on the player's row in Compliance, or decline it first.
- **Revoking keeps its rule:** a copy with any market history (an auction or a listing) is not revocable, and the admin sheet says Listed and disables Revoke.
- **Draining the market later:** with the market switch off, players cannot cancel their own listings, so a later window that needs the market empty ends listings by an admin cancel (Vault admin, the player's cards, Market and trades) or by expiry, up to 14 days.

Owner decisions (2026-10-17 and 2026-10-18), and where each was built:

- **An inscription freezes the signer's display name at signing**, refuses a player with no name, and shows the name only while the signer shows Vault cards ([Inscriptions and reports](../../systems/cards.md#inscriptions-and-reports)).
- **Burned copies keep their history:** the auction and listing rows keep the card and serial, and the copy link goes `ON DELETE SET NULL` ([Auctions](../../systems/cards.md#auctions)).
- **The empty rarity tier:** a pack never falls back to another rarity. Its purchase, putting it on sale, awarding it and its open are refused while a rarity it shows or guarantees has no card, and a bought pack stays unopened. The daily card, whose odds are not shown, rolls only over the rarities that have cards ([The daily card, capacity and notices](../../systems/cards.md#the-daily-card-capacity-and-notices)).
- **Player takedown requests** for cards not from NationStates: signed in only, one active request per card, at most 5 waiting per player, an optional contact, and the 14-day deadline ([The hub](../../systems/cards.md#the-hub)).
- **The daily odds add up to 100**, as pack odds do.
- **Pack-level card type editing** is in the Packs tab, beside the type toggles.

For the owner to decide:

- **Stranded packs have no refund path.** Retiring or taking down the last card of a rarity a pack shows strands every bought copy of that pack: it stays unopened until the rarity has cards again. The Packs tab's preview says how many players hold one ("Players hold {n} unopened packs…"), but the list does not badge those rows, and an achievement grant can still hand out a pack that is already stranded. The thinnest pool on the clone is Lore Master Elite, with 1 Epic and 1 Legendary card.
- **Versions and the changelog:** whether Phase 4 bumps the platform version or IxVault's capability integer, and whether the changelog gets one entry now or one for the whole cards refresh, are decided at Phase 6.

Still open (no deploy step):

- Phase 2's SQL recreates `card_transfer_events_cardId_idx` on each deploy and Phase 4's drops it again; a later phase prunes Phase 2's line.
- A Library edit made while a `card-values` run is in flight can be overwritten by that run; the next run corrects it within 6 hours.
- The listing-expiry job, like auction completion, clears no cached balances, so a refunded seller's Wallet catches up within the cache's lifetime.
- A buyout leaves royalty recipients' cached balances stale until the cache expires.
- The trade builder's faces are `w-12` in the table and `w-10` in the card picker, below the phase's `w-20` floor for list rows.

---

## Card categories deploy runbook (owner)

Production and the `ixstats` database are touched only here, by the owner, in this order. The phase needs Phase 4 (its SQL runs after Phase 4's economy SQL); if they go out in one deploy, follow Phase 4's window, and `scripts/deploy-production.sh` runs each phase's SQL in turn. Every script below is a dry run that writes nothing unless it is given `--apply`; read each dry run before applying it. The read-only checks run with `docker exec ixstats-postgres psql -U postgres -d ixstats -c "<query>"`. This runbook describes the phase as merged into `cards/categories` on 2026-10-23 (the plan is `docs/superpowers/plans/2026-10-23-card-categories.md`; the ledger is `.superpowers/sdd/439-card-categories/` in the owner's working tree, which git ignores).

1. **Back up.** `scripts/deploy-production.sh` runs `bun run db:backup` before any SQL and aborts if the dump fails. The SQL is additive, so going back to the old code needs no restore: the old code ignores the new columns and table.
2. **Deploy: the categories SQL goes before the code.** `scripts/deploy-production.sh` applies `prisma/migrations/20261102120000_cards_categories/migration.sql` right after Phase 4's economy SQL and before `db push`, then pushes (a no-op for these tables), builds and reloads PM2. Applied by hand, it is the `psql` command in the file's header, run before the new code starts: the new code reads the new columns. The SQL is one transaction and a no-op when re-run, so the app need not stop (on the `ixstats_cards` clone it ran twice with nothing changed the second time). It adds the `CardCategorySource` and `CardCategorySuggestionStatus` enums; `cards."categorySource"`, `"categoryConfidence"`, `"categoryNeedsReview"`, `"categoryReviewedAt"` and `"categoryReviewedBy"`, with two indexes (the filters' type and category, and the review queue); and the `card_category_suggestions` table. It writes no category: the backfill does (step 5).
   - **The relay comes with the code.** The deploy carries the relay's wider `ALLOWED_API_PARAMS` (`cllimit`, `clshow`, `clcontinue`, `tllimit`, `tlnamespace` and `tlcontinue`, beside `oldid`, `page`, `disableeditsection`, `disablelimitreport` and `imlimit`; [Categories](../../systems/cards.md#categories)). The relay that development uses for IIWiki is the IxWorld standalone at maps.ixwiki.com, so it takes the new list when `scripts/deploy-ixworld.sh` runs. The production backfill does not need it: it reads IIWiki directly.
3. **Check the schema.** `SELECT column_name FROM information_schema.columns WHERE table_name = 'cards' AND column_name LIKE 'category%' ORDER BY 1;` lists `category`, `categoryConfidence`, `categoryNeedsReview`, `categoryReviewedAt`, `categoryReviewedBy` and `categorySource`; `SELECT to_regclass('card_category_suggestions');` names the table.
4. **Retire the six February seed cards:** `bun scripts/cards/retire-seed-cards.ts`. It must list exactly Battle of Corumm, Cathedral of Stars, History of Ixnay, Port of Alkharsis, The Great Migration and Treaty of Kiro; then `bun scripts/cards/retire-seed-cards.ts --apply` retires them, one `CARD_HIDE` audit row each. Held copies stay, worth 0. Run it before the backfill, which skips retired cards. On the clone it found the six and retired them, with 0 listings among them.
5. **Dry-run the backfill on the production server:** `bun scripts/cards/backfill-card-categories.ts`. IIWiki answers `IxStats-Builder` only there, and there the script reads `https://iiwiki.com/api.php` directly (IxWiki through its internal api.php). It makes one request a second, 50 titles each, and caches every answer in `scripts/reports/card-categories-cache.json`.
6. **Check the report** (`scripts/reports/card-categories-<stamp>.md`):
   - "Wikis that stopped" is absent and "Not read" is 0. If a wiki stopped, run the dry run again later: it reuses the cache and reads only what is left.
   - The distribution looks like the clone's (below), with IIWiki's cards now placed too.
   - The confidence histogram still supports 0.45 (`--threshold <n>` previews another from the cache with no new requests; pass the same value to `--apply`).
   - The Abandoned Lore list holds only cards that should go: the apply retires them.
   - Skim the sample per category, the cards below the threshold and the unmapped wiki categories and infoboxes: an unmapped category that many cards share is a rule the tables lack.
   - **Protect the categories admins set before this phase.** In production those cards have `categorySource` null, so the backfill treats them as unclassified and may overwrite them. Read the report's "Changes" table, and before `--apply` set each card there whose current category an admin chose through the Library editor, which records it as `ADMIN`; the backfill then leaves it alone.
7. **Apply it:** `bun scripts/cards/backfill-card-categories.ts --apply`. It writes each planned card (200 a transaction), never over a category an admin, a realm founder or an accepted suggestion set, and never `realmId`; it retires the Abandoned Lore cards (one `CARD_HIDE` audit row each, held copies kept); and, only when every wiki was read and no card was left unread, it sweeps the old `metadata.category` labels. If a wiki stopped during the apply, re-run the same command later: it resumes with the cards it has not reached, and the sweep runs on the run that reads them all.
   - **The sweep needs every card read.** If IIWiki could not be read, re-run `--apply` once it is readable (on the production server it reads iiwiki.com directly): that run classifies IIWiki's cards, sweeps the legacy `metadata.category` labels, and retires any Abandoned Lore cards found then.
8. **Re-run the dry run:** `bun scripts/cards/backfill-card-categories.ts`. It should plan 0 writes (every card "kept"), 0 not read and 0 Abandoned Lore. Redoing every classifier category later (after a mapping change) is `--apply --reclassify`; it still leaves a person's category alone.
9. **Read-only checks:**
   - `SELECT category, count(*), count(*) FILTER (WHERE "categoryNeedsReview") FROM cards WHERE "cardType" = 'LORE' AND NOT "isRetired" GROUP BY 1 ORDER BY 2 DESC;` gives the distribution and what waits for review;
   - `SELECT count(*) FROM cards WHERE "cardType" = 'LORE' AND metadata ? 'category';` is 0 (it stays above 0 while a wiki is unread, since the sweep waits);
   - `SELECT count(*) FROM cards WHERE "cardType" = 'NS' AND category IS NOT NULL;` is 0;
   - `SELECT title, "isRetired" FROM cards WHERE "cardType" = 'LORE' AND "wikiArticleTitle" IS NULL AND "createdAt"::date = '2026-02-16';` lists the six seed cards, all `t`;
   - `SELECT action, count(*) FROM "AuditLog" WHERE action IN ('CARD_HIDE', 'CARD_CATEGORY') AND "timestamp" > now() - interval '1 day' GROUP BY 1;` shows the retirements (six seed cards plus the Abandoned Lore ones) and no category edits yet.
10. **Check the app.** Explore's and Mine's filters show only types and categories that have cards, and Uncategorised only while a lore card has none; a lore card's About shows its category and, signed in, Suggest a category; an NS card's facts line ends "Pretitle: …"; Curation → Categories lists the low-confidence guesses, least confident first; a realm founder's Manage → Cards → Card categories lists their realm's lore cards.
11. **Tell players.** Lore cards now have categories and subcategories, the filters list only what exists, and anyone signed in can suggest a category from a card's About, ten a day ([the lore cards help](../../../src/content/help/vault/lore-cards.md#suggesting-a-category) says so).

What the clone showed (`ixstats_cards`, 2026-10-23; IIWiki could not be read there, through the relay without the new parameters):

- **The first dry run:** IxWiki's 980 cards, AltHistory's 3 and Commons' 2 read; 991 to write, 238 of them below 0.45; 1,399 IIWiki cards not read. The confidence histogram had 488 cards at 0.9 to 1.0, 101 at 0.5 to 0.6 and 37 at 0.4 to 0.5, so the threshold stayed 0.45. Its gaps (security and defence forces, federal subjects, Politics, Ethnic groups) became the community rules, and retired cards were left out.
- **The apply:** 984 cards written (203 for review), 40 Abandoned Lore cards retired with 40 `CARD_HIDE` rows, 7 retired cards skipped, 1,399 IIWiki cards left unread. The sweep did not run, so 1,400 legacy labels remain there. A re-run planned 0 writes and kept 944.
- **The distribution after** (lore cards not retired): Uncategorised 1,402 (nearly all the unread IIWiki cards), Military 174, Geography 167, Government 131, Nation 114, Economy 100, Culture 100, People 89, History 26, Religion 20, Science 12, Diplomacy 7, Special 1.

Owner decisions (2026-10-23), and where each was built:

- **Country articles are Nation cards:** Geography has no country subcategory, and country infoboxes and categories map to Nation ([Categories](../../systems/cards.md#categories)).
- **Realm founders edit their realm's card categories** in Manage → Cards → Card categories, the founder and site admins only, not officers.
- **Player suggestions:** ten a day, one open per card.
- **Uncategorised is for lore cards only** in the filters; the NationStates fact reads "Pretitle"; the review threshold is 0.45, read from the clone's dry run.
- **Abandoned Lore cards are retired**, with an audit row, and the importer refuses Abandoned Lore articles.

Still open (no deploy step):

- **Versions and the changelog:** whether this phase moves the platform version, IxVault's capability integer or the changelog (`docs/reference/revision.md`) is the owner's call; nothing here changes them.
- **Nation cards** (Phase 5, Task 17) are `cardType: "NATION"` with no category, so they never read Uncategorised or enter the category queue; the Nation type appears in the filters once the first is minted.
