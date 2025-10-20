# Achievement System Integration Guide

This guide shows how to integrate achievement auto-unlocking into existing routers.

## Overview

The achievement system automatically checks and unlocks achievements when country data changes. The integration is simple and non-blocking.

## Core Files

- **Definitions**: `/src/lib/achievement-definitions.ts` - 60 pre-defined achievements
- **Service**: `/src/lib/achievement-service.ts` - Auto-unlock logic
- **Seeding**: `/scripts/seed-achievements.ts` - Validation and reference script
- **Router**: `/src/server/api/routers/achievements.ts` - tRPC API endpoints

## How to Integrate

### Step 1: Import the Service

```typescript
import { achievementService } from '~/lib/achievement-service';
```

### Step 2: Add Auto-Unlock After Data Changes

Add the following code after any mutation that changes country data:

```typescript
// Auto-unlock achievements (non-blocking)
if (ctx.auth?.userId && countryId) {
  achievementService
    .checkAndUnlock(ctx.auth.userId, countryId, ctx.db)
    .then((unlocked) => {
      if (unlocked.length > 0) {
        console.log(`[Achievements] Unlocked ${unlocked.length} achievements:`, unlocked);
      }
    })
    .catch((err) => console.error('[Achievements] Auto-unlock failed:', err));
}
```

### Step 3: Return Updated Data

No changes needed to return values - achievements are unlocked asynchronously.

## Integration Points

### Countries Router (`countries.ts`)

**After economic data updates:**

```typescript
updateEconomicData: protectedProcedure
  .input(z.object({
    countryId: z.string(),
    economicData: economicDataSchema,
  }))
  .mutation(async ({ ctx, input }) => {
    // ... existing update logic ...

    const updatedCountry = await ctx.db.country.update({
      where: { id: input.countryId },
      data: input.economicData,
    });

    // 🏆 Auto-unlock economic achievements
    if (ctx.auth?.userId) {
      achievementService
        .checkAndUnlockCategory(ctx.auth.userId, input.countryId, ctx.db, 'Economic')
        .catch((err) => console.error('[Achievements] Auto-unlock failed:', err));
    }

    return updatedCountry;
  })
```

### Diplomatic Router (`diplomatic.ts`)

**After creating embassy:**

```typescript
createEmbassy: protectedProcedure
  .input(embassySchema)
  .mutation(async ({ ctx, input }) => {
    const embassy = await ctx.db.embassy.create({
      data: input,
    });

    // 🏆 Auto-unlock diplomatic achievements
    if (ctx.auth?.userId && input.guestCountryId) {
      achievementService
        .checkAndUnlockCategory(ctx.auth.userId, input.guestCountryId, ctx.db, 'Diplomatic')
        .catch((err) => console.error('[Achievements] Auto-unlock failed:', err));
    }

    return embassy;
  })
```

### Military Router (if exists)

**After creating military branch:**

```typescript
createMilitaryBranch: protectedProcedure
  .input(militaryBranchSchema)
  .mutation(async ({ ctx, input }) => {
    const branch = await ctx.db.militaryBranch.create({
      data: input,
    });

    // 🏆 Auto-unlock military achievements
    if (ctx.auth?.userId && input.countryId) {
      achievementService
        .checkAndUnlockCategory(ctx.auth.userId, input.countryId, ctx.db, 'Military')
        .catch((err) => console.error('[Achievements] Auto-unlock failed:', err));
    }

    return branch;
  })
```

### Government Router (`mycountry.ts` or atomic components)

**After adding atomic component:**

```typescript
addAtomicComponent: protectedProcedure
  .input(componentSchema)
  .mutation(async ({ ctx, input }) => {
    const component = await ctx.db.atomicGovernmentComponent.create({
      data: input,
    });

    // 🏆 Auto-unlock government achievements
    if (ctx.auth?.userId && input.countryId) {
      achievementService
        .checkAndUnlockCategory(ctx.auth.userId, input.countryId, ctx.db, 'Government')
        .catch((err) => console.error('[Achievements] Auto-unlock failed:', err));
    }

    return component;
  })
```

### Social Router (`thinkpages.ts` or equivalent)

**After creating ThinkPage:**

```typescript
createThinkPage: protectedProcedure
  .input(thinkpageSchema)
  .mutation(async ({ ctx, input }) => {
    const page = await ctx.db.thinkpagesPost.create({
      data: input,
    });

    // 🏆 Auto-unlock social achievements
    if (ctx.auth?.userId) {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (user?.countryId) {
        achievementService
          .checkAndUnlockCategory(ctx.auth.userId, user.countryId, ctx.db, 'Social')
          .catch((err) => console.error('[Achievements] Auto-unlock failed:', err));
      }
    }

    return page;
  })
```

### Users Router (`users.ts`)

**After user registration:**

```typescript
registerUser: publicProcedure
  .input(userSchema)
  .mutation(async ({ ctx, input }) => {
    const user = await ctx.db.user.create({
      data: input,
    });

    // 🏆 Auto-unlock "Welcome to IxStats" achievement
    achievementService
      .unlockSpecific(user.clerkUserId, 'gen-welcome', ctx.db)
      .catch((err) => console.error('[Achievements] Welcome achievement failed:', err));

    return user;
  })
```

**After claiming first country:**

```typescript
claimCountry: protectedProcedure
  .input(claimSchema)
  .mutation(async ({ ctx, input }) => {
    const updatedUser = await ctx.db.user.update({
      where: { clerkUserId: ctx.auth.userId },
      data: { countryId: input.countryId },
    });

    // 🏆 Auto-unlock "First Country Claim" achievement
    if (ctx.auth?.userId) {
      achievementService
        .unlockSpecific(ctx.auth.userId, 'gen-first-country', ctx.db)
        .catch((err) => console.error('[Achievements] First country achievement failed:', err));
    }

    return updatedUser;
  })
```

## Performance Considerations

### Non-Blocking Execution

Achievement checks are intentionally **non-blocking** and use `.catch()` instead of `await`:

```typescript
// ✅ Good - Non-blocking
achievementService
  .checkAndUnlock(userId, countryId, db)
  .catch(err => console.error(err));

// ❌ Bad - Blocks mutation response
await achievementService.checkAndUnlock(userId, countryId, db);
```

### Targeted Category Checks

Use `checkAndUnlockCategory()` when you know which category of achievements to check:

```typescript
// Faster - only checks economic achievements
await achievementService.checkAndUnlockCategory(userId, countryId, db, 'Economic');

// Slower - checks all 60 achievements
await achievementService.checkAndUnlock(userId, countryId, db);
```

### Batching

For bulk operations, batch the achievement checks:

```typescript
// ❌ Bad - N database queries
for (const country of countries) {
  await achievementService.checkAndUnlock(userId, country.id, db);
}

// ✅ Good - Single check after all updates
await bulkUpdateCountries(countries);
achievementService.checkAndUnlock(userId, primaryCountryId, db).catch(console.error);
```

## Testing

### Manual Testing

Use the seeding script to verify achievements are defined correctly:

```bash
npx tsx scripts/seed-achievements.ts
```

### Check Achievement Progress

```typescript
const progress = await achievementService.getProgress(userId, db);
console.log(progress);
// {
//   totalUnlocked: 5,
//   totalPoints: 65,
//   byCategory: { Economic: 2, General: 3 },
//   byRarity: { Common: 4, Uncommon: 1 },
//   recentUnlocks: [...]
// }
```

### Manually Unlock Achievement (Testing/Admin)

```typescript
const unlocked = await achievementService.unlockSpecific(
  userId,
  'econ-trillion-club',
  db
);
```

## Achievement Categories

| Category | Count | Integration Point |
|----------|-------|-------------------|
| Economic | 15 | Economic data updates, GDP changes |
| Military | 10 | Military branch creation, budget updates |
| Diplomatic | 10 | Embassy creation, treaty signing, alliances |
| Government | 10 | Atomic component implementation, government type changes |
| Social | 5 | ThinkPage creation, follower growth, trending posts |
| General | 10 | Account creation, country claiming, activity tracking |

## Notification Integration

Achievements automatically trigger notifications via `notification-hooks.ts`:

```typescript
// Already handled in achievements.unlock() endpoint
await notificationHooks.onAchievementUnlock({
  userId: input.userId,
  achievementId: input.achievementId,
  name: input.title,
  description: input.description || '',
  category: input.category || 'General',
  rarity: input.rarity?.toLowerCase() as 'common' | 'rare' | 'epic' | 'legendary',
});
```

## Leaderboard

Achievement leaderboard is automatically populated via the existing `achievements.getLeaderboard` endpoint:

```typescript
const leaderboard = await trpc.achievements.getLeaderboard.query({
  limit: 20,
  category: 'Economic', // Optional filter
});
```

## Summary

1. Import `achievementService` into your router
2. Call `.checkAndUnlock()` or `.checkAndUnlockCategory()` after data mutations
3. Use `.catch()` for error handling (non-blocking)
4. Achievements auto-unlock based on conditions in `achievement-definitions.ts`
5. Users receive notifications automatically
6. Leaderboard updates automatically

**That's it!** The achievement system is fully self-contained and requires minimal integration code.
