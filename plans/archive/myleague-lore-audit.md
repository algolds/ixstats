# MyLeague Sports Lore vs. Simulation Engine Audit
**Author**: Antigravity AI  
**Date**: June 11, 2026  
**Status**: Completed  
**Target Directory**: `/plans`  

This audit analyzes the discrepancy between the rich sports-related lore documented in the MediaWiki database (under `Category:Sports` and subcategories) and Discord roleplay channel `1162232733989359616` against the current implementation of the `MyLeague` simulation engine ([resolver.ts](file:///ixwiki/public/projects/ixstats/src/lib/sports/resolver.ts)) and the [MyLeague v2 PRD](file:///ixwiki/public/projects/ixstats/.opencode/plans/myleague-v2-prd.md).

---

## 1. Lore Synthesis & Mapping

Our research identified three major sports ecosystems active in the world's lore:

### A. The WAFF and World Cup Football (Soccer)
* **Tournament Structure**: A quadrennial international association football tournament comprising **32 national teams** divided into 8 groups (Groups A–H). It operates on a two-phase system:
  1. **Group Stage**: A single round-robin group play format (3 matchdays per group), where teams earn 3 points for a win, 1 for a draw, and 0 for a loss.
  2. **Knockout Stage**: The top 2 teams from each group advance to a single-elimination bracket consisting of the Round of 16, Quarter-Finals, Semi-Finals, Third Place play-off, and the Final.
* **Match Mechanics & Venues**: Matches are held in legendary venues with regional weather and home-crowd contexts, including:
  * *Raiovar Stadium* in Magador, Narico
  * *Stadio Sant'Elia* in Castra Osaniovo, Narico
  * *Great Colosseum* in Venceia, Narico
  * *Veragro Colosseum* in Veropolis, Inonsia
  * *Al Ali Mhurraq Stadium* in Muqadas
  * *Al Rumali Stadium* in Jisr al-Nahr
  * *Nezbah Sports Complex* in Nezbah
  * *Suq al-Shaab Stadium* in Khushna
  * *Al Babil Stadium* in Al-Delal
* **Match Dynamics**: Logs from the 2034 and 2038 WAFF World Cup threads show high-stakes game flows, including:
  * Late-game/clutch goals (e.g., Asteria beating Hendalarsk 2-1 with a last-minute goal).
  * Major upsets (e.g., Lucrecia defeating Caphiria 2-1 in a "David vs. Goliath" moment).
  * Draw resolution in knockout play via Extra-Time and Penalty Shootouts (e.g., Yonderre defeating Alstin or Caphiria).

### B. Regional Football Leagues
Our audits of local league structures revealed two highly developed domestic competitions:

#### 1. Caphirian Imperial League (*Imperium foedus*)
* **Overview**: A 16-club top-tier league operating from August to May.
* **League System & Formatting**:
  * **Double Round-Robin**: 30 fixtures per club (home and away). Ranked by points (3 win, 1 draw), then head-to-head records, then goal difference.
  * **Promotion/Relegation**: The 3 lowest-placed teams are relegated to the *Caphirian Second League*, and the top 3 from the Second League are promoted.
  * **Historical "Golden Box"**: A two-stage system from 1990 where the regular season (30 matches) qualified the top 4 teams for a final knockout stage called the "Golden Box" to crown the champion.
* **Continental Pathways**: Sarpedonian Champions League (SCL) qualification based on a nation coefficient (4 slots):
  * Top 3 league teams + winner of the *Emperor's Cup* qualify.
  * *Edge Case A (Cup winner in top 3)*: The 4th-placed league team enters the SCL qualifiers.
  * *Edge Case B (Cup winner NOT in top 3)*: League 1st and 2nd go directly to SCL groups, 3rd team goes to SCL qualifiers, and the Cup winner takes the remaining slot.
* **Cultural Traditions**: The "Invocation of the Patron Saints" — a ritual ceremony before the start of each league session where clubs offer prayers to their designated patron saint, creating team-specific spiritual or motivational modifiers.

#### 2. Ligue Yonderre (*Yondersche Liga*)
* **Overview**: Yonderre's top-tier league featuring **18 clubs** running from August to May.
* **League System & Formatting**:
  * **Promotion/Relegation**: Renders a 2-team direct swap with *Ligue 2*.
  * **Domestic Cup**: All clubs qualify for the *ASY-Supercup*.
  * **Continental Pathways**: Top 2 teams automatically qualify for the WAFF Champions League; 3rd place enters WAFF Champions League qualifiers; 4th and 5th enter the WAFF Levantine League.
  * **Historic Feats**: Prominent clubs include Collinebourg Chevaliers (21 titles), Artillerie FC (17 titles), and AS Gabion-Vandarcôte (12 titles). Artillerie FC holds the record for an undefeated season (1996-97, 48 matches undefeated).

### C. World Ice Hockey Federation (WIHF) & Orixtal Hockey League (OHL)
* **Gameplay Dynamics**: Play-by-play threads showcase specific rulesets that differ completely from soccer:
  * **3-Period Structure**: Matches are split into three 20-minute periods rather than halves.
  * **Faceoffs**: Interactive events occurring at the start of periods, after goals, and on penalties.
  * **Goalie Pulling**: Trailing teams pull their goalie in the final minutes (e.g., with 2 minutes left in the third period) to gain a 6-on-5 skater advantage, increasing scoring probability at the expense of conceding empty-net goals.
  * **Fight Penalties & Power Plays**: Fights trigger 5-minute major penalties where both players go to the penalty box. Power plays shift team strength dynamics.
  * **Goalie Clutchness**: Goalies "standing on their heads" to make consecutive high-risk saves.
* **Leagues & Tournaments**:
  * **Orixtal Hockey League (OHL)**: A 32-team professional league spanning Tierrador (21), Alstin (6), Ceylonia (2), Porlos (2), and Istrenya (1). Regular season has **82 games** from October to April, leading to the **Watson Cup playoffs** — a 16-team, 4-round tournament.
  * **Boreal Hockey League (BHL)**: 32 teams organized into 2 conferences and 4 divisions.

---

## 2. Current Engine Capabilities & Limitations

The current simulation kernel is located in [resolver.ts](file:///ixwiki/public/projects/ixstats/src/lib/sports/resolver.ts) and defined under the [MyLeague v2 PRD](file:///ixwiki/public/projects/ixstats/.opencode/plans/myleague-v2-prd.md). Here is how they stack up against the sports lore:

### Gap Analysis Matrix

| Sport/League Area | Lore Requirement | Current Engine Capability | Status | Tech Debt / Gap Details |
| :--- | :--- | :--- | :--- | :--- |
| **Soccer Simulation** | 90 minutes, late-game goals, cards, injuries, tactical adjustments. | Simulates 6 intervals (15, 30, 45, 60, 75, 90 mins). Models basic goals, yellow cards, injuries, and automated tactic shifts. | **Partial** | Adequate for standard matches, but lacks venue-specific weather modifiers or detailed match events. |
| **Ice Hockey Simulation** | 3 periods, opening and mid-game faceoffs, goalie pulls, 5-minute major fight penalties, power plays, shootouts. | Uses the exact same 90-minute, 6-interval soccer resolver for all matches. No hockey-specific event loops. | **Missing** | The engine cannot simulate hockey events. It outputs soccer scores (e.g., 2-1, 1-0) for hockey matches, ignoring periods, faceoffs, fight majors, and empty nets. |
| **Formula 1 / Motorsport** | 16-22 races, qualifying grids, constructor + driver points, weather effects, DNF rolls. | Simulates qualifying/race paces, weather effects, DNF probabilities, points scaling. | **Implemented** | Matches the PRD and lore specs well. |
| **Tournament Bracket Structures** | Multi-stage: Groups (A–H) to 16-team knockout. Double-stage: Regular season to "Golden Box" top-4 knockout. | Single-elimination tree brackets or simple double round-robin tables. | **Missing** | The engine does not support chaining group-stages to knockout trees or running a secondary "Golden Box" postseason within the same league season. |
| **Promotion & Relegation** | Automated transitions of bottom-3/top-3 (Caphiria) or bottom-2/top-2 (Yonderre) teams between leagues. | Standings are generated, but teams remain permanently static in their respective leagues. | **Missing** | No transition logic exists at the season boundary to swap team affiliations between Division Tiers. |
| **Continental Qualifications** | complex pathways (e.g. SCL qualification slots, Emperor's Cup winner logic, coefficients). | simple standalone seasons. No cross-league tournaments are simulated. | **Missing** | No cross-league/continental adapter is wired to aggregate domestic results and seed Champions League-style brackets. |
| **Cultural & Roleplay Modifiers** | Patron Saint Invocation pre-match rituals giving unique motivation/synergy buffs. | Basic rating vector aggregation (`overall`, `offense`, `defense`, `form`, `coaching`). | **Missing** | No context-based hooks to inject cultural, national, or roleplay-driven modifiers (such as saintly blessings) into the RNG seed. |
| **Storyteller Integration** | Bidirectional sync with GM narrative actions and timeline events in the DM Dashboard. | No integration. Sports simulations run in complete isolation from the Storyteller/DM input engine. | **Missing** | The resolver cannot read active `StorytellerEffect` (stored in `DmInputs` table) to influence matches, nor do matches log results back into the Storyteller ledger. |

---

## 3. Key Architectural Findings

1. **Preset Homogeneity**:
   * While [resolver.ts:L107-122](file:///ixwiki/public/projects/ixstats/src/lib/sports/resolver.ts#L107-122) takes a `sport` parameter, it completely ignores it for match play-by-play generation. All team-based sports fall through to the **soccer simulation loop** ([resolver.ts:L285-390](file:///ixwiki/public/projects/ixstats/src/lib/sports/resolver.ts#L285-390)), which assumes 90 minutes and 6 intervals. This means Ice Hockey and Basketball matches are computed using soccer logic, which is a significant lore break.
2. **Missing Tournament State Machines**:
   * The V2 PRD specifies `archetype: "league" | "division_conference" | "bracket" | "circuit"`. However, it lacks a **hybrid/multi-stage** archetype required for World Cups (Group + Bracket) or Caphiria's historic league (Double Round-Robin + "Golden Box" top-4 knockout).
3. **Static Leagues**:
   * The league model in [sports.prisma](file:///ixwiki/public/projects/ixstats/prisma/schema/sports.prisma) does not contain a concept of `tier` or links to sibling leagues. Consequently, there is no structural capability to run Promotion/Relegation loops on seasonal ticks.
4. **Lack of Dynamic Context in RNG seeding**:
   * The Mulberry32 RNG engine ([resolver.ts:L5-13](file:///ixwiki/public/projects/ixstats/src/lib/sports/resolver.ts#L5-13)) is seeded solely with `args.seed`. The simulation does not support injecting dynamic context like national policies, stadium weather, or cultural blessings/rituals into the actor ratings during vectorization.
5. **Storyteller / DM Input Isolation**:
   * The alternate-history ledger (`StorytellerEffect` model in [government.prisma](file:///ixwiki/public/projects/ixstats/prisma/schema/government.prisma)) manages global narrative modifiers, but the sports engine is completely unaware of it. Events such as saintly invocations, player drafts, and championships are not integrated into the timeline ledger, leaving them cut off from the global story dashboard.

