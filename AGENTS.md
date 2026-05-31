# AGENTS.md — IxStats (ixwiki.com/projects/ixstats)

## Critical Constraints

- **Package manager**: `bun` (never npm/yarn/pnpm). Lockfile: `bun.lock`.
- **Global typechecking is split into sub-projects.** Use `bun run typecheck` to sequentially run all checks, or check individual sub-projects like `typecheck:ui` or `typecheck:server`. The scripts run with predefined safe heap bounds (`--max-old-space-size=6144` or `4096`) to prevent OOM on 8GB host servers.
- **Database write commands are blocked**: `db:migrate`, `db:push`, `db:reset` exit with error to protect 82 nations of production data. Use `db:migrate:force` or `db:push:force` only when explicitly intended.
- **Active branch**: `v2`.

## Developer Commands

```bash
bun install                    # install deps (auto-runs prisma generate via postinstall)
bun run dev                    # dev server on http://localhost:3000
bun run build                  # production build (uses basePath wrapper)
bun run start:prod             # production server on port 3550
bun run lint                   # ESLint with cache (pre-existing issues expected)
bun run format:write           # Prettier with tailwindcss plugin
bun run db:setup               # prisma generate + db push (BLOCKED — see below) + seed
bun run db:studio              # Prisma Studio GUI
bun run db:sync                # sync production DB to dev
bun run redis:start            # start Redis cache (rate limiting)
bun run test                   # Jest 30
bun run test:watch             # Jest watch mode
```

### Single test
```bash
bun run test -- <path-or-pattern>   # e.g. bun run test -- src/lib/foo.test.ts
```

### Typecheck commands
```bash
bun run typecheck                       # sequentially checks ui, server, trpc, and db sub-projects
bun run typecheck:ui                    # frontend client-side pages, hooks, components (6144MB heap)
bun run typecheck:server                # backend routers, databases, libs (6144MB heap)
bun run typecheck:trpc                  # core tRPC types and router definitions (4096MB heap)
bun run typecheck:db                    # Prisma client connections and database helpers (4096MB heap)
bun run typecheck:file path/to/file.ts  # single file typecheck using safe defaults (6144MB heap)
bun run typecheck:diag                  # run diagnostics on global tsconfig (6144MB heap)
```

### TypeScript Performance & Profiling
```bash
bun run ts:check:lib      # full typecheck of lib sub-project (1,737 files, ~7s)
bun run ts:diagnostics    # extended diagnostics for lib sub-project
bun run ts:profile        # CPU profile (lib), generates traces/tsc-profile.cpuprofile
bun run ts:trace          # trace + analyze (lib) using @typescript/analyze-trace
bun run ts:explain        # explain why each file is included (lib)
bun run ts:listfiles      # list all files included (lib)
bun run ts:build          # build with project references (lib + server)
```

**Performance config applied:**
- `types: []` — prevents automatic inclusion of all @types/* packages (saved 70% file count)
- `isolatedModules: true` — ensures safe isolated compilation
- `importHelpers: true` + `tslib` — generates shared helper imports (smaller bundle)
- `exclude: ["**/.*"]` — prevents walking hidden dot files (.git, .env)
- `noImplicitReturns: true` — all code paths must return
- `noFallthroughCasesInSwitch: true` — no accidental switch fallthrough

## Architecture

| Layer | Location | Notes |
|-------|----------|-------|
| Pages | `src/app/` | Next.js 16.2 App Router, 187 routes |
| Components | `src/components/` | 893+ UI components, glass physics design system |
| API (tRPC) | `src/server/api/routers/` | 83 routers, 1,329 endpoints. Register new routers in `src/server/api/root.ts` |
| Database | `prisma/schema/` | 237 models split across 12 `.prisma` files |
| Middleware | `src/proxy.ts` | Clerk auth + CSP + security headers (NOT `middleware.ts`) |
| Custom server | `server.mjs` | WebSocket (Socket.IO) + cron jobs (production only) |
| Hooks | `src/hooks/` | 107+ custom React hooks |
| Lib | `src/lib/` | Utilities, rate limiter, WebSocket server, memory config |

### Key pages
- `/mycountry` — Executive command suite (single-page router pattern)
- `/dashboard` — Signed-in dashboard
- `/vault` — IxCards & MyVault
- `/thinkpages` — Social knowledge sharing
- `/maps` — IxWorld interactive map (also standalone at maps.ixwiki.com)
- `/admin` — 28 admin CMS interfaces (system-owner or admin role required)

### Path aliases
- `~/*` → `./src/*`
- `@/*` → `./src/*`
- `~/components/*` → `./src/components/*`
- `~/hooks/*` → `./src/hooks/*`

## Environment & Infrastructure

### Database
- PostgreSQL with PostGIS, Docker container `ixstats-postgres` on port **5433**
- Connection: `postgresql://postgres:postgres@localhost:5433/ixstats`
- Schema files: `prisma/schema/{core,economy,government,diplomacy,cards,military,maps,intelligence,social,wiki,enums,base}.prisma`

### Env loading order (dev)
1. `.env.local.dev` (preferred) → `.env.local` → `.env`
2. Custom server (`server.mjs`) also loads these manually for WebSocket/cron

### Env loading order (prod)
1. `.env.production` (template) → `.env.production.local` (secrets)
2. Deployed at basePath `/projects/ixstates` on port 3550

### Required env vars (minimum dev)
```
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
```
Clerk keys are optional in dev (demo mode works without). Required in production.

### Special modes
- **DATABASE_READONLY=true**: Blocks all writes, disables user creation and audit logging
- **SKIP_ENV_VALIDATION=true**: Skip env schema check (Docker builds)
- **NEXT_PUBLIC_IXWORLD_STANDALONE=true**: Maps-only mode (maps.ixwiki.com), empty basePath

### Redis
Used for rate limiting and caching. Start with `bun run redis:start`. Falls back to in-memory if unavailable.

## Production Deployment

- PM2 manages processes: `ecosystem.config.cjs` (app) + `ecosystem.ixworld.config.cjs` (maps)
- Build output: `.next/standalone/` (Next.js standalone mode)
- Max memory restart: 1500M for app, Node heap 1280M
- Logs: `/ixwiki/private/logs/ixstates-*.log`
- Deploy script: `scripts/deploy-production.sh`

## Framework Versions

| Package | Version |
|---------|---------|
| Next.js | 16.2.6 |
| React | 19.2.6 |
| TypeScript | 5.9.3 |
| Prisma | 6.19.3 |
| tRPC | 11.17.0 |
| Zod | 4.4.3 (NOT v3) |
| Tailwind CSS | 4.3.0 (NOT v3) |
| ESLint | 9.39.4 (flat config) |
| Jest | 30.4.2 |
| Express | 5.2.1 |

## Subsystem Versions

Subsystem versions are centralized in [src/lib/buildVersion.ts](file:///ixwiki/public/projects/ixstats/src/lib/buildVersion.ts):

| Subsystem | Constant | Version | Location / Usage |
|-----------|----------|---------|------------------|
| Application | `APP_VERSION` | `1.42` | Main platform version (matches `package.json`) |
| WikiOS | `WIKIOS_VERSION` | `1.0-alpha` | [WikiOSLayout.tsx](file:///ixwiki/public/projects/ixstats/src/components/wikios/shared/WikiOSLayout.tsx) footer |
| IxWorld Maps | `IXWORLD_VERSION` | `2.1.7` | [MapWelcomeModal.tsx](file:///ixwiki/public/projects/ixstats/src/components/maps/core/MapWelcomeModal.tsx) version check |
| IxForum | `IXFORUM_VERSION` | `1.0-alpha` | [ForumLayout.tsx](file:///ixwiki/public/projects/ixstats/src/components/forum/shared/ForumLayout.tsx) footer |
| ThinkPages | `THINKPAGES_VERSION` | `1.0` | [ThinkPagesStatusWidget.tsx](file:///ixwiki/public/projects/ixstats/src/components/thinkpages/ThinkPagesStatusWidget.tsx) stats widget |
| Nation Builder | `BUILDER_VERSION` | `1.5` | [BuilderHeader.tsx](file:///ixwiki/public/projects/ixstats/src/app/builder/components/enhanced/sections/BuilderHeader.tsx) header badge |


## Gotchas

- **Turbopack**: Next.js 16 defaults to Turbopack. Dev script uses `bun run next dev` (no `--webpack` flag).
- **ignoreBuildErrors: true**: `next.config.js` ignores TypeScript errors during build.
- **WebSocket disabled in dev**: Intelligence WebSocket is production-only. Market WS always enabled.
- **Cron jobs disabled in dev**: Auction, passive income, card value, and lore card crons run in production only.
- **Lint has pre-existing issues**: `bun run lint` prints a note about this — it's expected.
- **`.next` cleanup**: Dev script cleans stale build artifacts but preserves `.next/cache` for incremental compilation.
- **Port conflicts**: 3000=dev, 3001=IxTime bot, 3002=IxMaps prod, 3003=IxMaps dev/custom server, 3550=prod.
- **NS image proxy**: NationStates images go through `/api/proxy-ns-image` (hotlinking restrictions).
- **Zod v4 migration**: Schema syntax differs from v3. Check existing routers for patterns.
- **Tailwind v4**: Uses `@theme` directives, not `tailwind.config.js`. Config is CSS-based.

## Code Conventions

- **Unused vars**: Prefix with `_` to suppress ESLint warning (`unused-imports` plugin, not `@typescript-eslint/no-unused-vars`)
- **Prettier**: 2-space indent, semicolons, trailing comma (es5), 100 char print width, tailwindcss plugin
- **React**: Use `React.memo`, `useMemo`, `useCallback` for performance. Glass physics design patterns.
- **tRPC**: All API access goes through tRPC routers. Do not query Prisma directly from components.
- **Modular architecture**: For components >500 lines, extract business logic to `src/lib/`, state to `src/hooks/`, UI to focused components under `src/components/domain/feature/`.

## Instruction Sources

- `CLAUDE.md` — Detailed architecture, design system, MyCountry routing, maps system
- `docs/README.md` — Documentation hub
- `docs/reference/api-complete.md` — Full tRPC API catalog (1,329 endpoints)
- `docs/systems/` — System-specific guides
- `IMPLEMENTATION_STATUS.md` — Feature maturity matrix (archived, gitignored)
-  `/ixwiki/.cursor/rules/design.mdc` — for design token mappings and usage guidelines
