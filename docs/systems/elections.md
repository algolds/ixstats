# 🏛️ MyCountry Politics, Elections & Legislature Domain

**Parent App Suite:** MyCountry Suite (`MYCOUNTRY_VERSION = 6`)  
**Engine:** Statecraft Simulation Engine (`MYCOUNTRY_ENGINE_VERSION = 4`)  
**Primary Action:** `ELECT` | **Domain Accent:** Imperial Purple / Amber Gold  
**Route:** `/mycountry/politics` (Politics Domain) | **Status:** 🟡 Partial: parties and legislature setup work; no election is ever started, so bills cannot pass (see [SYSTEM_STATUS.md](SYSTEM_STATUS.md))  

Elections, political parties, and legislature management form the parliamentary governance simulation layer of MyCountry. Sovereign states configure unicameral/bicameral (or custom multi-chamber) legislatures, manage political parties, table Bills, and have elections resolved on the IxTime clock with D'Hondt, FPTP, or mixed seat allocation.

> **Current gap:** elections are resolved only by the scheduled cron (`processDueElections`). The manual `simulateElection`, `scheduleElection`, and `registerCandidate` procedures were deleted in plan 312 as zero-caller procedures. An election needs at least 2 registered candidates to resolve, and no current API or UI registers candidates. The follow-up election the cron auto-schedules therefore stays `upcoming` until candidates exist.
>
> The gap is wider than follow-ups: `election.create` is called only from that follow-up branch of `election-cron.ts` (and the demo seed), so no first election or candidate is ever created for a real nation. Seats are created without a party (`legislature.ts`), so `legislation.holdVote` finds no voting blocs and throws "No seated legislature": bills cannot pass. The 11-step algorithm below describes code that a real nation cannot currently reach.

---

## Overview

| Feature | Description |
| :--- | :--- |
| **Political Parties** | Create and manage parties with ideology spectrum, colors, leadership, and polling support ratings |
| **Legislature Config** | Unicameral/bicameral/custom chambers, 10–10,000 seats, 1–10 year terms, and lore-first selection methods (elected, appointed, sortition, hereditary, ex-officio, corporatist) |
| **Electoral Systems** | D'Hondt proportional representation, First-Past-The-Post (FPTP), or Mixed-Member allocation |
| **Election Simulation** | 11-step algorithmic vote tally with economic modifiers, charisma swings, and random variance (cron-driven, `src/lib/government/election-simulation.ts`) |
| **Hemicycle Visualizer** | Interactive SVG parliament seat chart rendered dynamically from `LegislativeSeat` records |
| **Government Impact** | Election decisiveness updates political stability and creates an economic growth `StorytellerEffect` |
| **Bills & Power Brokers** | `legislation` router (`proposeBill`, `previewBillVote` fogged whip count, `holdVote`) and `elections.getPowerBrokers` |

---

## Key Files & Routers

### Router
- `src/server/api/routers/elections/` (`index.ts`, `elections.ts`, `parties.ts`, `legislature.ts`, `brokers.ts`) – 9 procedures: `getElections`, `getCurrentParliament`, `getLegislature`, `configureLegislature`, `getParties`, `createParty`, `updateParty`, `deleteParty`, `getPowerBrokers`
- `src/server/api/routers/legislation.ts` – Bills (`getBills`, `proposeBill`, `previewBillVote`, `holdVote`)
- `src/lib/government/election-cron.ts` / `election-simulation.ts` – Scheduled resolution and the shared simulation core

### UI Components
- `src/components/mycountry/shell/PoliticsDrillDown.tsx` & `rails/PoliticsRail.tsx` – Politics domain surface and context rail
- `src/components/executive/politics/PartyManager.tsx` – Party creation, ideology spectrum positioning, and polling editor
- `src/components/executive/politics/LegislatureConfig.tsx` – Chamber type, seat count, and electoral system setup
- `src/components/executive/politics/BillsPanel.tsx` / `PowerBrokersPanel.tsx` – Bills with fogged vote projection; power broker standings
- `src/components/executive/politics/ParliamentHemicycle.tsx` – Hemicycle seat visualization with party colors and tooltip breakdowns
- `src/components/executive/politics/LegislaturePanel.tsx` – Seat distribution tables and coalition indicators
- `src/components/executive/politics/CabinetPanel.tsx` – Ministerial appointments and department allocations

### Pages
- `src/app/mycountry/politics/page.tsx` – Politics sub-page within MyCountry
- `src/content/help/mycountry/politics.md` – Player help guide (served at `/help/mycountry/politics`)

---

## 11-Step Simulation Algorithm

```mermaid
graph TD
    A[Cron: Election Due on IxTime] --> B[1. Calculate Economic Modifier]
    B --> C[2. Compute Vote Share per Party]
    C --> D[3. Allocate Seats via D'Hondt / FPTP / Mixed]
    D --> E[4. Persist ElectionResult Records]
    E --> F[5. Assign LegislativeSeats]
    F --> G[6. Calculate Margin of Victory]
    G --> H[7. Mark Completed & Record Turnout]
    H --> I[8. Update Political Stability Score]
    I --> J[9. Generate StorytellerEffect Modifiers]
    J --> K[10. Update Party Polling Support]
    K --> L[11. Broadcast Results to ThinkPages]
```

1. **Economic Modifier**: GDP growth boosts the first-listed (incumbent) party (up to $+10\%$), recession penalizes it (up to $-15\%$); other parties move by half the modifier in the opposite direction.
2. **Per-Party Vote Share**: Base support $\pm$ economic modifier $\pm$ charisma swing ($\pm 5\%$) $\pm$ random variance ($\pm 7.5\%$).
3. **Seat Allocation**: D'Hondt (proportional), FPTP (plurality), or Mixed (50/50).
4. **Result Persistence**: Writes per-candidate vote tallies and seats won to `ElectionResult`.
5. **Seat Assignment**: Updates individual `LegislativeSeat` records with winning party IDs.
6. **Margin Calculation**: Computed from top-two party vote percentages.
7. **Status Update**: Election marked `completed` with voter turnout and margin recorded.
8. **Stability Shift**: By margin of victory: > 15 → $+0.05$; > 5 → $+0.02$; > 2 → $-0.05$; otherwise $-0.10$.
9. **Storyteller Effects**: Generates economic growth modifier based on election certainty.
10. **Polling Sync**: Updates `PoliticalParty.currentSupport` to match realized vote share.
11. **Auto-News Broadcast**: Publishes full election bulletin to ThinkPages via the diplomatic news generator.

---

## Database Models

Defined in `prisma/schema/government.prisma`:
- `PoliticalParty`: Name, abbreviation, ideology (`far_left` to `far_right`), color, leader, `currentSupport`
- `Legislature`: Chamber type, total seats, electoral system, term length
- `LegislativeSeat`: Seat index, chamber, assigned party ID
- `Election`: Type, scheduled date, completed date, status, turnout, margin
- `ElectionCandidate`: Candidate name, party affiliation, district
- `ElectionResult`: Candidate votes, percentage, seat outcome

---

## Related Documentation

- [MyCountry Command Suite](./mycountry.md)
- [Government Components & Synergies](../reference/synergies.md)
- [Social & Collaboration System](./social.md)
- [API Reference](../reference/api-complete.md)
