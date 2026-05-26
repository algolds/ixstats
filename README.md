# IxStats v2

IxStats is a nation simulation and worldbuilding platform built with Next.js, tRPC, and Prisma. The codebase combines a React front end with a type-safe API layer, PostgreSQL database, and a custom server runtime that enables real-time updates for executive intelligence, diplomacy, economics, and collaborative storytelling.

## Platform Overview

- Next.js 16.2.6 App Router with client and server components under `src/app`
- React 19.2.6 + TypeScript 5.9.3 with 893+ components in `src/components`
- tRPC 11.17 API layer (`src/server/api/routers`) with **83 routers** and **1,329 typed procedures**
- Prisma 6.19.3 ORM with **237 models** on PostgreSQL
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
| **Content Management** | 28 admin interfaces for dynamic content (scenarios, NPC personalities, equipment, archetypes) |
| **IxWorld Maps** | Interactive world globe with MapLibre GL JS, 7 layers, border editor, procedural world generation, deployed at maps.ixwiki.com |
| **Achievements & Leaderboards** | Global achievement tracking and ranking |

## Technology Stack

| Area | Details |
|------|---------|
| Runtime | Node.js >= 18.17, bun >= 1.2 |
| Framework | Next.js 16.2.6, React 19.2.6 |
| Language | TypeScript 5.9.3 |
| API Layer | tRPC 11.17 with SuperJSON + Clerk auth context |
| Database | Prisma 6.19.3, PostgreSQL (port 5433) |
| Styling | Tailwind CSS 4.3, custom glass physics design system, Lucide icons |
| Mapping | MapLibre GL JS with globe/mercator projection, PostGIS spatial queries |
| Realtime | Socket.IO via `server.mjs` and `src/lib/websocket-server.ts` |

## Getting Started

### Prerequisites

- Node.js 18.17+ and bun 1.2+
- PostgreSQL database (port 5433, database `ixstats`)
- Optional: Clerk credentials for authentication (demo mode works without)

### Installation

```bash
bun install
bun run db:generate && bun run db:push:force && bun run db:init   # prisma generate + db push + seed
bun run dev        # launches Next.js on http://localhost:3000
```

The dev script loads `.env.local.dev` or `.env.local`. At minimum set:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."   # optional
CLERK_SECRET_KEY="sk_test_..."                    # optional
IXTIME_BOT_URL="http://localhost:3001"            # optional
```

### Database

- Prisma migrations: `prisma/migrations/`
- Initialize: `bun run db:setup`
- Prisma Studio: `bun run db:studio` (dev) or `bun run db:studio:prod` (production)

## Build & Quality

| Command | Purpose |
|---------|---------|
| `bun run build` | Production build |
| `bun run start:prod` | Production server (port 3550) |
| `bun run lint` | ESLint with cache |
| `bun run dev` | Development server with incremental type checking |
| `bun run typecheck` | Full typecheck across all sub-projects (ui, server, trpc, db) |

## Project Structure

```
├── src/
│   ├── app/                     # Next.js App Router pages (187 routes)
│   │   ├── maps/                # World map viewer (IxWorld at maps.ixwiki.com)
│   │   ├── mycountry/           # Executive command suite
│   │   ├── dashboard/           # Signed-in dashboards
│   │   ├── thinkpages/          # Social knowledge sharing
│   │   ├── vault/               # IxCards & MyVault
│   │   ├── help/                # In-app help center
│   │   └── api/                 # API route handlers
│   ├── components/              # UI and domain components (893+)
│   │   └── maps/               # Map core, editor, and widget components (75)
│   ├── hooks/                   # Custom React hooks (107)
│   ├── server/api/routers/      # tRPC routers (83, including subdirectories)
│   ├── lib/                     # Utilities, rate limiter, formatting
│   └── services/                # Domain services and adapters
├── prisma/                      # Schema (237 models) and migrations
├── scripts/                     # Operational utilities
├── docs/                        # Documentation (see docs/README.md)
└── tests/                       # Test setup and utilities
```

## API & Data Access

- tRPC context: `src/server/api/trpc.ts` (Clerk auth, rate limiting, user provisioning)
- Router index: `src/server/api/root.ts` (83 domain routers)
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
2. `bun install && bun run db:generate && bun run db:push:force && bun run db:init`
3. Keep linting clean: `bun run lint`
4. Update relevant docs when adding or changing features
