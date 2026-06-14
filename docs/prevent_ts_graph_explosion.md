# Prevent TypeScript Graph Explosion + Stabilize Dev Performance

**Status: ✅ Resolved (June 2026 — patch 1.0.6).** This document originally described a proposal; it has been fully implemented. See the **Current State** section below for the live status and the **Architecture guard** section for the ongoing enforcement mechanism.

---

## Problem (recap)

Establish proper TypeScript compilation boundaries, isolate backend modules from the client-side UI, and resolve circular import paths that lead to tsserver memory bloat (>7GB RAM) and WSL/dev server instability.

## Original proposal — APPROVED & IMPLEMENTED

> [!IMPORTANT] **Original user-review items — all completed:**
> - ✅ **Modular TS Configs**: `tsconfig.base.json`, `tsconfig.ui.json`, `tsconfig.server.json`, `tsconfig.trpc.json`, and `tsconfig.db.json` were created to enable split typechecking. `tsconfig.json` was updated with `"incremental": true` and `"tsBuildInfoFile": ".next/cache/tsbuildinfo"`.
> - ✅ **Forum Module Location**: `src/modules/forum` was relocated to `src/server/modules/forum`.
> - ✅ **Client-Server Separation**: Pure UI formatting utilities (`RARITY_INLINE_COLORS`, `rarityRank`, etc.) were moved to `src/shared/forum-utils.ts` to sever the dependency chain between client UI components and server-side XenForo API integration.

### Original implementation steps

#### TypeScript Configuration & Dev Performance
All five modular tsconfigs were created. The root `tsconfig.json` was updated with incremental caching.

#### Shared UI Layer Utilities
- ✅ `src/shared/forum-utils.ts` created with the 6 pure client formatting utilities
- ✅ All 6 client files updated to import from `~/shared/forum-utils` (route.ts, 4 page.tsx, ForumRarityBar.tsx, ForumMiniCard.tsx)

#### Backend Forum Module Relocation
- ✅ `src/modules/forum` deleted; all files relocated to `src/server/modules/forum`
- ✅ `src/server/modules/forum/index.ts` re-exports only the server-side procedure-bag (the `forum-widget-utils` re-exports were removed)
- ✅ 11 server-side files updated to import from `~/server/modules/forum` (cards, wiki, ixnayid, trading, forum, trending, feed, card-packs, forum-bridge, vault-service)

## Current State (post 1.0.6)

The original 3-pronged work (modular TS configs, client/server separation of forum-utils, backend forum module relocation) was the *first wave*. The **second wave** (June 2026 — patch 1.0.6) extended the architecture guard much further to prevent the same class of problem at the **router file level**:

| Metric | Before 1.0.6 | After 1.0.6 |
|---|---|---|
| tRPC routers | 83 | 87 |
| Procedures | 1,329 | 1,376 |
| Router files in `src/server/api/routers/` | 135 | 364 |
| Files over 700 lines ("god files") | ~50 | **17 (all ratcheted in baseline)** |
| Cross-router imports | 1 (`countries/*` → `geo/core`) | **0** |
| Dead type files | 1 (`unified-intelligence.ts`, 1,552 lines) | **0** |
| Subdir-organized routers | ~30 (pre-existing) | **52 (all via `mergeRouters`)** |

### Architecture guard (enforcement)

`scripts/audit/audit-arch.ts` (run via `bun run audit:arch`) enforces the following rules on every commit, with no exceptions other than the ratchet baseline:

1. **File-size ceiling.** Every file in `src/server/api/routers/**` and `src/types/**` must be ≤ **700 lines** (default) or ≤ **900 lines** (relaxed for files in `RELAXED_FILES`, currently `src/types/ixstats.ts` and `src/types/economy-builder.ts`).
2. **Ratchet baseline.** `scripts/audit/arch-baseline.json` records every current offender at its exact current line count. They may not grow — they may only shrink as splits land. New files must be under the ceiling.
3. **No cross-router imports.** No router in `routers/<A>/` may import from `routers/<B>/`. The one historical exception (`countries/*` → `geo/core`) was eliminated in 1.0.6 by extracting `clearLayerCache` / `layerCache` to the shared primitive `src/server/shared/layer-cache.ts`.

### How to split a new oversized router

Use the canonical splitter:

```bash
bun run scripts/split-router-template.ts \
  --routerFile="src/server/api/routers/foo.ts" \
  --outDir="src/server/api/routers/foo" \
  --varName="fooRouter" \
  --groups='{read:["getX","getY"],mutate:["createZ","updateW"]}' \
  --pattern="mergeRouters"
```

The template (see its 100+ line header comment) handles all the proven recipe steps:
- Static + dynamic relative-import pre-flight (the bug pattern that broke wikios, intel/core, intel/alerts, intel/analytics, geo/admin, geo/features, transport — all now fixed in the template)
- Copy-whole-file strategy (retains module-level helpers per group, `eslint --fix` trims unused)
- `mergeRouters` recombination in the new `index.ts` so every `api.<router>.<key>` path is byte-identical to the original — zero call-site changes
- Built-in AST parity verification (mandatory, no separate verifier script needed)
- Optional `--pattern=spread` mode for procedure-bag (object) routers like `countries/management/`

### How to run the guard

```bash
bun run audit:arch              # check (exit 1 on violation)
bun run audit:arch:update       # rewrite the size baseline (only after a split)
```

`bun run typecheck:trpc` is also part of the CI gate — it catches broken relative imports (the most common split bug) before they reach production.

## Verification Plan

### Automated Tests
- `bun run typecheck` validates the full typecheck graph (ui, server, trpc, db) — passes for all 4 sub-projects with `--max-old-space-size=6144`/`4096` heap bounds to avoid OOM on 8GB servers
- `bun run lint` runs ESLint
- `bun run audit:arch` enforces the architecture guard
- `bun run scripts/verify-router-splits.ts` AST-parity verifies the 4 pre-existing split routers (admin, sports, activities, security)

### Manual Verification
- All `bun run typecheck:*` sub-project scripts pass
- `bun run audit:arch` is green (17 ratcheted files, 0 new offenders, 0 cross-router imports)
- Per-router procedure counts match the canonical baseline (1376 total)
