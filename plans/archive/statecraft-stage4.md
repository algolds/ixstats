# Statecraft — Stage 4 scope (Power Brokers)

Date: 2026-06-25 · branch v2. Stage 4 (capstone) of `plans/mycountry-statecraft.md` §7. Built **last**,
on purpose: now that the lever/loop spine exists across all three arenas, a Power Broker is "just a
config row." Built early it's scope-scary; built now it's a table + a pure function.

## What a Power Broker is

An internal **"Other Power"** — the third actor (You / World / Other Powers) turned *inward*. Canon-named
on the surface ("The Party", "The Technocrats", "The Maritime Sector", "The Imperial Cabinet"), an
**atom-gated conditional modifier** underneath:

- **Unlocked** by your atomic build (a component synergy / atom set) — your government *type* summons its
  power brokers.
- **Satisfied** by meeting its conditions (a department-spend threshold) → it grants a **bonus to a lever**.
- **Originates Stimuli** when neglected (its *demands* become Issues) — deferred to S4.C.

This makes the component system finally *pay off as identity* (a Stratocracy answers to its generals; a
technocracy to its experts) — the lore-as-gameplay capstone.

## The big de-risk

Every piece it needs already exists:
- **Unlock** — `lib/government-synergy.ts` `SYNERGY_MAP` (e.g. `TECHNOCRATIC_PROCESS+TECHNOCRATIC_AGENCIES`,
  `OLIGARCHIC_PROCESS+SURVEILLANCE_SYSTEM`) + `GovernmentComponent` (the country's active atoms).
- **Condition** — `GovernmentDepartment.category` + `BudgetAllocation.allocatedPercent` (spend per category).
- **Bonus channel** — `lib/government-component-effects.ts` `applyGovernmentComponentEffects` writes
  `StorytellerEffect`s (CATEGORY→inputType/base map); already re-run by the politics-drift cron. A broker
  bonus rides the same channel, tagged `BROKER:<id>`.
- **Levers it buffs** — Capacity (`governmentCapacityIndex`), Mandate (`computeApproval`/stability),
  Treasury (policy upkeep).

So Stage 4 = a catalog + a pure derive function + wiring into the existing effect channel. No new engine.

## Slices

### S4.A — Catalog + derivation (the pure core). START HERE
`src/lib/statecraft-power-brokers.ts`: a static **catalog** of archetypes, each
`{ id, defaultName, unlock: ComponentType[] (all required), condition: { categories: DepartmentCategory[],
minPercent }, bonus: { lever, magnitude, description } }`, plus a pure
`deriveBrokers(activeComponents, spendByCategory) → ActiveBroker[]` returning, per unlocked broker,
`{ unlocked, satisfied, gapPercent }`. Pure + tested (Technocrats unlock + satisfy/miss). No migration.

Seed catalog (canon-flexible names, atom-gated):
| Broker | Unlock (atoms) | Condition (dept spend) | Bonus |
|---|---|---|---|
| The Technocrats | TECHNOCRATIC_PROCESS + TECHNOCRATIC_AGENCIES | ≥% on Science&Tech / Education / Commerce | −% domestic policy upkeep (Capacity relief) |
| The Party | PARTISAN_INSTITUTIONS + OLIGARCHIC_PROCESS | ≥% on Interior / Intelligence / Justice | +political stability + leading-party strength (Mandate) |
| The Generals | MILITARY_ADMINISTRATION ∥ MILITARY_ENFORCEMENT | ≥% on Defense | +security/readiness (−Mandate if over-fed) |
| The Magnates | OLIGARCHIC_PROCESS + ECONOMIC_INCENTIVES | ≥% on Commerce / Energy | +GDP growth (−social cohesion) |
| The Clergy | RELIGIOUS_LEGITIMACY ∥ TRADITIONAL_LEGITIMACY | ≥% on Culture | +legitimacy/stability |

### S4.B — Apply broker bonuses (interconnect)
Satisfied brokers' bonuses ride `applyGovernmentComponentEffects` (emit a `StorytellerEffect` tagged
`BROKER:<id>`, cleared when unsatisfied), or directly buff the Capacity/Mandate computations. Recompute
on the existing politics-drift cron (where component effects already recompute). Query
`getPowerBrokers({countryId})` for the UI.

### S4.C — Broker demands / Stimuli (deferred)
A broker whose condition is unmet for N IxWeeks **originates an Issue** ("The Party demands more Interior
funding") via the National Issues engine — the "Other Powers originate Stimuli" half. Catalog the demand
templates; ship the bonus side (S4.A/B) first.

### S4.D — Player selection + Editor (deferred; the only part needing a table)
MVP derives *all* unlocked brokers as active. Keaor's design lets the player **select 2–6 archetypes**
(a "Power Broker step" after Government Components in the builder). That choice needs a small `PowerBroker`
table (countryId, archetypeId, customName). Defer until the derived MVP proves the mechanic.

## UI
A **Power Brokers panel** (MyCountry politics/overview): each active broker with unlock status, its
condition (met / `gapPercent` short, with the dept-spend bar), and the bonus it confers. Mirrors the
existing component/synergy displays.

## Recommended boundary (ponytail)
Ship **S4.A + S4.B + UI** as Stage 4 v1 — fully **derived** (no table), **bonus-side only** (no demands).
That delivers "your build summons brokers who reward you for feeding them" with zero schema change. Defer
**S4.C** (demands/Issues) and **S4.D** (selection table + Editor) to follow-ups once it's proven.

## Build order
S4.A (pure catalog + derive + test) → S4.B (apply via component-effects channel + `getPowerBrokers`) →
UI panel. Then decide on S4.C / S4.D.

## Open design calls (settle before S4.A)
1. **Derived vs selected** for v1 — recommend **derived** (no table). Selection = S4.D.
2. **Threshold `minPercent`** per condition — start ~15% of budget on the broker's categories; tune.
3. **Negative bonuses / tension** (Generals over-fed → −Mandate; Magnates → −cohesion) in v1 or later —
   recommend include the *positive* bonus in v1, layer tensions with S4.C demands.
