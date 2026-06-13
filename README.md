# IxStates

### Build a nation. Shape history.

IxStates is a nation simulation and worldbuilding platform — a persistent world where every country's economy, military, diplomacy, and borders are live and interconnected.

[IxStates 1.0 "Ogma" · 83 routers · 1,329 endpoints · 237 data models · 893 components]

---

### IxWorld

A handmade world with full topography, water systems, and climate modeling. Dynamic borders, live-updating territory, story pins that chart history, and a border editor. Every nation mapped with precision.

### MyCountry Suite

Unified command across defense, diplomacy, intelligence, economy, and politics. Includes the step-by-step Nation Builder for creating countries from scratch.

### IxVault

Trading cards, crafting recipes, auctions, and peer-to-peer trading. NationStates collection import. Real-time card marketplace.

### ThinkPages

Feed, direct messaging, group discussions, and lore sharing across all systems. Posts sync to Discord. The social backbone of the platform.

### WikiOS

A living wiki with a visual canvas editor and integrated media repository. Every nation, battle, and treaty documented. Powered by the community.

---

## Under the hood

Next.js 16 · React 19 · TypeScript 5.9 · Prisma 6.19 · tRPC 11.17 Tailwind CSS 4.3 · MapLibre GL · PostgreSQL + PostGIS · Socket.IO · Redis

---

## Platform Overview

- Next.js 16.2.6 App Router — 187 routes across `src/app`
- React 19.2.6 + TypeScript 5.9.3 — 893+ components in `src/components`
- tRPC 11.17 API layer — **83 routers**, **1,329 typed procedures**
- Prisma 6.19.3 ORM — **237 models** on PostgreSQL
- Custom server (`server.mjs`) with layered env loading and Socket.IO realtime feeds
- In-app help center at `/help` and documentation hub in `docs/`

## Feature Pillars

Each tier carries an independent version where noted — see the **[Versioning & Release Architecture](docs/reference/revision.md)** (`docs/reference/revision.md`).

| Tier | Systems |
|------|---------|
| **Apps** *(independent version)* | IxWorld (maps; standalone deployment: IxMaps), WikiOS (wiki software — powers the IxWiki content; Canvas editor sub-system), IxVault (wallet + trading cards + IxCredits + crafting/trading/marketplace/packs/lore cards/NS import) |
| **Engines** *(internal sim cores, independent version)* | MyCountry (nation sim), Concord (living-world — time/diplomacy/crises/NPCs), Atlas (geo/worldgen — powers IxWorld) |
| **Core Systems** *(independent version)* | MyCountry ★ (flagship executive command suite — Military & Security, Governance & Politics, Economy & Resources, Intelligence & Diplomacy, National Management), MyCountry Builder (nation creation wizard), ThinkPages (social knowledge sharing — ThinkShare, ThinkTanks, IxTwitter), Achievements & Awards (incl LoreWards), Stash, Repository, Blurbs, Halo, Admin CMS (28 interfaces) |
| **Design System** *(independent version)* | Facet (glass / refraction / depth) |
| **Platform Utilities** | IxTime (game clock), IxnayID (cross-platform identity) |
| **Inherits platform version** | IxForum (community), Experimental Labs |
| **Infrastructure** | Notifications, Help, c15t (consent manager), Flag Service, WebSocket, Cron, Cache/RateLimit/Auth |
| **Navigation Hubs** | Dashboard, Explore/Countries, Feed |

## Technology Stack

| Area | Details |
|------|---------|
| Runtime | Node.js >= 18.17, bun >= 1.2 |
| Framework | Next.js 16.2.6, React 19.2.6 |
| Language | TypeScript 5.9.3 |
| API Layer | tRPC 11.17 with SuperJSON + Clerk auth context |
| Database | Prisma 6.19.3, PostgreSQL (port 5433) |
| Styling | Tailwind CSS 4.3, custom **Facet** design system (glass/refraction/depth), Lucide icons |
| Mapping | MapLibre GL JS with globe/mercator projection, PostGIS spatial queries |
| Realtime | Socket.IO via `server.mjs` and `src/lib/websocket-server.ts` |

## Getting Started

### Prerequisites

- Node.js 18.17+ and bun 1.2+
- PostgreSQL database (port 5433, database `ixstats`)
- Optional: Clerk credentials for authentication (demo mode works without)

### Installation (Standard / Manual)

```bash
bun install
bun run db:setup       # prisma generate + db push + seed
bun run dev            # launches Next.js on http://localhost:3000
```

### Installation (WSL2 / Local Development Automation)

For a detailed step-by-step walkthrough on setting up your local WSL2 environment from scratch (including keys, SSH configuration, and environment overrides), see the setup guide in [plans/local-dev-windows-setup.md](file:///ixwiki/public/projects/ixstats/plans/local-dev-windows-setup.md).

If you are developing locally inside WSL2 and syncing from the production VPS (e.g. `ixwiki`), you can boot the entire local stack—including Docker database/Redis, background SSH tunnels, production database dump restoration, schema synchronization, and the Next.js development server—with a single command:

```bash
bun run dev:local
```

This script will automatically:
1. Establish SSH tunnels to the production VPS (Discord-bot on `13001`, DB inspector on `15433`, MediaWiki DB on `13306`).
2. Spin up local Docker containers (`ixstats-postgres` on port `5433` and `ixstats-redis-cache` on port `6379`).
3. Restore the latest production database dump to your local Postgres container.
4. Synchronize the database schema with your active branch's Prisma definitions (`db:push:force`).
5. Start the Next.js development server on `http://localhost:3000` (Turbopack).

To safely push and deploy your changes to the VPS:
```bash
bun run deploy:local
```
This runs Prettier, ESLint, and Jest unit tests locally, pushes your active branch to GitHub, and triggers the remote VPS deployment script over SSH.

### WSL2 Environment Configuration & Database Modes

The application dev server determines its database access mode based on which environment file it loads:

1. **Read-Only Mode (Production Replica Inspection):**
   If `.env.local.dev` is loaded and contains `DATABASE_READONLY="true"`, the application will start in **Read-Only Mode**. All database write operations, schema updates, user creation, and audit logging are blocked.

2. **Read-Write Mode (Local Development & Testing - Recommended):**
   To enable writing to your local database (e.g., managing your sports clubs, editing countries, or saving stashes):
   - Modify `.env.local.dev` (or create/edit `.env.local` to override it) and change the variables to:
     ```ini
     DATABASE_READONLY="false"
     DATABASE_URL="postgresql://postgres:kxslIz4cICVDon%2FqwP2yrUzOKjtsryQDt9d28hmMjlk%3D@localhost:5433/ixstats?connection_limit=5"
     ```
     *(Note: The URL-encoded password matches the local Docker Postgres container superuser credentials)*
   - When `DATABASE_READONLY` is set to `false`, startup scripts will automatically sync any codebase schema changes (like `v2` additions) to your local DB.

> [!TIP]
> **SSH Tunnel Port Conflicts:** If you see `bind [127.0.0.1]:13001: Address already in use` warnings on startup, it means background SSH tunnels are already active on those ports (either from another WSL terminal or a Windows SSH client like PuTTY). The local development server will still run successfully and leverage the existing active tunnels.



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
├── Integrated Products
│   ├── src/app/maps/               # IxWorld map viewer (standalone: IxMaps at maps.ixwiki.com)
│   ├── src/app/(forum)/forum/      # IxForum community (XenForo bridge)
│   ├── src/app/vault/              # IxVault — cards, collections, marketplace, crafting, packs, NS import
│   └── src/app/(wikios)/w/         # IxWiki — wiki reader, editor, special pages (powered by WikiOS)
│
├── Core Systems
│   ├── src/app/mycountry/          # MyCountry ★ — executive command suite
│   ├── src/app/builder/            # MyCountry Builder — nation creation wizard
│   ├── src/app/thinkpages/         # ThinkPages — feed, ThinkShare messages, ThinkTanks
│   ├── src/app/achievements/       # Achievements & Awards — quest paths, LoreWards
│   ├── src/app/stashes/            # Stash — save-for-later with annotations
│   ├── src/app/blurbs/             # Blurbs — community wiki reviews
│   └── src/app/admin/              # Admin CMS — 28 management interfaces
│
├── Infrastructure
│   ├── src/components/             # UI components (893+ across 44 directories)
│   ├── src/hooks/                  # Custom React hooks (107)
│   ├── src/server/api/routers/     # tRPC routers (83, including subdirectories)
│   ├── src/lib/                    # Utilities, rate limiter, game clock, cron, WebSocket
│   ├── src/styles/                 # Facet design system (glass/refraction/depth), themes, forum CSS
│   ├── prisma/                     # Schema (237 models across 12 files) + migrations
│   └── server.mjs                  # Custom Node server (Socket.IO + cron)
│
└── Navigation Hubs
    ├── src/app/dashboard/          # Signed-in dashboard
    ├── src/app/countries/          # Explore / public nation profiles
    └── src/app/feed/               # Activity feed
```

## Experimental Labs

Early-stage prototype systems under the Labs dropdown.

| Lab | Description |
|-----|-------------|
| **Vexel** | — |
| **Onoma** | — |
| **Strata** | — |
| **Dynas** | — |
| **Nomora** | — |

## Design System

The platform is built on **Facet** *(formerly "Glass Physics")* — a custom glass / refraction / depth design system with hierarchy, dynamic refraction, and light/dark theme support. See `src/styles/glass-refraction.css` and `src/styles/themes.css`. *(CSS classes/tokens remain `glass-*` / `--glass-*` pending a separate mechanical rename.)*

- **Icons**: Lucide React (primary), React Icons (Font Awesome, Game Icons, Remix), 36 custom animated icons (`src/components/ui/icons/`)
- **Brand colors**: Indigo primary (`#6366f1`), with per-system accent colors mapped in `docs/reference/branding.md`
- **Tailwind CSS 4.3** with CSS-first `@theme` configuration

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
- `docs/reference/branding.md` — complete brand catalog: all systems, icons, colors, visual identity tokens
- `docs/systems/` — system-specific guides (MyCountry, Intelligence, Diplomacy, Economy, etc.)
- `docs/reference/revision.md` — **Versioning & Release Architecture** (platform/app/engine/system versioning, release names, channels, the Version Registry)
- `CHANGELOG.md` — version history

## Contributing

1. Branch from `v2`
2. `bun install && bun run db:setup`
3. Keep linting clean: `bun run lint`
4. Update relevant docs when adding or changing features
