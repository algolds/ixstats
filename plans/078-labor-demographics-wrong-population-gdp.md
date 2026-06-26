# Plan 078: Labor & Demographics should use the country's own population/GDP, not world figures

> **Executor instructions**: Investigate-then-fix. Confirm the data source before
> editing. Verify each step, update `plans/README.md`, honor STOP conditions.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/app/builder/components/enhanced/tabs/DemographicsPopulationTab.tsx src/app/builder/components/enhanced/tabs/LaborEmploymentTab.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

QA reported: *"Labor and Demographics references world population and wrong
GDP/GDPPC."* The Labor/Demographics tabs in the Economy Builder display global
figures instead of the country being edited, so every derived demographic/labor
number is wrong for the user's nation.

## Current state (leads — confirm before editing)

- `src/app/builder/components/enhanced/tabs/DemographicsPopulationTab.tsx`
- `src/app/builder/components/enhanced/tabs/LaborEmploymentTab.tsx`
- Section wrappers: `src/app/builder/sections/DemographicsSection.tsx`,
  `src/app/builder/sections/LaborEmploymentSection.tsx`
- Calc utils with tests: `src/app/builder/__tests__/utils/demographicsCalculations.test.ts`,
  `laborCalculations.test.ts`

**Hypothesis to verify**: these tabs read `totalPopulation` / `nominalGDP` /
`gdpPerCapita` from a world/global aggregate source (or a default seed) rather
than from the active country's builder state (`useBuilderState`). Find the exact
variable feeding the population and GDP figures shown in these tabs and confirm
its origin.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Trace pop/GDP source | `grep -rn "totalPopulation\|worldPopulation\|nominalGDP\|gdpPerCapita\|population" src/app/builder/components/enhanced/tabs/DemographicsPopulationTab.tsx src/app/builder/components/enhanced/tabs/LaborEmploymentTab.tsx` | the data source |
| Compare to a correct tab | `grep -rn "useBuilderState\|economyData\|coreIndicators" src/app/builder/sections/CoreIndicatorsSection.tsx` | how a correct tab reads country data |
| Typecheck | `bun run typecheck:file <edited file>` | exit 0 |
| Tests | `bun run test -- src/app/builder/__tests__/utils/demographicsCalculations.test.ts src/app/builder/__tests__/utils/laborCalculations.test.ts` | all pass |

## Scope

**In scope:** the data wiring in the Demographics and Labor tabs (and their
section wrappers if that's where the wrong source is bound).

**Out of scope:**
- The demographic/labor **calculation formulas** (`*Calculations` utils) — the
  inputs are wrong, not the math. Only change which population/GDP value is fed in.
- Plan 044 (already DONE) nested the Labor tab under Economy with a toggle — do
  not revisit that structure; only fix the data source.

## Git workflow

- Branch: `advisor/078-labor-demographics-data-source`
- Commit: `fix(builder): feed country-level population/GDP into Labor & Demographics`

## Steps

### Step 1: Identify the wrong source

In both tabs, find the variables supplying population, GDP, and GDP-per-capita.
Confirm they come from a world/global value rather than the active country's
builder state. Compare against a tab that shows the **correct** country figure
(e.g. CoreIndicators) to see the right source/prop to use. **If the source is
already the country's builder state, STOP** — the bug may be in a calculation
default; report what you found.

### Step 2: Rebind to the country's builder state

Replace the world/global figures with the active country's
population / nominal GDP / GDP-per-capita from builder state (the same source the
correct tab uses). Keep the calculation utilities unchanged.

**Verify**: `bun run typecheck:file` on each edited file → exit 0.

### Step 3: Sanity-check derived numbers

With a known country (e.g. population set in CoreIndicators), confirm the
Demographics/Labor tabs now reflect that population and a GDP/GDPPC consistent
with CoreIndicators, not a world total.

## Test plan

Extend `demographicsCalculations.test.ts` / `laborCalculations.test.ts` (or add a
tab-level test modeled on `DemographicsPopulationTab.test.tsx`) to assert the tab
uses the provided country population/GDP, not a global constant: pass a small
country population and assert the displayed/derived totals scale to it.

**Verify**: `bun run test -- src/app/builder/__tests__` → all pass incl. new cases.

## Done criteria

- [ ] Demographics & Labor tabs display the active country's population and GDP/GDPPC
- [ ] New/updated test asserts country-level (not world) inputs; tests pass
- [ ] `bun run typecheck:file` passes for each edited file
- [ ] `plans/README.md` status row updated

## STOP conditions

- The tabs already read country state (Step 1) → STOP; the wrongness is in a calc default — report it.
- The "world population" is intentionally shown as a comparison/context figure alongside the country's (by design) → STOP and confirm with the maintainer before removing it.

## Maintenance notes

- Reviewer: verify the fix doesn't break the case where a brand-new country has
  zero/unset population (guard against divide-by-zero in GDPPC).
