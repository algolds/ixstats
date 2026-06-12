# MyClub

Your personal franchise dashboard — manage the sports teams you claim and track their
performance across seasons.

**Personal surface of MyLeague.** Teams auto-acquire rosters and coaches at creation.
Claim a team to manage its roster, follow its seasons, and build a championship legacy.

**Depends on:** MyLeague, IxTime, IxStates nation roster

## Routes

| Route | Description |
|-------|-------------|
| `/myclub` | Hub — all teams you own, with quick season status |
| `/myclub/[teamId]` | Team detail — roster, current season, performance history, claim button |
| `/myclub/[teamId]/season/[seasonId]` | Season detail — match-by-match results, standings, stats |

## Features

- **Roster view** — players with position, age, career stage (rookie → prime → declining), and rating bars
- **Coaching staff** — coaches with strategy/development/motivation/adaptability ratings
- **Season tracking** — standings, upcoming matches, full season history
- **Team history** — season-by-season W-L record, finish position, championship badges
- **Claim system** — take ownership of unclaimed teams to manage them

## Career Stages

| Stage | Color | Description |
|-------|-------|-------------|
| Rookie | Blue | Fresh talent, rapid growth potential |
| Developing | Green | Improving skill, approaching peak |
| Prime | Amber | Peak performance, stable ratings |
| Plateau | Slate | Leveled off, slight decline possible |
| Declining | Red | Decreasing ability, near retirement |

Career progression is driven by a Markov chain model — each season players probabilistically
transition between stages based on age and coach development rating.

## Data Model

Teams (`SportTeam`), players (`SportPlayer`), and coaches (`SportCoach`) live in
`prisma/schema/sports.prisma`. Nation affiliation is optional (`SportTeam.nationId`).

## tRPC API

Endpoints live in `src/server/api/routers/sports.ts`:

| Procedure | Description |
|-----------|-------------|
| `getMyClubs` | All teams owned by current user |
| `getMyClubOverview` | Team roster, standings, upcoming matches, championships |
| `getTeam` | Public team detail (for unclaimed teams) |
| `claimTeam` | Take ownership of a team |
| `getTeamHistory` | Season-by-season record |
