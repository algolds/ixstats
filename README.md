# IxStats v2

IxStats is a nation simulation and worldbuilding platform built with Next.js, tRPC, and Prisma. The codebase combines a React front end with a type-safe API layer, PostgreSQL database, and a custom server runtime that enables real-time updates for executive intelligence, diplomacy, economics, and collaborative storytelling.

## Platform Overview

- Next.js 16.1.3 App Router with client and server components under `src/app`
- React 19.1.3 + TypeScript 5.8 with 645+ components in `src/components`
- tRPC 11.4 API layer (`src/server/api/routers`) with **61 routers** and **927 typed procedures**
- Prisma 6.19 ORM (`prisma/schema.prisma`) with **206 models** on PostgreSQL
- Custom Node server (`server.mjs`) with layered env loading and Socket.IO realtime feeds
- In-app help center at `/help` and Markdown docs in `docs/`

## Feature Pillars

| Pillar | Description |
|--------|-------------|
| **MyCountry Command Suite** | Unified executive dashboard with briefing, compliance, defense, economic, and analytics modules |
| **Intelligence & Compliance** | Live diplomatic and domestic intelligence feeds with unified intelligence system |
| **Diplomacy & Foreign Affairs** | Embassy missions, cultural exchanges, NPC personalities with behavioral prediction |
| **Economic Simulation** | Country builder with tier-based economic calculations, historical tracking, projections |
| **Social Platform** | ThinkPages, ThinkShare, ThinkTanks for content sharing and collaborative research |
| **IxCards & MyVault** | Trading card system with 13 card types, pack opening, crafting, P2P trading, marketplace |
| **Elections & Politics** | D'Hondt/FPTP electoral systems, legislature management, hemicycle visualization |
| **Crisis Management** | Dynamic natural disasters, economic crises, diplomatic incidents with player responses |
| **Content Management** | 20 admin interfaces for dynamic content (scenarios, NPC personalities, equipment, archetypes) |
| **IxWorld Maps** | Interactive world globe with MapLibre GL JS, 7 layers, border editor, procedural world generation, deployed at maps.ixwiki.com |
| **Achievements & Leaderboards** | Global achievement tracking and ranking |

## Technology Stack

| Area | Details |
|------|---------|
| Runtime | Node.js >= 18.17, npm >= 9.0 |
| Framework | Next.js 16.1.3, React 19.1.3 |
| Language | TypeScript 5.8.3 |
| API Layer | tRPC 11.4 with SuperJSON + Clerk auth context |
| Database | Prisma 6.19, PostgreSQL (port 5433) |
| Styling | Tailwind CSS 4, custom glass physics design system, Lucide icons |
| Mapping | MapLibre GL JS with globe/mercator projection, PostGIS spatial queries |
| Realtime | Socket.IO via `server.mjs` and `src/lib/websocket-server.ts` |

## Getting Started

### Prerequisites

- Node.js 18.17+ and npm 9+
- PostgreSQL database (port 5433, database `ixstats`)
- Optional: Clerk credentials for authentication (demo mode works without)

### Installation

```bash
npm install
npm run db:setup   # prisma generate + db push + seed
npm run dev        # launches Next.js on http://localhost:3000
```

The dev script loads `.env.local.dev` or `.env.local`. At minimum set:

```dotenv
DATABASE_URL="postgresql://ixstats:ixstats@localhost:5433/ixstats?schema=public"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."   # optional
CLERK_SECRET_KEY="sk_test_..."                    # optional
IXTIME_BOT_URL="http://localhost:3001"            # optional
```

### Database

- Prisma migrations: `prisma/migrations/`
- Initialize: `npm run db:setup`
- Prisma Studio: `npm run db:studio` (dev) or `npm run db:studio:prod` (production)

## Build & Quality

| Command | Purpose |
|---------|---------|
| `npm run build` | Production build |
| `npm run start:prod` | Production server (port 3550) |
| `npm run lint` | ESLint with cache |
| `npm run dev` | Development server with incremental type checking |

> **Note:** Do not run `tsc --noEmit` globally — the project is too large and will exhaust server memory. Use `npm run dev` for incremental checking.

## Project Structure

```
├── src/
│   ├── app/                     # Next.js App Router pages (124 routes)
│   │   ├── maps/                # World map viewer (IxWorld at maps.ixwiki.com)
│   │   ├── mycountry/           # Executive command suite
│   │   ├── dashboard/           # Signed-in dashboards
│   │   ├── thinkpages/          # Social knowledge sharing
│   │   ├── vault/               # IxCards & MyVault
│   │   ├── help/                # In-app help center
│   │   └── api/                 # API route handlers
│   ├── components/              # UI and domain components (645+)
│   │   └── maps/               # Map core, editor, and widget components (27)
│   ├── hooks/                   # Custom React hooks (80)
│   ├── server/api/routers/      # tRPC routers (61)
│   ├── lib/                     # Utilities, rate limiter, formatting
│   └── services/                # Domain services and adapters
├── prisma/                      # Schema (206 models) and migrations
├── scripts/                     # Operational utilities
├── docs/                        # Documentation (see docs/README.md)
└── tests/                       # Test setup and utilities
```

## API & Data Access

- tRPC context: `src/server/api/trpc.ts` (Clerk auth, rate limiting, user provisioning)
- Router index: `src/server/api/root.ts` (61 domain routers)
- Database: Prisma client helpers in `src/server/db`
- Realtime: Socket.IO events from `src/lib/websocket-server.ts`

## Observability

- Rate limiting: `src/lib/rate-limiter` (Redis-based with in-memory fallback)
- Error logging: `src/lib/error-logger` with optional Discord webhooks
- Middleware: `src/proxy.ts` (Clerk auth + CSP + security headers)

## Documentation

- `docs/README.md` — documentation hub and navigation
- `docs/reference/api-complete.md` — full tRPC API catalog
- `docs/systems/` — system-specific guides (MyCountry, Intelligence, Diplomacy, Economy)
- `IMPLEMENTATION_STATUS.md` — current feature maturity matrix
- `CHANGELOG.md` — version history

## Contributing

1. Branch from `v2`
2. `npm install && npm run db:setup`
3. Keep linting clean: `npm run lint`
4. Update relevant docs when adding or changing features
