# Spec: Kistan 5-Level Fundamental CS/JS/TS Quiz & Sandbox

Date: 2026-08-04
Author: Antigravity AI
Status: Approved

## Goal

Redesign the IDE Quiz tab in `/labs/sandbox` into a practical 5-level Computer Science & JavaScript/TypeScript introduction track. All tasks and examples are grounded strictly in IxStates nation domain data (GDP, Population, Stability, Alliances, Treasury Vaults).

---

## 5-Level CS Curriculum & File Structure

### Level 1: Variables & Data Types (`level1_variables.ts`)
- **Concept:** Declaring variables (`const`/`let`), string concatenation, numbers, TypeScript type annotations.
- **Task:** Export `formatNationHeader(name: string, populationMillions: number): string` returning `"Nation: Faneria | Population: 40M"`.

### Level 2: Conditionals & Control Flow (`level2_conditionals.ts`)
- **Concept:** `if/else` branching, comparison operators (`>=`, `<`), returning strings.
- **Task:** Export `getEconomicTier(gdpPerCapita: number): string` returning `"Advanced"` (≥40k), `"Developing"` (15k–39.9k), or `"Emerging"` (<15k).

### Level 3: Arrays & Iteration (`level3_arrays.ts`)
- **Concept:** Array structures, `.filter()`, `.map()`, array manipulation.
- **Task:** Export `filterHighStabilityNations(nations: NationInfo[], minStability: number): NationInfo[]` returning only nations with `stability >= minStability`.

### Level 4: Objects & Methods (`level4_objects.ts`)
- **Concept:** Objects, key-value state, methods, `this` context binding.
- **Task:** Export `NationTreasuryVault` object with `reserves: number`, `allocateBudget(amount: number)` method updating `this.reserves`, and `getVaultStatus()` returning formatted string.

### Level 5: Functions & Promises (`level5_async.ts`)
- **Concept:** `async/await`, Promises, delay simulation, resolving data.
- **Task:** Export `fetchNationIntelReport(nationSlug: string): Promise<IntelReport>` returning a Promise that resolves after a 300ms delay.

---

## Verification Plan

### Automated & Manual Verification
- Run `bun run typecheck:ui` to ensure all level starter files and sandbox imports compile cleanly.
- Verify live unit testing and Facet UI previews in `/labs/sandbox`.
