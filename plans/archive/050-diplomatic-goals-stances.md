# Plan 050: Diplomatic Goals & Stances

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat <planned-at SHA>..HEAD -- src/server/api/routers/diplomacy/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Planned at**: commit HEAD, 2026-06-29

## Why this matters

Currently, diplomatic relationships are heavily driven by hidden numeric drift and raw percentages that clash with the story players want to tell. "Players should want to declare an intent and have mechanics facilitate." We need to allow players to set "Diplomatic Goals" (e.g., Ally, Coexist, Rival). When two players have matching goals, the underlying relation mechanics should rapidly facilitate that narrative; when they clash, the system surfaces "Pain Points." This completely resolves the cognitive friction of numbers not matching roleplay.

## Current state

- `prisma/schema/diplomacy.prisma` defines `DiplomaticRelation`. It does NOT have `goalCountry1`, `goalCountry2`, or `diplomaticGoal` fields.
- `src/server/api/routers/diplomacy/core/relations.ts` contains the logic for fetching relations.
- `src/components/diplomacy/` contains UI that currently relies on raw `strength` integers.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Prisma    | `bun run db:push`        | Schema applied      |
| Lint      | `bun run lint`           | exit 0              |

## Scope

**In scope**:
- `prisma/schema/diplomacy.prisma`
- `src/server/api/routers/diplomacy/core/relations.ts`
- `src/components/diplomacy/DiplomacyOverview.tsx`
- A new automated drift cron hook (or modification of an existing one).

**Out of scope**:
- Treaties and Foreign Policy mechanics (these build on top of Stances later).
- Existing embassy upgrade logic.

## Steps

### Step 1: Update Schema
Update `DiplomaticRelation` in `prisma/schema/diplomacy.prisma` to add:
```prisma
  goalCountry1       String?  // e.g. "ALLY", "COEXIST", "HEGEMONY", "RIVAL"
  goalCountry2       String?
```
Run `bun run db:push` to apply.

### Step 2: Create Stance Mutation
In `src/server/api/routers/diplomacy/core/relations.ts`, add a mutation `setDiplomaticGoal` that accepts `relationId` and `goal` ("ALLY" | "COEXIST" | "HEGEMONY" | "RIVAL"), and updates the correct field depending on whether `ctx.user.countryId` is `country1` or `country2`.

**Verify**: `bun run lint`

### Step 3: Implement Goal Synergy (Drift)
Locate the existing diplomatic drift logic (or create `src/lib/diplomatic-drift-cron.ts`). Add a function `calculateGoalSynergy(rel: DiplomaticRelation)`:
- If `goalCountry1` === `goalCountry2` === "ALLY": apply massive positive drift multiplier.
- If one wants "ALLY" and the other wants "RIVAL": apply negative drift + flag "Pain Point: Goal Mismatch".
Update the relation's `status` or narrative text to reflect this synergy, facilitating the players' intent.

### Step 4: Obfuscate the UI
In `src/components/diplomacy/DiplomacyOverview.tsx`:
- Stop displaying the exact `strength` integer.
- Display a qualitative band: `strength > 75` = "Allied", `> 40` = "Neutral", `< 40` = "Tense".
- Add a dropdown for the player to set their "Diplomatic Goal" for each relation via the mutation in Step 2.

**Verify**: `bun run lint`

## Done criteria

- [ ] Schema updated and `db:push` succeeds.
- [ ] `setDiplomaticGoal` mutation exists and works.
- [ ] UI obscures raw percentage and allows setting goals.

## STOP conditions

- If `DiplomaticRelation` is tightly coupled to a disabled foreign policy system that crashes when modifying schema.
- If `bun run db:push` fails due to existing data conflicts without a default value.
