# 💎 Vault Cards & Booster Packs Engine

**Last updated:** 2026-10-15

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
- **Home realm, finish and bound**: every card belongs to one realm (`Card.realmId`: Ixnay, a player realm, or the NationStates, IIWiki and AltHistory system realms); every copy has a finish (`CardOwnership.finish`: Standard, Foil, Holo, Serialised; Phase 1 mints Standard, and Serialised for trophies); `Card.isBound` cards (achievement cards and trophies) can't be traded, auctioned or listed (`assertNoBoundCopies`, `src/lib/cards/bound.ts`)
- **One mint path**: every copy comes from `mintCopy` (`src/lib/cards/mint.ts`), which takes the serial under a per-card advisory lock and writes the mint row to `CardTransferEvent` with its source
- **Marketplace & P2P Trading**: Live auctions with fee schedules (`cardMarket`), peer-to-peer trade offers with escrow (`trading`)
- **Attribution & Compliance**: Legally-sound attribution footer for NationStates imports and self-service takedown verification

---

## Card Types

### 1. NATION Cards
Linked to an IxStates country via `Card.countryId`:
- **Stats**: Cards have no stats (removed 2026-10-15).
- **Valuation**: The `card-values` cron (`src/lib/lorewards/card-value-cron.ts`, every 6 hours) records the market value of NATION cards in `CardValueHistory` and flags changes over 20%. A value comes from rarity and type (`getCardMarketValue`); the former GDP correlation was dead code and is gone. In practice it does nothing today: no NATION card has a `countryId`.
- **Royalty**: when a NATION card sells at auction, 2% goes to the owner of its nation, else the earliest human puller of the card (`auction-service.ts`), the one place a country feeds the Vault economy.
- **Minting**: There is no automatic per-country card generator; NATION cards come from admin creation.

### 2. LORE Cards
Generated from IxWiki/IIWiki articles via `loreCardsRouter`, the admin Lore Batch tool, user requests (`loreCards.requestLoreCard` → admin queue), and the daily `lore-card-generation` cron:
- Categories: `LoreCategory` — MILITARY, DIPLOMACY, GEOGRAPHY, RELIGION, CULTURE, GOVERNMENT, PEOPLE, ECONOMY, SCIENCE, HISTORY, NATION, SPECIAL
- The natural key is the wiki and the canonical article title (`cards_lore_natural_key`), so one article makes one Lore card; a lost race reports `already exists`.
- Rarity suggested by `analyzeWikiSignals()` (`src/lib/cards/rarity-algorithm.ts`): word count 25%, links 25%, edit count 15%, category breadth 15%, images 10%, article age 10%; admins can override.

### 3. NS cards
Synchronized from the official NationStates per-season card dumps (`cardlist_S{season}.xml.gz`) via admin-triggered region syncs, plus user deck imports:
- **NS facts**: nation, region, category, season and bank value live in `metadata.nsData` (`src/lib/cards/ns-facts.ts`); the bank value feeds valuation. A deck import runs in one transaction, and each NS card is imported once ever per nation (`NSImportLedger`), from any account.
- **URL-Only Storage**: Stores flag image URLs; no binary bytes persisted to disk or DB.
- **Streaming Proxy (`/api/proxy-ns-image`)**: Server-side proxy (nationstates.net / Wikimedia only, 24h cache, placeholder fallback on 403).
- **Attribution Footer (`NationStatesAttribution.tsx`)**: Pinned footer inside `CardDetailsModal` with fan-site attribution copy and takedown trigger.
- **Self-Service Takedown**: Nation owners verify identity via NS checksum (site-specific HMAC-MD5 token) to retire cards (`nsImport.requestSelfServiceTakedown`).

### Loreward trophy cards
Every recorded Loreward place (daily, weekly or monthly; winner or runner-up) is a one-of-one, Serialised TROPHY card of the winning page, bound to the account it was granted to (`src/lib/lorewards/trophy-cards.ts`):
- **Identity:** `Card.lorewardEntryId` and `Card.lorewardEdition` (`winner` or `runner-up`), unique together. The card carries the contest, place, date and winner in its metadata. Rarity: Legendary for a monthly winner; Epic for a weekly winner and a monthly runner-up; Rare for the rest. A place without a recorded page (weekly and monthly entries, and some older dailies) is titled by contest and date.
- **Minting and granting:** `syncTrophyCards` (called by the Lorewards `fullSync` and `/api/lorewards/sync`, not by the 10-minute state sync) mints the missing cards, then gives each unowned card to its winner once that wiki account has a verified IxWiki link (`resolveLorewardUser`). With no link the card waits unowned; it is granted once and never re-granted.
- **Backfill:** `bun scripts/backfill-loreward-trophy-cards.ts [--apply]` mints a card for every recorded place back to 2017 with no credits (dry run by default, idempotent).
- **Economy:** a trophy card is a real holding, so the Wallet's deck value and net worth count it, but it is left out of the dividend's collection interest and of the deck-value achievements (excluded by type, `cardType: TROPHY`, and `deckValueExTrophy`). Admin duplicate cleanup (`purgeDuplicateCards`) never deletes one.

### 4. SPECIAL cards
Commemorative milestone editions (e.g. *IxStates 1.0 Ogma Launch*), event cards and achievement cards (commemoratives and achievement cards are bound).

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

`guaranteedRarity` is stored on each pack but **not yet enforced** at open time — every card rolls independently against the pack's odds. `themeFilter` is likewise stored but not applied.

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

The full production runbook lives in the Phase 1 plan; two points to keep in mind:
- **Stop the app first.** Run `pm2 stop` for the app server and the PM2 processes (`ixstats-cron`, `ixstats-ws`, `ixstats-ixtwitter`) before the deploy. `scripts/deploy-production.sh` runs the backfill and the constraint SQL before the build, so no old code may run between the destructive SQL and the new build.
- **Re-run the achievement-card seed after the deploy** (`bun prisma/seeds/achievement-cards.ts`), so existing achievement cards get `realmId` and `isBound`.

---

## Routers & Data Architecture

All card operations route through modularized subdirectories:
- `src/server/api/routers/cards/` (`index.ts`, `inventory.ts`, `collections.ts`, `admin.ts`, `settings.ts`, `operations.ts`)
- `src/server/api/routers/card-packs/` (`user.ts`, `discovery.ts`, `admin.ts`)
- `src/server/api/routers/card-market/` (`auctionManagement.ts`, `auctionQueries.ts`, `bids.ts`, `analytics.ts`)
- `src/server/api/routers/cardImages.ts` (card XP helpers live in `src/lib/cards/xp-utils.ts`)
- `src/server/api/routers/lore-cards/`
- `src/server/api/routers/ns-import/`
- `src/server/api/routers/trading/`

---

## Known Gaps

- `guaranteedRarity` / `themeFilter` on packs are not enforced; Stage 4 "Keep" and "List" quick actions only log.
- Pack artwork referenced by the seed (`/images/packs/pack_*.svg`) is not in the repo (`public/images/*` is git-ignored).

---

## Related Documentation

- [MyVault System Guide](./myvault.md)
- [IxCredits Economy Guide](./ixcredits.md)
- [NationStates Integration Guide](./ns-integration.md)
- [API Reference: IxVault (Cards & Credits)](../reference/api-complete.md)
