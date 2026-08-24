# 🧪 MyLeague & MyClub — Sports Simulation Studio (Labs)

**Parent Layer:** Labs (Experimental & Incubation Studio)  
**Subsystems:** League Workspace, Franchise Management (MyClub), Match Simulation Engine, Athlete Cards  
**Primary Action:** `COMPETE` | **Domain Accent:** Emerald Green / Sports Gold  
**Routes:** `/labs/myleague`, `/labs/myclub` | **Status:** 🧪 Labs Preview  

MyLeague and MyClub provide full-season sports simulation across soccer, Formula 1, hockey, boxing, basketball, baseball, and football with dynamic match resolvers and athlete roster progression.

---

## Route Architecture

```
/myleague                              League lobby (carousel of active leagues)
  /myleague/[id]                       League workspace (tabbed SPA: ?tab=overview|standings|schedule|bracket|races|draft|teams|history|sim)

/myclub                                Club lobby (carousel of owned franchises)
  /myclub/[teamId]                     Team management dashboard (section router: overview|roster|tactics|transfers|management)
```

---

## Architecture & Simulation Engine

### Simulation Resolver (`src/lib/sports/resolver.ts`)
- **Rating Vectors**: Computes team offense, defense, and tactical modifiers.
- **Match Resolution**: Simulates match events (goals, penalties, yellow/red cards, injuries, tactical adjustments) using seeded Mulberry32 RNG.
- **Career Progression**: Advances player career stages (Rookie $\to$ Prime $\to$ Veteran $\to$ Retired) via Markov chains at season boundaries.

### Backend Routers (`src/server/api/routers/sports/`)
Split into domain sub-routers:
- `sports/index.ts` – Router combination
- `sports/leagues.ts` – League creation, settings, standings, schedule
- `sports/teams.ts` – Team roster, tactics, lineup builder, claim franchise
- `sports/simulation.ts` – Match day simulation, full season progression, transition
- `sports/transfers.ts` – Player market, escrow bidding, transfers
- `sports/management.ts` – Stadium upgrades, ticket prices, sponsor contracts

---

## Economic Integration

- **Ticket Revenue**: $\text{capacity} \times \text{ticketPrice} \times 0.6 \times (\text{popularity} / 100)$
- **Sponsor Income**: Base fee + win bonuses credited to club budget
- **Franchise Claiming**: Costs 50 IxCredits via `exchangeService` / `vaultService`
- **Player Training**: Individual drills (25c), team sessions (100c)

---

## Related Documentation

- [MyLeague Lore Integration & Feature Audit](./myleague-lore-integration.md)
- [IxCredits Virtual Currency Engine](./ixcredits.md)
- [API Reference: Sports Router](../reference/api-complete.md#sports-router)
