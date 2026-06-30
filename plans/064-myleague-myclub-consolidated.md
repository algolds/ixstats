# Plan 064: Consolidated MyLeague & MyClub Sports Subsystems Improvements

This plan details the technical changes required to resolve all security vulnerabilities, financial correctness issues, and performance bottlenecks identified in the MyLeague and MyClub subsystems audit.

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> Verify status of in-scope files before executing.

## Status

- **Priority**: HIGH
- **Effort**: M
- **Risk**: MED (requires transfer refactoring inside transactions)
- **Depends on**: none
- **Category**: security / correctness / perf
- **Planned at**: commit `v2`, 2026-06-30

## Why this matters

The MyLeague/MyClub subsystems have security exposure (potential LLM apiKey exfiltration, SSRF, missing endpoint gates) and economic bugs (free team claims/training due to unchecked `spend` mutations). This plan fixes all structural holes in one focused path.

## Proposed Changes

### Step 1: Secure LLM Commentary and Prevent SSRF

In [narrator.ts](file:///home/jxsig/projects/ixstats/src/lib/sports/commentary/narrator.ts), update `queryLLM`:
```typescript
  // Prevent SSRF and API key exfiltration
  if (config?.apiUrl) {
    if (!config?.apiKey) {
      console.warn("[sports-narrator] Custom API URL provided without matching API key.");
      return "";
    }
    try {
      const parsedUrl = new URL(config.apiUrl);
      const allowedDomains = ["integrate.api.nvidia.com", "openrouter.ai", "api.openai.com"];
      if (!allowedDomains.includes(parsedUrl.hostname)) {
        console.warn(`[sports-narrator] Custom API URL host not allowed: ${parsedUrl.hostname}`);
        return "";
      }
    } catch {
      console.warn("[sports-narrator] Invalid custom API URL.");
      return "";
    }
  }
```

### Step 2: Enforce Authorization Gates in Leagues Router

In [leagues.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/sports/leagues.ts):
- Add checks in `updateLeague` to verify `league.createdByUserId === ctx.user.id || isSystemOwner(ctx.auth.userId)`.
- Strip out client-supplied `isCanonical` unless `isSystemOwner(ctx.auth.userId)` is true.
- Add checks in `deleteLeague` to verify `league.createdByUserId === ctx.user.id || isSystemOwner(ctx.auth.userId)`.
- Add checks in `resetSeason`, `overrideMatchResult`, `transferTeam`, and `regenerateSchedule` to ensure the editing user owns the corresponding resource or is a system owner.

### Step 3: Implement Checks on exchangeService.spend Returns

In [teams.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/sports/teams.ts), [club.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/sports/club.ts), [transfers.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/sports/transfers.ts), and [leagues.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/sports/leagues.ts) (`createLeague`):
- Find all calls to `await exchangeService.spend(...)`.
- Add success checks:
```typescript
const spend = await exchangeService.spend(...);
if (!spend.success) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: spend.message ?? "Insufficient balance",
  });
}
```

### Step 4: Refactor Transfer Bids and Accepts to DB Transactions

In [transfers.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/sports/transfers.ts), refactor `respondToTransferBid` to wrap database updates and financial updates inside a `ctx.db.$transaction(async (tx) => { ... })` block, passing the transaction instance `tx` down to all nested database and `exchangeService` calls.

### Step 5: Optimize getMyClubs N+1 Query Loop

In [teams.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/sports/teams.ts):
- Batch query active seasons, standings, and championships in memory using single database queries.
- Group standings by seasonId in memory and map the rank position, reducing query loops from $3N+1$ to 4.

## Verification Plan

### Automated Tests
- Run existing sports tests: `bun run test -- src/tests/sports`
- Write verification tests inside `integration.test.ts` to assert that claiming teams with zero balance throws a TRPCError.
