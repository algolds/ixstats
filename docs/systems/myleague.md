# 🧪 MyLeague & MyClub — Sports Simulation Studio (Labs)

**Parent Layer:** Labs (Experimental & Incubation Studio)  
**Subsystems:** League Workspace, Franchise Management (MyClub), Match Simulation Engine, Athlete Cards  
**Primary Action:** `COMPETE` | **Domain Accent:** Emerald Green / Sports Gold  
**Routes:** `/myleague`, `/myclub` (Labs product, top-level routes) | **Status:** 🧪 Labs Preview  

MyLeague and MyClub provide full-season sports simulation across seven sport presets — soccer, Formula 1, hockey, boxing, basketball, baseball, and American football — with dynamic match resolvers and athlete roster progression. Soccer, hockey, basketball, baseball, and football have dedicated match resolvers, F1 uses the racing resolver, and boxing bouts currently fall back to the soccer match loop.

---

## Route Architecture

```
/myleague                              League lobby (carousel of active leagues)
  /myleague/[id]                       League workspace (tabbed SPA: ?tab=overview|standings|schedule|bracket|races|draft|teams|history)
  /myleague/[id]/season/[seasonId]     Historical season detail

/myclub                                Club lobby (carousel of owned franchises)
  /myclub/[teamId]                     Team management dashboard (section router: overview|roster|tactics|transfers|management|history)
  /myclub/[teamId]/season/[seasonId]   Per-team season detail
```

---

## Architecture & Simulation Engine

### Simulation Resolver (`src/lib/sports/resolver.ts`)
- **Rating Vectors**: Computes team offense, defense, and tactical modifiers.
- **Match Resolution**: Dispatches to per-sport loops in `src/lib/sports/resolvers/` (soccer, hockey, basketball, baseball, football; `racing-resolver.ts` for F1) that simulate match events (goals, penalties, cards, injuries, tactical adjustments) using seeded Mulberry32 RNG. `simulate-and-persist.ts` stores a replayable simulation snapshot (seed + resolver version) per match.
- **Career Progression**: Advances player career stages (`rookie` $\to$ `developing` $\to$ `prime` $\to$ `plateau` $\to$ `declining` $\to$ `retired`) at season boundaries (`aging.ts`, Markov talent generator in `talent.ts`).

### Backend Routers (`src/server/api/routers/sports/`)
Split into domain sub-routers:
- `sports/index.ts` – Router combination (`mergeRouters`)
- `sports/leagues/` – League CRUD, presets, schedule (incl. commentary generation), admin/LLM-narrator settings
- `sports/seasons/` – Season lifecycle (start, transition, revenue), match-day and full-season simulation
- `sports/standings.ts` – Standings, brackets, race results, team history, live matches
- `sports/teams.ts` – Team detail, claim franchise, player detail
- `sports/club.ts` – Stadium upgrades, ticket prices, sponsors, tactics, lineups, training, patron saints, MyClub overviews
- `sports/transfers.ts` – Player market, escrow bidding, transfers
- `sports/almanac.ts` – League archive, athlete career history, all-time records

---

## Economic Integration

- **Ticket Revenue** (per completed home match): $\text{capacity} \times \text{ticketPrice} \times 0.6 \times (\text{popularity} / 100)$
- **Sponsor Income**: the sponsor's base fee per completed home match and its `winBonus` per win, home or away
- **Collecting**: `collectMatchRevenue` pays each completed match once (`SportMatch.homeRevenueCollectedAt` / `awayRevenueCollectedAt`); `previewMatchRevenue` shows what's waiting (`src/lib/sports/match-revenue.ts`)
- **Franchise Claiming**: Requires the **MyClub Team License Token** (Vault Store, 5,000 credits); canonical leagues additionally require the **MyLeague Franchise Pass** (2,500 credits)
- **Player Training**: Individual drills (25c), team sessions (100c) via `exchangeService`
- **Patron Saint Invocation**: 100c; writes a `sports_saint_blessing` StorytellerEffect

---

## Related Documentation

- [MyLeague Lore Integration & Feature Audit](./myleague-lore-integration.md)
- [IxCredits Virtual Currency Engine](./ixcredits.md)
- [API Reference: Sports Router](../reference/api-complete.md)
