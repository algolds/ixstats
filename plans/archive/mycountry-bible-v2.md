# MyCountry Design & Product Bible — v2 (Refined)

**Status:** draft · **Branch:** v2 · **Supersedes:** design-bible v1 ([labs/design-bible](../src/app/labs/design-bible/page.tsx)) · **Grounds:** the 4 superpowers specs, mycountry-core-loops-design, community-feedback-audit, chatgpt-logs, community-logs, and a full audit of the shipped code.

> v1 (ChatGPT-generated, Jun 30) was an excellent *maximalist* vision. Every place it went **more mechanical**, the lead playtester (Urcea) was asking for **less**. v2's job is to encode **"less, but legible"** — which is also the lazier build. This is not a rewrite of the north star; it's a re-weighting toward what the community actually validated and what the code already proves works.

---

## 0. The four conflicts v2 resolves (read this first)

Every downstream section flows from these. v1 left them ambiguous; v2 decides them.

| # | Conflict (v1 vs. feedback) | v2 resolution |
|---|---|---|
| **1** | Deliberation as *the game* (v1 §meetings) vs. *"fewer clicks, instant + cooldown"* (Urcea) | **Deliberation is opt-in depth.** Default path = declare → instant commit (cooldown-gated). Full Convene→Deliberate→Commit is reserved for crises, targeted actions, and players who want negotiation as content. |
| **2** | Intent Engine *dynamically generates* Plan A/B/C (v1 §intent) vs. *"how without barry-ing it"* / Rule 2 (Urcea) | **Intent is a view over existing engines**, not a new generator. An intent = a tagged goal that re-skins relevant **National Issues** as resistance and surfaces **Policy registry** entries as its "plans." No bespoke plan-authoring, no scaling wall, no DAG (yet). |
| **3** | Politics *emergent/mechanized* like Diplomacy (v1 §domains) vs. *"Politics must stay player-fiat"* (Keaor) | **Diplomacy = mold systems to fit (consensus); Politics = let players fiat (vision).** They do NOT share one grammar. Politics is "an extension of editor" that *informs* other systems; the sim never overrides the player's declared political reality. |
| **4** | Relationships *quantified* 0–100 (v1 §concord) vs. *"why quantified… players will ignore it"* (Urcea) → *"I will hide the percentage"* (Heku) | **Player-to-player relations are bands-only and always player-overridable.** You cannot be constrained by a number you can set. Raw math lives in an engineering appendix, never the UI. |

**The through-line:** *less management, more legibility.* Replace "hope someone notices a wiki edit" with "the ledger shows everything," and replace "manage a score" with "declare a stance and read a headline."

---

## 1. Product Philosophy `#philosophy`

**North star (sharpened):**

> **MyCountry is not a nation simulator. It is an *executive decision simulator*. You do not play the country — you play the government currently trying to steer it.**

This is the most differentiating sentence in the entire corpus and v1 buried it. Lead with it. It retroactively justifies every subsystem: Policies = *directing* government, Meetings = *coordinating* it, CivCap = its *bandwidth*, Power Brokers = its *constraints*, Fog = its *incompetence*, Diplomacy = its *interaction*.

**The three pillars (co-equal, none optional):**

1. **Facilitate intent.** Ask *"what is your government trying to accomplish?"* — never *"tune this slider."* (Urcea/Keaor)
2. **Data is the lore.** There is no gap between the written world and the world-state. The engine is a *living ledger, not a cage.* (Heku)
3. **Governance is legible.** Every change is bounded, logged, and diffable. Nobody can quietly stat-wank; the guardrail is *visible*, not asserted. (Burg) — **already shipped:** [CountryChangeLog](../prisma/schema/government.prisma) + [CountryChangeLogTimeline.tsx](../src/components/executive/CountryChangeLogTimeline.tsx).

**The acceptance test (Urcea's, now canon):** For any mechanic ask — *"would a player ignore this for RP/worldbuilding purposes?"* If yes: cut it, hide it, or make it player-overridable. A feature people feel they *must ignore* is worse than no feature.

> **Changed from v1:** promoted the "executive, not nation" thesis to the headline; added pillars 2 & 3 explicitly (v1 implied them); added the acceptance test as a rule.

---

## 2. Gameplay Grammar `#grammar`

v1 presents a 9-step grammar (Vision→Intent→Deliberation→Commitment→Execution→Reaction→Adaptation→Consequences→History) as *mandatory for every action.* That is the click-tax Urcea rejects.

**v2 splits grammar into two layers:**

**A. The structural invariant (enforced in code — the real law):**
```
Action → World Effect → Narrative → Ledger
```
This is the **canonical loop.** It is enforceable because one dispatcher does all four: [`recordCountryEvent`](../src/lib/country-event-spine.ts) → bounded stat change (FIELD_BOUNDS) → ThinkPages headline → CountryChangeLog row. *Every mutating action routes through it.* You cannot change the world without producing narrative and a ledger entry, because the same call does both. **This** is the immutable grammar.

**B. The narrative frame (a lens, not a gate):**
```
Vision → Intent → [Deliberation] → Commitment → Reaction → [Adaptation] → History
```
The bracketed steps **collapse by default.** Declaring an intent commits it instantly; a cooldown ring enforces pacing where spacing is the actual mechanic (Urcea: *"replace with cooldown if spacing is critical"*). The expanded pipeline appears only when the player opts into depth.

> **Changed from v1:** demoted the 9-step grammar from "law every subsystem must obey" to "narrative frame with collapsible steps"; elevated the 4-step canonical loop to the enforced invariant.

---

## 3. Intent Engine `#intent`

**Reality check:** 0% built. No `NationalIntent` model, no router. v1 reads as shipped; it is a proposal.

**v2 redesign — Intent as a *view*, not an engine (resolves Conflict #2):**

An **Intent** is a lightweight tagged goal (`title`, `category`, `status`, optional `visionId`). It does **not** own a plan generator. Instead:

- **Resistance** = existing **National Issues** filtered/spawned against the intent's `category` (the issues engine is the gold-standard closed loop, already ON).
- **"Plans"** = existing **Policy registry** entries ([policies/registry.ts](../src/lib/policies/registry.ts)) surfaced as suggestions, plus the option to draft a custom policy. No dynamic Plan A/B/C authoring — the "plans" are the policies you already have.
- **Progress** = derived from linked issue outcomes + active policy effects. No new sim.

This kills the "barry it" problem (nothing to hand-author), honors Rule 2 (the *system* surfaces options from a bounded registry, the UI doesn't invent them), and reuses two shipped closed loops.

**Cut from v2 (YAGNI until the flat loop proves fun):** `IntentDependency`, the DAG, blocked→proposed prerequisite transitions, VISION/STRATEGIC/OPERATIONAL as hard DB layers. Ship intents as a **flat list with an optional parent link.** Add the graph only if players demonstrably want dependency chains.

**Minimal schema (one model, not two):**
```prisma
model NationalIntent {
  id, countryId, title, category, status,   // proposed|active|completed|abandoned
  parentId String?                           // optional soft grouping, no cascade graph
  progress Float @default(0)                 // derived, cached
}
```

> **Changed from v1:** collapsed 2 models → 1; removed the DAG and dynamic plan generator; redefined intent as a wrapper over Issues + Policy registry.

---

## 4. Meeting System `#meetings`

**Reality check:** pure CRUD ([meetings.ts](../src/server/api/routers/quickactions/meetings.ts)). Urcea saw it: *"cabinet meetings right now are more like a planner widget than what you intended."* Confirmed.

**v2 repositions meetings from "the primary interface" to "the opt-in depth surface" (resolves Conflict #1).** Keaor already gave the mandate v1 ignored: *"managing meeting minutes is not an engaging mechanic past the major elements"*; *"keep it more abstract than specific selections… outside of Crisis meetings."*

**When a meeting is warranted (and when it is NOT):**

| Meeting type | Needed because | Default without meeting |
|---|---|---|
| **Crisis** | zero-prep triage, high fog — the drama *is* the content | n/a (always convened) |
| **Bilateral / Foreign summit** | genuinely needs a *target* (which country) | — |
| **Legislative gambit** | needs a *target* (which opposition party) | — |
| **Budget / Infra / Economic** | **does NOT** need micromanagement | *"a flat trade/econ modifier set depending on prep time, meeting time, and ministers/type"* (Keaor) — one action, no minutes |

So: most governance commits instantly. Meetings exist for targeting, crises, and players who *want* the negotiation. Ministers matter by *"reducing time requirement or improving information accuracy/effects,"* not by forcing a debate UI every time.

> **Changed from v1:** meetings are no longer "the heart of the game" / the thing you click *instead of* creating a policy; they're opt-in. UX Commandment 4 updated to match (see §8).

---

## 5. Executive Dashboard — The Situation Room `#dashboard`

**Reality check:** not built; [getCountryDashboard](../src/server/api/routers/mycountry/dashboard.ts) returns vitality stat scores — the KPI sheet the spec says to replace.

**v2 keeps this section nearly intact — it is the antidote to Urcea's "3 screens, dashboard-manager" complaint** and the most player-validated direction. The dashboard answers one question: *"What needs my attention today?"*

- **Attention model:** Decide / Review / Monitor / Celebrate. Every card demands a decision or it belongs in a deep panel.
- **"The government never sleeps":** a "since your last session" briefing summarizing offline developments (elections that fired, drift, resolved issues).
- **Fog runs through the briefing too** (v1 only applied it to meetings): under low government efficiency, estimates are masked to qualitative bands. The recon primitives already exist ([statecraft-recon.ts](../src/lib/statecraft-recon.ts)) — wire the promise to the built primitive.

**Moved to an implementation note (not bible canon):** the exact priority-scoring weights (`+100 decide`, `+200 emergency`, etc.). Those are *tuning*, not design. Keep the categories in the bible; keep the numbers in code.

> **Changed from v1:** applied Fog to the dashboard, not just meetings; demoted the scoring formula from canon to tuning.

---

## 6. Executive Domains — Diplomacy & Politics `#domains`

**v1 unifies Diplomacy and Politics under one Declare→Convene→Authorize→Review grammar.** v2 **splits them**, because the community was explicit that they are different *kinds* of systems (resolves Conflict #3).

**Diplomacy — "mold the systems to fit purpose" (vision + consensus):**
- Urcea independently asked for exactly this: *"eliminate Diplomacy as a separate thing entirely, add it as a sub under Executive."* **Do it** — collapse the top-level Diplomacy nav into Executive.
- Build embassies-as-departments **on top of the existing relations loop** ([foreignPolicy.ts](../src/server/api/routers/diplomacy/policies/foreignPolicy.ts) already closes Action→Effect→Narrative). Do **not** introduce a parallel `ForeignMission` model — extend what works.
- **＋ADD Stances** (Keaor): players set a broad foreign-policy posture that slowly ticks hidden relations; they never touch the number.
- **＋ADD relative-development asymmetry** (Keaor, absent from all code): *"free trade with Pooristan ≠ Goldland"* — effects re-priced by relative development of the two nations. Highest-flavor "feels geopolitical not spreadsheet" win in the corpus.

**Politics — "let the player fiat it" (vision + fiat):**
- Keaor is emphatic: *"Politics should be balanced such that the player can fiat it… players define their own electoral cycles and parties… it's almost an extension of editor."*
- The sim **informs** politics (party support drifts from economy/issues) but **never overrides** the player's declared reality. Elections are a *checkpoint the player configures*, not an emergent verdict the engine imposes.
- Power Brokers: player **selects 2–6 archetypes** ([statecraft-power-brokers.ts](../src/lib/statecraft-power-brokers.ts) has the set) as their primary internal friction — not all active at once. Approval is drawn from Editor policies + components + thresholds ("spending in their chosen departments"), and *you always know a broker's stance before acting* (Keaor: no surprise penalties on things you configured).

> **Changed from v1:** Diplomacy and Politics no longer share one grammar; Diplomacy folds into Executive; Politics is fiat-friendly and never overridden by sim; added Stances + relative-development asymmetry + broker selection.

---

## 7. Concord Engine `#concord`

**Reality check:** largely built (diplomatic NPC personality/Markov, drift crons on IxTime, scenario generator). The framing is accurate.

**v2's one hard rule (resolves Conflict #4):** the 5-state Markov and the weighted-context formula are **engineering internals.** They must **never** surface as numbers to the player.
- Player-facing: **qualitative bands only** (Tense / Neutral / Cooperative / Aligned).
- **Player-to-player relations are always player-overridable** — if two players decide they're allies, the band follows the players, not the other way around. (This is the *entire* resolution to Urcea's core objection: you can't be constrained by a number you can set.)
- Move all formulas (`M_Context = 0.4W_Act + 0.25W_Econ…`) to an **appendix**; the player-facing bible shows bands and Stances only.

> **Changed from v1:** raw formulas moved out of the player-facing spec into an engineering appendix; added the "always player-overridable" rule for P2P relations.

---

## 8. Gameplay Loops & UX Commandments `#loops-ux`

**v1 defines "9 gameplay loops the engine coordinates."** v2 demotes them: nine parallel loops is the "game modes" trap the corpus itself warned against (*"they should all coexist as lenses, not competing modes"*). **They are lenses on the one canonical loop, not nine loops.**

**UX Commandments — v2 adds the two Urcea's feedback demands and v1 omitted:**

| # | Commandment |
|---|---|
| 1 | Begin with a goal. |
| 2 | Never make numbers the fantasy — metrics are evidence, not the toy. |
| 3 | The dashboard always answers "what needs my attention today?" |
| 4 | **Meetings are playable *when convened* — opt-in depth, not the default path.** *(changed)* |
| 5 | Complexity emerges from interaction, not menus. |
| 6 | Always show *why this is hard* (who objects, what capacity is missing, which law blocks it). |
| 7 | Advanced control is optional; new players govern through intent alone. |
| 8 | Every commitment deserves review. |
| 9 | History is national memory, not a log dump. |
| 10 | Don't strand mechanics — if a subsystem can't express the canonical loop, redesign it. |
| **11** | **Fewer clicks than you think. Default to instant + cooldown; reserve multi-step flows for when spacing is the mechanic.** *(NEW — Urcea)* |
| **12** | **One navigator. Everything one click away.** *(NEW — Urcea; fulfilled by [MyCountryRouter](../src/components/mycountry/MyCountryRouter.tsx) single-page nav.)* |

**＋ADD the Player Journey** (Hour 1 → Week 1 → Month 1 → Year 1 → Veteran), explicitly naming *what becomes automatic* over time — the concrete face of Commandment 7.

> **Changed from v1:** demoted "9 loops" to "lenses"; added Commandments 11 & 12; updated 4.

---

## 9. Brand Architecture `#branding`

No design change. Pin to the single source of truth: [buildVersion.ts](../src/lib/buildVersion.ts) + `revision.md`. One clarifying line for this audit: **MyCountry is an *engine*; the Executive / Diplomacy / Politics "domains" are *views into it*, not separate apps.** Reinforces §6's fold-diplomacy-into-executive decision.

---

## 10. Facet Design System `#playground`

Keep intact — most finished, least contested section. One gameplay tie-in: the glass **depth hierarchy** (parent → child → interactive → modal) maps to **progressive disclosure** — Level-1 intent lives at parent depth; raw numbers live at modal depth. The visual system *is* the "advanced control is optional" promise made physical.

---

## Build ordering (highest validated-payoff / lowest effort first)

1. **Universalize the spine** — take `recordCountryEvent` from 3 callers to *all* mutating actions; delete the scattered `generateDiplomaticNews` / dead `activity-hooks` paths. Makes "data = lore" structural + gives Burg's guarantee for free. *Deletion, not addition.*
2. **Situation Room dashboard** (§5) — the most player-validated surface; replaces the KPI sheet; fixes the "3 screens" complaint.
3. **Bands-only relations + Stances** (§6, §7) — hide the percentages; the code already computes them.
4. **Intent-as-view** (§3) — thin wrapper over Issues + Policy registry; no new engine.
5. **Fold Diplomacy into Executive** (§6) + broker selection.
6. **Opt-in meetings** (§4) — crisis + targeted only; everything else instant.
7. **Relative-development asymmetry** (§6) — the flavor win, last because it's net-new.

## Open questions for the user

- **Casual vs. depth default:** should new nations start in "instant everything" mode and *unlock* deliberation, or expose both from day one? (Urcea floated "casual mode?".)
- **Politics fiat boundary:** how far can a player override an election result before it breaks other players' trust in the shared world? (The one place fiat and consensus collide.)
- **Intent granularity:** flat list forever, or add soft parent-grouping in v1 of the build?
