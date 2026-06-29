# Plan 077: Persist Economy Builder component selections (incl. Atomic Tax) when leaving the builder

> **Executor instructions**: Follow step by step. This is an investigate-then-fix
> plan: entry points are exact, but you must trace the state flow before editing.
> Verify each step, update this plan's row in `plans/README.md`, honor STOP
> conditions.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/app/builder/hooks/useBuilderState.ts src/app/builder/sections/EconomySection.tsx`

## Status

- **Priority**: P2 (high user-perceived impact — feels like data loss)
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

QA reported, for the MyCountry Economy Builder:
- *"Components do not persist after leaving Economy Builder (within EB is fine,
  leaving, even to preview, removes component selections)."*
- *"Atomic Tax components also do not persist when leaving the Economy Builder."*

The user selects economic components, navigates away (or to Preview), and the
selections are gone. This reads as data loss and undermines trust in the whole
builder.

## Current state (leads — confirm before editing)

The builder lives under `src/app/builder/`. Shared builder state is in
`src/app/builder/hooks/useBuilderState.ts`; economy types in
`src/app/builder/types/economy.ts`; atomic integration in
`src/app/builder/services/AtomicIntegrationService.ts`. Economy UI:
- `src/app/builder/sections/EconomySection.tsx`
- `src/app/builder/components/enhanced/tabs/` (economy/atomic component pickers)
- Atomic component definitions: `src/components/economy/atoms/AtomicEconomicComponents.tsx`
  and tax: `src/components/tax-system/atoms/AtomicTaxComponents.tsx`

**Hypothesis to verify**: the component selections are held in **local component
state** (a `useState` inside the picker/section) instead of being lifted into the
shared `useBuilderState` store that survives navigation and feeds Preview. When
the section unmounts (navigate away / go to Preview), local state is discarded.

You MUST confirm where the selections actually live before changing anything.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Trace state | `grep -rn "useState\|useBuilderState\|selectedComponents\|componentIds\|atomic" src/app/builder/sections/EconomySection.tsx src/app/builder/hooks/useBuilderState.ts` | where selections are stored |
| Find tax-component state | `grep -rn "selected\|useState\|onChange\|persist" src/components/tax-system/atoms/AtomicTaxComponents.tsx` | the tax picker's state owner |
| Typecheck | `bun run typecheck:file <edited file>` | exit 0 |
| Tests | `bun run test -- src/app/builder/__tests__` | all pass |

## Scope

**In scope:** the state ownership/wiring that makes economy + atomic-tax
component selections part of persisted builder state. Likely
`useBuilderState.ts`, `EconomySection.tsx`, and the atomic pickers' props.

**Out of scope:**
- The component **definitions / catalogs** (what components exist) — not the bug.
- Server save path / Prisma — first make selections survive in-session
  navigation + Preview (the reported bug). Persisting to the DB on Save is a
  separate concern only if Step 1 shows selections never reach the save payload.
- Other builder sections (government, fiscal) unless they share the exact same
  broken state owner.

## Git workflow

- Branch: `advisor/077-economy-builder-component-persistence`
- Commit: `fix(builder): lift economy + atomic-tax component selections into builder state`

## Steps

### Step 1: Locate the state owner

Trace where the economy component selections and the atomic-tax component
selections are stored. Confirm whether they are local `useState` in the
section/picker vs. fields on `useBuilderState`. Record the finding. **If they are
already in `useBuilderState` and still don't persist, STOP** — the bug is in the
store's persistence/reset logic, not state placement; report what you found.

### Step 2: Lift selections into builder state

Move the selections into the shared builder state (`useBuilderState` or whatever
store the Preview tab reads from), so the picker reads/writes through it. Follow
the existing pattern other persisted builder fields use (find one persisted field
in `useBuilderState.ts` and mirror its shape and setter). Wire both the economy
components and the atomic-tax components.

**Verify**: `bun run typecheck:file` on each edited file → exit 0.

### Step 3: Confirm Preview reads the same source

Ensure the Economy Preview tab reads component selections from the same lifted
state, so navigating to Preview shows them.

**Verify**: `bun run test -- src/app/builder/__tests__` → all pass (fix any test that asserted the old local-state behavior, and see Test plan).

## Test plan

Add/extend a test under `src/app/builder/__tests__/tabs/` (model after
`EconomyPreviewTab.test.tsx` / `EconomySectorsTab.test.tsx`) asserting that:
- selecting an economy component updates builder state, and
- the selection is still present after a simulated unmount/remount (navigate
  away and back) and is visible to the Preview tab.
Cover the atomic-tax component selection the same way.

**Verify**: `bun run test -- src/app/builder/__tests__` → all pass, including the new cases.

## Done criteria

- [ ] Economy component selections survive navigating away and to Preview
- [ ] Atomic-tax component selections survive the same
- [ ] New test(s) assert persistence across unmount/remount; `bun run test -- src/app/builder/__tests__` passes
- [ ] `bun run typecheck:file` passes for each edited file
- [ ] `plans/README.md` status row updated

## STOP conditions

- Selections are already in shared state (Step 1) → STOP; the bug is in reset/persistence logic, report it.
- The fix would require a schema/server change to make in-session navigation work → that contradicts the symptom (loss happens before Save); STOP and report — you've likely mis-located the state.
- Lifting state breaks an unrelated builder section that shared the store → STOP and report the coupling.

## Maintenance notes

- After this, confirm the lifted selections are actually included in the Save
  payload to the server (the QA note says "Save button works", so check this
  isn't silently dropping the newly-persisted components on save).
- Reviewer: scrutinize for re-render storms — lifting frequently-changing
  selection state into a global store can cause wide re-renders; memoize as the
  repo's other builder sections do.
