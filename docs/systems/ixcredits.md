# IxCredits (IxC) - Virtual Currency System (part of IxVault)

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

---

## Earning Architecture

> Merged from `docs/EARNING_ARCHITECTURE.md`. Date: June 2026.
> Architecture diagrams, data flow, hook architecture, error handling strategy, daily cap enforcement, passive income cron job spec, and monitoring/metrics.

### System Architecture

```
                           IxStats Platform
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │  Diplomacy   │  │ Achievements │  │   Social     │
     │   System     │  │    System    │  │  Platform    │
     └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
            └──────────────────┼──────────────────┘
                               ▼
                     ┌─────────────────┐
                     │  Vault Service  │ ◄── Centralized earning logic
                     └────────┬────────┘
                              ▼
                     ┌─────────────────┐
                     │   PostgreSQL    │ ◄── Transaction logging
                     └─────────────────┘
```

All earning flows through the centralized `vaultService.earnCredits()`. Client hooks (`useVaultBalance`, `useEarnCredits`, `useDailyBonus`) handle UI updates with optimistic rendering, toast notifications, and automatic cache invalidation.

### Earning Sources Architecture

| Category | Sources | Daily Cap |
|----------|---------|-----------|
| `EARN_ACTIVE` | Missions (3-15 IxC), Crisis Response (5 IxC), Achievements (10-100 IxC), Daily Bonus (1-7 IxC) | 100 IxC |
| `EARN_SOCIAL` | Posts (1 IxC each, max 5/day), Replies (1 IxC each, max 5/day) | 50 IxC |
| `EARN_PASSIVE` | Daily Dividend (GDP-based, once daily) | No cap |
| `EARN_CARDS` | Card Activities (TBD) | TBD |

### Transaction Lifecycle

1. **Earning Request** → Source system calls `vaultService.earnCredits()` with userId, amount, type, source, metadata
2. **Vault Service Processing** → Validates amount, checks auth, gets/creates vault, resets daily earnings if new day, checks daily cap
3. **Database Transaction (Atomic)** → Updates MyVault (credits, lifetimeEarned, todayEarned, vaultXp) + creates VaultTransaction
4. **Response** → Returns success, new balance, message
5. **Client Update** → Invalidates cache, shows toast notification, updates UI

### Hook Architecture

- **`useVaultBalance`** — Query: `vault.getBalance`. Refetches every 30s, on window focus. Returns balance, todayEarned, lifetimeEarned, lifetimeSpent, vaultLevel, vaultXp, loginStreak.
- **`useEarnCredits`** — Mutation: `vault.earnCredits`. Optimistic update on mutate, toast on success, rollback on error, cache invalidation on settled.
- **`useDailyBonus`** — Mutation: `vault.claimDailyBonus`. Checks cooldown (server-side), updates streak, awards 1-7 IxC based on streak, toasts amount + streak.

### Error Handling Strategy (Non-Blocking Pattern)

```
try {
  const earnResult = await vaultService.earnCredits(...)
  if (earnResult.success) creditsEarned = amount
} catch (error) {
  console.error("Earning failed:", error)
  // DON'T rethrow - let main action complete
}
// Main action continues regardless of earning result
```

**Benefits**: Main actions never blocked by earning failures, graceful degradation (0 credits on error), errors logged for debugging.

### Daily Cap Enforcement Flow

1. Earn request → `vaultService.earnCredits()`
2. Check type → `EARN_PASSIVE` skips cap check
3. For `EARN_ACTIVE`/`EARN_SOCIAL`: Query today's transactions (userId + type + createdAt >= today), sum credits
4. Calculate remaining: `cap - todayEarnings`
5. Award `min(amount, remaining)` or return error "Daily cap reached"

### Passive Income Distribution (Cron Job)

Scheduled midnight UTC daily. Processes countries with active users in batches of 100.

**Formula**:
```
baseRate = (GDP/capita / 10000) × tierMultiplier
popBonus = (population / 1M) × 0.01
growthBonus = (growth > 3%) ? baseRate × 0.1 : 0
dailyDividend = baseRate + popBonus + growthBonus
```

Each country awarded via `vaultService.earnCredits(userId, dailyDividend, "EARN_PASSIVE", "DAILY_DIVIDEND", ...)`. Results logged: total processed, success/error count, total credits distributed, duration.

### Security & Audit Trail

Every VaultTransaction includes: vaultId, credits, balanceAfter, type, source, createdAt, and optional JSON metadata (e.g., `{ missionId, difficulty }`, `{ achievementId, rarity }`, `{ countryId, gdp }`). Enables detailed audit trails, analytics, anti-cheat detection, and user transaction history.

### Performance Optimizations

**Client-side**: Optimistic updates (instant UI), automatic refetch (30s interval), cache invalidation on mutations, stale time to reduce requests.
**Server-side**: Prisma transactions (atomic), batch processing (cron efficiency), indexed queries (userId, createdAt, type), non-blocking errors.
**Database**: Composite index on (userId, createdAt, type), count vs. full fetch for cap checks.

### Monitoring & Analytics

Key metrics: daily active earners, average earnings per user, daily cap hit rate, login streak distribution, total credits in circulation, daily credit creation rate, passive vs. active earning ratio, earning endpoint latency, cron job success rate, unusual earning patterns, cap bypass attempts.

### Architecture Principles

1. Centralization — All earning through vault service
2. Auditability — Every transaction logged with metadata
3. Non-Blocking — Earning failures never block main actions
4. Cap Enforcement — Server-side daily limits
5. Type Safety — TypeScript throughout
6. Optimistic UI — Instant feedback for users
7. Error Resilience — Graceful degradation
8. Performance — Batch processing, caching, indexing

---

## Developer Quick Reference

> Merged from `docs/EARNING_QUICK_REFERENCE.md`. Date: June 2026.
> Copy-paste developer patterns for integrating IxCredits earning into new features.

### Client-Side Usage (React Hooks)

```typescript
import { useVaultBalance, useEarnCredits, useDailyBonus } from '~/hooks/vault';

// Display balance
function BalanceDisplay() {
  const { balance, todayEarned, vaultLevel } = useVaultBalance();
  return <p>Balance: {balance.toLocaleString()} IxC | Today: +{todayEarned} | Level: {vaultLevel}</p>;
}

// Award credits for custom action
function CustomAction() {
  const { earn, isEarning } = useEarnCredits();
  const handleAction = () => earn({
    amount: 5, type: 'EARN_ACTIVE', source: 'CUSTOM_ACTION',
    metadata: { actionId: '123', actionType: 'quest_complete' }
  });
  return <button onClick={handleAction} disabled={isEarning}>Complete (+5 IxC)</button>;
}
```

### Server-Side Integration (tRPC Routers)

```typescript
import { vaultService } from "~/lib/vault-service";

// Basic earning integration
.mutation(async ({ ctx, input }) => {
  const result = await doSomething(input);
  let creditsEarned = 0;
  if (ctx.auth?.userId) {
    try {
      const earnResult = await vaultService.earnCredits(
        ctx.auth.userId, 10, "EARN_ACTIVE", "YOUR_SOURCE", ctx.db,
        { actionId: input.id, actionType: "custom" }
      );
      if (earnResult.success) creditsEarned = 10;
    } catch (error) {
      console.error("[YourRouter] Failed to award credits:", error);
    }
  }
  return { ...result, creditsEarned };
})
```

### Common Patterns

**Pattern 1: Simple Reward**
```typescript
let creditsEarned = 0;
if (ctx.auth?.userId && actionSuccessful) {
  try {
    const earnResult = await vaultService.earnCredits(
      ctx.auth.userId, amount, "EARN_ACTIVE", "ACTION_NAME", ctx.db, { actionId: id }
    );
    if (earnResult.success) creditsEarned = amount;
  } catch (error) { console.error("[Router] Earning error:", error); }
}
```

**Pattern 2: Daily Cap Enforcement**
```typescript
const today = new Date(); today.setHours(0, 0, 0, 0);
const countToday = await ctx.db.table.count({
  where: { userId: ctx.auth.userId, createdAt: { gte: today } },
});
if (countToday <= MAX_PER_DAY) { /* award credits */ }
```

**Pattern 3: Difficulty-Based Rewards**
```typescript
const difficultyRewards: Record<string, number> = { easy: 3, medium: 5, hard: 10, expert: 15 };
const reward = difficultyRewards[result.difficulty] || 5;
```

**Pattern 4: State Transition Reward**
```typescript
if (previousState === "pending" && newState === "completed") {
  // Award credits for transitioning between specific states
}
```

### Checklist for New Integrations

- [ ] Import vault service: `import { vaultService } from "~/lib/vault-service"`
- [ ] Determine transaction type: `EARN_ACTIVE`, `EARN_SOCIAL`, or `EARN_PASSIVE`
- [ ] Wrap in try/catch — never throw errors from earning logic
- [ ] Don't block main action on earning failure
- [ ] Include metadata for audit trail: `{ actionId, actionType, ... }`
- [ ] Return `creditsEarned` in response
- [ ] Test daily caps — verify cap enforcement works
- [ ] Verify audit trail — check VaultTransaction records

### Troubleshooting

**Credits not appearing in UI**: Check earning mutation success, cache invalidation (`utils.vault.getBalance.invalidate()`), user authentication.

**Daily cap not working**: Verify correct transaction type (`EARN_ACTIVE` or `EARN_SOCIAL`), vault service auto-checks caps.

**Earning blocking main action**: Wrap in try/catch; don't throw errors.

**Transactions not logged**: Always use `vaultService.earnCredits()` — never create VaultTransaction records directly.
