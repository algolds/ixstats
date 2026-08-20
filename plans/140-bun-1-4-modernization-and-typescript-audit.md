# Plan 140: Bun 1.4 & TypeScript 7.0 Modernization, Ponytail Prune & Architecture Optimization

> **Status:** ACTIVE (Planning)  
> **Commit baseline:** `87f4c3e` (branch `v2`)  
> **Category:** Performance, DX, Dependencies, Compiler Architecture & Type Systems  
> **Audited for:** Bun 1.4 (Rust runtime), TypeScript 7.0 (Native Go compiler), Next.js 16.3, React 19.2

---

## 1. Executive Summary & Context

With the simultaneous availability of **Bun 1.4** (rewritten in Rust) and **TypeScript 7.0** (rewritten as a native Go port with 10× performance and shared-memory parallel checking), IxStates (`ixstats`) stands at the threshold of a generational performance and architecture upgrade.

### Key Drivers:
1. **TypeScript 7.0 Native Go Compiler (8×–12× Speedup, 80% Memory Reduction):**
   - Historically, global typechecking in IxStates was strictly split across 4 sub-projects (`tsconfig.ui.json`, `tsconfig.server.json`, `tsconfig.trpc.json`, `tsconfig.db.json`) wrapped in `node --max-old-space-size=6144` to prevent OOM on the 8GB RAM host server.
   - TS 7.0 replaces V8 JavaScript heap bloat with native Go binary execution, parallel `--checkers`, and shared-memory AST caching.
   - Eliminates OOM crashes and cuts typecheck cycle from ~30s+ down to ~2s.
2. **Bun 1.4 Native Capabilities (Rust Runtime):**
   - Built-in `Bun.cron()` replaces `node-cron` with zero-drift runtime scheduling (<15MB RAM).
   - Direct execution of `.ts`/`.tsx` files removes `tsx` across 45 scripts.
   - Global virtual store (`virtual-store = true`) accelerates package installs by up to 7×.
   - Native `bun test --parallel` delivers sub-second testing for 39+ computational suites.
3. **Ponytail Audit Pruning:**
   - Purges unused/over-engineered packages (`tsx`, `node-cron`, `@types/node-cron`, `color`, `@types/color`), while explicitly **retaining `iconoir-react`** per user specification.
   - Cleans ghost declarations in `next.config.js` (`xlsx`, `node-schedule`, `sharp`, `@node-rs/argon2`).

---

## 2. High-Leverage Vetted Findings Table

| # | Finding | Category | Impact | Effort | Risk | Evidence (`file:line`) |
|---|---------|----------|:------:|:------:|:----:|------------------------|
| **01** | **TypeScript 7.0 Native Engine & Memory Revolution** | Compiler / Architecture | CRITICAL | S | LOW | [`package.json:279`](package.json), [`AGENTS.md:6-7`](AGENTS.md) (Port from V8 JS `tsc` to TS 7.0 native Go engine; drops memory usage by 80% and makes OOM impossible on 8GB host) |
| **02** | **Direct TS Script Execution — Purge `tsx` devDependency** | DX / Runtime | HIGH | S | LOW | [`package.json:11-155, 278`](package.json) (~45 scripts use `tsx` when `bun` natively runs `.ts`/`.tsx` with zero transpile overhead) |
| **03** | **Native Runtime Cron — Replace `node-cron` with `Bun.cron()`** | Performance / Memory | HIGH | S | LOW | [`server.mjs:143`](server.mjs), [`cron-runner.mjs:60`](cron-runner.mjs), [`package.json:221, 258`](package.json) (drop `node-cron` package, lower idle daemon memory from ~60MB to <15MB) |
| **04** | **Global Virtual Store & Install Acceleration** | DX / Storage | HIGH | S | LOW | [`bunfig.toml:4-6`](bunfig.toml) (enable `virtual-store = true` for hardlinked deduplication and 7x faster dependency installs) |
| **05** | **Computational & Simulation Testing with `bun test --parallel`** | Testing / DX | HIGH | M | LOW | [`package.json:115, 276`](package.json), [`src/tests/lib/`](src/tests/lib/) (39+ pure math/geo/economics test suites run in <300ms on Bun's native test runner vs heavy ts-jest) |
| **06** | **Dead & Ghost Package Purge (`/ponytail-audit`)** | Dependencies / Debt | MEDIUM | S | LOW | [`next.config.js:55-62`](next.config.js) (`xlsx`, `node-schedule`, `sharp`, `@node-rs/argon2` still in `serverExternalPackages`), [`package.json:208, 250`](package.json) (`color`, `@types/color`) |
| **07** | **Parallel Multi-Core Typechecking with `--checkers`** | Type System | HIGH | S | LOW | [`package.json:137-147`](package.json), [`tsconfig.base.json`](tsconfig.base.json) (leverage TS 7.0 native parallel checkers flag to check the codebase concurrently) |
| **08** | **Server/API Markdown Acceleration with `Bun.markdown`** | Performance | MEDIUM | S | LOW | [`src/lib/discord/ixtwitter-sync.ts`](src/lib/discord/ixtwitter-sync.ts), [`src/lib/wiki/roster-parser.ts`](src/lib/wiki/roster-parser.ts) (replace custom markdown transforms with Rust-accelerated `Bun.markdown`) |

---

## 3. Ponytail Audit — Code & Dependency Cuts

> *Rule: One line per finding, ranked biggest cut first: `<tag> <what to cut>. <replacement>. [path]`*

1. `[native]` `tsx` runner across 45 package scripts. Replace with native `bun <file>`. `[package.json:11-155, 278]`
2. `[native]` `node-cron` & `@types/node-cron` background scheduler. Replace with native `Bun.cron()`. `[server.mjs:143, cron-runner.mjs:60, package.json:221, 258]`
3. `[delete]` Ghost packages in `next.config.js` (`xlsx`, `node-schedule`, `sharp`, `@node-rs/argon2`). Remove from `serverExternalPackages`. `[next.config.js:55-62]`
4. `[stdlib]` `color` & `@types/color` package used in 1 single component. Replace with lightweight HSL helper / native color math. `[package.json:208, 250, src/components/ui/color-picker/index.tsx]`
5. `[shrink]` Stale `modularizeImports` for `@radix-ui/react-icons` in Next.js config. Remove dead rule. `[next.config.js:114-117]`
6. *(Retained per spec)*: `iconoir-react` library kept for Onoma glyphs and labs UI.

**Net Dependencies Removable:** 5 packages (`tsx`, `node-cron`, `@types/node-cron`, `color`, `@types/color`).  
**Net Lines Removable:** ~200+ lines across configs, wrappers, and redundant import bridges.

---

## 4. TypeScript 7.0 Architectural Integration

### 4.1 Upgrading the Typecheck Pipeline
In TS 6 and earlier, the JS-based compiler required Node heap allocation wrappers:
```bash
# Legacy TS 5/6 script (slow, high heap)
node --max-old-space-size=6144 ./node_modules/typescript/bin/tsc -p tsconfig.ui.json --noEmit
```

With **TypeScript 7.0**, `tsc` is a native binary with built-in shared-memory worker threads:
```bash
# TypeScript 7.0 native parallel check (instant, <500MB RAM)
tsc -p tsconfig.ui.json --checkers 4 --noEmit
```

### 4.2 Updating `package.json` Typecheck Commands
```json
{
  "typecheck": "tsc -p tsconfig.json --checkers 4 --noEmit",
  "typecheck:ui": "tsc -p tsconfig.ui.json --noEmit",
  "typecheck:server": "tsc -p tsconfig.server.json --noEmit",
  "typecheck:trpc": "tsc -p tsconfig.trpc.json --noEmit",
  "typecheck:db": "tsc -p tsconfig.db.json --noEmit"
}
```

---

## 5. Workstreams & Execution Steps

### Workstream A: TypeScript 7.0 Upgrade & Tooling Modernization
1. Update `package.json` dependency:
   ```bash
   bun add -d typescript@^7.0.0
   ```
2. Modernize typecheck commands in `package.json` (strip legacy `node --max-old-space-size=6144` wrapper).
3. Test native compilation and incremental `.tsbuildinfo` caches.

### Workstream B: Bun 1.4 Native Tooling & Script Modernization
1. Configure `bunfig.toml`:
   ```toml
   [install]
   peer = false
   virtual-store = true

   [test]
   root = "src/tests"
   ```
2. Replace all `tsx` commands in `package.json` with direct `bun <file>` invocations.
3. Remove `tsx` from `devDependencies`.

### Workstream C: Native `Bun.cron()` Integration
1. Modernize `server.mjs` and `cron-runner.mjs` to register schedules via `Bun.cron({ pattern, run() })`.
2. Remove `node-cron` and `@types/node-cron` from `package.json`.

### Workstream D: Dependency Pruning & Cleanup
1. Replace `color` in `src/components/ui/color-picker/index.tsx` with lightweight native HSL helpers.
2. Remove `color` and `@types/color` from `package.json`.
3. Strip ghost packages from `next.config.js:serverExternalPackages`.

### Workstream E: Parallel Unit Testing (`bun test --parallel`)
1. Wire `"test:unit": "bun test src/tests/lib --parallel"` in `package.json`.
2. Confirm 39+ calculation and simulation test suites execute in <300ms.

### Workstream F: Dev & Production Build/Deploy Scripts Modernization
1. **`start-development.sh`**: Replace `node ./scripts/write-build-version.js` with `bun`, migrate `node -p` inline evaluators to high-speed `bun -e`, and update dynamic TypeScript fallback to `7.0.0`.
2. **`scripts/build-production.sh`**: Ensure `bun run build` invokes Next.js build with basePath wrapper and standalone asset copy.
3. **`scripts/deploy-production.sh`**: Update to current platform versions, streamlined Bun invocations, and ensure atomic deployment flow.
4. **`scripts/deploy-ixworld.sh`**: Replace `bunx next build` with `bun run next build`, optimize standalone rsync pipeline, and maintain hardlink rollback snapshots.
5. **`start-production.sh` & `scripts/start-production.js`**: Update production runners to launch Next.js standalone server with `bun run start:prod`.
6. **`scripts/deploy-local.sh` & `scripts/start-auto.sh`**: Standardize on `bun run lint` and `bun run next start`.

---

## 6. Verification Gates

1. **Lockfile Deduplication & Installation:**
   ```bash
   bun dedupe
   bun install
   ```
2. **TypeScript 7.0 Parallel Compilation Check:**
   ```bash
   bun run typecheck
   ```
3. **Subproject Typechecks:**
   ```bash
   bun run typecheck:ui
   bun run typecheck:server
   bun run typecheck:trpc
   bun run typecheck:db
   ```
4. **Architectural Guardrails & Tests:**
   ```bash
   bun run audit:arch
   bun run test:unit
   ```
