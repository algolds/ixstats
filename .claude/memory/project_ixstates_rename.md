---
name: IxStates Rename & Modular Monolith Strategy
description: IxStats renamed to IxStates (April 2026); modular monolith strategy chosen; IxWorld runs as SEPARATE standalone process on port 3002; IxStates stays at /projects/ixstates basePath
type: project
---

## IxStats → IxStates Rename (April 2026)

**What changed:**
- Package name: `ixstats` → `ixstates`
- URL base path: `/projects/ixstats` → `/projects/ixstates`
- PM2 process names: `ixstats` → `ixstates`, `ixstats-prod` → `ixstates-prod`
- Clerk redirect URLs updated
- Discord bot API URLs updated

**What stayed the same (intentionally):**
- Filesystem path: `/ixwiki/public/projects/ixstats/`
- Database name: `ixstats`
- Database user: `ixstats_readonly`
- Internal variable names (ixstatsResponse, etc.)

## Architecture: IxStates + IxWorld are SEPARATE Processes

**IMPORTANT — Do NOT unify them into a single process.**

| Process | Port | basePath | Nginx | PM2 Config |
|---------|------|----------|-------|------------|
| IxStates | 3550 | `/projects/ixstates` | `ixwiki.com/projects/ixstats` | `ecosystem.config.cjs` |
| IxWorld | 3002 | `""` (root) | `maps.ixwiki.com` | `ecosystem.ixworld.config.cjs` |

**IxWorld deployment**: `./scripts/deploy-ixworld.sh` — builds the same codebase with `BASE_PATH=""` + `NEXT_PUBLIC_IXWORLD_STANDALONE=true`, deploys to `/ixwiki/public/maps/ixworld/`.

**Why separate**: basePath is baked into Next.js builds. A single build can't serve both `/projects/ixstates` and `/`. The subdomain migration (ixstates.ixwiki.com) was explored but rolled back as premature.

**Runtime standalone detection**: `src/lib/standalone-detection.ts` exists for future use but IxWorld currently uses the build-time `NEXT_PUBLIC_IXWORLD_STANDALONE` flag.

## Prisma Schema Split (April 2026)

12 domain files in `prisma/schema/`: base, core (32), economy (33), government (33), diplomacy (35), intelligence (7), military (19), cards (20), maps (24), social (23), wiki (10), enums (25). Total: 236 models.

## Forum Module (April 2026)

Forum code extracted to `src/modules/forum/` (services/ + lib/ + index.ts barrel export). All imports use `~/modules/forum`.

## Router Domain Groups (root.ts)

Organized into: Core, Economy, Government, Diplomacy, Intelligence & Security, Military, Cards & Vault, Maps & Geo, Wiki & WikiOS, Social, Forum & Identity, MyCountry.

## Production Readiness Sweep (April 2026)

- Hardcoded credentials moved to env vars (MySQL password, Unsplash key, image URL)
- iiwiki/althistory bridges fixed with retry + backoff for 403 errors
- Health check endpoint at `/api/health`
- 24 silent `.catch(() => {})` replaced with logged catches
- Cache warm-up fixed (top 20 countries by GDP)
- Forum moderation, alert sync, attachment proxy added
- WikiOS watchlist, category tree cache, multi-wiki reader + search added
