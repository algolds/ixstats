# IxVault — Collectathon Hub: Wallet, Achievements, Cards & Store

**Last updated:** 2026-10-14

IxVault is the collectathon hub in IxStats: achievements, trading cards and the IxCredits store under one app, in the sidebar for every signed-in player. Players earn **IxCredits (IxC)** from platform activity (the daily claim, achievements, Lorewards, the nightly Vault dividend, card sales; never from a nation's performance or diplomacy), buy and open card packs, trade cards, run auctions, organize collections, and import their NationStates card decks. The `/vault` area is a page container (`AuthenticationGuard` → container) wrapping per-route section components — there is no client-side `*Router` here; navigation uses normal Next.js routes.

## Routes

| Route                                             | Renders                   | Purpose                                                                                                 |
| ------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/vault`                                          | `VaultDashboardSection`   | The Wallet: balance card, showcase, the statement, Your Vault list and the latest unlock                |
| `/vault/cards`                                    | `VaultCardsSection`       | Card hub: Gallery (default, lore-first) / Inventory / Collections sub-tabs                              |
| `/vault/inventory`                                | `VaultCardsSection`       | Same hub (inventory entry)                                                                              |
| `/vault/collections`                              | `VaultCardsSection`       | Same hub (collections entry)                                                                            |
| `/vault/collections/[slug]`                       | collection detail         | View a collection; comments / likes                                                                     |
| `/vault/lore-gallery`                             | `VaultCardsSection`       | Gallery sub-tab                                                                                         |
| `/vault/ns-library`                               | `VaultCardsSection`       | Gallery sub-tab                                                                                         |
| `/vault/lore-generator`                           | `LoreCardGenerator`       | Request generation of a lore card                                                                       |
| `/vault/store`                                    | `VaultMarketplaceSection` | Tabs: Vault Shop / Auctions / Trading (`?tab=` deep-links; `?view=my-packs` opens the shop on My packs) |
| `/vault/achievements`                             | Achievements page         | Standing card and four tabs: All / Lorewards / Showcase / Leaderboard (`?tab=`, `?a=<key>`)             |
| `/achievements`                                   | —                         | **Redirect** → `/vault/achievements`, keeping the query                                                 |
| `/vault/crafting`                                 | `EmptyState`              | "Crafting is retired for now" notice (crafting deprecated 2026-10-05)                                   |
| `/vault/exchange`                                 | —                         | **Redirect** → `/labs/exchange` (the Exchange is a Labs section, behind the Labs gate)                  |
| `/vault/import`                                   | `VaultImportSection`      | NationStates deck import wizard                                                                         |
| `/vault/ns-deck`                                  | `ImportWizard`            | Legacy NS deck import wizard (the source list uses `/vault/import`)                                     |
| `/vault/ns-deck/[nation]`                         | NS deck viewer            | Public NS deck for a nation                                                                             |
| `/vault/admin`                                    | admin gate                | Admin-only vault tools (`useIsAdmin`)                                                                   |
| `/vault/marketplace`                              | —                         | **Redirect stub** → `/vault/store`, keeping the query                                                   |
| `/vault/market`, `/vault/packs`, `/vault/trading` | —                         | **Redirect stubs** → `/vault/store?tab=auctions\|store\|trading`                                        |

There is no Vault rail: the global source list (`src/lib/navigation/app-sections.ts`) lists the sections. `/leaderboards` (the nation boards) renders in its own page container. The Wallet page (`/vault`) is a bank statement with some life in it: the page is titled "Vault" with the Vault mark (`VaultMarkTile`: `VaultLogomark` in a large tinted `IconWell`, decorative; the sidebar row stays "Wallet"): on desktop as the `<h1>` over the Your Vault list in the right column (`VaultTitle`, marked `shellPageTitleProps`), on phones as a phone-only `ShellPageHeader` with the mark as its `leading`, so one "Vault" shows at every width and no toolbar actions remain; the balance card (`VaultBalanceCard`: a counting IxCredits figure, collector level, the Claim daily reward button while claimable (the one primary), "+N today", streak, and one net worth well splitting credits from cards), the showcase (`VaultShowcase`: your top three cards by market value from `cards.getMyTopCards` on their real art, plus one pack card while packs wait), the statement (`VaultStatement`, a source icon on each row), the Your Vault list (`VaultHoldings`: Achievements, Lorewards, Cards and Store, each a row linking to its home), the latest unlock (`VaultLatestUnlock`, from `achievements.getMySummary.latest`, hidden until there is one). On a phone the order is title, balance, showcase, Your Vault, latest unlock, statement. It reads no country data. The sidebar footer carries a compact copy of the balance, today's earnings and the daily reward control (`SidebarVaultCard`, with a wallet button on the collapsed rail); both show for every signed-in player.

## Key Features

- **Card packs** — Browse/purchase packs (`cardPacks.getAvailablePacks`, `purchasePack`), open via the cards pipeline. Pack types and odds are documented in `docs/systems/cards.md`.
- **Marketplace** — Three tabs in one section: **Vault Shop** (`vault.listStoreItems` / `getPurchasedItems`), **Auctions** (`cardMarket.*` — active/ending-soon/my-bids/my-auctions, `createAuction`), and **Trading** (`trading.getActiveTrades` / `getTradeHistory`).
- **Collections** — Create/delete and organize cards (`cards.getMyCollections`, `createCollection`, `deleteCollection`, `getCollectionCards`); collection pages support comments and likes (`vault.getCollectionComments`, `addCollectionComment`, `likeCollection`).
- **Crafting** — Retired for now (2026-10-05): every `crafting.*` procedure refuses and the workbench is gone; see `docs/systems/cards.md`.
- **Card junking** — Recycle unlocked cards for IxC (`cards.junkCards`); cards escrow-locked by an auction or trade are refused.
- **NationStates import** — Verify ownership and import an NS deck (`nsImport.requestVerification`, `checkVerification`, `importDeck`, `fetchPublicDeck`); see `docs/systems/ns-integration.md`.
- **Achievements and Lorewards** — `/vault/achievements` (see `docs/systems/achievements.md`); the Lorewards tab wraps the shared `LorewardsView` (`VaultLorewardsPanel`).
- **The Exchange (₷)** — lives in Labs at `/labs/exchange`, apart from the Vault; there is no IxC ⇄ ₷ conversion. See `docs/systems/exchange.md`.
- **IxCredits** — Earn (the daily claim, achievement unlocks, Lorewards payouts, NS deck import, card sales and the nightly Vault dividend; no country action pays) and spend (packs, market, store). Caps, formulas, and transaction types in `docs/systems/ixcredits.md`.

## Architecture

| Layer               | Location                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout + auth       | `src/app/vault/layout.tsx` (`AuthenticationGuard` + page container; no rail)                                                                                                                                                                                                                                                                       |
| Navigation          | The sidebar's source list (the Vault entry in `src/lib/navigation/app-sections.ts`: sections, Daily reward row opening `DailyRewardProvider`'s dialog). `src/components/vault/vault-sections.ts` only exports `getSubTabFromPathname`                                                                                                              |
| Cards Section       | `src/components/vault/sections/cards/` — `InventoryTab`, `CollectionsTab`, `CardGalleryTab`, `*SidebarContent`, `useVaultCardsState`, `types.ts`                                                                                                                                                                                                   |
| Dashboard Section   | `src/components/vault/sections/dashboard/` — `VaultTitle` (page title and mark), `VaultBalanceCard` (the one home of the balance), `VaultShowcase`, `VaultStatement`, `VaultHoldings`, `VaultLatestUnlock`, `IconWell`, `credits.tsx` (credit figures)                                                                                             |
| Marketplace Section | `src/components/vault/sections/marketplace/` — Store (`store/`), Auctions (`auctions/` incl. `CreateAuctionModal`), Trading                                                                                                                                                                                                                        |
| Import Section      | `src/components/vault/sections/import/` — `ImportNationStep`, `ImportVerifyStep`, `ImportConfirmStep`, `ImportStepIndicator`                                                                                                                                                                                                                       |
| Shared widgets      | `src/components/vault/` — `DailyRewardProvider`, `VaultParticleExplosionModal`, `VaultSubTabNav`, `IxCreditsSymbol`, cosmetic overlays (`AvatarGlow`, `NeonFrameOverlay`, `CosmeticParticles*`)                                                                                                                                                    |
| Vault Services      | `src/lib/vault/` — `vault-service.ts` (facade), `vault-ledger.ts`, `vault-dividend.ts` (dividend maths; the settle job is `src/server/modules/vault/vault-dividend-settle.ts`), `statement.ts`, `vault-daily-bonus.ts`, `vault-bonus.ts`, `vault-perks.ts`, `vault-notifications.ts`, `store-purchases.ts`, `exchange-*.ts`, `trade-settlement.ts` |
| Hooks               | `src/hooks/vault/` — `useVaultBalance`, `useVaultStats`, `useCollections`                                                                                                                                                                                                                                                                          |
| Reused card UI      | `src/components/cards/` — `CardDisplay`, `CardDetailsModal` (`cards/display/modal/`), `lore/LoreCardGenerator`                                                                                                                                                                                                                                     |

`VaultCardsSection` dispatches between modular sub-components in `src/components/vault/sections/cards/`, supporting **Inventory / Collections / Gallery** sub-tabs. Monolithic services in `vault-service.ts` are decoupled into single-responsibility domain modules under `src/lib/vault/`.

## Data Sources (verified `api.*`)

| Router         | Endpoints used                                                                                                                                                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vault`        | `getBalance`, `getVaultLevel`, `getTodayEarnings`, `getUserStats`, `getTransactions`, `claimCombinedDailyClaim`, `listStoreItems`, `getPurchasedItems`, `purchaseStoreItem`, `getMyCollections`, `createCollection`, `updateCollection`, `deleteCollection`, `getCollectionDetails`, `getCollectionComments`, `addCollectionComment`, `likeCollection` |
| `cards`        | `getMyCards`, `getMyCollections`, `getCollectionCards`, `createCollection`, `deleteCollection`, `getNSCards`, `getNSLibraryStats`, `junkCards`                                                                                                                                                                                                         |
| `cardPacks`    | `getAvailablePacks`, `getMyPacks`, `purchasePack`                                                                                                                                                                                                                                                                                                      |
| `cardMarket`   | `getActiveAuctions`, `getEndingSoon`, `getMyActiveAuctions`, `getMyActiveBids`, `getMyAuctionParticipation`, `createAuction`                                                                                                                                                                                                                           |
| `trading`      | `getActiveTrades`, `getTradeHistory`                                                                                                                                                                                                                                                                                                                   |
| `nsImport`     | `requestVerification`, `checkVerification`, `importDeck`, `fetchPublicDeck`                                                                                                                                                                                                                                                                            |
| `loreCards`    | `getAllLoreCards`, `requestLoreCard`                                                                                                                                                                                                                                                                                                                   |
| `achievements` | `getAllWithStatus`, `getMySummary`, `syncMyCollectorAchievements`, `getPlayerLeaderboard`                                                                                                                                                                                                                                                              |
| `lorewards`    | `getMyTrophies`, `getTodayRace`, `getStandings`, `getTrophies`                                                                                                                                                                                                                                                                                         |
| `ixnayid`      | `listWikiLinks` (the wiki-link prompt)                                                                                                                                                                                                                                                                                                                 |
| `users`        | `getProfile`                                                                                                                                                                                                                                                                                                                                           |

All registered in `src/server/api/root.ts`.

## Connections

- **Platform activity** — the nightly Vault dividend (`vault-dividend` cron) pays `EARN_PASSIVE` from collection interest, wiki edits (through a verified IxWiki link), ThinkPages and forum posts, and card activity; **Achievements / Lorewards / onboarding / NS import** pay uncapped `EARN_BONUS` via `grantBonus()`; the daily claim pays `EARN_ACTIVE`. Nothing a nation does earns IxCredits; the one country tie is the 2% nation-card royalty on an auction sale. NATION card values come from rarity and type (`card-values` cron).

## Architecture & Security Hardening (Plans 121–123)

- **Atomic Credit Ledger**: `spendCredits` executes atomic conditional updates (`credits: { gte: amount }`) inside DB transactions, preventing race conditions or negative balances under high concurrency.
- **UTC Calendar Day Streak Math**: Daily login streak calculations (`updateLoginStreak`) normalize dates onto UTC calendar day serial numbers (`Date.UTC(y, m, d) / 86,400,000`), ensuring exact midnight boundary rollover behavior.
- **Type-Safe Domain Modeling**: Branded domain primitives (`UserId`, `CardId`, `AuctionId`, `OwnershipId`) and structured schema interfaces (`ArtworkVariants`, `CardStatsData`, `CardEnhancementsData`) live in `src/types/cards-display.ts` (some `(db as any)` casts remain in routers).
- **Perk Performance Cache**: Store item perks lookup (`getPurchasedItemsEffects`) utilizes an in-memory `userPerksCache` (5-minute TTL) with bounded transaction queries (`take: 100`).

---

### Notes on corrections (vs. prior README)

The previous README described an architecture that no longer matches the code and was corrected:

- **No `VaultRouter`, `VaultDashboard`, `VaultHeader`, `VaultNavigation`, or `QuickActions` components** exist: navigation is the shell sidebar, and the pages are a `layout.tsx` plus per-route section components.
- Documented routes (`/vault/packs`, `/vault/market`) are now **redirect stubs** into `/vault/store`; real routes include `crafting`, `import`, `ns-deck`, `lore-gallery`/`lore-generator`, `ns-library`, `admin`.
- Marketplace is a single tabbed section (Shop/Auctions/Trading), not separate "Agent 1/2/3" components.
- Auction/market endpoints live on `cardMarket` (not `market`); packs on `cardPacks`; NS on `nsImport`; crafting on `crafting`; trading on `trading` — the prior "API endpoints needed" wishlist is now live.
- Dropped the stale "Agent 1/2/3", TODO, and testing-checklist sections.
