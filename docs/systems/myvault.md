# MyVault System

**Last updated:** August 2026  
**Status:** Production Ready (Beta) — IxVault v2  
**Hierarchy:** Top-level App **IxVault** (`IXVAULT_VERSION = 2`), encompassing MyVault, IxCards, IxCredits, crafting, trading, and marketplace.

MyVault is the central economy hub where players earn, manage, and spend IxCredits (IxC) and manage their trading card collections.

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
