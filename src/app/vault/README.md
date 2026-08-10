# IxVault — Trading Cards, Marketplace & IxCredits

**Last updated:** June 2026

IxVault is the trading-card and virtual-economy product in IxStats. Players earn **IxCredits (IxC)** through gameplay, buy and open card packs, craft and trade cards, run marketplace auctions, organize collections, and import their NationStates card decks. The `/vault` area is a shared sidebar layout (`AuthenticationGuard` → `VaultSidebarLayout`) wrapping per-route section components — there is no client-side `*Router` here; navigation uses normal Next.js routes.

## Routes

| Route | Renders | Purpose |
|-------|---------|---------|
| `/vault` | `VaultDashboardSection` | Balance, level/XP, daily claim, passive income, today's earnings, quick stats |
| `/vault/cards` | `VaultCardsSection` | Card hub: Inventory / Collections / Gallery sub-tabs |
| `/vault/inventory` | `VaultCardsSection` | Same hub (inventory entry) |
| `/vault/collections` | `VaultCardsSection` | Same hub (collections entry) |
| `/vault/collections/[slug]` | collection detail | View a collection; comments / likes |
| `/vault/lore-gallery` | `VaultCardsSection` | Gallery filtered to lore cards |
| `/vault/ns-library` | `VaultCardsSection` | Gallery filtered to NS-import cards |
| `/vault/lore-generator` | `LoreCardGenerator` | Request generation of a lore card |
| `/vault/marketplace` | `VaultMarketplaceSection` | Tabs: Vault Shop / Auctions / Trading (`?tab=` deep-links) |
| `/vault/crafting` | `CraftingWorkbench` | Fusion / evolution crafting |
| `/vault/import` | `VaultImportSection` | NationStates deck import wizard |
| `/vault/ns-deck` | NS deck browser | Browse NS decks |
| `/vault/ns-deck/[nation]` | NS deck viewer | Public NS deck for a nation |
| `/vault/admin` | admin gate | Admin-only vault tools (`useIsAdmin`) |
| `/vault/market`, `/vault/packs`, `/vault/trading` | — | **Redirect stubs** → `/vault/marketplace?tab=auctions\|store\|trading` |

The sidebar (`VaultSidebarNav`) exposes 5 sections: **dashboard, cards, marketplace, import, achievements**.

## Key Features

- **Card packs** — Browse/purchase packs (`cardPacks.getAvailablePacks`, `purchasePack`), open via the cards pipeline. Pack types and odds are documented in `docs/systems/cards.md`.
- **Marketplace** — Three tabs in one section: **Vault Shop** (`vault.listStoreItems` / `getPurchasedItems`), **Auctions** (`cardMarket.*` — active/ending-soon/my-bids/my-auctions, `createAuction`), and **Trading** (`trading.getActiveTrades` / `getTradeHistory`).
- **Collections** — Create/delete and organize cards (`cards.getMyCollections`, `createCollection`, `deleteCollection`, `getCollectionCards`); collection pages support comments and likes (`vault.getCollectionComments`, `addCollectionComment`, `likeCollection`).
- **Crafting** — Fusion and evolution recipes (`crafting.getRecipes`) consuming owned cards; cost tables in `docs/systems/ixcredits.md`.
- **Card junking** — Recycle unlocked duplicates for IxC (`cards.junkCards`).
- **NationStates import** — Verify ownership and import an NS deck (`nsImport.requestVerification`, `checkVerification`, `previewDeck`, `importDeck`, `hasImported`, `fetchPublicDeck`); see `docs/systems/ns-integration.md`.
- **IxCredits** — Earn (passive nation dividend, active gameplay, social, cards) and spend (packs, crafting, market, store). Caps, formulas, and transaction types in `docs/systems/ixcredits.md`.

## Architecture

| Layer | Location |
|-------|----------|
| Layout + auth | `src/app/vault/layout.tsx` (`AuthenticationGuard` + `VaultSidebarLayout`) |
| Sidebar nav | `src/components/vault/VaultSidebarNav.tsx` (`VaultSection`, `VAULT_NAV_ITEMS`, `getSectionFromPathname`) |
| Cards Section | `src/components/vault/sections/cards/` — `CardGrid`, `CardFilterBar`, `DeckStatsHeader`, `CardSortControl`, `DeckViewToggle` |
| Dashboard Section | `src/components/vault/sections/dashboard/` — Modular balance hero, earnings breakdown, and quick stats widgets |
| Marketplace Section | `src/components/vault/sections/marketplace/` — Store (`store/`), Auctions (`auctions/` incl. `CreateAuctionModal`), Trading |
| Import Section | `src/components/vault/sections/import/` — NationStates deck import wizard steps and verification status |
| Shared widgets & theme | `src/components/vault/` — `DailyBonusWidget`, `VaultParticleExplosionModal`, `VaultSubTabNav`, `vault-theme.ts` |
| Vault Services | `src/lib/vault/` — `vault-crud.ts`, `vault-market.ts`, `vault-pricing.ts`, `vault-type-guards.ts` |
| Hooks | `src/hooks/vault/` — `useVaultBalance`, `useVaultStats`, `useCollections`, `useRecentActivity` |
| Reused card UI | `src/components/cards/` — `CardDisplay`, `CardDetailsModal` (`cards/display/modal/`), `CraftingWorkbench`, `lore/LoreCardGenerator` |

`VaultCardsSection` dispatches between modular sub-components in `src/components/vault/sections/cards/`, supporting **Inventory / Collections / Gallery** sub-tabs. Monolithic services in `vault-service.ts` are decoupled into single-responsibility domain modules under `src/lib/vault/`.

## Data Sources (verified `api.*`)

| Router | Endpoints used |
|--------|----------------|
| `vault` | `getBalance`, `getVaultLevel`, `getTodayEarnings`, `getUserStats`, `getTransactions`, `checkDailyCap`, `calculatePassiveIncome`, `getBudgetMultiplier`, `claimDailyBonus`, `claimCombinedDailyClaim`, `spendCredits`, `listStoreItems`, `getPurchasedItems`, `getCollectionDetails`, `getCollectionComments`, `addCollectionComment`, `likeCollection` |
| `cards` | `getMyCards`, `getMyCollections`, `getCollectionCards`, `createCollection`, `deleteCollection`, `getNSCards`, `getNSLibraryStats`, `junkCards` |
| `cardPacks` | `getAvailablePacks`, `getMyPacks`, `purchasePack` |
| `cardMarket` | `getActiveAuctions`, `getEndingSoon`, `getMyActiveAuctions`, `getMyActiveBids`, `getMyAuctionParticipation`, `createAuction` |
| `crafting` | `getRecipes` |
| `trading` | `getActiveTrades`, `getTradeHistory` |
| `nsImport` | `requestVerification`, `checkVerification`, `hasImported`, `previewDeck`, `importDeck`, `fetchPublicDeck`, `getImportStats` |
| `loreCards` | `getAllLoreCards`, `requestLoreCard` |
| `achievements` | `getAllByCountry`, `getLeaderboard` |
| `users` | `getProfile` |

All registered in `src/server/api/root.ts`.

## Connections

- **Achievements / ThinkPages / Diplomacy** — feed `EARN_ACTIVE` / `EARN_SOCIAL` credits through `vault-service`; nation performance drives passive income and NATION card stats.

## Architecture & Security Hardening (Plans 121–123)

- **Atomic Credit Ledger**: `spendCredits` executes atomic conditional updates (`credits: { gte: amount }`) inside DB transactions, preventing race conditions or negative balances under high concurrency.
- **UTC Calendar Day Streak Math**: Daily login streak calculations (`updateLoginStreak`) normalize dates onto UTC calendar day serial numbers (`Date.UTC(y, m, d) / 86,400,000`), ensuring exact midnight boundary rollover behavior.
- **Type-Safe Domain Modeling**: Branded domain primitives (`UserId`, `CardId`, `AuctionId`, `OwnershipId`) and structured schema interfaces (`ArtworkVariants`, `CardStatsData`, `CardEnhancementsData`) replace loose `any` types and Prisma `(db as any)` casts across `vault-service.ts`, `card-service.ts`, and `auction-service.ts`.
- **Perk Performance Cache**: Store item perks lookup (`getPurchasedItemsEffects`) utilizes an in-memory `userPerksCache` (5-minute TTL) with bounded transaction queries (`take: 100`).

---

### Notes on corrections (vs. prior README)

The previous README described an architecture that no longer matches the code and was corrected:

- **No `VaultRouter`, `VaultDashboard`, `VaultHeader`, `VaultNavigation`, or `QuickActions` components** exist — replaced by a `layout.tsx` + `VaultSidebarNav` + per-route section components.
- Documented routes (`/vault/packs`, `/vault/market`) are now **redirect stubs** into `/vault/marketplace`; real routes include `crafting`, `import`, `ns-deck`, `lore-gallery`/`lore-generator`, `ns-library`, `admin`.
- Marketplace is a single tabbed section (Shop/Auctions/Trading), not separate "Agent 1/2/3" components.
- Auction/market endpoints live on `cardMarket` (not `market`); packs on `cardPacks`; NS on `nsImport`; crafting on `crafting`; trading on `trading` — the prior "API endpoints needed" wishlist is now live.
- Dropped the stale "Agent 1/2/3", TODO, and testing-checklist sections.
