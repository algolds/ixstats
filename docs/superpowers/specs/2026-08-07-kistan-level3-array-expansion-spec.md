# Spec: Kistan Level 3 Array Masterclass Expansion

Date: 2026-08-07
Author: Antigravity AI
Status: Approved

## Goal

Expand Level 3 (`src/app/labs/sandbox/challenges/level3_arrays.ts`) from a single `.filter()` challenge into a comprehensive **Array Masterclass Suite** covering the 4 core array operations used daily in IxStates:
1. **Part 3A (`.filter()`):** `filterAllianceNations(nations, alliance, minStability)`
2. **Part 3B (`.map()`):** `formatNationSummaries(nations)`
3. **Part 3C (`.find()`):** `findNationBySlug(nations, slug)`
4. **Part 3D (Aggregation / Math):** `calculateTotalGdp(nations)`

---

## Architecture & Layout

### 1. Challenge File Updates (`src/app/labs/sandbox/challenges/level3_arrays.ts`)
- Preserves existing `NationData` interface with added `alliance` property.
- Provides clear JSDoc guidelines and code comments for Kistan.

### 2. UI Updates (`src/app/labs/sandbox/page.tsx`)
- Expands the Level 3 tab in `/labs/sandbox` to display test status cards, hints, and interactive live canvases for all 4 array operations:
  - Live Alliance Filter Grid (`.filter()`)
  - Live Formatted Summary Strings (`.map()`)
  - Live Nation Search Box (`.find()`)
  - Live Total GDP Counter (`calculateTotalGdp`)

---

## Verification Plan

### Automated & Manual Verification
- Typecheck using `bun run typecheck:ui`.
- Verify interactive testing across all 4 sub-challenges in `/labs/sandbox`.
