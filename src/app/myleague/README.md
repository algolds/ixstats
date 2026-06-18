# MyLeague

Sports league simulation — the competition layer of IxStates. Spin up a league, fill it with auto-generated
teams and players, and watch a full season resolve on the IxTime clock.

**Tagline:** Competition layer of IxStates · **Category:** Competition Simulation / Player Engagement  
**Depends on:** IxTime, IxStates nation roster  
**Engine:** `src/lib/sports/` — Sport presets, MatchResolver, schedule generator, Markov talent generator, aging

## Routes

| Route | Description |
|-------|-------------|
| `/myleague` | Hub — browse canonical and player leagues, create new leagues |
| `/myleague/[id]` | League detail — standings, schedule, bracket/race results, history |
| `/myleague/[id]/season/[seasonId]` | Season detail — full schedule, results, simulate controls |

## Sports & Archetypes

| Sport | Archetype | Format |
|-------|-----------|--------|
| Soccer ⚽ | League | Double round-robin table, optional playoff |
| American Football 🏈 | Division/Conference | Divisions → seeded playoff bracket |
| Ice Hockey 🏒 | Division/Conference | Divisions → seeded playoff bracket |
| Basketball 🏀 | Division/Conference | Divisions → seeded playoff bracket |
| Baseball ⚾ | Division/Conference | Divisions → seeded playoff bracket |
| F1 / Motorsport 🏎️ | Circuit | Race calendar, constructor + driver points |
| Boxing 🥊 | Bracket | Single-elimination tournament, weight classes |

## Federations

| Sport | Governing Body |
|-------|---------------|
| Soccer | World Association Football Federation (WAFF) |
| American Football | International Gridiron Federation (IGF) |
| Ice Hockey | World Ice Hockey Federation (WIHF) |
| Basketball | Global Basketball Association (GBA) |
| Baseball | World Baseball Confederation (WBC) |
| F1 / Motorsport | International Racing Federation (IRF) |
| Boxing | Istroyan Combat Commission (ICC) |

## UI Components

`src/components/myleague/` — LeagueCreator, StandingsTable, ScheduleView, BracketView, RaceResults

## Simulation Loop

1. Create league → teams + rosters auto-generated
2. Start season → matches generated per archetype
3. Simulate match days → bounded probabilistic engine resolves outcomes
4. Postseason → playoffs / bracket / final race determine champion
5. Season end → champion recorded, records written to history
6. Annual cycle → Markov talent generator produces rookie class, players age/progress
7. Next season → schedule regenerated, cycle repeats

Seasons advance on the IxTime 4x clock (one season per in-game year). Manual simulation available in dev.
