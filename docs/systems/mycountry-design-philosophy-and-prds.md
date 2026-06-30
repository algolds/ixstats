# MyCountry Design Philosophy & Community Feedback

This document outlines the core structural and gameplay philosophies governing the **MyCountry** module (v3), based on design principles and community feedback.

---

## 1. The Core Philosophy: "Facilitating Player Intent"

The single most critical design pillar of MyCountry is: **players should want to declare an intent, and the game mechanics should facilitate that intent.**

### Proactive vs. Reactive Deliberations
* **Issues are Reactive**: They represent curveballs, public demands, crises, and stakeholder pressures. They force the player to respond, adapt, and navigate trade-offs.
* **Policies are Proactive**: They represent the government's extraordinary efforts, mandates, and structural priorities. They are commitments made proactively by the player to gain benefits, offset issues, or drive the nation towards a specific vision.
* **Summits/Agendas are Intentional**: The **Meeting Scheduler** serves as the vehicle for aligning the cabinet and coordinating summits. When players select an *Intent* (e.g., bilateral agreement, cabinet realignment), the system collapses alternatives and shapes the entire meeting flow to realize that specific objective.

### Key Gameplay Rules
- **No Arbitrary Numbers**: Players do not configure raw numbers (e.g. choosing a specific risk rating or CivCap cost) in the creator interface. Instead, the attributes are derived from the player's core administrative choices (e.g. Priority, Category, and Decretal Key).
- **Extraordinary Efforts**: Policies represent *active, unusual* drives. They are not passive laws; they require continuous attention and civil service capacity.
- **Unified Stakeholder Concessions**: Policies are a primary way to manage stakeholder pressures without directly giving in to their standard demands. A player can enact a policy as a political concession to appease an interest group, but it comes at the cost of ongoing CivCap and budget upkeeps.

---

## 2. Fog of Information & Administrative Friction

A realistic simulation must avoid the "omniscient player" trap. The player's view of their nation is only as clear as their civil service is efficient.

* **Recon Capacity Constraints**: Over-stretching the civil service (exceeding available capacity) clouds reporting. Preview estimates become inaccurate, and warnings are shown.
* **Low Efficiency (Effectiveness < 45%)**: Obscures precise metric tracking. On custom policies, numeric effects are masked and converted to qualitative bands (e.g., *Mild Positive*, *Strong Negative*).
* **Department Presence**: A player cannot preview or launch policies in a category unless they have established a corresponding active department (e.g., finance, commerce, defense, interior, foreign).

---

## 3. Policy Origins & Advantages

To reward reactive play and create a dynamic loop:
1. **Whole-Cloth Initiatives**: Policies drafted independently from the player's general vision are harder to pass and maintain (standard CivCap and budget upkeeps).
2. **Reactive Opportunities**: Policies created as direct responses to Issues or Broker Requests are "easier" to implement. They gain **25% CivCap upkeep relief** and **15% maintenance cost reductions**, reflecting political alignment and lower friction.

---

# The Intent Engine: The IxStates North Star

The fundamental philosophy of MyCountry is **not** to "simulate a country."

It is:
> **Help the player express their vision of their country, then let the world push back naturally.**

NationStates asks: *"Here's an issue. Pick A, B or C."*
MyCountry asks: *"Tell me what your government is trying to do. I'll make that difficult."*

---

## The Core Shift: Managing Commitments, Not Problems

The legacy of browser nation-simulators lingers in the idea that the player's primary job is to manage problems (Issues). But if *Intent* is the center of the game, then the core gameplay loop must be about **managing commitments**.

Every mechanic in the game is a consequence of a commitment made by the player.

```text
I want this.
    ↓
Government commits.
    ↓
Resources consumed.
    ↓
Stakeholders & People react.
    ↓
Foreign powers react.
    ↓
Unexpected complications arise.
    ↓
History changes.
    ↓
New opportunities emerge.
    ↓
What do you want next?
```

Notice what is missing from the center: Issues. Numbers. Even Policies are not the center.

The absolute center of the game is:
> **Player Vision → Government Commitment → Emergent Consequences**

---

## The Intent Engine Architecture

To build a game around this philosophy, MyCountry utilizes a single core engine that every subsystem (Diplomacy, Politics, Defense, Economics, Infrastructure, Maps) plugs into. 

This is the **Intent Engine**:

### 1. Vision
*(The country you want)*
The long-term, overarching identity of the nation (e.g., *Maritime Trading Republic, Technocratic Green State, Military Hegemony*). This sets the baseline expectations for history and stakeholders.

### 2. Intent
*(The next thing you want to accomplish)*
The player declares a proactive objective (e.g., *Modernize the Navy, Eradicate Poverty, Establish a Continental Alliance*).

### 3. Commitment
*(Policies, Meetings, Diplomacy, Projects)*
The mechanical facilitation of the intent. The player holds Cabinet Meetings, drafts targeted Policies, allocates budgets, and dispatches diplomatic envoys to lock the government into the objective.

### 4. Execution
*(Civil Service, Ministries, CivCap, Budgets)*
The actual friction of governing. Commitments drain Civil Service Capacity (CivCap) and treasury funds. Poor government efficiency creates a "Fog of Information," obscuring progress and exact metrics.

### 5. Reaction
*(Stakeholders, Other Players, Markets, Events)*
The world pushes back. "Issues" are no longer random; they are generated specifically as resistance or complications to the player's execution. Power Brokers demand concessions, rival players react, and the economy shifts.

### 6. Consequences
*(Statistics, Approval, Diplomacy, Economy, Military, Lore)*
The tangible results of the execution and the player's navigation of the reactions. Stats go up or down, alliances are forged or broken, and stability is tested.

### 7. History
*(A permanent, searchable record of what your nation became)*
Every major decision, meeting, policy, and crisis outcome is recorded on a timeline. The game rewards consistency and lore-building over mere min-maxing. Every nation develops a deeply unique historical footprint.

---

## Conclusion

In this model, the player is never primarily solving random events—they are continually steering the nation toward the story they want it to become, while the simulation and other players ensure that story is never effortless. 

This is the strongest possible "north star" for IxStates, fully embracing proactive storytelling and mechanical intent.

---

# MyCountry: Beyond the NationStates Model
## Gameplay Framework Exploration

The traditional NationStates model relies heavily on a *reactive, slot-machine* loop: players log in, receive a random, disconnected issue, answer it, watch numbers change, and wait for the next one. 

Applying the new MyCountry philosophy—**"players declare an intent, and mechanics facilitate that intent"**—means we can completely invert this loop. Gameplay should be *proactive*. The player decides what they want to achieve, and the game provides the friction, tools, and consequences of pursuing that goal.

Here are four completely new, distinct gameplay frameworks that utilize our existing base (Policies, Meetings, CivCap, Budgets, Demographics, Geography, Power Brokers, Fog of Information) to reinvent the core loop.

---

### Framework 1: The "National Milestone" Loop (The Visionary Approach)
*Instead of just managing stats to keep them green, gameplay is structured around achieving massive, self-declared national projects.*

*   **The Core Verb:** Declaring a Milestone.
*   **The Loop:**
    1.  **Declare Intent:** At the start of a term/year, the player selects a Grand Milestone (e.g., *Transition to a Green Economy, Establish a Space Program, Eradicate Extreme Poverty, Achieve Continental Hegemony*).
    2.  **Facilitation (Meetings & Policies):** The Milestone requires specific prerequisites (e.g., High Tech Industry > 25%, a Budget Surplus, a Level 3 Education system). The player must use **Cabinet Meetings** to coordinate departments and draft **Policies** specifically designed to clear these bottlenecks.
    3.  **Targeted Friction (Issues):** Issues are no longer random background noise. They are spawned as direct consequences of the Milestone. Transitioning to a Green Economy? The Magnates (fossil fuel lobby) spawn crisis issues, strikes, and capital flight. Building a Space Program? You get budget overrun issues and scientific failure events.
    4.  **Resource Sink:** **CivCap** and the national budget are heavily invested into advancing the Milestone's progress bar.
*   **Why it fits the philosophy:** The player's intent is the engine of the game. Every policy they draft, every meeting they hold, and every issue they face is contextually tied to the goal they chose.

---

### Framework 2: The "Coalition Survival" Loop (The Political Animal)
*The player is not an absolute dictator; they are a political survivor who cannot act without the consent of the Power Brokers.*

*   **The Core Verb:** Managing the Coalition.
*   **The Loop:**
    1.  **Declare Intent:** The player wants to pass a major piece of legislation or change the budget (e.g., *Increase Military Spending*). 
    2.  **Facilitation (Political Horse-Trading):** The player cannot simply "click" to enact it. They must hold **Cabinet Meetings** and invite representatives of the Power Brokers (Generals, Technocrats, Clergy, Unions, Magnates). To secure the necessary "votes" to pass their intent, they must offer concessions—either direct budget handouts or by activating specific **Policies** that favor those brokers.
    3.  **Fog of Information:** If Government Efficiency is low, the player doesn't know exactly what it will take to buy a Broker's vote, leading to over-spending or failed summits.
    4.  **Targeted Friction (Issues):** Issues in this framework are essentially *ultimatums*. If a Power Broker's satisfaction drops below a critical threshold because they were ignored, they deliver a crisis (a military coup threat, a general strike, etc.).
*   **Why it fits the philosophy:** The mechanics (Meetings, Policies) are transformed into bargaining chips. The intent (passing a law) requires navigating the mechanical friction of human (AI) stakeholders.

---

### Framework 3: The "Geopolitics & Geography" Loop (The Map-is-the-Game)
*Everything stems from the physical map (Atlas Engine). The nation is not a spreadsheet; it is a physical space to be developed and defended.*

*   **The Core Verb:** Securing and Developing Geography.
*   **The Loop:**
    1.  **Declare Intent:** The player clicks directly on their map to declare an intent for a specific region (e.g., *Develop the Northern Resource Basin, Fortify the Eastern Border, Establish a Trade Hub in the Capital*).
    2.  **Facilitation (Regional Focus):** **Meetings** are held to allocate national budget and CivCap to those specific geographic regions. **Policies** become regionalized (e.g., *Subsidize Northern Industry* rather than a blanket national subsidy).
    3.  **Targeted Friction (Issues):** Issues arise geographically. You don't get a generic "Crime is up" issue; you get a "Cartel violence in the Southern Province" issue. You must dispatch resources (consuming CivCap) specifically to that map location to resolve it.
    4.  **Fog of Information:** Distant or underdeveloped provinces on the map have masked stats. You must spend CivCap to "survey" or establish administrative presence there before you can even accurately gauge their unemployment or GDP.
*   **Why it fits the philosophy:** Intent is grounded in physical reality. The mechanics facilitate interacting with the map, making the simulation feel deeply tangible.

---

### Framework 4: The "Crisis & Resilience" Loop (The Cyclical Approach)
*Gameplay is structured around preparing for predictable but massive cyclical shifts or looming external threats, rather than day-to-day minutiae.*

*   **The Core Verb:** Preparing for the Inevitable.
*   **The Loop:**
    1.  **Declare Intent:** The player can see a "Looming Crisis" on a global timeline (e.g., *Global Economic Recession, Climate Shift, Global War, Technological Singularity*). Their Intent is their chosen strategy for weathering it (e.g., *Pursue Autarky/Self-Reliance, Form Global Alliances, Fast-Track Technological Leapfrogging*).
    2.  **Facilitation (The Preparation Phase):** The player uses **Policies** and **Meetings** to stockpile specific resources, build designated infrastructure, and shape the economy according to their chosen strategy.
    3.  **Targeted Friction (The Survival Phase):** When the Crisis hits, the game state shifts. The severity and type of **Issues** that spawn are dictated by how well the player's preparations align with the crisis. A highly prepared nation gets manageable, localized issues. An unprepared nation gets cascaded, catastrophic issues that drain CivCap and plummet Stability.
*   **Why it fits the philosophy:** The intent is the long-term survival strategy. The mechanics provide the runway to build that strategy, and the issues are the ultimate test of its validity.

---

# MyCountry Systems: Findings & Insights Analysis

## 1. The Core Tension: Mechanics vs. Organic Roleplay
The Discord transcript explicitly reveals the fundamental tension identified in `ixstates-community-feedback-analysis.md`. 
* **Urcea's Stance (The Storyteller):** Argues against systems that cause "cognitive friction" when mechanics clash with organic roleplay (e.g., players deciding to be allies while the game mechanics say they have bad relations). He believes: *"it’s better to not have features that people can instead approximate organically rather than having ones people feel can/need to be ignored"*.
* **Burg's Stance (The System-Trustee):** (From the plan docs) Fears "stat-wanking" where players can arbitrarily change their nation's power without systemic checks.
* **Heku's Stance (The Developer):** Defends the mechanical abstractions but acknowledges the need to present them better (e.g., *"i will hide the percentage"*).

**The Insight:** The core loops design document (`mycountry-core-loops-design.md`) perfectly captures the solution: **The Canonical Loop (Action → World Effect → Narrative → Ledger).** The mechanics must serve the story by translating bounded, audited changes directly into narrative output (ThinkPages news, activity feeds) so the players don't have to manually reconcile the two.

---

## 2. Codebase Audit vs. Core Loops Design

I audited the `executive`, `diplomacy`, and `politics` systems in the codebase to see how they align with the plans and the Discord discussion.

### Executive System (National Issues)
* **Status:** Highly Aligned & Advanced.
* **Findings:** 
  * The `national-issues/player.ts` router is the gold standard for the canonical loop. 
  * **Civil Capacity Integration:** The Discord chat suggested *"utilizing small amount of temporary Civil Capacity to address issues"*. The codebase actually **already implements this** via the `commissionRecon` mutation (Statecraft Recon), which reserves `RECON_CAPACITY_COST` (20) from the nation's available Civil Capacity. 
  * **Proactive vs Reactive:** The codebase supports both. Issues have an `urgency` and `deadlineIxTime`. The `dismiss` mutation already allows dismissing non-urgent issues (fulfilling Keaor's *"skip option on med/small issues... delegate this to the relevant body option"*).
  * **Consequences:** The `respond` mutation routes through `NationalIssuesConsequences.resolveIssue`, which applies bounded changes and generates a notification, successfully closing the loop.

### Diplomacy System (Embassies & Relations)
* **Status:** The "Root Fix" is implemented, but the UI/UX tension remains.
* **Findings:**
  * The `establishEmbassy` mutation in `diplomacy/embassies/establish.ts` now automatically creates a `DiplomaticRelation` and fires `generateDiplomaticNews` to ThinkPages. This resolves the critical "open loop" mentioned in the core loops plan.
  * **Addressing Urcea's Friction:** The backend tracks relationship `strength` (e.g., 25 for a new embassy). To resolve the cognitive friction of players ignoring relation mechanics, Heku's idea to *"hide the percentage"* is correct. The system should lean into Keaor's suggestion of **"Stances"** (e.g., gravitating towards a relation status via automated policy levers) rather than forcing players to micromanage a relationship score.

### Politics System (Elections & Stability)
* **Status:** Engines built, automation hooks in place.
* **Findings:**
  * The `elections.ts` router delegates to a shared `simulateElectionCore`. This allows the cron job (`election-cron.ts`) to seamlessly simulate elections based on IxTime, making the politics system a "clock that runs while you're away." 
  * The next missing piece (as noted in the core loops doc) is linking **Internal Stability** dynamically to the components and policies, rather than it being a static editable field. 

---

## 3. Strategic Recommendations

Based on the alignment of the transcripts, the planning docs, and the codebase state, here are the recommended next steps to finalize the MyCountry systems:

1. **Obfuscate the Math, Highlight the Narrative (Diplomacy):** 
   Stop displaying raw relationship percentages. Instead, display qualitative bands ("Tense", "Neutral", "Cooperative") and use the `generateDiplomaticNews` spine to narrate shifts in relations. Introduce the "Stances" feature discussed in Discord to allow players to set broad foreign policy goals that slowly tick the hidden numbers in the background.
2. **Surface the Governance Ledger (Executive):**
   To satisfy Burg's fear of "stat-wanking," build the "Country Change Log" UI mentioned in the core loops design. Expose the `NationalIssueConsequence` audit rows directly on the Country Profile. Let players see exactly *why* a stat changed, bounded by the growth model.
3. **Expand the Issue Inbox (Executive):**
   Visually separate "Reactive Crises" (urgent, must be answered) from "Proactive Governance" (low-urgency, dismissable, optional policies) within the Issues UI, exactly as Keaor and Urcea brainstormed.
4. **Unify the Narrative Spine:**
   Ensure that *every* action across Executive, Diplomacy, and Politics routes through a single dispatcher that writes to the audit ledger and outputs to ThinkPages and the Activity Feed. The `national-issues` engine proves this works beautifully; it just needs to be applied universally.

---

# Intent Engine PRD — MyCountry v4
## "Facilitating Player Intent"

---

## 1. Executive Summary
The Intent Engine is the primary interaction model for MyCountry. 
Instead of asking players to manipulate raw mechanics directly (e.g., policies, budgets, GDP sliders, ministries), the Intent Engine asks a single question:

> **"What is your government trying to accomplish?"**

The engine translates player goals into executable governmental actions. The player expresses a vision, the government develops option plans, the world provides resistance (contextual issues), the player adapts, and the resulting history is permanently recorded.

---

## 2. The Three Levels of Intent
Every intent belongs to one of three layers, organized as a directed graph rather than a flat queue:

### National Vision (Long-term)
*   **Definition:** Overarching national identity.
*   **Examples:** *Become a naval superpower*, *Build the world's strongest welfare state*, *Become energy independent*.
*   **Expected Lifetime:** 10–100 years.

### Strategic Objectives (Medium-term)
*   **Definition:** Measurable goals supporting or independent of the Vision.
*   **Examples:** *Reduce inflation*, *Modernize the navy*, *Increase birth rate*, *Improve public transit*.
*   **Expected Lifetime:** 1–10 years.

### Operational Tasks (Short-term)
*   **Definition:** Immediate administrative actions.
*   **Examples:** *Hold budget meeting*, *Draft education reform*, *Sign trade agreement*, *Deploy emergency services*.
*   **Expected Lifetime:** Days to months.

---

## 3. The Intent Lifecycle
All governmental actions follow a unified lifecycle. No subsystem is allowed to bypass this pipeline:

```text
Vision
  ↓
Intent Created (Goal Statement, Wizard, Opportunity, or Vision continuation)
  ↓
Analysis (Ministries assess budget, CivCap, Power Broker support, and Fog of Information)
  ↓
Government Deliberation (Dynamic generation of Plans A, B, and C with pros/cons)
  ↓
Commitment (Selected plan reserves CivCap, schedules Meetings, drafts Policies)
  ↓
Execution & Bureaucratic Action (Departments implement; low efficiency creates Fog)
  ↓
Reaction & Resistance (Contextual issues spawn directly in response to active intents)
  ↓
Adaptation (Player resolves complications through secondary choices, e.g. budget injection)
  ↓
Completion / Failure (Outcome summary finalized; CivCap released)
  ↓
Historical Legacy (Timeline and ThinkPages permanently record the result)
```

---

## 4. Intent as a Directed Graph
To support complex, interdependent goals, intents are modeled as a **Directed Acyclic Graph (DAG)**. 

### Graph Topology Example:
```text
National Vision: "Become a Global Maritime Power"
└── Strategic Objective: "Modernize the Navy" (Requires: Expand Shipbuilding Industry)
    ├── Operational Task: "Expand Shipbuilding Industry" [Completed]
    ├── Operational Task: "Recruit Naval Personnel" [Active]
    └── Operational Task: "Adopt Blue Water Doctrine" [Blocked - Prerequisite missing]
```
Completing prerequisite nodes automatically transitions dependent child nodes from `Blocked` to `Proposed` status.

---

## 5. Database Schema Spec

We will add the following schema to `prisma/schema/government.prisma`:

```prisma
model NationalIntent {
  id             String             @id @default(cuid())
  countryId      String
  title          String
  description    String?
  layer          String             // "VISION" | "STRATEGIC" | "OPERATIONAL"
  status         String             // "blocked" | "proposed" | "active" | "completed" | "failed"
  civCapCost     Float              @default(0)
  budgetCost     Float              @default(0)
  category       String
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  parentIntents  IntentDependency[] @relation("DependentIntents")
  childIntents   IntentDependency[] @relation("PrerequisiteIntents")
}

model IntentDependency {
  id             String             @id @default(cuid())
  parentIntentId String
  childIntentId  String
  dependencyType String             @default("prerequisite") // "prerequisite" | "blocker"
  
  parentIntent   NationalIntent     @relation("DependentIntents", fields: [parentIntentId], references: [id], onDelete: Cascade)
  childIntent    NationalIntent     @relation("PrerequisiteIntents", fields: [childIntentId], references: [id], onDelete: Cascade)
}
```

---

## 6. Design Rules
1.  **Rule 1: Players declare outcomes, never mechanics.**
2.  **Rule 2: The government develops plans, not the UI.**
3.  **Rule 3: Every commitment creates resistance.** (No free decisions).
4.  **Rule 4: Every resistance creates adaptation.** (Failure is gameplay).
5.  **Rule 5: Everything becomes history.** (Searchable ledger entries).
6.  **Rule 6: No subsystem bypasses the Intent Engine.** (Unified pipeline).

---

# Executive Meeting System PRD — MyCountry v4
## "Government Happens Here"

---

## 1. Executive Summary
The Meeting System is the primary gameplay interface of MyCountry. Players do not directly enact most governmental actions. Instead, they convene meetings where the government develops recommendations, negotiates priorities, and commits to action. 

If the **Intent Engine** is the brain of the nation, the **Meeting System** is the heart where deliberation occurs. Every major national decision begins in a meeting, and every important meeting becomes part of persistent history.

---

## 2. Core Design Pillars
*   **Meetings are Gameplay:** Not calendars or cutscenes, but the primary surface where players negotiate with institutions and brokers.
*   **Meetings Produce Commitments:** Meetings do not immediately change stats; they create policies, programs, budgets, and military directives that execute later.
*   **Meetings Coordinate Government:** Represents the dynamic intersection of ministries (Treasury, Defense, Health), Power Brokers, and political parties.
*   **Meetings Generate Knowledge:** Exposes briefings, warnings, risk assessments, and dynamic recommendation options rather than raw spreadsheets.

---

## 3. The Core Gameplay Loop
```text
Government Need (Intent/Issue/Opportunity/Promise)
  ↓
Meeting Convened
  ↓
Preparation (Departments compile intelligence; CivCap spent)
  ↓
Government Briefing (Executive summary, cost estimates, confidence rating)
  ↓
Deliberation (Ministries debate; Power Brokers lobby; conflict emerges)
  ↓
Decision (Player selects Plan A, B, C, delays, or requests further study)
  ↓
Commitment (Selected plan is generated as a node in the Intent Engine)
  ↓
Execution & Consequences
  ↓
Historical Record (Permanent timeline ledger entry)
```

---

## 4. Meeting Categories & Plugins
1.  **Executive Cabinet:** Coordinates national priorities across all ministries.
2.  **Budget Session:** Treasury and Finance negotiate allocations, deficits, and tax changes.
3.  **National Security Council:** Defense and Intelligence authorize operations, procurement, and doctrine reform.
4.  **Foreign Affairs Summit:** Envoys negotiate treaties, trade pacts, and joint exercises.
5.  **Infrastructure Council:** Coordinates energy, transit, and housing projects.
6.  **Economic Council:** Plans trade strategy, labor policy, and subsidies.
7.  **Crisis Meeting:** Immediate, time-sensitive triage session with zero preparation and high information fog.

---

## 5. Participant Profile Structure
Every meeting attendee has a defined profile affecting discussions and options:
*   **Role & Authority:** Ministry portfolio or Power Broker group (e.g. Minister of Finance, Genera/Generals).
*   **Expertise & Influence:** Technical competence rating and political weight (used for voting weight).
*   **Agenda & Approval:** Personal political goals and alignment score with the active administration.

---

## 6. Dynamic Recommendation Engine
Rather than presenting single answers, the government generates dynamically tailored plans based on the nation's state:
*   *Option A (State-Driven):* High bureaucratic control, expensive, fast, high CivCap cost.
*   *Option B (Market-Driven):* Cheap, private incentives, fast, satisfies Magnates, but carries lower public approval.
*   *Option C (Balanced/Targeted):* Moderate cost and timing, balanced broker support.
*   *Option D (Emergency Triage):* Drastic cuts or high-risk measures.

---

## 7. Fog of Information & Governance Competence
*   **High Government Efficiency (>75%):** Briefings yield precise cost estimates, clear risk forecasts, and reliable timelines.
*   **Low Government Efficiency (<45%):** Data is missing, estimates are masked as qualitative bands (e.g. "Highly Uncertain Cost"), advice is contradictory, and surprise events occur mid-meeting.

---

# Executive Dashboard PRD — MyCountry v4
## "The Government Situation Room"

---

## 1. Executive Summary
The Executive Dashboard is the primary landing page for MyCountry. Rather than acting as a static KPI tracking sheet, it functions as the **Government Situation Room**, delivering structured, actionable briefings directly to the Head of Government at the start of every session. Every card answers one of four key questions:
*   *What requires my attention today?*
*   *What is my government currently executing?*
*   *What has changed since I was last online?*
*   *What emerging opportunities or risks exist?*

---

## 2. Core Design Pillars
*   **The Government Never Sleeps:** Summarizes offline developments and timeline shifts (e.g. *"Since your last visit: Railway modernization entered Phase II, Parliament approved the Education Bill"*).
*   **Every Card Demands a Decision:** No card exists purely as flavor text. If it does not invite executive action, it belongs in the deep Intelligence panel.
*   **Executive, Not Analyst:** Highlights choices and directions; analytics and raw numbers remain hidden under Level 4 progressive disclosure tabs.

---

## 3. Dashboard Grid Layout
The landing page coordinates information into clean, progressive sections:
1.  **Executive Briefing (AI Morning Report):** Dynamically compiled recap of Yesterday's Developments, Government Assessment, Today's Priorities, and Emerging Risks.
2.  **Urgent Matters (Max 5):** Emergency sessions, expiring treaty deadlines, or Power Broker ultimatums requiring immediate signatures.
3.  **Government Agenda:** Live strategic progress meters pulled from active `NationalIntent` graph nodes.
4.  **Active Commitments:** Operational programs currently consuming CivCap, budget, and department bandwidth.
5.  **Executive Calendar:** Upcoming scheduled Cabinet meetings, summits, and reviews.
6.  **Cabinet Recommendations:** Actionable proposals submitted directly from active departments.
7.  **Political & Diplomatic Climate:** Status of Power Broker relationships and outstanding external embassies.
8.  **Government Timeline:** A persistent historical memory ledger of recent completed events.

---

## 4. Government Attention Model
Every widget belongs to one of four actionable attention categories:
*   **Decide:** Requires active executive approval or signing.
*   **Review:** Government requests oversight on an active program.
*   **Monitor:** Watch rising trends (e.g. inflation warnings).
*   **Celebrate:** Celebrates administrative completions (e.g. infrastructure finished).

---

## 5. State Engine & Priority Scoring
MATTERS are continuously prioritized on the dashboard. We will implement `dashboard-state-engine.ts` to assign weights:
$$\text{Priority Score} = \text{Category Weight} + \text{Urgency Weight} + \text{Intent Alignment Bonus}$$

*   `Decide` Category: $+100$
*   `Emergency` Flag: $+200$
*   `Alignment` with Active Vision: $+75$
*   `Time-sensitive` (less than 24 hours): Up to $+240$ (based on hours remaining)
The highest-scoring items automatically bubble up to the **Urgent Matters** widget.

---

# Government, Legislature, & Foreign Affairs Domains PRD — MyCountry v4
## "The Executive Domains"

---

## 1. Executive Summary
Under the MyCountry v4 philosophy, **Politics** and **Diplomacy** stop functioning as standalone games or isolated menu pages. Instead, they are restructured as **Executive Domains** plugging directly into the **Intent Engine** and **Meeting System**. 

The player's entry point is always the **Executive Dashboard (Situation Room)**, where they declare intent, hold deliberation summits, authorize commitments, and experience reactions. 

---

## 2. Executive Matrix
Every domain operates under the exact same grammar (Declare $\rightarrow$ Convene $\rightarrow$ Authorize $\rightarrow$ Review), utilizing the same underlying engine:

| Domain | Deliberation (Meeting) | Commitment | Execution Layer |
|---|---|---|---|
| **Legislature** | Legislative Strategy Meeting | Legislative Bill | Coalition Ministries |
| **Foreign Affairs** | Diplomatic Summit | Treaty / Active Pact | Foreign Ministry / Embassies |
| **National Security**| War Council | Operations | Armed Forces |
| **Economy** | Economic Council | Budget / Allocations | Treasury / Central Bank |
| **Infrastructure** | Planning Board | Projects | Public Works |

---

## 3. Legislature Domain (Elections & Politics Replaced)
The concept of a separate "Elections System" is removed. Instead, elections represent the checkpoint transition in a continuous legislative loop.

### Core Architecture:
1.  **Political Parties as Active Negotiators:** Political parties are modeled as active entities. Each party has a seats count, manifesto ideologies, red lines (dealbreakers), and political capital.
2.  **Legislative Bills as Commitments:** Introducing a bill creates a commitment node in the Intent graph. 
3.  **Deliberate & Vote:** The player holds legislative meetings to buy coalitions and compromise with opposition red lines (e.g. removing a tax proposal to gain union support).
4.  **Emergent Elections:** Elections occur automatically on cyclical dates, acting as a historical transition. The seats are redistributed based on a voter model calculating your commitments' successes, failures, and party platform alignment recorded on the timeline. No artificial modifiers.

---

## 4. Foreign Affairs Domain (Diplomacy Replaced)
Governments do not "do diplomacy"—foreign ministries execute foreign policy.

### Core Architecture:
1.  **Embassies as Departments:** Embassies are no longer passive buildings. They are treated as local departments consuming budget/CivCap to execute specific `ForeignMission` objectives (e.g., trade generation, visa processing, strategic intelligence).
2.  **Treaties as Living Programs:** Treaties are commitment nodes in the Intent Graph. They reserve budget/CivCap and require periodic Review Meetings to maintain alignment. 
3.  **Summits are Meetings:** International summits, G7-style talks, trade pact negotiations, and war councils use the same `CabinetMeeting` engine.
