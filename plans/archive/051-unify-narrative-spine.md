# Plan 051: Unify Narrative Spine

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat <planned-at SHA>..HEAD -- src/lib/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit HEAD, 2026-06-29

## Why this matters

Currently, narrative outputs (ThinkPages news, activity feeds) are bolted on ad-hoc per procedure, resulting in duplicate code and open loops where world effects don't generate stories. By unifying `applyConsequence`, `generateDiplomaticNews`, and `ActivityHooks` into a single `recordCountryEvent` dispatcher, we guarantee that every mechanical change to the ledger automatically produces the narrative the players expect, cementing the "system serves story" philosophy.

## Current state

- `src/lib/national-issues-consequences.ts` exports `applyConsequence` which successfully limits stat changes and writes to an audit log.
- `src/lib/diplomatic-news-generator.ts` has `generateDiplomaticNews`.
- `src/lib/activity-hooks.ts` exists but is mostly dead code/unused.
- Various routers (e.g., policies, meetings) attempt to write effects independently.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Lint      | `bun run lint`           | exit 0              |

## Scope

**In scope**:
- `src/lib/narrative-spine.ts` (create)
- `src/lib/activity-hooks.ts` (cleanup/revive)
- Migration of 1-2 key routers to use the spine (e.g., Executive Decisions or Policies).

**Out of scope**:
- Migrating the entire 90-router codebase to the new spine. We only need to establish the keystone pattern and migrate the core executive/diplomatic loops.

## Steps

### Step 1: Create the Dispatcher
Create `src/lib/narrative-spine.ts` with a `recordCountryEvent` function.
It should take an event payload and execute:
1. `applyConsequence(...)` (reuse from `national-issues-consequences.ts`)
2. `generateDiplomaticNews(...)` (if applicable)
3. `ActivityHooks(...)` (to post to the feed)

**Verify**: `bun run lint`

### Step 2: Revive Activity Hooks
Open `src/lib/activity-hooks.ts`. Find the dead endpoints and ensure they export callable functions that `recordCountryEvent` can use. Remove dead duplicates like `calculateRealTimePolicyEffects`.

### Step 3: Implement in a Router
Pick one router (e.g., `src/server/api/routers/policies/crud.ts` or `src/server/api/routers/meetings/`) and replace its scattered consequence/news code with a single call to `recordCountryEvent`.

**Verify**: `bun run lint`

## Done criteria

- [ ] `recordCountryEvent` acts as a unified facade for ledger and narrative.
- [ ] At least one major router uses the spine.
- [ ] Dead duplication in `activity-hooks.ts` is deleted.

## STOP conditions

- If `applyConsequence` is too tightly coupled to `NationalIssue` specifically and cannot be generalized without breaking the issues engine.
