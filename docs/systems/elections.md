# Elections & Political System

**Last updated:** May 2026

Elections, political parties, and legislature management form the governance simulation layer of IxStats. Players configure a legislature, create parties, register candidates, and run elections with algorithmic seat allocation.

## Overview

| Feature | Description |
| --- | --- |
| Political parties | Create and manage parties with ideology, color, leadership, and support ratings |
| Legislature configuration | Unicameral/bicameral chambers, 10–1,000 seats, configurable term length |
| Electoral systems | D'Hondt proportional representation, FPTP, or mixed allocation |
| Election simulation | Algorithmic vote calculation with economic modifiers, charisma swing, and random variance |
| Hemicycle visualization | Parliament seat chart rendered from `LegislativeSeat` data |
| Government impact | Election outcomes affect political stability, democracy index, and economic growth |

## Key Files

### Router
| File | Purpose |
| --- | --- |
| `src/server/api/routers/elections.ts` | 887-line tRPC router with 13 procedures |

### Components
| File | Purpose |
| --- | --- |
| `src/components/executive/politics/PoliticsOverview.tsx` | Main politics dashboard |
| `src/components/executive/politics/PartyManager.tsx` | Party CRUD interface |
| `src/components/executive/politics/LegislatureConfig.tsx` | Legislature setup |
| `src/components/executive/politics/ElectionSimulator.tsx` | Election simulation UI |
| `src/components/executive/politics/ParliamentHemicycle.tsx` | Hemicycle seat chart visualization |
| `src/components/executive/politics/LegislaturePanel.tsx` | Legislature details panel |
| `src/components/executive/politics/LegislativePolicies.tsx` | Policy management |
| `src/components/executive/politics/LegislativeIssues.tsx` | Legislative issue tracking |
| `src/components/executive/politics/PoliticsWarRoom.tsx` | Strategic politics overview |
| `src/components/executive/politics/GovernmentMetricsEditor.tsx` | Government metrics editor |

### Pages
| File | Purpose |
| --- | --- |
| `src/app/mycountry/politics/page.tsx` | MyCountry politics sub-page |
| `src/app/help/mycountry/politics/page.tsx` | Help article for the politics system |

## API Procedures

| Procedure | Type | Auth | Description |
| --- | --- | --- | --- |
| `getParties` | query | public | List political parties for a country |
| `createParty` | mutation | protected | Create a new party (owner only) |
| `updateParty` | mutation | protected | Update party details |
| `deleteParty` | mutation | protected | Delete a party |
| `getLegislature` | query | public | Get legislature config with seats |
| `configureLegislature` | mutation | protected | Create/update legislature (auto-creates seat records) |
| `getElections` | query | public | List elections with candidates and results |
| `getElectionById` | query | public | Single election with full details |
| `scheduleElection` | mutation | protected | Schedule a new election |
| `registerCandidate` | mutation | protected | Register a candidate for an election |
| `removeCandidate` | mutation | protected | Remove a candidate |
| `simulateElection` | mutation | protected | Run the election simulation algorithm |
| `getCurrentParliament` | query | public | Get current seat assignments for hemicycle rendering |

## Election Simulation Algorithm

The simulation runs in 11 steps:

1. **Economic modifier** — GDP growth boosts incumbents (up to +10%), recession penalises (up to −15%)
2. **Per-party vote share** — Base support ± economic modifier ± charisma swing (±5%) ± random swing (±7.5%)
3. **Seat allocation** — D'Hondt (proportional), FPTP (winner-takes-all), or mixed (half-and-half)
4. **Result records** — `ElectionResult` rows with votes received, percentage, seats won
5. **Seat assignment** — `LegislativeSeat` records updated with winning party IDs
6. **Margin of victory** — Calculated from top-two party vote percentages
7. **Election status** — Set to `completed` with turnout and margin recorded
8. **Political stability** — Decisive win (+0.05), close race (−0.05 to −0.10)
9. **Storyteller effects** — Economic growth modifier based on election decisiveness
10. **Party support update** — Party `currentSupport` set to actual vote percentages
11. **Auto-news** — Election results posted to ThinkPages via diplomatic news generator

### Ideology Spectrum
Parties are assigned one of seven ideological positions: `far_left`, `left`, `center_left`, `center`, `center_right`, `right`, `far_right`.

### Turnout Calculation
```
turnout = min(95, 55 + nationalHealth × 0.3)
totalVotesCast = population × 0.65
```

## Database Models

| Model | Purpose |
| --- | --- |
| `PoliticalParty` | Party definitions with ideology, color, support ratings |
| `Legislature` | Chamber configuration (type, seats, electoral system, term length) |
| `LegislativeSeat` | Individual seat assignments linked to parties |
| `Election` | Election metadata (type, status, turnout, margin) |
| `ElectionCandidate` | Candidates registered for elections |
| `ElectionResult` | Per-candidate vote tallies and seats won |

## Access & Permissions
- **Public** queries: anyone can view parties, legislature, election results
- **Protected** mutations: only the country owner can manage their own political system
- Ownership checks compare `ctx.user.countryId` against the target country

## Integration Points
- **Notifications**: Party creation and election results generate governance notifications
- **ThinkPages**: Election results auto-post via `generateDiplomaticNews`
- **GovernmentStructure**: Elections update `politicalStability` and `democracyIndex`
- **StorytellerEffect**: Election outcomes create economic growth modifiers

## Related Documentation
- [`docs/systems/mycountry.md`](mycountry.md) — MyCountry command suite (Politics section)
- [`docs/reference/api-complete.md`](../reference/api-complete.md) — Full API catalog
