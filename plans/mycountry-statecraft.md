# Statecraft — the MyCountry gameplay loop

Date: 2026-06-25 · branch v2. Design spec from the June 2026 co-design sessions (Heku + Keaor + community
feedback). Companion to `plans/ixstates-community-feedback-analysis.md`, `plans/mycountry-core-loops-design.md`,
and `plans/mycountry-lore-alignment*.md`.

**Statecraft** is the name of the MyCountry loop. Its three resources are the **levers**:
**Capacity · Treasury · Mandate**.

The design answer to the community's principal objection ("too many actions hidden behind mechanics →
feels like a browser game"): the mechanism never sits in the foreground. **A situation comes in as
fiction; you decide; the consequence comes back as fiction; the numbers live in the middle, revealed
only when you pay to look.** Diegetic in, narrative out, math in between.

Almost nothing here is a new system. Statecraft is **wiring systems you already have into one loop** —
issues, cabinet meetings, policies, diplomacy, elections, atomic components — and staging the rest as
content that spends the same three levers.

---

## 1. The loop: IN → SEE → OUT → RIPPLE

One loop, repeated weekly (IxTime):

1. **IN — a Stimulus arrives.** An Issue (domestic), an overture/threat (foreign), or a Bill/coalition
   demand (politics). You didn't ask for it; the World or another Power dealt it.
2. **SEE — recon (optional).** You spend **Capacity** (+ Treasury) to convene a Meeting and de-fog the
   Stimulus. The result arrives as *minister's minutes / an ambassador's cable / a whip count* —
   truthful, but only as complete as your government can actually see (§4).
3. **OUT — you commit.** You enact a Policy, propose a Foreign Policy/Event, or table a Bill — paying
   the relevant levers. You may commit uninformed; recon is leverage, never a gate.
4. **RIPPLE — the World adjudicates.** Your commitment becomes a bounded world-state change + narrative
   (Chronicle), and **emits new Stimuli** — often into the *other* arenas, sometimes aimed at other
   Powers. Every OUT becomes someone's next IN.

The player's entire surface area is two verbs: **See** (pay to look) and **Commit** (pay to act). You
never operate machinery — you choose and spend.

---

## 2. The three actors

- **You** — decide & spend. Nothing else.
- **The World** (engine + IxTime) — deals Stimuli on the weekly clock, answers recon *truthfully with
  fog*, adjudicates Commitments into bounded consequence + narrative, and recharges your levers from
  your nation's state.
- **Other Powers** — *foreign nations AND internal power brokers* (§7). They originate Stimuli aimed at
  you and gate the Commitments that need their consent. The only place another human can touch your loop
  is a diplomatic handshake — never your ability to look.

Closure: **every actor's OUT is another's IN.** It's a three-body circulation, not three pipelines.

---

## 3. The three levers (Capacity · Treasury · Mandate)

Not "currencies" — three different *kinds* of resource. That heterogeneity is deliberate; it's what
stops them blurring. Two and a half already exist in code.

### Capacity — a **rate** (administrative bandwidth)
- **Is:** how much your civil service can handle per week.
- **Code home:** `governmentCapacityIndex` (`src/lib/atomic-economic-integration.ts`), raised by
  bureaucracy/merit/e-gov atoms; per-Policy demand is `GovernmentComponent.requiredCapacity`.
- **Regen:** each IxTime week — bandwidth, not a hoard.
- **Spent on:** each Meeting's recon depth; each active Policy's upkeep.
- **Low →** recon comes back **cloudier and slower** (the never-lie question-marks fire *because* you're
  over-cap); can't sustain more Policies.
- **UI (Keaor):** `Allocated (+Temp) / Total` bar, e.g. `100 (+50) / 300`, green + yellow.

### Treasury — a **stock** (money; reuse, never rebrand)
- **Is:** the actual budget. *Not a game token.*
- **Code home:** the economy sim / `GovernmentStructure.totalBudget`. Regens via tax/GDP.
- **Spent on:** Policy implementation + upkeep, Diplomatic Events, Deployments (`EmbassyMission.cost`).
- **Low →** deficit/debt — the economy's *existing* consequences, not a new fail state.
- **Rule:** the loop *draws on the treasury you already simulate*. Rebranding money as a currency is the
  exact conflation we're avoiding.

### Mandate — a **standing** (legitimacy you risk, not cash you spend)
- **Is:** your political standing to act.
- **Code home:** `computeApproval` (`src/lib/approval.ts`: leading-party support + stability). Derived,
  not stored.
- **Earned/risked:** popular Commitments build it; unpopular Issue responses, fiat Commitments, and Bills
  against your coalition cost it. *How* it's earned is atom-shaped (Electoral legitimacy lives and dies
  by approval; Charismatic/Traditional is insulated but brittle).
- **Acts as gate + multiplier:** high Mandate → cheaper Bills, bolder moves, buffs to Capacity &
  efficiency; low Mandate → coalitions required, snap-election risk, weaker diplomacy.
- **Foreign twin (already built):** abroad, Mandate's analogue is **Influence + Reputation**
  (`Embassy.influence`/`.reputation`, with `EmbassyMission { cost → influenceReward, reputationReward }`).
  You spend Treasury + Mandate at home to build Influence + Reputation abroad.

> Engine summary: **Capacity gates how much you can see and sustain; Treasury pays for what you enact;
> Mandate is the standing you spend boldness against — and abroad it becomes Influence & Reputation.**

---

## 4. The three arenas — same loop, different counterparty

Domestic, Diplomacy, and Politics are the *same* IN→SEE→OUT→RIPPLE loop. They differ only in **who the
counterparty is, where the fog comes from, and how the Commitment resolves.**

| Beat | Domestic | Diplomacy | Politics |
|---|---|---|---|
| **IN** (Stimulus) | National Issue | foreign overture / threat | Bill / coalition demand |
| **SEE** (recon) | cabinet → *minister's minutes* | embassy + intel → *ambassador's cable* | whip → *vote count* |
| **OUT** (commit) | Policy | Foreign Policy / Diplomatic Event | pass / enforce a Bill |
| **Dominant lever** | Capacity | Treasury + Mandate | Mandate |
| **Fog source** | missing dept / low efficiency | no embassy / weak intel on them | no whip / hostile parties |
| **Resolves by** | **executive fiat** | **foreign consent** | **legislative vote** |

**Executive fiat / foreign consent / legislative vote** is the only structural difference between arenas.
This finally gives the inert politics layer a job (Bills are what the legislature resolves; approval is
what the coalition supplies) and makes elections matter *weekly*, not just at term's end.

**Cross-arena ripple** is what makes it feel interconnected: a Foreign Investment deal (diplomacy)
spawns a domestic Issue ("controversial") and shifts party support (politics); a domestic worker-
protection Policy re-prices a free-trade Foreign Policy (Keaor's Pooristan/Goldland asymmetry); a passed
Bill can *mandate* a diplomacy commitment. A commitment in one arena emits Stimuli in the others — riding
the `recordCountryEvent` spine (designed in `mycountry-core-loops-design.md`).

**Existing plumbing per arena:** Domestic = `national-issues-consequences` (`applyConsequence` +
`FIELD_BOUNDS`), `policy-effects-sync`, `StorytellerEffect`. Diplomacy = `ForeignPolicyAction`,
`Embassy`/`EmbassyMission`, `Alliance`, `CulturalExchange`, `diplomatic-news-generator`. Politics =
`PoliticalParty`, `Legislature`, `LegislativeSeat`, `Election`, the politics-drift cron.

---

## 5. The never-lie contract

**The World may withhold or caveat, but never fabricate.** Recon de-fogs three things consistently — the
**effects**, the **counterparty's likely response**, and your **costs** — in three honest states:

- **Revealed** — you have the relevant component/department and paid the Capacity.
- **Greyed out** — *"no Ecology component / no Environment department"* (you structurally can't see it).
- **Question-marked** — *"may be inaccurate: over civil-service capacity / low efficiency."*

This single rule does triple duty: it kills NS-issue ambiguity (incomplete is honest, not vague), it
justifies Meetings (you pay to *uncover* truth), and it answers the stat-wanking worry (a system that
never lies is the legible ledger). Crucially, the fog is **motivated by your build**, not arbitrary (§6).

---

## 6. Personalization layer — atomic components as the EQ, lore-first as the skin

The loop is **universal**; your **atomic component stack is the equalizer** on all four beats; your
**canon names ride on top**. One engine, every government, in its own words. No new loop architecture —
components are a modifier table consulted at four points:

1. **IN — biases the deck.** Technocratic + Knowledge Economy → innovation Issues; Stratocracy →
   unrest/security Issues; Welfare State → fiscal Issues. Your government attracts the problems it's
   shaped to have.
2. **SEE — your fog *is* your build's blind spots.** Component/dept presence sets recon completeness &
   accuracy. A **Stratocracy genuinely can't read popularity well** (Performance/Charismatic legitimacy
   doesn't track consent); a Democratic + Electoral build reads approval crisply but military readiness
   poorly. Never-lie, parameterized by your atoms.
3. **OUT — gates, prices, flavors.** Synergies → cheaper/stronger Policies; conflicts → blocked/penalized
   commitments; the decision-process atom sets the resolution *flavor* (Autocratic fiat = fast/cheap but
   bleeds Mandate; Consensus = routes through Bills; Oligarchic = brokers gate it).
4. **RIPPLE/recharge — sets regen & magnitude.** Professional Bureaucracy → more Capacity; Electoral
   Legitimacy → approval converts to more Mandate; Federal vs Unitary → national vs per-subdivision
   effects.

**Lore-first = a two-layer split (max flexibility + unified engine):**
- **Surface** — verbatim canon, free text, child rows: their legislature is "the Corcillum," recon
  arrives as "a cable from the Ministry of External Affairs," their fourth branch is "the National Audit
  Council," a chamber is filled "by lot." Type anything (the `GovernmentBranch` / `selectionMethod` /
  free-text-type work from `mycountry-lore-alignment*.md` already unlocked this).
- **Substrate** — the ~90 atoms the engine computes on. It never sees "Corcillum"; it sees
  `LEGISLATIVE + DEMOCRATIC_PROCESS + ELECTORAL_LEGITIMACY`.
- **Bridge** — compose in your words, tag with atoms (or import infers them); **the loop reads atoms and
  speaks your names.** Free text for identity, atoms for mechanics, never collapse one into the other.

Flexibility doesn't cost legibility: because the engine runs on *declared* atoms, anyone can inspect why
your fog is shaped a certain way or your policies are cheap. The build is the ledger.

---

## 7. Power Brokers — the generalized third actor (capstone)

A **Power Broker is an internal "Other Power"**: canon-named (flexible), unlocked by a component synergy,
that **originates Stimuli (its demands) and gates Commitments (its conditions on department spend)** —
exactly like a foreign nation, but inside your borders. "The Party," "The Technocrats," "The Maritime
Sector," "The Imperial Cabinet" — flexibly named on the surface, an atom-gated conditional modifier
underneath (cf. Terra Invicta control points). Example: Technocratic atoms unlock *Power Broker:
Technocrats* → −% domestic Policy upkeep while you fund Science/Education/Commerce depts.

Build it **last** — it only slots in cleanly once the lever spine exists, at which point a broker is
just a config row. Built early, it's scope-scary; built last, it's a table.

---

## 8. Cadence, the Almanac, the Chronicle

- **Weekly, not daily.** IRL time is the only *real* resource the player spends; daily dailies = "be
  online at 9am" = the browser-game feeling we're fleeing. **The government-quality penalty clouds the
  picture, never slows the clock** — a bad government gives a *foggier report at the same time*, not a
  longer wait. Punish with fog, not with waiting.
- **The Almanac** — an always-present IxTime calendar (terms, fiscal years, anniversaries, scheduled
  events, "what day is it"). The community asked for a prominent elections clock; generalize it. *This is
  the cheapest, highest-signal thing to ship first* and it paces everything else.
- **The Chronicle** — every commitment compiles into a readable, wiki-ready national history (numbers as
  connective tissue underneath). The "gameplay" is authoring your nation's history with an engine that
  won't let story and stats silently disagree — the lore-first payoff, via `recordCountryEvent` +
  `diplomatic-news-generator` + `CountryChangeLog`.

---

## 9. Built from (the lazy proof)

| Statecraft piece | Existing code |
|---|---|
| Capacity lever | `atomic-economic-integration.ts` `governmentCapacityIndex`; `GovernmentComponent.requiredCapacity` |
| Treasury lever | economy sim; `GovernmentStructure.totalBudget` |
| Mandate lever | `approval.ts` `computeApproval`; `stability-formulas.ts` |
| Influence/Reputation (foreign Mandate) | `Embassy.influence`/`.reputation`; `EmbassyMission` cost→reward |
| Domestic Commit + bounded effects | `national-issues-consequences.ts` (`applyConsequence`, `FIELD_BOUNDS`); `policy-effects-sync.ts`; `StorytellerEffect` |
| Diplomacy Commit | `ForeignPolicyAction`, `Alliance`, `CulturalExchange`, `diplomatic-news-generator.ts` |
| Politics Commit (Bills/coalitions) | `PoliticalParty`, `Legislature`, `LegislativeSeat`, `Election`, politics-drift cron |
| Recon surface | Cabinet meeting models (already in `government.prisma`) — currently mono-use; this makes them multi-use |
| Personalization | `enum ComponentType` (~90), `ComponentSynergy`, `GovernmentComponentData` |
| Lore-first surface | `GovernmentBranch`, chamber `selectionMethod`, free-text `governmentType` (shipped) |
| Ripple/Chronicle spine | `recordCountryEvent` (designed, unbuilt), `CountryChangeLog`, `activity-hooks.ts` |
| Pacing | `ixtime.ts`; feature gating via `gameplay-flags.ts` |

---

## 10. Staging

1. **Spine** — Issue → Meeting (recon, never-lie) → Policy on the three levers, weekly. *Delivers the
   entire "you're governing" feel by itself.* Plus the **Almanac** (cheap, ship alongside).
2. **Interconnection** — foreign-policy effects scaled by target stats; Diplomatic Events through
   embassies (state visits, joint exercises, intel sharing, foreign investment…) on `Embassy`/
   `CulturalExchange`.
3. **Politics** — Bills + coalitions + Mandate buffs (executive=Policy, legislature=Bill).
4. **Power Brokers** — last; a config table once 1–3 exist.

## 11. Open design calls (settle before building each stage)

- **Recon is unilateral; only binding deals need consent.** You scout a foreign power via *your* intel
  (never-lie shows *your fogged estimate*), so the loop never blocks on another human; only an actual
  agreement needs their yes. *Recommended.* (Alt: scouting costs the target — changes the async model.)
- **Penalty axis = fog, not time** (§8). Locked unless contested.
- **Bills = the legislature's verb, Policies = the executive's** (§4) — dissolves the redundancy and
  gives politics a job. Locked unless contested.
