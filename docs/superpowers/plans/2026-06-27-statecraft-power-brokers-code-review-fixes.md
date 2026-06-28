# Statecraft Power Brokers Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct spelling of the Technocrats' spend category from "Science&Tech" to "Science and Technology", expand the test suite to cover the fallback unlock for "The Generals", and add `budgetYear` filtering to four `budgetAllocation` Prisma queries.

**Architecture:**
1. Modify `src/lib/statecraft-power-brokers.ts` to change the category string.
2. Modify `src/tests/statecraft-power-brokers.test.ts` to update the mock data and add a new test case for "The Generals" fallback unlock.
3. Update `budgetAllocation` queries in four files to filter by current budget year (`budgetYear: new Date().getFullYear()`).

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, tRPC 11, Prisma 6, Jest 30.

## Global Constraints
* Active branch: `v2`
* Package manager: `bun` (never npm/yarn/pnpm)
* Enforce ≤700 lines per component or class file
* No placeholders (show exact code details)

---

### Task 1: Category Correction and Test Expansion

**Files:**
- Modify: `src/lib/statecraft-power-brokers.ts`
- Modify: `src/tests/statecraft-power-brokers.test.ts`

- [ ] **Step 1: Correct category string in library**
  Update `"Science&Tech"` to `"Science and Technology"` in `src/lib/statecraft-power-brokers.ts`.

- [ ] **Step 2: Correct mock and add fallback test in test file**
  Update tests in `src/tests/statecraft-power-brokers.test.ts` to use the correct category name and add a new test case verifying "The Generals" fallback unlock logic.

- [ ] **Step 3: Run the test suite**
  Run: `bun run test -- src/tests/statecraft-power-brokers.test.ts`
  Expected: PASS

---

### Task 2: Budget Year Filtering in DB Queries

**Files:**
- Modify: `src/lib/government-component-effects.ts`
- Modify: `src/lib/politics-drift-cron.ts`
- Modify: `src/server/api/routers/elections/brokers.ts`
- Modify: `src/server/api/routers/national-issues/player.ts`

- [ ] **Step 1: Add budgetYear filter to `src/lib/government-component-effects.ts`**
  Modify the `db.budgetAllocation.findMany` query to include `budgetYear: new Date().getFullYear()`.

- [ ] **Step 2: Add budgetYear filter to `src/lib/politics-drift-cron.ts`**
  Modify the `db.budgetAllocation.findMany` query to include `budgetYear: new Date().getFullYear()`.

- [ ] **Step 3: Add budgetYear filter to `src/server/api/routers/elections/brokers.ts`**
  Modify the `ctx.db.budgetAllocation.findMany` query to include `budgetYear: new Date().getFullYear()`.

- [ ] **Step 4: Add budgetYear filter to `src/server/api/routers/national-issues/player.ts`**
  Modify the `db.budgetAllocation.findMany` query to include `budgetYear: new Date().getFullYear()`.

---

### Task 3: Final Verification & Commit

- [ ] **Step 1: Run whole test suite to ensure no regressions**
  Run: `bun run test -- src/tests/statecraft-power-brokers.test.ts`
  Expected: PASS

- [ ] **Step 2: Commit the changes**
  Branch: `v2`
  Message: `fix(statecraft): correct technocrats category spelling, add budgetYear filtering, and expand tests`
