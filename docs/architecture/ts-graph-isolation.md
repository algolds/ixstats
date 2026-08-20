# TypeScript Architecture & Compilation Isolation

**Tooling**: TypeScript 5.9.3 · Bun Runtime · ts-morph AST Engine  
**Enforcement**: `scripts/audit/audit-arch.ts` (`bun run audit:arch`)  
**Configs**: `tsconfig.json`, `tsconfig.base.json`, `tsconfig.ui.json`, `tsconfig.server.json`, `tsconfig.trpc.json`, `tsconfig.db.json`

---

## 1. Problem Statement: The 7GB RAM Graph Explosion

In monolithic Next.js codebases, unconstrained imports between server routers, database queries, and client UI components create an unpartitioned type graph. Under global `tsc --noEmit`, TypeScript attempts to hold all 2,000+ files and their recursive `@types/*` packages simultaneously in memory, causing node heap exhaustion (>7GB RAM) and server OOM crashes on 8GB host servers.

---

## 2. Partitioned Typecheck Sub-Projects

To guarantee sub-10s verification without memory exhaustion, compilation is partitioned into isolated sub-projects with bounded heap memory:

```
┌─────────────────────────────────────────────────────────────┐
│                    PARTITIONED TYPECHECKS                   │
├────────────────────┬────────────────────┬───────────────────┤
│ `typecheck:ui`     │ tsconfig.ui.json   │ 6144MB Old-Space  │
│ `typecheck:server` │ tsconfig.server.json│ 4096MB Old-Space  │
│ `typecheck:trpc`   │ tsconfig.trpc.json │ 4096MB Old-Space  │
│ `typecheck:db`     │ tsconfig.db.json   │ 4096MB Old-Space  │
└────────────────────┴────────────────────┴───────────────────┘
```

### Compiler Optimization Directives (`tsconfig.base.json`):
- **`types: []`**: Blocks automatic inclusion of all node_modules `@types/*` packages, reducing the compilation file graph by 70%.
- **`isolatedModules: true`**: Guarantees safe per-file transpilation by SWC/Turbopack.
- **`importHelpers: true` + `tslib`**: Emits shared runtime helpers to minimize bundle footprints.
- **`exclude: ["**/.*"]`**: Prevents the compiler from traversing hidden directories (`.git`, `.env`).

---

## 3. Architecture Guard Rules (`scripts/audit/audit-arch.ts`)

The architecture guard runs in CI and pre-commit hooks to enforce modular boundaries:

```bash
# Run architecture guard verification
bun run audit:arch
```

### The Three Enforced Invariants:
1. **File Size Ceiling (≤700 Lines)**:
   - Every file under `src/server/api/routers/**` and `src/types/**` must remain under 700 lines (relaxed to 900 lines for designated data/type tables).
2. **Zero Cross-Router Imports**:
   - Sub-routers in `src/server/api/routers/<DomainA>/` are strictly forbidden from importing directly from `src/server/api/routers/<DomainB>/`.
   - Cross-domain server utilities must reside under `src/server/shared/` (e.g. `layer-cache.ts`, `trpc-cache.ts`).
3. **Ratchet Baseline (`arch-baseline.json`)**:
   - Existing legacy files are recorded at their exact line counts. Lines may only decrease; any code additions that expand a file above the ceiling fail the build.

---

## 4. How to Split an Oversized Router (AST Recipe)

When a router approaches the 700-line ceiling, split it into domain sub-files using `scripts/split-router-template.ts`:

```bash
bun run scripts/split-router-template.ts \
  --routerFile="src/server/api/routers/myDomain.ts" \
  --groups='{"crud": ["get*", "create*", "update*"], "admin": ["archive*", "purge*"]}' \
  --pattern=mergeRouters
```

### Verification Steps:
1. Verify sub-routers compile into directory `index.ts` using `mergeRouters`.
2. Delete the original monolith file.
3. Run `bun run audit:arch` to confirm the file count and baseline decrease.
4. Run `bun run typecheck:server` to confirm 0 type errors.
