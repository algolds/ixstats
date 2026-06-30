# Politics & Diplomacy: Executive Domains Design Spec

This document details the architectural design for transforming the standalone **Elections** (Politics) and **Diplomacy** systems into integrated **Executive Domains** under MyCountry v4. Both subsystems stop functioning as isolated applications and instead become plugins executing through the unified **Intent Engine** and **Meeting System**.

---

## 1. Goal Description

Historically, elections and diplomacy were treated as isolated, min-game loops:
- Elections simulated voter percentages through mathematical algorithms.
- Diplomacy was managed via CRUD pages for building embassies and completing standalone treaties.

The **Executive Domains** approach rebuilds them:
- **Elections become "Government & Legislature"**: Elections are no longer the gameplay itself; they are the checkpoint transition. The active gameplay is introducing Bills (Commitments) to the Legislature, negotiating with political parties (actors with manifestos and agendas), and managing legislative gridlocks in meetings.
- **Diplomacy becomes "Foreign Affairs"**: Embassies are treated as local departments consuming budget/CivCap to execute specific missions (e.g., trade development, intelligence gathering). Treaties are active programs tracked in the Intent Graph, requiring periodic review meetings to remain active.

---

## 2. Database Schema Extensions

To represent political parties as negotiators and foreign missions as active administrative departments, we will add/extend models in `prisma/schema/government.prisma`:

```prisma
// Political Party as an active Legislative Actor
model PoliticalParty {
  id               String             @id @default(cuid())
  countryId        String
  name             String
  shortName        String
  seats            Int                @default(0)         // Parliamentary representation
  manifesto        String             // JSON array of core ideologies
  redLines         String             // JSON array of dealbreakers
  politicalCapital Float              @default(50.0)      // Bargaining weight
  isCoalitionMember Boolean           @default(false)
  
  country          Country            @relation(fields: [countryId], references: [id], onDelete: Cascade)
  
  @@index([countryId])
}

// Legislative Bills linked to Intents
model LegislativeBill {
  id               String             @id @default(cuid())
  countryId        String
  title            String
  description      String
  status           String             @default("draft")   // "draft" | "committee" | "voting" | "passed" | "vetoed"
  category         String
  intentId         String?            @unique
  introducedIxTime Float?
  
  intent           NationalIntent?    @relation(fields: [intentId], references: [id])
  
  @@index([countryId])
  @@index([status])
}

// Foreign Missions replacing passive Embassies
model ForeignMission {
  id               String             @id @default(cuid())
  countryId        String
  targetCountryId  String
  status           String             @default("active")   // "active" | "suspended" | "recalled"
  objectives       String             // JSON array (e.g. ["Increase Trade", "Cultural Outreach"])
  civCapCost       Float              @default(5.0)
  budgetCost       Float              @default(0.0)
  relationStrength Float              @default(50.0)
  
  country          Country            @relation("SenderMissions", fields: [countryId], references: [id], onDelete: Cascade)
  targetCountry    Country            @relation("RecipientMissions", fields: [targetCountryId], references: [id], onDelete: Cascade)

  @@index([countryId])
  @@index([targetCountryId])
}
```

---

## 3. The Unified Executive Domain Matrix

Every domain now operates under the exact same grammar (Declare $\rightarrow$ Convene $\rightarrow$ Authorize $\rightarrow$ Review), utilizing the same underlying codebase:

| Domain | Meeting Type | Commitment | Execution Layer |
|---|---|---|---|
| **Legislature** | Legislative Strategy Meeting | Legislative Bill | Coalition Ministries |
| **Foreign Affairs** | Diplomatic Summit | Treaty / Active Pact | Foreign Ministry Envoys |
| **National Security**| War Council | Operational Directives | Joint Chiefs / Armed Forces |
| **Economy** | Economic Council | Budget / Allocations | Treasury / Central Bank |
| **Infrastructure** | Planning Board | Project Authorization | Public Works Department |

---

## 4. Subsystem Pipelines

### A. The Legislative Loop
1. **Declare**: Player declares intent (e.g., "Build Public Housing") $\rightarrow$ Spawns a proposed `NationalIntent`.
2. **Convene**: Holds a *Legislative Strategy Meeting*. Coalition leaders and Opposition parties attend. Parties negotiate based on their `redLines` and manifestos.
3. **Commit**: Enacting the plan introduces a `LegislativeBill` linked to the intent.
4. **Consequences**: If passed, the bill runs as a program, consuming CivCap. If the coalition collapses over negotiation friction, legislative gridlock plummets Government Stability.
5. **Elections Checkpoint**: On election cycles, a script assesses all completed/failed bills on the timeline, updates public approval, redistributes seats in the `PoliticalParty` table, and resets coalition memberships.

### B. The Foreign Affairs Loop
1. **Declare**: Player creates diplomatic intent (e.g., "Form regional trade bloc").
2. **Convene**: Schedules a *Diplomatic Summit* (Meeting engine). Foreign ambassadors attend.
3. **Commit**: Player authorizes the treaty, which commits both nations to an active program node in the Intent graph.
4. **Execution**: Embassies run as active `ForeignMission` departments executing objectives.
5. **Review**: Periodically, the scheduler prompts a *Review Meeting* to assess trade volume or military readiness. Failure to cooperate leads to relationship decay.

---

## 5. Verification Plan

### Automated Tests
* Add tests in `src/server/api/routers/legislative/__tests__/bills.test.ts` to verify:
  - Bill introductions successfully lock prerequisite intent nodes.
  - Party alignment calculations correctly map `redLines` to vote approvals.
  - Budget allocations update accurately on bill passage.

### Manual Verification
* Access the updated Situation Room and verify:
  - Legislative debates correctly populate opposition concerns.
  - Foreign summits populate dynamic negotiation choices (e.g., Plan A: open trade, Plan B: tariffs).
