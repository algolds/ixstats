# IxStats v1.2.0

IxStats is a modern nation simulation and worldbuilding platform. The codebase combines a rich React front end with a tRPC API layer, Prisma schema, and a custom server runtime that enables real-time updates for executive intelligence, diplomacy, economics, and collaborative storytelling features.

## Platform Overview
- Next.js 15.4.1 App Router with client and server components under `src/app`
- React 19 + TypeScript 5.8 with an extensive shared component library in `src/components`
- tRPC 11.4 API layer (`src/server/api/routers`) with 37 routers and 580+ typed procedures (290+ queries / 290+ mutations)
- Prisma 6.12 schema (`prisma/schema.prisma`) covering 131 models with PostgreSQL database
- Custom Node server (`server.mjs`) that loads environment tiers and enables production WebSocket feeds for live intelligence updates
- Documentation-first approach with Markdown guides in `docs/` and an in-app help center at `/help`
- **✅ 100% Dynamic Content Management**: All game content now database-driven (14,677 lines migrated from hardcoded TypeScript)

## Feature Pillars
- **MyCountry Command Suite** – Unified dashboard at `src/app/mycountry` with executive briefing, compliance, defense, economic, and analytics modules powered by hooks such as `useMyCountryCompliance`
- **Intelligence & Compliance** – Live diplomatic and domestic intelligence feeds (`src/components/mycountry/IntelligenceTabSystem.tsx`, `src/components/diplomatic/LiveDiplomaticFeed.tsx`) backed by routers like `diplomatic-intelligence.ts` and `intelligence.ts`
- **Diplomacy & Foreign Affairs** – Embassy missions, cultural exchanges, and influence tracking across `src/app/mycountry/intelligence`, `src/components/diplomatic`, and tRPC routers including `diplomatic.ts`
- **Economic Simulation & Builder Tools** – Country builder flows (`src/app/builder`, `src/components/builders`) with tier-based economic calculations and historical data services in `src/server/api/routers/economics.ts`
- **Social & Collaboration Systems** – ThinkPages and ThinkShare social experiences (`src/app/thinkpages`, `src/components/thinkshare`) with activity feeds, comments, and shared research hubs
- **Achievements & Leaderboards** – Global achievement tracking and ranking interfaces (`src/app/achievements`, `src/app/leaderboards`) driven by routers such as `achievements.ts`
- **Content Management System** – 12 admin interfaces (`/admin/*`) for dynamic content management including diplomatic scenarios, NPC personalities, military equipment, economic archetypes, and more
- **Integrated Help & Knowledge Base** – Rich help center under `src/app/help` plus curated Markdown documentation within the repository

## Technology Snapshot
| Area | Details |
| --- | --- |
| Runtime | Node.js ≥ 18.17, npm ≥ 9.0 |
| Framework | Next.js 15.4.1, React 19.1.0 |
| Language | TypeScript 5.8.3 |
| API Layer | tRPC 11.4 with superjson + Clerk auth context |
| Data | Prisma 6.12 ORM, PostgreSQL database (`localhost:5433/ixstats`), PostgreSQL-native |
| Styling | Tailwind CSS 4, custom "glass physics" design tokens, Lucide icons |
| Realtime | Socket.IO server enabled in production via `server.mjs` and `src/lib/websocket-server.ts` |

## Getting Started
### Prerequisites
- Node.js 18.17 or later and npm 9+
- PostgreSQL database (port 5433, database name `ixstats`)
- Optional Clerk credentials for authentication (demo mode works without keys)

### Installation
```bash
npm install
npm run db:setup   # prisma generate + db push + seed/init scripts
npm run dev        # wraps start-development.sh and launches Next.js on http://localhost:3000
```

The development script loads `.env.local.dev` or `.env.local` if present. At minimum set:

```dotenv
DATABASE_URL="postgresql://ixstats:ixstats@localhost:5433/ixstats?schema=public"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_key"   # optional
CLERK_SECRET_KEY="sk_test_your_key"                    # optional
IXTIME_BOT_URL="http://localhost:3001"                # optional local bot integration
```

More details on required and optional variables are tracked in `docs/operations/environments.md` (updated in this refresh).

### Database Notes
- Prisma migrations live in `prisma/migrations`
- `npm run db:setup` (or `npm run dev:db`) initializes the schema and seed routines
- Use `npm run db:studio` for the dev database and `npm run db:studio:prod` when pointing at production data

## Build, Test, and Quality Gates
- `npm run build` – production build using the custom base path script
- `npm run start` – start the production server (uses `server.mjs`)
- `npm run preview` – build + Next.js preview server on port 3550 by default
- `npm run test` – Jest + @testing-library suite for API routers and critical services
- `npm run audit:wiring` – validates that TRPC queries/mutations resolve to live implementations
- `npm run typecheck:app`, `npm run typecheck:server`, `npm run typecheck:components` – targeted TypeScript checks for specific areas

## Folder Structure
```
├─ src/
│  ├─ app/                     # Next.js routes (App Router)
│  │  ├─ mycountry/            # Executive command suite
│  │  ├─ dashboard/            # Signed-in dashboards and cards
│  │  ├─ thinkpages/           # Social knowledge sharing hub
│  │  ├─ achievements/         # Achievement explorer
│  │  ├─ leaderboards/         # Rankings and stats
│  │  ├─ help/                 # In-app help experience
│  │  └─ api/                  # Edge/API route handlers
│  ├─ components/              # Shared and domain component libraries
│  ├─ hooks/                   # Cross-domain React hooks
│  ├─ server/
│  │  ├─ api/routers/          # tRPC routers (35 total)
│  │  └─ db/                   # Prisma client helpers
│  ├─ lib/                     # Utilities (rate limiter, websocket server, formatting)
│  └─ services/                # Domain services and adapters
├─ prisma/                     # Schema, migrations, PostgreSQL database
├─ scripts/                    # Operational and audit scripts
├─ docs/                       # Markdown documentation suite (refreshed in this update)
└─ tests/                      # Jest setup, mocks, integration utilities
```

## API & Data Access
- tRPC context defined in `src/server/api/trpc.ts` (Clerk auth, rate limiting, user auto-provisioning)
- Routers are co-located by domain under `src/server/api/routers`; see generated summaries in the refreshed documentation set
- Database access uses Prisma; helpers for common queries live in `src/server/db`
- Realtime events originate from `src/lib/websocket-server.ts` and are consumed by live intelligence components

## Observability & Operations
- Rate limiting middleware lives in `~/lib/rate-limiter`
- Error logging via `~/lib/error-logger` with optional Discord webhooks controlled by environment flags
- Production server loads layered environment files (`.env.production`, `.env.local`, `.env`) before bootstrapping Next.js and the WebSocket layer

## Documentation & Help System
- Full documentation lives under `docs/` (see `docs/README.md` for navigation)
- `/help` exposes the in-app help center with articles that mirror the Markdown guidance
- Domain-specific READMEs (e.g., `src/app/mycountry/README.md`) summarise implementation details after this refresh

## Contributing
1. Fork or branch from `main`
2. Install dependencies and run `npm run db:setup` for a working dataset
3. Keep coverage and linting healthy (`npm run test`, `npm run typecheck:*`)
4. Update relevant docs/help content when adding or changing features

Additional contribution standards, coding style, and review expectations are captured in `docs/processes/contributing.md`.

## Support & Contact
- For environment or deployment issues see `docs/operations/deployment.md`
- Incident response runbooks and audit scripts live under `scripts/` and the accompanying documentation
- Reach out to the IxStats maintainers through the project Discord or filing an issue in the tracker (internal tooling)

---
This README reflects the current codebase as of the documentation refresh performed in this update. Keep it in sync with structural changes and major feature work.
