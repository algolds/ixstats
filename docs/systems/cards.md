# 💎 Vault Cards & Booster Packs Engine

**Parent App Suite:** Vault (`IXVAULT_VERSION = 2`, dev codename `IxVault`)  
**Subsystems:** 3D Card Engine, Booster Pack Gacha, Crafting & Recycling, NS Import Bridge  
**Primary Action:** `COLLECT` | **Domain Accent:** Burnished Copper (`#D97706` / `--color-amber-600`)  
**Route:** `/vault/cards`, `/vault/marketplace?tab=store` (`/vault/packs` redirects here) | **Status:** Release Candidate (platform 1.4.0) — see [Known Gaps](#known-gaps)  

The Vault Cards system provides 3D holographic collectibles integrating sovereign states, MediaWiki historical lore, NationStates imports, and milestone editions with wiki-signal rarity suggestions and a cinematic pack-opening sequence.

---

## Overview

- **Multi-Source Card Types**: NATION, LORE, NS_IMPORT, SPECIAL, COMMUNITY
- **Lore Categories**: 13-value `LoreCategory` enum (`prisma/schema/enums.prisma`) with per-category icons and themes
- **Ownership & Upgrades**: Serial numbers, escrow locking (`isLocked` while listed/traded), card XP/leveling, and crafting
- **Pack Mechanics**: Data-driven `CardPack` rows (`packType` BASIC, PREMIUM, ELITE, EVENT, LIMITED seeded; THEMED/SEASONAL defined in `PackType` but unseeded)
- **Card Recycling & Junking**: Recycle unlocked cards for instant IxCredits based on rarity
- **Marketplace & P2P Trading**: Live auctions with fee schedules (`cardMarket`), peer-to-peer trade offers with escrow (`trading`)
- **Attribution & Compliance**: Legally-sound attribution footer for NationStates imports and self-service takedown verification

---

## Card Types

### 1. NATION Cards
Linked to an IxStates country via `Card.countryId`:
- **Stats**: Shared Force / Wealth / Influence / Legacy stat set (`src/lib/cards/stat-config.ts`; special stats via `src/lib/country-geo/special-stats-populator.ts`)
- **Valuation**: The daily `card-values` cron (`src/lib/lorewards/card-value-cron.ts`) re-prices NATION cards against their country's GDP and growth, but in practice does nothing today: no NATION card has a `countryId`.
- **Minting**: There is no automatic per-country card generator; NATION cards come from admin creation and crafting results (crafted cards default to `cardType: "NATION"`).

### 2. LORE Cards
Generated from IxWiki/IIWiki articles via `loreCardsRouter`, the admin Lore Batch tool, user requests (`loreCards.requestLoreCard` → admin queue), and the daily `lore-card-generation` cron:
- Categories: `LoreCategory` — MILITARY, DIPLOMACY, GEOGRAPHY, RELIGION, CULTURE, GOVERNMENT, PEOPLE, ECONOMY, SCIENCE, HISTORY, NATION, SPECIAL, NS_IMPORT
- Rarity suggested by `analyzeWikiSignals()` (`src/lib/cards/rarity-algorithm.ts`): word count 25%, links 25%, edit count 15%, category breadth 15%, images 10%, article age 10%; admins can override.

### 3. NS_IMPORT Cards
Synchronized from the official NationStates per-season card dumps (`cardlist_S{season}.xml.gz`) via admin-triggered region syncs, plus user deck imports:
- **URL-Only Storage**: Stores flag image URLs; no binary bytes persisted to disk or DB.
- **Streaming Proxy (`/api/proxy-ns-image`)**: Server-side proxy (nationstates.net / Wikimedia only, 24h cache, placeholder fallback on 403).
- **Attribution Footer (`NationStatesAttribution.tsx`)**: Pinned footer inside `CardDetailsModal` with fan-site attribution copy and takedown trigger.
- **Self-Service Takedown**: Nation owners verify identity via NS checksum (site-specific HMAC-MD5 token) to retire cards (`nsImport.requestSelfServiceTakedown`).

### 4. SPECIAL & COMMUNITY Cards
Commemorative milestone editions (e.g. *IxStates 1.0 Ogma Launch*), contest winners, and alliance commemoratives.

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
4. **Quick Actions**: Junk (wired to `cards.junkCards`), Keep, or List (Keep/List are UI-only for now)

### Pack Tiers
Packs are rows in `CardPack`, seeded from `prisma/seeds/data/card-packs.json` and managed at `/admin/cards`; each row carries its own price, card count, odds, and optional `season` / `cardType` pool filter. Seeded lineup (20 packs; the Season I–IV packs draw from the NS_IMPORT pool):
- **Season I–IV Recruit (BASIC)**: 100 / 120 / 150 / 200 IxC, 5 cards (e.g. S1: Common 70%, Uncommon 22%, Rare 6%, Ultra Rare 1.5%, Epic 0.4%, Legendary 0.1%)
- **Season I–IV Veteran (PREMIUM)**: 500 / 600 / 750 / 1,000 IxC, 5–6 cards
- **Season I–IV Commander Elite (ELITE)**: 2,000 / 2,400 / 3,000 / 4,000 IxC, 8–10 cards
- **Cross-pool packs**: Omni Starter (150), World Summit (3,500), High Roller Mega (5,000), Lore Master Elite (6,000, LORE-only), Championship Event (2,500), Anniversary (8,000), Limited Collector's Edition (12,000, 150 copies), Founder (15,000)

`guaranteedRarity` is stored on each pack but **not yet enforced** at open time — every card rolls independently against the pack's odds. `themeFilter` is likewise stored but not applied.

---

## Card Crafting, Evolution & Junking

### Crafting & Fusion Recipes (`craftingRouter`)
- **Fusion**: Combine cards into higher rarity (e.g. 2 Commons $\to$ 1 Uncommon for 250 IxC; 3 Rares $\to$ 1 Ultra-Rare for 1,000 IxC).
- **Evolution**: Upgrade toward a higher rarity using IxCredits (200–4,000 IxC).
- A successful craft mints a new `Card` row (from `resultCardId`, else a generic "<recipe> Result" NATION card); materials are consumed on every attempt. Recipes are listed in `prisma/seeds/crafting-recipes.ts`.

### Card Recycling (Junking)
- Unlocked cards (`isLocked === false`) can be recycled via `api.cards.junkCards`, permanently deleting the ownership record and crediting IxCredits through the ledger as `EARN_CARDS` (`junkValue()` = rarity floor × `junkRate`, currently 0.25 and capped at `JUNK_RATE_MAX` 0.5, `src/lib/cards/valuation.ts`). Cards locked in escrow (listed at auction or in a pending trade) cannot be junked; there is no manual lock toggle.

---

## Routers & Data Architecture

All card operations route through modularized subdirectories:
- `src/server/api/routers/cards/` (`index.ts`, `inventory.ts`, `collections.ts`, `admin.ts`, `settings.ts`, `operations.ts`)
- `src/server/api/routers/card-packs/` (`user.ts`, `discovery.ts`, `admin.ts`)
- `src/server/api/routers/card-market/` (`auctionManagement.ts`, `auctionQueries.ts`, `bids.ts`, `analytics.ts`)
- `src/server/api/routers/cardImages.ts` (card XP helpers live in `src/lib/cards/xp-utils.ts`)
- `src/server/api/routers/lore-cards/`
- `src/server/api/routers/ns-import/`
- `src/server/api/routers/crafting/` & `trading/`

---

## Known Gaps

- `guaranteedRarity` / `themeFilter` on packs are not enforced; Stage 4 "Keep" and "List" quick actions only log.
- Crafting: `/vault/crafting` passes card-definition IDs where `crafting.craftCard` expects `CardOwnership` IDs; `CraftingRecipe.successRate` is documented as 0–1 in the schema but rolled as 0–100 in the router; the crafting seed uses fields (`materialsRequired`, `resultType`, `collectorXP`, `unlockRequirement`) and a `MYTHIC` rarity that the schema does not have.
- Pack artwork referenced by the seed (`/images/packs/pack_*.svg`) is not in the repo (`public/images/*` is git-ignored).

---

## Related Documentation

- [MyVault System Guide](./myvault.md)
- [IxCredits Economy Guide](./ixcredits.md)
- [NationStates Integration Guide](./ns-integration.md)
- [API Reference: IxVault (Cards & Credits)](../reference/api-complete.md)
