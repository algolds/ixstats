# Plan 081: Stop multicameral chamber seat edits from snapping back to a derived total

> **Executor instructions**: Investigate-then-fix. Verify each step, update
> `plans/README.md`, honor STOP conditions.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/components/executive/politics/LegislatureConfig.tsx`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

QA reported: *"Legislature Chamber seats counts try to autocorrect to 1000, like
Total Seats used to (all multicameral setups)."* When configuring a multi-chamber
legislature, editing a chamber's seat count gets overwritten by a derived value,
so the user can't set per-chamber seats.

## Current state

`src/components/executive/politics/LegislatureConfig.tsx`:

- Per-chamber seat **edit** handler clamps sanely (line 178–180):
  ```ts
  if (field === "seats") {
    const num = Math.max(10, Math.min(5000, Number(value) || 10));
    return { ...c, [field]: num };
  }
  ```
  So the clamp itself is not the "1000" source.
- Chambers are **re-derived from `formData.totalSeats`** whenever chamber type /
  setup changes (lines ~113–172): e.g. unicameral seeds `seats: Number(formData.totalSeats) || 100`, bicameral splits `currentSeats` into House/Senate, etc. `setChambers(newChambers)` overwrites prior per-chamber edits.

**Hypothesis**: the per-chamber seat edit lives in `chambers` state, but a
re-derivation effect (the block that calls `setChambers(newChambers)` from
`formData.totalSeats`) runs again — on a dependency that changes during editing —
and overwrites the user's per-chamber numbers with the totalSeats-derived split.
The reported "1000" is the user's total seats being re-split. You must read the
re-derivation trigger (its `useEffect` deps or the handler that calls it) and
confirm it re-runs after manual edits.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Find the re-derivation trigger | `grep -n "setChambers\|useEffect\|formData.totalSeats\|chamberType" src/components/executive/politics/LegislatureConfig.tsx` | the effect/handler that regenerates chambers |
| Typecheck | `bun run typecheck:file src/components/executive/politics/LegislatureConfig.tsx` | exit 0 |

## Scope

**In scope:** `src/components/executive/politics/LegislatureConfig.tsx` — the
chamber re-derivation logic and/or the per-chamber edit persistence.

**Out of scope:**
- The `handleSave` total clamp (line 192–203) — that's a save-time total clamp,
  not the per-chamber autocorrect.
- The server `configureLegislature` mutation — fix the client state behavior.

## Git workflow

- Branch: `advisor/081-chamber-seats-autocorrect`
- Commit: `fix(politics): preserve manual per-chamber seat edits in multicameral setup`

## Steps

### Step 1: Reproduce and find the overwrite

Set a multicameral legislature, edit one chamber's seats, observe it snap back.
Identify which `setChambers(...)` call (the re-derivation from `formData.totalSeats`)
runs and overwrites the edit, and what triggers it (effect deps or a handler).

### Step 2: Gate re-derivation to intentional changes only

Make chamber re-derivation happen **only when the user changes chamber type / count**
(an explicit user action), not on every render or on `totalSeats` changes that
result from the user's own per-chamber edits. Concretely: remove `formData.totalSeats`
(or the edited value) from the re-derivation effect's dependencies, or guard the
effect so it doesn't overwrite `chambers` once the user has manually edited them.
Note that the edit handler already updates `formData.totalSeats` from the sum
(line 188–189) — that must not feed back into a re-derivation.

**Verify**: `bun run typecheck:file src/components/executive/politics/LegislatureConfig.tsx` → exit 0; reviewer can edit per-chamber seats and they persist.

## Test plan

Add a test under `src/components/executive/politics/__tests__/` (model after any
existing test there) asserting: with chamberType fixed, editing one chamber's
seats updates only that chamber and does not reset other chambers to a derived
split. If component testing isn't feasible, extract the re-derivation decision
into a small pure helper and unit-test that.

**Verify**: `bun run test -- src/components/executive/politics/__tests__` → all pass.

## Done criteria

- [ ] Manual per-chamber seat edits persist (don't snap to a derived total) in multicameral setups
- [ ] Changing chamber type still re-seeds chambers as before
- [ ] `bun run typecheck:file` passes; new/updated test passes
- [ ] `plans/README.md` status row updated

## STOP conditions

- The overwrite comes from a server round-trip (refetch replacing local edits) rather than the re-derivation effect → different fix; STOP and report.
- Removing the dependency breaks the chamber-type-change re-seed → keep that path working; if you can't separate the two triggers cleanly, STOP and report.

## Maintenance notes

- This is the classic "derived state overwrites user edits" trap. Reviewer:
  confirm chamber-type changes still re-seed, and that the totalSeats display
  stays the sum of chambers without feeding back into re-derivation.
