# 💎 Vault — Metagame Incentives, Social Economy & Collectibles

**Parent App Suite:** Vault (`VAULT_VERSION = 2`, dev codename `IxVault`)  
**Subsystems:** Metagame Progression, 3D Cards & Showcase, Booster Pack Gacha, Atomic Credit Ledger, Marketplace & Trading, Achievements (`ACHIEVEMENTS_VERSION = 2`)  
**Primary Action:** `COLLECT` | **Domain Accent:** Burnished Copper (`#D97706` / `--color-amber-600`)  
**Routes:** `/vault`, `/vault/packs`, `/vault/market`, `/achievements` | **Status:** 📀 Gold Master (100% Ready)  

Vault is the central incentive, social currency, and metagame reward platform for IxStates. It rewards active governance, wiki authorship, and community collaboration with daily gross dividends, holographic collectible card packs, atomic ledger transactions, peer marketplace trading, and trophy progression racks.

---

## Router Architecture (`VaultRouter.tsx`)

The vault UI uses a single-page router with a sidebar layout for instant navigation:
- `src/components/vault/VaultRouter.tsx` – Master client router
- `src/components/vault/VaultSidebarNav.tsx` – Section navigation
- `src/components/vault/VaultSidebarLayout.tsx` – Grid layout
- **Sections** (`src/components/vault/sections/`):
  - `Dashboard` (`VaultDashboardSection.tsx`): Balance overview, today's earnings breakdown, XP progress bar, quick actions
  - `Cards` (`VaultCardsSection.tsx`): Owned card grid, filter by rarity/type, lock/unlock toggle, junking interface
  - `Acquire` (`VaultAcquireSection.tsx`): Pack store, purchase triggers, cinematic opening sequence
  - `Create` (`VaultCreateSection.tsx`): Crafting and fusion station
  - `Import` (`VaultImportSection.tsx`): NationStates deck verification and sync wizard

---

## Economy Balancing & Feature Governance

Administrators can toggle individual economic features at runtime via `VaultConfig`:
- `isStoreEnabled`: Pack store and cosmetic purchases
- `isCraftingEnabled`: Card fusion and evolution operations
- `isTradingEnabled`: P2P card and credit trade offers
- `isAuctionsEnabled`: Marketplace listing and bidding
- `maintenanceMode`: Emergency master switch blocking all writes

---

## Backend Routers (`src/server/api/routers/vault/`)

Organized into modular sub-files:
- `vault/index.ts` – Router combination
- `vault/core.ts` – Balance queries, transaction history, earnings summaries
- `vault/dividends.ts` – Passive income calculations and projections
- `vault/admin.ts` – Configuration toggles and administrative adjustments

---

## Related Documentation

- [IxCredits Virtual Currency Engine](./ixcredits.md)
- [IxCards System Guide](./cards.md)
- [NationStates Integration Guide](./ns-integration.md)
- [API Reference: Vault Router](../reference/api-complete.md#vault-router)
