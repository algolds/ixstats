# TypeScript Architecture & Compilation Isolation

**Tooling**: TypeScript 7.0.2 · Bun 1.4 Runtime · ts-morph AST Engine  
**Enforcement**: `scripts/audit/audit-arch.ts` (`bun run audit:arch`)  
**Configs**: `tsconfig.json`, `tsconfig.base.json`, `tsconfig.ui.json`, `tsconfig.server.json`, `tsconfig.trpc.json`, `tsconfig.db.json`

---

## 1. Problem Statement & TypeScript 7.0 Resolution

Historically, in TypeScript 5/6 (JavaScript V8 engine), unconstrained imports between server routers, database queries, and client UI components created an unpartitioned type graph consuming >7GB RAM and causing server OOM crashes.

With **TypeScript 7.0**, the compiler was rewritten as a native Go binary with shared-memory parallel AST processing. This slashes baseline memory by ~80% (<500MB RAM) and enables instant multi-core verification while preserving sub-project configurations for editor caching.

---

## 2. Partitioned Typecheck Sub-Projects

Compilation sub-projects keep boundaries modular across the codebase:

```
┌─────────────────────────────────────────────────────────────┐
│                    PARTITIONED TYPECHECKS                   │
├────────────────────┬────────────────────┬───────────────────┤
│ `typecheck:ui`     │ tsconfig.ui.json   │ Native Go Thread  │
│ `typecheck:server` │ tsconfig.server.json│ Native Go Thread │
│ `typecheck:trpc`   │ tsconfig.trpc.json │ Native Go Thread  │
│ `typecheck:db`     │ tsconfig.db.json   │ Native Go Thread  │
└────────────────────┴────────────────────┴───────────────────┘
```

### Compiler Optimization Directives (`tsconfig.base.json`):
- **`types: ["node"]`**: Only `@types/node` is included automatically, instead of every `@types/*` package in node_modules.
- **`isolatedModules: true`** + **`verbatimModuleSyntax: true`**: Guarantees safe per-file transpilation by SWC/Turbopack.
- **`noEmit: true`**, **`skipLibCheck: true`**, **`assumeChangesOnlyAffectDirectDependencies: true`**: Typecheck-only, incremental-friendly settings.
- **`exclude: ["**/.*", "scripts", "docs", ...]`** (in each sub-project tsconfig): Prevents the compiler from traversing hidden directories (`.git`, `.env`) and non-app trees.

---

## 3. Architecture Guard Rules (`scripts/audit/audit-arch.ts`)

The architecture guard runs in CI (`.github/workflows/ci.yml`, alongside `typecheck:ui`, `typecheck:server` and `typecheck:trpc`) to enforce modular boundaries. There is no repo-managed pre-commit hook.

```bash
# Run architecture guard verification
bun run audit:arch
```

### The Three Enforced Invariants:
1. **File Size Ceiling**:
   - Files under `src/server/api/routers`, `src/types`, `src/app`, `src/components` and `src/lib` must stay under 700 lines; `src/hooks` under 500. Designated data/type tables in `src/types` are relaxed to 900.
2. **Zero Cross-Router Imports**:
   - Sub-routers in `src/server/api/routers/<DomainA>/` are strictly forbidden from importing directly from `src/server/api/routers/<DomainB>/`.
   - Cross-domain server utilities must reside under `src/server/shared/` (e.g. `layer-cache.ts`, `country-authorization.ts`). A small allow-list of known, not-yet-fixed cross-router imports lives in the script.
3. **Ratchet Baseline (`scripts/audit/arch-baseline.json`)**:
   - Existing legacy files are recorded at their exact line counts. Lines may only decrease; any code additions that expand a file above the ceiling fail the build.

---

## 4. How to Split an Oversized Router (AST Recipe)

When a router approaches the 700-line ceiling, split it into domain sub-files using `scripts/split-router-template.ts`:

```bash
bun run scripts/split-router-template.ts \
  --routerFile="src/server/api/routers/myDomain.ts" \
  --outDir="src/server/api/routers/myDomain" \
  --varName="myDomainRouter" \
  --groups='{read:["getFoo","getBar"],mutate:["createX","updateY"]}' \
  --pattern="mergeRouters"
```

### Verification Steps:
1. Verify sub-routers compile into directory `index.ts` using `mergeRouters`.
2. Delete the original monolith file.
3. Run `bun run audit:arch` (and `bun run audit:arch:update` to ratchet the baseline down).
4. Run `bun run typecheck:server` to confirm 0 type errors.
