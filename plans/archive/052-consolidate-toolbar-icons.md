# Plan 052: Consolidate Network + Snap into the editor toolbar (with Grid + Center)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report — do not
> improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 2a15532d..HEAD -- src/components/maps/editor/components/EditorHeader.tsx src/components/maps/editor/MapEditorOverlay.tsx src/components/maps/editor/hooks/useMapEditorOverlayState.ts src/components/maps/RouteNetworkView.tsx src/lib/editor-prefs.ts`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P3 (UX reorganization; no behavior change to the actions themselves)
- **Effort**: S–M
- **Risk**: MED (touches 3 files, removes a public export, adds cross-component
  prop wiring)
- **Depends on**: Plan 051 DONE (the new admin subsection is already in the
  popover — we extend that popover, not the toolbar) and Plan 049 DONE
  (the `RouteNetworkView` component exists)
- **Category**: direction (UX / information architecture)
- **Planned at**: commit `2a15532d`, 2026-06-16
- **Issue**: (none)

## Why this matters

The user wants the editor's right-side "view" icons to form a single, scannable
group: **Grid toggle · Center · Network view · Snap** (plus the existing Help
and Settings gear). Today they live in three different places and three
different components:

- **Grid + Center** — already in the right place (`EditorHeader.tsx` lines
  137–162), as 24×24 icon-only buttons.
- **Network view** — `RouteNetworkButton` floats over the map canvas with
  `absolute top-3 right-3 z-20` in `MapEditorOverlay.tsx:743` (added by Plan
  049). It uses a different visual treatment (a Button with `variant="outline"`
  and a "Network" text label) and is the only overlay on the map.
- **Snap** — buried two layers deep: the public maps page's `MapDynamicIsland`
  (a floating bar at the top of `/maps`) hosts a `MapSettingsPopover` that has
  a "Snap" subsection with a Magnet icon, an On/Off pill, and a tolerance
  range slider. The editor never had a snap UI — but the editor's draw hooks
  (`useSubdivisionDraw`, `useSubdivisionVertexEdit`, `useRouteEdit`) already
  consume snap from localStorage (`getSnapEnabled()` / `getSnapTolerance()`),
  so the editor *uses* snap, it just has no way to toggle it.

Consolidating all four into the same flex row in `EditorHeader.tsx`:

1. **Frees the map canvas** — the floating Network button no longer covers map
   content (annoying when zoomed into a busy area).
2. **Surfaces snap in the editor** — currently the editor user has to go to
   the public `/maps` page to turn snap on. With a toolbar magnet, it's
   one click.
3. **Keeps tolerance configurable** — the snap tolerance range slider moves
   into the editor's existing Settings popover (the gear icon, which already
   has "Admin" / "Import Provinces" / "Simplify All" from Plan 051), so the
   toolbar itself doesn't grow a slider.

This is a **reorganization, not a behavior change**: the underlying snap state
is already localStorage-backed (`ixeditor-snap-enabled` and
`ixeditor-snap-tolerance` from `src/lib/editor-prefs.ts`), and the route
network view component is unchanged. The plan only moves where the UI is
mounted.

## Current state

**`src/components/maps/editor/components/EditorHeader.tsx`** — the right-aligned
icon group lives at lines 137–162, currently holding Grid (138–149) and Center
(150–161), inside the inner `<div className="flex items-center gap-0.5">`
inside the wider `ml-1 flex items-center gap-1.5` wrapper at line 136. The
Settings popover body (after Plan 051) is at lines 222–337, with sections for
"Import Provinces" / "Simplify All Regions" (always-on) and "Admin" (gated)
items. The popover ends at line 337 (closing `</PopoverContent>`).

**`src/components/maps/editor/MapEditorOverlay.tsx`** — at **line 743** (the
`countryId && <RouteNetworkButton countryId={countryId} />` line) is the
floating button. The `EditorHeader` is mounted at line 419 with a long list
of props passed in (the right side of the `<EditorHeader ... />` JSX).

**`src/components/maps/RouteNetworkView.tsx`** — exports `RouteNetworkView`
(internal) and `RouteNetworkButton` (line 69, the public button). The
trigger JSX (lines 76–84) is the absolutely-positioned `<Button>` with
`<Share2 className="h-3.5 w-3.5" />` and a "Network" text label:
```tsx
<Button
  size="sm"
  variant="outline"
  className="absolute top-3 right-3 z-20 gap-1.5"
  title="Route network view"
>
  <Share2 className="h-3.5 w-3.5" />
  <span className="hidden sm:inline">Network</span>
</Button>
```

**`src/components/maps/core/components/MapSettingsPopover.tsx`** — the public
maps page's settings popover, mounted via `MapDynamicIsland.tsx:280`. The
snap UI is at lines 107–151. The state mirror lives in `useState(getSnapEnabled())`
and `useState(getSnapTolerance())` with handlers that call `setSnapEnabled` /
`setSnapTolerance` from `~/lib/editor-prefs` AND update local state in the
same handler. The "On/Off" pill toggles; the range slider adjusts tolerance
in degrees (`min=0.001`, `max=0.1`, `step=0.001`, default `0.015`).

**`src/components/maps/editor/hooks/useMapEditorOverlayState.ts`** — owns
`showGrid` (`useState` at line 544) and many other state pieces. The pattern
to follow for snap:
```ts
const [snapEnabled, setSnapEnabledState] = useState(getSnapEnabled());
const [snapTolerance, setSnapToleranceState] = useState(getSnapTolerance());
// And in the return object:
return { ..., snapEnabled, setSnapEnabled: (v: boolean) => { setSnapEnabledState(v); setSnapEnabled(v); }, snapTolerance, setSnapTolerance: (v: number) => { setSnapToleranceState(v); setSnapTolerance(v); } };
```

**`src/lib/editor-prefs.ts`** — already exports:
- `getSnapEnabled(): boolean` (default `false`)
- `setSnapEnabled(boolean): void`
- `getSnapTolerance(): number` (default `0.015`)
- `setSnapTolerance(number): void`
- localStorage keys: `ixeditor-snap-enabled`, `ixeditor-snap-tolerance`

**Consumers of snap (read on demand, no React state coupling):**
- `src/components/maps/editor/hooks/useSubdivisionDraw.ts:143-167`
- `src/components/maps/editor/hooks/useSubdivisionVertexEdit.ts`
- `src/components/maps/editor/hooks/useRouteEdit.ts`
All read the values via `getSnapEnabled()` / `getSnapTolerance()` at click/draw
time. Moving the editor-side UI does NOT change the consumers.

### Conventions to follow

- **Toolbar icon-only buttons** are 24×24, `h-6 w-6 rounded-md`, with
  `text-muted-foreground hover:bg-accent hover:text-foreground` for idle state
  and `bg-primary/15 text-primary` for active state. Match this exactly.
- **Active-state pattern.** `showGrid` shows an active style when `true`; do
  the same for snap (`snapEnabled` → active style).
- **No absolute positioning** inside the toolbar. The map-canvas-relative
  floating button pattern from Plan 049 is incompatible with the flex row.
- **Dialog usage.** The `Dialog` / `DialogContent` / `DialogTrigger` /
  `DialogTitle` / `Share2` / `Network` imports are all already in scope where
  needed. Add `Network` to the lucide-react import (it's the right semantic
  icon for the route network view — replacing `Share2`, which was a
  close-but-not-quite metaphor for "open the network view dialog").
- **Settings popover pattern.** The existing popover sections (always-on
  "Import Provinces" + conditional "Simplify All Regions" + Plan 051's
  admin-gated subsection) all use a small block of buttons with the same
  class string: `text-muted-foreground hover:bg-accent hover:text-foreground
  flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs
  transition-colors disabled:opacity-50`. The snap range slider will live in
  the popover and use the same `Magnet` icon for visual continuity.
- **No new tRPC procedures, no new dependencies.** Everything the plan needs
  is already installed.

## Commands you will need

| Purpose            | Command                                                              | Expected on success        |
|--------------------|----------------------------------------------------------------------|----------------------------|
| Typecheck server   | `bun run typecheck:server`                                            | exit 0                     |
| Typecheck UI       | `bun run typecheck:file src/components/maps/editor/components/EditorHeader.tsx` (or `bun run typecheck:ui` if `tsconfig.ui.json` is present) | exit 0 (or 0 errors in scope) |
| Lint               | `bun run lint`                                                       | exit 0 (pre-existing warnings OK; no new errors in in-scope files) |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build`. If
`bun run typecheck:file` errors on the `~/*` alias (a known script
limitation), fall back to `tsc -p tsconfig.ui.json --noEmit` and grep for
the in-scope file.

## Scope

**In scope** (the only files you may modify):
- `src/components/maps/editor/components/EditorHeader.tsx` — add 2 toolbar
  buttons + extend Settings popover with snap section
- `src/components/maps/editor/MapEditorOverlay.tsx` — remove the floating
  `RouteNetworkButton` mount, add `countryId` + snap props to the
  `EditorHeader` mount, expose the snap state from the editor overlay state
  hook
- `src/components/maps/editor/hooks/useMapEditorOverlayState.ts` — add snap
  state (useState + localStorage persistence)
- `src/components/maps/RouteNetworkView.tsx` — delete the now-unused
  `RouteNetworkButton` export (the editor uses its own inlined version; no
  other surface mounts it)

**Out of scope (do NOT touch):**
- `src/components/maps/core/components/MapSettingsPopover.tsx` — the public
  maps page's snap UI is unchanged. Snap state is localStorage-backed, so
  the public-maps and editor surfaces can coexist; both read/write the same
  keys.
- `src/lib/editor-prefs.ts` — already has everything we need; the
  `getSnapEnabled` / `setSnapEnabled` / `getSnapTolerance` / `setSnapTolerance`
  exports are exactly what the editor will call.
- The snap *consumers* (`useSubdivisionDraw`, `useSubdivisionVertexEdit`,
  `useRouteEdit`) — they already call `getSnapEnabled()` / `getSnapTolerance()`
  on demand. The new toolbar + popover UI just gives the editor a way to
  *change* the values, which propagates through localStorage to those
  consumers on their next read.
- The `RouteNetworkView` (internal) component — unchanged; it's the dialog
  body, not the trigger.
- `EditorHeader` props other than the additions described in this plan.

## Git workflow

- Branch: `advisor/052-consolidate-toolbar-icons` off `v2`. Conventional
  commit, e.g. `refactor(maps): consolidate Network + Snap into editor toolbar`.
- Do NOT push or open a PR unless asked.

## Steps

### Step 1: Add snap state to `useMapEditorOverlayState`

In `src/components/maps/editor/hooks/useMapEditorOverlayState.ts`:

1. Add imports near the other `~/lib/...` imports (or wherever the file's
   existing imports live — read the top of the file first to match its
   style):
   ```ts
   import { getSnapEnabled, setSnapEnabled, getSnapTolerance, setSnapTolerance } from "~/lib/editor-prefs";
   ```
2. Add the two `useState` hooks near `showGrid` (line 544). The values are
   initialized from the localStorage getters (same pattern as the snap
   popover in `MapSettingsPopover.tsx:36-37`):
   ```ts
   const [snapEnabled, setSnapEnabledState] = useState(getSnapEnabled());
   const [snapTolerance, setSnapToleranceState] = useState(getSnapTolerance());
   ```
3. Expose wrapper setters that update both the local state and the
   localStorage-backed source of truth (the public-maps popover does the
   same thing in the same handler — pattern to match):
   ```ts
   const setSnapEnabled = useCallback((v: boolean) => {
     setSnapEnabledState(v);
     setSnapEnabled(v);
   }, []);
   const setSnapTolerance = useCallback((v: number) => {
     setSnapToleranceState(v);
     setSnapTolerance(v);
   }, []);
   ```
   (If the file already uses `useCallback` for stable setters, match that;
   if not, plain `const` arrow functions are fine — the rest of the file's
   setters are inconsistent about this and the consumer doesn't memoize on
   the setters.)
4. Add `snapEnabled`, `setSnapEnabled`, `snapTolerance`, `setSnapTolerance`
   to the hook's return object (whichever shape the file already uses —
   inspect lines 540+ for the return type).

**Verify**:
- `grep -c "snapEnabled\|snapTolerance" src/components/maps/editor/hooks/useMapEditorOverlayState.ts` → `≥ 6` (1 setEnabled, 1 setEnabledState, 1 useState snapEnabled, 1 useState snapTolerance, 1 setTolerance, 1 setToleranceState — at minimum).
- `bun run typecheck:server` → exit 0 (this file is server-importable; the
  editor's state hook lives in the UI tree but doesn't use any React
  server-only APIs — confirm by reading the file's top imports).

### Step 2: Add the toolbar Network + Snap buttons in `EditorHeader`

In `src/components/maps/editor/components/EditorHeader.tsx`:

1. **Imports.** Add to the lucide-react import: `Network` (for the network
   view button — replaces `Share2` for a more semantic icon) and `Magnet`
   (for the snap toggle). Drop `Share2` if it was imported for the
   (about-to-be-deleted) `RouteNetworkButton` reference. Add `Dialog`,
   `DialogContent`, `DialogTrigger`, `DialogTitle` from `~/components/ui/dialog`
   (these may already be imported — check; if not, add them). Drop the
   `RouteNetworkView` import if you delete the usage in Step 4.
2. **Props.** Extend `EditorHeaderProps` (the `interface` near the top of
   the file — read its current shape first) with:
   ```ts
   countryId?: string | null;
   snapEnabled: boolean;
   setSnapEnabled: (v: boolean) => void;
   snapTolerance: number;
   setSnapTolerance: (v: number) => void;
   ```
3. **Destructure.** Add the new props to the `function EditorHeader({
   ... })` destructuring.
4. **In the icon group** (the `<div className="flex items-center gap-0.5">`
   at line 137), add two new buttons as siblings after the existing Center
   button (currently lines 150–161). Match the existing button style exactly:

   ```tsx
   {/* Route network view (opens a Dialog with the React Flow graph) */}
   {countryId && (
     <Dialog>
       <DialogTrigger
         className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors"
         title="Route network view"
       >
         <Network className="h-3.5 w-3.5" />
       </DialogTrigger>
       <DialogContent className="h-[80vh] max-w-5xl p-0">
         <DialogTitle className="sr-only">Route Network</DialogTitle>
         <div className="h-full w-full">
           <RouteNetworkView countryId={countryId} />
         </div>
       </DialogContent>
     </Dialog>
   )}

   {/* Snap toggle (tolerance lives in the Settings popover below) */}
   <button
     onClick={() => setSnapEnabled(!snapEnabled)}
     className={cn(
       "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
       snapEnabled
         ? "bg-primary/15 text-primary"
         : "text-muted-foreground hover:bg-accent hover:text-foreground"
     )}
     title={`Snap: ${snapEnabled ? "On" : "Off"} (tolerance in Settings)`}
   >
     <Magnet className="h-3.5 w-3.5" />
   </button>
   ```
5. **Add `RouteNetworkView` import** at the top of the file (it lives in
   `~/components/maps/RouteNetworkView`).

**Verify**:
- `grep -c "RouteNetworkView" src/components/maps/editor/components/EditorHeader.tsx` → `1` (the new import)
- `grep -c "Network" src/components/maps/editor/components/EditorHeader.tsx` → `≥ 2` (1 import + 1 JSX usage; note: "RouteNetwork" matches the import but not the bare word — adjust the grep if needed; `grep -c "<Network "` → `1`)
- `grep -c "Magnet" src/components/maps/editor/components/EditorHeader.tsx` → `≥ 2` (1 import + 1 JSX usage)
- `grep -c "DialogTrigger" src/components/maps/editor/components/EditorHeader.tsx` → `≥ 1`

### Step 3: Add the snap section to the editor's Settings popover

In the same `EditorHeader.tsx` file, inside the existing Settings popover
(`<PopoverContent>` block starting at line 221, inside the
`<div className="flex flex-col gap-1">` at line 230), add a snap section
**before** the Plan 051 "Admin" subsection. Place it as a sibling block
inside the same flex column, so it shows for everyone (snap is a universal
editing feature, not an admin one).

Insert this immediately **after** the closing `)}` of the "Simplify All
Regions" conditional (at what is currently line 277), and **before** the
existing `isAdmin && activeCountryId && (...)` admin block from Plan 051:

```tsx
{/* Snap (always visible — universal editing feature) */}
<>
  <div className="border-border/60 my-1 border-t" aria-hidden />
  <div className="flex items-center justify-between px-2 py-1.5">
    <div className="flex items-center gap-1.5">
      <Magnet className="text-muted-foreground h-3 w-3" />
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Snap
      </span>
    </div>
    <button
      onClick={() => setSnapEnabled(!snapEnabled)}
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
        snapEnabled
          ? "bg-emerald-500/10 text-emerald-500"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {snapEnabled ? "On" : "Off"}
    </button>
  </div>
  {snapEnabled && (
    <div className="flex items-center gap-2 px-2 pb-1.5">
      <input
        type="range"
        min="0.001"
        max="0.1"
        step="0.001"
        value={snapTolerance}
        onChange={(e) => setSnapTolerance(parseFloat(e.target.value))}
        className="h-1 flex-1 accent-blue-500"
      />
      <span className="text-muted-foreground w-10 text-right font-mono text-[10px] tabular-nums">
        {snapTolerance.toFixed(3)}°
      </span>
    </div>
  )}
</>
```

Notes:
- This **mirrors** the public-maps `MapSettingsPopover.tsx:107-151` snap UI
  pixel-for-pixel except for the onChange handler (which now calls the
  props' `setSnapEnabled` / `setSnapTolerance` instead of the local mirror
  state). The state source of truth is the same (`useMapEditorOverlayState`
  here, `useState` there), and both write to the same localStorage keys.
- The `<></>` fragment wrapper is required because the popover body is a
  flex column and expects direct children (same pattern Plan 051 used for
  the admin subsection).
- The popover's snap section sits ABOVE the admin section in visual order,
  because snap is universal (visible to everyone) and admin is gated.
  Users without admin rights see only "Import Provinces" + "Simplify All
  Regions" + snap; users with admin rights see the same plus the admin
  subsection.

**Verify**:
- `grep -c "Snap" src/components/maps/editor/components/EditorHeader.tsx` → `≥ 2` (1 in the popover label, 1 in the toolbar title attribute)
- `grep -c "snapTolerance" src/components/maps/editor/components/EditorHeader.tsx` → `≥ 4` (1 destructure, 1 in slider value, 1 in onChange, 1 in the readout)

### Step 4: Remove the floating `RouteNetworkButton` mount

In `src/components/maps/editor/MapEditorOverlay.tsx`:

1. **Remove the import** of `RouteNetworkButton` (its import line is
   somewhere near the top of the file).
2. **Remove the mount line at line 743** (`{countryId && <RouteNetworkButton countryId={countryId} />}`).
3. **Update the `<EditorHeader ... />` mount** (currently around line 419)
   to add the new props:
   ```tsx
   <EditorHeader
     ...all existing props...
     countryId={countryId}
     snapEnabled={snapEnabled}
     setSnapEnabled={setSnapEnabled}
     snapTolerance={snapTolerance}
     setSnapTolerance={setSnapTolerance}
   />
   ```
4. **Pull the snap state from the overlay state hook.** Add to the
   `useMapEditorOverlayState` call site (look up the existing destructuring
   in the file — it's likely near the top, similar to
   `const { ..., showGrid, setShowGrid } = useMapEditorOverlayState();`):
   ```tsx
   const {
     ...,
     snapEnabled,
     setSnapEnabled,
     snapTolerance,
     setSnapTolerance,
   } = useMapEditorOverlayState(...);
   ```
   (The hook's call signature is whatever it currently is — preserve it; only
   the destructure grows.)

**Verify**:
- `grep -c "RouteNetworkButton" src/components/maps/editor/MapEditorOverlay.tsx` → `0`
- `grep -c "snapEnabled\|setSnapEnabled\|snapTolerance\|setSnapTolerance" src/components/maps/editor/MapEditorOverlay.tsx` → `≥ 4` (4 from the destructure)
- `grep -n "countryId={" src/components/maps/editor/MapEditorOverlay.tsx` → at least one match (the new EditorHeader prop)

### Step 5: Delete the now-unused `RouteNetworkButton` export

In `src/components/maps/RouteNetworkView.tsx`:

1. **Delete the entire `RouteNetworkButton` function** (lines 69–92, the
   `export function RouteNetworkButton({ countryId }: { countryId: string }) { ... }` block).
2. **Drop any now-unused imports** (e.g., `Share2` if it's only used inside
   the deleted function, `useState` from React if no other consumer in the
   file). Use the eslint unused-imports check or the `bun run lint` output
   to find them.
3. **Keep `RouteNetworkView`** (the dialog body component) — it's still
   imported by `EditorHeader.tsx` and rendered inside the new `DialogContent`
   we added in Step 2.

**Verify**:
- `grep -c "RouteNetworkButton" src/components/maps/RouteNetworkView.tsx` → `0`
- `grep -c "RouteNetworkView" src/components/maps/RouteNetworkView.tsx` → `≥ 1` (the export remains)
- `bun run lint` → exit 0 (no unused-imports warnings on this file)

### Step 6: Typecheck + lint

**Verify**:
- `bun run typecheck:server` → exit 0 (the state-hook change is typechecked
  here; if the sub-project tsconfig is untracked in this worktree, fall
  back to `bun run typecheck:file` on the hook file).
- `bun run typecheck:file src/components/maps/editor/components/EditorHeader.tsx` → exit 0 (or `tsc -p tsconfig.ui.json --noEmit | grep EditorHeader` → 0 errors).
- `bun run lint` → exit 0 (no new errors in the in-scope files; the unused-import
  check should pass once `Share2` is dropped from `RouteNetworkView.tsx`).

## Test plan

No automated test for any of the in-scope files (no `*.test.ts` exists
under `src/components/maps/editor/components/` or for
`RouteNetworkView`). Verification is typecheck + lint + a manual visual
check (non-blocking):

- Manual (do if a dev server is available): `bun run dev`, open `/maps`,
  enter the editor for a country. Confirm:
  - The right-side icon row in the editor header shows (in order):
    **Grid · Center · Network · Snap · Help · Settings**. The
    `RouteNetworkButton` no longer floats over the map canvas.
  - The Network icon opens a full-screen dialog with the React Flow hub-
    and-spoke graph (same dialog as before, just launched from a different
    button).
  - The Snap icon toggles between active and idle styles; clicking it
    flips the icon style and the localStorage `ixeditor-snap-enabled` key.
  - The Settings popover (gear) now has a "Snap" section above the (admin-
    gated) "Admin" section, with the On/Off pill and (when On) the
    tolerance range slider showing the current value in degrees.
  - On the **public** `/maps` page (no editor active), the existing
    `MapSettingsPopover` in the dynamic island still has the snap section
    unchanged. Toggling there or in the editor updates the same
    localStorage value; reloading either surface shows the synced state.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck:server` exits 0
- [ ] `bun run typecheck:file` for `EditorHeader.tsx` exits 0 (or full project typecheck shows 0 new errors in scope)
- [ ] `bun run lint` exits 0 with no new errors in the in-scope files
- [ ] `grep -c "RouteNetworkButton" src/components/maps/RouteNetworkView.tsx` → `0` (export deleted)
- [ ] `grep -c "RouteNetworkButton" src/components/maps/editor/MapEditorOverlay.tsx` → `0` (mount removed)
- [ ] `grep -c "RouteNetworkView" src/components/maps/editor/components/EditorHeader.tsx` → `≥ 1` (new inlined consumer)
- [ ] `grep -c "Magnet" src/components/maps/editor/components/EditorHeader.tsx` → `≥ 2` (import + toolbar button; the popover uses the same icon, so 3+ is fine)
- [ ] `grep -c "Network" src/components/maps/editor/components/EditorHeader.tsx` → `≥ 2` (1 import + 1 JSX usage)
- [ ] `grep -c "absolute top-3 right-3" src/components/maps/editor/MapEditorOverlay.tsx` → `0` (the floating-button positioning class is gone)
- [ ] `git status --porcelain` shows only the four in-scope paths modified
- [ ] `plans/README.md` status row for 052 updated (SKIP — reviewer maintains the index)

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift) — especially
  if the line numbers for the existing grid/center group, the popover body,
  or the floating `RouteNetworkButton` mount have shifted.
- `useMapEditorOverlayState` is not the right place for the snap state
  (e.g., the file doesn't expose setters in the way the plan describes —
  read the file's existing patterns before adapting).
- `Dialog` / `DialogContent` / `DialogTrigger` / `DialogTitle` are not
  exported from `~/components/ui/dialog` (check with `grep -n "export" src/components/ui/dialog.tsx`;
  if any are missing, report — don't guess the alternative import name).
- `Network` icon is not exported from `lucide-react` (it is, as of writing,
  but the version might have changed — verify).
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- **Why a fragment around the snap section.** The Settings popover body is a
  `<div className="flex flex-col gap-1">` (line 230), so all children must be
  flex-column-compatible. A bare `<div>` wrapper around the snap section
  would have nested the layout; the `<></>` fragment keeps the snap row +
  conditional slider as direct flex children. Same trick Plan 051 used for
  the admin subsection.
- **Why Network replaces Share2.** The `Share2` icon was a "share" metaphor
  for opening a dialog; `Network` is a direct semantic match for the
  hub-and-spoke graph it shows. The dialog itself is unchanged — only the
  trigger icon.
- **The snap state lives in the editor's overlay state hook, not the
  global editor state.** The editor already had local-to-editor snap
  behavior (via localStorage read-on-demand in the draw hooks); this plan
  just adds a reactive mirror so the toolbar/popover can re-render on
  change. The public maps page keeps its own `useState` mirror in
  `MapSettingsPopover.tsx` — they read/write the same localStorage keys,
  so they stay in sync via storage events (or, in practice, the
  user-reload-the-tab fallback, which is good enough for a v1).
- **A follow-up, NOT in this plan**: if the editor ever needs a
  cross-surface subscription to snap changes (so the public maps' popover
  reflects the editor's toggle without a reload), add a `window` storage
  event listener in `MapSettingsPopover.tsx` and `EditorHeader.tsx` — both
  are one-file changes. Not needed today; the snap consumers
  (`useSubdivisionDraw` etc.) already re-read on every click/draw.
- **The "Network" text label is gone.** Plan 049's `RouteNetworkButton`
  had a `<span className="hidden sm:inline">Network</span>` label visible
  at `sm+` widths. The toolbar version is icon-only (24×24 matches the
  grid/center pattern). The `title="Route network view"` attribute
  preserves the hover tooltip; the dialog title (`DialogTitle`) preserves
  the screen-reader label.
- **The snap toggle is in the editor's toolbar, not the public maps'
  toolbar.** If the public maps page also wants a snap toggle in its
  floating bar (not just in the settings popover), that's a separate
  plan that would touch `MapDynamicIsland.tsx`. Not in scope.
