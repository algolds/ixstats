# Spec: Kistan Sandbox - tRPC Mutations & JS/TS Cheat Sheet Additions

Date: 2026-08-04
Author: Antigravity AI
Status: Approved

## Goal

Extend `/labs/sandbox` (`src/app/labs/sandbox/page.tsx`) with two high-value tabs:
1. **tRPC Mutation Sandbox (`"mutation"`):** An interactive form demonstrating client-side `useMutation()`, `isPending` loading state, Zod input validation error handling, and live database response preview.
2. **JS/TS Cheat Sheet & Pattern Library (`"cheatsheet"`):** A categorized reference gallery (React Hooks, tRPC Queries & Mutations, JS/TS Array/Object operations, Facet UI Tokens) with 1-click code copying.

---

## Architecture & Layout

### 1. Navigation Bar Updates
Top-level tabs in `/labs/sandbox`:
- `sim`: Simulation Controls
- `trpc`: tRPC Query Check
- `mutation`: tRPC Mutation Sandbox
- `facet`: Facet Design Lab
- `cheatsheet`: Code Cheat Sheet
- `quiz`: IDE Quizzes (Levels 1–5)

### 2. tRPC Mutation Sandbox Tab (`"mutation"`)
- Form inputs: Test Motto / Policy Title text input + Priority select dropdown.
- Interactivity: Demonstrates `useMutation()` call, pending spinner state, error callout for invalid inputs, and JSON response viewer.

### 3. JS/TS Cheat Sheet Tab (`"cheatsheet"`)
- Category cards:
  - **React Hooks & State:** `useState`, `useEffect`, `useMemo`
  - **tRPC Data Pipeline:** `api.router.procedure.useQuery()`, `api.router.procedure.useMutation()`
  - **JS/TS Operations:** `.map()`, `.filter()`, Object destructuring, template literals
  - **Facet UI Primitives:** `<FacetContainer variant="overview" depth={2}>`
- Features: 1-click "Copy Snippet" button with feedback indicator.

---

## Verification Plan

### Automated & Manual Verification
- Run `bun run typecheck:ui` to verify type safety across all tabs and copy handlers.
- Test interactive mutation submission and snippet copying in `/labs/sandbox`.
