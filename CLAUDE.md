# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Constraints

- **Package manager**: `bun` exclusively — never npm, yarn, or pnpm. Lockfile is `bun.lock`.
- **Middleware file**: `src/proxy.ts` (Clerk auth + CSP + security headers). There is no `middleware.ts` — Next.js picks up `proxy.ts` via compiled output.
- **Database write commands are blocked**: `db:migrate`, `db:push`, `db:reset` exit with an error to protect 82 nations of production data. Use `db:migrate:force` or `db:push:force` only when explicitly intended.
- **No global typecheck**: Never run `tsc --noEmit` or `bun run typecheck:full` directly — can crash the 8GB server. Use sub-project typechecks (see below).
- **Active branch**: `v2`.

## Commands

```bash
bun install                    # install deps (auto-runs prisma generate via postinstall)
bun run dev                    # dev server on http://localhost:3000 (Turbopack, 4GB heap)
bun run dev:local              # WSL2 local dev: boots Docker DB + Redis + SSH tunnels + Next.js
bun run dev:ixworld            # IxWorld standalone maps mode (port 3003)
bun run build                  # production build (wraps basePath logic)
bun run start:prod             # production server on port 3550
bun run lint                   # ESLint with cache (pre-existing issues expected, build still passes)
bun run lint:strict            # ESLint, zero warnings tolerance
bun run format:write           # Prettier with tailwindcss plugin
bun run db:studio              # Prisma Studio GUI
bun run db:sync                # sync production DB to local dev
bun run redis:start            # start Redis (rate limiting / caching)
bun run test                   # Jest 30
bun run test:watch             # Jest watch mode
bun run test -- <path>         # single test, e.g. bun run test -- src/lib/foo.test.ts
```

### Typecheck commands (safe heap bounds pre-configured)

```bash
bun run typecheck              # run all checks sequentially: ui → server → trpc → db
bun run typecheck:ui           # frontend components, pages, hooks (6144MB heap)
bun run typecheck:server       # backend routers, databases, libs (6144MB heap)
bun run typecheck:trpc         # tRPC router definitions and types (4096MB heap)
bun run typecheck:db           # Prisma client connections and helpers (4096MB heap)
bun run typecheck:file path/to/file.ts   # single file (6144MB heap)
bun run typecheck:diag         # extended diagnostics on global tsconfig
```

### Database (careful — production data)

```bash
bun run db:migrate:force       # run schema migration (writes to prod DB)
bun run db:push:force          # push schema changes (dev auto-runs this on startup)
bun run db:seed                # seed reference data
bun run db:setup               # generate + push + seed (dev only)
bun run db:sync:prod-to-dev    # pull production snapshot into local
```

## Architecture

| Layer | Location | Notes |
|-------|----------|-------|
| Pages | `src/app/` | Next.js 16.2 App Router, 210+ routes |
| Components | `src/components/` | 750+ UI components (Facet glass design system) |
| API (tRPC) | `src/server/api/routers/` | **90 routers** (domain-split into subdirs via `mergeRouters` + flat files), **1,450+ procedures**; register new ones in `root.ts` |
| Database | `prisma/schema/` | 296 models across 15 `.prisma` files |
| Middleware | `src/proxy.ts` | Clerk auth + CSP + security headers |
| Custom server | `server.mjs` | WebSocket (Socket.IO) + cron jobs (production only) |
| Hooks | `src/hooks/` | 90+ custom React hooks |
| Lib | `src/lib/` | Pure utilities, rate limiter, memory config, map pipeline |

### Import direction (strictly enforced — see arch.md)

```
UI (src/app, src/components)
  ↓
API Layer (src/server/api/routers — thin routing only)
  ↓
Domain Modules (business logic, DB queries)
  ↓
Shared Core (minimal primitives: db.ts, auth.ts, base-types.ts)
  ↓
Infra (Prisma, Redis, external services)
```

Forbidden: modules → api, modules → modules, shared → modules, ui → server internals.  
Routers must only: define endpoints, validate input, call service layer, return response.

### Key pages

- `/mycountry` — Executive command suite (single-page router pattern, see below)
- `/dashboard` — Signed-in dashboard
- `/vault` — IxVault (cards, credits, marketplace)
- `/thinkpages` — Social knowledge sharing
- `/maps` — IxWorld interactive map (also standalone at maps.ixwiki.com)
- `/admin` — 50+ CMS admin interfaces

## Key File Locations

**Middleware & Security:**
- `src/proxy.ts` — Clerk auth + CSP (`generateCSP()`) + security headers
- `src/lib/system-owner-constants.ts` — system owner constants
- `src/lib/production-optimizations.ts` — production optimization config

**API Layer:**
- `src/server/api/root.ts` — tRPC root router (registers all 90 routers with `safeRouter()` wrapper)
- `src/server/api/routers/` — flat `.ts` files + `geo/`, `diplomacy/`, `intelligence/`, `countries/`, `admin/`, `activities/`, `sports/`, `thinkpages/`, `security/` subdirectories
- `src/server/api/trpc.ts` — exports `createTRPCRouter`, `mergeRouters`, `publicProcedure`, `protectedProcedure`

**Database:**
- `prisma/schema/*.prisma` — 12 schema files (core, economy, diplomacy, military, maps, social, sports, wiki, etc.)
- `prisma.config.ts` — Prisma configuration

**Maps & IxWorld:**
- `src/lib/map-config.ts` — layer config and projection settings
- `src/components/maps/core/IxWorldMap.tsx` — core map component
- `src/server/api/routers/geo/` — 6 files (~11,558 lines, 102 endpoints)
- `scripts/deploy-ixworld.sh` — builds IxWorld standalone deployment
- `ecosystem.ixworld.config.cjs` — PM2 config for maps.ixwiki.com

**Time System:**
- `src/lib/ixtime.ts` — IxTime (2× real-time speed), synchronized with Discord bot

**Versioning:**
- `src/lib/buildVersion.ts` — single source of truth for all version strings
- `docs/reference/revision.md` — full versioning spec

**Configuration:**
- `next.config.js` — base path logic (empty in dev, `/projects/ixstates` in prod)
- `start-development.sh` — dev startup (env loading, DB push, Redis, Turbopack)
- `ecosystem.config.cjs` — PM2 production config

## Patterns

### Single-Page Router (instant navigation)

MyCountry, Vault, ThinkPages, and Dashboard avoid Next.js route transitions using a central `*Router.tsx` component with `useState` + `window.history.pushState()`. All sub-page `page.tsx` files render the same Router. A `popstate` listener handles back/forward.

| Router | Location | Sections |
|--------|----------|----------|
| `MyCountryRouter` | `src/components/mycountry/MyCountryRouter.tsx` | Overview, Executive, Diplomacy, Intelligence, Defense, Politics |
| `VaultRouter` | `src/components/vault/VaultRouter.tsx` | Dashboard, Cards, Acquire, Create, Import |
| `ThinkPagesRouter` | `src/components/thinkpages/ThinkPagesRouter.tsx` | Feed, ThinkTanks, ThinkShare |
| `DashboardRouter` | `src/components/dashboard/DashboardRouter.tsx` | Main, Diplomacy, Feed, Trends |

### Modular Component Architecture

For components exceeding ~500 lines:

1. **`src/lib/*.ts`** — pure business logic (no React, fully testable)
2. **`src/hooks/*.ts`** — data fetching + state (encapsulate tRPC, use `useMemo`)
3. **`src/components/domain/feature/*.tsx`** — focused UI components (`React.memo`, props-only)
4. **Main component** — thin orchestration (~100-200 lines, `index.ts` barrel export)

### tRPC Router Modularization

Large flat routers are split into a domain subdirectory and recombined with `mergeRouters` so every `api.<router>.*` path is preserved with zero call-site changes. The monolith file is deleted once the index re-exports the merged sub-routers.

**Process:** Scout (confirm live single router) → Generate splitter script (ts-morph, template from `scripts/split-thinkpages-ast.ts`) → Write `<name>/index.ts` with `mergeRouters(...)` → Verify parity with `scripts/verify-router-splits.ts` (AST-level, not line grep) → `eslint --fix` cleanup.

**Completed:** `thinkpages` (55 procs), `admin` (79), `sports` (44), `activities` (20), `security` (41).

## Design System (Facet)

- **Glass hierarchy**: parent / child / interactive / modal depth levels
- **Color themes**: MyCountry=Gold, Global=Blue, ECI=Indigo, SDI=Red
- **Tailwind v4**: all styling must use v4 syntax — no legacy `@apply` patterns
- **GPU acceleration**: already enabled for glass effects; preserve it

## Platform & Versioning

Current release: **IxStates 1.1.1 "Ogma"** (channel: Alpha). Version source of truth: `src/lib/buildVersion.ts`. After any major change, check `docs/reference/revision.md` and ask whether the platform version, component capability integer, channel, or changelog need updating.

**Apps** (independent capability integer): IxWorld, WikiOS (with Canvas), IxVault  
**Engines** (sim cores): MyCountry, Concord (time/diplomacy/crises/NPCs), Atlas (geo/worldgen)  
**Design system**: Facet (formerly "Glass Physics")  
**Inherits platform version**: IxForum, IxTime/IxnayID, Labs, Nav Hubs

## Production Notes

- **PostgreSQL**: Docker container `ixstats-postgres` (image `postgis/postgis:16-3.4-alpine`, host port 5433). Database `ixstats`. Never `docker system prune -a --volumes`.
- **Redis**: Docker container `ixstats-redis-cache`. In-memory fallback exists for dev.
- **Production port**: 3550 (`start-production.sh`), base path `/projects/ixstates`
- **IxWorld standalone**: port 3002 (`ecosystem.ixworld.config.cjs`), empty base path, maps.ixwiki.com
- **If Prisma errors like `database system is in recovery mode`**: check disk space on `/dev/vda2` first — a full root disk stalls Postgres WAL writes and triggers this. `df -h /` is the first diagnostic.
