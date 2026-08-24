# 💎 Vault Cards & Booster Packs Engine

**Parent App Suite:** Vault (`VAULT_VERSION = 2`, dev codename `IxVault`)  
**Subsystems:** 3D Card Engine, Booster Pack Gacha, Crafting & Recycling, NS Import Bridge  
**Primary Action:** `COLLECT` | **Domain Accent:** Burnished Copper (`#D97706` / `--color-amber-600`)  
**Route:** `/vault/cards`, `/vault/packs` | **Status:** 📀 Gold Master (100% Ready)  

The Vault Cards system provides 3D holographic collectibles integrating sovereign states, MediaWiki historical lore, NationStates imports, and milestone editions with dynamic performance-based rarity calculation and physics-based pack peeling.

---

## Overview

- **Multi-Source Card Types**: NATION, LORE, NS_IMPORT, SPECIAL, COMMUNITY
- **Dynamic Rarity Calculation**: Performance-based rarity scoring (Common $\to$ Legendary)
- **Ownership & Upgrades**: Quantity tracking, locking protection, leveling, and evolution
- **Pack Mechanics**: Basic, Premium, Elite, Themed, Seasonal, Event packs
- **Card Recycling & Junking**: Recycle unlocked cards for instant IxCredits based on rarity
- **Marketplace & P2P Trading**: Live auctions with fee schedules, peer-to-peer trade offers with escrow
- **Attribution & Compliance**: Legally-sound attribution footer for NationStates imports and self-service takedown verification

---

## Card Types

### 1. NATION Cards
Auto-generated from IxStates nations with dynamic stats (0–100):
- **Economic Power**: Based on GDP per capita, tier, and growth rate
- **Diplomatic Influence**: Based on embassy network, relationship strengths, and active missions
- **Military Strength**: Based on defense budget, readiness score, and force branches
- **Social Vitality**: Based on ThinkPages followers, posts count, and engagement rate
- **Rarity Calculation**: Scored dynamically from nation stats, leaderboard position, achievements, and account age.

### 2. LORE Cards
Generated from IxWiki/MediaWiki articles via `loreCardsRouter` and batch generator:
- Categories: Historical Figures, Geography/Landmarks, Historical Events, Cultural Artifacts, Legendary Items
- Rarity scored by article length, references, featured status, and inbound cross-links.

### 3. NS_IMPORT Cards
Synchronized daily from official NationStates card dumps:
- **URL-Only Storage**: Stores flag image URLs; no binary bytes persisted to disk or DB.
- **Streaming Proxy (`/api/proxy-ns-image`)**: In-memory proxy preventing hotlinking issues.
- **Attribution Footer (`NationStatesAttribution.tsx`)**: Pinned footer inside `CardDetailsModal` with fan-site attribution copy and takedown trigger.
- **Self-Service Takedown**: Nation owners verify identity via HMAC-MD5 checksum token to retire cards.

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

| Rarity | Standard Pack Drop Rate | Visual Accent | Glow / Shader Effect |
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
4. **Quick Actions**: Lock, Junk, Keep, or List on Market

### Pack Tiers
- **Basic (15 IxC)**: Standard odds (Common 65%, Uncommon 25%, Rare 7%, Ultra Rare 2%, Epic 0.9%, Legendary 0.1%)
- **Premium (35 IxC)**: Enhanced odds (Common 50%, Uncommon 30%, Rare 15%, Ultra Rare 3.5%, Epic 1.3%, Legendary 0.2%)
- **Elite (75 IxC)**: Guaranteed 1+ Rare or better (Common 30%, Uncommon 35%, Rare 25%, Ultra Rare 7%, Epic 2.5%, Legendary 0.5%)
- **Themed (50 IxC)** / **Seasonal (60 IxC)** / **Event (100 IxC)**: Filtered pools and limited quantities

---

## Card Crafting, Evolution & Junking

### Crafting & Fusion Recipes (`craftingRouter`)
- **Fusion**: Combine duplicate cards into higher rarity (e.g. 2 Commons $\to$ 1 Uncommon for 250 IxC; 3 Rares $\to$ 1 Ultra-Rare for 1,000 IxC).
- **Evolution**: Upgrade individual card rarity directly using IxCredits.

### Card Recycling (Junking)
- Unlocked cards (`isLocked === false`) can be recycled via `api.cards.junkCards`, permanently deleting the ownership record and crediting IxCredits scaled by rarity. Locked cards are protected from accidental junking.

---

## Routers & Data Architecture

All card operations route through modularized subdirectories:
- `src/server/api/routers/cards/` (`index.ts`, `core.ts`, `stats.ts`, `ownership.ts`)
- `src/server/api/routers/card-packs/`
- `src/server/api/routers/card-market/`
- `src/server/api/routers/card-analytics/`
- `src/server/api/routers/cardImages.ts` & `card-xp.ts`
- `src/server/api/routers/lore-cards/`
- `src/server/api/routers/ns-import/`
- `src/server/api/routers/crafting/` & `trading/`

---

## Related Documentation

- [MyVault System Guide](./myvault.md)
- [IxCredits Economy Guide](./ixcredits.md)
- [NationStates Integration Guide](./ns-integration.md)
- [API Reference: Cards Routers](../reference/api-complete.md#cards-router)
