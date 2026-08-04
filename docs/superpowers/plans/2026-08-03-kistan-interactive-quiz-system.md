# Kistan Interactive Quiz & Coding Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 4 guided challenge skeleton files under `src/app/labs/sandbox/challenges/` and upgrade `/labs/sandbox` (`src/app/labs/sandbox/page.tsx`) into an interactive, gamified quiz environment with live test assertions, visual hints, real-time UI previews, and progressive level unlocking.

**Architecture:** Next.js Client Component featuring an automated test validator importing user-written challenge modules dynamically, rendering real-time verification checklists and Facet glass UI outputs.

**Tech Stack:** React 19, Next.js 16, TypeScript, Lucide React icons.

## Global Constraints
- **Framework versions:** React 19.2.6, Next.js 16.2.6, Tailwind CSS 4.3.0.
- **Styling:** Semantic Tailwind theme tokens (`bg-card`, `border-border/60`, `text-foreground`, `text-muted-foreground`, `bg-primary`).
- **Compilation:** Clean compilation with zero TypeScript errors.

---

### Task 1: Create Guided Challenge Skeleton Files

**Files:**
- Create: `src/app/labs/sandbox/challenges/challenge1_calculator.ts`
- Create: `src/app/labs/sandbox/challenges/challenge2_grid.ts`
- Create: `src/app/labs/sandbox/challenges/challenge3_methods.ts`
- Create: `src/app/labs/sandbox/challenges/challenge4_async.ts`

- [ ] **Step 1: Write Challenge 1 Skeleton**
`src/app/labs/sandbox/challenges/challenge1_calculator.ts`:
```typescript
/**
 * CHALLENGE 1: The Reactive State Calculator
 * 
 * Objective: Write a function named 'calculateTaxYield' that takes taxRate (%) and population (millions),
 * and returns the estimated total tax revenue in Millions of dollars.
 */

export function calculateTaxYield(taxRate: number, population: number): number {
  // TODO: Replace 0 with the actual formula: (taxRate * population * 10)
  return 0;
}
```

- [ ] **Step 2: Write Challenge 2 Skeleton**
`src/app/labs/sandbox/challenges/challenge2_grid.ts`:
```typescript
/**
 * CHALLENGE 2: Object Array Grid Renderer
 * 
 * Objective: Export an array named 'nations' containing 3 country objects (name, gdp, stability),
 * and a function named 'formatNationCard' that formats a country object into a display string.
 */

export interface NationObject {
  name: string;
  gdp: number;
  stability: number;
}

export const nations: NationObject[] = [
  // TODO: Add 3 country objects here (e.g. { name: "Faneria", gdp: 450, stability: 85 })
];

export function formatNationCard(nation: NationObject): string {
  // TODO: Return a formatted string: `${nation.name} - GDP: $${nation.gdp}B (Stability: ${nation.stability}%)`
  return "";
}
```

- [ ] **Step 3: Write Challenge 3 Skeleton**
`src/app/labs/sandbox/challenges/challenge3_methods.ts`:
```typescript
/**
 * CHALLENGE 3: Object Methods & State Mutation
 * 
 * Objective: Export a class or object named 'NationTreasury' with a method named 'addReserves(amount: number)'
 * that updates its internal reserves using 'this'.
 */

export const NationTreasury = {
  name: "Faneria",
  reserves: 500,
  
  addReserves(amount: number) {
    // TODO: Use 'this.reserves += amount' to update reserves
  }
};
```

- [ ] **Step 4: Write Challenge 4 Skeleton**
`src/app/labs/sandbox/challenges/challenge4_async.ts`:
```typescript
/**
 * CHALLENGE 4: Async Pipelines & Promises
 * 
 * Objective: Export an async function named 'fetchNationIntelligence' that simulates a network request
 * returning a Promise resolving to an intelligence score object.
 */

export async function fetchNationIntelligence(nationName: string): Promise<{ nation: string; intelScore: number }> {
  // TODO: Simulate an async network delay using setTimeout inside a Promise
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ nation: nationName, intelScore: 95 });
    }, 300);
  });
}
```

---

### Task 2: Build Interactive Quiz Environment Page

**Files:**
- Modify: `src/app/labs/sandbox/page.tsx`

- [ ] **Step 1: Write the updated Sandbox Page Component code**
Implement real-time test verification against `challenges/*.ts`, live UI rendering, visual hints, and gamified unlocking in `src/app/labs/sandbox/page.tsx`.

- [ ] **Step 2: Commit and verify compilation**
Run `bun run typecheck:ui` to verify typecheck safety.
