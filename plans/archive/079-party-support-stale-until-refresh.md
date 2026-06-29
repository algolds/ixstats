# Plan 079: Refresh party support everywhere after editing it (no stale percentages until reload)

> **Executor instructions**: Investigate-then-fix. Verify each step, update
> `plans/README.md`, honor STOP conditions.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/components/executive/politics/PartyManager.tsx src/components/executive/politics/PoliticsWarRoom.tsx`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

QA reported: *"When changing Political Party support, re-opening the Parties
pop-up still shows the old percentages until page is refreshed."* A mutation
updates one component's local cache but not the shared query other views read, so
the data looks stale.

## Current state

`src/components/executive/politics/PartyManager.tsx:66-73` — the update mutation
only calls a **local** `refetch()` (its own `getParties` query), not a cache
invalidation that other consumers see:

```tsx
const updateParty = api.elections.updateParty.useMutation({
  onSuccess: () => {
    refetch();
    resetForm();
    setDialogOpen(false);
    setEditingParty(null);
  },
});
```

Meanwhile `src/components/executive/politics/PoliticsWarRoom.tsx:72` independently
runs `api.elections.getParties.useQuery(...)` (and `getCurrentParliament` at line
80). Those caches aren't invalidated by `PartyManager`'s mutation, so the Parties
pop-up shows stale support until a full reload.

The repo's established fix for exactly this is tRPC cache invalidation via
`api.useUtils()` — see completed Plan 062
(`plans/062-myclub-overview-invalidation.md`) for the pattern.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Find support-edit mutations | `grep -rn "updateParty\|baseSupport\|setSupport\|useMutation" src/components/executive/politics/PartyManager.tsx` | the mutation(s) that change support |
| Typecheck | `bun run typecheck:file src/components/executive/politics/PartyManager.tsx` | exit 0 |

## Scope

**In scope:** the support-editing mutation(s) in `PartyManager.tsx` — add shared
cache invalidation in `onSuccess`.

**Out of scope:**
- The server `updateParty` procedure — it works; this is a client cache concern.
- Refactoring the two separate `getParties` queries into one — nice but not this plan.

## Git workflow

- Branch: `advisor/079-party-support-invalidation`
- Commit: `fix(politics): invalidate shared party queries after support edit`

## Steps

### Step 1: Add the utils hook

At the top of the `PartyManager` component, add (if not present):
```ts
const utils = api.useUtils();
```

### Step 2: Invalidate shared queries on success

In the support-editing mutation's `onSuccess` (the `updateParty` one, and any
other that changes `baseSupport`/support), invalidate the shared queries so all
consumers refetch:

```tsx
onSuccess: () => {
  void utils.elections.getParties.invalidate();
  void utils.elections.getCurrentParliament.invalidate(); // support can shift seat projections
  refetch();
  resetForm();
  setDialogOpen(false);
  setEditingParty(null);
},
```

Keep the existing `refetch()` (harmless). Only add `getCurrentParliament`
invalidation if support actually feeds parliament/seat projections — verify;
otherwise omit it.

**Verify**: `bun run typecheck:file src/components/executive/politics/PartyManager.tsx` → exit 0.

## Test plan

No unit test for this UI cache wiring. Reviewer manual check: edit a party's
support, reopen the Parties pop-up in PoliticsWarRoom without reloading → updated
percentages show immediately.

## Done criteria

- [ ] `api.useUtils()` is used and `utils.elections.getParties.invalidate()` runs on support-edit success
- [ ] `bun run typecheck:file src/components/executive/politics/PartyManager.tsx` exits 0
- [ ] `git diff --name-only` limited to `PartyManager.tsx`
- [ ] `plans/README.md` status row updated

## STOP conditions

- Support is edited in a different component/mutation than `PartyManager`'s `updateParty` → find the real one first; invalidate there.
- `getParties` is already invalidated via utils somewhere → the staleness is elsewhere (e.g. `getCurrentParliament` only); adjust and report.

## Maintenance notes

- Reviewer: confirm the invalidated query keys exactly match what `PoliticsWarRoom`
  consumes. If more party-derived views are added, they'll benefit from the same
  invalidation automatically (that's the point of invalidating the shared key).
