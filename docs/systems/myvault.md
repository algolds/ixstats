# 💎 Vault — Metagame Incentives, Social Economy & Collectibles

**Parent App Suite:** Vault (`IXVAULT_VERSION = 2` → `VERSIONS.apps.ixvault` in `src/lib/buildVersion.ts`, dev codename `IxVault`)  
**Subsystems:** Metagame Progression, 3D Cards & Showcase, Booster Pack Gacha, Atomic Credit Ledger, Marketplace & Trading, Achievements (`ACHIEVEMENTS_VERSION = 2`)  
**Primary Action:** `COLLECT` | **Domain Accent:** Burnished Copper (`#D97706` / `--color-amber-600`)  
**Routes:** `/vault`, `/vault/cards`, `/vault/marketplace`, `/vault/import`, `/achievements`, `/leaderboards` | **Status:** Release Candidate (platform 1.4.0 "Lobster Crosby") — see [Known Gaps](#known-gaps)  

Vault is the central incentive, social currency, and metagame reward platform for IxStates. It rewards active governance, wiki authorship, and community collaboration with daily gross dividends, holographic collectible card packs, atomic ledger transactions, peer marketplace trading, and trophy progression racks.

---

## Layout & Sections

There is no client-side `VaultRouter`: `/vault` uses normal Next.js routes wrapped in a shared layout (`src/app/vault/layout.tsx`: `AuthenticationGuard` + page container). Navigation is the shell sidebar's source list (Vault entry in `src/lib/navigation/app-sections.ts`); the Vault dashboard (`/vault`) has the wallet card with the balance:
- `src/components/vault/vault-sections.ts` – the `VaultSection` type and `getSubTabFromPathname` only; the navigation itself is the Vault entry of the source list
- **Sections** (`src/components/vault/sections/`):
  - `Dashboard` (`VaultDashboardSection.tsx`, `/vault`): Balance overview, today's earnings breakdown, XP progress bar, yield projections, recent activity
  - `Cards` (`VaultCardsSection.tsx`, `/vault/cards`, `/vault/inventory`, `/vault/collections`): Card Gallery (the default; `/vault/lore-gallery`, `/vault/ns-library`, lore source selected first), Inventory (rarity/type filters, bulk junking), Collections
  - `Marketplace` (`VaultMarketplaceSection.tsx`, `/vault/marketplace?tab=store|auctions|trading`): Vault Shop (packs + cosmetics, cinematic pack opening), Auctions, P2P Trading. `/vault/packs`, `/vault/market` and `/vault/trading` are redirect stubs into this section
  - `Import` (`VaultImportSection.tsx`, `/vault/import`): NationStates deck verification and import wizard
- Standalone routes: `/vault/crafting` (`CraftingWorkbench`, not linked from the sidebar), `/vault/lore-generator`, `/vault/ns-deck/[nation]`, `/vault/collections/[slug]`, `/vault/admin`

---

## Economy Balancing & Feature Governance

Administrators can toggle individual economic features at runtime (`VaultConfig` in `src/lib/vault/vault-perks.ts`, persisted as `vault_*` `SystemConfig` rows and edited from `/admin/vault` via `vault.adminSaveVaultConfig`):
- `isEarningEnabled`: EARN_ACTIVE / EARN_SOCIAL / EARN_PASSIVE credit awards
- `isStoreEnabled`: Cosmetic and boost purchases (`SPEND_COSMETIC`, `SPEND_BOOST`)
- `isPacksEnabled`: Card pack purchases (`SPEND_PACKS`)
- `isCraftingEnabled`: Card fusion and evolution operations
- `isTradingEnabled`: P2P card and credit trade offers
- `isAuctionsEnabled`: Marketplace listing and bidding
- `isMaintenanceMode`: Emergency master switch blocking all ledger writes
- Also tunable: `activeDailyCap` (100), `socialDailyCap` (50), `xpPerLevel` (1,000), `maxStreakBonus` (7) and `premiumMultiplier` (display-only today). Store prices are each item's `VaultStoreItem.price`, edited in the store-item editor (the old `vault_price*` keys were removed on 2026-10-05)

---

## Backend Routers (`src/server/api/routers/vault/`)

Organized into modular sub-files:
- `vault/index.ts` – Router combination
- `vault/balance-credits.ts` – Balance, level, today's earnings, user stats, transaction history, passive income & budget multiplier projections. `getBalance` also pays the one-time new-player bonus to an account that never received it (see [ixcredits.md](./ixcredits.md#4-metagame-bonuses-earn_bonus--uncapped)); new accounts are paid at sign-up, with or without a country
- `vault/daily-claims.ts` – Daily bonus / combined daily claim, daily cap checks
- `vault/store.ts` – Store listing, purchased items, cosmetic equip
- `vault/collections.ts` – Collection details, likes, comments, public collections
- `vault/admin/` (`store.ts`, `items.ts`, `users.ts`) – Configuration toggles, store catalog, credit adjustments
- Ledger logic lives in `src/lib/vault/` (`vault-ledger.ts`, `vault-passive-income.ts`, `vault-daily-bonus.ts`, `vault-bonus.ts`, `vault-service.ts`)

Related routers: `cards/`, `card-packs/`, `card-market/` (auctions & bids), `trading/`, `crafting/`, `lore-cards/`, `ns-import/`, `achievements/`.

---

## Known Gaps

- **Crafting** (`/vault/crafting`) is not reachable from the Vault nav, and the page passes card-definition IDs where `crafting.craftCard` expects `CardOwnership` IDs.
- **Card Gallery** (lore/NS library browsing) is dev-build only.
- **Premium multiplier** is shown in Settings but not applied to earnings (`getBalance` returns `isPremium: false`).

---

## Related Documentation

- [IxCredits Virtual Currency Engine](./ixcredits.md)
- [IxCards System Guide](./cards.md)
- [NationStates Integration Guide](./ns-integration.md)
- [API Reference: IxVault (Cards & Credits)](../reference/api-complete.md)
