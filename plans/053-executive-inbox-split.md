# Plan 053: Executive Inbox Split

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat <planned-at SHA>..HEAD -- src/components/mycountry/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: ux
- **Planned at**: commit HEAD, 2026-06-29

## Why this matters

Players feel overwhelmed when all issues are presented as emergencies, and they want the ability to prioritize. We need to split the National Issues inbox into two distinct UI sections: "Crises" (urgent, reactive problems) and "Discourse" (proactive, minor issues). Giving players the option to "Delegate" or "Dismiss" Discourse issues ensures they can focus their Civil Capacity where it matters, reducing burnout and improving immersion.

## Current state

- `src/server/api/routers/national-issues/player.ts` already supports filtering by `status` and checking `deadlineIxTime`. The `dismiss` mutation exists for non-urgent issues.
- `src/components/mycountry/EnhancedExecutiveContent.tsx` (or the issues list component) renders all active issues in a single list.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run typecheck:ui`   | exit 0, no errors   |
| Lint      | `bun run lint`           | exit 0              |

## Scope

**In scope**:
- `src/components/mycountry/EnhancedExecutiveContent.tsx` (or the specific Issues list component)

**Out of scope**:
- Changing how the engine generates issues.
- Modifying the `national-issues` router logic (it already has what we need).

## Steps

### Step 1: Split the Query Result
In the UI component that fetches `getMyIssues`, split the returned `issues` array into two lists:
- `crises`: issues where `urgency > 70` OR `deadlineIxTime != null`.
- `discourse`: all other issues.

### Step 2: Update the UI Layout
Render two separate panels/lists:
- **Reactive Crises**: Red/Amber warning styling. Must be answered.
- **National Discourse**: Neutral styling. Includes a "Delegate" (Dismiss) button prominently on the card, hooked to the existing `dismiss` tRPC mutation.

**Verify**: `bun run typecheck:ui`

## Done criteria

- [ ] UI shows two distinct sections for urgent vs. non-urgent issues.
- [ ] Non-urgent issues can be dismissed directly from the list view via a "Delegate" button.
- [ ] `bun run typecheck:ui` passes.

## STOP conditions

- If the UI is built dynamically using a third-party table library that resists simple array splitting.
