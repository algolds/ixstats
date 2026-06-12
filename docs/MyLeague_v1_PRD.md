# 🏟️ PRODUCT REQUIREMENTS DOCUMENT (PRD)
## ⚔️ IxStats Feature: MyLeague (Sports & Competition System)

| | |
|---|---|
| **Version** | v0.1 — Initial Scope |
| **Status** | Scoping Draft · Pending Name Lock |
| **Owner** | IxStats Simulation Layer |
| **Working Name** | **Coliseum** (canonical) · **MyClub** (personal surface) — *placeholder* |
| **Name shortlist** | Coliseum · IxArena · IxCircuit · IxLeague · Vanguard |
| **Codename** | MyLeague |
| **Category** | Competition Simulation / Player Engagement |
| **Depends on** | IxTime, IxStats nation roster, Four Pillars refactor (Legacy/Influence), IxCards event-mint hook (later) |

---

## 1. 🧭 Overview

MyLeague is the competition layer of IxStats. A player **spins up a league** (pick a sport, set the teams, choose a format), the system **auto-generates a format-appropriate schedule**, **simulates the season** on the IxTime clock, and every in-game year runs a **draft or transfer window** that refreshes talent via a **procedural (Markov-driven) generator** of rookies and coaches. Teams age, develop, decline, win, and build history.

Where MyCountry is your nation and MyLedger is your portfolio, **MyClub** is your franchise. MyLeague is primarily a **Legacy** engine — champions, records, dynasties, and rivalries are persistent world history — with **Influence** spillover when teams carry national affiliation.

### Core principle
> The schedule is generated, the season is simulated, and the history is permanent. v1 ships a tight, realistic season-and-draft loop — not a tactics engine. Depth is added as layers, not as a prerequisite.

### The cold-start fix
A sports sim's risk is the empty-roster problem (flagged when we sequenced this behind Exchange). v1 solves it directly: **leagues launch with fully generated rosters**, and the annual talent generator keeps them fresh. No player ever has to hand-author 200 athletes before anything is fun.

---

## 2. 🎯 Goals

1. **Playable in minutes, zero authoring** — a player creates a league and watches a real season resolve without hand-building rosters.
2. **Correct, format-aware scheduling** — round-robin/league tables for soccer-type leagues; division/conference + playoffs for football/hockey/baseball-type leagues, generated automatically from the team set.
3. **Realistic, non-repetitive outcomes** — emergent standings, upsets, and champions from a bounded probabilistic engine, not deterministic stat math.
4. **Persistent Legacy** — every season writes durable history (champions, records, streaks) that feeds the Legacy pillar.
5. **Runs on IxTime** — seasons and the annual draft/transfer cycle auto-advance on the 4x clock with no real-world timers.

---

## 3. 🚫 Non-Goals (v1)

| Non-goal | Why it's out |
|---|---|
| **AegisCore / Stockfish advantage-field engine** | Same call as HelixCore on Exchange: elegant, enormous, premature. A bounded probabilistic resolver gets ~90% of the realism at ~10% of the build. Reserved for vNext. |
| **Combat sports & racing** (MMA/boxing brackets, F1/time-based circuits) | Different scheduling *and* simulation paradigms than team-sport leagues. Phase 2. |
| **Custom sport DSL** | Modding/user-defined sports is a Phase 2–3 capability. v1 ships a fixed set of team-sport archetypes. |
| **Intent-based tactical control** | Manager "intent" inputs (protect lead, force chaos) are a P1 layer, not core to the season loop. |
| **Rich narrative engine** (rivalry graphs, dynasty arcs, historical-significance scoring) | v1 ships a *lightweight* records/history log; the prose-narrative layer is P1. |
| **Economic integration with Exchange** | Transfer fees, club finances, sponsorships in market currency depend on Exchange shipping first. Forward-compatible only (P2). |

---

## 4. ⏱️ IxTime Integration (Foundational)

The whole season cadence rides the 4x clock.

- **Season length**: one season per **in-game year**. At 4x, an in-game year ≈ 3 real months — so a full season + playoffs + draft resolves roughly **quarterly**. Lively, not frantic, and matches Exchange's pulse.
- **Annual cycle**: at each in-game year boundary, the system runs **player aging/progression**, then the **draft or transfer window**, then generates the next schedule.
- **Reuse the service**: `IxTime.getCurrentIxTime()`, `getYearsElapsed()`, `getTimeMultiplier()`. Retuning the multiplier rescales season pacing automatically — no hardcoded calendars.
- **Stamping**: every match result, standing, and roster change is IxTime-stamped so history stays coherent if the clock is retuned.

---

## 5. 🏆 What v1 Simulates

### 5.1 Sport archetypes (team sports only)
v1 ships **team sports** defined by two structural axes — **schedule format** and **postseason** — which together cover the user-named cases:

| Archetype | Schedule format | Postseason | Covers |
|---|---|---|---|
| **League** | Balanced round-robin (single/double), promotion-style table | Table winner (optional playoff) | Soccer-type leagues |
| **Division/Conference** | Divisions, unbalanced intra/inter-division schedule | Seeded bracket playoff → championship | Football / hockey / baseball-type leagues |

A "sport" in v1 is a **preset**: archetype + roster shape (positions) + the rating vector that feeds the match model. New team sports are added as data presets, not code.

### 5.2 Schedule generator
- Takes N teams + archetype → produces a valid, balanced (or correctly *un*balanced, for divisions) fixture list.
- Handles odd team counts (byes), division grouping, and home/away balance.
- Output is a deterministic schedule the sim then resolves match-by-match over the season's IxTime span.

---

## 6. ⚙️ The Simulation Engine (v1)

**Bounded probabilistic match resolution** off team/player rating vectors — *not* AegisCore.

- Each team derives an effective strength from its roster's rating vectors (e.g., offense / defense / form / depth), plus home advantage.
- Match outcome is **sampled** from a model based on the strength differential, with **bounded variance** so upsets happen but blowouts stay realistic — no pure RNG, no deterministic "higher rating always wins."
- **Ratings update** after each match (ELO-style), so form and standings evolve emergently across the season.
- **Lightweight history capture** per season: champion, final table/bracket, notable records and streaks → persisted as permanent world history (the Legacy hook).

*P2 insurance:* the engine is isolated behind a `MatchResolver` interface so the AegisCore advantage-field model can later be swapped in without touching scheduling, rosters, or history.

---

## 7. 🧬 Talent System (Generation, Aging, Draft/Transfer)

This is the realism layer the brief specifically called for.

- **Generated rosters at launch** — every team starts populated; no hand-authoring.
- **Markov-driven talent generator** — produces each in-game year's **rookie class and coaches**: archetype + attribute progression sampled via Markov chains over career-arc states (breakout, plateau, decline), plus procedural names. Gives variety and believable career shapes rather than flat random stats.
- **Aging & progression** — players develop and decline over IxTime; ratings shift each annual cycle.
- **Annual intake — format-matched to the sport** (nice parallel to the scheduling fork):
  - **Draft** for closed/division leagues — worst records pick first from the rookie class.
  - **Transfer window** for open league-format sports — free movement of talent between clubs.
- **Coaches** — generated alongside players; a coach modifier feeds team strength and development rates.

---

## 8. 🌍 World Integration

- **Nation affiliation (optional)** — teams can be tied to an IxStats nation, enabling national standings and (P1) cross-nation competitions. National success feeds **Influence**; team history feeds **Legacy**.
- **Open creation** — any player can create a league (like Exchange's open founding), with DM-run canonical world leagues coexisting alongside player leagues.
- **Championship → card mint (P1/P2 hook)** — a title is exactly the kind of in-universe DM event your IxCards "event card" concept auto-mints limited commemorative cards from. Designing the season-end event to emit a structured payload makes this a near-free cross-system tie later.
- **Exchange tie (P2)** — once Exchange ships, clubs can become economic entities: transfer fees and sponsorships in market currency, club valuations. Forward-compatible only.

---

## 9. 👤 User Stories

**Commissioner (league creator)**
- As a player, I want to **create a league by picking a sport, team count, and format** so that a playable competition exists in minutes.
- As a commissioner, I want the **schedule generated automatically** so that I never hand-build fixtures.
- As a commissioner, I want the **season to advance on IxTime** so that it runs without my babysitting it.

**Manager (team owner)**
- As a manager, I want **a generated roster** so that I'm not authoring athletes before I can play.
- As a manager, I want the **annual draft/transfer window** so that my team changes year over year.
- As a manager, I want to see **why my team won or lost** (strength, form, upset variance) so that results feel legible.

**Spectator / DM / World**
- As a spectator, I want **standings, playoff brackets, and a records/history page** so that the world has sports history.
- As a DM, I want to run **canonical world leagues** alongside player leagues.
- As a player, I want my team's **nation affiliation** reflected in standings so that national pride is in play.

---

## 10. 📋 Requirements

### Must-Have — P0 (Phase 1 / launch)
- **P0-1 League creation** — pick sport preset, set N teams, choose archetype (League vs Division/Conference); optional nation affiliation.
- **P0-2 Schedule generator** — valid, balanced/division-correct fixtures with byes and home/away handling.
- **P0-3 Generated rosters** — every team auto-populated at creation.
- **P0-4 Probabilistic match engine** — bounded-variance resolution off rating vectors, behind a swappable `MatchResolver` interface.
- **P0-5 ELO-style rating updates** — post-match, driving emergent standings.
- **P0-6 Standings + postseason** — live table and/or seeded playoff bracket → champion.
- **P0-7 Markov talent generator** — annual rookie class + coaches with believable career arcs and procedural names.
- **P0-8 Aging/progression** — players develop/decline on the IxTime annual cycle.
- **P0-9 Annual intake** — draft (closed) or transfer window (open), format-matched.
- **P0-10 IxTime season job** — auto-advance season, then run aging → intake → next schedule at year boundary.
- **P0-11 Lightweight history & records** — persistent champions, records, streaks (Legacy hook).
- **P0-12 MyClub dashboard** — roster, schedule, standings, season summary.

### Nice-to-Have — P1 (Phase 2 / fast follow)
- **P1-1 Manager intent control** — high-level intent inputs (protect lead, push aggression) that bias the resolver.
- **P1-2 Richer narrative** — rivalries, dynasty detection, historical-significance scoring.
- **P1-3 Multi-dimensional ELO+ vectors** — attack/defense/clutch/adaptability ratings.
- **P1-4 Nation competitions** — cross-nation cups/tournaments; national leaderboards.
- **P1-5 Championship card minting** — emit season-end events to the IxCards event-mint pipeline.

### Future Considerations — P2 (architectural insurance — design for, don't build)
- **P2-1 AegisCore engine** — swap the advantage-field/Stockfish resolver in behind `MatchResolver`.
- **P2-2 Combat sports & racing** — bracket/tournament and time-based circuit archetypes.
- **P2-3 Custom sport DSL** — user-defined sports/modding.
- **P2-4 Exchange integration** — club finances, transfer fees, sponsorships in market currency.

---

## 11. 📊 Success Metrics

**Leading (days–weeks)**
- **Leagues created** per active player in first 30 in-game days. *Target: 0.5 · Stretch: 1.0.*
- **Season completion**: % of created leagues simulated through to a champion. *Target: 70%.*
- **Return-per-season**: % of managers who engage the next season's draft/transfer. *Target: 50%.*
- **Legibility**: % of match/season views that open the result-explanation. *Target: ≥40%.*

**Lagging (weeks–months)**
- **Retention lift** among MyLeague participants vs. non-participants.
- **Legacy-pillar engagement** — interactions with history/records surfaces.
- **Cross-system pull** once the card-mint and nation-competition hooks land.

---

## 12. ❓ Open Questions

| Question | Owner | Blocking? |
|---|---|---|
| Sim fidelity dial — how granular is a match (single result vs. play-by-play)? | Design + Eng | Yes |
| Which sport presets ship at launch, and their exact rating vectors? | Design | Yes |
| IxTime season pacing — does a season span a full in-game year, or compress? | Design + Eng | Yes |
| Markov vs. simpler procedural for talent gen in v1 (build cost vs. realism) | Eng | Yes |
| Is nation affiliation in v1 or deferred to P1? | Stakeholder | No |
| Playoff formats per archetype (bracket size, seeding, ties) | Design | No |
| Exact mapping of team/league history → Legacy/Influence pillars | Eng | No |
| Final canonical + personal names | Stakeholder | No |

---

## 13. 🗓️ Phasing

- **Phase 1 (Launch / MVP)** — League creation + schedule generation + probabilistic sim + generated rosters + Markov talent + annual draft/transfer + aging + standings/playoffs + history & records + MyClub. *Delivers the full brief; solves cold-start.*
- **Phase 2 (Fast follow)** — Manager intent + richer narrative + ELO+ vectors + nation competitions + championship card minting.
- **Phase 3+ (vNext)** — AegisCore engine, combat/racing archetypes, custom sport DSL, Exchange economic integration.

---

## 14. 🔌 Reuse & Integration Map

| Need | Reuse |
|---|---|
| Time automation | `IxTime` service (4x clock) |
| Personal surface pattern | `MyVault` / `MyLedger` → mirror as `MyClub` |
| Nation data / affiliation | Existing IxStats nation roster |
| Stat surfacing | Four Pillars / `card-stat-config` `CardStatDef` pattern (Legacy/Influence) |
| Event minting (later) | IxCards "event card" auto-mint pipeline |
| Stack | Next.js · tRPC · Prisma/PostgreSQL · Clerk |
| Engine isolation | `MatchResolver` interface so AegisCore can drop in later |
