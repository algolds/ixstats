# Plan 071: Verify the dashboard "no countries" + Alerts crash are stale-build, then redeploy

> **Executor instructions**: This is a **verification/ops** plan, not a code
> change. Do the checks, record results in `plans/README.md`. If a check fails
> (the bug is real in current source), STOP and report — a follow-up code plan is
> needed.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (ops / verification)
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

Two errors were captured from the **live production** browser console on
2026-06-16/17:

1. Dashboard "world data not showing countries":
   `TRPCClientError: No procedure found on path "countries.getTopCountriesByPopulation"`
2. Alerts panel crash (caught by an error boundary):
   `ReferenceError: messageUnreadCount is not defined`

Both refer to code that **already exists and is correct in the current `v2`
HEAD** — so the most likely cause is that production is running an older
`.next/standalone` build. If so, the fix is a **redeploy**, not a code change.
This plan confirms that before anyone spends code effort.

Context for the executor: production runs the Next.js standalone build from
`/ixwiki/public/projects/ixstats/.next/standalone/` (host `ixwiki`, app port
3550, base path `/projects/ixstats`). Per-user audit logs there only record
`success:true` events; the only error evidence was hand-saved console dumps in
`.next/standalone/public/data/*.log`.

## Current state (evidence the code is already correct in HEAD)

1. `src/server/api/routers/countries/list.ts:325` defines
   `getTopCountriesByPopulation` (alongside `getTopCountriesByGdpPerCapita` at
   line 302), and `src/server/api/routers/countries/index.ts:13` merges it flat
   via `...listProcedures`, so the tRPC path `countries.getTopCountriesByPopulation`
   resolves. The sibling call `countries.getTopCountriesByGdpPerCapita` did NOT
   error in the same prod log — consistent with the population procedure being
   added after the deployed build.
2. `messageUnreadCount` is defined at every use site in current source:
   - `src/app/_components/navigation.tsx:32` (`const { totalUnread: messageUnreadCount } = useMessageUnreadCount();`)
   - `src/components/DynamicIsland/NotificationsView.tsx:317`
   - `src/components/DynamicIsland/CompactView.tsx:139`
   - `src/components/navigation/NavigationBar.tsx` receives it as a typed prop.
   There is no use of the bare identifier without a definition in scope.

## Steps

### Step 1: Confirm the procedure exists and is registered (current checkout)

```
grep -n "getTopCountriesByPopulation" src/server/api/routers/countries/list.ts
grep -n "listProcedures" src/server/api/routers/countries/index.ts
```
**Expected**: the procedure is defined in `list.ts` and spread into the router in
`index.ts`. If missing → STOP (real bug; needs a code plan).

### Step 2: Confirm `messageUnreadCount` has no undefined reference

```
grep -rn "messageUnreadCount" src/ | grep -v "useMessageUnreadCount\|: number\|messageUnreadCount=\|messageUnreadCount}" 
```
Manually confirm every remaining hit is inside a scope where
`messageUnreadCount` is defined (via `useMessageUnreadCount()` destructure or a
prop). If you find a use with no definition in scope → STOP (real bug).

### Step 3: Compare deployed build to HEAD

On host `ixwiki`, determine what commit the running standalone build was built
from (e.g. check the build's `BUILD_ID` / git sha if recorded, or the mtime of
`.next/standalone/server.js` vs the `git log` date of `list.ts`). If the build
predates the commit that added `getTopCountriesByPopulation`, the diagnosis is
confirmed: **stale build**.

```
# read-only inspection only
ssh ixwiki 'cat /ixwiki/public/projects/ixstats/.next/BUILD_ID 2>/dev/null; ls -l /ixwiki/public/projects/ixstats/.next/standalone/server.js'
```

### Step 4: Redeploy (only when steps 1–3 confirm stale build)

Trigger the project's normal production build + restart (see repo `CLAUDE.md`:
`bun run build` then the production start; the maintainer owns the actual deploy
command and timing). **Do not deploy without the maintainer's go-ahead** — this
is outward-facing.

### Step 5: Verify in production after redeploy

- Load `/projects/ixstats` dashboard → the country lists (top by population)
  render with no `No procedure found` console error.
- Open the Alerts/notifications panel → no `messageUnreadCount is not defined`
  error boundary trip.

## Done criteria

- [ ] Steps 1–2 confirm the code is correct in HEAD (or a real bug is found and reported)
- [ ] Step 3 records whether the deployed build is stale
- [ ] If redeployed: dashboard country lists load and Alerts panel opens cleanly in prod
- [ ] `plans/README.md` row updated with the outcome (stale-build confirmed + redeployed, or escalated to a code plan)

## STOP conditions

- Step 1 or 2 shows the code is actually broken in current HEAD → STOP, write a code-fix plan instead of redeploying.
- You cannot determine the deployed build's commit → report what you found; do not redeploy blind.
- Deploy requires credentials/permissions you don't have → hand back to the maintainer.

## Maintenance notes

- Root observability gap: thrown errors never reach the per-user audit logs (they
  only log `success:true`). The only prod error evidence was 3 manually-saved
  console dumps. A small server-side error sink (or piping the standalone
  server's stderr to a rotated file instead of the discarded socket it currently
  writes to) would make the next triage evidence-driven. Tracked as a direction
  note, not in this plan.
