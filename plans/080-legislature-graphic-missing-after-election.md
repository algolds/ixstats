# Plan 080: Render the legislature graphic in the Legislature tab after the first election

> **Executor instructions**: Investigate-then-fix. Verify each step, update
> `plans/README.md`, honor STOP conditions.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/components/executive/politics/LegislaturePanel.tsx src/components/executive/politics/ParliamentHemicycle.tsx src/components/executive/politics/PoliticsWarRoom.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 072 (MERGED `59660b69` — did NOT resolve this; same root cause now confirmed in a different component, see Current state)
- **Category**: bug
- **Planned at**: commit `a5efa254`; **reconciled at `5a0549d2`, 2026-06-17** (leads corrected after 072 landed — finding still live)

## Why this matters

QA reported: *"Can't see legislature graphic through Legislature tab after first
elections (Elections tab history works)."* After an election the hemicycle/seat
graphic disappears in the Legislature tab, even though the Elections tab's history
renders fine.

## Current state (corrected during 2026-06-17 reconcile — confirm before editing)

**The original leads were wrong; here is what the code actually shows (HEAD `5a0549d2`):**

- `src/components/executive/politics/ParliamentHemicycle.tsx` — the seat graphic.
  Its prop type declares **flat** `partyName: string` (line 8); it reads
  `seat.partyName` (line 79) and maps `partySummary.map((ps) => … ps.seats …)`
  (line 126).
- `src/components/executive/politics/ElectionSimulator.tsx` is the **only** consumer
  of `ParliamentHemicycle` (line 203). For multicameral it remaps to a flat shape
  (lines 118–125), but for **unicameral it passes the server's nested
  `parliament.partySummary` straight through** (line 109) — and that array nests
  fields under `.party` (`{ party: { id, name, color }, seats }`). So the hemicycle
  reads `seat.partyName` → `undefined`. **This is the exact nested-vs-flat bug Plan
  072 fixed in `PoliticsWarRoom` — present again here, untouched by 072.**
- `src/components/executive/politics/LegislaturePanel.tsx` (239 lines) — the
  **Legislature** section of `PoliticsWarRoom` (rendered at `PoliticsWarRoom.tsx:122`).
  It **does NOT import or render `ParliamentHemicycle` at all** — there is no seat
  graphic in the Legislature section. `ElectionSimulator` (with the hemicycle) is
  the **Elections** section (`PoliticsWarRoom.tsx:204`).

**Corrected diagnosis of the QA report** ("can't see legislature graphic through
Legislature tab; Elections tab works"): the Legislature section (`LegislaturePanel`)
renders no hemicycle, while the Elections section (`ElectionSimulator`) does. So this
is **two possible fixes — pick per the reviewer's intent:**
1. **Add the hemicycle to `LegislaturePanel`**, fed from the same parliament data —
   AND read it with the nested `seat.party?.name`/`?.color` shape (or remap to flat
   first, mirroring `ElectionSimulator` lines 118–125), OR
2. If the intent is only that the *existing* Elections-tab hemicycle is wrong for
   unicameral, fix `ElectionSimulator:109` to remap `parliament.partySummary` to the
   flat shape (same as its multicameral branch) and/or make `ParliamentHemicycle`
   read `seat.party?.name`.

Confirm with the maintainer which behavior they want before building.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Trace the graphic's data | `grep -rn "ParliamentHemicycle\|partySummary\|\.seats\|hemicycle\|render" src/components/executive/politics/LegislaturePanel.tsx` | how/whether the graphic is rendered |
| Inspect hemicycle input | `grep -n "partyName\|seats\|map(\|props" src/components/executive/politics/ParliamentHemicycle.tsx` | the expected input shape |
| Typecheck | `bun run typecheck:file <edited file>` | exit 0 |

## Scope

**In scope:** the Legislature tab's rendering of the seat graphic
(`LegislaturePanel.tsx` and/or how it feeds `ParliamentHemicycle`).

**Out of scope:**
- The Elections tab history (it works) — don't touch it.
- The server `getCurrentParliament` shape — fix the consumer (consistent with Plan 072).

## Git workflow

- Branch: `advisor/080-legislature-graphic-after-election`
- Commit: `fix(politics): render hemicycle in Legislature tab post-election`

## Steps

### Step 1: Confirm the corrected diagnosis (072 already merged, did NOT resolve this)

072 is merged (`59660b69`); it only changed `PoliticsWarRoom.tsx` and did not touch
`ParliamentHemicycle`/`ElectionSimulator`/`LegislaturePanel`. Confirm the Current-state
facts above still hold (`grep -n "ParliamentHemicycle" src/components/executive/politics/LegislaturePanel.tsx`
returns nothing; `ElectionSimulator.tsx:109` returns `parliament.partySummary`). Then
decide fix path 1 vs 2 with the maintainer before editing.

### Step 2: Find why the graphic doesn't render

If still missing, determine the gating condition: which collection
(`parliament.seats` vs `partySummary`) the graphic maps over, and why it's empty
or mis-shaped after an election. Read `LegislaturePanel.tsx` to see the
conditional that hides the graphic.

### Step 3: Feed the graphic the correct post-election data

Render `ParliamentHemicycle` with the seat data that exists after an election
(map the available shape to the hemicycle's expected `{ partyName, seats, color }`
items). Reuse the same source the Elections tab history uses if it's correct
there.

**Verify**: `bun run typecheck:file` on edited files → exit 0; reviewer confirms the hemicycle appears after an election.

## Test plan

If a politics test harness exists (`src/components/executive/politics/__tests__/`),
add a case asserting the hemicycle renders given post-election seat data. Else
verify manually (reviewer): hold an election → Legislature tab shows the seat
graphic with correct party colors.

## Done criteria

- [ ] After an election, the Legislature tab shows the seat graphic (not blank)
- [ ] `bun run typecheck:file` passes for edited files
- [ ] `plans/README.md` status row updated (or marked resolved-by-072)

## STOP conditions

- 072 already fixed it → STOP, mark resolved-by-072.
- The graphic is intentionally hidden in some state (e.g. pending election results) → STOP and confirm intended behavior with the maintainer.

## Maintenance notes

- Keep the hemicycle's input shape consistent with Plan 072's nested-vs-flat
  decision. Reviewer: confirm both the Legislature tab and any other hemicycle
  consumer read the same shape.
