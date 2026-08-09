# Plan 123: Daily Login Streak UTC Calendar Boundary & Store Perk Aggregation Fix

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 1775c087..HEAD -- src/lib/vault-service.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `1775c087`, 2026-08-09

## Why this matters

The daily login streak calculation in `updateLoginStreak` calculates day differences using raw millisecond subtraction (`(now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)`). This creates subtle bugs: logging in 23 hours apart across UTC midnight yields `daysDiff = 0` (streak fails to increment), while logging in 47 hours apart across UTC midnight yields `daysDiff = 1` (a missed day goes undetected). Additionally, `getPurchasedItemsEffects` scans full historical transactions in memory causing O(N) overhead.

## Current state

- `src/lib/vault-service.ts:767-779`:
  ```typescript
  if (lastLogin) {
    const daysDiff = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff === 1) {
      newStreak = vault.loginStreak + 1;
    } else if (daysDiff > 1) {
      newStreak = 1;
    } else {
      newStreak = vault.loginStreak;
    }
  }
  ```
- `src/lib/vault-service.ts:1058-1118`: iterates through all `SPEND_COSMETIC` / `SPEND_BOOST` transactions in JavaScript memory to parse JSON metadata.

Exemplar unit test: [src/lib/__tests__/vault-service.test.ts](file:///home/jxsig/projects/ixstats/src/lib/__tests__/vault-service.test.ts).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck Server | `bun run typecheck:server` | exit 0, no errors |
| Single Test | `bun run test -- src/lib/__tests__/vault-service.test.ts` | all pass |

## Scope

**In scope**:
- `src/lib/vault-service.ts`
- `src/lib/__tests__/vault-service.test.ts`

**Out of scope**:
- `prisma/schema/cards.prisma`
- Frontend UI components

## Git workflow

- Branch: `v2`
- Commit message: `fix(vault): calculate daily streak using UTC calendar dates and optimize store perk lookup`

## Steps

### Step 1: Replace Millisecond Date Math with Explicit UTC Calendar Day Comparison
In `src/lib/vault-service.ts` inside `updateLoginStreak()`:
1. Implement standard UTC calendar date normalization:
   ```typescript
   function getUTCDaySerialNumber(date: Date): number {
     return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / (1000 * 60 * 60 * 24));
   }
   ```
2. Calculate day difference:
   ```typescript
   const lastLoginDay = getUTCDaySerialNumber(lastLogin);
   const currentDay = getUTCDaySerialNumber(now);
   const daysDiff = currentDay - lastLoginDay;

   if (daysDiff === 1) {
     newStreak = vault.loginStreak + 1;
   } else if (daysDiff > 1) {
     newStreak = 1;
   } else {
     newStreak = vault.loginStreak;
   }
   ```

**Verify**: `bun run test -- src/lib/__tests__/vault-service.test.ts` → Passes.

### Step 2: Optimize `getPurchasedItemsEffects` Store Perk Querying
In `src/lib/vault-service.ts` inside `getPurchasedItemsEffects()`:
1. Limit transaction queries to the most recent 100 purchase records or check active cosmetics in `equippedCosmetics`.
2. Add caching using `Cache` utility for user item effects with a 5-minute TTL (`USER_PERKS_CACHE_KEY`).

**Verify**: `bun run typecheck:server` → Exits 0 with no errors.

### Step 3: Add UTC Calendar Streak Test Cases
In `src/lib/__tests__/vault-service.test.ts`:
- Add test case for login at 23:55 UTC on Day 1 and 00:05 UTC on Day 2 (10 minutes apart, calendar diff = 1 day -> streak increments to 2).
- Add test case for login at 00:01 UTC on Day 1 and 23:59 UTC on Day 2 (47.9 hours apart, calendar diff = 1 day -> streak increments to 2).
- Add test case for login on Day 1 and Day 3 (calendar diff = 2 days -> streak resets to 1).

**Verify**: `bun run test -- src/lib/__tests__/vault-service.test.ts` → All test cases pass cleanly.

## Test plan

- Run `bun run test -- src/lib/__tests__/vault-service.test.ts`.

## Done criteria

- [ ] Streak calculation uses exact UTC calendar day serial numbers.
- [ ] Logins on consecutive calendar days increment streak regardless of hour offset.
- [ ] All new streak test cases pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- If existing tests fail due to timezone assumptions in mock dates, update test helper to initialize dates using `Date.UTC(...)`.

## Maintenance notes

- Any daily reset logic across the platform should align with UTC midnight boundaries.
