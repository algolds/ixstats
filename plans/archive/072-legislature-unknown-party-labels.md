# Plan 072: Fix legislature showing every party as "Unknown Party" after elections

> **Executor instructions**: Follow step by step, verify each step, update this
> plan's row in `plans/README.md`. Honor STOP conditions.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/components/executive/politics/PoliticsWarRoom.tsx src/server/api/routers/elections/elections.ts`
> If either changed, re-confirm the excerpts below before editing.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

QA reported: *"Legislature box lists all parties as 'Unknown Party' after
elections complete. Does not fix on page refresh."* Root cause is a
**field-shape mismatch**: the UI reads flat fields (`seat.partyName`,
`seat.partyId`) off the parliament `partySummary`, but the server returns those
fields **nested under `.party`**. Before any election `partySummary` is empty
(no rows, so no "Unknown Party"); after an election the rows exist but the UI's
flat reads are all `undefined`, so every row falls back to "Unknown Party" and
the neutral fallback color.

## Current state

**Server** — `src/server/api/routers/elections/elections.ts`, `getCurrentParliament`.
`partySummary` items have this shape (lines ~600–626, 631–653):

```ts
// each partySummary value:
{
  party: { id: string; name: string; shortName: string | null; color: string; ideology: string };
  seats: number;
}
// returned as:
partySummary: Array.from(partySeatCounts.values()).sort((a, b) => b.seats - a.seats),
```

(Note: the separate `seats:` array at line 646–652 DOES expose flat `partyName`
/`partyColor`/`partyId` — but `partySummary` does not. The UI below consumes
`partySummary`.)

**UI** — `src/components/executive/politics/PoliticsWarRoom.tsx`, lines 91 + 145–153
map over `parliament.partySummary` and read flat fields that don't exist on those
items:

```tsx
const totalSeats =
  parliament?.partySummary?.reduce((sum: number, s: any) => sum + s.seats, 0) ?? 0;
// ...
parliament.partySummary.map((seat: any) => (
  <... key={seat.partyId ?? seat.partyName}            // both undefined
        title={seat.partyName ?? "Unknown Party"}       // → "Unknown Party"
        subtitle={`${seat.seats} seat${seat.seats !== 1 ? "s" : ""}`}
        ... />
))
```

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck file | `bun run typecheck:file src/components/executive/politics/PoliticsWarRoom.tsx` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope:** `src/components/executive/politics/PoliticsWarRoom.tsx` — the
`partySummary.map(...)` block only.

**Out of scope:**
- `src/server/api/routers/elections/elections.ts` — do NOT change the server
  shape; other consumers depend on it. Fix the read side.
- `ParliamentHemicycle.tsx`, `ElectionSimulator.tsx` — they consume the flat
  `seats` array (which has `partyName`), a different field; leave them.

## Git workflow

- Branch: `advisor/072-legislature-unknown-party-labels`
- Commit: `fix(politics): read nested party fields from partySummary in PoliticsWarRoom`

## Steps

### Step 1: Confirm the partySummary item shape

Read `getCurrentParliament` in `elections.ts` (~lines 595–654) and confirm each
`partySummary` item is `{ party: { id, name, color, ... }, seats }`. If the shape
differs from the excerpt above → STOP (the codebase drifted).

### Step 2: Read the nested fields in the UI

In the `partySummary.map(...)` block (PoliticsWarRoom.tsx ~145–153), change the
flat reads to the nested shape:

- `key={seat.partyId ?? seat.partyName}` → `key={seat.party?.id ?? seat.party?.name}`
- `title={seat.partyName ?? "Unknown Party"}` → `title={seat.party?.name ?? "Unknown Party"}`
- If a party color is used anywhere in this block, read `seat.party?.color`.
- Keep `seat.seats` as-is (that field is correct).

**Verify**: `bun run typecheck:file src/components/executive/politics/PoliticsWarRoom.tsx` → exit 0.

### Step 3: Confirm no other flat reads remain in this block

**Verify**: `grep -n "seat.partyName\|seat.partyId" src/components/executive/politics/PoliticsWarRoom.tsx` → no matches.

## Test plan

No unit test exists for this component and the data is election-derived; verify
manually (reviewer): after holding an election, the Legislature box shows real
party names and colors, not "Unknown Party". If a characterization test is
wanted, model a small one after `src/components/executive/politics/__tests__/`.

## Done criteria

- [ ] `bun run typecheck:file src/components/executive/politics/PoliticsWarRoom.tsx` exits 0
- [ ] `grep -n "seat.partyName\|seat.partyId" src/components/executive/politics/PoliticsWarRoom.tsx` returns nothing
- [ ] `git diff --name-only` shows only `PoliticsWarRoom.tsx`
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 1 shows `partySummary` already exposes flat `partyName`/`partyId` → the bug is elsewhere (maybe the query that feeds `parliament` returns nothing); STOP and report what you found.
- The map block reads from a source other than `parliament.partySummary` → re-trace before editing.

## Maintenance notes

- The two parallel shapes (`seats[]` with flat `partyName`, `partySummary[]` with
  nested `.party`) in the same endpoint are an easy future trap. A reviewer
  should consider whether `getCurrentParliament` should expose one consistent
  shape — deferred out of this minimal fix.
