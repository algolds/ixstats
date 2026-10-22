# Vault Cards

**Last updated:** 2026-10-20

**Parent App Suite:** Vault (`IXVAULT_VERSION = 3`, dev codename `IxVault`)  
**Subsystems:** the card face and back, the cards hub, the card sheet, showcases, packs and the pack reveal, the card economy (listings, auctions, trades, dust, fusion, crafting, values and levels), the NationStates import bridge, the cards admin  
**Primary Action:** `COLLECT` | **Domain Accent:** Raspberry (`APP_TINTS.vault`)  
**Routes:** `/vault/cards/{mine,sets,market,explore}` (`/vault/cards` opens Mine), `/vault/store` (packs), `/vault/import`, `/admin/cards` | **Status:** Release Candidate (platform 1.5.0)

Design: [the cards refresh spec](../specs/2026-10-15-cards-refresh-design.md). Phase 1 laid the foundations, Phase 2 built the admin and the importers, Phase 3 built the face and the hub, and Phase 4 built the [card economy](#card-economy) described here.

---

## Overview

Cards are a collectathon across realms. Every card has one home realm, kept forever (`Card.realmId`): Ixnay (`Realm.id = "default"`), a player realm, or one of the NationStates, IIWiki and AltHistory system realms. Players collect cards from packs, the daily reward, fixed-price listings, auctions, trades, crafting and a NationStates deck import, and the hub slices every list by realm.

There is one card face, one card back, one card sheet and one pack reveal, and every surface that shows a card uses them: the hub, the wallet, the Passport, the Lorewards trophies, the market and trades, the NationStates import, the daily reward and the pack reveal. Every card shows its art to everyone; a card the viewer has not collected is marked instead ([Uncollected cards](#uncollected-cards)).

---

## Model

- **Card types** (`CardType`): LORE, NATION, NS, SPECIAL and TROPHY ([below](#card-types)).
- **Rarities** (`CardRarity`, in NationStates order): Common, Uncommon, Rare, Ultra Rare, Epic, Legendary. A card's rarity is set at import by the one rarity engine and then frozen; only an audited admin override in the Library changes it.
- **Finishes**, per copy (`CardOwnership.finish`): Standard, Foil, Holo and Serialised. A new copy rolls Foil or Holo at mint, trophies are Serialised, and fusion raises a finish ([Finishes and fusion](#finishes-and-fusion)).
- **Bound cards** (`Card.isBound`): trophies, achievement reward cards and the event cards the Designer binds. They can't be traded, auctioned, listed, fused, broken down or crafted (`assertNoBoundCopies`, `src/lib/cards/bound.ts`), and the sheet never offers one for sale.
- **Collector numbers** (`Card.collectorNumber`): each card's place in its home realm, unique per realm (`cards_realmId_collectorNumber_key`). The `cards_assign_collector_number` trigger numbers every new card (the realm's highest number plus one) under the advisory lock `pg_advisory_xact_lock(7337, hashtext(realmId))`, so no code path numbers a card itself. A card that moves realm (a trophy reassign, a Special card edit) takes the next number in its new realm. An uncollected card's face shows the number.
- **Copies** (`CardOwnership`): a copy has its serial (`serialNumber`, unique per card), its level (1 to 10) and XP (`level` and `experience`, granted by `grantCardXp` in `src/lib/cards/xp-utils.ts`, each grant a `CardExperienceEvent` row, within a daily cap; [Levels and XP](#levels-and-xp)), its finish, a lock while it is listed, at auction or offered in a trade (`isLocked`), the import share mark (`importDiscounted`), and an optional inscription with its frozen signer name ([Inscriptions and reports](#inscriptions-and-reports)).
- **One mint path**: every copy comes from `mintCopy` (`src/lib/cards/mint.ts`), which rolls the finish unless its caller names one, takes the serial under a per-card advisory lock and writes the mint row to `CardTransferEvent` with its source (`MINT_SOURCES`, `CRAFT` among them). Every later move writes a transfer event too, with the copy's card, serial and finish (a sale, a trade, a fusion, a break-down), which is the copy's ownership trail; a burned copy keeps its trail and its serial is never issued again.
- **Value**: a copy is worth its finish's and level's value by the one formula (`valueOfCopy`, loaded in bulk by `loadCopyValues`, `src/lib/cards/copy-value.ts`; [Values](#values)); `Card.marketValue` is the card's reference value, a Standard copy at level 1. A retired card's copies are worth 0 in Mine, the sheet, trade values, `vault.getUserStats` and the dividend.
- **The catalogue**: the cards anyone may browse are approved out of review, not retired, and homed in a published realm (`CATALOGUE_WHERE`, `src/lib/cards/hub/catalogue.ts`). Explore shows it without trophy cards, but trophies stay in the catalogue, so a bare sheet link (the sheet's "Copy link") still opens one.

### Card types

#### NATION cards

Linked to an IxStates country via `Card.countryId`:

- **Stats**: Cards have no stats (removed 2026-10-15).
- **Valuation**: a NATION card is valued like every other card ([Values](#values)), with the Nation type multiple (1.5) on its rarity floor; the former GDP correlation is gone.
- **Royalty**: when a NATION card sells, or is paid for with IxC in a trade, 2% of the amount goes to the owner of its nation out of the market fee, unless that owner is a party to the deal; there is no fallback recipient ([Fees and the royalty](#fees-and-the-royalty)). It is the one place a country feeds the Vault economy. No NATION card has a `countryId` yet, so none is paid today.
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

- **On the front:** full-bleed art (NationStates art through `/api/proxy-ns-image`), muted on a card the viewer has not collected, with the title and the realm crest on a scrim at the bottom; the rarity as the edge colour and a gem; the finish as a sheen; a season chip for NS and Nation cards; an uncollected card's collector number; "Retired" on a retired card; and, at size L only, the copy's level and serial. A card with no art shows its realm crest on the rarity tint (the NationStates crest is its logo), greyed when it is not collected.
- **Never on the front:** stats, an excerpt, a country, a value, a category seal, glows, hover pulses or hover stats.
- **Colours:** one rarity palette, the `--color-rarity-*` tokens in `src/styles/facet/tokens.css` (mirrored as `CARD_RARITY_HEX` in `src/lib/design/tokens.ts`). `src/styles/card-art.css` reads `data-card-rarity` for the edge, gem and tint (in the light theme the edge and gem paint is darkened so every rarity reaches 3:1), `data-card-finish` for the Foil, Holo and Serialised sheen, and `data-card-face` on the face's root. No other file names a rarity colour (`src/tests/architecture/cards-face-hub-removals.test.ts`, `facet-guards.test.ts`).
- **Accessible name:** title, rarity, finish and realm, plus the season for NS and Nation cards, "not collected" for a card the viewer holds no copy of and "retired" for a retired card (`cardFaceLabel`, `src/lib/cards/face/accessible-name.ts`). A face is a button (`onOpen`, pressed in select mode), a link (`href`) or a picture (`role="img"`).
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

## Uncollected cards

Every card's art shows to everyone (the owner's decision of 2026-10-21, which dropped spec §2.3 Discovery's rule that unowned art is hidden: Ixnay, IIWiki and Eurth lore cards had looked imageless in Explore). Where the viewer is choosing what to collect, a card they hold no copy of, a NationStates card included, is marked instead: its face mutes the art and shows the collector number, and its accessible name says "not collected". A player's display shows off their own collection, so it is in full colour to everyone. A retired card never shows its art (the placeholder face): takedowns, restricted licences and Library hides all retire the card.

- `toCardFace` (`src/lib/cards/hub/faces.ts`) builds every face: the artwork of every card but a retired one, and `uncollected` when the caller passes `collected: false`.
- `cardsCollectedBy` (`src/lib/cards/hub/art-visibility.ts`) reads, in one `CardOwnership` read, which of a list's cards the viewer holds a copy of; a signed-out viewer holds nothing. `facesFor` builds a list's faces with it. Explore's grid and shelves, Browse, the market's and the trades' copies (the trade builder's too; `copyFaces` and `withAuctionFaces`, `src/lib/cards/hub/market-faces.ts`) are marked by the viewer's own copies, never the holder's. The wishlist reads its own count of the player's copies, and the sheet its read of the viewer's copies. Mine, the faces of a committed change (a pack, the daily card, an import; `ownedFaces`) and the sheet's own copies pass `collected: true`, as do a player's displays, which show off their collection to everyone, whatever the viewer holds: a showcase, anyone's (`getShowcase`, `listMyShowcases`), the wallet display (`myDisplay`), the Passport display (`resolvePassportVault`) and the Lorewards trophies (`ownedTrophyCards`).
- Art that shows is credited: the sheet's art credit, licence and file page show with it. A retired card's `artworkCredit` and art file page go with its art, its sheet's excerpt comes from the server with its file links stripped, a Commons card's `wikiArticleTitle` (its file's title) is null, and a raw auction row loses its `artwork` and `artworkCredit`, so nothing names the art.
- The place a sheet was opened from no longer decides the art; it decides only whether the sheet opens a card outside the catalogue, or a signed-out visitor's sheet ([the sheet](#the-hub)). A signed-in viewer opens any catalogue card without the place being asked. `contextShowsCard` asks the place named by `?from=` (`src/lib/cards/face/sheet-link.ts`):
  - `showcase.<id>`: a public showcase holding the card, while its owner shows Vault cards. A private showcase is never shown to others, even pinned, and a retired copy opens from a showcase for its owner only, as `getShowcase` lists it to no one else.
  - `offer.<id>`: a trade offer made to the viewer, while it is pending and unexpired. The offer's initiator opens the partner's cards only through the holder context.
  - `holder.<handle>`: the holder's trophies and display (their pinned public showcase, else their top cards; `displayedCopies`), while they show Vault cards. The handle resolves through the Passport handle chain (a stored handle, a verified wiki name, a forum name or a Clerk id; `holderOf` in `src/server/api/routers/cards/_passport.ts`), so a player with no stored handle still shows their cards.
- **The mark** (`CardFace`): an uncollected card's art takes `card-face-uncollected` (`src/styles/card-art.css`), a light desaturation (`saturate(0.4)`, a little dimmer in the dark theme). Only the picture is filtered, so the rarity edge and gem, the scrim and the title keep their colour on every rarity. The realm crests grey (`muted`) only on an uncollected card with no art. A held copy is full colour.

---

## The hub

`CardsHub` (`src/components/vault/cards/`) has four tabs at `/vault/cards/{mine,sets,market,explore}`, each its own address, switched in place (`useCardHubTab`, pushState). The tabs activate manually (`SegmentedControl`'s `activationMode="manual"`): the arrow keys move focus along them, and Enter, Space or a press switches, so passing a tab never adds a history entry. `/vault/cards` opens Mine through a 307 from `src/proxy.ts` (`cardHubIndexRedirectFor`), so browsers do not remember which tab it opened. The sidebar's Cards row is active on every hub tab and on `/vault/import`.

- **Mine** (`MinePane`, `cards.listMine`): the player's copies as a still grid of S faces, or a list with a value column. Filters (realm, rarity, finish, type, category, duplicates; `CardFilterBar`), search, sort (newest, rarest, most valuable, title, highest level), and a select mode whose bar (`MineBulkBar`) adds the picked copies to a showcase, lists them (up to 20, each at its own price; `BulkListDialog`), fuses a picked set or breaks them down. A copy named in a pending trade offer is marked (`inOffer`, the same predicate the server refuses by), and the bar holds it back from fusing, breaking down and listing. The Dust button shows the player's dust per realm (`DustBalances`). Retired copies stay listed with the placeholder face, worth 0.
- **Sets** (`SetsPane`): the player's [showcases](#showcases), and another player's public one by `?showcase=`. Set binders come in Phase 5.
- **Market** (`MarketPane`, `src/components/vault/cards/market/`): Browse (live fixed-price listings and auctions in one list, featured first, with Buy on a listing; ending soon is a sort; `cardMarket.browse`; its realm filter lists the same realms as Explore's), Trades (Incoming, Sent and History, each open trade opening the [trade builder](#trades); each trade partner named by [the naming rule](#naming-players), in the trade card, the offer notification and the history, and never hidden by the Vault cards switch, since a trade is direct), Wishlist (your wished cards with their live listings and lowest price; `cardMarket.getWishlist`) and Selling (your listings, with Cancel; your auctions; Your bids, every running auction you have bid on, marked Winning or Outbid, with Raise bid on an outbid one; and the auction form, whose copy picker searches and pages through every copy you can list, and puts the copy a `?sell=` link names first, read on its own through `listMine`'s `copyId`, whichever page holds it; a bound one says it cannot be sold). Auctions update live over the market WebSocket (`useAuctionWebSocket`), and a bid refreshes only what a bid changes (`useBidRefresh`). The Success rate tile is gone.
- **Card state after a change:** every change that moves, locks, mints or burns a copy, or holds credits (a trade's create, counter, answer or cancel, a buyout, a listing made, bought or cancelled, an auction's create or cancel, the socket's `auction_complete`, a pack open, the daily card, an import, a break-down, a fusion, a craft), calls `useCardsRefresh` (`src/hooks/useCardsRefresh.ts`, beside `useShowcaseRefresh`, which a burn also calls, since a burned copy leaves every showcase). It reads again the player's copies (Mine and the trade builder's tradeables), the display and showcases, the sheet and its copy actions (`cards.getSheetEconomy`), Explore's shelves and grid (a card just collected loses its mark), the Market's lists (Browse, your listings, the wishlist, your auctions, your bids and your auction history), your dust, the trades (open ones, the one shown, the history and a partner's wishlist) and the balance. A bid calls the narrower `useBidRefresh`.
- **Explore** (`ExplorePane`): realm shelves first (`cards.exploreShelves`: up to 12 public realms, Ixnay first, then by card count, each with its banner, card count, and newest and most-wanted strips), then a filtered grid of the catalogue (`cards.exploreGrid`: realm, rarity, type, category, NationStates region and season, collected or missing, search, and sort by newest, rarest, most wanted or title). Trophy cards are not in Explore, neither in the grid and its count nor on the shelves; they live on the Lorewards shelf and the Passport. The realm filter lists every public, published realm with a card other than a trophy (`exploreShelves`' `realms`, Ixnay first, then by card count), not only the shelves' twelve; the Market's realm filter reads the same list. The title search matches `%` and `_` as themselves (`likeLiteral`, `src/lib/utils/like-literal.ts`). The region filter searches the NationStates regions (`cards.exploreRegions`). Every card shows its art; the ones the viewer has not collected are [marked](#uncollected-cards). "Suggest a card" opens the suggestion dialog.

**The card sheet** (`CardSheetHost` in `src/app/vault/layout.tsx` and on the Passport; `useCardSheet`; `cards.getSheet`, `src/lib/cards/hub/sheet.ts`): one sheet with no tabs, opened by `?card=<id>` on any page that hosts it. A large card that flips, with Wishlist and Mute beside Copy link for a signed-in viewer; then your copies, each with its value and actions (Add to showcase, List, Sell at auction, Offer in a trade, Fuse, Break down, Sign; [Card economy](#card-economy)); the market (price, "Wanted by", listings with Buy and, on a signed copy, Report, the price history chart, recent sales, and Craft for a card the viewer can craft); and About (the lore excerpt and wiki link, the author and art credit, and the takedown action: "Verify & request takedown" for NationStates cards, and for every other card "Request a takedown" for a signed-in player (`cards.requestTakedown`, `RequestTakedownDialog`; filed into Compliance with origin Player), or [the help's Takedowns section](../../src/content/help/vault/lore-cards.md#takedowns) for a visitor). A copy's value, actions and the craft offer come from `cards.getSheetEconomy`, which the sheet asks for only when signed in. "Copy link" copies a link that opens the same sheet; there is no image export. On a phone it is a bottom sheet and the sections stack. A card outside the catalogue opens only for a holder, on a live listing or from a place that shows it ([Uncollected cards](#uncollected-cards)); otherwise the sheet says "This card is not available". The ownership trail, a copy's signer and a listing's seller name each player by [the naming rule](#naming-players), except that a player whose Passport hides their Vault cards is "a player" there (the viewer always sees their own name).

**Signed out**, `cards.getSheet` answers under the read-only rate limiter (`publicReadOnlyProcedure`), with the card's art and its face marked uncollected; it reads none of the viewer's copies and no trail, and no listing is theirs. It opens only cards shown in public: a holder's display and trophies (`from=holder.<handle>`, while the holder shows Vault cards), a public showcase's copies (`from=showcase.<id>`) and cards on a live listing. Any other link, a card that does not exist included, gets `{ signIn: true }`, and the sheet says "Sign in to see this card", with a Sign in button that returns to the same address. The signed-out sheet has no Your copies section and no price history chart (`cardMarket.getCardValueHistory` needs an account); a signed-in viewer sees the sheet as before.

The hub keeps its state in the address:

| Parameter                             | Where                                   | What it does                                                                                                                           |
| :------------------------------------ | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `card=<id>`                           | any page in the Vault, and the Passport | opens that card's sheet (the Lorewards tab marks a trophy with `trophy=<id>` instead)                                                  |
| `from=<kind>.<value>`                 | with `card`                             | where the sheet was opened from (`showcase.<id>`, `offer.<id>`, `holder.<handle>`; see [Uncollected cards](#uncollected-cards))        |
| `showcase=<id>`                       | Sets                                    | opens that showcase; an unknown one is ignored                                                                                         |
| `tab=trades`, `wishlist` or `selling` | Market                                  | the sub-tab; Browse when absent or unknown                                                                                             |
| `trade=new` or `trade=<id>`           | Market Trades                           | opens the trade builder on a new trade or an open one; `partner=<handle>`, `give=<ownershipId>` and `get=<ownershipId>` seed a new one |
| `for=<cardId>`                        | Market                                  | Browse lists only that card's listings (the sheet's market link)                                                                       |
| `sell=<ownershipId>`                  | Market                                  | opens the auction form on that copy (the sheet's "Sell at auction"; a bound copy is refused)                                           |
| `realm=<slug>`                        | Explore                                 | narrows the grid to a realm (NationStates is `nationstates`)                                                                           |
| `suggest=1`                           | Explore                                 | opens the suggestion dialog                                                                                                            |

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
- **Who sees one:** its owner always; anyone else only while it is public and its owner's `vaultCards` passport switch is on (`getShowcase`). A private showcase is never shown to others, even pinned. A public showcase shows its cards in full colour to those viewers, whatever they hold, except a retired card, which shows no art; their sheets open from it (`from=showcase.<id>`). Another player's showcase leaves its retired copies out, while its owner still sees them with the placeholder face, and its byline names the owner by [the naming rule](#naming-players) ("By a player" when there is no name).

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

Every card rolls its rarity independently against the pack's odds, in proportion to their total; when the pack has a `guaranteedRarity` and no roll reached it, the last card is raised to that rarity (`generatePackCards`, `src/lib/cards/pack-service.ts`). `themeFilter` narrows the pool by realm, type, category, subcategory or country (`themeFilterWhere`), and `CardPack.cardType` by card type. The pool is catalogue cards only (`CATALOGUE_WHERE`: approved, unretired, in a published realm), never restricted-licence art and never crafted cards (`packPoolWhere`). A pack never falls back to another rarity (`missingRarities`, `src/lib/cards/pool-draw.ts`): while a rarity it shows or guarantees has no card, it is not sold, put on sale or awarded, and its open is refused after the claim, so a bought pack stays unopened. Opening needs room for the whole pack. Packs are edited in the Packs tab (`cards.admin.packs.*`), which also edits the card type and says how many bought packs a missing rarity strands.

---

## Card economy

Phase 4 built the economy. Its tunable numbers are SystemConfig rows (`card_economy_*`, `src/lib/cards/economy-config.ts`, `CARD_ECONOMY_DEFAULTS`; the value numbers are `card_valuation_*`, `src/lib/cards/valuation.ts`), edited in the admin Economy tab and read through a 60-second cache. Every stored number is clamped on read (`clampEconomyConfig`), and the Economy tab refuses a value outside the same bounds, a rate finer than 0.01, daily odds that do not add up to 100, and a dust loop that would let a fusion or a craft make dust. The numbers below are the defaults.

### Finishes and fusion

- **The roll:** `mintCopy` rolls a new copy's finish (`rollFinish`, `src/lib/cards/finish.ts`) from the Economy tab's odds, Foil 8% and Holo 2% (the rest Standard), unless its caller names one: trophies and sports trophies mint Serialised, crafting Standard, and an admin grant takes the admin's choice. Packs, the daily card, NationStates imports and achievement cards roll.
- **Fusion** (`crafting.fuse`, `src/server/modules/cards/workshop/fusion.ts`): `fusionCopies` (3) copies of one card at one finish become one copy at the next finish, Standard to Foil and Foil to Holo; Serialised is never rolled or fused into. The lowest serial is kept and upgraded in place, with its level and XP, and the others burn with a `FUSE` transfer event, so their trail and serials stay. Bound, Serialised, signed and locked copies are refused, and so is a copy named in a pending trade offer (`offered-copies.ts`, the one predicate Mine and the sheet also read). A fused copy is import-discounted when any copy it took was. Fusion mints nothing, so it checks no capacity.

### Dust and crafting

- **Dust is per realm and account-bound:** one `CardDustBalance` row per player and realm (`card_dust_balances`, an `Int`), with every change a `CardDustEvent` row (`card_dust_events`, source `BREAKDOWN` or `CRAFT`; `src/server/modules/cards/workshop/dust-ledger.ts`). A credit that would pass 2,147,483,647 is refused. `crafting.getDust` lists a player's balances (Mine's Dust button, `DustBalances`).
- **Breaking down** (`crafting.breakDown`, `workshop/breakdown.ts`, up to 100 copies a call): each copy gives its card's realm the Standard yield of its rarity (Common 5, Uncommon 15, Rare 50, Ultra Rare 150, Epic 500, Legendary 1,500), times 3 for Foil and 9 for Holo (`dustYield`, `src/lib/cards/dust.ts`). The Foil and Holo multiples stay whole and at most `fusionCopies` times the finish below, so fusing first never changes the dust. An imported NationStates copy (`CardOwnership.importDiscounted`) gives a quarter (`dustImportMult`), rounded down before the finish. The burn is one `DELETE` that must still find the copy the player's, unlocked and unsigned; it credits the dust first, writes a `BREAKDOWN` transfer event per copy, and refuses bound, Serialised, signed and locked copies and a copy in a pending offer.
- **The import share** is set by the Phase 4 SQL from the import ledger (`ns_import_ledger`) and by every NationStates import since, so there is no backfill script.
- **Crafting** (`crafting.craft`, `workshop/craft.ts`): any catalogue card (`CATALOGUE_WHERE`) up to Epic costs `craftDustMult` (8) times its Standard yield in its realm's dust (a part dust rounds up), plus its rarity floor in IxC (`craftQuote`; a Common is 40 dust and 10 IxC, an Epic 4,000 dust and 1,000 IxC). Legendary, Special, trophy, bound and retired cards are refused (`craftability`). The copy is Standard, minted with source `CRAFT`, and needs room in the collection. The transaction spends the credits (`SPEND_CRAFT`, source `card_craft`), then the dust (`spendDustTx`), then takes capacity, then mints, in the lock order below. `crafting.getNumbers` (public, under the read-only rate limiter) gives the card screens the numbers they preview with.

### Fixed-price listings

`CardListing` (`card_listings`; `src/server/modules/cards/market/listings.ts`): one copy at one whole price from 1 to 1,000,000 IxC, for `listingDays` (14). Listing costs `listingFee` (5 IxC), or `listingFeeFeatured` (10) for a featured listing, charged after the copy's lock and stored on the row (`listingFee`); the copy is locked while listed. Cancel (`cardMarket.cancelListing`, from Selling) and expiry refund `listingRefundPct` (50%) of the stored fee (`listingRefund`). The `listing-expiry` job (every 10 minutes) ends due listings, unlocks their copies and refunds. A purchase (`cardMarket.buyListing`) settles like an auction sale: one transaction with the claim first, the buyer charged, the seller paid the price less the market fee (`card_sale_listing`; the buyer's row is `card_purchase_listing`), the royalty out of the fee, the copy moved, the sale recorded as a `LISTING_SALE` transfer event with the listing's stored serial and finish, and `LISTING_PURCHASE` XP. Mine's select mode lists up to 20 copies at once (`cardMarket.createListings`, each its own listing and transaction). A listing keeps its card, serial and finish, and its copy link is `ON DELETE SET NULL`, so a copy burned later never erases the listing.

**Browse** (`cardMarket.browse`, `src/server/modules/cards/market/browse.ts`) is one list of live listings and auctions, featured first, filtered by kind, realm, rarity, finish, type, card or title, and sorted by ending soon, newest or price. Every face shows its art, marked by the viewer's own copies ([Uncollected cards](#uncollected-cards)).

### Auctions

`src/lib/economy/auction-service.ts`. An auction runs in real time for 24 hours, 3 days or 7 days (`AUCTION_DURATIONS`, `src/lib/cards/market/auction-timing.ts`), with a starting price, an optional buy-now price above it, and the same listing fee as a listing, stored on the auction. A bid must beat the current bid (or the start) by 5%, rounded up to a whole IxC; the bidder's IxC are held (`auction_bid_reserve`) and an outbid bidder is refunded in the same transaction and told. A bid with under 5 minutes left adds 1 minute. A buyout needs the auction not to have ended (`endTime > now`), so at the end exactly one of a buyout and the completion wins. The `auction-completion` job (every minute) settles ended auctions; an unsold one refunds the seller the listing refund share of the stored fee, and so does a cancel, which a player can make only before any bid. Every notice goes after the commit: the winner, the seller (sold, bought out, or no bids with the refund) and every other bidder. Like listings, an auction keeps its `cardId` and `serialNumber`, and its copy link (`cardInstanceId`) is `ON DELETE SET NULL`, so a fuse or a break-down never erases market history or lowers "auctions sold".

### Values

- **The formula** (`valueOfCopy`, `src/lib/cards/valuation.ts`): a copy is worth the highest of its rarity floor (Common 10, Uncommon 30, Rare 100, Ultra Rare 300, Epic 1,000, Legendary 3,000) times its type (Special 2, Nation 1.5, Trophy 0.25, else 1) times its finish (Foil 3, Holo 9), the market median for its card at its finish, and, for a NationStates card no copy of which has sold here yet (`Card.firstSoldAt`), its bank value times 1.5; then plus 2% for each level above 1, at most 20%. The NationStates term is not multiplied by finish, so an unsold NationStates card's Foil and Holo copies are worth what its Standard copy is until a floor or a median passes it. A retired card's copies are worth 0.
- **The market median** (`CardMarketPrice`, `card_market_prices`): per card and finish, the median of its last `medianSales` (5) priced sales within `medianDays` (30), read from the priced `card_transfer_events` rows with a sale action (`SALE_ACTIONS`: `AUCTION_END`, `AUCTION_BUYOUT`, `LISTING_SALE`; `src/lib/cards/transfer-events.ts`).
- **`Card.marketValue`** is the reference value, a Standard copy at level 1 (`referenceValue`). After a card is created it is written in bulk only by the `card-values` job (every 6 hours; `runCardMarketValues`, `src/server/modules/cards/market-values.ts`, under the revalue lock 7336), which rebuilds the medians and then writes each card's reference value and a `CardValueHistory` row when it moved (the sheet's price chart reads the newest 100). The Economy tab's "Revalue every card" runs the same work, and an admin's rarity edit in the Library or the Designer writes the one card. A sale never writes it.
- **One per-copy value:** `loadCopyValues` (`src/lib/cards/copy-value.ts`, with `deckValuesByOwner`, `deckValueOf` and `topCopiesByValue`) loads `valueOfCopy` for many copies at once. Mine, the sheet, trades and the trade builder, the wallet, `vault.getUserStats`, the Passport, the dividend and the achievements all read it, so a copy is worth the same everywhere; retired cards' copies are left out, so every reader values them at 0.

### Fees and the royalty

- **The market fee** (`saleFee`, `src/lib/cards/market/fees.ts`, through `marketplaceFee`): the house rake (`card_system_auction_rake_pct`, 10%) of an amount over `saleFeeThreshold` (100 IxC), in whole IxC rounded down. It is taken on auction sales and buyouts and on listing sales (`settleCardSaleTx`, `src/lib/cards/market/settle-sale.ts`), and on each IxC leg of an accepted trade (`settleCreditLegTx`, `src/lib/cards/market/credit-leg.ts`: the payer is charged the amount and the receiver gets it less the fee). A trade of cards for cards pays nothing.
- **The nation royalty** (`payNationRoyaltiesTx`, `src/lib/cards/market/royalty.ts`): `royaltyPct` (2%) of the amount, in cents, carved out of the fee, so it adds no credits and never exceeds the fee. It goes to the owner of the nation each NATION card shows (`Country.ownerUserId`), split evenly between them, and only to an owner who is not a party to the deal. There is no fallback recipient. A trade leg pays it for the nation cards its payer receives. Each payout is `EARN_CARDS` with source `nation_card_royalty` and a "Royalty paid" notice after the commit.

### Levels and XP

A copy levels from 1 to 10 at 1,000 XP a level (`src/lib/cards/levels.ts`; the Phase 4 SQL clamped higher levels to 10 and kept their XP). `grantCardXp` (`src/lib/cards/xp-utils.ts`) grants a source's XP inside the caller's transaction and logs a `CardExperienceEvent`: a pack open (10), the daily card (10), each card traded (25, doubled for a cross-realm trade once per partner a day), an auction win or a listing purchase (50). Every source together gives a copy at most `xpDailyCapPerCopy` (100) a UTC day (`CardOwnership.xpDay` and `xpToday`, a compare-and-swap). The `card-holding-xp` job (03:30 UTC, retried each hour to 23:30) gives every copy of a card in circulation held a day or more `xpHoldingTick` (5) within the same cap, in one statement that claims the day (`cards_holding_tick_day`), so a day never ticks twice; it writes no event rows.

### Inscriptions and reports

- **Signing** (`cards.inscribe`, `src/server/modules/cards/inscriptions.ts`): a player signs a copy they hold once, up to 60 characters after cleaning (invisible characters stripped, Zalgo and tag-like text refused). The signer's display name ([the naming rule](#naming-players)) is frozen with it in `CardOwnership.inscribedName`; a player with no display name cannot sign ("Claim an IxnayID handle or a nation before signing a card."), and a locked copy cannot be signed. The frozen name shows on the back only while the signer's Passport shows Vault cards. Every whole-row copy read a player gets leaves `inscribedName` and `inscribedById` out (`INSCRIPTION_OMIT`, `src/lib/cards/inscription.ts`).
- **Signed copies trade.** An accept refuses a responder's copy signed after the current table was written, inside the settlement's compare-and-swap.
- **Reports** (`cards.reportInscription`): a signed-in player reports an inscription from a listing on the sheet or from a trade, once per copy, with a reason of up to 500 characters and at most 5 waiting at a time (`CardInscriptionReport`, `card_inscription_reports`). Staff answer in Compliance › Inscriptions (`cards.admin.compliance.inscriptionReports`, `resolveInscriptionReport`): clearing removes the text with one audit row per copy, and a lost race reads "Report not changed".

### Trades

- **One table** (`TradeOffer`; `src/server/modules/cards/trading/trade-service.ts`, `src/lib/cards/trade/trade-table.ts`): the initiator's and recipient's cards and IxC. It holds at least one card, at most 20 a side, and whole credits up to 1,000,000; a table with nothing on one side is a gift. `proposerId` is whoever wrote the current table, and only their give-side copies are locked. A counter (`trading.counterTrade`) edits the same row: the `revision` goes up and the roles swap, and an answer must name the revision it read. An offer lasts 24 hours (the `trade-expiry` job ends it). Accepting moves every copy and IxC leg in one transaction, the claim first; reject, cancel and an admin void claim at the revision read. `isCrossRealm` marks a trade where each side gives a card and a home realm on one side is missing from the other.
- **The builder** (`TradeBuilderSheet`, `src/components/cards/trade/`, hosted on Market Trades by `TradeBuilderHost`; `?trade=new` or `?trade=<id>`, with `partner`, `give` and `get`): partners are found by any Passport handle (`trading.findPartner`, `searchPartners`, `src/server/modules/cards/trading/partners.ts`). Whether they take offers from the viewer (`refusesTradeOffer`) shows before anything is built, and a blocked viewer reads the audience as "nobody". `trading.getTradeables` pages each side's tradeable copies (retired copies included, at 0 with the placeholder face; bound ones never), with wishlist marks both ways (`getPartnerWishlist`). The summary shows the fee on any IxC over the threshold before sending.
- **Naming:** a trade is direct, so the parties are named by [the naming rule](#naming-players) and never hidden by the Vault cards switch.

### The daily card, capacity and notices

- **The daily card** (`vault.claimCombinedDailyClaim`, `src/lib/vault/vault-daily-bonus.ts`): a card from `DAILY_POOL_WHERE` (`src/lib/cards/pool-draw.ts`: the catalogue of every published realm, never bound, Special, Trophy or Nation cards, nor restricted art), at the Economy tab's daily odds, which add up to 100. The odds are not shown, so the roll spreads over only the rarities that have cards (`oddsWithCards`). It needs room in the collection, rolls its finish and gives `DAILY_CLAIM` XP; a full collection can still take the credits.
- **Capacity on new-copy sources only** (`src/lib/cards/capacity.ts`): packs (the whole pack's card count), the daily card, a NationStates import (cut to the room left), crafting and admin grants check it under the owner's capacity lock (7334). Trades, purchases and auction wins never do. A full collection reads "Your collection is full. Break down cards, or buy a capacity upgrade in the Store."
- **Notices** (`src/lib/cards/card-notify.ts`): in-app, after the money has moved, in the `cards` category, or `packs` for packs bought and opened; both follow the recipient's Economic events switch. A player can mute one card from its sheet (`cards.setCardMute`, `CardNotificationMute`, `card_notification_mutes`), and no notice about it reaches them. Phase 4 added "Your listing sold", "Your listing expired", the auction-end notices to every bidder, "Counter-offer" and "Royalty paid". Nothing is sent when a wished card goes on sale.
- **The wishlist** (`cardMarket.getWishlist`, `addToWishlist`, `removeFromWishlist`; `CardWatchlist`, `src/server/modules/cards/market/wishlist.ts`, up to 200 cards): a trade partner sees it while building a trade; everyone else sees only totals (the sheet's "Wanted by", Explore's most-wanted strips). Market Wishlist lists each card with its live listings and lowest price.

### Locks

Every path that takes more than one of these takes them in this order: the claim row (the listing, auction or trade compare-and-swap); the parties' `my_vault` rows, all at once in user-id order (`lockVaultsTx`, `src/lib/vault/vault-locks.ts`); the dust balance rows, in realm-id order; the capacity lock (7334); the serial locks (7331), in card-id order by code unit (`serialLockOrder`, `src/lib/cards/serial-number.ts`); then the copy rows. A lost deadlock (P2034 or 40P01) reads CONFLICT, "try again" (`vaultsBusyError`). The takedown lock (7335) is never held with 7334, and economy saves take 7339 alone, first in their transaction. 7338 is reserved for the showcase pin.

---

## Routers and modules

Player procedures are signed in unless noted; the mutations are rate-limited.

- **`cards.*`** (`src/server/api/routers/cards/`, recombined with `mergeRouters` in `index.ts`):
  - Mine: `listMine` (`mine.ts`).
  - Explore: `exploreShelves`, `exploreGrid`, `exploreRegions` (`explore.ts`).
  - The sheet: `getSheet` (public under the read-only rate limiter; signed out it opens only cards shown in public, [above](#the-hub)) and the public `getWikiArticleExcerpt` (`sheet.ts`).
  - Showcases: `listMyShowcases`, `getShowcase`, `getMyDisplay`, `createShowcase`, `updateShowcase`, `deleteShowcase`, `addToShowcase`, `removeFromShowcase`, `pinShowcase` (`showcases.ts`).
  - Suggestions: `suggestCard`, `mySuggestions` (`suggestions.ts`).
  - The sheet's economy: `getSheetEconomy` (`sheet-economy.ts`), `getCardMute` and `setCardMute` (`mute.ts`), `inscribe` and `reportInscription` (`inscriptions.ts`), and `requestTakedown` (`takedowns.ts`).
  - `_passport.ts` holds `vaultVisible`, `holderOf` and `playersOf`, which the routers pass into `src/lib/cards/hub` (lib code never imports server modules).
  - The admin: `cards.admin.<tab>.*` ([Cards admin](#cards-admin)).
- **`cardMarket.*`** (`src/server/api/routers/card-market/`): Browse and listings, `browse`, `getMyListings`, `createListing`, `createListings`, `cancelListing`, `buyListing` (`listings.ts`; `src/server/modules/cards/market/`); the wishlist, `getWishlist`, `addToWishlist`, `removeFromWishlist` (`wishlist.ts`); auctions, `getMyActiveAuctions`, `getMyActiveBids`, `getMyAuctionParticipation`, `createAuction`, `placeBid`, `executeBuyout`, `cancelAuction` (`src/lib/economy/auction-service.ts`); and `getCardValueHistory`.
- **`trading.*`** (`src/server/api/routers/trading/`): the builder's reads, `findPartner`, `searchPartners`, `getTradeables`, `getPartnerWishlist` (`builder.ts`, on the read-only rate limiter, with identity injected; `src/server/modules/cards/trading/partners.ts`); the table, `createtradeOffer`, `counterTrade`, `respondToTrade` (accept or reject at a revision), `cancelTrade` (`offers.ts`; `src/server/modules/cards/trading/trade-service.ts`); and `getActiveTrades`, `getTradeHistory`, `getTradeById` (`queries.ts`; `trade-queries.ts`). Copy moves and locks are `src/lib/vault/trade-settlement.ts`.
- **`crafting.*`** (`src/server/api/routers/crafting/`, the old name reused for the workshop): `getNumbers` (public, read-only rate limiter), `getDust`, `breakDown`, `fuse`, `craft` (`src/server/modules/cards/workshop/`).
- **`cardPacks.*`** (`src/server/api/routers/card-packs/`): `getAvailablePacks`, `getMyPacks`, `purchasePack`, `openPack` (`src/lib/cards/pack-service.ts`).
- **Also:** `loreCards.getCardAuthorInfo` (public, rate-limited; `lore-cards/wiki.ts`), `nsImport.*` ([NationStates Integration](./ns-integration.md)) and `cardImages.*` (country card images, `cardImages.ts`).

Libraries and UI:

- `src/lib/cards/face/`, shared with the client: the face's data and labels (`types.ts`, `labels.ts`, `accessible-name.ts`, `face-size.ts`), art (`artwork.ts`, `art-credit.ts`), the sheet link (`sheet-link.ts`), the back (`trail.ts`, `ns-provenance.ts`), the controls of Mine and Explore (`filters.ts`, `mine-options.ts`, `explore-options.ts`), the reveal (`reveal.ts`), the showcase caps (`showcase-limits.ts`) and auction time (`time-left.ts`).
- `src/lib/cards/`, the economy: `economy-config.ts` and `economy-fields.ts` (the tunable numbers and the Economy tab's fields), `valuation.ts` and `copy-value.ts` (values), `finish.ts`, `dust.ts`, `levels.ts`, `xp-utils.ts`, `capacity.ts`, `pool-draw.ts`, `inscription.ts`, `card-notify.ts`, `market/` (`fees.ts`, `royalty.ts`, `settle-sale.ts`, `credit-leg.ts`, `auction-timing.ts`, `market-open.ts`) and `trade/` (`trade-table.ts`, `offered-copies.ts`, `builder-state.ts`). Server modules: `src/server/modules/cards/market/` (listings, Browse, the wishlist, the expiry job), `workshop/` (break-down, fusion, crafting, the dust ledger), `trading/` (the trade service, partners and tradeables, trade reads), `market-values.ts`, `holding-xp.ts`, `inscriptions.ts` and `sheet-economy.ts`.
- `src/lib/cards/hub/`, server only: faces (`faces.ts`), the collected check and the places that show a card (`art-visibility.ts`), the catalogue (`catalogue.ts`), Mine (`mine.ts`), Explore (`explore.ts`), the sheet (`sheet.ts`), the players a surface names (`players.ts`, filled by the router), showcases and the display (`showcases.ts`, `displayed.ts`), the market's faces (`market-faces.ts`) and faces after a committed change (`committed-faces.ts`).
- `src/lib/cards/hub-routes.ts`, shared with the client and the proxy: the hub's addresses and the redirect table.
- `src/components/cards/`: `face/` (`CardFace`, `CardFaceDown`, `CardFlip`, `CardTilt`, `CardBackProvenance`, `RarityMark`, `RealmCrest`, `ArtCreditLine`), `sheet/` (`CardSheetHost`, `CardSheet` and its sections), `reveal/` (`PackReveal`, `RevealSummary`), `showcase/AddToShowcaseDialog`, `suggest/`, `trade/` (`TradeBuilderSheet`, `TradeBuilderHost`, the side columns, card and partner pickers and summary), `sheet/economy/` (the list, buy, break-down, fuse, sign, wishlist and mute controls), `inscription/ReportInscriptionButton`, `pack-opening/PackHolographicCover` and `display/` (the NationStates credit and takedown dialog, `LoreWikiExcerpt`, `CardPriceHistoryChart`). The hub is `src/components/vault/cards/` (with Mine's `MineBulkBar`, `BulkListDialog` and `DustBalances`); its hooks are `useCardHubTab` and `useCardSheet`, and the economy's are in `src/hooks/cards/` (`useSheetEconomy`, `useCopyActions`, `useMarketActions`, `useWorkshop`, `useTradeBuilder`).

---

## Coming in later phases

- **Phase 5, the realm loop:** seasons, realm and cross-realm sets with binders and set rewards (the Sets tab), owner curation, realm packs, nation cards and editions, leaderboards and the cross-realm trade bonus.
- **Phase 6, surfaces:** the Passport showcase and set progress, realm page card blocks, the forum and ThinkPages pinned card, the achievements card-reward chip and Halo card search.

---

## Cards admin

`/admin/cards` has nine tabs (`src/app/admin/cards/cards-admin-tabs.ts`; older `?tab=` values such as `explorer`, `requests` and `takedowns` open the tab that replaced them). Every procedure is `adminProcedure` under `cards.admin.*`, one sub-router per tab plus `nationstates` and `tools` (`src/server/api/routers/cards/admin/`, pinned by `src/tests/architecture/procedure-builders.test.ts`), and each tab's logic is a module in `src/server/modules/cards/`. Every admin action writes an `AuditLog` row (`cards.audit.ts`), which the Overview feed reads.

- **Overview** (`cards.overview.ts`): counts, what waits on an admin (pending review, running imports and NationStates syncs, open and overdue takedowns) and a card-only activity feed. The feed names who acted ("System" for a cron or a flag owner) and the card or player each row is on, resolved in a few batched reads; the tab shows rarities, types, source wikis and Economy fields by their labels (`overview/feed-detail.ts`).
- **Library** (`cards.library.ts`): a realm-scoped explorer over every card (realm, type, rarity, source wiki, retired, art hidden, bound), an edit whose rarity change asks why, and bulk hide (retire) of a narrowed filter, which leaves achievement reward cards alone. Art a takedown hides, or whose licence is restricted, changes only from Compliance.
- **Imports** (`cards.import-crawl.ts`, `cards.import-jobs.ts`, `cards.importer.ts`, `cards.daily-import.ts`): find pages (a category's articles, a Commons category's files, a whole wiki or a pasted list), queue an import job, and follow its items; the NationStates sub-tab runs region syncs, pause, resume, stop and the CTE filter (`cards.ns-sync.ts`, `cards.admin.nationstates.*`).
- **Curation** (`cards.curation.ts`): the review queue (approve or reject chosen cards, or a filter exactly as the admin saw it, up to 2,000 at once; restricted art is never approved) and the suggestion queue (accept makes the card, decline gives a reason).
- **Packs** (`cards.packs.ts`): odds that add up to 100, a pool by realm, type and category, the pack's card type, a guaranteed rarity that can be cleared, limits and expiry, and a preview of the pool. A pack whose pool has no card of a rarity it shows or guarantees cannot be saved on sale, and its preview says how many bought packs that strands.
- **Economy** (`cards.economy.ts`, `cards.config.ts`): card values (saving revalues every card; "Revalue every card"), market fee and base capacity, the card economy's numbers (finish roll, daily card odds, dust, crafting and fusion, listings and royalty, card XP; `saveEconomy`, under lock 7339), bonuses with the Loreward payout grid, each source wiki's rarity table, and each article wiki's daily import.
- **Seasons** (`cards.seasons.ts`): the interim card season (SystemConfig `currentIxCardSeason`) new Lore and trophy cards take.
- **Compliance** (`cards.compliance.ts`, `cards.art-licence.ts`): one takedown queue for every source, answered within 14 days (hide the art, or decline with the reason; restore puts hidden art back), a player's own requests among them (origin Player, with "Asked by"), licence review of unknown or restricted art, and Inscriptions, the inscription report queue ([Inscriptions and reports](#inscriptions-and-reports)).
- **Designer** (`cards.designer.ts`): Special card definitions, event cards (bound or not) and achievement reward cards (always bound, one per achievement).

Outside the tabs:

- **Player card tools** (`cards.tools.ts`, `cards.admin.tools.*`): the Vault admin's user directory (`/admin/vault`) → **Cards and packs** shows a player's copies, unopened packs, listings, auctions and pending trades (Market and trades), and grants or revokes a card (with a reason; a copy with any market history cannot be revoked), awards a pack, cancels a listing (refunding the listing refund share of its fee) or an auction (refunding its bid and the same share of its fee) and voids a trade.
- **Trophy fixes** (`cards.trophies.ts`): an admin override of a Loreward winner or runner-up (`lorewards.overrideWinner`, `admin.wiki.saveLorewardWinnerOverride`) is written to every entry of its contest, marked `overriddenAt` so no sync writes over it, and reassigns or voids each changed place's trophy, with an audit row, a transfer event and a provenance note. Any day of a recorded weekly or monthly contest finds it (a day no contest holds is refused), the date must be a real calendar date, a field left out keeps its stored value, and a new holder starts with no page or score. Both override paths (the Lorewards run console's Save and the override card) tell the Discord bot after the commit with the announcement on (`tellBotOfOverride`, `src/lib/lorewards/bot-client.ts`), so saving is what announces, and there is no separate Announce button. If the bot is unreachable the override still stands and returns `botSynced: false`, and both toasts (`overrideToast`) warn "Saved": the bot was not told, so nothing was announced, and it picks the change up on its next sync.

---

## Removed in the cards refresh (2026-10-15)

- Crafting: the `crafting` router, its rule module and seed, `CraftingRecipe` and `CraftingHistory`; the Vault config's `isCraftingEnabled` key and its admin toggle; its old page redirects to Mine. Crafting came back in Phase 4 as the workshop, reusing the `crafting` router name ([Dust and crafting](#dust-and-crafting)). The `SPEND_CRAFT` / `CRAFT` enum values stay. Packs still exclude legacy crafted cards by their stored `metadata.crafted` marker.
- Junking: `cards.junkCards`, the junk rate and the batch limit. Historical `JUNK_CARDS` ledger rows keep their label. Breaking down for dust replaces it.
- Card stats.
- The `MYTHIC` and `DIVINE` rarities, and the legacy type strings.
- `User.totalCards`, `deckValue`, `collectorLevel` and `collectorXp`: deck value is computed live from `loadCopyValues` (`src/lib/cards/copy-value.ts`).
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
- Phase 4 (the economy; `src/tests/architecture/cards-economy-removals.test.ts` pins these):
  - the old trade screens and helpers (`TradeOfferModal`, `TradeNegotiation`, `src/lib/cards/ownership-card.ts`, `trading/social.ts`) and the procedures `cards.getMyCards`, `cards.getUserCards`, `cardMarket.getActiveAuctions`, `cardMarket.getCardTransferHistory` and `trading.searchTradingPartners`;
  - the old value cron (`src/lib/lorewards/card-value-cron.ts`, `getCardMarketValue`, `recomputeAllCardValues`) and every sale's write of `Card.marketValue`;
  - the royalty's earliest-puller fallback, the separate counter-offer row (`TradeOffer.counterOfferFromId` and the `COUNTERED` status), the wishlist's `targetPrice` and its auction alert, the 30- and 60-minute auctions, the rule that signed copies cannot be traded, and a pack's fallback to another rarity.

---

## Deploy runbook notes

The full Phase 1 production runbook lives in the Phase 1 plan, and Phase 2's, Phase 3's and Phase 4's are at the end of this page ([Phase 2](#phase-2-deploy-runbook-owner), [Phase 3](#phase-3-deploy-runbook-owner), [Phase 4](#phase-4-deploy-runbook-owner)); three Phase 1 points to keep in mind:

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

Production and the `ixstats` database are touched only here, by the owner, in this order. Phase 3 needs Phases 1 and 2 (its SQL reads Phase 1's `cards."realmId"`); if they go out in one deploy, follow Phase 1's window, and `scripts/deploy-production.sh` runs each phase's SQL in turn. The read-only checks run with `docker exec ixstats-postgres psql -U postgres -d ixstats -c "<query>"`. This runbook describes Phase 3 as merged into `rose-garden` on 2026-10-20, with Phases 1, 2 and 4 (the ledger is `.superpowers/sdd/436-cards-phase-3/` in the owner's working tree, which git ignores).

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
7. **Tell players.** Cards are one hub with four tabs (Mine, Sets, Market, Explore); collections are showcases, and their likes and comments are gone; cards you have not collected show their art, muted; trophy cards are on the Lorewards tab and Passports, not in Explore; packs open in one short reveal; outbid auctions stay in Your bids with Raise bid; anyone can open the cards a Passport shows without signing in, and everything in the Vault needs sign-in; the NationStates card list left Settings ([the Vault help page](../../src/content/help/vault/overview.md) says so).

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
- **Later phases:** a player takedown form for cards other than NationStates', pack-level card type editing, and an end to a pack's fallback to another rarity were built in Phase 4 ([Phase 4](#phase-4-deploy-runbook-owner)); versions, the channel (Release Candidate until then) and one changelog entry come in Phase 6.

Fixed since the phase's final review:

- `resolveHandleUser` no longer treats `%` and `_` as wildcards (`likeLiteral`, `src/lib/utils/like-literal.ts`, `28bbb32ec`); Explore's title and region searches use it too.
- The `CHANGELOG.md` entries that linked to deleted card files name them in code font (`f2ed9059d`); `src/tests/scripts/sync-reference-docs.test.ts` is green.
- `bun run audit:arch` passes: `ixtwitter-sync.ts` is split below its ceiling (`d0b90f1bb`).
- Card state refreshes after every change that moves or locks a copy (`useCardsRefresh`; the final review's I2).
- One rule names players ([Naming players](#naming-players); the final review's I1): the Passport handle while it is a real name, not the player's Clerk id; else the nation they hold; else "a player". It names the sheet's trail, signers and sellers, the showcase byline, the trade card, the offer notification and Market history, all through one batched read (`loadPlayerNames`), so no player with no stored handle, wiki name or forum name shows as "@user_…".
- A hidden card's excerpt and Commons file title no longer name its art; another player's showcase leaves retired copies out, and a link from it no longer opens one; the sell picker searches and pages, and shows a `?sell=` copy whichever page holds it; a committed pack open or import whose faces cannot be read reports success, and the reveal then says the pack is open and its cards are in Mine; the trade builder values a retired copy at 0 with the placeholder face; Halo has one Open card packs entry; the Lorewards tab marks a trophy with `?trophy=`; the sheet no longer says a Special card comes in packs; the help gives the 5% bid step.

Still open (no deploy step):

- **Drop the Lorewards tab's `?card=` fallback** one release after this one (`VaultLorewardsPanel`): new links use `?trophy=`, and an older `?card=` link still marks the trophy (and opens its sheet). The WikiOS Lorewards page keeps `?card=` for its highlight; it hosts no card sheet, so the two never clash there.
- **An integration test of the uncollected mark and the sheet's opening places on a real database** (the final review's recommendation): every such test runs on mocked Prisma. One test on a scratch schema would cover an uncollected card in Explore, the sheet and the market, a live listing, a public and a private showcase, and an expired offer.

Accepted limits (ledgered, no change planned):

- **Collector numbers can repeat** (the owner accepted it). A new card takes its realm's highest number plus one, so after a realm's top card leaves (a realm move or a deletion) the next card takes its number again.
- **Old trail actions read "Moved"** (no change). A transfer action the trail does not know (`trailLabel`) reads "Moved". Production was not checked for action strings older than the schema comment: `SELECT action, count(*) FROM card_transfer_events GROUP BY 1;` lists them.
- A copy traded between a showcase add's ownership check and its insert can stay in its old owner's showcase ([Showcases](#showcases)).
- A double pin from two tabs leaves two pinned showcases; the display takes the latest, but another player's view of each showcase reads its own pin, so both read Pinned until one is unpinned. A per-player lock (namespace 7338) would stop it if it matters.
- Two concurrent admin overrides that move cards between the same realms can deadlock on lock 7337; Postgres aborts one, and it can be retried.
- The browser's own Back onto a history entry with no state leaves the sheet drawn until its close button or Escape.

---

## Phase 4 deploy runbook (owner)

Production and the `ixstats` database are touched only here, by the owner, in this order. Phase 4 needs Phases 1 to 3 (its SQL reads Phase 1's finishes and Phase 2's transfer-event columns and takedown origins); if they go out in one deploy, follow Phase 1's window, and `scripts/deploy-production.sh` runs each phase's SQL in turn. The read-only checks run with `docker exec ixstats-postgres psql -U postgres -d ixstats -c "<query>"`. This runbook describes Phase 4 as merged into `rose-garden` on 2026-10-20, with Phases 1 to 3 (the ledger is `.superpowers/sdd/437-cards-phase-4/` in the owner's working tree, which git ignores).

1. **Check the status columns before the deploy.** `SELECT status, count(*) FROM "TradeOffer" GROUP BY 1;` and `SELECT status, count(*) FROM "CardAuction" GROUP BY 1;`. The SQL turns both into enums and stops, changing nothing, on any value outside `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED` and `EXPIRED` (trades) or `ACTIVE`, `COMPLETED` and `CANCELLED` (auctions). Map such rows first; an old `COUNTERED` trade becomes `REJECTED`.
2. **Check the packs' odds.** `SELECT id, name, "isActive", round(("commonOdds" + "uncommonOdds" + "rareOdds" + "ultraRareOdds" + "epicOdds" + "legendaryOdds")::numeric, 2) AS total FROM "CardPack" WHERE round(("commonOdds" + "uncommonOdds" + "rareOdds" + "ultraRareOdds" + "epicOdds" + "legendaryOdds")::numeric, 2) <> 100;` should list nothing. A pack now rolls each rarity in proportion to its odds' total, as the Store scales them, so a pack that does not total 100 gives its scaled odds; fix it in the Packs tab. After the deploy, preview each pack on sale in the Packs tab: a pack whose pool has no card of a rarity it shows or guarantees is no longer sold or opened ([Packs and the reveal](#packs-and-the-reveal)).
3. **Stop the app first, as for Phases 1 and 3.** Run `pm2 stop` for the app server and the PM2 processes (`ixstats-cron`, `ixstats-ws`, `ixstats-ixtwitter`). The SQL converts `TradeOffer.status` and `CardAuction.status` and drops `TradeOffer.counterOfferFromId` and `card_watchlist.targetPrice`, which the old code reads and writes, so no old code may run between it and the new build. If the app cannot stop, at least switch off the market (`vault_isAuctionsEnabled`) and trading (`vault_isTradingEnabled`) in the Vault admin first and let running auctions and trades settle.
4. **Back up.** `scripts/deploy-production.sh` runs `bun run db:backup` before any SQL and aborts if the dump fails. Going back to pre-Phase-4 code is a restore: the old code cannot read the enum columns or the new trade table (`bun run deploy:rollback -- <rollback-branch> --restore backups/ixstats-<stamp>.dump`, the [release guide](../operations/release-guide.md#rollback)).
5. **Deploy: the Phase 4 SQL goes before the code.** `scripts/deploy-production.sh` applies `prisma/migrations/20261101120000_cards_economy/migration.sql` right after Phase 3's face-hub SQL and before `db push` (which would drop and re-add the status columns, losing every value), then pushes, builds and reloads PM2. Applied by hand, it is the `psql` command in the file's header, run before the new code starts. The SQL is one transaction and a no-op when re-run (on the `ixstats_cards` clone: 0.52 s, then 0.14 s). It adds the listing, dust, market price, mute and inscription report tables; `Card.firstSoldAt`; the copy's frozen signer name, import share and daily XP columns, clamping levels to 10 (XP is kept); each transfer event's finish, card and serial; the trade's proposer, revision and cross-realm flag; each auction's card, serial and stored listing fee (5, or 10 featured, for every existing auction); `ON DELETE SET NULL` on the auction's copy link; and the `PLAYER_REQUEST` takedown origin. It marks every imported NationStates copy for the import share from the import ledger, so there is no backfill script.
6. **Read-only checks after the deploy.** Note each result:
   - the enums: `SELECT table_name, udt_name FROM information_schema.columns WHERE table_name IN ('TradeOffer', 'CardAuction', 'card_listings') AND column_name = 'status';` shows `TradeOfferStatus`, `CardAuctionStatus` and `CardListingStatus`;
   - the new tables: `SELECT to_regclass('card_listings'), to_regclass('card_dust_balances'), to_regclass('card_dust_events'), to_regclass('card_market_prices'), to_regclass('card_notification_mutes'), to_regclass('card_inscription_reports');` names all six;
   - the import share matches the ledger: `SELECT count(*) FROM "CardOwnership" o WHERE o."importDiscounted" <> EXISTS (SELECT 1 FROM ns_import_ledger l WHERE l."ownershipId" = o.id);` is 0;
   - levels: `SELECT max(level) FROM "CardOwnership";` is at most 10;
   - the history keeps: `SELECT confdeltype FROM pg_constraint WHERE conname = 'CardAuction_cardInstanceId_fkey';` is `n`, and `SELECT count(*) FROM "CardAuction" WHERE "listingFee" = 0;` is 0.
7. **Repair any deploy-window auctions.** Only if old code ran after the SQL (the app was not stopped): an auction it created stored a listing fee of 0 after charging 5 or 10, so its refund would be 0. With the restart time noted: `UPDATE "CardAuction" SET "listingFee" = CASE WHEN "isFeatured" THEN 10 ELSE 5 END WHERE "listingFee" = 0 AND "createdAt" < '<restart time>';`.
8. **Cron.** After the new code is live, add `listing-expiry` and `card-holding-xp` to `CRON_ENABLED_JOBS` (unless it is `*`), make sure `card-values`, `auction-completion` and `trade-expiry` are named too, and restart the cron runner (`pm2 restart ixstats-cron --update-env`). Not before: the old runner refuses to start on a job name it does not know. `card-values` keeps its name and schedule and now writes the market medians and every card's reference value. Without `listing-expiry`, listings never expire or refund; without `card-holding-xp`, copies gain no holding XP.
9. **Revalue once.** Press "Revalue every card" in the Economy tab, or run the `card-values` job once, right after the deploy. Until it runs, the sheet shows a viewer who holds no copy the stored `Card.marketValue`, which predates the new formula. On the clone the first run moved 15,848 of 70,586 cards in 1.78 s.
10. **Check the app.** List a copy from its sheet and cancel it (half the fee comes back); start a 3-day auction from Selling; break down a copy, fuse three, craft a Common; sign a copy; build a trade by handle and counter it; mute a card; open a non-NationStates card's About and see "Request a takedown".
11. **Tell players.** Fixed-price listings and a wishlist in the Market; auctions of 24 hours, 3 days or 7 days; the trade builder with counters in the same table, gifts and IxC for cards; finishes, fusion, dust and crafting; copy levels and daily XP; signing copies; the market fee on trade IxC over 100; a player can ask for a takedown of any card not from NationStates ([the help pages](../../src/content/help/vault/trading.md) and [Dust, fusion and crafting](../../src/content/help/vault/crafting.md) say so).

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

- **An inscription freezes the signer's display name at signing**, refuses a player with no name, and shows the name only while the signer shows Vault cards ([Inscriptions and reports](#inscriptions-and-reports)).
- **Burned copies keep their history:** the auction and listing rows keep the card and serial, and the copy link goes `ON DELETE SET NULL` ([Auctions](#auctions)).
- **The empty rarity tier:** a pack never falls back to another rarity. Its purchase, putting it on sale, awarding it and its open are refused while a rarity it shows or guarantees has no card, and a bought pack stays unopened. The daily card, whose odds are not shown, rolls only over the rarities that have cards ([The daily card, capacity and notices](#the-daily-card-capacity-and-notices)).
- **Player takedown requests** for cards not from NationStates: signed in only, one active request per card, at most 5 waiting per player, an optional contact, and the 14-day deadline ([The hub](#the-hub)).
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
