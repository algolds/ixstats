# MyLeague Lore Integration & Feature Audit

**Author**: Antigravity AI  
**Status**: Consolidated  
**Target Architecture**: `MyLeague` Simulation Engine (`sports.prisma`, `resolver.ts`)

This document combines the comprehensive lore audit of the IxStates sports universe (WAFF, Caphirian Imperial League, Ice Hockey) and the Top 5 Features proposed to bridge the gap between world lore and the simulation engine.

---

## Part 1: MyLeague Sports Lore vs. Simulation Engine Audit

This audit analyzes the discrepancy between the rich sports-related lore documented in the MediaWiki database and Discord roleplay channels against the current implementation of the `MyLeague` simulation engine.

### 1. Lore Synthesis & Mapping

Our research identified three major sports ecosystems active in the world's lore:

#### A. The WAFF and World Cup Football (Soccer)
* **Tournament Structure**: A quadrennial international association football tournament comprising **32 national teams** divided into 8 groups. It operates on a two-phase system:
  1. **Group Stage**: Single round-robin format.
  2. **Knockout Stage**: The top 2 teams advance to a single-elimination bracket.
* **Match Dynamics**: High-stakes game flows including late-game/clutch goals, major upsets, and Extra-Time/Penalty Shootouts in knockout play.

#### B. Regional Football Leagues
* **Caphirian Imperial League (*Imperium foedus*)**:
  * 16-club top-tier league. Double Round-Robin.
  * **Promotion/Relegation**: Bottom 3 relegated, top 3 promoted from Second League.
  * **"Golden Box"**: A historic knockout stage for the top 4 teams after the regular season.
  * **Cultural Traditions**: "Invocation of the Patron Saints" — a ritual ceremony before the start of each league session where clubs offer prayers to their designated patron saint.
* **Ligue Yonderre (*Yondersche Liga*)**:
  * 18 clubs. 2-team direct swap promotion/relegation with Ligue 2.
  * Historic feats include Artillerie FC's 48-match undefeated season.

#### C. World Ice Hockey Federation (WIHF) & Orixtal Hockey League (OHL)
* **Gameplay Dynamics**: Differs completely from soccer:
  * **3-Period Structure** (20-minute periods).
  * **Faceoffs** and **Goalie Pulling** (6-on-5 skater advantage late in games).
  * **Fight Penalties** (5-minute majors) and **Power Plays**.
* **Leagues**:
  * **OHL**: 32-team professional league spanning multiple nations. 82 games leading to the **Watson Cup playoffs** (16-team, 4-round tournament).

### 2. Gap Analysis Matrix

| Sport/League Area | Lore Requirement | Current Engine Capability | Status | Tech Debt / Gap Details |
| :--- | :--- | :--- | :--- | :--- |
| **Soccer Simulation** | 90 minutes, late-game goals, cards, injuries, tactical adjustments. | Simulates 6 intervals. Models basic goals, cards, injuries, and automated tactic shifts. | **Partial** | Lacks detailed match events or stadium weather. |
| **Ice Hockey Simulation** | 3 periods, faceoffs, goalie pulls, 5-minute majors, power plays. | Uses the exact same 90-minute soccer resolver. | **Missing** | Engine outputs soccer scores for hockey matches. |
| **Formula 1** | 16-22 races, qualifying, points, weather, DNF. | Simulates pace, weather, DNF, points. | **Implemented** | Matches PRD and lore. |
| **Tournament Brackets**| Multi-stage (Groups + Knockout) or Double-stage (League + Golden Box). | Single-elimination or simple double round-robin. | **Missing** | Engine cannot chain group stages to knockouts. |
| **Promotion/Relegation**| Automated transitions of bottom/top teams between leagues. | Static leagues. | **Missing** | No transition logic exists at season boundaries. |
| **Cultural Modifiers** | Patron Saint Invocation pre-match rituals giving synergy buffs. | Basic rating vector aggregation. | **Missing** | No context-based hooks to inject cultural buffs into RNG. |
| **Storyteller Sync** | Bidirectional sync with GM narrative actions and timeline events. | Isolated simulation. | **Missing** | Sports engine is completely unaware of the Storyteller ledger. |

### 3. Key Architectural Findings
1. **Preset Homogeneity**: `resolver.ts` ignores the `sport` parameter for team sports; everything falls back to a 90-minute soccer simulation.
2. **Missing Tournament State Machines**: The engine lacks a hybrid/multi-stage archetype.
3. **Static Leagues**: The `SportsLeague` model lacks a `tier` concept, preventing Promotion/Relegation.
4. **Lack of Dynamic Context**: The Mulberry32 RNG is seeded solely with `args.seed`, ignoring dynamic national contexts.
5. **Storyteller Isolation**: The sports engine does not read from or write to the global `StorytellerEffect` timeline.

---

## Part 2: Top 5 Features Proposal

The following high-impact features are designed to bridge the gaps identified in the audit and fit directly into the modular monolith architecture.

### Feature 1: Ice Hockey Simulation Preset (`hockey` preset)
Introduce a native `hockey` preset in `resolver.ts`:
* **Time Increments**: Replace 6 soccer intervals with three 20-minute periods.
* **Goalie Pulling**: At `t >= 58` mins, trailing teams pull the goalie, gaining a `+15` offensive boost but `50%` increased risk of conceding an empty-net goal.
* **Fight Major Events & Power Plays**: Simulate minor penalties giving 5-on-4 power plays, and 5-minute majors for fights.

### Feature 2: Multi-Stage Tournament Formats (The "Golden Box")
Extend tournament structures in `sports.prisma` to support multi-stage play:
* Add `stages` and `activeStage` to `SportsSeason`.
* Define transition criteria in the league's `fieldConfig` (e.g., Round Robin $\rightarrow$ Golden Box knockout).
* Modify the scheduling engine to calculate standings and generate the next stage's bracket automatically.

### Feature 3: Tiered Promotion & Relegation Systems
Simulate a realistic league pyramid:
* Link leagues in `sports.prisma` by adding `tier`, `parentLeagueId`, `relegationCount`, and `promotionCount`.
* During the `advanceSeason` cron, automatically swap the `leagueId` of the highest-ranked Division 2 teams with the lowest-ranked Division 1 teams.

### Feature 4: Invocation of the Patron Saints (Spiritual Modifiers)
Bring cultural depth to clubs via the Storyteller system:
* Add a `invokePatronSaint` mutation that consumes Influence/Credits to generate a dynamic `StorytellerEffect` (e.g., `sports_saint_blessing` +5 ratings boost for 1 tick).
* The match resolver reads these active effects and modifies the home team's rating and RNG seed, outputting specific commentary (e.g., *"The home crowd echoes the Invocation of Saint Rais"*).
* This creates a bidirectional link: GMs can drop scandals affecting sports, and sports matches can generate national timeline events.

### Feature 5: Quadrennial World Cups & ThinkPages Bulletins
Automate international cycles:
* Every 4 seasons, draft national squads from the `SportsPlayer` registry based on `citizenship`.
* Execute a 32-team World Cup simulation.
* Automatically publish summaries to ThinkPages via the `SportsNews` account.
* Mint a unique Championship Trophy Card to the winning manager's `MyVault`.
