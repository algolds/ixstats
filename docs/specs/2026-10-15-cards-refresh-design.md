# Cards refresh: design

**Date:** 2026-10-15
**Status:** Approved in conversation; awaiting written-spec review
**Scope:** LoreCards, NS cards, the Vault card system and the cards admin (data, import, economy, UI/UX)
**Builds on:** `2026-08-13-ixcards-lore-first-rebuild.md`, `2026-10-14-vault-collectathon-hub-design.md` (set completion returns here), `2026-10-11-realm-content-licensing-drafts.md` (attribution and takedown duties)

This is the umbrella spec for the whole refresh. It covers:

- every owner decision (section 2);
- the defaults taken from the 2026-10-15 audits, which the owner may veto (section 3);
- the split into six phases (section 4);
- Phase 1 in detail (section 5).

Phases 2 to 6 each get their own spec and plan when they start.

## 1. Goal

Cards become a **collectathon across realms**. Trading stays a core loop. The design should push players to collect and trade across realms.

Success means:

- Every card has a home realm, and every surface can slice by realm.
- A player can always see what exists, what they own, what they are missing and how to get it (pack, market, trade, craft).
- One card face and one detail view everywhere.
- One admin that imports from IxWiki, IIWiki, AltHistory, Wikimedia Commons and NationStates, with licence capture and review.
- No card stats, no half-built controls, no dead tables and no legacy flows left behind.

## 2. Owner decisions

### 2.1 Model

| Topic | Decision |
|---|---|
| Card realm | Every card has one **home realm**, kept forever. Ixnay (`Realm.id = "default"`) is one realm among many. |
| NationStates | NS is its own **system realm**. Its cards keep their NS seasons and rarities, count toward sets and leaderboards, and stay tradeable. One import UI (`/vault/import`). |
| Other wikis | Lore cards whose article is a realm's imported page (`RealmPage`) belong to that realm. Remaining iiwiki and althistory lore goes to an **IIWiki** or **AltHistory** system realm. Commons flag cards are Lore cards in Ixnay. |
| Card types | `LORE`, `NATION`, `NS`, `SPECIAL` (achievement and event cards), `TROPHY` (Loreward places and sports championships). |
| Nation cards | Auto-minted for every claimed nation in every realm, with **one edition per site season**. An edition snapshots flag, name and leader only. The nation's owner receives copy #1 of each edition (Serialised); further copies come from that realm's packs. |
| Bound cards | Bound cards (`Card.isBound`) cannot be traded, listed, dusted or fused. They are: trophies (Loreward places, and sports championships bound to the winning team's manager), and achievement reward cards. Event cards are tradeable by default, with the "bound" toggle in the Designer. |
| Rarity | 6 tiers as a real enum, in NS order: Common, Uncommon, Rare, Ultra Rare, Epic, Legendary. Set at import by **one rarity engine** with a threshold table per source wiki, then frozen. An admin override is audited and pays nothing retroactively. Realm owners cannot change rarity. Mythic and Divine are removed. |
| Finish | Per copy: Standard, Foil, Holo, Serialised. Rolled at mint, and upgraded by fusing duplicates. Serialised only for limited runs, nation copy #1 and trophies. |
| Card stats | **Removed entirely**. That means no stat bars, stats tab or hover stats, no stats on the back, and nothing that computes them. Card levels and XP are not stats and stay. NS metadata survives only as facts: the back and the detail sheet show a provenance line (nation, NS season, region, category, link to NationStates, attribution). Region stays a filter. Government, badges and trophies are dropped. |
| Minting | Automatic from realm content. Every automatic or manual import lands **pending review**; an admin (or, for a user realm, its owner) approves it into packs. Realm owners can also veto (hide from packs; owned copies stay), feature, name sets and seasons, and upload art (admin-approved). Admins act as owners for system realms. New-card requests go to the curation queue for free. |

### 2.2 Acquisition and economy

| Topic | Decision |
|---|---|
| Packs | Each realm has its own packs, and **anyone can buy any realm's pack**. There are also a few cross-realm packs themed by category. Pack odds are shown in the store. |
| Daily card | Drawn by pack odds from **any realm**. Excludes bound, Special, Trophy and Nation cards, and respects inventory capacity. The existing choice between credits and a card stays. |
| Starter | No starter pack: the daily card is enough. Empty states point to Explore and the store. |
| Trading | Keep P2P offers (cards plus credits, counter-offers). Keep auctions, at **24h, 3 days or 7 days**. Add **fixed-price listings** and **wishlists** (reusing `CardWatchlist`). |
| Fees | The 10% market fee over 100 IxC also applies to **credits that change hands in a trade**. Card-for-card trades stay free. |
| Royalty | 2% to a nation card's owner, **paid out of the market fee** (no new credits), on auctions, listings and trade credit legs. Paid only when the nation has an owner who is not a party to the sale. No fallback recipient. |
| Junk | **Removed.** |
| Paid lore requests | **Removed.** Existing pending and approved requests become free curation suggestions, **with no refund**. Unspent lore tokens are **refunded at purchase price** through the retired-store-item refund path, and the token perk is deleted. |
| Dust and crafting | Breaking down a card gives **dust of its home realm**. Dust is account-bound and per realm. Crafting makes any existing card of that realm, up to Epic, for dust plus credits. |
| NS import | Each NS card of a nation can be imported **once ever, across all accounts** (an import ledger). Imported copies break down for **a quarter** of the normal dust. |
| Card levels | Levels 1 to 10 from XP for acquiring, trading and holding a card. The level shows at size L and in the sheet, and nudges value. |
| Inscriptions | An owner can sign a card once (60 characters, sanitised, reportable). The inscription travels with the card. The trade block on inscribed cards is removed. |
| Value | The higher of floor × type × finish and the market median. Before an NS card's first sale here, the NS bank value × 1.5 is a third term. Plus the level bonus. |
| Sets | Automatic realm sets (by category; NS by NS season), owner-named realm sets, admin cross-realm sets, and seasons. Completing a set pays out. |
| Collections | Both **set binders** (automatic, by card) and **free-form showcases** (player-made, by copy). Likes and comments are removed. Existing collections migrate into showcases. |
| Cross-realm levers | Cross-realm sets, a cross-realm trade bonus, and realm leaderboards. Realm-locked packs were rejected. |

Default numbers. All are admin-tunable in the Economy tab and SystemConfig-backed:

| Item | Default |
|---|---|
| Finish roll at mint | Standard 90%, Foil 8%, Holo 2% |
| Fusion | 3 copies of one card at the same finish make 1 copy at the next finish. The result keeps the lowest serial. Inscribed, Serialised and bound copies cannot be fused or broken down. |
| Dust from a Standard copy | Common 5, Uncommon 15, Rare 50, Ultra Rare 150, Epic 500, Legendary 1,500. Foil gives ×3 and Holo ×9 (equal to fusion, so fusing then breaking down gains nothing). Imported NS copies give ×0.25. |
| Crafting cost | 8× the Standard dust yield, plus credits equal to the rarity floor. For example, Common is 40 dust + 10 IxC, and Epic is 4,000 dust + 1,000 IxC. Legendary, Serialised and bound cards cannot be crafted. |
| Value | Finish multipliers: Foil ×3, Holo ×9. The market median is over the last 5 sales in 30 days. Level bonus: +2% per level above 1, capped at +20%. A new `mult_trophy` key sets display value for trophies; trophies stay out of the dividend. |
| Market fees | 5 IxC to list (10 IxC featured), with 50% refunded on cancel or expiry. 10% of sales over 100 IxC, also charged on trade credit legs. Listings expire after 14 days. |
| Cross-realm trade bonus | A completed trade is cross-realm when each side gives at least one card and some card on one side has a home realm that no card on the other side has. The flag is stored on the trade when it is accepted. Such a trade counts 10 instead of 5 in the dividend's cards part (the existing cap of 20 stays) and gives double card XP. The bonus applies once per trading partner per day. |
| Set completion | A one-time payout of 50% of the set's summed rarity floors, plus a badge. It is paid on first completion only, idempotent per player and set, and only while the player holds the cards. Cross-realm sets also count toward a collector achievement. |
| Seasons | A site season each quarter. Realm seasons are run by the realm owner. A season's packs rotate out at its end; its cards keep their season and stay tradeable, and unopened packs stay openable. Nation editions mint at each site season start. |
| Leaderboards | Weekly, per realm: copies collected, trade count, trade volume, total value. They respect the `vaultCards` privacy setting and exclude repeat trades with the same partner. |
| XP | Pack +10, daily +10, trade +25 per card, auction win +50, plus a holding tick. Each copy is capped per day. Levels are capped at 10 (existing copies are clamped; their XP is kept). |

### 2.3 UI/UX

| Topic | Decision |
|---|---|
| Card face | **One component**, art-first, in sizes S, M and L, at a 5:7 aspect ratio. Full-bleed art, with title and realm crest at the bottom (the NS crest is the NationStates logo). Rarity shows as the edge colour plus a gem; finish as sheen. NS and Nation cards also show a small season chip. Level and serial appear only at size L. Nothing else is on the front: no stats, excerpt, country, value, category seal, glows, hover pulses or hover stats. Used everywhere: trophies, auction rows, import tiles, the daily reward and the pack reveal. The face is a real button whose accessible name is title, rarity, finish and realm. |
| Card back | Provenance: realm crest and set, serial and finish, inscription (the signer's handle frozen at signing), level and XP, the ownership trail (handles, minted, traded, sold), the art credit and licence, and the NS provenance line for NS cards. Colours come from the one Facet rarity palette. |
| Motion | Grids are still, with only a subtle finish sheen. 3D tilt and holo appear only in the detail sheet and the pack reveal. Respects Reduce motion. The site's reveal sound and light haptics are used for rarer flips, following the existing sound settings. |
| Detail sheet | **One sheet, no tabs**, opened by `?card=<id>` (shareable as a copied link; no image export). A large card that flips (Space or F). Then, in order: your copies with actions (list, fuse, dust, inscribe, add to binder), market (price, listings, history), about (lore excerpt, wiki link, author and art credit, takedown link), and the sets it belongs to. Stacks on phones. Card cosmetics are not wired into it. |
| Hub | **Mine / Sets / Market / Explore** at `/vault/cards/{mine,sets,market,explore}`. Every old card URL redirects permanently: `inventory`, `collections`, `lore-gallery`, `ns-library`, `ns-deck`, `packs`, `market`, `marketplace`, `trading`, `crafting`, `lore-generator` and `/explore/collections`. The PWA shortcuts, service worker precache, Halo entries, nav match lists and help links are updated with them. The market moves into the hub from Store; Store keeps packs, cosmetics and upgrades. Its "Marketplace" tab is renamed "Packs". |
| Mine | Grid (size S) or list (with a value column). Filters: realm, rarity, finish, type, category, duplicates. Search, sort, and a select mode for bulk fuse, list, dust and add to binder. |
| Sets | Binders use **silhouettes** for missing cards. Free-form showcases sit alongside. The wallet and Passport showcases read the player's pinned showcase, falling back to their top cards by value. |
| Discovery | **Unowned art is hidden everywhere**, enforced on the server (artwork is stripped from payloads). Silhouettes show title, realm, rarity and number. Art shows once you own a copy, and for anyone viewing a live listing, another player's showcase, or a trade offer made to them. NS flag art is public on NationStates anyway and is exempt from the proxy check. |
| Explore | Realm shelves first (banner, card and set counts, newest and most-wanted), then a filtered grid. |
| Market | Sub-tabs: Browse (listings and auctions; "ending soon" is a sort), Trades (incoming, outgoing, and history including auctions), Wishlist, Selling (your listings and your bids). The "Success rate" tile goes. |
| Trade builder | A two-column "You give / You get" table with cards and credits. It needs at least one card in total, so credits for a card works; a one-sided trade is a gift. Start it from a card or a player, found by IxnayID handle. The partner's trade privacy is shown before building. Their tradeable cards are filterable, and the cards on your wishlist are highlighted. Counter-offers really edit the same table. |
| Wishlist | Visible to trade partners while they build a trade with you. Everyone else sees anonymous totals ("wanted by 12"), which feed the most-wanted shelves. |
| Notifications | In-app, with a per-card mute. Existing: trade offered or accepted, outbid, auction won or sold. New: listing sold or expired, auction you are in ended, set completed or one card away, your nation's new edition minted, royalty paid. Pack events get their own category. |
| Pack opening | One short reveal: tear, cards fan out face down, tap, swipe or arrow keys to flip (rarer cards get a longer beat), Skip and Reveal all (Esc). It ends on a summary with real actions. |
| Device | Every card screen is designed at phone and desktop widths from the start. |
| Other surfaces | Passport (showcase and set progress, under `vaultCards`, which stays the master switch), realm pages (sets, most-wanted, leaderboards), forum and ThinkPages (a pinned showcase card), the achievements UI (a "card reward" chip), and Halo search (card titles, silhouette rules applied). **Not** wiki article pages. |
| Deleted | The Compare tab. Collection likes, comments and the carousel. `/explore/collections`. `/vault/ns-deck`, `/vault/ns-deck/[nation]` and `ImportWizard`. `/vault/lore-generator`. The four-stage pack cinematic and `GlassSplashEffect`. About 7 bespoke card renderers and the procedural/emoji covers (no-art cards show the realm crest on the rarity tint). The Settings NS card list (trimmed to an import link, the last import and takedown). The duplicate daily claim in Settings. |

### 2.4 Cards admin

| Topic | Decision |
|---|---|
| Shape | `/admin/cards` has **9 flat tabs**, described below. `/vault/admin`, the orphan `/api/wiki/*` lore routes and the duplicate Reference Data links go. Card procedures move out of the `cards` router into an `admin` subdirectory, following the router-modularisation pattern. |
| Overview | Counts by type, realm and rarity; pending review; active jobs; a card-only activity feed. |
| Library | A realm-scoped explorer (realm, type, rarity, source wiki, hidden, bound, retired), with an edit dialog (rarity override, art, hide) and bulk hide. |
| Imports | **One wiki importer** for IxWiki, IIWiki, AltHistory and Commons: category and page crawl, preview with licence and rarity, sent to review. Plus NationStates: region sync, CTE filter, season dumps, job history. Imports run as server jobs, so closing the tab does not stop them. |
| Curation | The review queue and the request suggestions, for system realms (admins act as owner) and for any realm on owner escalation. |
| Packs | A **full pack editor**: odds per rarity, a pool filter by realm, type and category, a guaranteed rarity that can be cleared, limits and expiry, plus a pool preview. |
| Economy | Every formula number in 2.2, plus capacity, fees and the card bonuses (moved from Vault, including the Loreward payout grid). Rarity threshold tables per source wiki. The cron on/off switch and daily count per source. |
| Seasons | The interim integer (`currentIxCardSeason`) until Phase 5's `Season` model replaces it. |
| Compliance | **One takedown queue for every source**, with reason, source and a 14-day deadline. Art is hidden reversibly and restore really restores it. Licence review. NS self-service takedown keeps working on top. |
| Designer | Admin-only, and makes **Special cards** (event and achievement reward definitions, stored in the database). Achievement rewards point at them; the CLI seed becomes a one-time import. The editor uses the rarity and type enums and a realm field, and has no bespoke face styling (the face ignores emblem, accent and foil fields). |
| Licensing | On import, record the lead image's wiki, file, licence, author and source URL (reusing `realms/sources/wiki-file-info.ts`). Show a credit line on the back and in the sheet. **Block imports whose licence is non-commercial or no-derivatives.** Keep hotlinking through the media proxy, extended to Fandom's image CDN. |
| Trophy fixes | Overriding a Loreward winner **reassigns or voids** the trophy, with an audit row and a provenance note. This is the only way a bound card moves. |
| New tools | **Grant and revoke** a card to or from a player (with reason and audit). A **player card inventory** in the Vault user directory (cards, packs, listings, trades). **Cancel auctions and listings, void trades**, refunding escrow, with audit. **Nation edition control** (who has this season's edition, mint a missing one, skip a nation). |
| Commons | Kept as a wiki-like source: Lore cards in Ixnay, with licence capture and no free copy for the importing admin. |

## 3. Defaults taken from the audits (owner may veto)

**Security and correctness.** These are fixed in the phase that touches each one, and in Phase 1 at the latest:

- Admin-gate the wiki discovery procedures, `getLoreStats` and the admin explorer read. Today they are public or ordinary signed-in procedures.
- Remove the database write from the public `getCardAuthorInfo`.
- `cards.getUserCards` returns only the partner's tradeable copies.
- Delete `nsImport.refreshCardValues`, which lets any user drive NS API calls and rewrite global values, and `fetchPublicDeck`.
- Fix `getActiveAuctions`, which filters after paginating.
- Write `CardTransferEvent` rows for every transfer: mint (with source), sale (with price), trade, grant, revoke, reassign. Keep the existing action names.
- Add every new model to the read-only database allow-list.
- Make the pack seed create-only, so it stops overwriting admin edits.
- Fix the dangling `vidmaster-lore-pack` achievement reward.

**Data.**

- Drop `User.totalCards`, `deckValue`, `collectorLevel` and `collectorXp`; compute them live from one shared per-copy value function. That function is used by the dividend, wallet, Passport and achievements.
- `Card.totalSupply` is enforced only for Serialised runs.
- A Lore card and a Trophy card may exist for the same article.
- NS cards get a null `category`; their automatic sets go by NS season.
- A realm with cards cannot be deleted (archive it instead), and `isSystem` realms are never deletable.
- Curation and royalty rights follow `Realm.ownerId`. For an ownerless realm, admins act.
- Trophies stay with the account they were granted to.

**Content flow.**

- Automatic realm minting drips with a daily cap per realm. Nation-kind realm pages do not mint Lore cards.
- Anyone signed in may suggest an uncarded article, up to 3 a day. Approval may bypass the length gate but never the licence gate.
- Realm-owner art uploads go through an admin approval queue.
- Retired or taken-down cards stay in Mine with a placeholder face, stay tradeable, and still count in set slots.

**UX details.**

- Rarity palette: adopt the hues the cards render today (`display-utils.ts`) as the Facet rarity tokens. Delete the unused `--color-rarity-*` values and CardBack's own themes.
- The NS import consent checkbox moves into `/vault/import`.
- Inventory capacity stays (capacity perks are still sold). It counts copies and is enforced on new-copy sources only: packs, daily, import, craft and grant.
- Help pages and `docs/systems/*` are rewritten in the phase that changes them. The platform version bump is asked at the end of each phase (CLAUDE.md).

## 4. Phases

Each phase is one PR, merged into `rose-garden`. Each later phase gets its own spec and plan.

| Phase | Scope |
|---|---|
| **1. Foundations** | Home realm, enums, finish column, card types, **stats removal**, NS metadata move, integrity fixes, the NS import ledger, junk removal, security fixes, legacy migration, dead-schema drop (section 5). |
| **2. Admin and importers** | The 9-tab admin (2.4). The one wiki importer for IxWiki, IIWiki, AltHistory and Commons, covering: source widening (about 25 hard-coded sites), licence capture and gate, Fandom CDN proxying, the pending-review state, one rarity engine with per-wiki tables, and server-side import jobs. Also the curation queue, converting old paid requests and refunding tokens, the compliance queue, the pack editor, the Designer for Special cards, trophy reassign and void, and the four new admin tools. AltHistory starts with a spike to confirm Fandom's API supports `extracts`, `pageimages` and `contributors`. |
| **3. Face and hub** | One card face, back and detail sheet. The hub with working controls: Mine and Explore in full; Sets with free-form showcases (with collections migrated, then `CollectionLike` and `CollectionComment` dropped); Market with today's auctions and trades. Server-side silhouettes. Pack reveal. Routes and redirects. The deletions in 2.3. Binders, listings and wishlists fill their tabs in Phases 4 and 5. |
| **4. Economy** | Finish roll, fusion, dust (including the import discount), crafting, fixed-price listings, wishlist, longer auctions, the value formula and sales record, fees on trade credits, the royalty rework, card levels and XP caps, inscriptions, the two-column trade table, the daily card pool, notifications. |
| **5. Realm loop** | `Season` model, realm and cross-realm sets, binders and set rewards, owner curation, realm packs, nation cards and editions, leaderboards, cross-realm trade bonus. |
| **6. Surfaces** | Passport showcase and set progress, realm page card blocks, forum and ThinkPages pinned card, the achievements card-reward chip, Halo card search. |

## 5. Phase 1: Foundations (detailed)

Approach: **change the existing tables in place**. `Card` stays the definition and `CardOwnership` stays the copy. The 56k NS rows, serials and trade history survive. The rejected alternatives were new definition and copy tables (rewrites every card procedure at once) and realm and finish in `metadata` JSON (repeats today's unenforced free text).

### 5.1 Schema

| Change | Detail |
|---|---|
| `Realm.isSystem Boolean @default(false)` | Marks the system shelves. The realm directory, hub, claims, open nations and map queries exclude `isSystem` realms, so a system realm can never take nation claims. |
| System realm rows | Seeded: `nationstates`, `iiwiki` and `althistory`, each with `isSystem = true`, visibility `public`, status `active`, and the system owner as `ownerId` (`src/lib/system-owner-constants.ts`). Ixnay stays `default` and is not flagged. |
| `Card.realmId String` (FK to `Realm`, indexed) | Required after the backfill. |
| `Card.rarity` | `String` becomes the `CardRarity` enum (the existing 6 values and order). |
| `Card.cardType` | `String` becomes a rewritten `CardType` enum: `LORE`, `NATION`, `NS`, `SPECIAL`, `TROPHY`. `COMMUNITY` is removed. |
| `CardPack.cardType`, `themeFilter.cardTypes` | Remapped with the same table as cards. Without this, the seeded NS packs would open "no cards available". |
| `Card.isBound Boolean @default(false)` | Set for trophies and achievement reward cards (the `card-rewards.ts` definitions). |
| `Card.category` | Default changes from `NS_IMPORT` to null, and `NS_IMPORT` is removed from `LoreCategory` once the backfill has nulled NS categories. Its readers go too: `display-utils.ts`, `identity.vault.ts`, `lore-cards/maintenance.ts`, `category-enums.ts`. |
| `CardOwnership.finish` | New `CardFinish` enum (`STANDARD`, `FOIL`, `HOLO`, `SERIALISED`), default `STANDARD`. |
| `CardOwnership.id` | Gains `@default(cuid())`. |
| `CardOwnership.userId` | **Dropped**. `ownerId` is the only owner field. |
| `@@unique([cardId, serialNumber])` on `CardOwnership` | Added after the backfill renumbers any collisions. |
| Lore natural key | Unique `(wikiSource, lower(canonical title))` where `cardType = 'LORE'`. This is a partial unique index in raw SQL, in `prisma/manual-migrations/`. Titles are canonicalised with `canonicalizeTitle`. |
| `NSImportLedger` (new) | `(nsCardId, nsSeason, nation)`, unique. It records each import ever made, so a nation's card mints once across all accounts. |
| Stats columns dropped | `Card.stats`, `Card.attributes`, `Card.enhancements`, `Card.level`, `Card.artworkVariants`. NS values move to `metadata.nsData` first (region, category, NS season, bank value). |
| Other dropped columns | `CardOwnership.lastSalePrice`, `lastSaleDate` and `quantity`. `CardPack.pdsConfig`. `Card.wikiPageId`, `wikiImageUrl`, `name` (use `title`), `artworkUrl` (copied into `artwork` where that is empty) and `nsData` (moved into `metadata.nsData`). `User.totalCards`, `deckValue`, `collectorLevel` and `collectorXp`. |
| Dropped tables | `CardTrade`, `NSImport`, `SyncCheckpoint`, `CraftingRecipe`, `CraftingHistory`. `CollectionLike` and `CollectionComment` drop in Phase 3, together with the collection page that reads them. |
| Unused enums dropped | `AcquireMethod`, `AuctionStatus`, `TradeStatus` (the columns stay `String` until Phase 4 reworks them). |

Each dropped column's readers are removed in the same PR. The plan's first task lists them by grep. The audits found readers in:

- `identity.vault.ts` (passport)
- `vault/balance-credits.ts` (`getUserStats`)
- `vault-dividend-settle.ts`
- `achievements/metrics/platform.ts`
- `valuation.ts` (`stats->>'marketValue'`)
- `cards/inventory.ts` (`stats.region` filter and raw SQL)
- `ns-import/{decks,cards,sync}.ts`
- `nationstates/sync-processor.ts`
- `lore-cards/{gallery,maintenance,wiki}.ts`
- `card-service.ts` (`quantity`)
- `lore-card-generator.ts`
- `CardOverviewTab.tsx` (last sale)
- the card instance builders

### 5.2 Stats removal (code)

Deleted:

- `src/lib/cards/stat-config.ts`
- `formatCardStats`, `resolveCardStats` and `formatSpecialStats` in `display-utils.ts`
- `src/lib/country-geo/special-stats-populator.ts` and its re-export
- `calculateStats`, `calculateLoreStats`, `metadata.loreStats` and `CATEGORY_STAT_WEIGHTS` in the lore generator
- `StatBars`, `HoverStats` and the `hideStats` and `showStatsOnHover` props
- `CardStatsTab`, and the stats plumbing in `CardDetailsModal`
- the "Historical metrics" block in `CardLoreTab`
- the designer preview's stat literal
- the stat types in `src/types/cards-display.ts`
- the `stats` writes in the NS import, the NS sync, achievement cards and sports cards

Kept: `metadata.qualityScore`, as the hidden, admin-only rarity input.

The card display components are not redesigned in Phase 1. They only stop rendering stats. The face rebuild is Phase 3.

### 5.3 Backfill mapping

These are pure functions in `src/lib/cards/legacy-mapping.ts`, unit-tested and used by the backfill script.

**Card type.**

| From | To |
|---|---|
| any card with `lorewardEntryId` set | `TROPHY` (this rule wins over the type) |
| `SPECIAL` cards minted by sports championships (title template in `sports/transition.ts`) | `TROPHY` |
| `LORE`, `LORE_BATCH`, `WIKI_LORE`, `COMMONS_IMPORT`, `USER_CUSTOM` | `LORE` |
| `NS_IMPORT` | `NS` |
| `NATION` | `NATION` |
| `SPECIAL` | `SPECIAL` |

Any other value fails the dry run, with the card ids listed.

**Rarity.** `MYTHIC` and `DIVINE` become `LEGENDARY`, and their copies get finish `HOLO`. The dry run counts these copies, because each becomes worth 9× in dust. Values are matched case-insensitively and `ultra-rare` is normalised. Any other value fails the dry run.

**Finish.** Copies of trophies become `SERIALISED`; every other copy becomes `STANDARD`, apart from the Mythic and Divine rule above.

**Category.** NS cards get a null `category` (today they hold the `NS_IMPORT` default).

**Home realm.**

| Card | Home realm |
|---|---|
| `NS` | `nationstates` |
| `NATION` | Its country's `realmId`. With no country, the realm is `default`. |
| `SPECIAL` | `default` |
| `LORE` and `TROPHY` with a matching `RealmPage` (`wikiSource`, canonical title) | The realm that imported that page earliest |
| `LORE` and `TROPHY` otherwise, by `wikiSource` | ixwiki (or null) → `default`; iiwiki → `iiwiki`; althistory → `althistory` |

The dry-run report lists:

- `COMMONS_IMPORT` cards (now `LORE`, in Ixnay)
- every distinct `category` and `CardPack.cardType` value
- `LoreCardRequest.suggestedRarity` values
- NS cards whose bank value × 1.5 exceeds their floor (the cards that keep the NS term until they first sell)

### 5.4 Integrity and security

| Fix | Detail |
|---|---|
| One mint path | `mintCopy(tx, { cardId, ownerId, finish, source })` in `src/lib/cards/mint.ts`. It allocates the serial with `allocateSerialNumberTx` (advisory lock), creates the copy with a database id, and writes the `CardTransferEvent` mint row with its source (so Phase 4 can discount imported copies' dust). The 9 create sites switch to it: `card-service.ts`, `pack-service.ts`, `trophy-cards.ts` (×2), `sports/transition.ts` (fixing the World Cup serial 1 collision), `vault-daily-bonus.ts`, `cards/admin.ts` (Commons, without the importer copy), `ns-import/decks.ts`. The site in the retired `crafting/recipes.ts` is deleted with that router, its tests and its seed. |
| Pack double open | `openPack` first runs `userPack.updateMany({ where: { id, isOpened: false }, data: { isOpened: true, openedAt } })` inside its transaction. A count other than 1 throws `CONFLICT` before anything is minted. |
| NS deck import | One transaction per import, through `mintCopy`, checked against `NSImportLedger` so a nation's card imports once ever. `totalCards` and `deckValue` no longer exist to drift. |
| Pack notification rarity | `card-packs/user.ts:168` ranks by `getRarityTier`, so Ultra Rare sits below Epic. |
| Bound cards | Trade offers, auction creation and any transfer reject a copy of an `isBound` card (`PRECONDITION_FAILED`). |
| Junk removal | `cards.junkCards`, the pack-opening Stage 4 junk action, `JUNK_RATE`, `max_junk_batch_size` and `junk_rate` are removed, along with `pack-junk-ev.test.ts`, `cards-junk-batch.test.ts` and the junk cases in `vault-exploit-races.test.ts`. Historical `JUNK_CARDS` ledger rows keep their label. |
| Dead config | The five unread `card_system_*` keys are removed. |
| Security | All the section 3 security items. |

### 5.5 Migration and deploy order

The owner runs every production step. Nothing here touches production from this side.

1. **Drain**, at any time before the window. Disable auction and trade creation (`vault_isAuctionsEnabled`, `vault_isTradingEnabled`), then let the auction-completion and trade-expiry crons settle what is open.
2. **Additive SQL**, at any time before the window. Add `Realm.isSystem`, `Card.realmId` (nullable), `Card.isBound`, `CardOwnership.finish`, the `CardFinish` enum and `NSImportLedger`. Today's code ignores all of them.

Steps 3 to 5 run in **one maintenance window with the app stopped** (`pm2 stop`). Step 3 rewrites type and rarity strings that the old code still reads, so the old code must not run between steps 3 and 5.

3. **Backfill script** (`scripts/cards/backfill-cards-refresh.ts`). It dry-runs by default and writes only with `--apply`. It is idempotent. In order, it:
   1. seeds the system realms;
   2. normalises rarity and type strings on cards and packs;
   3. sets `realmId`;
   4. sets finishes;
   5. moves NS values into `metadata.nsData`;
   6. nulls NS categories and sets `isBound`;
   7. fills `NSImportLedger` from existing NS copies;
   8. merges duplicate lore cards. The survivor is the card with the most copies, then the oldest. Copies move to the survivor and are renumbered after its highest serial. Collection items, auctions, value history and watchlist rows are re-pointed, and the losing cards are deleted.
   9. renumbers any remaining `(cardId, serialNumber)` collisions by `acquiredAt`;
   10. copies `artworkUrl` into `artwork` where empty.

   The report covers every count and list in 5.3, plus the lore merge groups and the serial renumbers.
4. **Constraint SQL.** Convert `rarity` and `cardType` to the enums (`USING`). Make `realmId` NOT NULL and add its foreign key. Add both unique indexes. Drop the dead tables, columns and enums.
5. **Deploy the code**, start the app, then re-enable auctions and trading.

Steps 2 to 4 are also applied to the local and `ixstats_wv1` databases before the PR's gates run.

### 5.6 Tests

- `legacy-mapping` unit tests: every type and rarity row, the sports-trophy rule, home-realm resolution (including a `RealmPage` match and each `wikiSource` fallback), canonical-title merging, and unknown values failing.
- `mintCopy`: serials are unique under concurrent mints (following `serial-number.test.ts`); it writes the transfer event with its source; the id comes from the database.
- `openPack`: a second concurrent open throws `CONFLICT` and mints nothing.
- NS import: a failure part-way leaves no copies; a second import of the same nation's card, from any account, mints nothing.
- Bound cards: a trade offer, auction or transfer that includes a copy of an `isBound` card is rejected.
- Backfill: on a fixture database, the dry run writes nothing; applying twice gives the same result; a lore merge moves copies with unique serials; NS packs still resolve a pool after the type remap.
- Valuation: NS cards read the bank value from `metadata.nsData`.
- Realms: the directory and claims exclude `isSystem` realms.
- Security: the admin-only procedures reject a signed-in non-admin; `getUserCards` returns only tradeable copies; `getCardAuthorInfo` writes nothing.
- Architecture ratchets:
  - no `"MYTHIC"`, `"DIVINE"`, `"LORE_BATCH"`, `"WIKI_LORE"`, `"COMMONS_IMPORT"`, `"USER_CUSTOM"` or `"NS_IMPORT"` literals in `src/`;
  - no imports of the deleted stat modules.
- Gates: `typecheck:server`, `typecheck:ui`, `typecheck:tests` (with `tsbuildinfo` cleared), Jest, and oxlint on changed files. No builds.

### 5.7 Not in Phase 1

- Rolling a finish at mint (all new copies stay `STANDARD`, except trophies and the Serialised cases, until Phase 4).
- Anything in Phases 2 to 6, including the admin UI, the importers, the face and any player-facing UI beyond removing stats and junk.
- The `as any` casts in card routers that Phase 1 does not otherwise touch.

## 6. Audit reference

The four audits of 2026-10-15 are the source for this spec. They covered:

- the system overview;
- admin and import;
- server, jobs and data;
- client and stats.

Their full findings are in the conversation that produced it. `docs/systems/cards.md` is rewritten at the end of Phase 3, and again after each later phase.
