# Spec: Level 3 Advanced Array Masterclass Expansion (Parts 3A - 3G)

Date: 2026-08-07
Author: Antigravity AI
Status: Approved

## Goal

Expand Level 3 (`src/app/labs/sandbox/challenges/level3_arrays.ts`) into a complete 7-part **Array Masterclass Suite** covering every array operation used in IxStates:
1. **Part 3A (`.filter()`):** `filterAllianceNations(nations, alliance, minStability)`
2. **Part 3B (`.map()`):** `formatNationSummaries(nations)`
3. **Part 3C (`.find()`):** `findNationBySlug(nations, slug)`
4. **Part 3D (Sum):** `calculateTotalGdp(nations)`
5. **Part 3E (`.sort()`):** `sortNationsByGdp(nations, direction)` (Immutably sort by GDP `asc` or `desc`)
6. **Part 3F (`.some()` & `.every()`):** `checkAllianceSecurity(nations, minStability)` (Returns `{ allStable: boolean, anyCritical: boolean }`)
7. **Part 3G (Grouping):** `groupNationsByAlliance(nations)` (Groups array into `{ Concord: [...], Neutral: [...] }`)

---

## Architecture & Layout

### 1. Challenge File Updates (`src/app/labs/sandbox/challenges/level3_arrays.ts`)
- Preserves `NationData` model with `slug`, `name`, `gdp`, `stability`, `alliance`.
- Provides explicit JSDoc hints for `.sort()`, `.some()`, `.every()`, and grouping.

### 2. UI Updates (`src/app/labs/sandbox/page.tsx`)
- Expands Level 3 tab in `/labs/sandbox` to render 7 test status cards and interactive live canvases:
  - Live GDP Sort Toggle (`asc` vs `desc`)
  - Live Alliance Security Status (`.some()` & `.every()`)
  - Live Alliance Grouping Render (`{ Concord: [...], Neutral: [...] }`)

---

## Verification Plan

### Automated & Manual Verification
- Typecheck using `bun run typecheck:ui`.
- Test all 7 interactive array tools in `/labs/sandbox`.
