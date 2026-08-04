# Spec: Kistan Interactive Quiz & Coding Sandbox Environment

Date: 2026-08-03
Author: Antigravity AI
Status: Approved

## Goal

Transform `/labs/sandbox` into a gamified, real-time interactive coding challenge environment. Kistan will edit challenge files in his IDE under `src/app/labs/sandbox/challenges/`, and `/labs/sandbox` will automatically run live test assertions against his exports, display interactive hints, render live UI cards of his results, and unlock progressive challenge modules.

---

## Proposed Architecture & File Structure

### 1. Challenge Starter Skeleton Files
- `src/app/labs/sandbox/challenges/challenge1_calculator.ts`: State Calculator function signature & formula TODOs.
- `src/app/labs/sandbox/challenges/challenge2_grid.ts`: Object array & grid renderer function signature.
- `src/app/labs/sandbox/challenges/challenge3_methods.ts`: Object method & `this` binding state mutation challenge.
- `src/app/labs/sandbox/challenges/challenge4_async.ts`: Async Promise & parallel execution challenge.

### 2. Live Validation Engine & UI (`src/app/labs/sandbox/page.tsx`)
- **Automated Test Runner:** Evaluates imports from `challenges/*.ts` dynamically.
- **Checklist Cards:** Displays real-time test status (`[x] Export exists`, `[x] Type valid`, `[x] Output matches expected calculation`).
- **Live Output Canvas:** Renders Kistan's result directly into a Facet glass UI container once test checks pass.
- **Gamified Level Unlocking:** Unlocks Module 2 when Module 1 passes, Module 3 when Module 2 passes, etc.
- **Smart Hints:** Catches runtime/syntax errors and displays tailored hints to guide Kistan.

---

## Verification Plan

### Automated & Manual Verification
- Run `bun run typecheck:ui` to ensure all challenge skeletons and sandbox components compile without errors.
- Test interactive completion of Challenge 1 in the sandbox to verify unlocking of Challenge 2.
