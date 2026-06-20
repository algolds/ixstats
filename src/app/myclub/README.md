# MyClub

**Last updated:** June 2026

Personal franchise management surface of the IxStates sports simulation. Claim a team from a
MyLeague competition, then manage its roster, tactics, transfers, and finances across seasons.
MyClub is the **owner-facing** counterpart to MyLeague (the public competition layer).

**Depends on:** MyLeague (`api.sports.*`), IxTime, the Sovereign (₷) credit economy via `exchangeService`.
All routes require authentication (`AuthenticationGuard` in `layout.tsx`).

## Routes

| Route | Description |
|-------|-------------|
| `/myclub` | Lobby — Apple-cards carousel of teams you own, with record / season / capacity. Empty state links to MyLeague |
| `/myclub/[teamId]` | Team dashboard — 5-section sidebar workspace (see Features). Unowned teams show a Claim card; teams owned by others show Access Denied |
| `/myclub/[teamId]/season/[seasonId]` | Season detail — per-team match results (expandable commentary), full standings table, season stats |

The team dashboard is a single-page sidebar router (`MyLeagueSidebarLayout` + `MyLeagueSidebarNav`),
not separate Next.js routes. The lobby deep-links into a section via `?tab=roster`.

## Key Features

| Section | Capabilities |
|---------|-------------|
| **Overview** | Live `MatchTickerSim` (active season) or off-season guidance card; record / points / scored-conceded widgets; upcoming-match scoreboards; season performance history with champion badges; team-training button |
| **Roster** | Player card binder (overall, position, age, career stage, ratings); per-player training drills; "Manage Listing" to put a player on the transfer market; coaching staff list with career-stage badges |
| **Tactics** | 7 tactical-intent presets (Neutral, All-Out Attack, Catenaccio, Counter-Attack, Tiki-Taka, Gegenpressing, Kick and Rush) with offense/defense radial rings; Attack Focus + Team Intensity sliders; `LineupBuilder` (starters, captain, save) |
| **Transfers** | Player search across leagues; bid on open listings (Sovereigns held in escrow); active-listings board; inbound bids (accept/reject) and outbound bid status; player comparison (`PlayerMatchup1`) |
| **Management** | `SponsorWalletDeck` (ticket price, stadium expansion, sponsor selection) and `RevenueCollector` (gate + sponsor income) |

**Claim flow:** an unclaimed team shows a Claim card; `claimTeam` takes ownership. Mutations are
gated on `team.ownerUserId === ctx.user.id` (FORBIDDEN otherwise).

## Career Stages

Player/coach `careerStage` keys (styled in the team page): `rookie`, `developing`, `prime`,
`plateau`, `declining`, `retired`. Stage progression and rookie classes are produced by the
MyLeague season-transition engine (Markov talent generator); MyClub only displays them.

## Architecture

| Layer | Location |
|-------|----------|
| Pages | `src/app/myclub/{page,layout}.tsx`, `[teamId]/page.tsx`, `[teamId]/season/[seasonId]/page.tsx` |
| MyClub components | `src/components/myclub/` — `SponsorWalletDeck`, `RevenueCollector`, `PlayerTrainingButton`, `TeamTrainingButton`, `LineupBuilder` |
| Reused MyLeague components | `MyLeagueSidebarLayout`, `MyLeagueSidebarNav`, `TeamSettingsModal`, `MatchTickerSim` (`src/components/myleague/`) |
| Sports UI | `src/components/sports/` — `PlayerCard1`, `Scoreboard1`, `PlayerMatchup1`, `MatchCommentary`, `PositionTooltip` |
| Presets | `src/lib/sports/presets.ts` (`SPORT_PRESETS`, rating vectors) |

## Data Sources (verified `api.sports.*`)

The sports router was split into `src/server/api/routers/sports/` (6 files merged via `mergeRouters`;
registered in `root.ts` as `sports`). `api.sports.*` paths are unchanged from the former monolith.

| Procedure | File | Used in |
|-----------|------|---------|
| `getMyClubs` | `teams.ts` | lobby |
| `getMyClubOverview` | `teams.ts` | team dashboard |
| `getTeam` | `teams.ts` | unclaimed/public fallback |
| `getTeamHistory` | `standings.ts` | overview + season detail |
| `getSeason` | `seasons/lifecycle.ts` | season detail |
| `claimTeam` | `teams.ts` | claim flow |
| `updateTeamTactics` / `setLineup` | `teams.ts` | tactics |
| `trainPlayer` / `teamTraining` | `teams.ts` | training |
| `selectSponsor` / `setTicketPrice` / `upgradeStadium` | `teams.ts` / `club.ts` | management |
| `collectMatchRevenue` | `seasons/lifecycle.ts` | management |
| `listPlayerForTransfer` / `placeTransferBid` / `respondToTransferBid` / `getTeamBids` / `getOpenTransferListings` | `transfers.ts` | transfers |
| `searchSportsEntities` | `leagues.ts` | transfer search |

## Connection to MyLeague

MyLeague owns league/season creation, scheduling, and match simulation. MyClub consumes that data
for the teams a user owns and layers on ownership actions (roster, tactics, transfers, finances).
Both share the same `SportTeam` / `SportPlayer` / `SportCoach` models (`prisma/schema/sports.prisma`)
and the same `api.sports.*` router. Team links throughout point back to `/myleague/[leagueId]`.
See `docs/systems/myleague.md` for the combined MyLeague + MyClub guide.
