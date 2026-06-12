# MyLeague & MyClub — Sports Management System

**Last updated:** June 2026
**Architecture:** Tab-based single-page workspace (MyLeague) + sidebar section router (MyClub)
**Hierarchy:** MyLeague is the public sports platform; MyClub is the personal team ownership surface. Together they form the IxStates competitive sports simulation.

---

## Route Map

```
/myleague                              League lobby (carousel of leagues)
  /myleague/[id]                       League workspace (tabbed SPA)
    ?tab=overview | standings | schedule
    | bracket | races | draft | teams
    | history | sim
  /myleague/[id]/season/[seasonId]     [DELETED — merged into ?tab=sim]

/myclub                                Club lobby (carousel of owned teams)
  /myclub/[teamId]                     Team dashboard (section router)
    sections: overview | roster | tactics
             | transfers | management
  /myclub/[teamId]/season/[seasonId]   Season detail for a team
```

---

## Architecture Overview

MyLeague follows a **public-view → deep-dive** model:
- **Browse** (Lobby) — Discover leagues via carousel
- **Immerse** (Workspace) — Full tabbed workspace with standings, schedule, bracket, simulation, teams, history
- **Own** (MyClub) — Claim a franchise, manage rosters, train players, set lineups, trade, earn revenue

---

## User Journeys

### Journey 1: Casual Viewer (unauthenticated or non-owner)

```
Lobby → Click league card
  → Workspace loads with sport accent theming
  → Tab: Overview → see teams grid, current season status
  → Tab: Standings → view sorted table with GP/W/L/D/PTS/PF/PA/DIFF, promotion/relegation zones
  → Tab: Schedule → browse match cards grouped by match day, expand for commentary
  → Tab: Teams → click any team → TeamRosterModal slide-over with roster, attributes, coach info
  → Tab: History → browse completed seasons with champions
```

**Gates:** None. All league data is public read via `getLeague`, `getStandings`, `getSchedule`, etc.

**Edge cases:**
- League has 0 teams: "No teams in this league" empty state
- No seasons started: "Start a season first!" prompt (start button disabled for non-admins)
- Season in progress: progress bar shows match/race completion %
- Completed season: champion banner with trophy gradient

---

### Journey 2: Team Manager (owning a franchise)

```
Lobby → Click team in MyClub carousel → Team Dashboard
  → Overview:
      - Live MatchTickerSim (if active match)
      - Record widget (W-L-D)
      - Team Training button (100c, improves random attributes across squad)
      - Upcoming fixtures list
      - Season performance history
  → Roster:
      - Player card grid (overall rating, position, age, career stage, 6-attribute grid)
      - Click "Train" per player → dropdown of attributes with current values, 25c per drill
      - Click "Manage Listing" → set asking price → list on transfer market
      - Coaching staff list with career stage badges
  → Tactics:
      - 4 tactical presets: Neutral, All-Out Attack, Park the Bus, Counter-Attack
      - SVG radial rings showing offense/defense bias
      - Lineup Builder: toggle starters, set captain, save lineup
  → Transfers:
      - Player search → bid on listed players (escrow held)
      - Active transfer listings with bid inputs
      - Inbound bids panel (accept/reject offers on your players)
      - Outbound bids panel (status badges)
  → Management:
      - SponsorWalletDeck: ticket price, stadium expansion, sponsor selection
      - RevenueCollector: ticket revenue (capacity × price × 60% × popularity%) + sponsor income
```

**Gates:**
- Must be authenticated (global `AuthenticationGuard`)
- Must own the team (`ownerUserId === ctx.user.id`) for all mutations
- Unclaimed team: shows "Claim Franchise (50 Credits)" button
- Team owned by someone else: "Access Denied"

**Edge cases:**
- Claim fails (insufficient credits): error toast via `useNotify`
- Training fails: error toast, no charge
- Lineup saved: `getMyClubOverview` and `getTeam` queries auto-invalidated
- Transfer bid placed: funds held in escrow, refunded on rejection
- Transfer bid accepted: player moves, seller paid, other bidders refunded
- Sponsor selected: replaces existing sponsor contract
- Revenue collected: budget increments, can be collected repeatedly (match-day gate coming)

---

### Journey 3: League Commissioner (creating and running leagues)

```
Lobby → "Create League" button → LeagueCreator wizard
  Step 1: Pick sport preset (soccer, football, basketball, hockey, baseball, F1, boxing)
  Step 2: Configure (name, team count, divisions/weight classes)
  Step 3: Review settings card
  Step 4: Confirmed → navigate to new league

League Workspace:
  → Overview: teams grid + "Start Season" / "Start Next Season" button
  → Simulation Hub (?tab=sim):
      - If in progress: "Next: Day N" + "Simulate Day" button + "Simulate Remaining"
      - If completed: "Transition Season" button (creates next season with draft/progression)
      - Inline: Standings, Schedule, Bracket/Race Results, Draft Picks
  → Settings (gear icon top-right):
      - Edit league name
      - Upload league logo (PNG/JPG/GIF/WebP, max 5MB)
      - Save → invalidates `getLeague` query
```

**Gates:**
- `createLeague`: protected, any authenticated user
- `startSeason`, `simulateMatchDay`, `simulateFullSeason`, `transitionToNextSeason`: protected
- `updateLeague`: protected (no ownership check — any auth user can edit)
- Logo upload: requires Clerk auth (enforced by `/api/upload/image`)

**Edge cases:**
- Creating league with 0 teams: button disabled
- Start season with empty roster: `computeTeamRatingVector` fallback prevents NaN errors
- Simulate match day with no scheduled matches: mutation returns gracefully
- Transition season without champion: creates next season with draft picks but no champion banner
- Logo upload fails (type/size): error toast, no change saved

---

### Journey 4: Simulation & Revenue Cycle

```
Commissioner starts season → Season 1 created
  → Sim Day 1 (all scheduled matches resolve)
    [Backend: simulateMatchDay → computeTeamRatingVector → resolve match → update standings]
  → Manager collects revenue (ticket + sponsor)
    [collectMatchRevenue: budget += ticketRevenue + sponsorBaseFee]
  → Repeat for all match days
  → Season completes → champion declared
  → Transition to next season
    [Player career stages advance via Markov chain]
    [New draft picks generated]
    [Standings reset]
```

**Revenue model:**
| Source | Formula |
|--------|---------|
| Ticket revenue | `capacity × ticketPrice × 0.6 × (popularity / 100)` |
| Sponsor base | From `team.sponsor` JSON (100/50/10c depending on sponsor type) |
| Sponsor win bonus | `team.sponsor.winBonus` per win (0/25/10c) |
| Training cost (individual) | 25 credits |
| Training cost (team) | 100 credits |
| Stadium upgrade | 1,000 credits (+1,000 seats) |
| Claim franchise | 50 credits |
| Invoke patron saint | 100 credits |

---

## UX Paths & Navigation

### League Workspace Navigation
```
Sidebar (w-72, sticky, glassmorphic)
├── League Brand Card (logo/emoji, name, archetype, team count)
├── Season Progress Widget (match/race count + % bar)
├── Reigning Champion Widget (trophy + team name)
├── Rewards Banner (unopened card packs → IxVault)
├── Nav Items (sport-accented gradients)
│   ├── Overview (LayoutDashboard)
│   ├── Standings (Trophy)
│   ├── Schedule (Calendar)
│   ├── Bracket (Swords) — boxing only
│   ├── Race Results (MapPin) — F1 only
│   ├── Draft/Transfers (Users)
│   ├── Teams (Shield)
│   ├── History (Medal)
│   └── Simulation Hub (PlayCircle)
└── Content Pane (flex-1, sport-accent border/shadow)
```

### Team Dashboard Navigation
```
Sidebar (MyLeagueSidebarNav, 5 sections)
├── Overview (LayoutDashboard) — match ticker, records, fixtures, training
├── Roster (Users) — player cards, coaching staff
├── Tactics (Shield) — presets, radial rings, lineup builder
├── Transfers (ArrowLeftRight) — search, listings, bids
└── Management (Landmark) — sponsor deck, revenue collector
```

### Deep-linking
- League workspace tabs sync via `?tab=overview` query param with 150ms polling for `popstate`
- Team dashboard sections sync via `activeSection` state + URL pushState
- TeamRosterModal opens via `activeTeamId` state, triggered by `onTeamClick` from any table

---

## Component Map

```
src/components/myleague/
├── LeagueWorkspaceSidebarNav.tsx     Sidebar nav (9 sections) + brand card + widgets
├── LeagueWorkspaceSidebarLayout.tsx  Desktop/mobile layout with sport accent theming
├── SimulationHubTab.tsx              Simulation controls (day/remaining/transition)
├── TeamRosterModal.tsx               Slide-over: roster, attributes, claim, transfer
├── LeagueSettingsModal.tsx           Name edit + logo upload dialog
├── LeagueCreator.tsx                 4-step wizard (sport preset → config → review → done)
├── StandingsTable.tsx               POS/GP/W/L/D/PTS/PF/PA/DIFF columns, clickable teams
├── ScheduleView.tsx                  Match cards grouped by day, expandable commentary
├── DraftPicksView.tsx               Searchable/filterable draft table
├── BracketView.tsx                   Weight-class grouped tournament bracket
├── RaceResults.tsx                   F1-style driver standings + race results
├── MatchTickerSim.tsx               Live match replay with animated scoreboard

src/components/myclub/
├── PlayerTrainingButton.tsx          Per-player attribute dropdown (25c/drill)
├── TeamTrainingButton.tsx            Team-wide session button (100c)
├── LineupBuilder.tsx                 Toggle starters, set captain, save lineup
├── RevenueCollector.tsx              Ticket + sponsor revenue collection
├── SponsorWalletDeck.tsx             Ticket price, stadium, sponsor selection
```

---

## Role & Permission Matrix

| Action | Public | Auth User | Team Owner |
|--------|--------|-----------|------------|
| View league data | ✓ | ✓ | ✓ |
| View team roster (public) | ✓ | ✓ | ✓ |
| Claim unowned team | — | ✓ | — |
| Train players | — | — | ✓ |
| Set lineup | — | — | ✓ |
| List player for transfer | — | — | ✓ |
| Bid on transfer listing | — | ✓ | — |
| Accept/reject transfer bid | — | — | ✓ |
| Upgrade stadium | — | — | ✓ |
| Set ticket price | — | — | ✓ |
| Select sponsor | — | — | ✓ |
| Collect revenue | — | — | ✓ |
| Invoke patron saint | — | — | ✓ |
| Create league | — | ✓ | — |
| Edit league settings | — | ✓ | — |
| Start/simulate season | — | ✓ | — |

---

## Error Handling Patterns

All mutations follow this pattern:
```typescript
mutation(async ({ ctx, input }) => {
  try {
    // 1. Validate entity exists (NOT_FOUND)
    // 2. Check ownership (FORBIDDEN if team.ownerUserId !== ctx.user.id)
    // 3. Spend/earn credits via exchangeService
    // 4. Perform update
    // 5. Return result
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }
})
```

**Credit transactions** are atomic: `exchangeService.spend()` throws if insufficient balance, preventing partial state.

**Cache invalidation** follows mutation: every mutation invalidates `getMyClubOverview` and/or `getTeam` so UI stays fresh.

**Loading states**: Skeleton placeholders render during `isLoading`. Buttons disable during `isPending`.

**Empty states**: Every data section has a distinct empty state (icon + message) rather than blank screens.
