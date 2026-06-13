# Prevent TypeScript Graph Explosion + Stabilize Dev Performance

Establish proper TypeScript compilation boundaries, isolate backend modules from the client-side UI, and resolve circular import paths that lead to tsserver memory bloat (>7GB RAM) and WSL/dev server instability.

## User Review Required

> [!IMPORTANT]
> - **Modular TS Configs**: We will recreate `tsconfig.base.json`, `tsconfig.ui.json`, `tsconfig.server.json`, `tsconfig.trpc.json`, and `tsconfig.db.json` to enable split typechecking.
> - **Forum Module Location**: As approved during the grill-me session, `src/modules/forum` will be relocated to `src/server/modules/forum`.
> - **Client-Server Separation**: Pure UI formatting utilities (like `RARITY_INLINE_COLORS`, `rarityRank`, etc.) currently in `src/modules/forum/lib/forum-widget-utils` will be moved to `src/shared/forum-utils.ts` to sever the dependency chain between client UI components and server-side XenForo API integration.

## Proposed Changes

### TypeScript Configuration & Dev Performance
Recreate modular compiler configurations and update the root compiler options for incremental caching.

#### [MODIFY] [tsconfig.json](file:///home/jxsig/projects/ixstats/tsconfig.json)
- Set `"incremental": true`.
- Set `"tsBuildInfoFile": ".next/cache/tsbuildinfo"`.
- Ensure standard performance flags are maintained.

#### [NEW] [tsconfig.base.json](file:///home/jxsig/projects/ixstats/tsconfig.base.json)
- Define base TypeScript compiler options shared by all sub-projects.

#### [NEW] [tsconfig.ui.json](file:///home/jxsig/projects/ixstats/tsconfig.ui.json)
- Scope type checking specifically to frontend files (`src/app`, `src/components`, `src/hooks`, `src/types`).
- Exclude `src/server`.

#### [NEW] [tsconfig.server.json](file:///home/jxsig/projects/ixstats/tsconfig.server.json)
- Scope type checking specifically to backend files (`src/server`, `src/lib`).
- Exclude Next.js frontend pages and components to avoid loading heavy React DOM types into server checks.

#### [NEW] [tsconfig.trpc.json](file:///home/jxsig/projects/ixstats/tsconfig.trpc.json)
- Scope to tRPC endpoints (`src/trpc`).

#### [NEW] [tsconfig.db.json](file:///home/jxsig/projects/ixstats/tsconfig.db.json)
- Scope to Prisma client and server-side db connections (`src/db`, `src/server/db.ts`).

---

### Shared UI Layer Utilities
Separate client formatting utilities from server-side modules to eliminate barrel export dependency webs.

#### [NEW] [forum-utils.ts](file:///home/jxsig/projects/ixstats/src/shared/forum-utils.ts)
- Relocate pure client UI formatting utilities from `src/modules/forum/lib/forum-widget-utils.ts`.

#### [MODIFY] [route.ts](file:///home/jxsig/projects/ixstats/src/app/api/forum/user-cards/route.ts)
- Update import path from `~/modules/forum` to `~/shared/forum-utils`.

#### [MODIFY] [page.tsx](file:///home/jxsig/projects/ixstats/src/app/(widget)/forum/cards/[username]/page.tsx)
- Update import path to `~/shared/forum-utils`.

#### [MODIFY] [page.tsx](file:///home/jxsig/projects/ixstats/src/app/(widget)/forum/cards/[username]/profile/page.tsx)
- Update import path to `~/shared/forum-utils`.

#### [MODIFY] [ForumRarityBar.tsx](file:///home/jxsig/projects/ixstats/src/app/(widget)/forum/cards/[username]/ForumRarityBar.tsx)
- Update import path to `~/shared/forum-utils`.

#### [MODIFY] [page.tsx](file:///home/jxsig/projects/ixstats/src/app/(widget)/forum/cards/[username]/embed/page.tsx)
- Update import path to `~/shared/forum-utils`.

#### [MODIFY] [ForumMiniCard.tsx](file:///home/jxsig/projects/ixstats/src/app/(widget)/forum/cards/[username]/ForumMiniCard.tsx)
- Update import path to `~/shared/forum-utils`.

---

### Backend Forum Module Relocation
Relocate backend logic under `src/server/modules/forum` and remove the client formatting utilities from the server module's barrel export.

#### [DELETE] [forum](file:///home/jxsig/projects/ixstats/src/modules/forum)
- Relocate all files within `src/modules/forum` to the new directory.

#### [NEW] [forum](file:///home/jxsig/projects/ixstats/src/server/modules/forum)
- Relocate and adapt `index.ts`, `services/`, and `lib/` files.
- Remove `forum-widget-utils.ts` and its barrel exports from the main barrel file.

#### [MODIFY] [cards.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/cards.ts)
- Update import path from `~/modules/forum` to `~/server/modules/forum`.

#### [MODIFY] [wiki.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/wiki.ts)
- Update import path to `~/server/modules/forum`.

#### [MODIFY] [ixnayid.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/ixnayid.ts)
- Update import path to `~/server/modules/forum`.

#### [MODIFY] [trading.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/trading.ts)
- Update import path to `~/server/modules/forum`.

#### [MODIFY] [forum.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/forum.ts)
- Update import path to `~/server/modules/forum`.

#### [MODIFY] [trending.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/activities/trending.ts)
- Update import path to `~/server/modules/forum`.

#### [MODIFY] [feed.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/activities/feed.ts)
- Update import path to `~/server/modules/forum`.

#### [MODIFY] [card-packs.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/card-packs.ts)
- Update import path to `~/server/modules/forum`.

#### [MODIFY] [forum-bridge.ts](file:///home/jxsig/projects/ixstats/src/server/bridges/forum-bridge.ts)
- Update import path to `~/server/modules/forum`.

#### [MODIFY] [vault-service.ts](file:///home/jxsig/projects/ixstats/src/lib/vault-service.ts)
- Update import path to `~/server/modules/forum`.

## Verification Plan

### Automated Tests
- Validate incremental compiler compilation by running Next.js build:
  ```bash
  bun run build
  ```
- Run ESLint to verify that imports are resolved correctly and there are no broken modules:
  ```bash
  bun run lint
  ```

### Manual Verification
- Confirm that typecheck scripts in `package.json` (such as `bun run typecheck:ui` and `bun run typecheck:server`) pass successfully once the split config files are recreated.
