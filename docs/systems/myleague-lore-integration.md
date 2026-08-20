# MyLeague Lore Integration & Feature Audit

**Last updated:** August 2026  
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
| **Ice Hockey Sim** | 3 periods, faceoffs, goalie pulls, 5-min majors | Uses standard interval resolver | 🟡 **In Progress** | Dedicated period resolver |
| **Multi-Stage Brackets** | Group Stage $\to$ Knockout / Golden Box | Round-robin or single-elimination | 🟡 **In Progress** | Multi-stage state machine |
| **Promotion / Relegation** | Automated tier swaps at season boundary | Single-division leagues | 🟡 **Planned** | Multi-tier league pyramid |
| **Patron Saint Invocations**| Pre-match spiritual ceremony buffing ratings | StorytellerEffect modifier integration | 🟢 **Complete** | `invokePatronSaint` mutation |

---

## 3. High-Impact Roadmap Features

1. **Native Hockey Period Resolver**: Dedicated 3-period engine with late-game goalie pulling (+15 offensive boost / 50% empty-net risk) and power plays.
2. **Multi-Stage Tournament Formats**: Automated group stage $\to$ knockout bracket progression.
3. **Tiered Promotion & Relegation**: Automated division swaps during `advanceSeason` cron.
4. **Quadrennial World Cup Automation**: Automatic drafting of national squads from player registry every 4 seasons with ThinkPages bulletin broadcasts.

---

## Related Documentation

- [MyLeague & MyClub Sports Guide](./myleague.md)
- [Social & Collaboration System](./social.md)
- [API Reference: Sports Router](../reference/api-complete.md#sports-router)
