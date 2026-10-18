# Vault Cards

**Last updated:** 2026-10-17

**Parent App Suite:** Vault (`IXVAULT_VERSION = 3`, dev codename `IxVault`)  
**Subsystems:** the card face and back, the cards hub, the card sheet, showcases, packs and the pack reveal, the NationStates import bridge, the cards admin  
**Primary Action:** `COLLECT` | **Domain Accent:** Raspberry (`APP_TINTS.vault`)  
**Routes:** `/vault/cards/{mine,sets,market,explore}` (`/vault/cards` opens Mine), `/vault/store` (packs), `/vault/import`, `/admin/cards` | **Status:** Release Candidate (platform 1.5.0)

Design: [the cards refresh spec](../specs/2026-10-15-cards-refresh-design.md). Phase 1 laid the foundations, Phase 2 built the admin and the importers, and Phase 3 built the face and the hub described here.

---

## Overview

Cards are a collectathon across realms. Every card has one home realm, kept forever (`Card.realmId`): Ixnay (`Realm.id = "default"`), a player realm, or one of the NationStates, IIWiki and AltHistory system realms. Players collect cards from packs, the daily reward, auctions, trades and a NationStates deck import, and the hub slices every list by realm.

There is one card face, one card back, one card sheet and one pack reveal, and every surface that shows a card uses them: the hub, the wallet, the Passport, the Lorewards trophies, the market and trades, the NationStates import, the daily reward and the pack reveal. A card the viewer has not collected is a silhouette: the server strips its art from every payload.

---

## Model

- **Card types** (`CardType`): LORE, NATION, NS, SPECIAL and TROPHY ([below](#card-types)).
- **Rarities** (`CardRarity`, in NationStates order): Common, Uncommon, Rare, Ultra Rare, Epic, Legendary. A card's rarity is set at import by the one rarity engine and then frozen; only an audited admin override in the Library changes it.
- **Finishes**, per copy (`CardOwnership.finish`): Standard, Foil, Holo and Serialised. Copies mint Standard today, and Serialised for trophies; the finish roll and fusion come in Phase 4.
- **Bound cards** (`Card.isBound`): trophies, achievement reward cards and the event cards the Designer binds. They can't be traded, auctioned or listed (`assertNoBoundCopies`, `src/lib/cards/bound.ts`), and the sheet never offers one for sale.
- **Collector numbers** (`Card.collectorNumber`): each card's place in its home realm, unique per realm (`cards_realmId_collectorNumber_key`). The `cards_assign_collector_number` trigger numbers every new card (the realm's highest number plus one) under the advisory lock `pg_advisory_xact_lock(7337, hashtext(realmId))`, so no code path numbers a card itself. A card that moves realm (a trophy reassign, a Special card edit) takes the next number in its new realm. Silhouettes show the number.
- **Copies** (`CardOwnership`): a copy has its serial (`serialNumber`, unique per card), its level and XP (`level` and `experience`, granted by `grantCardXp` in `src/lib/cards/xp-utils.ts`, each grant a `CardExperienceEvent` row), its finish, a lock while it is listed or offered (`isLocked`), and inscription fields that stay empty until Phase 4.
- **One mint path**: every copy comes from `mintCopy` (`src/lib/cards/mint.ts`), which takes the serial under a per-card advisory lock and writes the mint row to `CardTransferEvent` with its source. Every later move writes a transfer event too, which is the copy's ownership trail.
- **Value**: a copy is worth its card's `marketValue` (`copyValue`, `src/lib/cards/copy-value.ts`). A retired card's copies are worth 0 in Mine, the sheet, trade values, `vault.getUserStats` and the dividend.
- **The catalogue**: the cards anyone may browse are approved out of review, not retired, and homed in a published realm (`CATALOGUE_WHERE`, `src/lib/cards/hub/catalogue.ts`). Explore shows it without trophy cards, but trophies stay in the catalogue, so a bare sheet link (the sheet's "Copy link") still opens one.

### Card types

#### NATION cards

Linked to an IxStates country via `Card.countryId`:

- **Stats**: Cards have no stats (removed 2026-10-15).
- **Valuation**: The `card-values` cron (`src/lib/lorewards/card-value-cron.ts`, every 6 hours) records the market value of NATION cards in `CardValueHistory` and flags changes over 20%. A value comes from rarity and type (`getCardMarketValue`); the former GDP correlation was dead code and is gone. In practice it does nothing today: no NATION card has a `countryId`.
- **Royalty**: when a NATION card sells at auction, 2% goes to the owner of its nation, else the earliest human puller of the card (`auction-service.ts`), the one place a country feeds the Vault economy.
- **Minting**: There is no automatic per-country card generator; NATION cards come from admin creation.

#### LORE cards

Imported from IxWiki, IIWiki, AltHistory and Wikimedia Commons by server-side import jobs (`CardImportJob`, the per-minute `card-import-jobs` cron, `src/server/modules/cards/cards.import-jobs.ts`), started from the Imports tab or queued by the daily `lore-card-generation` cron per switched-on wiki. Every import lands `PENDING` review. Rarity comes from one engine (`src/lib/cards/rarity-engine.ts`) with a threshold table per source wiki (Economy tab). The lead image's licence is recorded in `CardArtLicence`; NC and ND licences are blocked. Players suggest cards for free (`cards.suggestCard`, three a day):

- **Import jobs**: imports run as server jobs (`CardImportJob`, `src/server/modules/cards/cards.import-jobs.ts`), worked by the per-minute `card-import-jobs` cron under one lease, one throttled discovery client per wiki per run. The daily `lore-card-generation` cron (`cards.daily-import.ts`) queues one job per article wiki switched on in the Economy tab (SystemConfig `card_daily_import_<wiki>`; by default IxWiki and IIWiki at 20 a day, AltHistory off), once a day; its cards land pending review, and a wiki whose draw fails fails the cron run by name.
- Categories: `LoreCategory`: MILITARY, DIPLOMACY, GEOGRAPHY, RELIGION, CULTURE, GOVERNMENT, PEOPLE, ECONOMY, SCIENCE, HISTORY, NATION, SPECIAL
- The natural key is the wiki and the canonical article title (`cards_lore_natural_key`), so one article makes one Lore card; a lost race reports `already exists`.
- **Rarity**: `qualityScore()` (`src/lib/cards/rarity-engine.ts`) scores the article from 0 to 100 (length up to 30, references 30, inbound links 20, featured 20, infobox 5, categories 5), and its source wiki's threshold table (`getRarityThresholds`, `cards.config.ts`, edited on the Economy tab) turns the score into the rarity it is imported at. After import, rarity changes only by an audited admin override in the Library.
- **Review and art licence**: an imported card waits `PENDING` in the Curation tab until an admin approves it into packs or rejects it; packs, the daily card and Explore draw only `APPROVED` cards. The importer records the lead image's licence (`CardArtLicence`: OPEN, RESTRICTED or UNKNOWN) and blocks a page whose art is non-commercial or no-derivatives; restricted art never reaches packs (`EXCLUDE_RESTRICTED_ART`, `src/lib/cards/art-licence.ts`), and a card with restricted art cannot be approved.
- **Suggestions**: `cards.suggestCard` (`src/server/modules/cards/cards.suggestions.ts`) takes a free suggestion of an article with no card, up to 3 in any 24 hours per player, from Explore's "Suggest a card" dialog (`SuggestCardDialog` hosting `src/components/cards/suggest/CardSuggestionForm.tsx`; `/vault/cards/explore?suggest=1` opens it). An admin accepts it in Curation (the card is made, approved) or declines it with a reason, which the player's list in the same dialog shows (`cards.mySuggestions`). Paid lore requests (50 IxC) and lore request tokens have ended: `scripts/cards/convert-lore-requests.ts` turned old requests into suggestions with no refund, and `scripts/cards/refund-lore-tokens.ts` refunds unused bought tokens at their price.

#### NS cards

Synchronized from the official NationStates per-season card dumps (`cardlist_S{season}.xml.gz`) via admin-triggered region syncs, plus user deck imports at `/vault/import` (with its consent checkbox):

- **NS facts**: nation, region, category, season and bank value live in `metadata.nsData` (`src/lib/cards/ns-facts.ts`); the bank value feeds valuation, and the back and the sheet show them as the NationStates provenance line. A deck import runs in one transaction, and each NS card is imported once ever per nation (`NSImportLedger`), from any account.
- **URL-Only Storage**: Stores flag image URLs; no binary bytes persisted to disk or DB.
- **Streaming Proxy (`/api/proxy-ns-image`)**: Server-side proxy (nationstates.net / Wikimedia only, 24h cache, placeholder fallback on 403).
- **Attribution (`NationStatesAttribution.tsx`)**: the sheet's About section shows NationStates' fan-site credit and the "Verify & request takedown" button; the card back carries the shorter credit (`NationStatesDataCredit`).
- **Self-Service Takedown**: Nation owners verify identity via NS checksum (site-specific HMAC-MD5 token) to hide the card's art through the Compliance queue (`nsImport.requestSelfServiceTakedown`, `cards.compliance.ts`); restore puts it back.
- **Region syncs**: admin-triggered from Imports → NationStates (`cards.admin.nationstates.*`, `src/server/modules/cards/cards.ns-sync.ts`); every card a sync creates waits in Curation.

#### Loreward trophy cards

Every recorded Loreward place (daily, weekly or monthly; winner or runner-up) is a one-of-one, Serialised TROPHY card of the winning page, bound to the account it was granted to (`src/lib/lorewards/trophy-cards.ts`):

- **Identity:** `Card.lorewardEntryId` and `Card.lorewardEdition` (`winner` or `runner-up`), unique together. The card carries the contest, place, date and winner in its metadata. Rarity: Legendary for a monthly winner; Epic for a weekly winner and a monthly runner-up; Rare for the rest. A place without a recorded page (weekly and monthly entries, and some older dailies) is titled by contest and date.
- **Minting and granting:** `syncTrophyCards` (called by the Lorewards `fullSync` and `/api/lorewards/sync`, not by the 10-minute state sync) mints the missing cards, then gives each unowned card of an approved entry to its place's account once `resolveLorewardPlace` tells it. The bot scores MediaWiki, where an unlinked WikiOS author's edits arrive as `wikios>Label`. A plain name pays only the exact holder of its verified IxWiki link (an exact match on the normalized name). A `wikios>` name pays the one WikiOS account behind the label's ixwiki edits to the winning page (never a redirect left by a move), from 00:00Z on the contest's first day to 06:00Z after its last (a superset of the bot's US Eastern days); a weekly or monthly with no recorded range, or a label two accounts used, pays no one. Until then the card waits unowned; it is granted once and never re-granted.
- **Backfill:** `bun scripts/backfill-loreward-trophy-cards.ts [--apply]` mints a card for every recorded place back to 2017 with no credits (dry run by default, idempotent).
- **Economy:** a trophy card is a real holding, so the Wallet's deck value and net worth count it, but it is left out of the dividend's collection interest and of the deck-value achievements (excluded by type, `cardType: TROPHY`, and `deckValueExTrophy`). Admin duplicate cleanup (`purgeDuplicateCards`) never deletes one.
- **Faces:** the Lorewards shelf (`/vault/achievements`, `/util/lorewards?user=`) shows each trophy as a face that opens its sheet through the holder (`from=holder.<handle>`).

#### SPECIAL cards

Made in the Designer (`cards.designer.ts`, `Card.specialKind`): event cards, tradeable unless the Designer binds them, and achievement reward cards, always bound and one per achievement (such as _First Nation_ and _Veteran_, from `bun scripts/cards/import-special-cards.ts`).

---

## The face

`CardFace` (`src/components/cards/face/CardFace.tsx`) is the one face, at sizes S, M and L (`w-32`, `w-48` and `w-72`, `CARD_FACE_WIDTH` in `src/lib/cards/face/face-size.ts`; a grid passes `w-full`) and a 5:7 ratio.

- **On the front:** full-bleed art (NationStates art through `/api/proxy-ns-image`), with the title and the realm crest on a scrim at the bottom; the rarity as the edge colour and a gem; the finish as a sheen; a season chip for NS and Nation cards; a silhouette's collector number; "Retired" on a retired card; and, at size L only, the copy's level and serial. A card with no art shows its realm crest on the rarity tint (the NationStates crest is its logo).
- **Never on the front:** stats, an excerpt, a country, a value, a category seal, glows, hover pulses or hover stats.
- **Colours:** one rarity palette, the `--color-rarity-*` tokens in `src/styles/facet/tokens.css` (mirrored as `CARD_RARITY_HEX` in `src/lib/design/tokens.ts`). `src/styles/card-art.css` reads `data-card-rarity` for the edge, gem and tint (in the light theme the edge and gem paint is darkened so every rarity reaches 3:1), `data-card-finish` for the Foil, Holo and Serialised sheen, and `data-card-face` on the face's root. No other file names a rarity colour (`src/tests/architecture/cards-face-hub-removals.test.ts`, `card-rarity-tokens.test.ts`).
- **Accessible name:** title, rarity, finish and realm, plus the season for NS and Nation cards, "not collected" for a silhouette and "retired" for a retired card (`cardFaceLabel`, `src/lib/cards/face/accessible-name.ts`). A face is a button (`onOpen`, pressed in select mode), a link (`href`) or a picture (`role="img"`).
- **Motion:** grids are still; the sheen drifts only while a pointer rests on a card, and never under Reduce Motion, reduced transparency or more contrast. The 3D tilt and the holo highlight (`.card-holo`) appear only in the sheet's large card (`CardFlip`), which Space or F turns over, and on the Rare and rarer cards of the pack reveal's summary, which reuse the same tilt and holo. Under Reduce Motion there is no tilt and no holo, and the two sides cross-fade.
- **The back** (`CardBackProvenance`): the realm crest, serial and finish, level and XP, the ownership trail (`trailLabel`, `src/lib/cards/face/trail.ts`; each player named as [the sheet](#the-hub) names them, or "a player" when they hide their Vault cards), the art credit and licence, and the NationStates provenance line for NS cards, on the same rarity edge.
- **Face down** (`CardFaceDown`): a card waiting to be turned over, in the pack reveal and the daily reward.

| Rarity         | Token                       | Default pack odds (`CardPack` schema defaults) |
| :------------- | :-------------------------- | :--------------------------------------------: |
| **Common**     | `--color-rarity-common`     |                     65.0%                      |
| **Uncommon**   | `--color-rarity-uncommon`   |                     25.0%                      |
| **Rare**       | `--color-rarity-rare`       |                      7.0%                      |
| **Ultra Rare** | `--color-rarity-ultra-rare` |                      2.0%                      |
| **Epic**       | `--color-rarity-epic`       |                      0.9%                      |
| **Legendary**  | `--color-rarity-legendary`  |                      0.1%                      |

---

## Silhouettes

Unowned art is hidden on the server (spec §2.3 Discovery): a payload never carries art the viewer may not see, and no client hides it. Art shows to a holder, on a live listing, to the viewers of a public showcase (under its owner's `vaultCards` passport switch) and to the recipient of a pending, unexpired offer. A retired card never shows art.

- `toCardFace` (`src/lib/cards/hub/faces.ts`) builds every face, with no artwork unless the art is revealed, and none at all for a retired card (the placeholder face). NationStates cards are exempt: their flag art is public on NationStates, so it always shows (unless the card is retired).
- `cardsWithVisibleArt` (`src/lib/cards/hub/art-visibility.ts`) reveals, in any list, the cards the viewer holds a copy of and the cards on a live listing (an active auction that has not ended), the latter to every viewer.
- `contextRevealsArt` reveals more when the sheet is opened from a place that shows the art, named by `?from=` (`src/lib/cards/face/sheet-link.ts`):
  - `showcase.<id>`: a public showcase holding the card, while its owner shows Vault cards. A private showcase is never shown to others, even pinned.
  - `offer.<id>`: a trade offer made to the viewer, while it is pending and unexpired (`liveOfferTo`). The offer's initiator sees the partner's cards only through the holder context.
  - `holder.<handle>`: the holder's trophies and display (their pinned public showcase, else their top cards; `displayedCopies`), while they show Vault cards. The handle resolves through the Passport handle chain (a stored handle, a verified wiki name, a forum name or a Clerk id; `holderOf` in `src/server/api/routers/cards/_passport.ts`), so a player with no stored handle still reveals.
- `blankUnseenArt` (`src/lib/cards/hub/market-faces.ts`) applies the same rule to the raw copy rows of the market and trades. A hidden card's `artworkCredit` and art file page go with its art. Its sheet's excerpt comes from the server with its file links stripped, and a Commons card's `wikiArticleTitle` (its file's title) is null, so neither names the art.
- A signed-out viewer holds nothing and has no offers, so the same rules show them art only on a live listing, a public showcase and a holder's display and trophies ([the sheet](#the-hub) says which cards they can open).

---

## The hub

`CardsHub` (`src/components/vault/cards/`) has four tabs at `/vault/cards/{mine,sets,market,explore}`, each its own address, switched in place (`useCardHubTab`, pushState). The tabs activate manually (`SegmentedControl`'s `activationMode="manual"`): the arrow keys move focus along them, and Enter, Space or a press switches, so passing a tab never adds a history entry. `/vault/cards` opens Mine through a 307 from `src/proxy.ts` (`cardHubIndexRedirectFor`), so browsers do not remember which tab it opened. The sidebar's Cards row is active on every hub tab and on `/vault/import`.

- **Mine** (`MinePane`, `cards.listMine`): the player's copies as a still grid of S faces, or a list with a value column. Filters (realm, rarity, finish, type, category, duplicates; `CardFilterBar`), search, sort (newest, rarest, most valuable, title, highest level), and a select mode that adds the picked copies to a showcase. Retired copies stay listed with the placeholder face, worth 0.
- **Sets** (`SetsPane`): the player's [showcases](#showcases), and another player's public one by `?showcase=`. Set binders come in Phase 5.
- **Market** (`MarketPane`, `src/components/vault/cards/market/`): Browse (live auctions, with ending soon as a sort; `cardMarket.getActiveAuctions`; its realm filter lists the same realms as Explore's), Trades (incoming, sent, and a history of trades and auctions; each trade partner named by [the naming rule](#naming-players), in the trade card, the offer notification and the history, and never hidden by the Vault cards switch, since a trade is direct), Wishlist (empty until Phase 4) and Selling (your auctions; Your bids, every running auction you have bid on, marked Winning or Outbid, with Raise bid on an outbid one; and the auction form, whose copy picker searches and pages through every copy you can list, and puts the copy a `?sell=` link names first, read on its own through `listMine`'s `copyId`, whichever page holds it; a bound one says it cannot be sold). Auctions update live over the market WebSocket (`useAuctionWebSocket`). The Success rate tile is gone.
- **Card state after a change:** every change that moves or locks a copy, or holds credits (a trade's create, answer or cancel, a bid, a buyout, an auction's create or cancel, the socket's `auction_complete`, a pack open, the daily card, an import), calls `useCardsRefresh` (`src/hooks/useCardsRefresh.ts`, beside `useShowcaseRefresh`). It reads again the player's copies (Mine and the trade builder's), the display and showcases, the sheet, Explore's shelves and grid (a card just collected stops being a silhouette), the Market's lists (live auctions, your auctions, your bids and your auction history), the trades (open ones, the one shown and the history) and the balance.
- **Explore** (`ExplorePane`): realm shelves first (`cards.exploreShelves`: up to 12 public realms, Ixnay first, then by card count, each with its banner, card count, and newest and most-wanted strips), then a filtered grid of the catalogue (`cards.exploreGrid`: realm, rarity, type, category, NationStates region and season, collected or missing, search, and sort by newest, rarest, most wanted or title). Trophy cards are not in Explore, neither in the grid and its count nor on the shelves; they live on the Lorewards shelf and the Passport. The realm filter lists every public, published realm with a card other than a trophy (`exploreShelves`' `realms`, Ixnay first, then by card count), not only the shelves' twelve; the Market's realm filter reads the same list. The title search matches `%` and `_` as themselves (`likeLiteral`, `src/lib/utils/like-literal.ts`). The region filter searches the NationStates regions (`cards.exploreRegions`). Cards the viewer has not collected are silhouettes. "Suggest a card" opens the suggestion dialog.

**The card sheet** (`CardSheetHost` in `src/app/vault/layout.tsx` and on the Passport; `useCardSheet`; `cards.getSheet`, `src/lib/cards/hub/sheet.ts`): one sheet with no tabs, opened by `?card=<id>` on any page that hosts it. A large card that flips, then your copies with their actions (Add to showcase, Sell at auction), the market (price, listings, the price history chart, recent sales), and About (the lore excerpt and wiki link, the author and art credit, and the takedown link: "Verify & request takedown" for NationStates cards, [the help's Takedowns section](../../src/content/help/vault/lore-cards.md#takedowns) for every other card). "Copy link" copies a link that opens the same sheet; there is no image export. On a phone it is a bottom sheet and the sections stack. A card outside the catalogue opens only for a holder, on a live listing or from a context that reveals it; otherwise the sheet says "This card is not available". The ownership trail, a copy's signer and a listing's seller name each player by [the naming rule](#naming-players), except that a player whose Passport hides their Vault cards is "a player" there (the viewer always sees their own name).

**Signed out**, `cards.getSheet` answers under the read-only rate limiter (`publicReadOnlyProcedure`), with the same art rules; it reads none of the viewer's copies and no trail, and no listing is theirs. It opens only cards shown in public: a holder's display and trophies (`from=holder.<handle>`, while the holder shows Vault cards), a public showcase's copies (`from=showcase.<id>`) and cards on a live listing. Any other link, a card that does not exist included, gets `{ signIn: true }`, and the sheet says "Sign in to see this card", with a Sign in button that returns to the same address. The signed-out sheet has no Your copies section and no price history chart (`cardMarket.getCardValueHistory` needs an account); a signed-in viewer sees the sheet as before.

The hub keeps its state in the address:

| Parameter                             | Where                                   | What it does                                                                                                        |
| :------------------------------------ | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `card=<id>`                           | any page in the Vault, and the Passport | opens that card's sheet (the Lorewards tab marks a trophy with `trophy=<id>` instead)                               |
| `from=<kind>.<value>`                 | with `card`                             | where the sheet was opened from (`showcase.<id>`, `offer.<id>`, `holder.<handle>`; see [Silhouettes](#silhouettes)) |
| `showcase=<id>`                       | Sets                                    | opens that showcase; an unknown one is ignored                                                                      |
| `tab=trades`, `wishlist` or `selling` | Market                                  | the sub-tab; Browse when absent or unknown                                                                          |
| `for=<cardId>`                        | Market                                  | Browse lists only that card's listings (the sheet's market link)                                                    |
| `sell=<ownershipId>`                  | Market                                  | opens the auction form on that copy (the sheet's "Sell at auction"; a bound copy is refused)                        |
| `realm=<slug>`                        | Explore                                 | narrows the grid to a realm (NationStates is `nationstates`)                                                        |
| `suggest=1`                           | Explore                                 | opens the suggestion dialog                                                                                         |

The Store reads `?view=packs`, `my-packs`, `cosmetics` or `upgrades` (Packs by default; an old `boosters` link opens Packs).

**The redirect table** (`legacyCardRedirectFor` in `src/lib/cards/hub-routes.ts`, applied by `handleMovedRoutes` in `src/proxy.ts`): every old card address answers with a 308 to its new home and keeps its query, so an old `?card=` link opens the sheet there:

- the old inventory and crafting pages go to Mine;
- the old collections page and the old public collection gallery go to Sets, and an old collection's page to Sets with `?showcase=<id>`;
- the old lore gallery goes to Explore, and the old lore generator to Explore with `?suggest=1`;
- the old NationStates library and the old public NS deck of a nation go to Explore narrowed to the NationStates realm, and the old NS deck page to `/vault/import`;
- the old market and marketplace pages go to Market (the marketplace's own Store tab goes to the Store, on the view it showed), and the old trading page to Market Trades;
- the old packs page goes to the Store's Packs;
- the Store's old auctions and trading tabs go to Market and Market Trades.

The proxy answers one more old Vault address the same way, from a sibling table of pages that moved section (`movedPageRedirectFor`, `src/lib/navigation/moved-pages.ts`): the Vault's old Exchange page goes to `/labs/exchange` with a 308, keeping the query.

A redirect thrown by a page would stream as a 200 under the Vault's loading boundary (`src/app/vault/loading.tsx`), so the proxy answers every old address, and no page may come back at one: `src/tests/architecture/card-hub-old-urls.test.ts` fails on a page or route handler at an old address, and on an old address anywhere in `src`, `docs/systems`, `public` or the README outside the two redirect tables. Browsers cache a 308, so an old address can never be reused for something else.

### Naming players

Every card surface names a player by one rule (`playerDisplayName`, `src/server/modules/identity/identity.player-names.ts`): their Passport handle (`passportHandleOf`) while it is a real name, that is not their own Clerk id, the handle chain's last link; else the name of the nation they hold (`Country.ownerUserId`; their largest economy, in a realm the directory lists, as the Passport lists their nations); else "a player". A Passport link (the sheet's `from=holder.<handle>` from a trade) still carries the handle, even a Clerk id, which resolves. `loadPlayerNames` names everyone on a surface in one batch: one read of the players, then one of the verified wiki names and one of the nations of those with no stored handle; only the handle chain's check that a wiki or forum name resolves back to its player runs per player. The sheet and showcases read it through `playersOf` (`src/server/api/routers/cards/_passport.ts`, with the Vault cards switch in the same batch), and trades through `withPartyNames` (`src/server/api/routers/trading/_shared.ts`).

---

## Showcases

Showcases are free-form, player-made sets of copies (spec §2.2 Collections). They are stored as `CardCollection` rows (`name`, `description`, `isPublic`, `pinnedAt`) holding copies as `CardCollectionItem` rows (`cardOwnershipId`); the old collections became showcases, and collection likes and comments are gone. The logic is `src/lib/cards/hub/showcases.ts`, and the caps are `SHOWCASE_LIMITS` (`src/lib/cards/face/showcase-limits.ts`): 20 showcases a player, 60 copies each, a name of up to 100 characters and a description of up to 500.

- **Adding:** only copies the player holds; a copy already in the showcase is skipped. Mine's select mode and the sheet's "Add to showcase" open `AddToShowcaseDialog`, which can create a showcase on the way.
- **The pin:** one pinned showcase per player, the one pinned last (`pinnedAt`). Only a public showcase pins, making a pinned showcase private unpins it, and unpinning clears only that showcase. The pinned showcase is the player's display on the wallet and the Passport (`displayedCopies`, `src/lib/cards/hub/displayed.ts`, `DISPLAY_SIZE` = 6 copies); without one, the display is their six most valuable live copies, one per card. Retired cards are left out of both.
- **The detach trigger:** `card_showcase_detach_on_transfer` (after an update of `CardOwnership.ownerId`) removes a copy from its old owner's showcases whenever it changes owner, by any path: a trade, a sale, a grant or a reassign. The only way a former copy stays is a narrow add race, a copy traded between the add's ownership check and its insert (a `FOR SHARE` read in one transaction would close it).
- **Who sees one:** its owner always; anyone else only while it is public and its owner's `vaultCards` passport switch is on (`getShowcase`). A private showcase is never shown to others, even pinned. A public showcase shows its cards' art to those viewers (`from=showcase.<id>`), except a retired card's. Another player's showcase leaves its retired copies out, while its owner still sees them with the placeholder face, and its byline names the owner by [the naming rule](#naming-players) ("By a player" when there is no name).

---

## Packs and the reveal

Packs are sold in the Store's Packs tab (`/vault/store?view=packs`, `cardPacks.getAvailablePacks`, `purchasePack`); bought packs wait in My packs (`?view=my-packs`, `cardPacks.getMyPacks({ isOpened: false })`), and the wallet's showcase shows a "packs waiting" tile while any do. Each pack's details show its odds (`PackOdds`, from `src/lib/cards/pack-odds.ts`); every pack's odds add up to 100.

Opening a pack (`cardPacks.openPack`) plays one short reveal (`PackReveal`, `src/components/cards/reveal/`): the pack tears, the cards fan out face down, and a tap, a swipe or the Right or Down arrow key turns the next one; rarer cards hold the stage longer (`revealBeatMs`, `src/lib/cards/face/reveal.ts`). Skip and Reveal all (Escape) turn the rest. The summary has real actions: Go to Mine, a card's sheet and Open the next pack, and its Rare and rarer cards tilt and shimmer with the sheet's tilt and holo (`CardTilt`, which `CardFlip` uses too, and `card-art.css`; none of it, and no buzz, under Reduce Motion). Rare and rarer cards play the site's reveal sound (`soundCues.reveal`, `src/lib/sound/cuelume.ts`), and Epic and rarer add a light buzz (`playRevealFeedback`); the buzz follows the sound switch too, and Reduce Motion turns it off. The sheet plays the same feedback when its card turns to the back. A pack opened already is refused (`CONFLICT`), and the reveal points to Mine. If reading the pulled faces fails after the open has committed, the open still succeeds with no faces, and the failure is logged (`facesAfterCommit`, `src/lib/cards/hub/committed-faces.ts`, which the daily claim and the NationStates import use too).

The daily reward's card option (`DailyRewardProvider`) shows the card face down, then its real face once claimed, with "View card".

### Pack tiers

Packs are rows in `CardPack`, seeded from `prisma/seeds/data/card-packs.json` and managed at `/admin/cards`; each row carries its own price, card count, odds, and optional `season` / `cardType` pool filter. Seeded lineup (20 packs; the Season I–IV packs draw from the NS pool):

- **Season I–IV Recruit (BASIC)**: 100 / 120 / 150 / 200 IxC, 5 cards (e.g. S1: Common 70%, Uncommon 22%, Rare 6%, Ultra Rare 1.5%, Epic 0.4%, Legendary 0.1%)
- **Season I–IV Veteran (PREMIUM)**: 500 / 600 / 750 / 1,000 IxC, 5–6 cards
- **Season I–IV Commander Elite (ELITE)**: 2,000 / 2,400 / 3,000 / 4,000 IxC, 8–10 cards
- **Cross-pool packs**: Omni Starter (150), World Summit (3,500), High Roller Mega (5,000), Lore Master Elite (6,000, LORE-only), Championship Event (2,500), Anniversary (8,000), Limited Collector's Edition (12,000, 150 copies), Founder (15,000)

Packs never draw Special or Trophy cards, and a second open of one pack is refused (`CONFLICT`).

Every card rolls its rarity independently against the pack's odds; when the pack has a `guaranteedRarity` and no roll reached it, the last card is raised to that rarity (`generatePackCards`, `src/lib/cards/pack-service.ts`). `themeFilter` narrows the pool by realm, type, category, subcategory or country (`themeFilterWhere`). The pool is approved, unretired cards only, never restricted-licence art and never crafted cards (`packPoolWhere`). Packs are edited in the Packs tab (`cards.admin.packs.*`).

---

## Routers and modules

Player procedures are signed in unless noted; the mutations are rate-limited.

- **`cards.*`** (`src/server/api/routers/cards/`, recombined with `mergeRouters` in `index.ts`):
  - Mine: `listMine` (`mine.ts`). The trade dialogs read `getMyCards` and `getUserCards` (a trade partner's tradeable copies; `inventory.ts`).
  - Explore: `exploreShelves`, `exploreGrid`, `exploreRegions` (`explore.ts`).
  - The sheet: `getSheet` (public under the read-only rate limiter; signed out it opens only cards shown in public, [above](#the-hub)) and the public `getWikiArticleExcerpt` (`sheet.ts`).
  - Showcases: `listMyShowcases`, `getShowcase`, `getMyDisplay`, `createShowcase`, `updateShowcase`, `deleteShowcase`, `addToShowcase`, `removeFromShowcase`, `pinShowcase` (`showcases.ts`).
  - Suggestions: `suggestCard`, `mySuggestions` (`suggestions.ts`).
  - `_passport.ts` holds `vaultVisible` and `holderOf`, which the routers pass into `src/lib/cards/hub` (lib code never imports server modules).
  - The admin: `cards.admin.<tab>.*` ([Cards admin](#cards-admin)).
- **`cardMarket.*`** (`src/server/api/routers/card-market/`): `getActiveAuctions`, `getMyActiveAuctions`, `getMyActiveBids`, `getMyAuctionParticipation`, `getCardValueHistory`, `getCardTransferHistory`, `createAuction`, `placeBid`, `executeBuyout`, `cancelAuction`. The logic is `src/lib/economy/auction-service.ts`.
- **`trading.*`** (`src/server/api/routers/trading/`): `getActiveTrades`, `getTradeHistory`, `getTradeById`, `searchTradingPartners`, `createtradeOffer`, `respondToTrade`, `cancelTrade`. Settlement is `src/lib/vault/trade-settlement.ts`.
- **`cardPacks.*`** (`src/server/api/routers/card-packs/`): `getAvailablePacks`, `getMyPacks`, `purchasePack`, `openPack` (`src/lib/cards/pack-service.ts`).
- **Also:** `loreCards.getCardAuthorInfo` (public, rate-limited; `lore-cards/wiki.ts`), `nsImport.*` ([NationStates Integration](./ns-integration.md)) and `cardImages.*` (country card images, `cardImages.ts`).

Libraries and UI:

- `src/lib/cards/face/`, shared with the client: the face's data and labels (`types.ts`, `labels.ts`, `accessible-name.ts`, `face-size.ts`), art (`artwork.ts`, `art-credit.ts`), the sheet link (`sheet-link.ts`), the back (`trail.ts`, `ns-provenance.ts`), the controls of Mine and Explore (`filters.ts`, `mine-options.ts`, `explore-options.ts`), the reveal (`reveal.ts`), the showcase caps (`showcase-limits.ts`) and auction time (`time-left.ts`).
- `src/lib/cards/hub/`, server only: faces (`faces.ts`), the silhouette rules (`art-visibility.ts`), the catalogue (`catalogue.ts`), Mine (`mine.ts`), Explore (`explore.ts`), the sheet (`sheet.ts`), the players a surface names (`players.ts`, filled by the router), showcases and the display (`showcases.ts`, `displayed.ts`), the market's faces (`market-faces.ts`) and faces after a committed change (`committed-faces.ts`).
- `src/lib/cards/hub-routes.ts`, shared with the client and the proxy: the hub's addresses and the redirect table.
- `src/components/cards/`: `face/` (`CardFace`, `CardFaceDown`, `CardFlip`, `CardTilt`, `CardBackProvenance`, `RarityMark`, `RealmCrest`, `ArtCreditLine`), `sheet/` (`CardSheetHost`, `CardSheet` and its sections), `reveal/` (`PackReveal`, `RevealSummary`), `showcase/AddToShowcaseDialog`, `suggest/`, `trading/` (`TradeOfferModal`, `TradeNegotiation`), `pack-opening/PackHolographicCover` and `display/` (the NationStates credit and takedown dialog, `LoreWikiExcerpt`, `CardPriceHistoryChart`). The hub is `src/components/vault/cards/`; its hooks are `useCardHubTab` and `useCardSheet`.

---

## Coming in later phases

- **Phase 4, economy:** the finish roll and fusion, dust and crafting, fixed-price listings (the sheet's "Sell at auction" becomes "List"), the wishlist (the Market's Wishlist tab), longer auctions, the value formula and sales record, fees on trade credits, the royalty rework, card levels and XP caps, inscriptions (the signer's handle frozen at signing needs a column written then; the sheet reads the current handle), the two-column trade table, the daily card pool and the new notifications.
- **Phase 5, the realm loop:** seasons, realm and cross-realm sets with binders and set rewards (the Sets tab), owner curation, realm packs, nation cards and editions, leaderboards and the cross-realm trade bonus.
- **Phase 6, surfaces:** the Passport showcase and set progress, realm page card blocks, the forum and ThinkPages pinned card, the achievements card-reward chip and Halo card search.

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
- **Trophy fixes** (`cards.trophies.ts`): an admin override of a Loreward winner or runner-up (`lorewards.overrideWinner`, `admin.wiki.saveLorewardWinnerOverride`) is written to every entry of its contest, marked `overriddenAt` so no sync writes over it, and reassigns or voids each changed place's trophy, with an audit row, a transfer event and a provenance note. Any day of a recorded weekly or monthly contest finds it (a day no contest holds is refused), the date must be a real calendar date, a field left out keeps its stored value, and a new holder starts with no page or score. Both override paths (the Lorewards run console's Save and the override card) tell the Discord bot after the commit with the announcement on (`tellBotOfOverride`, `src/lib/lorewards/bot-client.ts`), so saving is what announces, and there is no separate Announce button. If the bot is unreachable the override still stands and returns `botSynced: false`, and both toasts (`overrideToast`) warn "Saved": the bot was not told, so nothing was announced, and it picks the change up on its next sync.

---

## Removed in the cards refresh (2026-10-15)

- Crafting: the `crafting` router, its rule module and seed, `CraftingRecipe` and `CraftingHistory`; the Vault config's `isCraftingEnabled` key and its admin toggle; its old page redirects to Mine (crafting returns in Phase 4). The `SPEND_CRAFT` / `CRAFT` enum values stay. Packs still exclude legacy crafted cards by their stored `metadata.crafted` marker.
- Junking: `cards.junkCards`, the junk rate and the batch limit. Historical `JUNK_CARDS` ledger rows keep their label.
- Card stats.
- The `MYTHIC` and `DIVINE` rarities, and the legacy type strings.
- `User.totalCards`, `deckValue`, `collectorLevel` and `collectorXp`: deck value is computed live by `copyValue` (`src/lib/cards/copy-value.ts`).
- The dead `CardTrade`, `NSImport`, `SyncCheckpoint`, `CardPackOpening`, `CardTradeOffer` and `CardBid` tables.
- Phase 3 (the face and hub; `src/tests/architecture/cards-face-hub-removals.test.ts` and `card-hub-old-urls.test.ts` pin these):
  - the old card pages: inventory, crafting, collections and each collection's page, the public collection gallery, the lore gallery, the lore generator, the NationStates library, the NS deck viewer and its nation pages, market, marketplace, trading and packs; each [redirects](#the-hub);
  - the old renderers and covers (`CardDisplay`, `CardBack`, `Card3DViewer`, `CardDetailsModal` and its tabs, `CardHolographicCover`, `LoreCardHolographicCover`, `HolographicOverlay`, `RarityBadge`, `CometCard`, the category icons) and the old palettes (`rarity-materials.ts`, `RARITY_COLORS`, `getRarityTheme` and their kin, `card-metadata-resolver.ts`): a card with no art shows its realm crest on the rarity tint;
  - the four-stage pack cinematic (`PackOpeningSequence`, its stages, `GlassSplashEffect`, `pack-opening-service.ts`) and its Keep and List actions;
  - the Vault's cards and marketplace sections (`VaultCardsSection`, `VaultMarketplaceSection` and their tabs, `vault-sections.ts`), the collection gallery and its carousel, comments and edit dialogs, `TradeHistory` and `useCollections`;
  - the procedures `cards.getNSCards`, `getNSLibraryStats`, `getMyTopCards`, `getMyCollections`, `createCollection`, `getCollectionCards`, `addToCollection` and `deleteCollection`; `loreCards.getAllLoreCards`; `cardMarket.getEndingSoon` (ending soon is a sort); `vault.claimDailyBonus` (the second daily claim in Settings) and the `vault.*` collection procedures; and the Vault config's streak bonus cap (`maxStreakBonus`), whose `vault_maxStreakBonus` SystemConfig row the Phase 3 SQL deletes;
  - the `CollectionLike` and `CollectionComment` tables;
  - the service worker and web manifest no page registered or linked (`public/sw.js`, `public/manifest.json`, and `public/offline.html`, which only the worker read), with their `next.config.js` header rules; and the Vault's Exchange page, now a [proxy redirect](#the-hub);
  - the Settings NationStates card list (Settings → NationStates cards keeps the import link, the last import and the takedown) and the Settings daily claim (Settings opens the daily reward).

---

## Deploy runbook notes

The full Phase 1 production runbook lives in the Phase 1 plan, and Phase 2's and Phase 3's are at the end of this page ([Phase 2](#phase-2-deploy-runbook-owner), [Phase 3](#phase-3-deploy-runbook-owner)); three Phase 1 points to keep in mind:

- **Stop the app first.** Run `pm2 stop` for the app server and the PM2 processes (`ixstats-cron`, `ixstats-ws`, `ixstats-ixtwitter`) before the deploy. `scripts/deploy-production.sh` runs the backfill and the constraint SQL before the build, so no old code may run between the destructive SQL and the new build.
- **Resolve copies held as `quantity > 1` before the deploy.** The constraint SQL drops `CardOwnership.quantity`, so it refuses while any copy holds more than one, and the backfill dry run reports the count as `multiQuantityCopies` and fails (exit 1) while it is above 0. Read it in the production dry run (`SELECT id, "cardId", "ownerId", quantity FROM "CardOwnership" WHERE quantity > 1`) and settle each row by hand; nothing splits them automatically.
- Run `bun scripts/cards/import-special-cards.ts --apply` after the deploy: it creates or points the five achievement Special cards (`realmId`, `isBound`, `rewardAchievementKey`) and awards earlier unlocks.

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
     - settle the W14 and W18 twins by an admin override on production (the owner's decision of 2026-10-17; [Trophy fixes](#cards-admin)): their state-file and OOL entries name different winners (Nasastan and Urcea), and disagreeing twins pay no one until the override;
     - the state file's late twins: the OOL-only weeks from 2026-08-24 to 2026-09-21 come after the state file's last week (W34), so the next state sync twins whichever of them the file holds.
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

Production and the `ixstats` database are touched only here, by the owner, in this order. Phase 3 needs Phases 1 and 2 (its SQL reads Phase 1's `cards."realmId"`); if they go out in one deploy, follow Phase 1's window, and `scripts/deploy-production.sh` runs each phase's SQL in turn. The read-only checks run with `docker exec ixstats-postgres psql -U postgres -d ixstats -c "<query>"`. This runbook describes `cards/p3-face-hub` at `692b61f5c` with the Phase 3 fix wave merged on top (the owner's decisions of 2026-10-17 and the final review's fixes; the ledger is `.superpowers/sdd/436-cards-phase-3/` in the owner's working tree, which git ignores).

1. **Stop the app first, as for Phase 1.** Run `pm2 stop` for the app server and the PM2 processes (`ixstats-cron`, `ixstats-ws`, `ixstats-ixtwitter`). The SQL drops `CollectionLike` and `CollectionComment`, which the old code reads, and briefly takes `ACCESS EXCLUSIVE` locks on `cards`, `CardCollection` and `User`, so no old code may run between it and the new build.
2. **Back up.** `scripts/deploy-production.sh` runs `bun run db:backup` before any SQL and aborts if the dump fails. Collection likes and comments (removed by the spec) come back only from that dump, so going back to pre-Phase-3 code is a restore: `bun run deploy:rollback -- <rollback-branch> --restore backups/ixstats-<stamp>.dump` (the [release guide](../operations/release-guide.md#rollback)).
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
7. **Tell players.** Cards are one hub with four tabs (Mine, Sets, Market, Explore); collections are showcases, and their likes and comments are gone; cards you have not collected show as silhouettes; trophy cards are on the Lorewards tab and Passports, not in Explore; packs open in one short reveal; outbid auctions stay in Your bids with Raise bid; anyone can open the cards a Passport or a public showcase shows, and live listings, without signing in; the NationStates card list left Settings ([the Vault help page](../../src/content/help/vault/overview.md) says so).

Owner decisions (2026-10-17), and where each was built:

- **Trophies leave Explore** (overriding the plan's Q10): `exploreWhere` leaves TROPHY cards out of the grid and its count, and the shelves leave them out of their strips and counts; `CATALOGUE_WHERE` keeps them, so a bare sheet link still opens one ([The hub](#the-hub)).
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
- **Later phases:** a player takedown form for cards other than NationStates' (Phase 4's reconcile); pack-level card type editing, and the fix for an empty rarity tier in a pack's pool, which falls back to another rarity and can undercut a shown odds row or a guarantee, with the server's raw odds against the Store's scaled ones (Phase 4's pool rework); versions, the channel (Release Candidate until then) and one changelog entry (Phase 6).

Fixed since the phase's final review:

- `resolveHandleUser` no longer treats `%` and `_` as wildcards (`likeLiteral`, `src/lib/utils/like-literal.ts`, `28bbb32ec`); Explore's title and region searches use it too.
- The `CHANGELOG.md` entries that linked to deleted card files name them in code font (`f2ed9059d`); `src/tests/scripts/sync-reference-docs.test.ts` is green.
- `bun run audit:arch` passes: `ixtwitter-sync.ts` is split below its ceiling (`d0b90f1bb`).
- Card state refreshes after every change that moves or locks a copy (`useCardsRefresh`; the final review's I2).
- One rule names players ([Naming players](#naming-players); the final review's I1): the Passport handle while it is a real name, not the player's Clerk id; else the nation they hold; else "a player". It names the sheet's trail, signers and sellers, the showcase byline, the trade card, the offer notification and Market history, all through one batched read (`loadPlayerNames`), so no player with no stored handle, wiki name or forum name shows as "@user_…".
- A hidden card's excerpt and Commons file title no longer name its art; another player's showcase leaves retired copies out; the sell picker searches and pages, and shows a `?sell=` copy whichever page holds it; a committed pack open or import whose faces cannot be read reports success; the trade builder values a retired copy at 0 with the placeholder face; Halo has one Open card packs entry; the Lorewards tab marks a trophy with `?trophy=`; the sheet no longer says a Special card comes in packs; the help gives the 5% bid step.

Still open (no deploy step):

- **Drop the Lorewards tab's `?card=` fallback** one release after this one (`VaultLorewardsPanel`): new links use `?trophy=`, and an older `?card=` link still marks the trophy (and opens its sheet). The WikiOS Lorewards page keeps `?card=` for its highlight; it hosts no card sheet, so the two never clash there.
- **An integration test of the silhouette rule on a real database** (the final review's recommendation): every art test runs on mocked Prisma. One test on a scratch schema would cover an unowned card in Explore, the sheet and the market, a live listing, a public and a private showcase, and an expired offer.

Accepted limits (ledgered, no change planned):

- **Collector numbers can repeat** (the owner accepted it). A new card takes its realm's highest number plus one, so after a realm's top card leaves (a realm move or a deletion) the next card takes its number again.
- **Old trail actions read "Moved"** (no change). A transfer action the trail does not know (`trailLabel`) reads "Moved". Production was not checked for action strings older than the schema comment: `SELECT action, count(*) FROM card_transfer_events GROUP BY 1;` lists them.
- A copy traded between a showcase add's ownership check and its insert can stay in its old owner's showcase ([Showcases](#showcases)).
- A double pin from two tabs leaves two pinned showcases; the display takes the latest, but another player's view of each showcase reads its own pin, so both read Pinned until one is unpinned. A per-player lock (namespace 7338) would stop it if it matters.
- Two concurrent admin overrides that move cards between the same realms can deadlock on lock 7337; Postgres aborts one, and it can be retried.
- The browser's own Back onto a history entry with no state leaves the sheet drawn until its close button or Escape.
