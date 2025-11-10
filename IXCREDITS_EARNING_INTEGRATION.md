# IxCredits Earning Integration - Implementation Summary

## Overview

This document summarizes the Phase 2 implementation of IxCredits earning integration across all IxStats systems. All earning operations use the centralized `vaultService` from Phase 1 to ensure proper transaction logging, daily cap enforcement, and audit trails.

## Files Created

### Hooks (`/src/hooks/vault/`)

1. **`useVaultBalance.ts`** - Real-time balance fetching
   - Auto-refresh every 30 seconds
   - Refetch on window focus
   - Returns balance, lifetime stats, vault level, and XP

2. **`useEarnCredits.ts`** - Generic earning mutation
   - Optimistic updates with rollback on error
   - Toast notifications for success/error
   - Automatic balance invalidation

3. **`useDailyBonus.ts`** - Daily bonus claim
   - 24-hour cooldown enforcement
   - Login streak tracking
   - Toast notifications

4. **`index.ts`** - Barrel exports for clean imports

### Components

5. **`/src/components/mycountry/VaultWidget.tsx`** - MyCountry overview widget
   - Real-time balance display
   - Today's earnings breakdown
   - Vault level progress bar
   - Quick action buttons

### Backend

6. **`/src/lib/passive-income-cron.ts`** - Daily passive income distribution
   - Batch processing (100 countries at a time)
   - GDP-based dividend calculation
   - Error handling and logging
   - Test mode function included

## Files Modified

### API Routers

1. **`/src/server/api/routers/vault.ts`**
   - Added `getTodayEarnings` endpoint
   - Returns earnings breakdown by source with formatted labels

2. **`/src/server/api/routers/diplomatic.ts`**
   - Added `vaultService` import
   - Integrated earning into `completeMission` mutation
   - Awards 3-15 IxC based on difficulty (easy=3, medium=5, hard=10, extreme=15)
   - Returns `credits` in rewards object
   - Error handling doesn't block mission completion

3. **`/src/server/api/routers/crisis-events.ts`**
   - Added `vaultService` import
   - Integrated earning into `updateResponseStatus` mutation
   - Awards 5 IxC when transitioning from pending to in_progress
   - Returns `creditsEarned` in response
   - Error handling doesn't block crisis response

4. **`/src/server/api/routers/achievements.ts`**
   - Added `vaultService` import
   - Integrated earning into `unlock` mutation
   - Awards based on rarity (Common=10, Uncommon=15, Rare=25, Epic=50, Legendary=100)
   - Returns `creditsEarned` in response
   - Error handling doesn't block achievement unlock

5. **`/src/server/api/routers/thinkpages.ts`**
   - Added `vaultService` import
   - Integrated earning into `createPost` mutation
   - Awards 1 IxC per post, max 5 posts/day
   - Checks daily post count before awarding
   - Returns `creditsEarned` in response
   - Error handling doesn't block post creation

## Earning Sources & Rewards

### Diplomacy System
| Action | Reward | Daily Cap | Notes |
|--------|--------|-----------|-------|
| Complete Easy Mission | 3 IxC | No cap | Difficulty-based rewards |
| Complete Medium Mission | 5 IxC | No cap | |
| Complete Hard Mission | 10 IxC | No cap | |
| Complete Extreme Mission | 15 IxC | No cap | |
| Crisis Response | 5 IxC | No cap | Only on pending → in_progress transition |

### Achievement System
| Rarity | Reward | Daily Cap | Notes |
|--------|--------|-----------|-------|
| Common | 10 IxC | No cap | Achievement-based rewards |
| Uncommon | 15 IxC | No cap | |
| Rare | 25 IxC | No cap | |
| Epic | 50 IxC | No cap | |
| Legendary | 100 IxC | No cap | |

### Social Platform (ThinkPages)
| Action | Reward | Daily Cap | Notes |
|--------|--------|-----------|-------|
| Create Post | 1 IxC | 5 posts/day (5 IxC) | Server-side count check |
| Create Reply | 1 IxC | 5 posts/day (5 IxC) | Replies count as posts |

### Passive Income
| Source | Formula | Schedule | Notes |
|--------|---------|----------|-------|
| Daily Dividend | (GDP Per Capita / 10000) × Tier Multiplier + Population Bonus + Growth Bonus | Once daily | See vault-service.ts for full formula |

**Tier Multipliers:**
- Tier 1: 3.0x
- Tier 2: 2.0x
- Tier 3: 1.5x
- Tier 4: 1.0x

**Bonuses:**
- Population: +0.01 IxC per 1M citizens
- Growth: +10% if GDP growth > 3% this quarter

### Daily Login
| Action | Reward | Daily Cap | Notes |
|--------|--------|-----------|-------|
| Daily Bonus | 1-7 IxC | Once/day | Streak-based (1 IxC day 1, scaling to 7 IxC day 7+) |

## Daily Earning Caps

The vault service enforces two types of daily caps:

1. **EARN_ACTIVE**: 100 IxC/day
   - Missions (no cap, but limited by availability)
   - Crisis responses (no cap, but limited by availability)
   - Achievements (no cap, but limited by availability)
   - Daily login bonus (max 7 IxC/day)

2. **EARN_SOCIAL**: 50 IxC/day
   - Social posts: 1 IxC × 5 posts = 5 IxC/day
   - Replies: 1 IxC × 5 replies = 5 IxC/day

3. **EARN_PASSIVE**: No cap (calculated once daily)

## Transaction Types

All earning operations use one of these transaction types:
- `EARN_PASSIVE` - Passive income from nation performance
- `EARN_ACTIVE` - Active gameplay (missions, achievements, daily bonus)
- `EARN_SOCIAL` - Social engagement (posts, replies)
- `EARN_CARDS` - Card-related activities (future integration)

## Error Handling Strategy

All earning integrations follow this pattern:

```typescript
let creditsEarned = 0;
try {
  const earnResult = await vaultService.earnCredits(...);
  if (earnResult.success) {
    creditsEarned = creditAmount;
  }
} catch (error) {
  // Don't block main action if earning fails
  console.error("[System] Failed to award credits:", error);
}
```

**Key principles:**
- Never block the main action (mission completion, achievement unlock, etc.)
- Always try/catch earning logic
- Log errors for monitoring
- Return 0 credits on failure (graceful degradation)

## Usage Examples

### Using Hooks

```typescript
// In a React component
import { useVaultBalance, useEarnCredits, useDailyBonus } from '~/hooks/vault';

function MyComponent() {
  const { balance, todayEarned, isLoading } = useVaultBalance();
  const { earn, isEarning } = useEarnCredits();
  const { claim, isClaiming } = useDailyBonus();

  // Earn credits
  earn({
    amount: 10,
    type: 'EARN_ACTIVE',
    source: 'CUSTOM_ACTION',
    metadata: { customField: 'value' },
    onSuccess: (newBalance) => console.log('New balance:', newBalance),
  });

  // Claim daily bonus
  claim();
}
```

### Using VaultService Directly (Server-side)

```typescript
import { vaultService } from '~/lib/vault-service';

// Award credits
const result = await vaultService.earnCredits(
  userId,
  amount,
  'EARN_ACTIVE',
  'CUSTOM_SOURCE',
  db,
  { metadata: 'value' }
);

if (result.success) {
  console.log('New balance:', result.newBalance);
} else {
  console.error('Error:', result.message);
}
```

## Integration Checklist

When integrating IxCredits earning into a new system:

- [ ] Import `vaultService` from `~/lib/vault-service`
- [ ] Determine appropriate transaction type (`EARN_ACTIVE`, `EARN_SOCIAL`, `EARN_PASSIVE`)
- [ ] Wrap earning logic in try/catch
- [ ] Don't block main action on earning failure
- [ ] Include descriptive metadata for audit trail
- [ ] Return credits earned in response (optional but recommended)
- [ ] Add appropriate logging
- [ ] Test daily cap enforcement if applicable
- [ ] Verify transaction appears in vault history

## Testing

### Manual Testing

1. **Test Mission Completion Earning:**
   - Complete a mission via diplomatic system
   - Verify credits awarded based on difficulty
   - Check vault transaction history

2. **Test Achievement Earning:**
   - Unlock an achievement
   - Verify credits awarded based on rarity
   - Check vault transaction history

3. **Test Social Post Earning:**
   - Create 6 posts in one day
   - Verify only first 5 award credits
   - Check daily cap enforcement

4. **Test Daily Bonus:**
   - Claim daily bonus
   - Verify cooldown enforcement (can't claim twice)
   - Check streak tracking

5. **Test Passive Income (Dry Run):**
   ```bash
   # In server console
   node -e "require('./src/lib/passive-income-cron').testPassiveIncomeDistribution()"
   ```

### Monitoring

Check these logs for earning activity:
- `[Vault Service]` - All earning operations
- `[Diplomatic]` - Mission completion credits
- `[Crisis Events]` - Crisis response credits
- `[Achievements]` - Achievement unlock credits
- `[ThinkPages]` - Social post credits
- `[CRON]` - Passive income distribution

## Future Enhancements

1. **Premium Multipliers** - Apply multiplier to earnings (already stubbed in vault-service)
2. **Card Exchange Missions** - Add diplomatic card exchange missions with 8 IxC reward
3. **Comment Earning** - Add separate comment earning (0.5 IxC, max 3/day)
4. **Bonus Events** - Double earning events for limited time
5. **Earning Streaks** - Bonus for consecutive days of earning
6. **Leaderboards** - Top earners by category

## Deployment Notes

1. **Database Migrations** - No new migrations needed (uses existing VaultTransaction model)
2. **Environment Variables** - No new variables needed
3. **Cron Setup** - Schedule `distributePassiveIncome()` to run daily at midnight UTC
4. **Rate Limiting** - Earning endpoints use existing rate limiter from vault router
5. **Monitoring** - Set up alerts for unusual earning patterns (anti-cheat)

## Coordination Notes

- All hooks use existing tRPC endpoints from vault router
- VaultWidget should be added to MyCountry overview page sidebar
- Passive income cron should be integrated with existing job scheduler
- All earning operations are non-blocking (fail gracefully)
- Transaction metadata enables detailed audit trails

## Support & Documentation

- **Vault Service**: `/src/lib/vault-service.ts`
- **Vault Router**: `/src/server/api/routers/vault.ts`
- **Phase 1 Docs**: See IxCards Phase 1 documentation
- **Database Schema**: `MyVault` and `VaultTransaction` models in Prisma schema

---

**Implementation Status:** ✅ Complete (Phase 2)
**Last Updated:** 2025-11-09
**Implemented by:** Agent 5 (IxCredits Earning Integration)
