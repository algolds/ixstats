# IxVault — Trading Cards, Marketplace & IxCredits

**Last updated:** September 2026

IxVault is the trading-card and virtual-economy product in IxStats. Players earn **IxCredits (IxC)** through gameplay, buy and open card packs, craft and trade cards, run marketplace auctions, organize collections, and import their NationStates card decks. The `/vault` area is a page container (`AuthenticationGuard` → container) wrapping per-route section components — there is no client-side `*Router` here; navigation uses normal Next.js routes.

## Routes

| Route | Renders | Purpose |
|-------|---------|---------|
| `/vault` | `VaultDashboardSection` | Balance, level/XP, daily claim, passive income, today's earnings, quick stats |
| `/vault/cards` | `VaultCardsSection` | Card hub: Gallery (default, lore-first) / Inventory / Collections sub-tabs |
| `/vault/inventory` | `VaultCardsSection` | Same hub (inventory entry) |
| `/vault/collections` | `VaultCardsSection` | Same hub (collections entry) |
| `/vault/collections/[slug]` | collection detail | View a collection; comments / likes |
| `/vault/lore-gallery` | `VaultCardsSection` | Gallery sub-tab |
| `/vault/ns-library` | `VaultCardsSection` | Gallery sub-tab |
| `/vault/lore-generator` | `LoreCardGenerator` | Request generation of a lore card |
| `/vault/marketplace` | `VaultMarketplaceSection` | Tabs: Vault Shop / Auctions / Trading (`?tab=` deep-links) |
| `/vault/crafting` | `CraftingWorkbench` | Fusion / evolution crafting (not linked from the sidebar) |
| `/vault/import` | `VaultImportSection` | NationStates deck import wizard |
| `/vault/ns-deck` | `ImportWizard` | Legacy NS deck import wizard (the sidebar uses `/vault/import`) |
| `/vault/ns-deck/[nation]` | NS deck viewer | Public NS deck for a nation |
| `/vault/admin` | admin gate | Admin-only vault tools (`useIsAdmin`) |
| `/vault/market`, `/vault/packs`, `/vault/trading` | — | **Redirect stubs** → `/vault/marketplace?tab=auctions\|store\|trading` |

There is no Vault rail: the global source list (`src/lib/navigation/app-sections.ts`) lists the sections. `/achievements` and `/leaderboards` render in their own page container. The daily reward, balance, today's earnings and treasury revenue live in the wallet card on the dashboard (`VaultWalletCard`).

## Key Features

- **Card packs** — Browse/purchase packs (`cardPacks.getAvailablePacks`, `purchasePack`), open via the cards pipeline. Pack types and odds are documented in `docs/systems/cards.md`.
- **Marketplace** — Three tabs in one section: **Vault Shop** (`vault.listStoreItems` / `getPurchasedItems`), **Auctions** (`cardMarket.*` — active/ending-soon/my-bids/my-auctions, `createAuction`), and **Trading** (`trading.getActiveTrades` / `getTradeHistory`).
- **Collections** — Create/delete and organize cards (`cards.getMyCollections`, `createCollection`, `deleteCollection`, `getCollectionCards`); collection pages support comments and likes (`vault.getCollectionComments`, `addCollectionComment`, `likeCollection`).
- **Crafting** — Fusion and evolution recipes (`crafting.getRecipes`, `getRecipeById`, `craftCard`) consuming owned cards; cost tables in `docs/systems/ixcredits.md`. Known issue: the page maps card-definition IDs into `CraftingWorkbench`, while `craftCard` expects `CardOwnership` IDs.
- **Card junking** — Recycle unlocked cards for IxC (`cards.junkCards`); cards escrow-locked by an auction or trade are refused.
- **NationStates import** — Verify ownership and import an NS deck (`nsImport.requestVerification`, `checkVerification`, `importDeck`, `hasImported`, `fetchPublicDeck`); see `docs/systems/ns-integration.md`.
- **IxCredits** — Earn (passive nation dividend, active gameplay, social, uncapped metagame bonuses) and spend (packs, crafting, market, store). Caps, formulas, and transaction types in `docs/systems/ixcredits.md`.

## Architecture

| Layer | Location |
|-------|----------|
| Layout + auth | `src/app/vault/layout.tsx` (`AuthenticationGuard` + page container) |
| Sidebar nav | `src/components/vault/VaultSidebarNav.tsx` (`VaultSection`, `VAULT_NAV_ITEMS`, `getSectionFromPathname`) |
| Cards Section | `src/components/vault/sections/cards/` — `InventoryTab`, `CollectionsTab`, `CardGalleryTab`, `*SidebarContent`, `useVaultCardsState`, `types.ts` |
| Dashboard Section | `src/components/vault/sections/dashboard/` — `VaultNetWorthCard`, `VaultYieldProjectionsCard`, `VaultCardHoldingsCard`, `VaultMilestonesCard`, `VaultRecentActivityCard`, `VaultShowcaseGrid` |
| Marketplace Section | `src/components/vault/sections/marketplace/` — Store (`store/`), Auctions (`auctions/` incl. `CreateAuctionModal`), Trading |
| Import Section | `src/components/vault/sections/import/` — `ImportNationStep`, `ImportVerifyStep`, `ImportConfirmStep`, `ImportStepIndicator` |
| Shared widgets | `src/components/vault/` — `DailyRewardProvider`, `VaultParticleExplosionModal`, `VaultSubTabNav`, `IxCreditsSymbol`, cosmetic overlays (`AvatarGlow`, `NeonFrameOverlay`, `CosmeticParticles*`) |
| Vault Services | `src/lib/vault/` — `vault-service.ts` (facade), `vault-ledger.ts`, `vault-passive-income.ts`, `vault-daily-bonus.ts`, `vault-bonus.ts`, `vault-perks.ts`, `vault-notifications.ts`, `vault-type-guards.ts`, `exchange-*.ts`, `trade-settlement.ts` |
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
| `nsImport` | `requestVerification`, `checkVerification`, `hasImported`, `importDeck`, `fetchPublicDeck` |
| `loreCards` | `getAllLoreCards`, `requestLoreCard` |
| `achievements` | `getAllByCountry`, `getLeaderboard` |
| `users` | `getProfile` |

All registered in `src/server/api/root.ts`.

## Connections

- **ThinkPages / Diplomacy** — feed `EARN_ACTIVE` / `EARN_SOCIAL` credits through `vault-service`; **Achievements / Lorewards / onboarding / NS import** pay uncapped `EARN_BONUS` via `grantBonus()`; nation performance drives passive income and NATION card values (`card-values` cron).

## Architecture & Security Hardening (Plans 121–123)

- **Atomic Credit Ledger**: `spendCredits` executes atomic conditional updates (`credits: { gte: amount }`) inside DB transactions, preventing race conditions or negative balances under high concurrency.
- **UTC Calendar Day Streak Math**: Daily login streak calculations (`updateLoginStreak`) normalize dates onto UTC calendar day serial numbers (`Date.UTC(y, m, d) / 86,400,000`), ensuring exact midnight boundary rollover behavior.
- **Type-Safe Domain Modeling**: Branded domain primitives (`UserId`, `CardId`, `AuctionId`, `OwnershipId`) and structured schema interfaces (`ArtworkVariants`, `CardStatsData`, `CardEnhancementsData`) live in `src/types/cards-display.ts` (some `(db as any)` casts remain in routers).
- **Perk Performance Cache**: Store item perks lookup (`getPurchasedItemsEffects`) utilizes an in-memory `userPerksCache` (5-minute TTL) with bounded transaction queries (`take: 100`).

---

### Notes on corrections (vs. prior README)

The previous README described an architecture that no longer matches the code and was corrected:

- **No `VaultRouter`, `VaultDashboard`, `VaultHeader`, `VaultNavigation`, or `QuickActions` components** exist — replaced by a `layout.tsx` + `VaultSidebarNav` + per-route section components.
- Documented routes (`/vault/packs`, `/vault/market`) are now **redirect stubs** into `/vault/marketplace`; real routes include `crafting`, `import`, `ns-deck`, `lore-gallery`/`lore-generator`, `ns-library`, `admin`.
- Marketplace is a single tabbed section (Shop/Auctions/Trading), not separate "Agent 1/2/3" components.
- Auction/market endpoints live on `cardMarket` (not `market`); packs on `cardPacks`; NS on `nsImport`; crafting on `crafting`; trading on `trading` — the prior "API endpoints needed" wishlist is now live.
- Dropped the stale "Agent 1/2/3", TODO, and testing-checklist sections.
