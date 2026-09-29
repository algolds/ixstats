# MyLeague

**Last updated:** September 2026

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
- **Standings** — position/record/points table (`StandingsTable`), with promotion/relegation zones when
  configured on the league.
- **Schedule** — match cards grouped by match day plus the **`LeagueControlDeck`** simulation controls
  (simulate next day, simulate remaining, transition season).
- **Bracket / Race Results** — weight-class brackets for boxing, driver/race grids for F1.
- **Teams directory** — all teams with Managed/Unclaimed filters; clicking a team opens it in the
  Sports Focus panel (`useSportsFocus().focusOrganization`, URL `?focus=organization:<id>`).
- **History** — league archive (`LeagueArchiveTab`) with champions and all-time records, linking to the season-detail route.
- **Match detail** — `MatchDetailModal` / `MatchCenter` open from any result for box-score, commentary, and analysis.
- **Settings** — `LeagueSettingsModal` with Branding, Competition (incl. promotion/relegation counts), and Advanced tabs.

## Simulation loop

1. Create league → teams + rosters auto-generated.
2. **Start Season** (`startSeason`) → schedule generated per archetype.
3. **Simulate Day** (`simulateMatchDay`) / **Simulate Remaining** (`simulateFullSeason`) → bounded
   probabilistic engine resolves matches, updates standings.
4. Postseason brackets/races resolve inside the same simulation calls (multi-stage seasons advance via
   `transitionToNextStage`) → champion declared.
5. **Transition Season** (`transitionToNextSeason`) → player progression + new draft, next season.

Simulation controls are live in the workspace for any authenticated user (not dev-only).

## Architecture

Page components are thin; the workspace is `LeagueRouter` in `src/components/sports/league/`:

| Component | Role |
|-----------|------|
| `LeagueCreator` | Multi-step create-league dialog |
| `SportsShell` / `SportsSidebarNav` / `SportsCommandBar` (`src/components/sports/core/`) | Shared workspace shell + section nav (also used by MyClub) |
| `SportsFocusProvider` / `SportsFocusOverlay` / `SportsFocusPanel` | URL-reflected Focus panel for teams, athletes, and matches |
| `LeagueMasthead`, `LeagueBrandWidgets`, `LeagueControlDeck`, `MatchdayTape`, `NextMatchCountdown` | Header, brand/champion widgets, simulation controls |
| `tabs/League*Tab.tsx` (`BracketView`, `RaceResults`, `DraftPicksView`) | Tab content views |
| `MatchTickerSim`, `MatchDetailModal`, `match/MatchCenter` | Live match replay, per-match detail, COMPETE match center |
| `TeamSettingsModal`, `LeagueSettingsModal` (`settings/`) | Team and league settings |

Shared sport views `StandingsTable`, `LatestResults`, `Scoreboard`, `PlayerCard` come from
`src/components/sports/`; match surfaces from `src/components/sports/surfaces/`; sport
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
| `getLeagueArchive`, `getAllTimeRecords` | History tab (`almanac.ts`) |
| `startSeason`, `simulateMatchDay`, `simulateSingleMatch`, `simulateFullSeason`, `transitionToNextSeason` | Simulation controls |
| `resetSeason`, `regenerateSchedule`, `overrideMatchResult`, `transferTeam`, `setFeaturedLeague` | Commissioner / admin controls |

Other domains in the same router: `teams` (`getTeam`, `updateTeam`, `claimTeam`, `getPlayer`),
`club` (tactics, lineups, training, sponsors, stadium upgrades, ticket pricing, patron saints,
`getMyClubs`, `getMyClubOverview`), `transfers` (listings/bids), `standings` (standings, brackets,
races, team history, live matches), `almanac` (archive, athlete careers, records), and
`seasons/lifecycle.ts` (`collectMatchRevenue`, `getMatchDetails`).

## Connection to MyClub

MyLeague is the league-wide view; **MyClub** (`/myclub`) is the personal franchise dashboard for
teams a user owns. Unclaimed teams shown in the league Teams directory can be claimed
(`claimTeam`), after which they are managed from MyClub. Both surfaces read and write the same
`sports` router and the same underlying `SportLeague` / `SportTeam` / `SportSeason` models.

See the authoritative guide at `docs/systems/myleague.md` for full user journeys, the revenue
model, and the permission matrix.
