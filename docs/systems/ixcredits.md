# IxCredits (IxC) - Virtual Currency System

IxCredits are the virtual currency powering the IxStats platform economy. Players earn IxC through gameplay — managing their nation, engaging in diplomacy, responding to crises, and participating socially — and spend them on card packs, crafting, trading, and marketplace auctions.

---

## How IxCredits Work

Every user has a **Vault** (`MyVault`) that tracks:

| Field | Description |
|-------|-------------|
| `credits` | Current spendable balance |
| `lifetimeEarned` | Total IxC ever earned |
| `lifetimeSpent` | Total IxC ever spent |
| `vaultLevel` | Progression level (1,000 XP per level) |
| `vaultXp` | Experience points (1 XP per 1 IxC earned) |
| `loginStreak` | Consecutive daily logins |
| `todayEarned` | IxC earned today (resets at midnight UTC) |

All credit transactions are recorded in a **VaultTransaction** ledger with the amount, resulting balance, transaction type, descriptive source, and optional JSON metadata for audit trails.

---

## Earning IxCredits

### Passive Income (`EARN_PASSIVE`) — No daily cap

Every day, nation leaders receive a **dividend** based on their country's economic performance. Distributed automatically via a scheduled cron job.

**Formula:**

```
Daily Dividend = (Base Rate + Population Bonus + Growth Bonus) × Budget Multiplier

Base Rate       = (GDP Per Capita / 10,000) × Economic Tier Multiplier
Population Bonus = Population / 1,000,000 × 0.01
Growth Bonus    = Base Rate × 0.1   (only if GDP growth > 3%)
```

**Economic Tier Multipliers:**

| Tier | Multiplier |
|------|-----------|
| Extravagant | 3.5× |
| Very Strong | 3.0× |
| Strong | 2.5× |
| Developed | 2.0× |
| Healthy | 1.5× |
| Developing | 1.0× |
| Impoverished | 0.5× |

**Budget Multiplier** — Calculated from government budget allocations. Each department's spending allocation is weighted by its vault multiplier and summed. Typical range: 0.8×–2.0×. Heavy economic investment increases passive income; heavy defense allocation reduces it. See `budget-vault-calculator.ts` for the full calculation.

**Example:** A nation with $45,000 GDP per capita, "Strong" tier, 25M population, 4% growth, and a 1.3× budget multiplier would earn roughly:
```
Base Rate = (45000/10000) × 2.5 = 11.25
Pop Bonus = 25 × 0.01 = 0.25
Growth Bonus = 11.25 × 0.1 = 1.125  (growth > 3%)
Dividend = (11.25 + 0.25 + 1.125) × 1.3 ≈ 16.4 IxC/day
```

---

### Daily Login Bonus (`EARN_ACTIVE`)

Claim once per day. Bonus scales with consecutive login streak:

| Streak | Bonus |
|--------|-------|
| Day 1 | 1 IxC |
| Day 2 | 2 IxC |
| Day 3 | 3 IxC |
| ... | ... |
| Day 7+ | 7 IxC (max) |

Missing a day resets the streak to 1.

---

### Achievements (`EARN_ACTIVE`)

Unlocking achievements awards IxC based on rarity:

| Rarity | Reward |
|--------|--------|
| Common | 5 IxC |
| Uncommon | 10 IxC |
| Rare | 25 IxC |
| Epic | 50 IxC |
| Legendary | 100 IxC |

---

### Diplomatic Actions (`EARN_ACTIVE`)

| Action | Reward |
|--------|--------|
| Establish an embassy | 15 IxC |
| Create a cultural exchange | 12 IxC |

---

### Diplomatic Scenarios (`EARN_ACTIVE`)

Responding to diplomatic scenarios earns a base reward plus a risk bonus:

| Component | Amount |
|-----------|--------|
| Base reward | 5 IxC |
| Low risk choice | +0 |
| Medium risk choice | +2 |
| High risk choice | +5 |
| Extreme risk choice | +8 |

---

### Crisis Event Responses (`EARN_ACTIVE`)

Successfully responding to crisis events awards IxC based on severity:

| Severity | Success Reward | Contained Reward |
|----------|---------------|-----------------|
| Low | 10 IxC | 8 IxC |
| Medium | 12 IxC | 8 IxC |
| High | 15 IxC | 8 IxC |
| Extreme | 20 IxC | 8 IxC |

---

### Social Posts (`EARN_SOCIAL`)

Posting on ThinkPages earns 1 IxC per post, up to 5 posts per day. Applies to government, media, and citizen post types.

---

## Daily Earning Caps

| Category | Daily Cap |
|----------|----------|
| `EARN_ACTIVE` (login, achievements, diplomacy, crises) | 100 IxC |
| `EARN_SOCIAL` (ThinkPages posts) | 50 IxC |
| `EARN_PASSIVE` (nation dividend) | No cap |
| `EARN_CARDS` (card activities) | No cap |

The `todayEarned` counter resets at midnight UTC. Caps are checked before each earning transaction; excess amounts are rejected.

---

## Spending IxCredits

### Card Packs (`SPEND_PACKS`)

Packs are purchased from the Pack Store. Each pack has a set price in IxC (varies by pack). Validation ensures the pack is active, not expired, not sold out, and the user has sufficient balance.

---

### Card Crafting (`SPEND_CRAFT`)

**Fusion Recipes** — Combine cards into higher rarity:

| Recipe | Input | Output | Cost |
|--------|-------|--------|------|
| Common Fusion | 2× Common | 1× Uncommon | 250 IxC |
| Uncommon Fusion | 2× Uncommon | 1× Rare | 500 IxC |
| Rare Fusion | 3× Rare | 1× Ultra-Rare | 1,000 IxC |
| Epic Fusion | 2× Ultra-Rare + 1× Epic | 1× Legendary | 5,000 IxC |
| Mythic Fusion | 3× Legendary | 1× Mythic | 10,000 IxC |
| Lore Card Fusion | Varies | Lore Card | 750 IxC |
| Event Card Fusion | Varies | Event Card | 1,500 IxC |

**Evolution Recipes** — Upgrade a card's rarity:

| Rarity | Cost |
|--------|------|
| Common → Uncommon | 200 IxC |
| Uncommon → Rare | 400 IxC |
| Rare → Ultra-Rare | 800 IxC |
| Ultra-Rare → Epic | 2,000 IxC |
| Epic → Legendary | 4,000 IxC |

---

### P2P Trading (`SPEND_MARKET`)

Trade offers can include IxCredits alongside cards. Both the initiator and recipient can attach credits to sweeten a deal. Credits transfer atomically with card ownership changes when a trade is accepted.

---

### Marketplace Auctions (`SPEND_MARKET`)

Players list cards for auction and others bid in IxC.

**Fees:**

| Fee | Amount | Condition |
|-----|--------|-----------|
| Listing fee | 5 IxC | Always |
| Success fee | 10% of sale | Sales > 100 IxC |
| Express listing | 10 IxC | 30-minute auctions |
| Featured listing | 25 IxC | Highlighted in marketplace |

Winning bids transfer to the seller. Failed auctions refund the bidder. Auction completion is processed by a cron job running every minute.

---

### Boosts & Cosmetics (`SPEND_BOOST`, `SPEND_COSMETIC`)

Planned but not yet implemented. Reserved transaction types for future premium items and cosmetic customization.

---

## Vault Progression

| Mechanic | Formula |
|----------|---------|
| XP | 1 XP earned per 1 IxC earned |
| Level | `floor(vaultXp / 1000) + 1` |
| Login Streak | +1 per consecutive day; resets if a day is missed |

---

## Transaction Types

All credit movements are categorized by a `VaultTransactionType`:

| Type | Direction | Description |
|------|-----------|-------------|
| `EARN_PASSIVE` | + | Daily nation dividend |
| `EARN_ACTIVE` | + | Gameplay rewards (login, achievements, diplomacy, crises) |
| `EARN_CARDS` | + | Card-related activities |
| `EARN_SOCIAL` | + | Social engagement (ThinkPages posts) |
| `SPEND_PACKS` | − | Card pack purchases |
| `SPEND_MARKET` | − | Marketplace and P2P trading |
| `SPEND_CRAFT` | − | Card crafting and fusion |
| `SPEND_BOOST` | − | Premium boost purchases (planned) |
| `SPEND_COSMETIC` | − | Cosmetic upgrades (planned) |
| `ADMIN_ADJUSTMENT` | ± | Manual admin corrections |

Each transaction records: amount, balance after, type, source description, optional metadata (JSON), and timestamp.

---

## API Endpoints (tRPC Vault Router)

### Queries (Protected)
| Endpoint | Description |
|----------|-------------|
| `vault.getBalance` | Current balance, level, XP, streak, lifetime stats |
| `vault.getTransactions` | Paginated transaction history (filterable by type) |
| `vault.getVaultLevel` | Level and XP progress |
| `vault.getEarningsSummary` | Today's earnings breakdown by category |
| `vault.getTodayEarnings` | Formatted earnings by source |
| `vault.calculatePassiveIncome` | Daily/weekly/monthly dividend projection for a country |
| `vault.checkDailyCap` | Remaining allowance for an earning type |
| `vault.getUserStats` | Total cards, deck value, collector level |

### Mutations (Protected)
| Endpoint | Description |
|----------|-------------|
| `vault.claimDailyBonus` | Claim daily login bonus |
| `vault.claimStreakBonus` | Update login streak |
| `vault.spendCredits` | Spend credits (validates balance and type) |

### Mutations (Admin Only)
| Endpoint | Description |
|----------|-------------|
| `vault.earnCredits` | Manually award credits |
| `vault.getBudgetMultiplier` | View passive income multiplier for a country |
| `vault.getBudgetMultiplierBreakdown` | Department-by-department budget impact |

---

## Key File Locations

| Component | Path |
|-----------|------|
| Prisma models (MyVault, VaultTransaction) | `prisma/schema.prisma` |
| VaultTransactionType enum | `prisma/schema.prisma` |
| Core vault service | `src/lib/vault-service.ts` |
| Budget-vault calculator | `src/lib/budget-vault-calculator.ts` |
| Passive income cron | `src/lib/passive-income-cron.ts` |
| tRPC vault router | `src/server/api/routers/vault.ts` |
| Crafting recipes seed data | `prisma/seeds/crafting-recipes.ts` |
| Card pack service | `src/lib/card-pack-service.ts` |
| VaultWidget (MyCountry sidebar) | `src/components/mycountry/VaultWidget.tsx` |
| Vault dashboard | `src/components/vault/sections/VaultDashboardSection.tsx` |
| Vault router (client) | `src/components/vault/VaultRouter.tsx` |
| Pack acquisition UI | `src/components/vault/sections/VaultAcquireSection.tsx` |
| Auction creation modal | `src/components/cards/marketplace/CreateAuctionModal.tsx` |
| Bid panel | `src/components/cards/marketplace/BidPanel.tsx` |
| useVaultBalance hook | `src/hooks/vault/useVaultBalance.ts` |
| useEarnCredits hook | `src/hooks/vault/useEarnCredits.ts` |
| useDailyBonus hook | `src/hooks/vault/useDailyBonus.ts` |
| useVaultStats hook | `src/hooks/vault/useVaultStats.ts` |
