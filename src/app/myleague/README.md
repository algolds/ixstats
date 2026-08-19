# MyLeague

**Last updated:** June 2026

Sports league simulation — the public competition layer of IxStates. Create a league, fill it with
auto-generated teams and rosters, run a season match-day by match-day, and resolve standings,
brackets, races, and champions. MyLeague is the public/commissioner surface; its personal team-
ownership counterpart is [MyClub](../myclub/README.md). Both are powered by the same `sports` tRPC
router.

The route tree is wrapped in `AuthenticationGuard` (`layout.tsx`), so a signed-in session is required.

## Routes

| Route | Description |
|-------|-------------|
| `/myleague` | Lobby — featured league hero, sport/status filters, search, "Create League" wizard |
| `/myleague/[id]` | League workspace — tabbed SPA (overview, standings, schedule, bracket/races, draft, teams, history) with inline simulation controls |
| `/myleague/[id]/season/[seasonId]` | Season detail — final standings, schedule, bracket/races for one historical season |

The workspace is a single page; tabs sync to a `?tab=` query param via `pushState` + a `popstate`
listener (no Next.js route transitions). Sub-route segments for standings/bracket/etc. do **not**
exist — they are tabs.

## Sports & Archetypes

Sport presets live in `src/lib/sports/presets.ts`. Archetype drives which tabs and schedule format
apply.

| Sport | Archetype | Governing body |
|-------|-----------|----------------|
| Soccer ⚽ | `league` | World Association Football Federation |
| American Football 🏈 | `division_conference` | International Gridiron Federation |
| Ice Hockey 🏒 | `division_conference` | World Ice Hockey Federation |
| Basketball 🏀 | `division_conference` | Global Basketball Association |
| Baseball ⚾ | `division_conference` | World Baseball Confederation |
| Formula 1 🏎️ | `circuit` | International Racing Federation |
| Boxing 🥊 | `bracket` | Istroyan Combat Commission |

Boxing (`bracket`) exposes a **Bracket** tab; F1 (`circuit`) exposes a **Race Results** tab. A
**Draft** tab appears only when the active/latest season has draft picks.

## Key features

- **League lobby** — featured (canonical) league hero, per-sport filter tabs, status filter
  (active/paused/completed/archived), text search, and a card grid. Custom (user-created) leagues
  are badged.
- **Create League wizard** — `LeagueCreator` multi-step dialog: pick sport preset, configure, review.
- **League workspace** — HUD banner (season, team count, progression, reigning champion), sidebar
  brand card + champion widget, and tabbed content.
- **Standings** — position/record/points table (`Standings1`), with promotion/relegation zones when
  configured on the league.
- **Schedule** — match cards grouped by match day plus a live **Simulation Control Deck**
  (simulate next day, simulate remaining, transition season).
- **Bracket / Race Results** — weight-class brackets for boxing, driver/race grids for F1.
- **Teams directory** — all teams with Managed/Unclaimed badges; clicking opens `TeamRosterModal`.
- **History** — completed seasons with champions, linking to the season-detail route.
- **Match detail** — `MatchDetailModal` opens from any result for box-score/commentary.
- **Settings** — `LeagueSettingsModal` (name edit, logo upload) via the "Manage MyLeague" button.

## Simulation loop

1. Create league → teams + rosters auto-generated.
2. **Start Season** (`startSeason`) → schedule generated per archetype.
3. **Simulate Day** (`simulateMatchDay`) / **Simulate Remaining** (`simulateFullSeason`) → bounded
   probabilistic engine resolves matches, updates standings.
4. Postseason resolves (`simulatePlayoffRound` / `simulateRace`) → champion declared.
5. **Transition Season** (`transitionToNextSeason`) → player progression + new draft, next season.

Simulation controls are live in the workspace for any authenticated user (not dev-only).

## Architecture

Page components are thin; all UI lives in `src/components/sports/league/`:

| Component | Role |
|-----------|------|
| `LeagueCreator` | Multi-step create-league dialog |
| `LeagueSidebarLayout` / `LeagueSidebarNav` | Workspace shell + section nav, brand/champion widgets |
| `StandingsTable`, `ScheduleView`, `BracketView`, `RaceResults`, `DraftPicksView` | Tab content views |
| `MatchTickerSim` | Animated live match replay |
| `TeamRosterModal`, `TeamSettingsModal` | Team roster slide-over and settings |
| `LeagueSettingsModal`, `MatchDetailModal` | League settings dialog, per-match detail modal |

Shared sport views `Standings1` and `LatestResults1` come from `src/components/sports/`; sport
theming/presets from `src/lib/sports/presets.ts`; the simulation engine from `src/lib/sports/`.

## Data sources

All data flows through `api.sports.*` (tRPC). The `sports` router is split by domain under
`src/server/api/routers/sports/` and recombined with `mergeRouters` in `index.ts`, then registered
in `root.ts`. Procedures used by these pages:

| Procedure | Use |
|-----------|-----|
| `getLeagues` | Lobby grid + featured league |
| `getLeague` | Workspace (league, teams, seasons) |
| `createLeague` / `updateLeague` | Create wizard / settings modal |
| `getStandings`, `getSchedule`, `getSeason` | Standings, schedule, season detail |
| `getBracket`, `getRaceResults`, `getDraftPicks` | Boxing / F1 / draft tabs |
| `getLeagueHistory` | History tab |
| `startSeason`, `simulateMatchDay`, `simulateFullSeason`, `transitionToNextSeason` | Simulation controls |

Other domains in the same router: `teams` (team/tactics/training/lineups, plus `getMyClubs`,
`getMyClubOverview`, `claimTeam`), `transfers` (listings/bids/valuations), `club` (stadium upgrades,
ticket pricing, patron saints), `standings` (history/records), and additional season lifecycle
procedures (`simulatePlayoffRound`, `simulateRace`, `collectMatchRevenue`).

## Connection to MyClub

MyLeague is the league-wide view; **MyClub** (`/myclub`) is the personal franchise dashboard for
teams a user owns. Unclaimed teams shown in the league Teams directory can be claimed
(`claimTeam`), after which they are managed from MyClub. Both surfaces read and write the same
`sports` router and the same underlying `SportLeague` / `SportTeam` / `SportSeason` models.

See the authoritative guide at `docs/systems/myleague.md` for full user journeys, the revenue
model, and the permission matrix.
