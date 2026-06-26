# IxStats Codebase Audit & Remediation Plan

## Context

The user has made substantial progress on IxStats (now on branch `v2`: Next.js 16, React 19, tRPC 11, Prisma 6, ~786k LOC across 2,434 source files) and is using `deploy-ixworld.sh` as a live test of the IxMaps/IxWorld system **and** the broader IxStats platform. They requested (1) a full codebase audit for performance bugs, bloat, dead/outdated/deprecated/unused code, an overall health report, and (2) an audit of the IxWorld deployment script.

Outcome chosen: **Report + full remediation**, prioritizing all four areas (deploy script, backend/DB perf, frontend perf, dead/bloated code).

This document is both the **audit report** (findings below) and the **remediation plan** (phased work at the end). All findings were verified against the live tree; line numbers are approximate where the agents reported them and will be re-confirmed at edit time.

---

## PART 1 — AUDIT REPORT

### 1. IxWorld Deploy Script (`scripts/deploy-ixworld.sh`) — HIGHEST PRIORITY

| # | Severity | Finding |
|---|----------|---------|
| D1 | **CRITICAL** | **Build-output clobbering.** The script `cd`s into `IXSTATS_DIR`, runs `rm -rf .next`, then `bunx next build` with `BASE_PATH=""` / `NEXT_PUBLIC_BASE_PATH=""` / `NEXT_PUBLIC_IXWORLD_STANDALONE=true`. **`start-production.sh` serves IxStats prod via `next start` from that same `.next`** (line 115: `exec node node_modules/.bin/next start`). So every IxWorld deploy overwrites the live IxStats production build with an empty-base-path / standalone-flavored build. IxStats prod (port 3550, base path `/projects/ixstates`) is left broken until someone manually rebuilds it. This is almost certainly why "live testing the platform" via this script feels unstable. |
| D2 | HIGH | **Misleading header vs. behavior.** Header claims "Atomic-style update (no rm -rf)" and "Graceful PM2 management (reload instead of delete/start)." Actual code does `rm -rf .next` (line 72) and `pm2 delete` + `pm2 start` (lines 100–108), not `reload`. Result: real downtime on every deploy + comments that mislead future maintenance. |
| D3 | HIGH | **No rollback / not atomic.** `rsync --delete` overwrites `IXWORLD_DIR` in place (lines 86–89). A successful build that fails at runtime leaves no previous version to fall back to, and mid-rsync the directory is served half-updated. |
| D4 | MEDIUM | **No post-deploy health check.** Script prints "Deployment Successful" immediately after `pm2 start` (line 112). `pm2 start` succeeding ≠ app serving 200s. Needs an HTTP probe against `http://localhost:3002/` (or `/maps`) before declaring success. |
| D5 | MEDIUM | **`wait_ready: true` mismatch.** `ecosystem.ixworld.config.cjs` sets `wait_ready: true` + `listen_timeout: 10000` for the `ixworld` app, but Next.js standalone `server.js` does **not** call `process.send('ready')`. PM2 waits the full 10s then proceeds/errors on every start. Either drop `wait_ready` or patch `server.js` to emit ready. |
| D6 | LOW | **Lockfile not crash-safe.** Uses `[ -f LOCK_FILE ]` + `touch` + `trap … EXIT`. A hard kill (`kill -9`, OOM, reboot mid-deploy) skips the trap and the lockfile blocks all future deploys until manually cleared. Use `flock` or a PID-liveness check. |
| D7 | LOW | **Unbounded deploy log.** `/ixwiki/private/logs/deploy-ixworld.log` grows forever (`tee -a`); no rotation. |
| D8 | LOW | **`rsync --delete data/`** mirrors `data/` into the standalone dir; any runtime-generated/uploaded files under the destination `data/` are removed on each deploy. Confirm `data/` is build-time-only before keeping `--delete` there. |

**Recommended fix shape for D1:** build into a dedicated output that does not collide with the IxStats `.next` — e.g. build in a temp/worktree dir, or set a distinct `distDir`/use `next build` with an output copy and restore the IxStats `.next` afterward. Simplest robust option: do the IxWorld build in a throwaway checkout/worktree so the IxStats working tree `.next` is never touched.

### 2. Backend / Database / API Performance

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| B1 | **HIGH** | **Missing `target` index on `AuditLog`.** Model has `@@index` on `userId`, `action`, `timestamp`, `success` but **none on `target`**. The autosave-stats query filters `where: { target, action: { startsWith } } orderBy timestamp` → full scan. | `prisma/schema/core.prisma:460`; query in `routers/autosaveHistory.ts` |
| B2 | **HIGH** | **Unbounded query + 4× in-memory scans.** `getAutosaveStats` does `findMany` with no `take`, then `.filter()` 4+ times for counts. Replace with `groupBy`/`_count`. | `routers/autosaveHistory.ts` (~103–127) |
| B3 | MEDIUM | **N+1 mission creation.** Cultural-exchange creation maps embassies to individual `embassyMission.create()` inside `Promise.all`. Replace with `createMany`. | `routers/diplomacy/cultural.ts:379–421`; mirror at `diplomatic.ts` ~942–992 |
| B4 | MEDIUM | **Over-fetching in `countries.getAll`.** Selects ~28 fields incl. large JSON (`centroid`, `boundingBox`) for list views. Split into lightweight list vs. detail selects. | `routers/countries/list.ts` (~75–124) |
| B5 | MEDIUM | **Sequential wiki fallbacks.** `await ixwiki ?? await iiwiki` serializes a slow/down primary into added latency. Use `Promise.allSettled` / race-with-fallback. | `routers/countries/wiki.ts` (~270, 298) |
| B6 | MEDIUM | **669 `console.log` calls across routers**, several in hot user-facing mutations (`establishEmbassy`, `createCulturalExchange`, `completeMission`). Guard behind dev flag or structured logger. | `routers/diplomatic.ts` et al. |
| B7 | LOW | **Missing `select` on several `findMany`/`findUnique`** returning full 30-field models (e.g. `embassy.findMany`). | `routers/diplomatic.ts` (multiple) |
| B8 | LOW | **In-memory sort of merged feeds** (ActivityFeed + ThinkpagesPost + forum) after capped fetch. Acceptable at current cap (≤150) but watch as sources grow. | `routers/activities.ts` (~516, 864) |

> Note: the agent also suggested composite indexes on `DiplomaticRelation`/`DiplomaticEvent`. These are lower-confidence — to be validated against actual `where` clauses before adding (avoid speculative indexes that slow writes).

### 3. Frontend Performance

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| F1 | **HIGH** | **Polling without `refetchOnWindowFocus: false`** at 15s/30s intervals → refetch storms incl. backgrounded tabs. | `app/mycountry/intelligence/_components/SecureCommunications.tsx` (~212, 272) |
| F2 | HIGH | **`countries.getAll` fetched unfiltered client-side** with 5-min staleTime (refetches on every dashboard return). Pair with B4; add pagination + longer staleTime. | `app/_components/EnhancedCommandCenter.tsx` (~1236) |
| F3 | MEDIUM | **Heavy libs imported at module top** (Recharts in `bot-monitoring.tsx`; check map/editor libs) — should be `next/dynamic` with `ssr:false`. | `app/_components/bot-monitoring.tsx` |
| F4 | MEDIUM | **Chart transforms computed in render** (4 `.map()`s un-memoized) on a 2,544-line page that re-renders on every filter/tab change. | `app/admin/military-equipment/page.tsx` (~2194–2228) |
| F5 | MEDIUM | **Giant un-memoized client components** (`navigation.tsx` 1,589 LOC, `EnhancedCommandCenter` ~1,486, `PlatformActivityFeed` ~894, `MyCountryTabSystem` 3,048) with few `useCallback`/`memo`. | various |
| F6 | MEDIUM | **Frequent `setInterval` polling** (5s in `DataMonitoringCenter`, 1s clock in `SplashHero`) firing regardless of visibility/focus; no backoff. | `app/mycountry/components/DataMonitoringCenter.tsx` (~211), `splash/SplashHero.tsx` (~22) |
| F7 | LOW | **Raw `<img>` instead of `next/image`** for flags/showcase (no lazy/format optimization). | `SocialUserProfile.tsx` (~189), `splash/CountryShowcaseCard.tsx` (~106), others |
| F8 | LOW | **Query waterfall** — `getUserEngagement` waits on `activityIds` derived from `getGlobalFeed`. | `app/_components/PlatformActivityFeed.tsx` (~151–161) |
| F9 | LOW | **Deep provider nesting (8 levels)** in root layout — cascading re-renders. Lower priority; validate before flattening. | `app/layout.tsx` (~60–97) |

### 4. Dead / Bloated / Deprecated Code

**Confirmed, high-confidence:**
- **Backup/scratch files on disk** (gitignored but cluttering, ~23MB): `src/server/api/routers/geo.ts.bak` (270KB), `prisma/prod-backup-20251022-185213.db` (7.8MB), `prisma/prod-sync-copy.db` (7.8MB), `prisma/backups/*` (sqlite-legacy + snapshots), `scripts/geojson_fixed/icecaps.geojson.bak`.
- **Tracked SQLite db in git:** `prisma/prisma/dev.db` (odd nested path, almost certainly accidental — should be untracked/removed).
- **Unused dependencies:** `quansync` and `@lmstudio/sdk` — **0 imports** across `src`. Remove from `package.json`.
- **`TAX_SYSTEM_TEMP_DISABLED = true`** (`app/builder/constants.ts:4`) gates the entire tax builder subsystem. Decide: finish, formally remove, or document.

**Deprecated wrappers still in use:**
- `SimpleFlag.tsx` (`@deprecated → UnifiedCountryFlag`) — **18 consumers** to migrate.
- `hooks/useFlag.ts` (`@deprecated → useUnifiedFlags`), `ui/animated-number.tsx` (`→ NumberFlowDisplay`), `countries/_components/economy/utils.ts` (3 deprecated format wrappers → `lib/format-utils`), `lib/economic-data-templates.ts` (`→ economy-factory`), `lib/province-importer/parse-provinces.ts`.

**Duplication / consolidation candidates (needs usage audit before merging):**
- **9 flag-related lib files** (`unified-flag-service`, `flag-service`, `country-flag-service`, `wiki-commons-flag-service`, `server-flag-cache`, + color/debug/prefetch helpers). Likely consolidatable to the unified service + helpers.
- **7 intelligence hooks** (`useIntelligenceData`, `useUnifiedIntelligence`, `useOptimizedIntelligenceData`, `useRealTimeIntelligence`, `useWikiIntelligence`, `useIntelligenceMetrics`, `useIntelligenceWebSocket`) — overlapping responsibilities.
- **Duplicate intelligence type files:** `types/intelligence-unified.ts` (30 lines, re-export) vs `types/unified-intelligence.ts` (1,552 lines).

**Disabled subsystems / stubs (decide re-enable vs remove):**
- `app/mycountry/components/RealTimeDataService.tsx` & `hooks/useDataSync.ts` — multiple polling blocks "DISABLED to prevent infinite loops." Either re-enable with proper guards or delete.
- ~30+ `TODO`/`FIXME` stubs returning hardcoded values (`card-service.ts` diplomatic/military/social scores; `security-event-triggers.ts` democracy/corruption indices; `SecureCommunications.tsx` "implement actual encryption").

**Large static-data files** (consider moving to `data/` or DB per the hardcoded-data migration goal): `lib/demo-seed/seed-fallbacks.ts` (4,157 LOC, ~4 imports), `lib/small-arms-equipment.ts` (3,432), `lib/atomic-government-data.ts` (2,326), `lib/military-equipment-extended.ts` (1,837).

### 5. Overall Health Summary

Architecturally the codebase is in good shape: clear modular-monolith layering (lib → hooks → components → orchestration), strong TypeScript coverage, sensible router domain grouping. The debt is concentrated in: (a) **deploy/build hygiene** (the clobbering bug is the single most impactful issue), (b) **a handful of unindexed/unbounded DB queries**, (c) **polling/memoization hot spots on the client**, and (d) **accumulated duplication** in the flag + intelligence subsystems plus deprecated wrappers that were never fully migrated. None are systemic; all are addressable incrementally.

---

## PART 2 — REMEDIATION PLAN (phased)

### Phase 0 — Report delivery
Write the above as a committed doc at `docs/audits/AUDIT_2026-06.md` (new) so findings are tracked. No behavior change.

### Phase 1 — Deploy script hardening (priority #1)
File: `scripts/deploy-ixworld.sh` (+ `ecosystem.ixworld.config.cjs`).
1. **Fix D1 (clobbering):** isolate the IxWorld build from the IxStats `.next`. Preferred: build inside a temporary git worktree/checkout of the repo, or save/restore `.next` around the build. Verify IxStats prod `.next` is byte-identical before/after a dry run.
2. **D2/D3:** replace `pm2 delete`+`start` with `pm2 reload` (or `startOrReload`); rsync into a timestamped dir + atomic symlink swap to enable rollback; keep the previous release dir.
3. **D4:** add a post-deploy HTTP health probe (curl loop against `http://localhost:3002/maps`, fail the deploy + auto-rollback on non-200).
4. **D5:** drop `wait_ready:true`/`listen_timeout` for `ixworld` unless `server.js` is patched to emit `ready`.
5. **D6:** switch to `flock` (or PID-liveness lockfile). **D7:** add log rotation/truncation. **D8:** re-confirm `data/ --delete` safety; drop `--delete` there if runtime files live in it.
6. Update the header comment to match real behavior.

### Phase 2 — DB/backend quick wins (low-risk, high-value)
1. Add `@@index([target, action])` (and likely `[target, action, timestamp]`) to `AuditLog` in `prisma/schema/core.prisma`; create migration (B1).
2. Rewrite `getAutosaveStats` to use `groupBy`/`_count` instead of unbounded `findMany` + JS filters (B2).
3. Convert cultural-exchange mission loop to `createMany` (B3).
4. Tighten `countries.getAll` select to a lightweight list set; add a detail endpoint/path for the heavy fields (B4, pairs with F2).
5. Parallelize wiki fallbacks with `Promise.allSettled` (B5).
6. Strip/guard hot-path `console.log`s (B6) — start with the diplomatic mutations.

### Phase 3 — Frontend perf
1. Add `refetchOnWindowFocus:false` + sane `staleTime` to the polling queries; consider SSE/WebSocket for SecureCommunications (F1).
2. Paginate + cache `countries.getAll` consumers; raise staleTime (F2, with B4).
3. `next/dynamic` for Recharts/heavy admin widgets (F3).
4. `useMemo` the military-equipment chart transforms; extract memoized list-item subcomponents (F4).
5. Add `memo`/`useCallback` to the worst giant components; gate `setInterval` pollers on visibility/focus with backoff (F5, F6).
6. Migrate raw `<img>` → `next/image` in the high-traffic spots (F7). Defer F8/F9 (validate first).

### Phase 4 — Dead/bloated cleanup
1. Delete on-disk scratch: `geo.ts.bak`, `*.db` backups, `prisma/backups/*`, `geojson_fixed/*.bak`; `git rm --cached prisma/prisma/dev.db` and gitignore it.
2. Remove `quansync` + `@lmstudio/sdk` from `package.json`; reinstall lockfile.
3. Migrate the 18 `SimpleFlag` consumers + other deprecated wrappers (`useFlag`, `animated-number`, economy `utils.ts`, etc.) to their replacements; delete the wrappers.
4. Resolve `TAX_SYSTEM_TEMP_DISABLED` and the `RealTimeDataService`/`useDataSync` disabled blocks (re-enable-with-guards or remove) — **needs a product decision per item**.

### Phase 5 — Larger refactors (full remediation)
1. Consolidate the 9 flag-lib files → unified service + thin helpers; usage-audit first.
2. Consolidate the 7 intelligence hooks; merge `intelligence-unified.ts` into `unified-intelligence.ts`.
3. Split the largest components (`MyCountryTabSystem` 3,048, `navigation` 1,589, `military-equipment/page` 2,544) per the modular-architecture standard in CLAUDE.md.
4. Move large static-data files toward `data/`/DB; resolve the ~30 hardcoded-value TODO stubs.

### Verification
- **Deploy script:** dry-run in a scratch dir; assert IxStats `.next` unchanged (checksum before/after); confirm `curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/maps` returns 200 post-deploy; intentionally break the build and confirm rollback restores the prior release; confirm IxStats prod (`/projects/ixstates`) still serves correctly after an IxWorld deploy. **Do not run the real deploy without explicit go-ahead** — it touches live prod.
- **DB changes:** apply migration on dev, run `bun run typecheck:server` + `bun run typecheck:db`; spot-check autosave-stats and cultural-exchange endpoints; (optionally) `EXPLAIN` the autosave query to confirm index use.
- **Frontend:** `bun run dev`, exercise MyCountry/admin pages, watch the Network tab for the eliminated refetch storms; React DevTools profiler on the memoized components.
- **Cleanup:** `bun run lint` + split typechecks (`typecheck:ui`/`:server`/`:trpc`/`:db`) after each phase. **Never run global `tsc --noEmit`/`typecheck:full`** (crashes the 7.2GB server).
- Work on `v2`; one focused commit per phase.
