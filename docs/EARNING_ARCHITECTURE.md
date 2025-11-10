# IxCredits Earning Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         IxStats Platform                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Diplomacy   │  │ Achievements │  │   Social     │             │
│  │   System     │  │    System    │  │  Platform    │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                  │                  │                     │
│         └──────────────────┼──────────────────┘                     │
│                            │                                        │
│                            ▼                                        │
│                  ┌─────────────────┐                               │
│                  │  Vault Service  │ ◄── Centralized earning logic │
│                  └────────┬────────┘                               │
│                           │                                         │
│                           ▼                                         │
│                  ┌─────────────────┐                               │
│                  │   PostgreSQL    │ ◄── Transaction logging       │
│                  │   (MyVault +    │                               │
│                  │ VaultTransaction)│                               │
│                  └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        Client Layer (React)                         │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ useVaultBalance  │  │  useEarnCredits  │  │ useDailyBonus   │  │
│  │                  │  │                  │  │                 │  │
│  │ - Auto-refresh   │  │ - Optimistic UI  │  │ - Claim bonus   │  │
│  │ - Real-time sync │  │ - Toast feedback │  │ - Streak track  │  │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      VaultWidget                              │ │
│  │  - Balance display                                            │ │
│  │  - Today's earnings breakdown                                 │ │
│  │  - Vault level & XP progress                                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Mission Completion Example

```
User completes mission
         │
         ▼
┌─────────────────────┐
│ diplomatic.ts       │
│ completeMission()   │
└──────────┬──────────┘
           │
           │ 1. Validate mission
           │ 2. Apply rewards
           │ 3. Create event
           │ 4. Send notification
           │
           ▼
┌─────────────────────┐
│ vaultService        │
│ earnCredits()       │
└──────────┬──────────┘
           │
           │ 1. Validate amount
           │ 2. Check daily cap
           │ 3. Get/create vault
           │ 4. Calculate final amount
           │
           ▼
┌─────────────────────┐
│ Prisma Transaction  │
│ (Atomic)            │
└──────────┬──────────┘
           │
           ├─► Update MyVault
           │   - Increment credits
           │   - Update lifetime earned
           │   - Update today earned
           │   - Increment vault XP
           │
           └─► Create VaultTransaction
               - Log amount
               - Record type & source
               - Save metadata
               - Store balance after
```

## Earning Sources Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Earning Sources                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  EARN_ACTIVE (100 IxC/day cap)                                     │
│  ├─ Missions         (3-15 IxC based on difficulty)                │
│  ├─ Crisis Response  (5 IxC per response)                          │
│  ├─ Achievements     (10-100 IxC based on rarity)                  │
│  └─ Daily Bonus      (1-7 IxC based on streak)                     │
│                                                                     │
│  EARN_SOCIAL (50 IxC/day cap)                                      │
│  ├─ Posts            (1 IxC each, max 5/day)                       │
│  └─ Replies          (1 IxC each, max 5/day)                       │
│                                                                     │
│  EARN_PASSIVE (No cap)                                             │
│  └─ Daily Dividend   (GDP-based formula, once daily)               │
│                                                                     │
│  EARN_CARDS (Future)                                               │
│  └─ Card Activities  (TBD)                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Transaction Lifecycle

```
1. Earning Request
   ├─ Source: diplomatic.completeMission()
   ├─ Amount: 10 IxC
   ├─ Type: EARN_ACTIVE
   └─ Metadata: { missionId, difficulty }
           │
           ▼
2. Vault Service Processing
   ├─ Validate amount (> 0)
   ├─ Check authentication (userId exists)
   ├─ Get/create vault for user
   ├─ Reset daily earnings if new day
   └─ Check daily cap (EARN_ACTIVE < 100)
           │
           ▼
3. Database Transaction (Atomic)
   ├─ Update MyVault
   │  ├─ credits += 10
   │  ├─ lifetimeEarned += 10
   │  ├─ todayEarned += 10
   │  └─ vaultXp += 10
   │
   └─ Create VaultTransaction
      ├─ vaultId: user's vault
      ├─ credits: 10
      ├─ balanceAfter: newBalance
      ├─ type: EARN_ACTIVE
      ├─ source: MISSION_COMPLETE
      └─ metadata: JSON(missionData)
           │
           ▼
4. Response
   ├─ success: true
   ├─ newBalance: 1010
   └─ message: "Earned 10 IxC"
           │
           ▼
5. Client Update
   ├─ Invalidate cache (useQuery refetch)
   ├─ Toast notification ("Earned 10 IxC!")
   └─ UI updates (balance, today's earnings)
```

## Hook Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                      useVaultBalance                              │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Query: vault.getBalance                                          │
│  ├─ Refetch: Every 30 seconds                                    │
│  ├─ Refetch: On window focus                                     │
│  └─ Stale: After 25 seconds                                      │
│                                                                   │
│  Returns:                                                         │
│  ├─ balance (current IxC)                                        │
│  ├─ todayEarned                                                  │
│  ├─ lifetimeEarned                                               │
│  ├─ lifetimeSpent                                                │
│  ├─ vaultLevel                                                   │
│  ├─ vaultXp                                                      │
│  ├─ loginStreak                                                  │
│  └─ refresh() function                                           │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                      useEarnCredits                               │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Mutation: vault.earnCredits                                      │
│                                                                   │
│  Flow:                                                            │
│  1. onMutate → Optimistic update (instant UI)                    │
│  2. mutate → Call server                                         │
│  3. onSuccess → Toast notification                               │
│  4. onError → Rollback + error toast                             │
│  5. onSettled → Invalidate cache (refetch)                       │
│                                                                   │
│  Returns:                                                         │
│  ├─ earn(options) function                                       │
│  ├─ isEarning (loading state)                                    │
│  └─ error                                                        │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                      useDailyBonus                                │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Mutation: vault.claimDailyBonus                                  │
│                                                                   │
│  Flow:                                                            │
│  1. claim() → Check cooldown (server-side)                       │
│  2. Update streak → Calculate new streak                         │
│  3. Award bonus → 1-7 IxC based on streak                        │
│  4. Toast → Show amount + streak                                 │
│  5. Invalidate → Refresh balance                                 │
│                                                                   │
│  Returns:                                                         │
│  ├─ claim() function                                             │
│  ├─ isClaiming (loading state)                                   │
│  └─ error                                                        │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Error Handling Strategy

```
┌───────────────────────────────────────────────────────────────────┐
│                    Non-Blocking Error Pattern                     │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  try {                                                            │
│    const earnResult = await vaultService.earnCredits(...)        │
│    if (earnResult.success) {                                     │
│      creditsEarned = amount                                      │
│    } else {                                                      │
│      // Log but don't throw                                      │
│      console.error(earnResult.message)                           │
│    }                                                             │
│  } catch (error) {                                               │
│    // Catch unexpected errors                                    │
│    console.error("Earning failed:", error)                       │
│    // DON'T rethrow - let main action complete                  │
│  }                                                               │
│                                                                   │
│  // Main action continues regardless of earning result           │
│  return { success: true, creditsEarned }                         │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

Benefits:
✓ Main actions never blocked by earning failures
✓ Graceful degradation (0 credits on error)
✓ User experience preserved
✓ Errors logged for debugging
✓ System resilience maximized
```

## Daily Cap Enforcement

```
┌───────────────────────────────────────────────────────────────────┐
│                    Cap Enforcement Flow                           │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Earn Request → vaultService.earnCredits()                    │
│                                                                   │
│  2. Check Type → EARN_ACTIVE or EARN_SOCIAL?                     │
│     │                                                             │
│     ├─ EARN_PASSIVE → No cap check, proceed                      │
│     │                                                             │
│     └─ EARN_ACTIVE/SOCIAL → Continue to cap check                │
│                        │                                          │
│                        ▼                                          │
│  3. Get Today's Transactions                                     │
│     - Query VaultTransaction                                     │
│     - Filter by userId + type + createdAt >= today               │
│     - Sum credits earned                                         │
│                        │                                          │
│                        ▼                                          │
│  4. Calculate Remaining                                          │
│     - EARN_ACTIVE cap: 100 IxC                                   │
│     - EARN_SOCIAL cap: 50 IxC                                    │
│     - remaining = cap - todayEarnings                            │
│                        │                                          │
│                        ▼                                          │
│  5. Enforce Cap                                                  │
│     ├─ remaining > 0 → Award min(amount, remaining)              │
│     └─ remaining = 0 → Return error "Daily cap reached"          │
│                                                                   │
│  6. Log & Return                                                 │
│     - Award capped amount                                        │
│     - Log transaction                                            │
│     - Return success with actual amount awarded                  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Passive Income Distribution

```
┌───────────────────────────────────────────────────────────────────┐
│              Daily Passive Income Cron Job                        │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Scheduled: Midnight UTC daily                                    │
│                                                                   │
│  1. Fetch Countries (with active users)                          │
│     └─ Include: GDP, population, tier, growth                    │
│                                                                   │
│  2. Process in Batches (100 countries)                           │
│     ├─ Batch 1: Countries 1-100                                  │
│     ├─ Batch 2: Countries 101-200                                │
│     └─ Batch N: Remaining                                        │
│                                                                   │
│  3. Calculate Per Country                                        │
│     Formula:                                                      │
│     ┌────────────────────────────────────────┐                   │
│     │ baseRate = (GDP/capita ÷ 10000) × tierMultiplier           │
│     │ popBonus = (population ÷ 1M) × 0.01                        │
│     │ growthBonus = (growth > 3%) ? baseRate × 0.1 : 0           │
│     │                                                             │
│     │ dailyDividend = baseRate + popBonus + growthBonus          │
│     └────────────────────────────────────────┘                   │
│                                                                   │
│  4. Award Credits                                                │
│     └─ vaultService.earnCredits(                                 │
│           userId,                                                │
│           dailyDividend,                                         │
│           "EARN_PASSIVE",                                        │
│           "DAILY_DIVIDEND",                                      │
│           metadata: { countryId, gdp, ... }                      │
│        )                                                         │
│                                                                   │
│  5. Log Results                                                  │
│     ├─ Total countries processed                                 │
│     ├─ Success count                                             │
│     ├─ Error count                                               │
│     ├─ Total credits distributed                                 │
│     └─ Duration (ms)                                             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

Example Output:
┌────────────────────────────────────────────────────────────────┐
│ [CRON] Passive income distribution complete:                   │
│   - Duration: 3241ms                                           │
│   - Countries processed: 147                                   │
│   - Successful: 145                                            │
│   - Errors: 2                                                  │
│   - Total credits distributed: 4,892.35 IxC                    │
└────────────────────────────────────────────────────────────────┘
```

## Security & Audit Trail

```
┌───────────────────────────────────────────────────────────────────┐
│                    Transaction Metadata                           │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Every transaction includes:                                     │
│                                                                   │
│  Core Fields:                                                    │
│  ├─ vaultId       → Links to user's vault                       │
│  ├─ credits       → Amount earned/spent                          │
│  ├─ balanceAfter  → Audit trail for balance verification        │
│  ├─ type          → Transaction category (EARN_*, SPEND_*)      │
│  ├─ source        → Specific action (MISSION_COMPLETE, etc.)    │
│  └─ createdAt     → Timestamp for daily cap enforcement         │
│                                                                   │
│  Metadata (JSON):                                                │
│  ├─ Context-specific fields                                      │
│  ├─ Examples:                                                    │
│  │  ├─ { missionId, missionType, difficulty }                   │
│  │  ├─ { achievementId, rarity }                                │
│  │  ├─ { postId, postType }                                     │
│  │  └─ { countryId, gdp, population }                           │
│  │                                                               │
│  └─ Enables:                                                     │
│     ├─ Detailed audit trails                                     │
│     ├─ Analytics and reporting                                   │
│     ├─ Anti-cheat detection                                      │
│     └─ User transaction history                                  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Performance Optimizations

```
┌───────────────────────────────────────────────────────────────────┐
│                    Optimization Strategies                        │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Client-Side:                                                    │
│  ├─ Optimistic Updates    → Instant UI feedback                 │
│  ├─ Automatic Refetch     → Keep data fresh (30s interval)       │
│  ├─ Cache Invalidation    → Update on mutations                 │
│  └─ Stale Time            → Reduce unnecessary requests          │
│                                                                   │
│  Server-Side:                                                    │
│  ├─ Prisma Transactions   → Atomic operations                   │
│  ├─ Batch Processing      → Cron job efficiency                 │
│  ├─ Index Optimization    → Fast daily cap queries              │
│  └─ Non-Blocking Errors   → Never block main actions            │
│                                                                   │
│  Database:                                                       │
│  ├─ Indexed Fields        → userId, createdAt, type             │
│  ├─ Composite Index       → (userId, createdAt, type)           │
│  └─ Efficient Queries     → Count vs. full fetch                │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Integration Checklist

When adding earning to a new system:

```
□ Import vault service
   import { vaultService } from "~/lib/vault-service";

□ Determine transaction type
   EARN_ACTIVE, EARN_SOCIAL, or EARN_PASSIVE

□ Wrap in try/catch
   try { await vaultService.earnCredits(...) }
   catch (error) { console.error(...) }

□ Don't block main action
   Never throw errors from earning logic

□ Include metadata
   { actionId, actionType, ... }

□ Return credits earned
   return { ...result, creditsEarned }

□ Test daily caps
   Verify cap enforcement works

□ Verify audit trail
   Check VaultTransaction records
```

## Monitoring & Analytics

```
┌───────────────────────────────────────────────────────────────────┐
│                    Key Metrics to Monitor                         │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User Engagement:                                                │
│  ├─ Daily active earners                                         │
│  ├─ Average earnings per user                                    │
│  ├─ Daily cap hit rate                                           │
│  └─ Login streak distribution                                    │
│                                                                   │
│  Economy Health:                                                 │
│  ├─ Total credits in circulation                                 │
│  ├─ Daily credit creation rate                                   │
│  ├─ Passive vs. active earning ratio                            │
│  └─ Source distribution                                          │
│                                                                   │
│  System Performance:                                             │
│  ├─ Earning endpoint latency                                     │
│  ├─ Cron job success rate                                        │
│  ├─ Database query performance                                   │
│  └─ Error rate by source                                         │
│                                                                   │
│  Anti-Cheat:                                                     │
│  ├─ Unusual earning patterns                                     │
│  ├─ Cap bypass attempts                                          │
│  ├─ Rapid transaction volume                                     │
│  └─ Suspicious metadata                                          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Architecture Principles

1. **Centralization**: All earning goes through vault service
2. **Auditability**: Every transaction logged with metadata
3. **Non-Blocking**: Earning failures never block main actions
4. **Cap Enforcement**: Server-side daily limits enforced
5. **Type Safety**: TypeScript throughout
6. **Optimistic UI**: Instant feedback for users
7. **Error Resilience**: Graceful degradation on failures
8. **Performance**: Batch processing, caching, indexing
9. **Security**: Authentication required, metadata validation
10. **Scalability**: Batch cron jobs, efficient queries

---

**Last Updated:** 2025-11-09
**Version:** 1.0 (Phase 2 Complete)
