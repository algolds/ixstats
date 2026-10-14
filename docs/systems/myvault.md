# 💎 Vault — Metagame Incentives, Social Economy & Collectibles

**Last updated:** 2026-10-14

**Parent App Suite:** Vault (`IXVAULT_VERSION = 3` → `VERSIONS.apps.ixvault` in `src/lib/buildVersion.ts`, dev codename `IxVault`)  
**Subsystems:** Wallet, Achievements (`ACHIEVEMENTS_VERSION = 3`) and Lorewards, 3D Cards & Showcase, Booster Pack Gacha, Atomic Credit Ledger, Store, Auctions & Trading  
**Primary Action:** `COLLECT` | **Domain Accent:** Raspberry (`APP_TINTS.vault`, `[data-app="vault"]` in `src/styles/facet/tokens.css`)  
**Routes:** `/vault`, `/vault/achievements`, `/vault/cards`, `/vault/store`, `/vault/import` (plus the redirects below) | **Status:** Release Candidate (platform 1.5.0 "Lobster Crosby") — see [Known Gaps](#known-gaps)  

The Vault is the platform's collectathon hub: achievements, cards and the IxCredits store under one app, in the sidebar for every signed-in player (the `showCardsTab` setting is gone), with Lorewards shared between the Vault and WikiOS. IxCredits are **pure metagame**: they reward platform activity (wiki edits, ThinkPages and forum posts, card activity, Lorewards, achievements, the daily reward). A player's country and MyCountry play no part in the Vault economy; the one exception is the 2% nation-card royalty an auction pays the nation's owner. Design: [the 2026-10-14 spec](../specs/2026-10-14-vault-collectathon-hub-design.md).

---

## Layout & Sections

There is no client-side `VaultRouter`: `/vault` uses normal Next.js routes wrapped in a shared layout (`src/app/vault/layout.tsx`: `AuthenticationGuard` + page container). Navigation is the shell sidebar's source list (Vault entry in `src/lib/navigation/app-sections.ts`), five rows:

| Row | Route | Also matches |
|---|---|---|
| Wallet | `/vault` (exact) | |
| Daily reward | the daily reward dialog (action, with a badge) | |
| Achievements | `/vault/achievements` | |
| Cards | `/vault/cards` | `/vault/inventory`, `/vault/collections`, `/vault/lore-gallery`, `/vault/ns-library`, `/vault/ns-deck`, `/vault/import` |
| Store | `/vault/store` | `/vault/marketplace`, `/vault/market`, `/vault/packs`, `/vault/trading` |

Redirects: `/vault/marketplace` → `/vault/store` (query string kept, so the `?tab=store|auctions|trading` values carry over), `/vault/market` → `/vault/store?tab=auctions`, `/vault/packs` → `/vault/store?tab=store`, `/vault/trading` → `/vault/store?tab=trading`, `/vault/exchange` → `/labs/exchange` ([Exchange](./exchange.md) is a Labs section now), `/achievements` → `/vault/achievements` (query kept).

- `src/components/vault/vault-sections.ts` – `getSubTabFromPathname` only (the Cards sub-tab for a path); the navigation itself is the Vault entry of the source list
- **Sections** (`src/components/vault/sections/`):
  - `Dashboard` (`VaultDashboardSection.tsx`, `/vault`): the Wallet page, see [below](#the-wallet-page)
  - `Cards` (`VaultCardsSection.tsx`, `/vault/cards`, `/vault/inventory`, `/vault/collections`): Card Gallery (the default; `/vault/lore-gallery`, `/vault/ns-library`, lore source selected first), Inventory (rarity/type filters, bulk junking), Collections
  - `Marketplace` (`VaultMarketplaceSection.tsx`, `/vault/store?tab=store|auctions|trading`): Vault Shop (packs + cosmetics, cinematic pack opening; `?view=my-packs` opens the shop on My packs, which the Wallet's "Open N packs" action uses), Auctions, P2P Trading
  - `Import` (`VaultImportSection.tsx`, `/vault/import`): NationStates deck verification and import wizard
  - `Lorewards` (`VaultLorewardsPanel.tsx`): the Lorewards tab of the Achievements page, a wrapper around the shared `LorewardsView` (`focus="you"`)
- Achievements (`src/app/vault/achievements/`, `src/components/achievements/`) has four tabs: All, Lorewards, Showcase and Leaderboard; see [achievements.md](./achievements.md)
- Standalone routes: `/vault/crafting` (a "Crafting is retired for now" empty state; see [cards.md](./cards.md#crafting-retired-for-now-2026-10-05)), `/vault/lore-generator`, `/vault/ns-deck/[nation]`, `/vault/collections/[slug]`, `/vault/admin`

### The Wallet page

`/vault` is a bank statement (cards of content type `data` and `collectible`, a `FacetList`, and a `Signal`). Desktop: the title with its actions, the balance card, the showcase, then the statement on the left two thirds and, on the right, the Your Vault list with the latest unlock. Phone: title, balance, showcase (two columns), Your Vault, latest unlock, statement.

- **Title and actions** (`dashboard/VaultWalletHeader.tsx`): "Wallet", with Claim daily reward (the one primary, only while claimable, through `DailyRewardProvider`) and Store.
- **Balance card** (`dashboard/VaultBalanceCard.tsx`): the IxCredits balance as a large counting figure, the collector level, "+N today" and the login streak; below it one net worth well (credits plus deck value, trophy cards included) with a credits-versus-cards split bar and the card count and value. Figures count with the `number-flow` primitive. No country.
- **Showcase** (`dashboard/VaultShowcase.tsx`): `cards.getMyTopCards` (the three most valuable owned cards, one per card, trophy cards included) as cutout cards on their real art (a card opens the card details modal), plus one pack card, "N packs waiting", linking to `/vault/store?tab=store&view=my-packs` while any are unopened. An empty collection shows an empty state with a link to the Store.
- **Statement** (`dashboard/VaultStatement.tsx`, pure grouping and the row icon mapping in `src/lib/vault/statement.ts`): `vault.getTransactions` (offset paging; `direction: "earned" | "spent"` filter; returns each row's `metadata`), grouped by UTC day (Today, Yesterday, then dates), each row with a signed amount and the running balance from `balanceAfter`. A Vault dividend row expands to its stored breakdown; Loreward rows name the contest, place and date (and the page, for payouts made since the tiered table); achievement rows name the achievement and link to `/vault/achievements?a=<key>`. Filters All, Earned and Spent, and "Show earlier". Each row carries a tinted icon for its source (dividend, daily reward, achievement, Loreward, pack, store, market, trade, or a neutral one).
- **Your Vault** (`dashboard/VaultHoldings.tsx`): a `FacetList` of Achievements (unlocked of the active total, points, rank, a thin progress bar), Lorewards (wins and today's rank, or "Needs a linked wiki account"), Cards (a link to the card hub) and Store (one featured item and its price).
- **Latest unlock** (`dashboard/VaultLatestUnlock.tsx`): the newest unlocked achievement (`achievements.getMySummary.latest`) on its category aurora and, from Epic, the foil sheen, with its rarity and IxCredits reward, linking to `/vault/achievements?a=<key>`. Hidden until the player has one.
- **Wiki signal** (`dashboard/VaultWikiSignal.tsx`): an info `Signal` to link a wiki account, only while the account has no verified IxWiki link.
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
- Crafting has no switch any more: it is retired and refuses every call (`CRAFTING_ENABLED = false` in `routers/crafting/_retired.ts`); a leftover `vault_isCraftingEnabled` row is ignored
- Also tunable: `activeDailyCap` (100), `socialDailyCap` (50; nothing pays `EARN_SOCIAL` any more), `xpPerLevel` (1,000), `maxStreakBonus` (7) and `premiumMultiplier` (display-only today). The store item's `yieldBoost` effect is labelled "Dividend boost" in the admin store form and multiplies the nightly Vault dividend. Store prices are each item's `VaultStoreItem.price`, edited in the store-item editor (the old `vault_price*` keys were removed on 2026-10-05)

---

## Backend Routers (`src/server/api/routers/vault/`)

Organized into modular sub-files:
- `vault/index.ts` – Router combination
- `vault/balance-credits.ts` – Balance, level, today's earnings and user stats (`getUserStats` returns `deckValue`, which counts trophy cards, and `deckValueExTrophy`, which the dividend and deck-value achievements use). `getBalance` is a plain read (the old missed-day catch-up is gone). It also pays the one-time new-player bonus to an account that never received it (see [ixcredits.md](./ixcredits.md#4-metagame-bonuses-earn_bonus--uncapped)); new accounts are paid at sign-up, with or without a country
- `vault/daily-claims.ts` – Daily bonus / combined daily claim
- `vault/store.ts` – Store listing, purchased items, cosmetic equip, `getTransactions` (the statement's feed)
- `vault/public-cosmetics.ts` – `getEquippedCosmeticsFor`, another player's equipped cosmetics (public)
- `vault/collections.ts` – Collection details, likes, comments, public collections
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

Related routers: `cards/`, `card-packs/`, `card-market/` (auctions & bids), `trading/`, `crafting/` (retired), `lore-cards/`, `ns-import/`, `achievements/`, `lorewards/`.

---

## Known Gaps

- **Crafting** is retired for now (2026-10-05); the schema and history rows stay until the schema-drop decision.
- **Card Gallery** (lore/NS library browsing) is dev-build only.
- **Premium multiplier** is shown in Settings but not applied to earnings (`getBalance` returns `isPremium: false`).

---

## Related Documentation

- [IxCredits Virtual Currency Engine](./ixcredits.md)
- [IxCards System Guide](./cards.md)
- [NationStates Integration Guide](./ns-integration.md)
- [API Reference: IxVault (Cards & Credits)](../reference/api-complete.md)
