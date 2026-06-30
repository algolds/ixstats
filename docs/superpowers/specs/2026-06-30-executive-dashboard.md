# Executive Dashboard Design Spec (The Situation Room)

This document details the architectural design and technical specifications for the **Executive Dashboard** (MyCountry v4), serving as the government's central **Situation Room**. It transforms the landing page from a passive spreadsheet of statistics into an active briefing panel centered around decision-making and commitments.

---

## 1. Goal Description

In legacy strategy designs, the dashboard is a status monitor displaying static KPIs. The **Situation Room** model changes this interface:
- It asks: *"Prime Minister, what requires your attention today?"*
- Summarizes offline development and changes dynamically since the player's last session.
- Groups cards into actionable attention states: **Decide**, **Review**, **Monitor**, and **Celebrate**.
- Generates an **Executive AI Briefing** at the top that synthesizes the country's assessed state, priorities, and emerging risks.
- Priorities rise or fall based on a state engine scoring emergencies, deadlines, and active intents from the **Intent Engine**.

---

## 2. Technical Architecture & State Engine

To calculate which matters require attention, we will implement a dynamic prioritizing state engine. We will add a helper `src/lib/dashboard-state-engine.ts`:

```typescript
export interface DashboardCard {
  id: string;
  category: "decide" | "review" | "monitor" | "celebrate";
  system: "intent" | "meetings" | "politics" | "diplomacy" | "defense" | "economy";
  title: string;
  summary: string;
  priorityScore: number;
  metadata: Record<string, any>;
}

export function computePriorityScore(card: Omit<DashboardCard, "priorityScore">): number {
  let score = 0;
  
  // Category weighting
  if (card.category === "decide") score += 100;
  if (card.category === "review") score += 50;
  
  // Specific deadlines or urgencies
  if (card.metadata.isEmergency) score += 200;
  if (card.metadata.hoursRemaining) {
    const timeFactor = Math.max(0, 24 - card.metadata.hoursRemaining) * 10;
    score += timeFactor;
  }
  
  // Alignment with active Vision or Strategic Intent
  if (card.metadata.alignsWithActiveIntent) score += 75;
  
  return score;
}
```

This engine dynamically lists, scores, and sorts items for the UI, capping display at 5 items for **Urgent Matters**.

---

## 3. UI Layout & Component Organization

The dashboard interface will be located at `src/components/executive/ExecutiveWarRoom.tsx` (the core container) and structured as follows:

```text
+-------------------------------------------------------+
|                Executive AI Briefing                  |
| "Since your last session: ... Today's Priority: ..."  |
+-------------------------------------------------------+
|  [Urgent Matters] (Max 5 cards - Decide/Emergency)    |
+----------------------+--------------------------------+
|  [Government Agenda] |  [Active Commitments]          |
|  - Modernize Navy    |  - Housing Initiative          |
|  - Reduce Inflation  |  - Energy Grid Dev             |
+----------------------+--------------------------------+
|  [Cabinet Recs]      |  [Political Climate]           |
|  - Treasury warnings |  - Broker satisfaction status   |
+----------------------+--------------------------------+
```

### Key Modules:
- **`ExecutiveBriefingPanel`**: Renders the dynamic morning assessment from the server, styled with Facet glassmorphic overlays.
- **`UrgentMattersGrid`**: Actionable cards styled by severity (critical, high, medium, low) using `SEVERITY_BADGES` and linking to detail drawers.
- **`IntentProgressTracker`**: Pulls nodes directly from `getIntentsGraph` to show progress bars.
- **`BrokerExpectationMeter`**: Visualizes satisfaction bands (Supportive, Concerned, Opposed) for Power Brokers.

---

## 4. tRPC API Specs

We will expose the Situation Room endpoints under `api.dashboard` in `src/server/api/routers/dashboard/root.ts`:

1. **`getExecutiveBriefing`**: Runs the assessment engine and generates the text summary.
   * *Input*: `{ countryId: string }`
   * *Returns*: Assessments of Yesterday's Developments, Government Assessment, Today's Priorities, and Emerging Risks.
2. **`getSituationRoomCards`**: Queries active databases and filters them through `dashboard-state-engine.ts`.
   * *Input*: `{ countryId: string }`
   * *Returns*: Sorted list of cards categorized by *Decide*, *Review*, *Monitor*, and *Celebrate*.
3. **`dismissCelebration`**: Archives a "Celebrate" card (e.g. "Railway completed") so it no longer consumes dashboard space.
   * *Input*: `{ cardId: string }`

---

## 5. Verification Plan

### Automated Tests
* Add tests in `src/lib/__tests__/dashboard-state-engine.test.ts` to verify:
  - Cards are correctly sorted by their calculated `priorityScore`.
  - Emergency and expiring choices always rise to the top of the "Decide" pile.
  - Briefing compiler skips raw figures and outputs structured qualitative assessments.

### Manual Verification
* Deploy the updated `ExecutiveWarRoom.tsx` view and check:
  - Mobile responsiveness and glassmorphism styling in `/mycountry`.
  - Approve buttons directly open corresponding detail modals (e.g., `MeetingDetailModal` or `PolicyDetailSheet`).
  - Correct text masking is applied if the country is under Fog of Information.
