# Plan 056: Proactive Policies & Reactive Issues Integration

Integrate proactive Policies (reserving Civil Capacity, carrying background risk modifiers) with reactive National Issues (delegation/don't-intervene costs, "Red" high-risk responses, party alignment satisfaction, and custom shop unlock proposals).

## User Review Required

> [!IMPORTANT]
> **Refined Design Decisions:**
> - Players will NOT configure `riskRating`, `origin`, or `civCapCost` in the Policy Creator Sheet.
> - Predefined decretals (UBI, Tariffs, Surveillance) map these fields directly from their static registry templates.
> - Custom policies automatically derive these fields based on **Priority**:
>   - **Priority low/medium**: `riskRating = "stable"`, `civCapCost = 5` (low) / `10` (medium)
>   - **Priority high**: `riskRating = "volatile"`, `civCapCost = 15`
>   - **Priority critical**: `riskRating = "high-risk"`, `civCapCost = 25`
>   - **Origin**: Always `"personal"`.
> - Updating a custom policy's priority dynamically recalculates its `riskRating` and `civCapCost` in the tRPC router.

---

## Proposed Changes

### 1. Database Schema

#### [MODIFY] [government.prisma](file:///home/jxsig/projects/ixstats/prisma/schema/government.prisma)
- Add `riskRating`, `origin`, and `civCapCost` fields to the `Policy` model (Implemented).

### 2. Predefined Registry & Templates

#### [MODIFY] [registry.ts](file:///home/jxsig/projects/ixstats/src/lib/policies/registry.ts)
- Predefined policy templates configured with default risk ratings, origins, and CivCap costs (Implemented).

### 3. Policy Creator & Detail Sheets

#### [MODIFY] [PolicyCreatorSheet.tsx](file:///home/jxsig/projects/ixstats/src/components/executive/PolicyCreatorSheet.tsx)
- Remove `riskRating`, `origin`, and `civCapCost` input fields and state variables.
- Keep only backend derivation.

#### [MODIFY] [PolicyDetailSheet.tsx](file:///home/jxsig/projects/ixstats/src/components/executive/PolicyDetailSheet.tsx)
- Render active Risk Level, Origin, and Reserved CivCap badges (Implemented).

### 4. tRPC router adjustments

#### [MODIFY] [crud.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/policies/crud.ts)
- In `createPolicy`: Remove client Zod inputs for `riskRating`, `origin`, and `civCapCost`.
- For custom policies, derive fields based on priority:
  - Low: Stable, 5 CivCap
  - Medium: Stable, 10 CivCap
  - High: Volatile, 15 CivCap
  - Critical: High-Risk, 25 CivCap
- In `updatePolicy`: If `priority` is updated, check if it's a custom policy and dynamically recalculate `riskRating` and `civCapCost`.

### 5. National Issues: Reactive Skip, "Red" Responses & Party Alignment

#### [MODIFY] [IssuesInbox.tsx](file:///home/jxsig/projects/ixstats/src/components/national-issues/IssuesInbox.tsx)
- Delegation buttons and checks (Implemented).

#### [MODIFY] [player.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/national-issues/player.ts)
- Enforce capacity checks and dismiss costs (Implemented).

### 6. Background Maintenance Cron

#### [MODIFY] [policy-maintenance-cron.ts](file:///home/jxsig/projects/ixstats/src/lib/policy-maintenance-cron.ts)
- Volatile risk rolls for spawning issues (Implemented).

---

## Verification Plan

### Automated Steps
- Verification build checking:
  ```bash
  SKIP_ENV_VALIDATION=true bun --env-file=.env.local.dev run build:fast
  ```
