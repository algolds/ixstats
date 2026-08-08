# Level 3 Array Masterclass Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Level 3 (`src/app/labs/sandbox/challenges/level3_arrays.ts`) into a 4-part **Array Masterclass Suite** (`.filter()`, `.map()`, `.find()`, total sum aggregation) with live UI cards and hints in `/labs/sandbox`.

**Architecture:** Next.js Client Component UI with TypeScript challenge file exports.

---

### Task 1: Expand Level 3 Challenge File & Sandbox UI

**Files:**
- Modify: `src/app/labs/sandbox/challenges/level3_arrays.ts`
- Modify: `src/app/labs/sandbox/page.tsx`

- [ ] **Step 1: Update `src/app/labs/sandbox/challenges/level3_arrays.ts`**
Add exported functions for `filterAllianceNations`, `formatNationSummaries`, `findNationBySlug`, and `calculateTotalGdp` with helpful comments and hint blocks for Kistan.

- [ ] **Step 2: Update Level 3 UI Canvas in `src/app/labs/sandbox/page.tsx`**
Add interactive test cards, hint accordions, live search input, and summary output lists for all 4 sub-challenges in Level 3.

- [ ] **Step 3: Commit and verify compilation**
Run `bun run typecheck:ui` to verify type safety and push to GitHub.
