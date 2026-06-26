---
name: project_component_integration
description: "Atomic component ↔ MyCountry simulation wiring (costs/staff/rollout/issues), completed June 2026 on v2"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9ac85092-5d89-4eac-9ab2-f5017d9c6be3
---

"Component Integration with MyCountry Systems" — wires atomic government/economic/tax
component metrics (implementation cost, annual maintenance, staffRequired, timeToImplement)
into the sim, policies, and the National Issues Engine. Plan + completion table:
`plans/Component Integration with MyCountry Systems.md`. Completed on branch `v2`, 2026-06-18.

Key pieces:
- Pure helpers in `src/lib/atomic-government-utils.ts`: `calculateCivilServiceCapacity(pop, eff)`
  = `max(50, 100 + floor((pop/100000)*(eff/100)))`, `calculateTotalConsumedStaff(gov[], econ[], taxIds[])`,
  `calculateComponentEconomicModifiers(...)`, `parseTimeToImplement(str)`, `calculateImplementationDate(str)`.
- Queue logic: a queued component is created `isActive:false` with `implementationDate` in the future;
  implementation cost is deducted from `GovernmentStructure.totalBudget`. Staff is consumed by BOTH
  active and implementing components; benefits/synergies only once active.
- National Issues Engine (`src/lib/national-issues-engine.ts`): `CountrySnapshot` gained
  `activeComponents`/`implementingComponents` (string ids: gov/econ use enum names, tax uses frontend ids
  e.g. `blockchain_ledger`), plus `civilServiceCapacity`/`consumedStaff`. `evaluateCondition` now treats
  array fields as membership: `{field:"activeComponents", op:"in"|"=="|"!=", value:"<id>"}`. Overstaffing
  auto-creates a **Government Staffing Shortage** issue; since `NationalIssue.templateId` is a required FK,
  it find-or-creates a template by slug `government_staffing_shortage` (upsert) and de-dupes on open issues.
- New endpoint **`api.government.getCivilServiceStatus`** (in `government/components.ts`): returns capacity,
  consumedStaff, utilization%, overCapacity, and a `rolloutQueue` (implementing components with progress +
  remainingMs). Consumed by `CivilServiceWidget` in `mycountry/OverviewHero.tsx`.
- Policy prerequisites (`quickactions/policies.ts`): added `requiredComponents` to the policy schema;
  `createPolicy` cross-references (non-blocking, returns `requirementsMet`/`missingComponents`),
  `activatePolicy` is a HARD gate (throws `PRECONDITION_FAILED` if any required component isn't active),
  `updatePolicy` stringifies it. Policies with no requiredComponents are unaffected (backward compatible).

**GOTCHA (fixed this pass):** `implementationDate` is stored in **IxTime** (game time, ~2041) via
`calculateImplementationDate`, NOT real wall-clock time. The original WIP compared it against `new Date()`,
so queued components would never auto-activate. All active/implementing classification must compare against
`new Date(IxTime.getCurrentIxTime())`. Fixed in `national-issues-engine.ts`, `countries/utils.ts`,
`quickactions/policies.ts`, and `getCivilServiceStatus`.

Tests: `src/lib/__tests__/components-integration.test.ts` (20 pass). Manual runtime smoke-test still pending.
Related: [[reference_router_splitting]].
