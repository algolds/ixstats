# 💎 Vault Cards & Booster Packs Engine

**Last updated:** 2026-10-17

**Parent App Suite:** Vault (`IXVAULT_VERSION = 3`, dev codename `IxVault`)  
**Subsystems:** 3D Card Engine, Booster Pack Gacha, NS Import Bridge  
**Primary Action:** `COLLECT` | **Domain Accent:** Raspberry (`APP_TINTS.vault`)  
**Route:** `/vault/cards`, `/vault/store?tab=store` (`/vault/packs` and `/vault/marketplace` redirect here) | **Status:** Release Candidate (platform 1.5.0) — see [Known Gaps](#known-gaps)  

The Vault Cards system provides 3D holographic collectibles integrating sovereign states, MediaWiki historical lore, NationStates imports, and milestone editions with wiki-signal rarity suggestions and a cinematic pack-opening sequence.

---

## Overview

- **Card types**: LORE, NATION, NS (NationStates), SPECIAL, TROPHY
- **Lore Categories**: 12-value `LoreCategory` enum (`prisma/schema/enums.prisma`) with per-category icons and themes (NS cards carry none)
- **Ownership & Upgrades**: Serial numbers, escrow locking (`isLocked` while listed/traded), and card XP/leveling
- **Pack Mechanics**: Data-driven `CardPack` rows (`packType` BASIC, PREMIUM, ELITE and EVENT seeded; THEMED/SEASONAL defined in `PackType` but unseeded; limited releases are EVENT packs with `limitedQuantity`)
- **Home realm, finish and bound**: every card belongs to one realm (`Card.realmId`: Ixnay, a player realm, or the NationStates, IIWiki and AltHistory system realms); every copy has a finish (`CardOwnership.finish`: Standard, Foil, Holo, Serialised; Phase 1 mints Standard, and Serialised for trophies); `Card.isBound` cards (trophies, achievement cards and commemorative cards) can't be traded, auctioned or listed (`assertNoBoundCopies`, `src/lib/cards/bound.ts`)
- **One mint path**: every copy comes from `mintCopy` (`src/lib/cards/mint.ts`), which takes the serial under a per-card advisory lock and writes the mint row to `CardTransferEvent` with its source
- **Marketplace & P2P Trading**: Live auctions with fee schedules (`cardMarket`), peer-to-peer trade offers with escrow (`trading`)
- **Attribution & Compliance**: Legally-sound attribution footer for NationStates imports, a recorded art licence for every imported Lore card (`CardArtLicence`), and one takedown queue for every card source (the Compliance tab)

---

## Card Types

### 1. NATION Cards
Linked to an IxStates country via `Card.countryId`:
- **Stats**: Cards have no stats (removed 2026-10-15).
- **Valuation**: The `card-values` cron (`src/lib/lorewards/card-value-cron.ts`, every 6 hours) records the market value of NATION cards in `CardValueHistory` and flags changes over 20%. A value comes from rarity and type (`getCardMarketValue`); the former GDP correlation was dead code and is gone. In practice it does nothing today: no NATION card has a `countryId`.
- **Royalty**: when a NATION card sells at auction, 2% goes to the owner of its nation, else the earliest human puller of the card (`auction-service.ts`), the one place a country feeds the Vault economy.
- **Minting**: There is no automatic per-country card generator; NATION cards come from admin creation.

### 2. LORE Cards
Imported from IxWiki, IIWiki, AltHistory and Wikimedia Commons by server-side import jobs (`CardImportJob`, the per-minute `card-import-jobs` cron, `src/server/modules/cards/cards.import-jobs.ts`), started from the Imports tab or queued by the daily `lore-card-generation` cron per switched-on wiki. Every import lands `PENDING` review. Rarity comes from one engine (`src/lib/cards/rarity-engine.ts`) with a threshold table per source wiki (Economy tab). The lead image's licence is recorded in `CardArtLicence`; NC and ND licences are blocked. Players suggest cards for free (`cards.suggestCard`, three a day):
- **Import jobs**: imports run as server jobs (`CardImportJob`, `src/server/modules/cards/cards.import-jobs.ts`), worked by the per-minute `card-import-jobs` cron under one lease, one throttled discovery client per wiki per run. The daily `lore-card-generation` cron (`cards.daily-import.ts`) queues one job per article wiki switched on in the Economy tab (SystemConfig `card_daily_import_<wiki>`; by default IxWiki and IIWiki at 20 a day, AltHistory off), once a day; its cards land pending review, and a wiki whose draw fails fails the cron run by name.
- Categories: `LoreCategory` — MILITARY, DIPLOMACY, GEOGRAPHY, RELIGION, CULTURE, GOVERNMENT, PEOPLE, ECONOMY, SCIENCE, HISTORY, NATION, SPECIAL
- The natural key is the wiki and the canonical article title (`cards_lore_natural_key`), so one article makes one Lore card; a lost race reports `already exists`.
- **Rarity**: `qualityScore()` (`src/lib/cards/rarity-engine.ts`) scores the article from 0 to 100 (length up to 30, references 30, inbound links 20, featured 20, infobox 5, categories 5), and its source wiki's threshold table (`getRarityThresholds`, `cards.config.ts`, edited on the Economy tab) turns the score into the rarity it is imported at. After import, rarity changes only by an audited admin override in the Library.
- **Review and art licence**: an imported card waits `PENDING` in the Curation tab until an admin approves it into packs or rejects it; packs, the daily card and the player library draw only `APPROVED` cards. The importer records the lead image's licence (`CardArtLicence`: OPEN, RESTRICTED or UNKNOWN) and blocks a page whose art is non-commercial or no-derivatives; restricted art never reaches packs (`EXCLUDE_RESTRICTED_ART`, `src/lib/cards/art-licence.ts`), and a card with restricted art cannot be approved.
- **Suggestions**: `cards.suggestCard` (`src/server/modules/cards/cards.suggestions.ts`) takes a free suggestion of an article with no card, up to 3 in any 24 hours per player, from `/vault/lore-generator`. An admin accepts it in Curation (the card is made, approved) or declines it with a reason. Paid lore requests (50 IxC) and lore request tokens have ended: `scripts/cards/convert-lore-requests.ts` turned old requests into suggestions with no refund, and `scripts/cards/refund-lore-tokens.ts` refunds unused bought tokens at their price.

### 3. NS cards
Synchronized from the official NationStates per-season card dumps (`cardlist_S{season}.xml.gz`) via admin-triggered region syncs, plus user deck imports:
- **NS facts**: nation, region, category, season and bank value live in `metadata.nsData` (`src/lib/cards/ns-facts.ts`); the bank value feeds valuation. A deck import runs in one transaction, and each NS card is imported once ever per nation (`NSImportLedger`), from any account.
- **URL-Only Storage**: Stores flag image URLs; no binary bytes persisted to disk or DB.
- **Streaming Proxy (`/api/proxy-ns-image`)**: Server-side proxy (nationstates.net / Wikimedia only, 24h cache, placeholder fallback on 403).
- **Attribution Footer (`NationStatesAttribution.tsx`)**: Pinned footer inside `CardDetailsModal` with fan-site attribution copy and takedown trigger.
- **Self-Service Takedown**: Nation owners verify identity via NS checksum (site-specific HMAC-MD5 token) to hide the card's art through the Compliance queue (`nsImport.requestSelfServiceTakedown`, `cards.compliance.ts`); restore puts it back.
- **Region syncs**: admin-triggered from Imports → NationStates (`cards.admin.nationstates.*`, `src/server/modules/cards/cards.ns-sync.ts`); every card a sync creates waits in Curation.

### Loreward trophy cards
Every recorded Loreward place (daily, weekly or monthly; winner or runner-up) is a one-of-one, Serialised TROPHY card of the winning page, bound to the account it was granted to (`src/lib/lorewards/trophy-cards.ts`):
- **Identity:** `Card.lorewardEntryId` and `Card.lorewardEdition` (`winner` or `runner-up`), unique together. The card carries the contest, place, date and winner in its metadata. Rarity: Legendary for a monthly winner; Epic for a weekly winner and a monthly runner-up; Rare for the rest. A place without a recorded page (weekly and monthly entries, and some older dailies) is titled by contest and date.
- **Minting and granting:** `syncTrophyCards` (called by the Lorewards `fullSync` and `/api/lorewards/sync`, not by the 10-minute state sync) mints the missing cards, then gives each unowned card of an approved entry to its place's account once `resolveLorewardPlace` tells it. The bot scores MediaWiki, where an unlinked WikiOS author's edits arrive as `wikios>Label`. A plain name pays only the exact holder of its verified IxWiki link (an exact match on the normalized name). A `wikios>` name pays the one WikiOS account behind the label's ixwiki edits to the winning page (never a redirect left by a move), from 00:00Z on the contest's first day to 06:00Z after its last (a superset of the bot's US Eastern days); a weekly or monthly with no recorded range, or a label two accounts used, pays no one. Until then the card waits unowned; it is granted once and never re-granted.
- **Backfill:** `bun scripts/backfill-loreward-trophy-cards.ts [--apply]` mints a card for every recorded place back to 2017 with no credits (dry run by default, idempotent).
- **Economy:** a trophy card is a real holding, so the Wallet's deck value and net worth count it, but it is left out of the dividend's collection interest and of the deck-value achievements (excluded by type, `cardType: TROPHY`, and `deckValueExTrophy`). Admin duplicate cleanup (`purgeDuplicateCards`) never deletes one.

### 4. SPECIAL cards
Commemorative milestone editions (e.g. *IxStates 1.0 Ogma Launch*), event cards and achievement cards (commemorative and achievement cards are bound; other event cards are not).

---

## Card Rarity Distribution

```typescript
enum CardRarity {
  COMMON = "COMMON",
  UNCOMMON = "UNCOMMON",
  RARE = "RARE",
  ULTRA_RARE = "ULTRA_RARE",
  EPIC = "EPIC",
  LEGENDARY = "LEGENDARY"
}
```

| Rarity | Default Pack Odds (`CardPack` schema defaults) | Visual Accent | Glow / Shader Effect |
| :--- | :---: | :--- | :--- |
| **Common** | 65.0% | Slate (`#94a3b8`) | None |
| **Uncommon** | 25.0% | Emerald (`#22c55e`) | Subtle ambient glow |
| **Rare** | 7.0% | Sky (`#3b82f6`) | Medium refraction glow |
| **Ultra Rare** | 2.0% | Purple (`#a855f7`) | Strong chromatic glow |
| **Epic** | 0.9% | Amber (`#f59e0b`) | Holographic foil shader |
| **Legendary** | 0.1% | Gold (`#eab308`) | Animated holographic sheen |

---

## Card Packs & Opening Experience

1. **Pack Reveal**: Pulsing 3D pack with "Tap to Open"
2. **Pack Explosion**: Particle shatter effect
3. **Card Reveal**: Flip sequence with rarity-specific audio
4. **Quick actions**: Keep or List (both UI-only for now)

### Pack Tiers
Packs are rows in `CardPack`, seeded from `prisma/seeds/data/card-packs.json` and managed at `/admin/cards`; each row carries its own price, card count, odds, and optional `season` / `cardType` pool filter. Seeded lineup (20 packs; the Season I–IV packs draw from the NS pool):
- **Season I–IV Recruit (BASIC)**: 100 / 120 / 150 / 200 IxC, 5 cards (e.g. S1: Common 70%, Uncommon 22%, Rare 6%, Ultra Rare 1.5%, Epic 0.4%, Legendary 0.1%)
- **Season I–IV Veteran (PREMIUM)**: 500 / 600 / 750 / 1,000 IxC, 5–6 cards
- **Season I–IV Commander Elite (ELITE)**: 2,000 / 2,400 / 3,000 / 4,000 IxC, 8–10 cards
- **Cross-pool packs**: Omni Starter (150), World Summit (3,500), High Roller Mega (5,000), Lore Master Elite (6,000, LORE-only), Championship Event (2,500), Anniversary (8,000), Limited Collector's Edition (12,000, 150 copies), Founder (15,000)

Packs never draw Special or Trophy cards, and a second open of one pack is refused (`CONFLICT`).

Every card rolls its rarity independently against the pack's odds; when the pack has a `guaranteedRarity` and no roll reached it, the last card is raised to that rarity (`generatePackCards`, `src/lib/cards/pack-service.ts`). `themeFilter` narrows the pool by realm, type, category, subcategory or country (`themeFilterWhere`). The pool is approved, unretired cards only, never restricted-licence art and never crafted cards (`packPoolWhere`). Packs are edited in the Packs tab (`cards.admin.packs.*`).

---

## Removed in the cards refresh (2026-10-15)

- Crafting: the `crafting` router, its rule module and seed, `CraftingRecipe` and `CraftingHistory`; the Vault config's `isCraftingEnabled` key and its admin toggle; `/vault/crafting` shows a short "Crafting is retired for now" empty state. The `SPEND_CRAFT` / `CRAFT` enum values stay. Packs still exclude legacy crafted cards by their stored `metadata.crafted` marker.
- Junking: `cards.junkCards`, the junk rate and the batch limit. Historical `JUNK_CARDS` ledger rows keep their label.
- Card stats.
- The `MYTHIC` and `DIVINE` rarities, and the legacy type strings.
- `User.totalCards`, `deckValue`, `collectorLevel` and `collectorXp`: deck value is computed live by `copyValue` (`src/lib/cards/copy-value.ts`).
- The dead `CardTrade`, `NSImport`, `SyncCheckpoint`, `CardPackOpening`, `CardTradeOffer` and `CardBid` tables.

---

## Deploy runbook notes

The full Phase 1 production runbook lives in the Phase 1 plan, and Phase 2's is [at the end of this page](#phase-2-deploy-runbook-owner); three Phase 1 points to keep in mind:
- **Stop the app first.** Run `pm2 stop` for the app server and the PM2 processes (`ixstats-cron`, `ixstats-ws`, `ixstats-ixtwitter`) before the deploy. `scripts/deploy-production.sh` runs the backfill and the constraint SQL before the build, so no old code may run between the destructive SQL and the new build.
- **Resolve copies held as `quantity > 1` before the deploy.** The constraint SQL drops `CardOwnership.quantity`, so it refuses while any copy holds more than one, and the backfill dry run reports the count as `multiQuantityCopies` and fails (exit 1) while it is above 0. Read it in the production dry run (`SELECT id, "cardId", "ownerId", quantity FROM "CardOwnership" WHERE quantity > 1`) and settle each row by hand; nothing splits them automatically.
- Run `bun scripts/cards/import-special-cards.ts --apply` after the deploy: it creates or points the five achievement Special cards (`realmId`, `isBound`, `rewardAchievementKey`) and awards earlier unlocks.

---

## Routers & Data Architecture

All card operations route through modularized subdirectories:
- `src/server/api/routers/cards/` (`index.ts`, `inventory.ts`, `collections.ts`, `suggestions.ts`, `_library.ts`, `admin/` with one sub-router per admin tab)
- `src/server/api/routers/card-packs/` (`index.ts`, `user.ts`, `discovery.ts`)
- `src/server/api/routers/card-market/` (`auctionManagement.ts`, `auctionQueries.ts`, `bids.ts`, `analytics.ts`)
- `src/server/api/routers/cardImages.ts` (card XP helpers live in `src/lib/cards/xp-utils.ts`)
- `src/server/api/routers/lore-cards/` (`index.ts`, `gallery.ts`, `wiki.ts`)
- `src/server/api/routers/ns-import/` (`index.ts`, `verification.ts`, `decks.ts`, `cards.ts`)
- `src/server/api/routers/trading/`

---

## Cards admin

`/admin/cards` has nine tabs (`src/app/admin/cards/cards-admin-tabs.ts`; older `?tab=` values such as `explorer`, `requests` and `takedowns` open the tab that replaced them). Every procedure is `adminProcedure` under `cards.admin.*`, one sub-router per tab plus `nationstates` and `tools` (`src/server/api/routers/cards/admin/`, pinned by `src/tests/architecture/cards-admin-gate.test.ts`), and each tab's logic is a module in `src/server/modules/cards/`. Every admin action writes an `AuditLog` row (`cards.audit.ts`), which the Overview feed reads.
- **Overview** (`cards.overview.ts`): counts, what waits on an admin (pending review, running imports and NationStates syncs, open and overdue takedowns) and a card-only activity feed. The feed names who acted ("System" for a cron or a flag owner) and the card or player each row is on, resolved in a few batched reads; the tab shows rarities, types, source wikis and Economy fields by their labels (`overview/feed-detail.ts`).
- **Library** (`cards.library.ts`): a realm-scoped explorer over every card (realm, type, rarity, source wiki, retired, art hidden, bound), an edit whose rarity change asks why, and bulk hide (retire) of a narrowed filter, which leaves achievement reward cards alone. Art a takedown hides, or whose licence is restricted, changes only from Compliance.
- **Imports** (`cards.import-crawl.ts`, `cards.import-jobs.ts`, `cards.importer.ts`, `cards.daily-import.ts`): find pages (a category's articles, a Commons category's files, a whole wiki or a pasted list), queue an import job, and follow its items; the NationStates sub-tab runs region syncs, pause, resume, stop and the CTE filter (`cards.ns-sync.ts`, `cards.admin.nationstates.*`).
- **Curation** (`cards.curation.ts`): the review queue (approve or reject chosen cards, or a filter exactly as the admin saw it, up to 2,000 at once; restricted art is never approved) and the suggestion queue (accept makes the card, decline gives a reason).
- **Packs** (`cards.packs.ts`): odds that add up to 100, a pool by realm, type and category, a guaranteed rarity that can be cleared, limits and expiry, and a preview of the pool.
- **Economy** (`cards.economy.ts`, `cards.config.ts`): card values (saving revalues every card), market fee and base capacity, bonuses with the Loreward payout grid, each source wiki's rarity table, and each article wiki's daily import.
- **Seasons** (`cards.seasons.ts`): the interim card season (SystemConfig `currentIxCardSeason`) new Lore and trophy cards take.
- **Compliance** (`cards.compliance.ts`, `cards.art-licence.ts`): one takedown queue for every source, answered within 14 days (hide the art, or decline with the reason; restore puts hidden art back), and licence review of unknown or restricted art.
- **Designer** (`cards.designer.ts`): Special card definitions, event cards (bound or not) and achievement reward cards (always bound, one per achievement).

Outside the tabs:
- **Player card tools** (`cards.tools.ts`, `cards.admin.tools.*`): the Vault admin's user directory (`/admin/vault`) → **Cards and packs** shows a player's copies, unopened packs, auctions and pending trades, and grants or revokes a card (with a reason), awards a pack, cancels an auction (refunding its bid and half the listing fee) and voids a trade.
- **Trophy fixes** (`cards.trophies.ts`): an admin override of a Loreward winner or runner-up (`lorewards.overrideWinner`, `admin.wiki.saveLorewardWinnerOverride`) is written to every entry of its contest, marked `overriddenAt` so no sync writes over it, and reassigns or voids each changed place's trophy, with an audit row, a transfer event and a provenance note.

---

## Known Gaps

- Stage 4 "Keep" and "List" quick actions only log.
- The pack-level card type (`CardPack.cardType`, set on 14 of the 20 seeded packs) cannot be edited in the Packs tab.
- No admin screen lists rejected cards to approve them again (`cards.admin.curation.review` accepts a rejected card by id).
- Pack artwork referenced by the seed (`/images/packs/pack_*.svg`) is not in the repo (`public/images/*` is git-ignored).

---

## Related Documentation

- [MyVault System Guide](./myvault.md)
- [IxCredits Economy Guide](./ixcredits.md)
- [NationStates Integration Guide](./ns-integration.md)
- [API Reference: IxVault (Cards & Credits)](../reference/api-complete.md)

---

## Phase 2 deploy runbook (owner)

Production and the `ixstats` database are touched only here, by the owner, in this order. Every script below is a dry run that writes nothing unless it is given `--apply`; read each dry run before applying it. Every step is idempotent, so a failed step is fixed and re-run. The read-only checks run with `docker exec ixstats-postgres psql -U postgres -d ixstats -c "<query>"`.

1. **Phase 1 first.** Phase 1's deploy (its additive SQL, `backfill-cards-refresh.ts --apply` and the constraint SQL; the Phase 1 plan's runbook) must be complete. If both phases go out in one deploy, follow Phase 1's window (drain auctions and trades, its dry run, the app stopped); `scripts/deploy-production.sh` runs Phase 1's lines before Phase 2's.
   - **The Lorewards chores fix comes too.** This branch carries rose-garden's Lorewards fix (one payout per contest and place, `lorewards/payout.ts`), so if rose-garden has not deployed first, that fix ships in this deploy and its owner items come with it. The details are in the Phase 2 ledger (`.superpowers/sdd/435-cards-phase-2/progress.md` in the owner's working tree, which git ignores) and the Phase 1 chores reviews beside it:
     - check how the bot writes a `wikios>` winner or runner-up on the OOL page, which the OOL sync reads names from (0 `wikios>` entries on both clones, so nothing has shown it yet);
     - check the bot webhook's weekly and monthly dates: the webhook (`src/app/api/bot/lorewards/sync/route.ts`) is a third writer of contest rows, and a weekly or monthly `wikios>` place it writes with no `dateStart` pays no one;
     - audit the payouts made through 44adbcac3's fallback, if it ever ran on production data (0 on both clones);
     - settle the W14 and W18 twins at the source (the `OOL/2026` page, or the state-keyed copy through the bot): their state-file and OOL entries name different winners (Nasastan and Urcea), and disagreeing twins pay no one until an admin override;
     - the state file's late twins: the OOL-only weeks from 2026-08-24 to 2026-09-21 come after the state file's last week (W34), so the next state sync twins whichever of them the file holds;
     - the app-wide mutation retry (the first owner decision below).
2. **Read-only checks before the deploy.** Note each result:
   - Crafted cards, which packs still exclude by a lookup (`packPoolWhere`): `SELECT count(*) FROM cards WHERE metadata->>'crafted' = 'true' OR (description LIKE 'Crafted via %' AND "totalSupply" = 1);`. If it is 0, Phase 4's pool-drawer rework drops the lookup.
   - Trophy cards with auction or trade history: `SELECT count(*) FROM "CardAuction" a JOIN "CardOwnership" o ON o.id = a."cardInstanceId" JOIN cards c ON c.id = o."cardId" WHERE c."cardType" = 'TROPHY';` and `SELECT count(*) FROM "TradeOffer" t WHERE t.status = 'PENDING' AND EXISTS (SELECT 1 FROM "CardOwnership" o JOIN cards c ON c.id = o."cardId" WHERE c."cardType" = 'TROPHY' AND (t."initiatorCardIds" ? o.id OR t."recipientCardIds" ? o.id));`. Expect 0 for both: a Loreward override that voids such a copy is refused (`PRECONDITION_FAILED`), because removing a copy never erases its market history.
   - Legacy Commons cards (from the old flag importer): `SELECT count(*) FROM cards WHERE "cardType" = 'LORE' AND metadata ? 'commonsCategory';`. The Phase 2 SQL tags them `wikiSource = 'commons'` (step 4 checks it), so the Commons importer sees them and the Library lists them under Commons.
   - Legacy NationStates takedowns: `SELECT count(*) FROM cards WHERE metadata ? 'nsTakedown';`. The compliance backfill (step 6) brings each into the Compliance queue.
3. **Back up.** `scripts/deploy-production.sh` runs `bun run db:backup` before any SQL and aborts if the dump fails. Take another `bun run db:backup` before the one-off scripts in step 6.
   - **A rollback means a restore.** Going back to pre-Phase-2 code takes the pre-deploy dump with it: `bun run deploy:rollback -- <rollback-branch> --restore backups/ixstats-<stamp>.dump` (the [release guide](../operations/release-guide.md#rollback)). Code alone is not enough: the old pack pool has no review filter, so every import waiting in Curation (`PENDING`) would drop from packs.
4. **Deploy.** `scripts/deploy-production.sh` applies `prisma/migrations/20261028120000_cards_admin/migration.sql` right after Phase 1's constraint SQL, before the push, then builds and reloads PM2. The SQL is one transaction and a no-op when re-run. Check afterwards:
   - `SELECT to_regclass('card_takedowns'), to_regclass('card_import_jobs'), to_regclass('card_import_items'), to_regclass('card_art_licences');` names all four tables;
   - `SELECT "reviewState", count(*) FROM cards GROUP BY 1;` shows every existing card `APPROVED`;
   - `SELECT confdeltype FROM pg_constraint WHERE conname = 'card_transfer_events_ownershipId_fkey';` is `n` (ON DELETE SET NULL), and `loreward_entries."overriddenAt"` exists;
   - the legacy Commons count from step 2 now also matches `... AND "wikiSource" = 'commons'`.
5. **Cron.** After the new code is live, add `card-import-jobs` to `CRON_ENABLED_JOBS` (unless it is `*`; keep `lore-card-generation`) and restart the cron runner (`pm2 restart ixstats-cron --update-env`). Not before: the old cron runner refuses to start on a job name it does not know. Without the job, the daily import's jobs are queued and never worked, and a manual import stops after the first run the Imports tab starts.
6. **One-off scripts**, each a dry run first, then `--apply`:
   1. `bun scripts/cards/backfill-card-compliance.ts`, then `bun scripts/cards/backfill-card-compliance.ts --apply --fetch` on the production server (IIWiki answers only there), which records the licence each wiki states and hides restricted art by a licence review takedown. `--apply` alone records every licence UNKNOWN, and a later `--fetch` then has nothing left to read. The `--fetch` run takes about 20 minutes, most of it reading the IIWiki cards' file pages; let it finish. Run this right after the deploy, before anyone uses the Library or Compliance: the Library's art hold reads takedown rows, so a legacy NationStates takedown is invisible to it until this has run. Re-run it if it lists cards it could not hide.
   2. `bun scripts/cards/import-special-cards.ts`: creates or points the five achievement reward Special cards (`realmId`, `isBound`, `rewardAchievementKey`) and awards each to players who already hold its achievement. Then check for Special cards with no kind that players hold: `SELECT c.id, c.title, count(o.id) FROM cards c JOIN "CardOwnership" o ON o."cardId" = c.id WHERE c."cardType" = 'SPECIAL' AND c."specialKind" IS NULL GROUP BY c.id, c.title;`. For each card listed, decide its kind and set `"specialKind"` by SQL: the Designer treats a held card with no kind as an event card and refuses to change the kind of a card players hold.
   3. `bun scripts/cards/convert-lore-requests.ts`: old paid lore requests become free suggestions (approved requests not yet made go back to waiting, open ones get a realm). No refund is paid.
   4. `bun scripts/cards/refund-lore-tokens.ts`: refunds every unused lore request token a player bought, at what they paid (a `REFUND` row keyed `retired_item_refund:<purchase id>`), and withdraws the token items from the store. Run it after `bun run audit:vault-exploits:apply` (the shortfalls that took back count as paid; run `bun run audit:vault-exploits` first if it has not run), and read the dry run's players, tokens and IxC before applying.
7. **Check.** `/admin/cards` loads all nine tabs, and old links (`?tab=explorer`, `?tab=requests`, `?tab=takedowns`) land on the tabs that replaced them; Compliance → Licence review lists the unknown licences; a backfilled NationStates takedown restores (if step 2 found any); the next daily import (02:00 UTC) queues one job per switched-on wiki (IxWiki and IIWiki by default) and the cron works it; an IIWiki category crawl works from production.
8. **Tell players.** Lore tokens and paid lore requests have ended, suggestions are free (three a day), and unused bought tokens come back as a refund in the Wallet ([the help page](../../src/content/help/vault/lore-cards.md) says so).

Owner decisions this phase leaves open (no deploy step):
- `src/trpc/query-client.ts` retries every mutation once in production, so a committed money mutation whose response is lost (a bid, a purchase, a pack open) can run twice; the fix is `mutations.retry: 0`, app-wide.
- Revoking a copy with any auction row is refused, because `CardAuction` and `AuctionBid` cascade on copy delete. If revoking ever-auctioned copies matters, make `CardAuction.cardInstanceId` `SET NULL` or transfer to a system holder.
- The Packs tab cannot edit a pack's card type, and no screen re-approves a rejected card (Known Gaps).
- A Serialised grant of a card with unlimited supply is possible through the API only.
- When a player's used lore tokens exceed their non-retired ones, the excess is counted against archetype token purchases, which their own script refunds in full. Exploit-audit corrections of 0 IxC count as paid.
- An index on `vault_transactions(type, source)` in a later migration: the Loreward paid check scans `EARN_BONUS` rows.
- The about 19 MB of git-ignored `public/icons` game icons have no readers since the Designer rebuild.
