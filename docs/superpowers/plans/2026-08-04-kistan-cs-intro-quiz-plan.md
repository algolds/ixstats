# Kistan 5-Level CS/JS/TS Fundamentals Intro Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old challenge skeletons with 5 dedicated CS/JS/TS fundamental levels (`level1_variables.ts` through `level5_async.ts`) in `src/app/labs/sandbox/challenges/`, and update `/labs/sandbox` (`src/app/labs/sandbox/page.tsx`) to run real-time automated test assertions, provide hints, render live Facet UI previews, and track level completion.

**Architecture:** Next.js Client Component importing 5 fundamental level skeleton modules, evaluating TypeScript exports against IxStates nation domain test cases, and rendering interactive results.

**Tech Stack:** React 19, Next.js 16, TypeScript, Lucide React icons.

## Global Constraints
- **Framework versions:** React 19.2.6, Next.js 16.2.6, Tailwind CSS 4.3.0.
- **Styling:** Semantic Tailwind theme tokens (`bg-card`, `border-border/60`, `text-foreground`, `text-muted-foreground`, `bg-primary`).
- **Domain:** All examples and tasks MUST use IxStates nation domain data (GDP, Population, Stability, Treasury, Intel).

---

### Task 1: Create the 5 Fundamental CS Level Skeleton Files

**Files:**
- Create: `src/app/labs/sandbox/challenges/level1_variables.ts`
- Create: `src/app/labs/sandbox/challenges/level2_conditionals.ts`
- Create: `src/app/labs/sandbox/challenges/level3_arrays.ts`
- Create: `src/app/labs/sandbox/challenges/level4_objects.ts`
- Create: `src/app/labs/sandbox/challenges/level5_async.ts`
- Delete old files: `src/app/labs/sandbox/challenges/challenge1_calculator.ts`, `challenge2_grid.ts`, `challenge3_methods.ts`, `challenge4_async.ts`

- [ ] **Step 1: Write Level 1 Skeleton**
`src/app/labs/sandbox/challenges/level1_variables.ts`:
```typescript
/**
 * LEVEL 1: Variables & Primitive Types
 * 
 * Objective: Export a function named 'formatNationHeader' that takes a nation name (string)
 * and population in millions (number), and returns a formatted header string:
 * "Nation: [name] | Population: [population]M"
 */

export function formatNationHeader(name: string, populationMillions: number): string {
  // TODO: Replace "" with the formatted string template
  return "";
}
```

- [ ] **Step 2: Write Level 2 Skeleton**
`src/app/labs/sandbox/challenges/level2_conditionals.ts`:
```typescript
/**
 * LEVEL 2: Conditionals & Control Flow
 * 
 * Objective: Export a function named 'getEconomicTier' that takes gdpPerCapita (number)
 * and returns the economic tier string:
 * - gdpPerCapita >= 40000 -> "Advanced"
 * - gdpPerCapita >= 15000 -> "Developing"
 * - otherwise -> "Emerging"
 */

export function getEconomicTier(gdpPerCapita: number): string {
  // TODO: Implement if/else conditionals checking gdpPerCapita
  return "";
}
```

- [ ] **Step 3: Write Level 3 Skeleton**
`src/app/labs/sandbox/challenges/level3_arrays.ts`:
```typescript
/**
 * LEVEL 3: Arrays & Iteration (.filter())
 * 
 * Objective: Export an array of nation objects named 'allNations', and a function named
 * 'filterHighStabilityNations' that returns only nations with stability >= minStability.
 */

export interface NationData {
  name: string;
  gdp: number;
  stability: number;
}

export const allNations: NationData[] = [
  // TODO: Add 3 country objects (e.g. { name: "Faneria", gdp: 450, stability: 85 })
];

export function filterHighStabilityNations(nations: NationData[], minStability: number): NationData[] {
  // TODO: Use nations.filter() to return nations with stability >= minStability
  return [];
}
```

- [ ] **Step 4: Write Level 4 Skeleton**
`src/app/labs/sandbox/challenges/level4_objects.ts`:
```typescript
/**
 * LEVEL 4: Objects, State & Methods ('this')
 * 
 * Objective: Export an object named 'NationTreasuryVault' with reserves: number,
 * a method allocateBudget(amount: number) updating this.reserves, and a method getVaultStatus().
 */

export const NationTreasuryVault = {
  nationName: "Faneria",
  reserves: 1000,

  allocateBudget(amount: number) {
    // TODO: Deduct amount from this.reserves using 'this.reserves -= amount'
  },

  getVaultStatus(): string {
    // TODO: Return `${this.nationName} Vault Reserves: $${this.reserves}M`
    return "";
  }
};
```

- [ ] **Step 5: Write Level 5 Skeleton**
`src/app/labs/sandbox/challenges/level5_async.ts`:
```typescript
/**
 * LEVEL 5: Functions, Promises & Async/Await
 * 
 * Objective: Export an async function named 'fetchNationIntelReport' taking a nationSlug (string)
 * and returning a Promise resolving to { nation: string, intelScore: number, status: string }.
 */

export interface IntelReport {
  nation: string;
  intelScore: number;
  status: string;
}

export async function fetchNationIntelReport(nationSlug: string): Promise<IntelReport> {
  // TODO: Return a Promise that resolves after a 300ms delay using setTimeout
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        nation: nationSlug,
        intelScore: 92,
        status: "Active",
      });
    }, 300);
  });
}
```

---

### Task 2: Update Sandbox Page Component (`src/app/labs/sandbox/page.tsx`)

**Files:**
- Modify: `src/app/labs/sandbox/page.tsx`

- [ ] **Step 1: Write the updated Sandbox Page Component code**
Import all 5 `level*.ts` modules, add interactive unit test assertions, level locks, hints drawers, and live Facet UI rendering canvases for Levels 1–5 in `src/app/labs/sandbox/page.tsx`.

- [ ] **Step 2: Commit and verify compilation**
Run `bun run typecheck:ui` to verify typecheck safety and push to GitHub.
