# Plan 051: Move "Gen Transport" and "Recalc" buttons into the Map Editor Settings popover

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report — do not
> improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 2a15532d..HEAD -- src/components/maps/editor/components/EditorHeader.tsx`
> If the file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P3 (UX reorganization; no behavior change to the actions themselves)
- **Effort**: S
- **Risk**: LOW (pure JSX relocation within a single component, all data already in scope)
- **Depends on**: none
- **Category**: direction (UX / information architecture)
- **Planned at**: commit `2a15532d`, 2026-06-16
- **Issue**: (none)

## Why this matters

The two admin-only actions — **Gen Transport** (procedural `rail`/`highway`
generation via `api.transport.generateRoutes`) and **Recalc** (geographic
profile recompute via `api.geoCore.recalculateGeoProfiles`) — currently sit
*directly in the editor toolbar* between the bulk-delete chip and the right-
aligned action group. They take up toolbar space that's only useful to admins,
they use a different visual treatment (pill background, colored text) from
every other toolbar button, and they're the only toolbar items gated by
`isAdmin && activeCountryId`. Moving them into the existing **Map Editor
Settings** popover (the gear icon in the top-right) consolidates the rare /
admin / side-effect actions in one place, frees the toolbar for the everyday
controls, and uses the same visual language as the two existing popover items
("Import Provinces" + "Simplify All Regions").

**This is a pure JSX relocation — no state lifting, no new tRPC procedures,
no prop changes.** All the data the buttons need (`activeCountryId`,
`generateTransport`, `recalculateGeo`, `isAdmin`, `setIsSettingsOpen`) is
already in scope of `EditorHeader`. The move touches one file.

## Current state

All three controls live in **`src/components/maps/editor/components/EditorHeader.tsx`**:

- The **Settings popover** is at lines 208–281: a `Popover` anchored to a gear icon
  in the top-right of the header, `align="end"`, 256px wide (`w-64`). Body has a
  small uppercase header "Map Editor Settings" and a column of buttons.
  Currently contains: **Import Provinces** (always visible) and **Simplify All
  Regions** (only when at least one subdivision feature exists).
- The two buttons to move are at **lines 301–334**, inside a wrapper div at
  lines 298–336:
  ```tsx
  {/* Admin: transport + recalc actions — available when a country is active */}
  {isAdmin && activeCountryId && (
    <div className="flex items-center gap-1.5">
      <button
        onClick={async () => { /* generates rail+highway, alerts routesCreated/totalLengthKm */ }}
        disabled={generateTransport.isPending}
        className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-500/20 disabled:opacity-50 dark:text-indigo-400"
      >
        <Train className="h-3 w-3" />
        {generateTransport.isPending ? "..." : "Gen Transport"}
      </button>
      <button
        onClick={async () => { /* calls recalculateGeo.mutateAsync, alerts "Geographic profile recalculated" */ }}
        disabled={recalculateGeo.isPending}
        className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400"
      >
        <RefreshCw className={cn("h-3 w-3", recalculateGeo.isPending && "animate-spin")} />
        Recalc
      </button>
    </div>
  )}
  ```

Existing popover-item style (from "Import Provinces", lines 232–242) — **match
this in the new items**:
```tsx
<button
  onClick={() => { setIsSettingsOpen(false); /* action */ }}
  className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
>
  <FileUp className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
  <span className="font-medium">Import Provinces</span>
</button>
```

### Conventions to follow

- **Popover-close first.** Every existing popover item calls `setIsSettingsOpen(false)` at the top of its `onClick`. Do the same for the new two items so the popover dismisses immediately on click.
- **Result feedback via `alert(...)`.** Matches the existing "Simplify All Regions" item (the codebase doesn't use a toast system in this surface). Keep both `alert(...)` calls exactly as they are today — the success/error messages are part of the workflow the operator relies on.
- **Loading state via `*.isPending`.** Disable the button and swap the label to "..." or change the icon class (`animate-spin` / `animate-pulse`).
- **Gating preserved.** The two existing popover items are visible to everyone (the popover trigger itself is not admin-gated). The two new buttons are admin-gated — wrap them in `{isAdmin && activeCountryId && (...)}` **inside** the popover body so a non-admin opening the popover simply doesn't see the new items. The header "Map Editor Settings" stays as one block; the new items get a thin visual separator + a small "Admin" label so the gating is obvious to anyone scrolling the popover.
- **Style demotion.** The new items drop the pill background (`bg-indigo-500/10` / `bg-emerald-500/10`) and switch to the popover's standard `text-muted-foreground hover:bg-accent ...` row layout, but **keep the colored leading icon** (`text-indigo-500` / `text-emerald-500`) so the two items are still scannable.
- **No new imports.** `Train` and `RefreshCw` from `lucide-react` and `cn` from `~/lib/utils` are already imported. `isAdmin`, `activeCountryId`, `generateTransport`, `recalculateGeo`, `setIsSettingsOpen` are already in scope as props / state.

## Commands you will need

| Purpose            | Command                                                              | Expected on success        |
|--------------------|----------------------------------------------------------------------|----------------------------|
| Typecheck file     | `bun run typecheck:file src/components/maps/editor/components/EditorHeader.tsx` | exit 0                     |
| Lint               | `bun run lint`                                                       | exit 0 (pre-existing warnings OK; no new errors in this file) |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build`. If
`bun run typecheck:file` errors on the `~/*` alias (a known script limitation
documented in prior plan reports), fall back to `tsc -p tsconfig.ui.json
--noEmit` and grep for the in-scope file.

## Scope

**In scope** (the only file you may modify):
- `src/components/maps/editor/components/EditorHeader.tsx`

**Out of scope (do NOT touch):**
- The `EditorHeader` props interface, parent component (`MapEditorOverlay`), or
  any tRPC call site. The mutation handles and `activeCountryId` prop are
  already in scope.
- The other two popover items ("Import Provinces", "Simplify All Regions") —
  only add to the popover body, don't restyle what's there.
- The popover's trigger button, header label, or outer container.
- The bulk-delete chip and the rest of the editor toolbar (unchanged).

## Git workflow

- Branch: `advisor/051-move-transport-recalc-buttons` off `v2`. Conventional
  commit, e.g. `refactor(maps): move Gen Transport and Recalc into editor
  settings popover`.
- Do NOT push or open a PR unless asked.

## Steps

### Step 1: Add the two admin actions inside the Settings popover

In `src/components/maps/editor/components/EditorHeader.tsx`, inside the
`<PopoverContent>` block (the one starting at line 221), inside the
`<div className="flex flex-col gap-1">` (line 230), **after** the existing
"Simplify All Regions" block (which ends at line 277 with `</button>}` then
`)}`), add the following new admin subsection. Place it as a sibling group
inside the same flex column, separated by a thin border-top and a small
"Admin" label so the gating is visually obvious.

Insert this block immediately **before** the closing `</div>` of
`<div className="flex flex-col gap-1">` (i.e., directly after the closing
`)}` of the Simplify All conditional, at what is currently line 277):

```tsx
{/* Admin: transport + recalc — gated, separated visually from the always-on items above */}
{isAdmin && activeCountryId && (
  <>
    <div className="border-border/60 my-1 border-t" aria-hidden />
    <div className="text-muted-foreground/80 px-2 text-[9px] font-semibold tracking-wider uppercase select-none">
      Admin
    </div>
    <button
      onClick={async () => {
        setIsSettingsOpen(false);
        try {
          const result = await generateTransport.mutateAsync({
            countryId: activeCountryId,
            routeTypes: ["rail", "highway"],
            clearExisting: true,
          });
          alert(`Generated ${result.routesCreated} routes (${result.totalLengthKm} km)`);
        } catch (e) {
          alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
        }
      }}
      disabled={generateTransport.isPending}
      className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-50"
      title="Generate rail + highway routes procedurally (clears existing transport routes)"
    >
      <Train className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
      <span className="font-medium">
        {generateTransport.isPending ? "Generating..." : "Gen Transport"}
      </span>
    </button>
    <button
      onClick={async () => {
        setIsSettingsOpen(false);
        try {
          await recalculateGeo.mutateAsync({ countryId: activeCountryId });
          alert("Geographic profile recalculated");
        } catch (e) {
          alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
        }
      }}
      disabled={recalculateGeo.isPending}
      className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-50"
      title="Recalculate the geographic profile for the active country"
    >
      <RefreshCw
        className={cn(
          "h-3.5 w-3.5 shrink-0 text-emerald-500",
          recalculateGeo.isPending && "animate-spin"
        )}
      />
      <span className="font-medium">
        {recalculateGeo.isPending ? "Recalculating..." : "Recalc"}
      </span>
    </button>
  </>
)}
```

Notes:
- The two new buttons follow the **same pattern** as "Simplify All Regions" (set `setIsSettingsOpen(false)` first, `alert(...)` on result, `disabled={... || !activeCountryId}` or just the mutation's `isPending`).
- The **`<></>` fragment** wraps the divider + label + two buttons so they live inside the `<div className="flex flex-col gap-1">` parent (which expects direct children, not a nested wrapper).
- The label string changes from `"..."` (original toolbar button) to `"Generating..."` / `"Recalculating..."` (matches the existing "Simplifying..." verb-form pattern in the popover).
- The `border-border/60` divider uses a 60% opacity for a subtler visual separation than the default 100% — matches the rest of the editor's visual hierarchy.
- If the existing two popover items should also become admin-gated (defensive — they're benign for non-admins), that's a follow-up plan, not in scope here. Don't add the gate to them now.

**Verify**:
- `grep -c "Gen Transport" src/components/maps/editor/components/EditorHeader.tsx` → `2` (1 inside the popover, 1 in the alert message string)
- `grep -c "Recalc" src/components/maps/editor/components/EditorHeader.tsx` → `2` (1 inside the popover, 1 in the alert message / title)

### Step 2: Delete the now-empty toolbar wrapper

Delete the entire block at lines 298–336 (the comment + the `isAdmin &&
activeCountryId && (<div ...>...</div>)` wrapper containing the two original
buttons). The header ends after this block, so the deletion is straightforward
— no orphaned closing tags.

The comment at line 298 (`{/* Admin: transport + recalc actions — available
when a country is active */}`) and the wrapping `<div className="flex
items-center gap-1.5">` are both removed; the two buttons they contained are
now in the popover.

**Verify**:
- `grep -c "Gen Transport" src/components/maps/editor/components/EditorHeader.tsx` → `1` (only the one inside the popover; the toolbar copy is gone)
- `grep -c "bg-indigo-500/10" src/components/maps/editor/components/EditorHeader.tsx` → `0` (the pill background is gone)
- `grep -c "bg-emerald-500/10" src/components/maps/editor/components/EditorHeader.tsx` → `0`
- `wc -l src/components/maps/editor/components/EditorHeader.tsx` → about 6–7 lines shorter than the original 339 (the deleted block is 39 lines, the new popover additions are ~60 lines, so net file should be ~360 lines)

### Step 3: Typecheck + lint

**Verify**:
- `bun run typecheck:file src/components/maps/editor/components/EditorHeader.tsx` → exit 0 (or, if the `~/*` alias limitation bites, `tsc -p tsconfig.ui.json --noEmit | grep EditorHeader` → 0 errors).
- `bun run lint` → exit 0 (no new errors in this file; pre-existing warnings elsewhere are OK).

## Test plan

No automated test for this file (the codebase doesn't have a unit test for
`EditorHeader`). Verification is typecheck + lint + a manual visual check
(non-blocking):

- Manual (do if a dev server is available): `bun run dev`, open `/maps` and
  enter the editor for a country. Confirm the toolbar no longer shows the
  "Gen Transport" and "Recalc" pill buttons. Open the gear-icon settings
  popover in the top-right. If you're an admin with an active country, the
  popover should now show: **Import Provinces** (always), **Simplify All
  Regions** (if subdivisions exist), then a thin divider, a small "Admin"
  label, and **Gen Transport** + **Recalc**. If you're not an admin, the
  divider + label + admin items are not rendered. Clicking either admin
  item should: close the popover immediately, show the spinner / "..."
  label, run the action, and show the same `alert(...)` feedback it did
  before the move.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck:file src/components/maps/editor/components/EditorHeader.tsx` exits 0 (or `tsc -p tsconfig.ui.json` shows 0 errors for this file)
- [ ] `bun run lint` exits 0 with no new errors in the in-scope file
- [ ] `grep -c "Gen Transport" src/components/maps/editor/components/EditorHeader.tsx` → `1` (only inside the popover)
- [ ] `grep -c "Recalc" src/components/maps/editor/components/EditorHeader.tsx` → `1` (only inside the popover)
- [ ] `grep -c "bg-indigo-500/10" src/components/maps/editor/components/EditorHeader.tsx` → `0`
- [ ] `grep -c "bg-emerald-500/10" src/components/maps/editor/components/EditorHeader.tsx` → `0`
- [ ] `grep -c "isAdmin && activeCountryId" src/components/maps/editor/components/EditorHeader.tsx` → `1` (the gate moved into the popover; only the new admin subsection carries it)
- [ ] `git status --porcelain` shows only the one in-scope path modified
- [ ] `plans/README.md` status row for 051 updated (SKIP — reviewer maintains the index)

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift) — especially
  if the lines for the Settings popover, the two existing popover items, or
  the two admin toolbar buttons have shifted.
- `Train`, `RefreshCw`, `cn`, `isAdmin`, `activeCountryId`, `generateTransport`,
  `recalculateGeo`, or `setIsSettingsOpen` are **not** in scope at the
  call sites the plan describes (the move relies on all of these being
  already in the component's scope).
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- **Why the gating is duplicated, not moved.** The popover trigger isn't
  admin-gated today (the gear icon is always visible). If you ever want to
  hide the entire popover from non-admins, that's a follow-up: gate the
  `<Popover>` itself with `isAdmin && activeCountryId` (and probably split
  the always-on items out into their own surface — or accept that "Import
  Provinces" + "Simplify All Regions" also become admin-only). Not in this
  plan.
- **The two `alert(...)` calls survived on purpose.** They are the operator's
  feedback signal for a long-running procedural action; the popover
  dismissal is a separate concern. If a toast system lands later, both old
  and new popover items can move to it in one follow-up plan.
- **The "Recalc" button used to show the spinner inline in the toolbar**
  (`<RefreshCw className="h-3 w-3" ... />`). The popover version uses
  `h-3.5 w-3.5` to match the other popover-item icon size — a minor visual
  size change inside the popover, not a behavioral change.
- **The verb-form label change** ("Generating..." / "Recalculating..."
  instead of the toolbar's "...") matches the existing "Simplifying..."
  pattern in the popover. Operator muscle memory still finds the action;
  the label is just more descriptive while pending.
