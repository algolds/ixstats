# Plan 122: Atomic Credit Ledger & High-Concurrency Auction Lock Safety

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 1775c087..HEAD -- src/lib/vault-service.ts src/lib/auction-service.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/121-vault-card-type-safety-domain-branding.md
- **Category**: security
- **Planned at**: commit `1775c087`, 2026-08-09

## Why this matters

`vaultService.spendCredits` checks user balance via `getOrCreateVault` before calling `db.myVault.update({ data: { credits: { decrement: amount } } })`. However, the read-then-update sequence is not protected by an atomic conditional query (`credits >= amount`). Under high concurrency (e.g., rapid double-clicks on auction buyout or parallel API bids), multiple requests pass the balance check before any update executes, resulting in negative IxCredits balances and financial transaction duplication.

## Current state

- `src/lib/vault-service.ts:316-335`:
  ```typescript
  // Check sufficient balance
  if (vault.credits < amount) {
    return { success: false, newBalance: vault.credits, message: ... };
  }
  // Update vault and create transaction
  const result = await db.$transaction(async (tx) => {
    const updatedVault = await tx.myVault.update({
      where: { id: vault.id },
      data: { credits: { decrement: amount }, lifetimeSpent: { increment: amount } },
    });
    ...
  });
  ```
- `src/lib/auction-service.ts:331-365` executes bid reservation and outbid refunds without atomic conditional updates on credit balances.

Exemplar unit test for vault operations: [src/lib/__tests__/vault-service.test.ts](file:///home/jxsig/projects/ixstats/src/lib/__tests__/vault-service.test.ts).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck Server | `bun run typecheck:server` | exit 0, no errors |
| Single Test | `bun run test -- src/lib/__tests__/vault-service.test.ts` | all pass |
| Concurrent Test | `bun run test -- src/lib/__tests__/vault-concurrency.test.ts` | all pass |

## Scope

**In scope**:
- `src/lib/vault-service.ts`
- `src/lib/auction-service.ts`
- `src/lib/__tests__/vault-concurrency.test.ts` (new integration test)

**Out of scope**:
- `prisma/schema/cards.prisma`
- Frontend UI components

## Git workflow

- Branch: `v2`
- Commit message: `fix(vault): enforce atomic conditional updates for spendCredits and auction bid credit reservation`

## Steps

### Step 1: Implement Atomic Conditional Balance Decrements in `vault-service.ts`
In `src/lib/vault-service.ts` inside `spendCredits()`:
1. Replace `db.myVault.update` with `db.myVault.updateMany`:
   ```typescript
   const updateCount = await tx.myVault.updateMany({
     where: {
       id: vault.id,
       credits: { gte: amount }, // Strict atomic condition
     },
     data: {
       credits: { decrement: amount },
       lifetimeSpent: { increment: amount },
     },
   });

   if (updateCount.count === 0) {
     throw new Error("INSUFFICIENT_CREDITS_RACE_CONDITION");
   }

   const updatedVault = await tx.myVault.findUniqueOrThrow({
     where: { id: vault.id },
   });
   ```
2. Catch `"INSUFFICIENT_CREDITS_RACE_CONDITION"` and return `{ success: false, newBalance: vault.credits, message: "Insufficient credits for transaction." }`.

**Verify**: `bun run test -- src/lib/__tests__/vault-service.test.ts` → Passes.

### Step 2: Atomic Credit Reservation & Outbid Refund Locks in `auction-service.ts`
In `src/lib/auction-service.ts` inside `placeBid()` and `executeBuyout()`:
1. Ensure `spendCredits` and outbid refunds execute inside a strict `$transaction`.
2. Check that if `spendCredits` fails (due to atomic race condition guard), the bid transaction rolls back completely without leaving partial bid records or orphaned refunds.

**Verify**: `bun run typecheck:server` → Exits 0 with no errors.

### Step 3: Write Concurrency Stress Test
Create `src/lib/__tests__/vault-concurrency.test.ts`:
- Simulate 10 parallel `spendCredits` calls requesting 50 IxC each when user balance is 100 IxC.
- Assert exactly 2 calls succeed, 8 calls fail gracefully, and final balance is exactly 0 (never negative).

**Verify**: `bun run test -- src/lib/__tests__/vault-concurrency.test.ts` → All 10 parallel calls resolved cleanly without negative balance.

## Test plan

- Run `bun run test -- src/lib/__tests__/vault-service.test.ts`.
- Run `bun run test -- src/lib/__tests__/vault-concurrency.test.ts`.

## Done criteria

- [ ] Atomic conditional condition (`credits: { gte: amount }`) applied to all credit spending functions.
- [ ] Balance can never become negative under concurrent requests.
- [ ] New concurrency test `src/lib/__tests__/vault-concurrency.test.ts` passes.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- If Prisma version does not support `updateMany` inside `$transaction`, stop and report.

## Maintenance notes

- Any new credit expenditure feature added in future must route through `vaultService.spendCredits` to inherit atomic condition protections.
