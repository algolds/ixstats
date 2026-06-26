---
name: project_mycountry_core_loops
description: MyCountry executive/diplomacy/politics gameplay-loop design — engines built but loops open; close them via one narrative+ledger spine
metadata: 
  node_type: memory
  type: project
  originSessionId: ba56f9e2-f07c-43d9-9a2e-42baee957e48
---

Design for the core MyCountry experience (executive/diplomacy/politics), June 2026, v2. Full doc: `plans/mycountry-core-loops-design.md`. Grounded in `plans/ixstates-community-feedback-analysis.md` + product vision (wiki→maps→world→thinkpages→vault).

**Core diagnosis: the engines are built; the loops are open.** Player actions stop at "row saved" instead of completing `action → world effect → narrative → ledger`. Only TWO loops are actually closed end-to-end and are the templates for everything else:
- **National Issues** (`src/lib/national-issues-consequences.ts` `applyConsequence` + `FIELD_BOUNDS` clamp + `NationalIssueConsequence` audit rows) — but ships OFF by default (`src/lib/gameplay-flags.ts` `GAMEPLAY_FLAGS`, narrative mode).
- **Foreign Policy** (`diplomacy/policies/foreignPolicy.ts` — transactional effect + auto-news).

**The keystone recommendation:** one dispatcher `recordCountryEvent({countryId,type,consequences,narrative})` that every exec/diplo/politics action calls → (1) `applyConsequence` (bounded+audited), (2) `generateDiplomaticNews` (`src/lib/diplomatic-news-generator.ts`, already works, 16 templates), (3) revive dead `src/lib/activity-hooks.ts` (zero callers today), (4) net-new wiki-paragraph generator. Consolidates scattered `void generateDiplomaticNews` calls + deletes the dead `calculateRealTimePolicyEffects` (duplicated ×3). Makes "governance legible" + "system serves story" structural.

**IMPLEMENTED 2026-06-20 (v2):** (1) Issues wired up — `issuesAutoGenerate` default ON + `national-issues-generation-cron.ts` (every 15m). (2) Diplomacy root fix in `establishEmbassy` (creates DiplomaticRelation + embassy_established news + activity hook). (3) Scheduled elections — extracted `simulateElectionCore` to `src/lib/election-simulation.ts` (shared by mutation + `election-cron.ts`), runs on IxTime + auto-schedules next term. (4) Policies→sim via `policy-effects-sync.ts` — activate emits a `StorytellerEffect` (growth_rate_modifier, tagged `POLICY:<id>`) the engine already reads; suspend/repeal/delete clear it. (5) `politics-drift-cron.ts` — party support drift + `applyGovernmentComponentEffects` recompute (every 6h). All 4 new crons registered in `server.mjs`. Deferred: unified recordCountryEvent spine + CountryChangeLog (needs migration), policy treasury debit (tax disabled), wiki-paragraph generator.

**Highest-payoff per-effort fixes (verified):**
- Diplomacy root blocker: `establishEmbassy` doesn't create a `DiplomaticRelation` or fire the ready `embassy_established` news (import is dead in `embassies/establish.ts`) → cascades to empty relations list AND empty foreign-policy target dropdown. One fix unblocks both.
- Scheduled elections: `simulateElection` engine is complete; `scheduledIxTime` stored but no cron reads it → elections are manual-only. Add cron in `server.mjs` (⚠️ compare `IxTime.getCurrentIxTime()`, not wall-clock).
- Policies cosmetic: `Policy.calculatedEffects` computed but NEVER read by `calculations.ts` → enacting a policy doesn't affect the sim.
- Politics stability/party-support: frozen between manual elections; no scheduled drift from economy/policies.

See [[project_achievements_dynamic_scaling]], [[project_component_integration]] (civil-service capacity model to reuse for cabinet).
