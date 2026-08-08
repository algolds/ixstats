# 7-Part Advanced Array Masterclass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Level 3 (`src/app/labs/sandbox/challenges/level3_arrays.ts`) into a 7-part **Array Masterclass Suite** (`.filter`, `.map`, `.find`, `sum`, `.sort`, `.some`/`.every`, grouping) with live interactive UI cards in `/labs/sandbox`.

**Architecture:** Next.js Client Component UI with TypeScript challenge file exports.

---

### Task 1: Add Advanced Array Challenges to Level 3 File & UI

**Files:**
- Modify: `src/app/labs/sandbox/challenges/level3_arrays.ts`
- Modify: `src/app/labs/sandbox/page.tsx`

- [ ] **Step 1: Update `src/app/labs/sandbox/challenges/level3_arrays.ts`**
Add exported functions for `sortNationsByGdp`, `checkAllianceSecurity`, and `groupNationsByAlliance` with JSDoc hints.

- [ ] **Step 2: Update Level 3 UI Canvas in `src/app/labs/sandbox/page.tsx`**
Add test status badges, interactive sort direction controls (`asc`/`desc`), alliance security alert boxes, and grouped alliance cards in the Level 3 tab.

- [ ] **Step 3: Commit and verify compilation**
Run `bun run typecheck:ui` to verify type safety and push to GitHub.
