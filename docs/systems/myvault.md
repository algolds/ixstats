# 💎 Vault — Metagame Incentives, Social Economy & Collectibles

**Last updated:** 2026-10-17

**Parent App Suite:** Vault (`IXVAULT_VERSION = 3` → `VERSIONS.apps.ixvault` in `src/lib/buildVersion.ts`, dev codename `IxVault`)  
**Subsystems:** Wallet, Achievements (`ACHIEVEMENTS_VERSION = 3`) and Lorewards, the cards hub (Mine, Sets, Market, Explore) and showcases, card packs, Atomic Credit Ledger, Store  
**Primary Action:** `COLLECT` | **Domain Accent:** Raspberry (`APP_TINTS.vault`, `[data-app="vault"]` in `src/styles/facet/tokens.css`)  
**Routes:** `/vault`, `/vault/achievements`, `/vault/cards/{mine,sets,market,explore}`, `/vault/store`, `/vault/import` (plus the redirects below) | **Status:** Release Candidate (platform 1.5.0 "Lobster Crosby") — see [Known Gaps](#known-gaps)

The Vault is the platform's collectathon hub: achievements, cards and the IxCredits store under one app, in the sidebar for every signed-in player (the `showCardsTab` setting is gone), with Lorewards shared between the Vault and WikiOS. IxCredits are **pure metagame**: they reward platform activity (wiki edits, ThinkPages and forum posts, card activity, Lorewards, achievements, the daily reward). A player's country and MyCountry play no part in the Vault economy; the one exception is the 2% nation-card royalty an auction pays the nation's owner. Design: [the 2026-10-14 spec](../specs/2026-10-14-vault-collectathon-hub-design.md).

---

## Layout & Sections

There is no client-side `VaultRouter`: `/vault` uses normal Next.js routes wrapped in a shared layout (`src/app/vault/layout.tsx`: `AuthenticationGuard` + page container). Navigation is the shell sidebar's source list (Vault entry in `src/lib/navigation/app-sections.ts`), five rows:

| Row          | Route                                          | Also matches                    |
| ------------ | ---------------------------------------------- | ------------------------------- |
| Wallet       | `/vault` (exact)                               |                                 |
| Daily reward | the daily reward dialog (action, with a badge) |                                 |
| Achievements | `/vault/achievements`                          |                                 |
| Cards        | `/vault/cards/mine`                            | `/vault/cards`, `/vault/import` |
| Store        | `/vault/store`                                 |                                 |

Redirects: `src/proxy.ts` answers every old card address with a 308 to the cards hub (`legacyCardRedirectFor`, `src/lib/cards/hub-routes.ts`), keeping the query so `?card=` opens the sheet there: the old inventory page goes to Mine, collections (and each collection's page) to Sets, the lore gallery and the lore generator to Explore (the generator with `?suggest=1`), the NationStates library and the public NS deck of a nation to Explore for NationStates, the NS deck page to Import, market and marketplace to Market, trading to Market Trades, packs to the Store's Packs, crafting to Mine, and the old public collection gallery to Sets; the Store's old auctions and trading tabs go to Market and Market Trades. `/vault/cards` opens Mine (a 307). Also the Vault's old Exchange address → `/labs/exchange` (a 308 through `movedPageRedirectFor`, `src/lib/navigation/moved-pages.ts`; [Exchange](./exchange.md) is a Labs section now) and `/achievements` → `/vault/achievements` (query kept). The full table is in [cards.md](./cards.md#the-hub).

- **Sections** (`src/components/vault/sections/`):
  - `Dashboard` (`VaultDashboardSection.tsx`, `/vault`): the Wallet page, see [below](#the-wallet-page)
  - `Import` (`VaultImportSection.tsx`, `/vault/import`): NationStates deck verification and import wizard, with its consent checkbox
  - `Lorewards` (`VaultLorewardsPanel.tsx`): the Lorewards tab of the Achievements page, a wrapper around the shared `LorewardsView` (`focus="you"`); `?trophy=<card id>` marks that trophy card (`?card=` opens the card sheet anywhere in the Vault; an older link's `?card=` still marks the trophy for one release)
  - The Store (`marketplace/VaultStoreTab.tsx`, `/vault/store`): My packs, Packs, Cosmetics and Account upgrades (`?view=my-packs|packs|cosmetics|upgrades`, Packs by default); a pack opens in the short reveal
- **Cards** (`CardsHub`, `src/components/vault/cards/`, `/vault/cards/{mine,sets,market,explore}`): Mine, Sets (showcases), Market (Browse, Trades, Wishlist, Selling) and Explore, with the card sheet (`CardSheetHost` in `src/app/vault/layout.tsx`); see [cards.md](./cards.md#the-hub)
- Achievements (`src/app/vault/achievements/`, `src/components/achievements/`) has four tabs: All, Lorewards, Showcase and Leaderboard; see [achievements.md](./achievements.md)

### The Wallet page

`/vault` is a bank statement (cards of content type `data` and `collectible`, a `FacetList`, and a `Signal`). Desktop: the balance card, the showcase, then the statement on the left two thirds and, on the right, the title over the Your Vault list with the latest unlock. Phone: title, balance, showcase (two columns), Your Vault, latest unlock, statement.

- **Title** (`dashboard/VaultTitle.tsx`): "Vault" with the Vault mark. On desktop it is the `<h1>` over the Your Vault list; on phones a phone-only `ShellPageHeader` (with `leading`) carries it. No toolbar actions; Claim daily reward (the one primary, only while claimable, through `DailyRewardProvider`) sits in the Balance card's header row.
- **Balance card** (`dashboard/VaultBalanceCard.tsx`): the IxCredits balance as a large counting figure, the collector level, "+N today" and the login streak; below it one net worth well (credits plus deck value, trophy cards included) with a credits-versus-cards split bar and the card count and value. Figures count with the `number-flow` primitive. No country.
- **Showcase** (`dashboard/VaultShowcase.tsx`): the player's display from `cards.getMyDisplay` (their pinned public showcase, else their six most valuable live copies, one per card, trophy cards included) as size M card faces that open the card sheet, plus one pack tile, "N packs waiting", linking to `/vault/store?view=my-packs` while any are unopened, and a "Find more cards" tile linking to Explore while fewer than six cards show. The header names the pinned showcase, or says "Your most valuable cards"; "All cards" links to Mine. An empty collection shows an empty state with a link to Explore.
- **Statement** (`dashboard/VaultStatement.tsx`, pure grouping and the row icon mapping in `src/lib/vault/statement.ts`): `vault.getTransactions` (offset paging; `direction: "earned" | "spent"` filter; returns each row's `metadata`), grouped by UTC day (Today, Yesterday, then dates), each row with a signed amount and the running balance from `balanceAfter`. A Vault dividend row expands to its stored breakdown; Loreward rows name the contest, place and date (and the page, for payouts made since the tiered table); achievement rows name the achievement and link to `/vault/achievements?a=<key>`. Filters All, Earned and Spent, and "Show earlier". Each row carries a tinted icon for its source (dividend, daily reward, achievement, Loreward, pack, store, market, trade, or a neutral one).
- **Your Vault** (`dashboard/VaultHoldings.tsx`): a `FacetList` of Achievements (unlocked of the active total, points, rank, a thin progress bar), Lorewards (wins and today's rank from the places tied to the player, or "Edit the wiki to take part" with no ixwiki edits), Cards (a link to the card hub) and Store (one featured item and its price).
- **Achievements deck** (`dashboard/VaultUnlocks.tsx`): a swipeable deck of the three newest unlocks (`achievements.getMySummary.recent`), each on its category aurora and, from Epic, the foil sheen, then the locked achievement the player is nearest to with its progress (`achievements.getNextUnlock`), each linking to `/vault/achievements?a=<key>`. Hidden until there is either.
- The old `VaultWalletCard`, `VaultCollectionCard`, `VaultYieldProjectionsCard`, `VaultRecentActivityCard` and `VaultShowcaseGrid` are gone.
- **Sidebar wallet card** (`src/components/shell/SidebarVaultCard.tsx`): closed it shows the balance, "+N today" and the daily reward status; a chevron opens today's earnings by source (`vault.getTodayEarnings`), achievement progress (unlocked, points, rank) and links to Cards, Store and Achievements. Open or closed is remembered with the sidebar's expanded set (id `vault-card`). It shows no dividend figure. The collapsed rail wallet is unchanged.

---

## Economy Balancing & Feature Governance

Administrators can toggle individual economic features at runtime (`VaultConfig` in `src/lib/vault/vault-perks.ts`, persisted as `vault_*` `SystemConfig` rows and edited from `/admin/vault` via `vault.adminSaveVaultConfig`):

- `isEarningEnabled`: EARN_ACTIVE / EARN_SOCIAL / EARN_PASSIVE credit awards (the Vault dividend included)
- `isStoreEnabled`: Cosmetic and boost purchases (`SPEND_COSMETIC`, `SPEND_BOOST`)
- `isPacksEnabled`: Card pack purchases (`SPEND_PACKS`)
- `isTradingEnabled`: P2P card and credit trade offers
- `isAuctionsEnabled`: Marketplace listing and bidding
- `isMaintenanceMode`: Emergency master switch blocking all ledger writes
- Crafting has no switch any more: it is retired and its router is deleted; a leftover `vault_isCraftingEnabled` row is ignored
- Also tunable: `activeDailyCap` (100), `socialDailyCap` (50; nothing pays `EARN_SOCIAL` any more), `xpPerLevel` (1,000) and `premiumMultiplier` (display-only today). The store item's `yieldBoost` effect is labelled "Dividend boost" in the admin store form and multiplies the nightly Vault dividend. Store prices are each item's `VaultStoreItem.price`, edited in the store-item editor (the old `vault_price*` keys were removed on 2026-10-05)

---

## Backend Routers (`src/server/api/routers/vault/`)

Organized into modular sub-files:

- `vault/index.ts` – Router combination
- `vault/balance-credits.ts` – Balance, level, today's earnings and user stats (`getUserStats` returns `{ totalCards, deckValue, deckValueExTrophy }`, computed live from the copies (`copyValue`, `src/lib/cards/copy-value.ts`); `deckValue` counts trophy cards and `deckValueExTrophy`, which the dividend and deck-value achievements use, does not). `getBalance` is a plain read (the old missed-day catch-up is gone). It also pays the one-time new-player bonus to an account that never received it (see [ixcredits.md](./ixcredits.md#4-metagame-bonuses-earn_bonus--uncapped)); new accounts are paid at sign-up, with or without a country
- `vault/daily-claims.ts` – The daily reward (`claimCombinedDailyClaim`)
- `vault/store.ts` – Store listing, purchased items, cosmetic equip, `getTransactions` (the statement's feed)
- `vault/public-cosmetics.ts` – `getEquippedCosmeticsFor`, another player's equipped cosmetics (public)
- `vault/admin/` (`store.ts`, `items.ts`, `users.ts`) – Configuration toggles, store catalog, credit adjustments
- Ledger logic lives in `src/lib/vault/` (`vault-ledger.ts`, `vault-daily-bonus.ts`, `vault-bonus.ts`, `vault-service.ts`, `statement.ts`). The Vault dividend is `src/lib/vault/vault-dividend.ts` (pure maths) and `src/server/modules/vault/vault-dividend-settle.ts` (loads the inputs, writes the rows), run by the `vault-dividend` cron job; see [ixcredits.md](./ixcredits.md#1-the-vault-dividend-earn_passive--no-daily-cap)

### Public equipped cosmetics

`vault.getEquippedCosmeticsFor({ userIds? })` (rate-limited public query, at most 50 ids)
returns, per user with something equipped, the equipped cosmetic ids and the resolved `avatarGlow`, `chatBadge` and
`neonFrame`; never the balance, purchases or inventory. `userIds` take the internal `User.id` or the Clerk id (the
lookup by XenForo id went with the forum bridge in ThinkPages forum phase 4b). Resolution (`src/lib/vault/public-cosmetics.ts`) matches the owner's own
`useActiveCosmetics`: the catalog in `src/lib/media/cosmetics.ts` first, the item's `effects.customizations` second,
active `cosmetics` items only. Two queries answer a whole page. Client hook: `useUserCosmetics` (passport). Equipping is the opt-in; there is no
separate visibility setting.

### Retired store items

`src/lib/vault/retired-store-items.ts` lists store items withdrawn from sale. Today that is the **Archetype Proposal
Token** (`upgrade_archetype_proposal`, retired 2026-10-05): it promised an archetype proposal for admin review, but no
proposal model, form or admin queue exists for archetypes (`LoreCardRequest` is for wiki-article lore cards and does
not fit), so buying it did nothing. A retired item is left out of `vault.listStoreItems`, `purchaseStoreItem` refuses it
(`PRECONDITION_FAILED`) even if an admin reactivates the row, the seed keeps its row inactive (ledger rows still name
it), and the exploit audit charges no shortfall on it. `bun run db:refund-retired-store-items -- --apply`
(`scripts/migrations/refund-retired-store-items.ts`, dry run by default) refunds each purchase once, at what was paid
net of exploit corrections, as a `REFUND` row keyed `retired_item_refund:<purchase id>`.

Related routers: `cards/`, `card-packs/`, `card-market/` (auctions & bids), `trading/`, `lore-cards/`, `ns-import/`, `achievements/`, `lorewards/`.

---

## Known Gaps

- **Crafting** was removed on 2026-10-15 (cards refresh Phase 1): the router, rules, seed and tables are gone.
- **Premium multiplier** is shown in Settings but not applied to earnings (`getBalance` returns `isPremium: false`).

---

## Related Documentation

- [IxCredits Virtual Currency Engine](./ixcredits.md)
- [IxCards System Guide](./cards.md)
- [NationStates Integration Guide](./ns-integration.md)
- [API Reference: IxVault (Cards & Credits)](../reference/api-complete.md)
