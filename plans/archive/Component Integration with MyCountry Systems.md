# Implementation Plan - Component Integration with MyCountry Systems

This plan details the architecture and changes required to wire component metrics (implementation costs, annual costs, staff/people required, and implementation timeframes) directly into the country simulation, cabinet decisions, policy updates, and the National Issues Engine.

---

## User Review Required

> [!IMPORTANT]
> **Key Design Decisions Aligned via `/grill-me`:**
> 1. **Financial Deductions**: Implementation costs will be deducted from the country's reserves immediately upon queueing. Annual maintenance costs will be added to the country's recurring spending categories.
> 2. **Staff/Capacity Enforcement**: Enforce a new *Civil Service Capacity* limit based on country population and government effectiveness. If component staff requirements exceed this capacity, a **Government Staffing Shortage** issue is triggered, penalizing stability and effectiveness.
> 3. **Timeframe Simulation**: Components will start in an `implementing` state (isActive: false, implementationDate in the future), during which they consume staff but offer no benefits/synergies. Milestone/setback issues can trigger during this rollout phase.
> 4. **Engine Integration**: Wire active components into the National Issues Engine so specific components (like `blockchain_ledger` or `planned_economy`) can act as prerequisites or triggers for events and policy decisions.

---

## Proposed Changes

### 1. Database & Simulation Layer

#### [MODIFY] [core.prisma](file:///ixwiki/public/projects/ixstats/prisma/schema/core.prisma)
*Note: Since database write migrations are restricted, we will use existing fields where possible or run `db:push:force` if explicitly approved.*
1. Add derived property helpers to compute:
   - **Civil Service Capacity**: `100 + (country.currentPopulation / 100000) * (country.governmentalEfficiency || 50) / 100`
   - **Total Consumed Staff**: Sum of `staffRequired` for all active and implementing components.
2. Leverage `implementationDate` in `GovernmentComponent`, `EconomicComponent`, and `TaxComponent` to track rollout status:
   - If `implementationDate > now()` -> Status: `implementing` (isActive remains false, consumes staff, no effects).
   - If `implementationDate <= now()` -> Status: `active` (isActive is set to true).

---

### 2. Backend Simulation & Calculation

#### [MODIFY] [calculations.ts](file:///ixwiki/public/projects/ixstats/src/lib/calculations.ts)
1. Update `IxStatsCalculator` to fetch active components and:
   - Deduct implementation costs from the country's financial reserves during component purchase.
   - Aggregate all annual maintenance costs of active components and add them to `totalGovernmentSpending`.
   - Recalculate GDP, inflation, and tax revenue modifiers based on active components.

#### [MODIFY] [national-issues-engine.ts](file:///ixwiki/public/projects/ixstats/src/lib/national-issues-engine.ts)
1. Add `activeComponents` and `implementingComponents` arrays to the `CountrySnapshot` type.
2. In `evaluateCondition`, support a new `activeComponents` target field that evaluates rules like:
   - `{ field: "activeComponents", op: "in", value: "blockchain_ledger" }`
3. Add check logic inside `evaluateCountry` to auto-trigger a staffing shortage issue if consumed staff > civil service capacity.

---

### 3. Cabinet Meetings & Policy Actions

#### [MODIFY] [policies.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/quickactions/policies.ts)
1. Update `createPolicy` and `activatePolicy` procedures to cross-reference required components before activating policies.
2. Check that the required components are fully `active` (not just `implementing`).

#### [NEW] [components.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/government/components.ts)
1. Create procedures to queue a component:
   - Check if treasury reserves cover the `implementationCost`.
   - Calculate rollout completion date/IxTime based on the component's `timeToImplement` timeframe.
   - Create the component record with `isActive: false` and `implementationDate: futureDate`.
   - Subtract the implementation cost from the country's reserves.

---

### 4. UI Dashboard Updates

#### [MODIFY] [OverviewHero.tsx](file:///ixwiki/public/projects/ixstats/src/components/mycountry/OverviewHero.tsx)
1. Display a new **Civil Service Capacity** ring or indicator showing consumed staff vs. total capacity.
2. Render a **Rollout Queue** widget displaying any components currently in the `implementing` phase with a countdown/progress bar.

---

## Verification Plan

### Automated Tests
- Write a Jest test suite `src/lib/__tests__/components-integration.test.ts` to verify:
  - Civil service capacity calculations.
  - Rollout queue time checking and state transition from implementing to active.
  - National issues trigger condition evaluation for active components.

### Manual Verification
1. Open the **Atomic Tax Components** builder, queue the `blockchain_ledger` component.
2. Verify that:
   - The implementation cost is deducted from the country's financial budget.
   - The component displays in the rollout list with its progress bar.
   - Civil service staff count updates to reflect the new staff required.
3. Advance game time (IxTime) or trigger the scheduler, verify the component transitions to `active` when the timeframe completes.
4. Try to queue components beyond the civil service capacity, verify a **Government Staffing Shortage** issue is triggered in the inbox.

---

## Completion Status (2026-06-18)

All plan items implemented on branch `v2`. The simulation/calculation layer (helpers,
calc modifiers, queue logic with budget deduction + `implementationDate`) was already in
the prior WIP commit (`5209b882`); this pass finished the remaining items:

| Area | File | Status |
|------|------|--------|
| Civil service capacity / consumed staff / modifiers / timeframe helpers | `src/lib/atomic-government-utils.ts` | ✅ (prior WIP) |
| Component-driven GDP/inflation/tax/spending modifiers | `src/lib/calculations.ts` | ✅ (prior WIP) |
| Queue component (budget check + deduct + rollout date, `isActive:false`) | `government/components.ts`, `economics/builder.ts` | ✅ (prior WIP) |
| Component fetch + self-heal feeding the sim | `countries/utils.ts` | ✅ (prior WIP; **fixed** IxTime comparison this pass) |
| `CountrySnapshot.activeComponents`/`implementingComponents` + capacity/consumedStaff | `src/lib/national-issues-engine.ts` | ✅ |
| `evaluateCondition` array-field membership (`in`/`==`/`!=`) | `src/lib/national-issues-engine.ts` | ✅ |
| Auto-trigger **Government Staffing Shortage** issue (find-or-create backing template) | `src/lib/national-issues-engine.ts` | ✅ |
| Policy `requiredComponents` schema + persist; `createPolicy` cross-reference (non-blocking), `activatePolicy` hard gate, `updatePolicy` JSON handling | `quickactions/policies.ts` | ✅ |
| `api.government.getCivilServiceStatus` endpoint (capacity, consumed staff, rollout queue + progress) | `government/components.ts` | ✅ |
| Civil Service Capacity bar + Rollout Queue widget | `mycountry/OverviewHero.tsx` (`CivilServiceWidget`) | ✅ |
| Jest suite (20 tests, passing) | `src/lib/__tests__/components-integration.test.ts` | ✅ |

**Key correctness note:** `implementationDate` is stored in **IxTime** (game time, currently
~2041) via `calculateImplementationDate`, but the original WIP compared it against the real
wall clock (`new Date()`), so queued components would never transition to `active`. All
active/implementing classification now compares against `new Date(IxTime.getCurrentIxTime())`
in `national-issues-engine.ts`, `countries/utils.ts`, `quickactions/policies.ts`, and the new
`getCivilServiceStatus` endpoint.

**Verified:** `bun run test -- src/lib/__tests__/components-integration.test.ts` → 20/20 pass;
`eslint` clean on all changed files. Manual runtime smoke-test (queue a component, watch
deduction + rollout widget + IxTime transition + staffing-shortage issue) still pending.
