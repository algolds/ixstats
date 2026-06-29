# Plan 052: Surface Governance Ledger

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
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Planned at**: commit HEAD, 2026-06-29

## Why this matters

To reassure players against "stat-wanking", we need to make the mechanics legible. The system already audits changes via `NationalIssueConsequence` (and the broader `recordCountryEvent` spine), enforcing growth boundaries. Surfacing these audit rows in a "Country Change Log" UI timeline on the Country Profile proves to players that every change is tracked, visible, and bounded by formulas.

## Current state

- Audit data already exists in the database (`NationalIssueConsequence`).
- The Country Profile UI (`src/components/mycountry/EnhancedMyCountryContent.tsx` or similar tabs) does not display a diff timeline.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Lint      | `bun run lint`           | exit 0              |

## Scope

**In scope**:
- `src/server/api/routers/mycountry/` (to fetch the log)
- `src/components/mycountry/CountryChangeLog.tsx` (create)
- `src/components/mycountry/tabs/` (or wherever the main profile view is)

**Out of scope**:
- Modifying the underlying database schema. We are purely surfacing existing audit data.

## Steps

### Step 1: Create the Router Endpoint
Add a `getChangeLog` query to the relevant `mycountry` tRPC router. Fetch `NationalIssueConsequence` (and any other audit records) for the given `countryId`, ordered by `appliedAt` descending.

**Verify**: `bun run lint`

### Step 2: Build the Timeline UI Component
Create `src/components/mycountry/CountryChangeLog.tsx`.
It should render a vertical timeline (using the Facet design system). Each entry should display:
- The Date/IxTime
- The Trigger (e.g., "Issue Resolved: National Strike")
- The Diff (e.g., "GDP Growth: +0.2% (clamped from +0.5% by growth model)")

### Step 3: Inject into the Country Profile
Add the `<CountryChangeLog />` component to the bottom of the Executive or Overview tab in `MyCountryRouter.tsx` or `EnhancedExecutiveContent.tsx`.

**Verify**: `bun run lint`

## Done criteria

- [ ] `getChangeLog` tRPC query exists.
- [ ] Timeline UI renders recent stat changes.
- [ ] Guardrail interventions (clamping) are explicitly noted in the UI text if applicable.

## STOP conditions

- If `NationalIssueConsequence` rows are being deleted/pruned aggressively by a cron job, making the history too short.
