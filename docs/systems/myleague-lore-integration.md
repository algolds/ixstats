# MyLeague Lore Integration & Feature Audit

**Last updated:** September 2026  
**Status:** Consolidated Architecture Guide  
**Target Architecture:** `MyLeague` Simulation Engine (`prisma/schema/sports.prisma`, `src/lib/sports/resolver.ts`)

This document analyzes sports lore documented across the MediaWiki database and community canon against the current simulation engine, outlining the roadmap to full canonical fidelity.

---

## 1. Lore Synthesis & Mapping

### A. WAFF World Cup Football (Soccer)
- Quadrennial 32-team international tournament with group stage into single-elimination knockout.
- High-stakes matches with extra time and penalty shootouts.

### B. Regional Club Competitions
- **Caphirian Imperial League (*Imperium foedus*)**: 16-club double round-robin with promotion/relegation and "Golden Box" post-season knockout.
- **Ligue Yonderre (*Yondersche Liga*)**: 18 clubs with multi-tier pyramid transitions.

### C. World Ice Hockey Federation (WIHF) & Orixtal Hockey League (OHL)
- 32-team professional league spanning 82 regular season games leading to the Watson Cup playoffs.
- 3-period structure (20 minutes), faceoffs, goalie pulls, 5-minute majors, and power plays.

---

## 2. Gap Analysis Matrix

| Sport / Domain | Lore Specification | Current Engine Capability | Status | Roadmap Action |
| :--- | :--- | :--- | :---: | :--- |
| **Soccer Sim** | 90 mins, stoppage time, cards, injuries, tactics | 6 intervals, goals, cards, injuries, tactic shifts | 🟢 **Complete** | Production ready |
| **Formula 1** | 16–22 races, qualifying, points, DNF, weather | Simulated pace, weather, DNF, driver points | 🟢 **Complete** | Production ready |
| **Ice Hockey Sim** | 3 periods, faceoffs, goalie pulls, 5-min majors | Dedicated 3-period resolver (`resolvers/hockey.ts`): line shifts, minors/power plays, fight majors, goalie pull, 3-on-3 OT, shootout | 🟢 **Complete** | Production ready |
| **Multi-Stage Brackets** | Group Stage $\to$ Knockout / Golden Box | `transitionToNextStage` advances `SportSeason.activeStage` (group-crossing or top-K qualifiers) when `season.settings.stages` is configured | 🟡 **Partial** | No UI/API writes `settings.stages`; no double-elimination format |
| **Promotion / Relegation** | Automated tier swaps at season boundary | `SportLeague.tier` / `parentLeagueId` / `promotionCount` / `relegationCount`; swaps run in `transition.ts`; counts editable in League Settings | 🟢 **Complete** | — |
| **Patron Saint Invocations**| Pre-match spiritual ceremony buffing ratings | StorytellerEffect modifier integration; divine-derby volatility | 🟢 **Complete** (backend) | `invokePatronSaint` is only wired to the admin Sports Labs panel, not MyClub |
| **World Cup** | Quadrennial 32-team WAFF tournament | `simulateWorldCup` runs every 4th season: drafts national squads by nation, posts a SportsNews ThinkPages bulletin | 🟢 **Complete** | — |

---

## 3. High-Impact Roadmap Features

1. **Native Hockey Period Resolver** — ✅ shipped: Dedicated 3-period engine with late-game goalie pulling and power plays.
2. **Multi-Stage Tournament Formats** — 🟡 partial: Automated group stage $\to$ knockout bracket progression exists in the engine; stage configuration UI and double-elimination "Golden Box" are missing.
3. **Tiered Promotion & Relegation** — ✅ shipped: Automated division swaps during season transition.
4. **Quadrennial World Cup Automation** — ✅ shipped: Automatic drafting of national squads from the player registry every 4 seasons with ThinkPages bulletin broadcasts.

---

## Related Documentation

- [MyLeague & MyClub Sports Guide](./myleague.md)
- [Social & Collaboration System](./social.md)
- [API Reference: Sports Router](../reference/api-complete.md)
