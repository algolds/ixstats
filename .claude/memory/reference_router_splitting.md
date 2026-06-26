---
name: reference-router-splitting
description: Proven process + scripts for splitting large flat tRPC routers without changing api.* paths
metadata: 
  node_type: memory
  type: reference
  originSessionId: 459915d1-8042-4038-9617-e8a5c4c4f2b1
---

# Splitting a tRPC mega-router (behavior-preserving)

Goal: break a huge flat router into a `src/server/api/routers/<name>/` directory, recombined with
`mergeRouters`, so **every `api.<name>.*` path is unchanged** (zero call-site edits). Reduces tsserver
load (helps the [[vps-memory-audit-2026-06]] memory pressure) and improves maintainability.

**Why no call-site changes:** `root.ts` imports `./routers/<name>`; once the monolith `<name>.ts` is
deleted, that resolves to `<name>/index.ts`. `mergeRouters` keeps all procedures flat at the top level.
`mergeRouters` is exported from `src/server/api/trpc.ts` (added June 2026 = `t.mergeRouters`, tRPC 11.17).

## Process

1. **Scout first** (avoid wasting effort on dead code): a router is splittable only if it's *live + a
   single flat router* — registered in `root.ts`, exactly one `createTRPCRouter({...})`, non-zero
   `api.<key>.*` call sites. If unregistered / 0 call sites, it's an orphan → **delete it, don't split**
   (this is how `diplomatic.ts` 6,006 lines and `unified-intelligence.ts` 3,352 lines were handled).
2. **Generate** `scripts/split-<router>-ast.ts` from the template `scripts/split-thinkpages-ast.ts`
   (ts-morph). It copies the whole file once per domain group (keeping ALL imports + module-level
   helpers — "carry-all"), renames the router var to `<base><Group>Router`, and removes out-of-group
   procedures. REQUIRED guards: duplicate-assignment, not-found, **all-covered** (every PropertyAssignment
   in some group), and `assert sum(kept) === total`.
3. **Index**: write `<name>/index.ts` → `export const <name>Router = mergeRouters(<all sub-routers>)`.
4. **Verify** (don't trust grep): delete the monolith, run `scripts/verify-router-splits.ts` — AST parity
   = original procedure-key set === union across sub-files. **CRITICAL GOTCHA:** a `^  name: xProcedure`
   line-grep UNDERCOUNTS — `security` really had 41 procedures but grep saw only 11 (30 defined in forms
   grep misses). Always verify procedure parity at the **AST level**, not by grep counts.
5. **Clean**: `eslint --fix src/server/api/routers/<name>/` trims carry-all unused imports. Remaining
   `unused-imports/no-unused-vars` on helper consts are expected WARNINGS, not errors (and
   `next.config.js` has `ignoreBuildErrors: true`). Precedent: live `diplomacy/*.ts` ships the same way.

## Batch via Workflow

One agent per router (independent files → no conflict, no worktree needed; box concurrency cap = 2).
Give each agent the exact recipe + the thinkpages template, and require it to self-verify AST parity +
0 eslint errors before reporting. **Then re-verify yourself** with `scripts/verify-router-splits.ts` —
agent self-reports were confirmed but independent AST parity is the real gate.

## Constraints
- NEVER run a global typecheck on the box (crashes it). Validate via AST parity + `eslint` + (locally) `bun run typecheck:trpc`.
- Agents touch ONLY their own router files + `scripts/split-<x>-ast.ts`; never `root.ts`/`trpc.ts`/other routers.

## Done (June 2026)
thinkpages (55→5 files), admin (79→6), sports (44→6), activities (20→4), security (41→6). Scripts kept in
`scripts/`. Remaining flat routers all <~2,100 lines. Next candidates if needed: diplomaticScenarios (2,062),
wikios (1,882), vault (1,734) — approaching normal size, not urgent.
