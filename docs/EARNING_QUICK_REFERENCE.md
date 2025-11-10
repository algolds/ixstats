# IxCredits Earning - Quick Reference Guide

**For Developers:** This guide provides quick copy-paste examples for integrating IxCredits earning into new features.

## Table of Contents
1. [Client-Side Usage (React Hooks)](#client-side-usage-react-hooks)
2. [Server-Side Usage (tRPC Routers)](#server-side-usage-trpc-routers)
3. [Common Patterns](#common-patterns)
4. [Transaction Types](#transaction-types)
5. [Troubleshooting](#troubleshooting)

---

## Client-Side Usage (React Hooks)

### Import the Hooks

```typescript
import { useVaultBalance, useEarnCredits, useDailyBonus } from '~/hooks/vault';
```

### Display Balance

```typescript
function BalanceDisplay() {
  const { balance, todayEarned, vaultLevel, isLoading } = useVaultBalance();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <p>Balance: {balance.toLocaleString()} IxC</p>
      <p>Today: +{todayEarned} IxC</p>
      <p>Level: {vaultLevel}</p>
    </div>
  );
}
```

### Award Credits (Custom Actions)

```typescript
function CustomAction() {
  const { earn, isEarning } = useEarnCredits();

  const handleAction = async () => {
    earn({
      amount: 5,
      type: 'EARN_ACTIVE',
      source: 'CUSTOM_ACTION',
      metadata: { actionId: '123', actionType: 'quest_complete' },
      onSuccess: (newBalance) => {
        console.log('New balance:', newBalance);
      },
      onError: (error) => {
        console.error('Failed:', error);
      },
    });
  };

  return (
    <button onClick={handleAction} disabled={isEarning}>
      {isEarning ? 'Processing...' : 'Complete Action (+5 IxC)'}
    </button>
  );
}
```

### Claim Daily Bonus

```typescript
function DailyBonusButton() {
  const { claim, isClaiming } = useDailyBonus();

  return (
    <button onClick={claim} disabled={isClaiming}>
      {isClaiming ? 'Claiming...' : 'Claim Daily Bonus'}
    </button>
  );
}
```

---

## Server-Side Usage (tRPC Routers)

### Import Vault Service

```typescript
import { vaultService } from "~/lib/vault-service";
```

### Basic Earning Integration

```typescript
// In your mutation
.mutation(async ({ ctx, input }) => {
  // Your main action logic here
  const result = await doSomething(input);

  // Award credits (non-blocking)
  let creditsEarned = 0;
  if (ctx.auth?.userId) {
    try {
      const earnResult = await vaultService.earnCredits(
        ctx.auth.userId,
        10, // Amount
        "EARN_ACTIVE", // Type
        "YOUR_SOURCE_NAME", // Source
        ctx.db,
        {
          // Optional metadata for audit trail
          actionId: input.id,
          actionType: "custom",
        }
      );

      if (earnResult.success) {
        creditsEarned = 10;
      }
    } catch (error) {
      // Don't block main action if earning fails
      console.error("[YourRouter] Failed to award credits:", error);
    }
  }

  return {
    ...result,
    creditsEarned, // Optional: include in response
  };
})
```

### With Daily Cap Check

```typescript
.mutation(async ({ ctx, input }) => {
  // Your main action logic
  const result = await doSomething(input);

  // Award credits with daily limit
  let creditsEarned = 0;
  if (ctx.auth?.userId) {
    try {
      // Check daily count first
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const actionsToday = await ctx.db.yourTable.count({
        where: {
          userId: ctx.auth.userId,
          createdAt: { gte: today },
        },
      });

      // Only award for first X actions per day
      if (actionsToday <= 5) {
        const earnResult = await vaultService.earnCredits(
          ctx.auth.userId,
          1,
          "EARN_SOCIAL",
          "YOUR_ACTION",
          ctx.db,
          { actionId: result.id }
        );

        if (earnResult.success) {
          creditsEarned = 1;
        }
      }
    } catch (error) {
      console.error("[YourRouter] Failed to award credits:", error);
    }
  }

  return {
    ...result,
    creditsEarned,
  };
})
```

### Difficulty-Based Rewards

```typescript
.mutation(async ({ ctx, input }) => {
  // Your action with difficulty
  const result = await doAction(input);

  let creditsEarned = 0;
  if (ctx.auth?.userId && result.success) {
    try {
      // Map difficulty to reward
      const difficultyRewards: Record<string, number> = {
        easy: 3,
        medium: 5,
        hard: 10,
        expert: 15,
      };

      const reward = difficultyRewards[result.difficulty] || 5;

      const earnResult = await vaultService.earnCredits(
        ctx.auth.userId,
        reward,
        "EARN_ACTIVE",
        "DIFFICULTY_ACTION",
        ctx.db,
        {
          actionId: result.id,
          difficulty: result.difficulty,
        }
      );

      if (earnResult.success) {
        creditsEarned = reward;
      }
    } catch (error) {
      console.error("[YourRouter] Failed to award credits:", error);
    }
  }

  return {
    ...result,
    creditsEarned,
  };
})
```

---

## Common Patterns

### Pattern 1: Simple Reward (No Conditions)

```typescript
// Award credits for any successful action
let creditsEarned = 0;
if (ctx.auth?.userId && actionSuccessful) {
  try {
    const earnResult = await vaultService.earnCredits(
      ctx.auth.userId,
      amount,
      "EARN_ACTIVE",
      "ACTION_NAME",
      ctx.db,
      { actionId: id }
    );
    if (earnResult.success) creditsEarned = amount;
  } catch (error) {
    console.error("[Router] Earning error:", error);
  }
}
```

### Pattern 2: Daily Cap Enforcement

```typescript
// Award only if under daily limit
const today = new Date();
today.setHours(0, 0, 0, 0);

const countToday = await ctx.db.table.count({
  where: { userId: ctx.auth.userId, createdAt: { gte: today } },
});

if (countToday <= MAX_PER_DAY) {
  // Award credits...
}
```

### Pattern 3: Conditional Reward

```typescript
// Award only if specific conditions met
let creditsEarned = 0;
if (ctx.auth?.userId && meetsCriteria) {
  try {
    const earnResult = await vaultService.earnCredits(
      ctx.auth.userId,
      amount,
      "EARN_ACTIVE",
      "CONDITIONAL_ACTION",
      ctx.db,
      { condition: criteriaValue }
    );
    if (earnResult.success) creditsEarned = amount;
  } catch (error) {
    console.error("[Router] Earning error:", error);
  }
}
```

### Pattern 4: State Transition Reward

```typescript
// Award only when transitioning between specific states
let creditsEarned = 0;
if (
  ctx.auth?.userId &&
  previousState === "pending" &&
  newState === "completed"
) {
  try {
    const earnResult = await vaultService.earnCredits(
      ctx.auth.userId,
      5,
      "EARN_ACTIVE",
      "STATE_TRANSITION",
      ctx.db,
      {
        from: previousState,
        to: newState,
        entityId: id,
      }
    );
    if (earnResult.success) creditsEarned = 5;
  } catch (error) {
    console.error("[Router] Earning error:", error);
  }
}
```

---

## Transaction Types

Use the correct transaction type for your earning source:

| Type | Use Case | Daily Cap |
|------|----------|-----------|
| `EARN_PASSIVE` | Passive income, dividends | No cap |
| `EARN_ACTIVE` | Missions, achievements, gameplay | 100 IxC/day |
| `EARN_SOCIAL` | Posts, replies, social activities | 50 IxC/day |
| `EARN_CARDS` | Card-related activities | TBD |

**Example:**
```typescript
// Gameplay action
"EARN_ACTIVE"

// Social post
"EARN_SOCIAL"

// Daily dividend
"EARN_PASSIVE"
```

---

## Troubleshooting

### Credits Not Appearing in UI

**Check:**
1. Is the earning mutation successful? (check server logs)
2. Is the cache being invalidated? (check `utils.vault.getBalance.invalidate()`)
3. Is the user authenticated? (`ctx.auth?.userId` present)

**Fix:**
```typescript
// Ensure proper cache invalidation
onSettled: () => {
  void utils.vault.getBalance.invalidate();
  void utils.vault.getTodayEarnings.invalidate();
}
```

### Daily Cap Not Working

**Check:**
1. Are you using the correct transaction type? (`EARN_ACTIVE` or `EARN_SOCIAL`)
2. Is vault service checking caps? (it should automatically)
3. Are you checking count server-side before calling earnCredits?

**Fix:**
```typescript
// Server-side cap check before awarding
const today = new Date();
today.setHours(0, 0, 0, 0);

const actionsToday = await ctx.db.yourTable.count({
  where: {
    userId: ctx.auth.userId,
    createdAt: { gte: today },
  },
});

if (actionsToday <= MAX_DAILY) {
  // Award credits
}
```

### Earning Blocking Main Action

**Check:**
1. Is earning wrapped in try/catch?
2. Is earning logic non-blocking?

**Fix:**
```typescript
// ✅ CORRECT: Non-blocking
let creditsEarned = 0;
try {
  const earnResult = await vaultService.earnCredits(...);
  if (earnResult.success) creditsEarned = amount;
} catch (error) {
  console.error("Earning failed:", error);
  // Don't throw - continue with main action
}

// ❌ WRONG: Blocking
const earnResult = await vaultService.earnCredits(...);
if (!earnResult.success) {
  throw new Error("Failed to earn"); // DON'T DO THIS
}
```

### Transactions Not Logged

**Check:**
1. Are you using `vaultService.earnCredits()` (not direct DB writes)?
2. Is the transaction type valid?
3. Is the user ID correct?

**Fix:**
```typescript
// ✅ CORRECT: Use vault service
await vaultService.earnCredits(
  ctx.auth.userId,
  amount,
  "EARN_ACTIVE",
  "SOURCE_NAME",
  ctx.db,
  metadata
);

// ❌ WRONG: Direct DB write
await ctx.db.vaultTransaction.create({
  data: { ... }, // DON'T DO THIS
});
```

---

## Best Practices

1. **Always use vault service** - Never create VaultTransaction directly
2. **Non-blocking errors** - Wrap in try/catch, don't throw
3. **Descriptive sources** - Use clear source names (e.g., "MISSION_COMPLETE")
4. **Include metadata** - Add context for audit trail
5. **Check authentication** - Always verify `ctx.auth?.userId`
6. **Log failures** - Console.error for debugging
7. **Return credits earned** - Include in response for UI feedback

---

## Testing Your Integration

### Manual Test Checklist

1. [ ] Perform action → Credits awarded
2. [ ] Check vault balance → Updated correctly
3. [ ] View transaction history → Transaction logged
4. [ ] Perform action without auth → No credits (no error)
5. [ ] Trigger daily cap → Earning stops at limit
6. [ ] Check metadata → Correct context saved
7. [ ] Trigger error scenario → Main action still completes

### Code Review Checklist

1. [ ] Uses `vaultService.earnCredits()`
2. [ ] Wrapped in try/catch
3. [ ] Doesn't block main action on error
4. [ ] Correct transaction type
5. [ ] Includes descriptive metadata
6. [ ] Checks `ctx.auth?.userId`
7. [ ] Logs errors to console
8. [ ] Returns creditsEarned (optional)

---

## Support

For questions or issues:
- Check `src/lib/vault-service.ts` for full API
- Review existing integrations in routers
- See `IXCREDITS_EARNING_INTEGRATION.md` for detailed guide
- Check transaction logs in database for debugging

**Common Error Messages:**
- "User ID not found" → Authentication missing
- "Daily earning cap reached" → User hit limit for transaction type
- "Failed to access vault" → Database error, check logs
- "Amount must be positive" → Invalid amount parameter
