# IxCredits (IxC) Virtual Currency Engine

**Last updated:** 2026-10-14  
**Status:** Release Candidate (platform 1.5.0 "Lobster Crosby")  
**Hierarchy:** Currency & Earning Engine of **IxVault** (`IXVAULT_VERSION = 3`).

IxCredits (IxC) are the universal virtual currency powering the IxStates platform economy. IxCredits are **pure metagame**: players earn IxC through platform activity (wiki edits, ThinkPages and forum posts, card activity, Lorewards, achievement unlocks and the daily reward) and spend them on card packs, marketplace trading and platform customizations. Nothing in the Vault economy reads a country, and no country action writes a ledger row; the one exception is the nation card royalty described under [Card sales](#card-sales-and-trades). Design: [the Vault hub spec](../specs/2026-10-14-vault-collectathon-hub-design.md).

---

## Vault Architecture & Ledger Models

Defined in `prisma/schema/cards.prisma`:

### `MyVault`
| Field | Type | Description |
| :--- | :--- | :--- |
| `credits` | Float | Spendable balance |
| `lifetimeEarned` | Float | All-time earned credits |
| `lifetimeSpent` | Float | All-time spent credits |
| `vaultLevel` | Int | Progression tier (`floor(vaultXp / xpPerLevel) + 1`; `xpPerLevel` defaults to 1,000) |
| `vaultXp` | Int | Experience points (1 XP per 1 IxC earned) |
| `loginStreak` | Int | Consecutive daily logins |
| `todayEarned` | Float | Credits earned today (reset lazily on the first read/earn after midnight UTC) |

### `VaultTransaction`
Immutable ledger recording every balance change with `vaultId`, `credits`, `balanceAfter`, `type` (a `VaultTransactionType` value stored as a string: `EARN_PASSIVE`, `EARN_ACTIVE`, `EARN_CARDS`, `EARN_SOCIAL`, `EARN_BONUS`, `REFUND`, `SPEND_*`, `ADMIN_ADJUSTMENT`, and `SPEND_EXCHANGE` / `EARN_EXCHANGE`, which only old rows carry now: the IxCredits and Sovereigns conversion was removed and nothing writes them), `source`, `metadata` (JSON audit trail), an optional unique `idempotencyKey`, and `createdAt`.

---

## Earning IxCredits

```mermaid
graph TD
    A[Gameplay Action / Event / Cron] --> B[vaultService.earnCredits]
    B --> C{Daily Cap Check}
    C -->|Within Cap / Passive| D[Atomic DB Transaction]
    C -->|Exceeded| E[Reject / Clamp Amount]
    D --> F[Update MyVault Balance & XP]
    D --> G[Insert VaultTransaction Ledger Row]
    D --> H[Return Success & Invalidate UI Caches]
```

### 1. The Vault dividend (`EARN_PASSIVE`) — no daily cap
One payout per user per UTC day, written at midnight UTC by the `vault-dividend` cron job (`src/server/cron/vault-dividend-cron.ts`, registered in `src/server/cron/jobs.ts`; schedule override key `cronSchedule_vaultDividend`). It replaced the country dividend (`passive-income` job, `vault-passive-income.ts`, `dividend-nation.ts`, the budget multiplier and the missed-day catch-up on vault reads), which were deleted. The maths is one pure module, `src/lib/vault/vault-dividend.ts` (`DIVIDEND` holds the rates); `src/server/modules/vault/vault-dividend-settle.ts` loads the inputs and writes the row.

| Part | Rule | Cap |
|---|---|---|
| Collection interest | 0.25% of card deck value per day (retired cards and Loreward trophy cards excluded) | 25 |
| Wiki | The Lorewards engine's score for the user's previous day, 1 credit per 80 points | 30 |
| ThinkPages and forum | 2 per human ThinkPages post (auto-generated posts and reposts excluded) or visible forum post or reply | 20 |
| Cards | 2 per pack opened, 5 per completed trade, 3 per listing sold | 20 |
| Streak | Activity parts (wiki, posts, cards) × 0.05 per login-streak day, up to 10 days, so at most +50% of the activity | |
| Store upgrade | Total × (1 + `yieldBoost`) from owned upgrades | |
| Total | | 150 |

- **Who is paid:** vaults with at least one input above zero and a computed total above zero. No country lookup anywhere.
- **Wiki scoring:** `scoreDailyWikiOS` (`enrichAll` option) scores every candidate, and a user's wiki figure is the sum of their (page, day) scores. Each candidate (one name's edits to one page that day) is credited from its scored revisions themselves (`scoredEditsAccount`, from the `authorIds` scoring carries): one WikiOS account on all of them, that account, even when someone else holds a link for the name; none on any (all mirrored from MediaWiki), the exact holder of the name's verified IxWiki `WikiAccountLink` (an exact match on the normalized name); mixed, no one. A MediaWiki editor with no link earns no wiki part. The Wallet has no link prompt.
- **Idempotency:** key `dividend:<userId>:<yyyy-mm-dd>`; type `EARN_PASSIVE`, source `VAULT_DIVIDEND`, label "Vault dividend". The row's `metadata` stores `{ day, lines, inputs }` (each part's amount and figures), which the statement expands (`parseDividendMetadata`).
- **Missed days:** each run settles yesterday, then any unsettled day among the 7 before it, from that day's own activity. A day counts as settled once any dividend row exists for it, so a payout that failed alone is not retried. Deck value and the streak are read at settle time, not as of the missed day.
- **Start day:** the first run writes the SystemConfig row `vault_dividend_started_on`; no earlier day is ever settled, so deploy night does not back-pay days. Clear that row to re-start.
- **Admin:** the cron and tuning widgets point at `vault-dividend`. The store item effect `yieldBoost` is labelled "Dividend boost".

### 2. Active Gameplay (`EARN_ACTIVE`) — 100 IxC Daily Cap
- **Login Streak** (`vault.claimDailyBonus`): 1 to 7 IxC daily (`min(streak, maxStreakBonus)`)
- **Combined Daily Claim** (`vault.claimCombinedDailyClaim`): choose a randomized credit roll (10–10,000 IxC before the cap) or a random card of the day. The claim dialog (`DailyRewardProvider.tsx`) describes the roll as paid up to the daily earning cap (the 100 IxC active cap always applies). It auto-opens at most once per user per UTC day (tracked in `localStorage`); after that it stays available from the sidebar "Daily reward" row and the Wallet's `DailyRewardStatus` until claimed
- Removed: diplomatic action rewards (embassies, cultural exchanges), diplomatic scenario responses, the per-post ThinkPages reward and the forum action reward. No country action pays IxCredits any more.

### 3. Social contributions (`EARN_SOCIAL`)
Nothing pays `EARN_SOCIAL` now. ThinkPages and forum posts are paid through the dividend's posts part. The type, its 50 IxC cap (`socialDailyCap`) and its label stay so old statement rows read correctly.

### 4. Metagame Bonuses (`EARN_BONUS`) — Uncapped
Granted through `grantBonus()` (`src/lib/vault/vault-bonus.ts`), outside the daily caps and the `isEarningEnabled` gate; amounts are admin-tunable (`vault_bonus_*` SystemConfig) in `/admin/cards` → Economy (Bonuses, and the Loreward payout grid):
- **Achievement Unlocks** (one-time each): Common 100, Uncommon 250, Rare 500, Epic 1,000, Legendary 2,500 IxC. Account-level achievements (62 of the 114 active ones: tenure, wiki, community, cards, Lorewards and others) unlock without a country; see [achievements.md](./achievements.md)
- **New Player** 5,000 IxC.
- **Loreward payouts** by contest and place, for entries from `LOREWARD_PAYOUT_START` (2026-10-15) on: daily 500 winner / 150 runner-up, weekly 1,500 / 400, monthly 4,000 / 1,000 (`LOREWARD_PAYOUTS` in `vault-bonus.ts`; a `vault_bonus_loreward_<type>_<winner|runner_up>` SystemConfig row overrides a cell, set in `/admin/cards` → Economy → Loreward payouts). Keys `bonus:loreward:<entryId>` (winner, unchanged) and `bonus:loreward:<entryId>:runner-up`. Entries before the start keep what was paid; the single `vault_bonus_loreward` setting is gone. Weekly and monthly runner-ups are not recorded in the Lorewards data today, so only recorded places pay. Each place also mints a trophy card (see [cards.md](./cards.md#loreward-trophy-cards)), which pays nothing.
- **Removed:** the Wiki Country Import bonus (it fired on country founding).
- **New Player bonus is an IxnayID bonus.** `grantNewPlayerBonus()` pays it when the account is created (`UserManagementService.getOrCreateUser`), with no country needed. Accounts that predate this get it the first time they open the Vault (`vault.getBalance`; switch off with `NEW_PLAYER_BONUS_ON_VAULT_OPEN` in `vault-bonus.ts`). Country creation and realm claims no longer trigger it. The source is `bonus:new_player` with `oneTime`, so the ledger check plus the idempotency key `bonus:new_player:<User.id>` pay it once per account
- **NS Deck Import**: 50 IxC per newly imported card, capped at 5,000 IxC, paid **once per nation, whichever account imports it** (`onceKey` on the nation name, `ns-import/decks.ts`)

Both caps are configurable (`activeDailyCap`, `socialDailyCap`); an earn that would exceed the remaining allowance is clamped. The dividend, bonuses and card earnings are outside them.

### Card sales and trades
- Selling cards through auctions and trades pays the seller (`EARN_CARDS`). A **nation card** sold at auction pays a 2% royalty to the nation's owner (else the earliest human puller of the card) (`src/lib/economy/auction-service.ts`); it is the only place a country feeds the Vault.

---

## Spending IxCredits

- **Card Packs**: `pack-service.ts` spends through `spendCreditsTx` with type `SPEND_PACKS`, so the ledger's kill switch and idempotency apply to packs. Per-pack `priceCredits` (seeded range 100–15,000 IxC; see [cards.md](./cards.md#pack-tiers))
- **Card Crafting (`SPEND_CRAFT`)**: retired for now (2026-10-05); nothing spends `SPEND_CRAFT` any more, and old rows stay in the ledger
- **Marketplace & Trading (`SPEND_MARKET`)**: Listing fee (5 IxC standard, 10 IxC featured; 50% refunded if no bids), marketplace fee (10% on sales $>100$ IxC), P2P credit transfers
- **Boosts & Cosmetics (`SPEND_BOOST`, `SPEND_COSMETIC`)**: Vault Shop items. The seed script `scripts/setup/seed-vault-items.ts` (not run by `db:seed`) creates profile glows, frames and badges (including seasonal ones), card capacity boosts, a MyClub team licence token and a MyLeague franchise pass. It has no lore request token and no dividend boost item, although the dividend reads a `yieldBoost` effect if an owned item has one

---

## Developer Integration Patterns

### Non-Blocking Error Strategy
Earning failures must **never** block primary gameplay actions:
```typescript
try {
  const earnResult = await vaultService.earnCredits(
    ctx.auth.userId,
    10,
    "EARN_ACTIVE",
    "CUSTOM_ACTION",
    ctx.db,
    { actionId: input.id }
  );
  if (earnResult.success) creditsEarned = 10;
} catch (error) {
  console.error("[Router] Non-blocking earning failure:", error);
}
```

### Client React Hooks (`src/hooks/vault/`)
- `useVaultBalance()` – Reads current balance, XP, level, today's earnings, and premium multiplier
- `useVaultStats()` – The card count and deck value
- `useCollections()` – Collection list

There is no client-side earn hook: credits are only awarded server-side. Daily claims call `api.vault.claimDailyBonus` / `claimCombinedDailyClaim` directly (e.g. `DailyRewardProvider`).

---

## Related Documentation

- [MyVault System Guide](./myvault.md)
- [IxCards System Guide](./cards.md)
- [API Reference: IxVault (Cards & Credits)](../reference/api-complete.md)
