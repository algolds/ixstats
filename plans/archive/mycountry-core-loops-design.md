# MyCountry Core Loops — Executive / Diplomacy / Politics (design)

**Date:** 2026-06-20 · **Branch:** v2 · **Status:** Phase 1–5 IMPLEMENTED (see "Implemented" below)

## ✅ Implemented (2026-06-20)

| Item | What shipped | Files |
|---|---|---|
| **Wire up issues** | `issuesAutoGenerate` default → ON; background generation cron (every 15m, per-country debounced via `shouldEvaluate`). 114 templates already seeded; resolving an issue already applies bounded+audited consequences. | `gameplay-flags.ts`, `national-issues-generation-cron.ts`, `server.mjs` |
| **Diplomacy root fix** | `establishEmbassy` now auto-creates a `DiplomaticRelation` (unblocks Relations list + Foreign Policy dropdown), fires the `embassy_established` ThinkPages news (was a dead import), and the activity-feed hook. | `diplomacy/embassies/establish.ts` |
| **Scheduled elections** | Extracted `simulateElectionCore` into a shared lib (mutation + cron share it); cron resolves due elections on the IxTime clock and auto-schedules the next a term later. | `election-simulation.ts`, `election-cron.ts`, `elections/elections.ts`, `server.mjs` |
| **Policies → sim** | Activating a policy emits a `StorytellerEffect` (`growth_rate_modifier`, tagged `POLICY:<id>`, ±5% clamp) that the economic engine already reads live; suspend/repeal/delete clear it. | `policy-effects-sync.ts`, `policies/crud.ts` |
| **Living politics** | Drift cron (every 6h): party `currentSupport` drifts from economy + mean-reverts to `baseSupport`; political metrics recomputed via `applyGovernmentComponentEffects`. | `politics-drift-cron.ts`, `server.mjs` |

**Deliberately deferred:** policy treasury debit (tax system is `TAX_SYSTEM_TEMP_DISABLED` — no clean reserve field yet); the unified `recordCountryEvent` spine + `CountryChangeLog` ledger (needs a Prisma migration — DB writes are gated); wiki-paragraph generator; decisions→effects bridge; NPC diplomacy inbox. The narrative side of the spine (news + activity hooks) is now wired per-action instead.

---

*Original design follows.*

**Status:** design (analysis + plan)
**Grounding:** [ixstates-community-feedback-analysis.md](ixstates-community-feedback-analysis.md), product vision (wiki→maps→world→thinkpages→vault), and a full read of the executive/diplomacy/politics implementation + the systems/design docs.

---

## 0. The one-sentence diagnosis

**The engines are built; the loops are open.** Every pillar has substantial DB-backed machinery, but in almost every case a player action stops at "row saved" instead of completing the canonical loop: **action → world effect → narrative → ledger**. Only the **National Issues engine** closes that loop end-to-end — and it ships *disabled by default* (`GAMEPLAY_FLAGS`, narrative mode). So the work is not "build features," it's **close loops and route them through one narrative+ledger spine.** That is exactly what the community feedback asked for: *system serves story*, *governance legible*, *data = lore = world*.

---

## 1. The canonical loop (worldbuilding-first)

The platform's real loop, mapped to the five pillars the user named:

```
  WIKI            MAPS            WORLD (sim)         THINKPAGES        VAULT
  "creates"       "exists"        "exists within"     "is alive"        "metagame"
     │               │                │                   │                │
  AUTHOR  ───────►  SIMULATE  ─────► NARRATE  ─────────► PARTICIPATE ───► REWARD
  builder +        atomic comps +   action→effect→      auto-news +       dividends +
  map editor +     tier engine on   bounded ledger      players react     IxC for
  wiki links       IxTime autopilot (audit/diff)        in-world          engaging
     ▲                                                                       │
     └───────────────────────────  incentive ring  ◄────────────────────────┘
```

Executive / Diplomacy / Politics are the **NARRATE + PARTICIPATE** engines. Their job is to take a player intent and turn it into (a) a *bounded, audited change to the world ledger* and (b) *in-world narrative* that other players see and react to. Worldbuilding-first means: **the narrative output is the product; the mechanic is plumbing.** Demo through the headline, not the formula.

---

## 2. Current state — verified (what closes the loop, what doesn't)

| Pillar | Sub-feature | DB/CRUD | World effect | Narrative out | Verdict |
|---|---|---|---|---|---|
| **Executive** | National Issues | ✅ | ✅ `applyConsequence` (bounded+audited) | ✅ news | **Closed loop** — but OFF by default; gradual effects TODO |
| | Policies | ✅ | ❌ multipliers computed, **never read by sim** | ✅ news | Open — cosmetic on sim |
| | Meetings/Decisions | ✅ | ❌ `estimatedEffect`/`relatedPolicyId` inert | ❌ | Open — record-keeping only |
| | Cabinet/Officials | ✅ | ❌ no capability effect | ❌ | Open — data only |
| **Diplomacy** | Embassies | ✅ | partial (budget/missions) | ❌ `embassy_established` template exists, **import dead** | Works, but doesn't seed relations or news |
| | Relations | ✅ CRUD | ❌ no auto-populate, no events | ❌ | Open — **root blocker** (empties FP dropdown) |
| | Treaties | model-only | ❌ | ❌ | Stub |
| | Foreign Policy | ✅ | ✅ effect+relationship | ✅ news | **Closed loop** — the model to copy |
| **Politics** | Elections | ✅ engine | ✅ seats/stability/StorytellerEffect | ✅ news | Engine done, **no scheduler** (manual only) |
| | Parties | ✅ CRUD | ❌ `currentSupport` frozen between elections | ❌ | Open — no living support |
| | Stability/metrics | ✅ fields | ❌ only moves on manual election | ❌ | Display-only, no continuous sim |
| | Government/Cabinet | ✅ | partial (component effects exist, not scheduled) | ❌ | State editor |

**Two things already do it right** and are the templates for everything else: **National Issues** (`src/lib/national-issues-consequences.ts` — `applyConsequence` with `FIELD_BOUNDS` clamping + `NationalIssueConsequence` audit rows + follow-up chains) and **Foreign Policy** (`diplomacy/policies/foreignPolicy.ts` — transactional effect + auto-news).

---

## 3. The single biggest lever — one narrative+ledger spine

Right now narrative is bolted on per-procedure (`void generateDiplomaticNews(...)` scattered across ~10 files; a fully-built `activity-hooks.ts` that has **zero callers**; a dead `calculateRealTimePolicyEffects` duplicated in 3 files). Consolidate into **one dispatcher** that every Executive/Diplomacy/Politics action calls:

```
recordCountryEvent({ countryId, type, consequences, narrative })
  1. applyConsequence(...)        // bounded stat change + audit row  (REUSE national-issues engine)
  2. generateDiplomaticNews(...)  // ThinkPages in-world headline      (REUSE, already works)
  3. ActivityHooks(...)           // activity-feed entry               (REVIVE dead activity-hooks.ts)
  4. [Phase 2] generateWikiParagraph(...)  // wiki-ready prose         (NET-NEW, small)
```

Why this is the keystone:
- **It makes "governance legible" structural, not a feature.** Every change in the game flows through `applyConsequence` → every change is bounded by `FIELD_BOUNDS` and written to an audit row. That *is* Burg's demo #1 (the stat-change diff timeline) for free.
- **It makes "system serves story" the default.** You cannot change the world without producing narrative, because the same call does both.
- **It kills three piles of dead/duplicated code** (ponytail: this is deletion, not addition).
- **It's reuse, not rebuild** — `applyConsequence`, `generateDiplomaticNews`, and `activity-hooks.ts` all already exist and work.

This spine is the prerequisite that makes the per-pillar loops below cheap.

---

## 4. Per-pillar loop designs

### 4A. Executive — "govern the week"
**Loop:** issues arrive from the state of your world → you respond → ongoing policies set direction → discrete decisions resolve → all move the ledger and hit the feed.

1. **Turn on National Issues generation, tier-gated.** The loop is built and audited; flip `issuesAutoGenerate` on with a sane cadence (e.g. 1 active issue per N IxTime-days, scaled by tier) so the inbox is the heartbeat of Executive. Add the TODO gradual/duration effects.
2. **Make policies real:** consume `Policy.calculatedEffects` (already computed!) inside `calculations.ts`/`enhanced-economic-calculations.ts` as bounded ongoing multipliers; debit `implementationCost` from treasury on activate; add maintenance to recurring spend. Route through the spine → news already fires. *Now "Policy Strategy" affects the world it claims to.*
3. **Make decisions real:** a `MeetingDecision` with `estimatedEffect` → `recordCountryEvent` (one-time consequence) and/or spawns a Policy/Issue via `relatedPolicyId`. Decision Center stops being a notepad.
4. **Cabinet → capacity:** officials/departments feed `governmentEffectiveness` and the **Civil Service Capacity** model already built in [Component Integration](Component%20Integration%20with%20MyCountry%20Systems.md). Appointments matter.

**Worldbuilding payoff:** the executive desk becomes a stream of in-world headlines ("Cabinet enacts X; analysts project Y") grounded in real stat moves — the Urcea demo (#2): one intent in, narrative out.

### 4B. Diplomacy — "the living map of relationships"
**Loop:** embassies open relationships → relationships enable actions & treaties → NPCs react on their own → geopolitics becomes a running ThinkPages story.

1. **Fix the root blocker:** `establishEmbassy` must **auto-create a `DiplomaticRelation`** and fire the ready-but-unwired `embassy_established` news (the import is already there, just dead). This single fix populates the relations list *and* the foreign-policy target dropdown (both empty today purely because relations never auto-populate).
2. **Relationship changes emit events:** add a `relationship_change` news template; route `updateRelationship` through the spine. Relationship drift from the existing **NPC personality/Markov** system (`diplomatic-npc-personality.ts`) becomes visible narrative.
3. **NPC reactive events as an inbox:** the **Diplomatic Response AI** already generates condition-grounded events; surface the top-N as a diplomacy inbox mirroring National Issues (same respond→consequence→news shape). This is the "living, reactive world" the docs promise, made playable.
4. **Minimal treaties on top of relations:** propose/accept → trade multiplier (the `sharedData.ts` tariff-reduction read already exists) + news. Small, because relations now exist.
5. **Surface the embassy upgrade UI** (backend `upgradeEmbassy` is done; only the trigger is missing).

**Worldbuilding payoff:** diplomacy is the *player-to-player* pillar — every action is canon-visible on ThinkPages, and the world reacts even when you're offline.

### 4C. Politics — "the clock that runs while you're away"
**Loop:** elections fire on the IxTime calendar → results reshape legislature + stability → economy/policies shift party support → next election auto-schedules. Runs autonomously — the "dynamic real world" pillar.

1. **Scheduled elections (biggest single win):** add a `server.mjs` cron that finds `status:"upcoming"` elections with `scheduledIxTime <= IxTime.getCurrentIxTime()`, runs the **existing** `simulateElection`, and auto-creates the next election at `termLength`. The engine is excellent and complete — *only the trigger is missing.* (⚠️ IxTime, not wall-clock — this is the #1 recurring bug class here.)
2. **Living party support:** factor `simulateElection`'s economic modifier into a recurring **poll drift** between elections (economy + active policies + recent issues nudge `currentSupport`). Parties stop being frozen.
3. **Stability as a simulated quantity:** schedule `government.recalculateEffects` (already derives stability/democracy/effectiveness from components in `government-component-effects.ts`) + factor in active policies and recent issue outcomes. Stability *moves* continuously.
4. **Internal Stability = legible, not hand-editable:** rather than wiring the read-only `GovernmentMetricsEditor` to the unused `updatePoliticalMetrics` mutation, **link each metric to its source** (components / policies / recent events) — this reinforces the governance-legible thesis (you change stability by governing, not by typing a number). Addresses the user's "link Internal Stability to where you edit the data" note the *right* way.
5. **Unify the three `politicalStability` representations** (`GovernmentStructure` Float, `Country` String enum, Defense Float) into one source of truth.

**Worldbuilding payoff:** politics is the proof that the world is *dynamic and real* — return after a week and your legislature has turned over, support has shifted, and the feed tells the story.

---

## 5. The governance-legible layer (Burg's demo, mostly free)

The spine (§3) already routes every change through `applyConsequence` (bounded + audited). Add:
- **A country change-log timeline** UI: read the audit rows (generalize `NationalIssueConsequence` into a `CountryChangeLog` the spine writes) → a diff timeline on the country page. "Here is every change, who/what caused it, bounded by the growth model."
- **Surface the growth-engine guardrail:** when the tier engine clamps/smooths an implausible jump, show it. Turns the invisible guardrail into the reassurance Burg wanted ("the ledger shows everything; overnight 10× GDP is implausible by construction").

This is **demo #1** from the feedback doc, achieved as a *byproduct* of the spine.

---

## 6. Worldbuilding integration (close the wiki + map ends)

- **Wiki-ready paragraph generator (net-new, small):** `generateWikiParagraph(event)` → wikitext prose for the same events the spine already narrates. Offer as copy-paste / "append to article." This is the missing half of the Urcea demo (#2) — *one intent → ThinkPages post **and** wiki paragraph, zero table editing.* Today only parse-direction (wikitext→entity) and ThinkPages news exist; nothing emits prose.
- **InlineWiki everywhere:** adopt the planned `InlineWiki` primitive ([mycountry-ux-ui-refactor.md](mycountry-ux-ui-refactor.md)) so canon lore is woven into the command surfaces, not siloed in a tab.
- **Ground loops in geography:** issues/events/policies can key off `CountryGeoProfile` (climate/coastline/arable → modifiers; tier-0 model, Phase A complete) so the *story makes sense from the place*. Surface the "Wiki Coverage" map mode as a worldbuilding nudge.

---

## 7. Phasing (highest narrative payoff / lowest effort first)

1. **Spine + governance ledger** (§3, §5) — unlocks everything, deletes dead code, gives Burg's demo. *Foundation.*
2. **Diplomacy root fix** (§4B.1) — embassy→relation→news; unblocks relations + FP dropdown with one change. *Cheapest visible win.*
3. **Scheduled elections** (§4C.1) — engine exists; cron only. *Biggest "world is alive" payoff per effort.*
4. **Policies → sim** (§4A.2) — make the existing computed multipliers actually apply. *Makes Executive honest.*
5. **Living support + simulated stability** (§4C.2-3), **NPC diplomacy inbox** (§4B.3), **decisions real** (§4A.3).
6. **Wiki-paragraph generator** (§6) + InlineWiki rollout. *Completes the worldbuilding circle.*

---

## 8. Risks & gotchas (verified)

- **IxTime vs wall-clock** is the #1 recurring bug class (component rollout never activated; auctions just got fixed). Every scheduled loop (elections, polls, stability recompute) MUST compare against `IxTime.getCurrentIxTime()`. (Auctions are deliberately the exception — real-time.)
- **`GAMEPLAY_FLAGS` defaults to narrative mode (loops off).** Turning loops on is a deliberate product decision; gate by tier/cadence and make it reversible.
- **Stub signals that look live:** ~30 hardcoded TODO values (diplomatic/military/social scores, democracy/corruption indices). Don't build a loop on a number that isn't real yet — verify each input.
- **Tax system is disabled** (`TAX_SYSTEM_TEMP_DISABLED`); policy treasury debits depend on it landing.
- **Three dead/duplicated code piles** (`activity-hooks.ts` unused, `calculateRealTimePolicyEffects` ×3, scattered news calls) — the spine consolidates them; delete as you go.

---

## Key file anchors
- Consequence engine (reuse): `src/lib/national-issues-consequences.ts` (`applyConsequence`, `FIELD_BOUNDS`)
- News (reuse): `src/lib/diplomatic-news-generator.ts` (`generateDiplomaticNews`, 16 templates)
- Activity hooks (revive): `src/lib/activity-hooks.ts`
- Sim core (policy wiring target): `src/lib/calculations.ts`, `src/lib/enhanced-economic-calculations.ts`
- Election engine (add cron): `src/server/api/routers/elections/elections.ts` (`simulateElection`); cron host `server.mjs`
- Embassy root fix: `src/server/api/routers/diplomacy/embassies/establish.ts`
- Component/capacity model: `src/lib/government-component-effects.ts`, `government-synergy.ts`, [Component Integration](Component%20Integration%20with%20MyCountry%20Systems.md)
- Flags: `src/lib/gameplay-flags.ts` · Time: `src/lib/ixtime.ts`
