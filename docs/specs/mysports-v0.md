Absolutely. I’ve folded the audit into the original PRD rather than simply appending recommendations. The main changes are:

* **Competition/Participant abstractions** to prevent the soccer-centric `League/Club` model from breaking F1 and other sports.
* **Four domain entities + canonical event stream** rather than treating events as equivalent persistent objects.
* A formal **Focus resolution/selection model**.
* Explicit **domain contracts**.
* **Simulation snapshots, seeds, resolver/rule versioning, and immutability** for historical reproducibility.
* Separation of **Storyteller narrative** from **Storyteller/world-state modifiers**.
* **COMPETE error/idempotency states**.
* Clear separation of **server, URL, user-preference, and ephemeral UI state**.
* More precise **SportDefinition boundaries**.
* P0 split into **Foundation → Core Management → COMPETE → Polish**.
* Momentum, narrative polish, and other nonessential elements moved out of the true foundation.
* Stronger acceptance criteria and success metrics.
* Explicit architectural rules to prevent seven sport-specific codebases from emerging.

The result below is intended to be the **new canonical PRD**, not an audit/commentary document. It preserves the original project's terminology and intent while resolving the architectural gaps identified in the review. 

# MySports (MyLeague + MyClub) — Product Requirements Document

**Status:** Draft v2 — Architecture & Product Foundation
**Component:** Labs — Sports Simulation Studio
**Platform:** IxStates / Caphiria worldbuilding platform
**Primary Experience:** COMPETE
**Initial Sport:** Soccer
**Future Sports:** Hockey, Formula 1, Boxing, Basketball, Baseball, Football

---

# 1. Product Definition

MySports is the sports simulation layer of IxStates, consisting initially of **MyLeague** and **MyClub**.

**MyLeague** is the competition interface: the place where users observe, operate, and progress a sporting competition.

**MyClub** is the organization/franchise interface: the place where users manage a participant within that competition.

The system is designed around a shared sports-domain architecture rather than sport-specific applications. Soccer is the first implementation and architectural proving ground; subsequent sports must be introduced through explicit sport adapters rather than parallel UI systems.

MySports also provides the bridge between IxStates' sports simulation and its broader worldbuilding systems, including Storyteller events, patron-saint systems, ThinkPages, IxCredits, and the Vault.

The central product thesis is:

> **MyLeague is the competition interface. MyClub is the organization interface. Focus is the navigation primitive. COMPETE is the primary interaction. The match event log is the canonical record of what happened. Sport Definitions supply sport-specific rules, terminology, and visualization. Command, Broadcast, and Almanac are presentation modes over the same underlying domain objects.**

Everything in this PRD should reinforce that architecture.

---

# 2. Problem Statement

IxStates' sports lore — including the WAFF World Cup, Caphirian Imperial League, LHL hockey, and other competitions — currently exists partially disconnected from the `MyLeague` simulation engine (`sports.prisma` / `resolver.ts`).

Users who want to:

* run a competition,
* manage an organization,
* simulate matches,
* follow a season,
* inspect athletes,
* explore historical results,
* or connect sports to the wider worldbuilding timeline

need a coherent interface rather than raw simulation data.

There is also a structural problem.

IxStates intends to support multiple sports with substantially different competitive models:

* soccer
* hockey
* Formula 1
* boxing
* basketball
* baseball
* football

Building each sport screen-by-screen would create duplicated pages, hooks, stores, visualization systems, terminology, and interaction models.

MySports therefore needs a **domain abstraction layer first**, followed by a reusable interface system.

The platform also needs to preserve the distinction between:

1. **what the simulation says happened,**
2. **how the system explains what happened,**
3. **how the worldbuilding layer narrates what happened,**
4. **how the UI visually presents what happened.**

These concerns must not become entangled.

---

# 3. Goals

## 3.1 Primary Goals

1. Ship a Labs-preview-quality MyLeague + MyClub experience for soccer that is genuinely usable for running a season and managing an organization end-to-end.

2. Establish a shared sports-domain architecture that can support additional sports without creating sport-specific versions of the core application.

3. Make **Focus** the consistent navigation primitive for competitions, organizations, athletes, and matches.

4. Make **COMPETE** the primary action through which simulation becomes an understandable interactive experience rather than a database operation.

5. Preserve a canonical, deterministic simulation record that remains independent from narrative, visual, and presentation layers.

6. Integrate Storyteller/worldbuilding systems as first-class simulation context without allowing narrative systems to become the source of truth for competitive outcomes.

7. Make historical sports data persistent and trustworthy enough to support an eventual Almanac experience.

8. Establish component and data contracts that allow additional sports to be implemented primarily through `sports/<sport>/` adapters.

---

# 4. Non-Goals

The following are explicitly outside the initial foundation.

### 4.1 Seven-Sport Launch

Soccer is the first implementation.

The objective is to prove the abstraction, not launch every sport simultaneously.

### 4.2 Full Institutional Management

The following are downstream systems:

* scouting
* medical management
* academy systems
* merchandising
* sponsorship administration
* facility management
* organizational hierarchy

These may eventually become part of MyClub but are not required for the initial core loop.

### 4.3 Cinematic Simulation Theater

The system must not manufacture waiting time simply to make simulation appear dramatic.

A 300ms simulation should feel like approximately 300ms.

A cinematic simulation sequence may eventually exist as an optional presentation layer, but it must never be a mandatory gate for users progressing through large numbers of matches.

### 4.4 Continuous-Auction Market UI

The existing transfer model is an escrow-based sealed bidding system.

The interface must represent that model accurately.

It must not imitate a Bloomberg-style continuous order book or bid/ask depth ladder when the underlying system does not provide continuous price discovery.

### 4.5 Full Visual Caphirian Theming

The initial implementation should not be dominated by:

* marble
* gold
* heraldry
* Roman architectural motifs
* decorative imperial UI

The visual identity will evolve after the information architecture and interaction system are validated.

### 4.6 3D / Cinematic Match Engine

No 3D player models, stadium camera systems, or broadcast-camera simulation are required for the initial product.

---

# 5. Core Product Principles

## 5.1 Object-Centric Architecture

MySports should not be designed as a collection of isolated pages.

The fundamental navigation model is:

```text
DOMAIN OBJECT
      ↓
FOCUS
      ↓
CONTEXTUAL VIEW
```

The user may arrive at the same object through:

* a standings table,
* a fixture,
* a roster,
* an athlete card,
* an archive,
* a match result,
* a ThinkPages post,
* or a Storyteller event.

The destination should remain the same conceptual object.

---

## 5.2 Four Core Entities + One Canonical Event Stream

The sports domain consists of four primary persistent entities:

```text
Competition
Organization
Athlete
Match
```

and one canonical event stream:

```text
MatchEvent[]
```

### Competition

A structured competitive environment containing participants, rules, fixtures, standings, seasons, and results.

### Organization

The sport-specific competitive organization participating in a competition.

The UI terminology may vary by sport:

```text
Soccer       → Club
Hockey       → Club
Basketball   → Franchise / Team
Football     → Franchise / Team
F1           → Constructor
```

The underlying domain abstraction should not force the word "Club" onto every sport.

### Athlete

A human competitive participant.

Sport terminology may vary:

```text
Soccer       → Player
Hockey       → Player
F1           → Driver
Boxing       → Boxer
Basketball   → Player
```

### Match

The canonical competitive event.

Depending on the sport, this may be presented as:

```text
Soccer       → Match
Hockey       → Game
F1           → Race
Boxing       → Bout
```

### MatchEvent

An atomic occurrence within a match.

Examples:

```text
Goal
Penalty
Yellow card
Red card
Substitution
Injury
Pit stop
Overtake
Knockdown
KO
Home run
Touchdown
```

A `MatchEvent` is not a peer to a Competition or Athlete. It is an immutable event in a Match's canonical event stream.

---

# 6. Competition vs. MyLeague

`MyLeague` is a product/application name.

The underlying domain object should be **Competition**.

This distinction is required because not every supported sport or future format is technically a league.

A Competition may represent:

* league seasons
* championships
* cups
* tournaments
* race series
* group stages
* knockout stages
* future promotion/relegation systems

Therefore:

```text
MyLeague
   ↓
Competition interface
   ↓
Competition domain object
```

The initial soccer implementation may primarily expose league-style competitions.

---

# 7. Focus Architecture

## 7.1 Focus Definition

Focus represents the user's current contextual object.

```ts
type SportsFocus =
  | { type: "competition"; id: string }
  | { type: "organization"; id: string }
  | { type: "athlete"; id: string }
  | { type: "match"; id: string }
```

Focus is a navigation/context concept, not merely a selected table row.

---

## 7.2 Focus vs. Selection

The implementation must distinguish:

### Focus

The object around which the current experience is organized.

Example:

```text
Competition: Imperial League
Focus: Victoria FC
```

### Selection

A temporary UI interaction.

Example:

```text
User clicks Marcellus in a roster table.
```

Selection may open a profile, tooltip, drawer, or contextual panel without necessarily changing the page's primary Focus.

This prevents every hover/click from becoming URL navigation.

---

## 7.3 URL State

Focus is URL-addressable.

Example:

```text
/myleague/imperial?tab=standings&focus=organization:victoria
```

or:

```text
/myclub/victoria?section=roster&focus=athlete:marcellus
```

URL state should contain meaningful navigational context:

```text
tab
section
season
round
focus
match
```

Transient interface state should not normally be serialized:

```text
hovered row
open tooltip
temporary animation state
sidebar pixel width
```

---

## 7.4 Focus Resolution

Every Focus target must pass through a resolver.

```text
URL
 ↓
Parse Focus
 ↓
Resolve Object
 ↓
Validate Context
 ↓
Apply Focus
```

Possible states:

```text
VALID
→ focus applied

NOT_FOUND
→ contextual not-found state

INVALID_CONTEXT
→ focus cleared while preserving page

UNAUTHORIZED
→ permission-aware state

MALFORMED
→ focus ignored
```

A valid object must not automatically imply that the user is authorized to see every view associated with it.

For example, a public club profile may be accessible while the club's finances remain owner-only.

---

# 8. Sport Definition Architecture

## 8.1 Purpose

`SportDefinition` is the primary adapter boundary between the universal sports platform and sport-specific behavior.

Sport definitions provide **rules, terminology, domain interpretation, and visualization metadata**.

They do not contain a duplicate implementation of the entire simulation engine.

---

## 8.2 Proposed Interface

```ts
interface SportDefinition {
  id: SportType

  terminology: {
    athlete: string
    organization: string
    match: string
    standings: string
  }

  roster: RosterDefinition

  rules: RuleDefinition

  competition: CompetitionDefinition

  simulation: SimulationDefinition

  visualization: {
    primarySurface: SportSurface
    secondarySurfaces?: SportSurface[]
  }
}
```

The exact TypeScript interfaces may evolve during implementation, but the separation of concerns must remain.

---

## 8.3 Sport Definition Responsibilities

### Terminology

Controls contextual vocabulary:

```text
Player
Driver
Boxer
Club
Constructor
Race
Match
Bout
```

### Roster

Defines sport-specific roster structure and positions.

### Rules

Defines scoring, periods, rounds, penalties, substitutions, race structure, etc.

### Competition

Defines how standings, fixtures, rounds, stages, and ranking systems are interpreted.

### Simulation

Defines the sport-specific resolver adapter and required simulation inputs.

### Visualization

Defines the appropriate primary visual surface:

```text
Soccer    → Pitch
Hockey    → Rink
Basketball → Court
Baseball  → Diamond
F1        → Circuit
Boxing    → Ring
Football  → Field
```

---

# 9. Sport Adapter Engineering Rule

Adding a sport must not require sport-specific branching throughout the core application.

The acceptance criterion is:

> **Adding a sport must not require sport-specific conditionals inside `SportsShell`, Focus infrastructure, generic domain components, or the COMPETE state machine. If a new sport requires a shared abstraction to evolve, that change must occur at an explicit shared contract boundary.**

For example:

```text
src/sports/hockey/
├── definition.ts
├── roster.ts
├── rules.ts
├── competition.ts
├── simulation.ts
└── HockeyRink.tsx
```

The architecture must avoid:

```tsx
if (sport === "soccer") ...
if (sport === "hockey") ...
if (sport === "f1") ...
```

inside generic components.

---

# 10. Canonical Domain Contracts

The implementation must establish explicit domain contracts before the UI becomes deeply coupled to Prisma models.

At minimum:

```text
Competition
Season
Organization
Athlete
Match
MatchEvent
Standings
SimulationResult
SimulationSnapshot
WorldModifier
```

---

## 10.1 Match

Conceptually:

```ts
interface Match {
  id: string
  competitionId: string
  seasonId: string

  participants: MatchParticipant[]

  status: MatchStatus

  scheduledAt?: Date

  result?: MatchResult

  simulation?: SimulationRecord

  events: MatchEvent[]
}
```

---

## 10.2 MatchEvent

```ts
interface MatchEvent {
  id: string
  matchId: string

  type: MatchEventType
  timestamp: number

  participants: string[]

  outcome: EventOutcome

  metadata: Record<string, unknown>

  narrative?: string
}
```

The event record is canonical.

Narrative is optional presentation metadata.

---

## 10.3 Simulation Record

```ts
interface SimulationRecord {
  seed: string

  resolverVersion: string
  ruleVersion: string

  inputSnapshotId: string

  status: "resolved" | "failed"

  resultId?: string

  resolvedAt: Date
}
```

---

# 11. Simulation Determinism & Historical Reproducibility

Deterministic simulation is a core product requirement.

A historical match must remain reproducible even after:

* player ratings change,
* tactics change,
* resolver logic evolves,
* sport rules are updated,
* world modifiers expire,
* presentation systems change.

Therefore, the canonical simulation record must preserve:

```text
Simulation Seed
Resolver Version
Rule Version
Simulation Input Snapshot
Canonical Result
Canonical MatchEvent[]
```

---

## 11.1 Simulation Input Snapshot

Before resolution, the system must capture the inputs required to reproduce the simulation.

This may include:

* participant ratings
* athlete availability
* tactical configuration
* relevant world modifiers
* competition state
* home advantage
* environmental inputs
* applicable rules
* other resolver-specific variables

The exact fields are resolver-dependent, but the principle is mandatory.

---

## 11.2 Historical Immutability

Once a match has been successfully resolved:

> **The canonical result and event log must not change simply because current player/team data has changed.**

A future resolver version may produce a different hypothetical result, but it must not silently rewrite historical reality.

---

# 12. Simulation Resolver Architecture

The existing resolver remains the source of competitive truth.

Conceptually:

```text
Competition State
       ↓
World Modifiers
       ↓
Simulation Input Snapshot
       ↓
Sport Resolver
       ↓
Canonical Match Result
       ↓
Canonical MatchEvent[]
```

The UI does not invent simulation outcomes.

The Storyteller does not invent simulation outcomes.

The narrative system does not alter simulation outcomes.

---

# 13. Storyteller Integration

Storyteller integration consists of two distinct systems and they must not be conflated.

## 13.1 Narrative Layer

Answers:

> "How should what happened be described?"

Example:

```text
Marcellus scored in the 67th minute.
```

may receive a narrative presentation such as:

```text
Marcellus broke through on the counter and finished decisively.
```

Narrative is presentation.

---

## 13.2 World Modifier Layer

Answers:

> "Does a worldbuilding event change the conditions under which the simulation occurs?"

Examples:

```text
Patron blessing
→ morale modifier

Club scandal
→ stability modifier

National event
→ competition/participant modifier

Ceremonial event
→ temporary contextual modifier
```

Conceptually:

```ts
interface WorldModifier {
  id: string
  source: string

  scope: ModifierScope

  effect: ModifierEffect

  startsAt: Date
  endsAt?: Date
}
```

The pipeline becomes:

```text
Storyteller Event
       ↓
World Modifier
       ↓
Simulation Inputs
       ↓
Resolver
       ↓
Match Events
```

Narrative presentation is a separate downstream layer:

```text
Match Events
       ↓
Narrative
```

This ensures that AI or narrative systems cannot silently become the source of competitive truth.

---

# 14. Presentation Modes

MySports has three presentation modes.

They are not separate datasets or separate versions of the sports system.

They are lenses over the same canonical domain objects.

---

## 14.1 Command

Answers:

> **"What is the state of my competition or organization?"**

Primary use:

* MyLeague
* MyClub
* standings
* schedules
* rosters
* finances
* management

Command is the default operational mode.

---

## 14.2 Broadcast

Answers:

> **"What is happening right now?"**

Primary use:

* live match
* replay
* COMPETE result presentation
* event ticker
* score
* momentum
* narrative moments

Broadcast is reactive and event-oriented.

---

## 14.3 Almanac

Answers:

> **"What happened historically?"**

Primary use:

* season archive
* champions
* records
* athlete careers
* historical matches
* club history
* competition history

Almanac is query-oriented and archival.

---

# 15. Athlete Cards

Athlete cards are not a fourth presentation mode.

The canonical object remains:

```text
Athlete
```

Possible representations include:

```tsx
<AthleteTableRow />
<AthleteProfile />
<AthleteCard />
<AthleteTacticalNode />
```

All representations must read from the same canonical Athlete object.

This becomes especially important for eventual Vault/Trophy Card integration.

---

# 16. COMPETE

COMPETE is the primary interaction of MySports.

The system must model it as a state machine rather than a single API request.

```text
READY
  │
  │ COMPETE
  ▼
SIMULATING
  │
  ├───────────────┐
  │               │
SUCCESS          ERROR
  │               │
  ▼               ▼
RESULT          ERROR STATE
  │
  ▼
ANALYSIS
```

Additional terminal/recovery states may include:

```text
CANCELLED
ALREADY_RESOLVED
RETRYABLE_ERROR
```

---

## 16.1 Simulation Presentation Speed

Users should eventually be able to choose:

```text
Instant
Brief
Live
```

### Instant

Resolve immediately and show the final result.

### Brief

Show a short sequence of meaningful events.

### Live

Reveal events progressively.

Simulation speed is presentation behavior.

It must never change the simulation result.

---

## 16.2 No Manufactured Latency

Simulation UI must reflect actual processing.

If resolution takes 300ms, the interface should not deliberately wait 5 seconds.

If a cinematic presentation is introduced later, it must be:

* optional,
* skippable,
* user-configurable,
* independent of actual resolver latency.

---

## 16.3 Idempotency

A successful match simulation must be idempotent.

Repeated requests must not produce multiple canonical results.

Example:

```text
User clicks COMPETE
       ↓
Request A

Network retries
       ↓
Request B

Both resolve against same match
       ↓
ONE canonical simulation
```

A match already resolved must return its existing canonical result unless an explicitly authorized replay/reset operation exists.

---

# 17. Match Analysis

After a result, MySports should explain the outcome.

The preferred pipeline is:

```text
Resolver
   ↓
Structured Analysis Facts
   ↓
Deterministic Explanation
   ↓
Optional Narrative Layer
```

The system should not require an LLM to explain a result.

Example:

```text
VICTORIA WON 2–1

Why:

• Victoria generated more attacking opportunities.
• Their midfield efficiency exceeded the opponent's by 11%.
• Marcellus converted two high-value chances.
• Home advantage contributed modestly to the final rating.
```

The exact metrics depend on the sport and resolver.

The important principle is:

> **The simulation should explain itself using its own structured data.**

---

# 18. Information Architecture

MyLeague and MyClub use the same underlying shell but have different information priorities.

|               | MyLeague                              | MyClub                        |
| ------------- | ------------------------------------- | ----------------------------- |
| Core question | What's happening in this competition? | How is my organization doing? |
| Primary       | Standings                             | Next match                    |
| Secondary     | Fixtures                              | Roster                        |
| Third         | Results                               | Form                          |
| Fourth        | Form                                  | Tactics                       |
| Fifth         | Organizations                         | Transfers                     |
| Sixth         | History                               | Finances                      |

---

# 19. SportsShell

The core application shell should be reusable across MyLeague and MyClub.

```text
SportsShell
│
├── SportsHeader
│
├── CompetitionHeader / OrganizationHeader
│
├── SportsNavigation
│
└── SportsWorkspace
    │
    ├── PrimaryView
    │
    └── ContextRail
```

The shell should remain largely sport-agnostic.

---

# 20. MyLeague

## 20.1 MyLeague Lobby

The lobby presents active competitions.

Potential presentation:

```text
ACTIVE COMPETITIONS

┌────────────────────┐
│ Imperial League    │
│ Season 2033        │
│ Round 14            │
│                    │
│ 1st Victoria       │
│ Next: Senate FC    │
└────────────────────┘

┌────────────────────┐
│ WAFF Championship  │
│ Group Stage        │
│                    │
│ ...
└────────────────────┘
```

A carousel may eventually be used where appropriate, but the information hierarchy must remain accessible without requiring horizontal interaction.

---

# 21. MyLeague Competition Workspace

Primary navigation:

```text
Overview
Standings
Schedule
Results
Organizations
Archive
```

Additional sport-specific views may appear through the SportDefinition.

Examples:

```text
Races
Bracket
Draft
```

should not be forced into every sport's interface.

---

# 22. League Overview / Competition Pulse

The overview should answer:

> **"What matters right now?"**

Potential information:

* current leader
* title-race context
* most recent result
* next major fixture
* form movement
* notable events
* relevant worldbuilding bulletin

"League Pulse" should initially be deterministic and data-driven.

Storyteller/LLM-generated prose is optional and should not be a P0 dependency.

---

# 23. Standings

The standings interface should provide:

* rank
* organization
* played
* wins
* draws
* losses
* points
* relevant sport-specific statistics
* form
* movement

Rows should be directly focusable.

Example:

```text
Standings
────────────────────────────────────

01  Victoria FC       34 pts  ↑
02  Senate FC         31 pts  →
03  Castra United     28 pts  ↓
```

Selecting an organization should open contextual information without requiring the user to restart navigation.

---

# 24. CompetitionTimeline

`CompetitionTimeline` is the shared chronological schedule component.

It answers:

> **"Where are we in the season?"**

It should work for:

```text
Soccer → rounds
Hockey → games
F1 → race calendar
Boxing → bouts
```

It should not be implemented as a generic calendar grid unless a particular sport actually benefits from one.

Core capabilities:

* season position
* past/current/upcoming
* scrubbing
* round filtering
* result access
* match focus
* organization focus

---

# 25. MyClub

MyClub answers:

> **"What do I need to do before the next competitive event?"**

The landing view should therefore prioritize action over statistics.

Primary dashboard information:

```text
NEXT MATCH
ROSTER STATUS
FORM
ACTION ITEMS
BUDGET
RECENT RESULT
```

---

# 26. Organization Dossier

The organization profile should include:

* identity
* competition
* current record
* form
* budget summary
* next match
* recent results
* roster summary

The system should not bury the current competitive state beneath decorative branding.

---

# 27. Roster

Initial implementation:

**Data-first table.**

Capabilities:

* athlete identity
* position/role
* rating
* availability
* form
* age/career stage
* relevant sport metrics

Athletes must be focusable.

Cards may be introduced later without replacing the canonical table representation.

---

# 28. Finance

Initial MyClub finance view should remain intentionally simple.

It may expose:

* current budget
* recent income
* recent expenses
* ticket revenue
* sponsorship income
* transfer expenditure
* training expenditure

Existing economic rules remain authoritative.

For example:

```text
Ticket Revenue =
capacity × ticketPrice × 0.6 × (popularity / 100)
```

Franchise claiming and training costs should continue to use the existing economic services rather than duplicating currency logic inside the UI.

---

# 29. Existing Economic Integration

MySports integrates with existing IxStates economic infrastructure.

### Ticket Revenue

```text
capacity × ticketPrice × 0.6 × popularity / 100
```

### Sponsor Income

```text
base fee + win bonuses
```

### Franchise Claiming

Existing system:

```text
50 IxCredits
```

processed through:

```text
exchangeService
vaultService
```

### Training

Existing costs:

```text
Individual drill → 25c
Team session → 100c
```

MySports should consume these services rather than implement independent currency transactions.

---

# 30. MatchCenter

The reusable MatchCenter should be structured around sport-neutral information.

```text
MatchCenter
│
├── MatchHeader
├── Scoreboard
├── MatchSurface
├── MatchTimeline
├── MatchStats
├── MatchAnalysis
└── MatchNarrative
```

`MatchSurface` is sport-adaptive.

```tsx
<MatchSurface sport={sport} />
```

may render:

```text
SoccerPitch
HockeyRink
BasketballCourt
BaseballDiamond
FootballField
CircuitMap
BoxingRing
```

---

# 31. Match Event Timeline

The event timeline is a P0 component.

It must work without narrative systems.

Example:

```text
67'  GOAL        Marcellus
61'  YELLOW      Senate FC
54'  SUB         Victoria FC
32'  GOAL        Victoria FC
```

Narrative may be inserted alongside the event when available.

The canonical event remains unchanged.

---

# 32. Match Momentum

Momentum is a derived visualization, not the canonical event record.

Therefore:

### P0

* score
* result
* event timeline

### P1

* momentum visualization
* advanced match graphs
* shot maps
* advanced spatial data

The resolver may eventually expose the required structured data for these visualizations.

---

# 33. Almanac / Historical Archive

The Almanac is a presentation layer over immutable historical records.

Potential hierarchy:

```text
Competition
└── Season
    ├── Champion
    ├── Standings
    ├── Matches
    ├── Records
    └── Awards
```

Athlete:

```text
Athlete
└── Career
    ├── Rookie
    ├── Prime
    ├── Veteran
    └── Retired
```

Historical records must not depend on current player/team values being recalculated.

---

# 34. Career Progression

The existing career progression system may advance athletes through:

```text
Rookie
→ Prime
→ Veteran
→ Retired
```

The UI should present this as a persistent career history rather than merely a current roster attribute.

The Almanac should eventually support:

* season-by-season statistics
* teams
* awards
* championships
* career totals
* notable events
* retirement status

---

# 35. Vocabulary & Lore Skin

Lore should primarily be expressed through **language and occasional ceremony**, not permanent decorative theming.

Vocabulary should be data-driven.

Examples:

```text
News       → Bulletin
History    → Archive
Stats      → Records
Player     → Athlete
Team       → Organization
```

Competition-specific vocabulary may override sport defaults.

Example:

```text
Competition vocabulary
+
Sport vocabulary
+
Global IxStates vocabulary
```

This allows a WAFF competition and a Caphirian Imperial competition to feel culturally distinct without creating separate component systems.

---

# 36. Visual Identity

The eventual visual direction is:

## Institutional Modernism

Characteristics:

* precise typography
* restrained borders
* generous whitespace
* dense but legible data
* editorial hierarchy
* strong information contrast
* limited ornamental treatment
* occasional ceremonial visual moments

The interface should feel like an institution with history, not a literal Roman-themed dashboard.

Lore can appear through:

* terminology
* competition identity
* ceremonial moments
* patron-saint invocation
* title-clinch moments
* historical editorial treatment

Decoration should never compromise usability.

---

# 37. Component Architecture

Proposed structure:

```text
src/components/sports/

├── core/
│   ├── SportsShell
│   ├── SportsFocusProvider
│   ├── SportsHeader
│   ├── CompetitionHeader
│   ├── OrganizationHeader
│   ├── EntityLink
│   ├── SportsTicker
│   └── generic primitives

├── competition/
│   ├── CompetitionOverview
│   ├── CompetitionTable
│   ├── CompetitionTimeline
│   ├── CompetitionArchive
│   └── CompetitionPulse

├── organization/
│   ├── OrganizationDashboard
│   ├── OrganizationRoster
│   ├── OrganizationFinance
│   └── OrganizationTactics

├── athlete/
│   ├── AthleteCard
│   ├── AthleteProfile
│   ├── AthleteCareer
│   └── AthleteTableRow

├── match/
│   ├── MatchCenter
│   ├── MatchSurface
│   ├── MatchScoreboard
│   ├── MatchTimeline
│   ├── MatchMomentum
│   └── MatchAnalysis

└── market/
    ├── TransferMarket
    └── BidDistribution
```

---

# 38. Generic vs. Domain Components

Generic primitives must remain domain-agnostic.

Examples:

```text
DataTable
StatRow
Metric
Timeline
EntityLink
Panel
EmptyState
ContextRail
```

Domain components may compose generic primitives:

```text
CompetitionTable
OrganizationRoster
MatchTimeline
AthleteProfile
```

Generic components must not contain sport-specific domain branching.

---

# 39. State Architecture

State must be divided deliberately.

## Server State

Owned by:

```text
tRPC
TanStack Query
```

Examples:

* competitions
* organizations
* athletes
* matches
* standings
* simulation results
* finance data

---

## URL State

Owns navigational state:

```text
competition
tab
section
season
round
focus
match
```

---

## User Preference State

Owns persistent presentation preferences:

```text
simulationSpeed
```

Potentially:

```text
default sports view
density preference
```

These should be persisted through an appropriate user-preference mechanism.

---

## Ephemeral UI State

Zustand may manage:

* temporary selection
* panel state
* local interaction state
* transient simulation presentation state

Zustand should remain deliberately small.

---

# 40. Technical Stack

The proposed implementation stack:

| Concern               | Technology                       |
| --------------------- | -------------------------------- |
| UI primitives         | shadcn/ui + Radix                |
| Styling               | Tailwind                         |
| Tables                | TanStack Table                   |
| Virtualization        | TanStack Virtual                 |
| Charts                | Recharts                         |
| Bespoke visualization | visx / D3 where justified        |
| Drag/drop             | dnd-kit                          |
| Match surfaces        | Hand-authored SVG                |
| Animation             | Framer Motion                    |
| Server state          | tRPC + TanStack Query            |
| UI state              | Zustand, deliberately limited    |
| URL state             | App Router query parameters      |
| Backend               | Existing sports tRPC routers     |
| Currency              | Existing exchange/vault services |

These are implementation preferences rather than product requirements.

The product requirement is the behavior; the implementation technology may evolve.

---

# 41. Backend Architecture

Existing domain routers:

```text
src/server/api/routers/sports/

├── index.ts
├── leagues.ts
├── teams.ts
├── simulation.ts
├── transfers.ts
└── management.ts
```

These should eventually align with the domain terminology without requiring an immediate disruptive rename.

The long-term conceptual structure is:

```text
Competition
Organization
Athlete
Match
Simulation
Transfer
Management
```

---

# 42. Simulation API Contract

The UI should not directly invoke low-level resolver functions.

Conceptually:

```text
UI
 ↓
sports.simulation router
 ↓
simulation service
 ↓
resolver
 ↓
canonical simulation record
```

The router should enforce:

* authorization
* idempotency
* match state
* simulation snapshot creation
* resolver version
* result persistence

---

# 43. Permissions

Public and private data must be distinguishable.

Examples:

### Public

* competition standings
* match results
* public roster information
* athlete statistics
* historical records

### Restricted

* club finances
* private management information
* certain transfer information
* administrative Storyteller actions

Focus links must therefore be shareable without bypassing authorization.

A URL pointing to restricted content should result in a permission-aware state, not leaked data.

---

# 44. P0 Requirements

P0 is divided into four implementation milestones.

---

## P0-A — Foundation

* [ ] `SportsShell`
* [ ] Focus provider
* [ ] Focus resolution
* [ ] URL-reflected Focus
* [ ] canonical URL state model
* [ ] Soccer `SportDefinition`
* [ ] shared domain contracts
* [ ] generic entity navigation
* [ ] server/client state separation

### Acceptance

A developer can navigate among Competition, Organization, Athlete, and Match objects using a shared Focus architecture without creating sport-specific navigation infrastructure.

---

## P0-B — Core Management

### MyLeague

* [ ] Competition overview
* [ ] standings
* [ ] fixture timeline
* [ ] results
* [ ] organization list
* [ ] basic archive

### MyClub

* [ ] organization dossier
* [ ] roster table
* [ ] next match
* [ ] form
* [ ] basic finance summary

### Acceptance

A user can enter a soccer competition, understand its current state, open an organization, inspect its roster, and navigate to relevant matches without hitting dead ends.

---

## P0-C — COMPETE

* [ ] COMPETE state machine
* [ ] resolver integration
* [ ] simulation input snapshot
* [ ] deterministic simulation record
* [ ] idempotent simulation requests
* [ ] result persistence
* [ ] canonical MatchEvent[] persistence
* [ ] scoreboard
* [ ] event timeline
* [ ] basic deterministic analysis

### Acceptance

A user can run an unresolved soccer match, receive one canonical result, inspect the event log, and understand the principal reasons for the outcome.

---

## P0-D — Presentation Polish

* [ ] basic Competition Pulse
* [ ] improved match event presentation
* [ ] optional narrative rendering
* [ ] contextual worldbuilding signals
* [ ] basic responsive refinement

### Acceptance

The experience feels like a coherent Labs product rather than an administrative data interface while remaining fast for repeated season simulation.

---

# 45. P1 Requirements

* [ ] Distinct Broadcast mode
* [ ] Instant / Brief / Live simulation presentation
* [ ] Persisted simulation-speed preference
* [ ] Momentum graph
* [ ] `<AthleteCard>`
* [ ] Trophy Card / Vault integration
* [ ] Soccer tactics board
* [ ] richer Match Analysis
* [ ] richer Storyteller presentation
* [ ] advanced competition pulse
* [ ] expanded mobile experience

---

# 46. P2 Requirements

Design for these systems but do not build them during the foundation phase.

* [ ] Hockey adapter
* [ ] Transfer market UI using bid distribution
* [ ] Stadium/facility management
* [ ] Institutional management
* [ ] Scouting
* [ ] Medical
* [ ] Academy
* [ ] Sponsorship
* [ ] Multi-stage competitions
* [ ] Promotion/relegation
* [ ] Remaining sports:

  * F1
  * boxing
  * basketball
  * baseball
  * football

---

# 47. Transfer Market

When implemented, the transfer interface must accurately represent the existing escrow-based sealed-bid model.

It should emphasize:

```text
Current bids
High bid
Low bid
Median
Bid count
User bid
Time remaining
Escrow state
```

It must not present:

```text
Bid
Ask
Order book
Market depth
Continuous price discovery
```

unless the underlying transfer engine actually gains those capabilities.

---

# 48. Tactics

The tactics board is a downstream interaction layer.

Initial implementation may use:

```text
SVG
+
dnd-kit
```

The canonical tactical state remains structured data.

Example:

```text
Formation
Positions
Assignments
Instructions
```

The visual board is a representation of that state, not the state itself.

---

# 49. Match Surface Architecture

`MatchSurface` provides the universal interface.

```tsx
<MatchSurface
  sport={sport}
  match={match}
/>
```

The SportDefinition determines the visual surface.

Example:

```text
soccer
→ SoccerPitch

hockey
→ HockeyRink

formula1
→ CircuitMap
```

The match surface should consume canonical match state and must not directly implement simulation rules.

---

# 50. Mobile Strategy

The initial product should prioritize desktop because MyLeague/MyClub are data-dense management interfaces.

However, the architecture must be responsive from the beginning.

Mobile should prioritize:

```text
Next match
Standings
Results
Roster
COMPETE
```

Complex management surfaces may collapse into:

* drawers
* bottom sheets
* stacked sections
* horizontally scrollable data regions

The exact mobile design should be validated after the desktop information architecture is established.

---

# 51. Success Metrics

MySports is a Labs feature inside a worldbuilding platform, so success is not measured purely through SaaS conversion metrics.

## Leading Metrics

### League Adoption

Percentage of active IxStates users who create or join a competition within 30 days.

### Simulation Activity

Matches simulated per active competition per week.

### Club Setup Completion

Percentage of users who begin organization setup and successfully complete it.

### COMPETE Completion

Percentage of COMPETE attempts that successfully reach a persisted RESULT state.

### Entity Exploration

Percentage of sports sessions involving contextual navigation between multiple entities.

Example:

```text
Standings
→ Organization
→ Athlete
→ Match
→ Competition
```

---

## Lagging Metrics

### Season Completion

Percentage of competitions reaching a champion rather than being abandoned mid-season.

### MyClub Return Rate

Week-over-week return rate among users managing an organization.

### Storyteller Integration

Frequency with which Storyteller/worldbuilding events are associated with sports competitions.

### Historical Exploration

Frequency with which users enter the Archive/Almanac after participating in a season.

---

# 52. UX Quality Metrics

In addition to engagement, MySports should measure whether the core experience is actually understandable.

### Time to First Meaningful Action

Time from entering MyClub to:

* roster action,
* COMPETE,
* transfer action,
* or other meaningful management activity.

### COMPETE Error Rate

Percentage of attempts that fail due to:

* invalid state
* duplicate request
* server error
* permission
* resolver error

### Simulation Abandonment

Percentage of users who enter simulation and leave before viewing the result.

---

# 53. Accessibility Requirements

The sports interface must remain usable without relying exclusively on:

* color
* animation
* spatial position
* hover
* sound

Important states such as:

```text
win
loss
movement
injury
availability
event type
```

must have semantic indicators in addition to color.

Match event timelines must remain understandable without animation.

---

# 54. Performance Requirements

MySports may eventually expose very large:

* athlete rosters
* historical seasons
* standings
* match archives
* transfer markets

Therefore:

* large tables should support virtualization where necessary,
* expensive visualizations should be lazy-loaded,
* historical data should be paginated/query-driven,
* match event streams should not require loading unrelated history,
* Focus resolution should avoid unnecessary data fetching.

The interface should remain responsive while users progress through multiple matches in a session.

---

# 55. Failure States

Every major domain operation requires an explicit failure state.

Examples:

### Competition

```text
Not found
No active season
No fixtures
```

### Organization

```text
Not found
Not accessible
No roster
```

### Match

```text
Not scheduled
Already resolved
Simulation unavailable
Simulation failed
```

### Focus

```text
Invalid
Not found
Unauthorized
Wrong context
```

The UI must never leave the user at a dead end after an invalid state.

---

# 56. Architectural Invariants

The following rules should be treated as non-negotiable.

### Invariant 1

**Simulation is authoritative.**

UI and narrative systems do not invent results.

### Invariant 2

**Historical results are immutable.**

Current state must not rewrite past simulation outcomes.

### Invariant 3

**Narrative is presentation.**

Narrative may describe events but cannot silently change canonical events.

### Invariant 4

**World modifiers affect simulation inputs, not event history.**

A Storyteller effect exists before simulation and is captured in the simulation snapshot.

### Invariant 5

**Focus does not own domain state.**

Focus identifies an object; the server remains authoritative for that object's data.

### Invariant 6

**Sport-specific behavior belongs behind SportDefinition boundaries.**

Core components should not become a switch statement for seven sports.

### Invariant 7

**Presentation modes share canonical objects.**

Command, Broadcast, Almanac, Cards, and future views do not create duplicate domain models.

### Invariant 8

**Simulation requests are idempotent.**

A retry cannot create a second canonical result.

### Invariant 9

**Visual implementation is replaceable.**

Changing SVG, charting, or animation technology must not require rewriting domain logic.

### Invariant 10

**Lore enhances comprehension rather than obstructing it.**

Worldbuilding should make the simulation feel alive without making basic sports management harder.

---

# 57. Open Questions

### Engineering

1. Does the existing `resolver.ts` already emit a structured `MatchEvent[]` log?
2. What simulation inputs must be captured to guarantee deterministic replay?
3. What should constitute the resolver version identifier?
4. Where should simulation snapshots be persisted?
5. Which existing Prisma models map cleanly to Competition, Organization, Athlete, and Match?
6. Does the existing transfer system already expose sufficient bid-distribution data?

### Architecture

7. Should the universal domain terminology remain `Organization`, or should a more neutral `Participant` abstraction exist above organizations and athletes?
8. Which concepts belong inside `SportDefinition` versus shared domain contracts?
9. What shared abstractions are required before hockey can be added without sport-specific branching?
10. Which competition formats must the initial `Competition` model support even if their UI is deferred?

### Product

11. Is soccer the correct first sport?
12. What is the minimum viable Competition Pulse?
13. Should Broadcast be available only after COMPETE or also for already completed historical matches?
14. How much Almanac functionality should exist in v0.1 versus v0.3?
15. When should Trophy Cards become visible in normal athlete workflows?

### Design

16. Which Focus targets are public versus permission-controlled?
17. How much Command mode should be optimized for mobile in the first release?
18. How should competition-specific vocabulary override global/sport vocabulary?
19. How much ceremony should be used for major events such as championship clinches?

---

# 58. Implementation Sequence

The project should proceed in this order.

```text
PHASE 0
DOMAIN CONTRACTS
      ↓
Competition
Organization
Athlete
Match
MatchEvent
SimulationRecord
WorldModifier
      ↓
PHASE 1
FOUNDATION
      ↓
SportsShell
Focus
URL State
SportDefinition
Soccer Adapter
      ↓
PHASE 2
COMMAND
      ↓
MyLeague
MyClub
Standings
Timeline
Roster
Organization Dossier
      ↓
PHASE 3
COMPETE
      ↓
Simulation
Snapshots
Idempotency
Results
Event Log
Analysis
      ↓
PHASE 4
BROADCAST
      ↓
Live Presentation
Momentum
Narrative
Simulation Speed
      ↓
PHASE 5
ALMANAC
      ↓
History
Records
Careers
Archives
      ↓
PHASE 6
CARDS / VAULT
      ↓
Athlete Cards
Trophy Cards
      ↓
PHASE 7
TACTICS / MARKET
      ↓
Tactics
Transfers
      ↓
PHASE 8
SECOND SPORT
      ↓
Hockey
```

---

# 59. Versioned Roadmap

## v0.1 — Foundation + Soccer Command

**Objective:** Establish the architecture and usable management loop.

Includes:

* domain contracts
* SportsShell
* Focus
* URL state
* Soccer SportDefinition
* MyLeague
* MyClub
* standings
* timeline
* roster
* organization dossier
* basic finance
* basic archive

---

## v0.2 — COMPETE

**Objective:** Make simulation a first-class interaction.

Includes:

* COMPETE state machine
* resolver integration
* simulation snapshots
* deterministic results
* event log
* result analysis
* idempotency
* failure states

---

## v0.3 — Broadcast

**Objective:** Turn simulation results into an immersive sporting experience.

Includes:

* Broadcast view
* event ticker
* momentum
* narrative presentation
* Instant / Brief / Live
* improved match visualization

---

## v0.4 — Almanac

**Objective:** Make sports history worth exploring.

Includes:

* season archive
* champions
* records
* career history
* historical match browsing
* historical competition pages

---

## v0.5 — Cards / Vault

**Objective:** Connect athletes and achievements to IxStates' collectible layer.

Includes:

* Athlete Cards
* Trophy Cards
* Vault integration
* awards
* season-end recognition

---

## v0.6 — Tactics

**Objective:** Add deeper organization management.

Includes:

* lineup editing
* formation
* tactical instructions
* sport-specific tactical surfaces

---

## v0.7 — Transfer Market

**Objective:** Add roster economics.

Includes:

* player market
* escrow bidding
* bid distribution
* transfer history
* budget integration

---

## v0.8 — Hockey

**Objective:** Stress-test the architecture.

Hockey should be implemented primarily through:

```text
src/sports/hockey/
```

Any required changes to shared infrastructure should be treated as evidence that the abstractions need refinement, not as permission to create a parallel hockey application.

---

# 60. Definition of Done — v0.1

MySports v0.1 is ready for Labs Preview when all of the following are true:

### Architecture

* [ ] Soccer uses `SportDefinition`.
* [ ] Core UI does not contain sport-specific conditional branches.
* [ ] Focus is shared across MyLeague/MyClub.
* [ ] Focus can be represented in a URL.
* [ ] Domain contracts exist independently from presentation components.
* [ ] Server state, URL state, user preferences, and ephemeral UI state are separated.

### MyLeague

* [ ] User can create/join a soccer competition.
* [ ] User can view standings.
* [ ] User can navigate the season through a timeline.
* [ ] User can open organizations from standings.
* [ ] User can inspect results.
* [ ] User can access basic historical information.

### MyClub

* [ ] User can claim/access an organization.
* [ ] User can inspect roster.
* [ ] User can see next match.
* [ ] User can understand current form.
* [ ] User can see basic financial state.

### COMPETE

* [ ] User can identify an unresolved match.
* [ ] User can initiate COMPETE.
* [ ] Resolver produces one canonical result.
* [ ] Simulation is deterministic.
* [ ] Simulation input snapshot is persisted.
* [ ] Match events are persisted.
* [ ] Result can be revisited.
* [ ] Duplicate COMPETE requests do not create duplicate results.
* [ ] Failure states are recoverable.
* [ ] User receives a basic explanation of the result.

### UX

* [ ] No manufactured simulation delay.
* [ ] Navigation does not require memorizing page-specific structures.
* [ ] Important information is understandable without lore knowledge.
* [ ] Core flows work on desktop.
* [ ] Responsive behavior does not break the fundamental information hierarchy.

---

# 61. Final Product Principle

MySports should ultimately feel less like a collection of sports pages and more like a **sports operating system for the IxStates world**.

The user should be able to move naturally through:

```text
COMPETITION
     ↓
ORGANIZATION
     ↓
ATHLETE
     ↓
MATCH
     ↓
EVENT
     ↓
HISTORY
```

while the underlying system remains:

```text
WORLD STATE
     ↓
SPORT RULES
     ↓
SIMULATION INPUT
     ↓
DETERMINISTIC RESOLVER
     ↓
CANONICAL RESULT
     ↓
EVENT LOG
     ↓
┌──────────┬───────────┬───────────┐
│ COMMAND  │ BROADCAST │ ALMANAC   │
└──────────┴───────────┴───────────┘
             ↓
        PRESENTATION
             ↓
       NARRATIVE / LORE
```

The goal is not to make seven different sports apps.

The goal is to create **one coherent sports simulation system capable of expressing seven different sports**.

The goal is not to make simulation look cinematic.

The goal is to make **competition feel consequential**.

The goal is not to decorate the interface with Caphirian lore.

The goal is to make the sports system feel like it **actually belongs to the IxStates world**.

And the goal is not to make users navigate pages.

The goal is to let them **follow the world through its objects, events, and history.**

This version is substantially closer to something I'd hand to an engineer/design team as the **canonical architectural PRD**. The next artifact I'd produce from it would *not* be another UX brainstorm; it would be a **MySports technical architecture/spec** defining the Prisma/domain models, `SportDefinition` TypeScript contracts, Focus/URL schema, simulation snapshot model, and tRPC API contracts.
