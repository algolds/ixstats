# Plan 069: Stop the maps "Generate Routes" action from offering manual-only route types

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/components/maps/editor/properties/TransportPropertyForm.tsx src/server/api/routers/transport/routeMutations.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts to the live code before proceeding; on mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (builds on completed Plan 046)
- **Category**: bug
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

A QA pass reported: *"Generate Pipeline, Power, Fiber, Mil Supply/Naval doesn't
function"*, with a raw Zod error dumped on screen:
`Invalid option: expected one of "rail"|"highway"|"road"|"shipping_lane"|"canal"|"air_corridor"|"ferry"`.

This is **working as designed at the server**, by an intentional decision in the
completed Plan 046: pipeline / power_grid / fiber / military_supply /
military_naval are **manual-draw-only** route types — they are deliberately NOT
in the `generateRoutes` Zod enum because they can't be derived procedurally from
terrain. **Do not change the server enum.** The actual bug is the **UI**: the
"Generate Routes" panel lets the user select those manual-only types and then
sends them to `generateRoutes`, producing a scary validation error instead of
preventing a dead action.

Fix: filter the generate request to the generatable types, and tell the user the
rest must be drawn by hand.

## Current state

- `src/components/maps/editor/properties/TransportPropertyForm.tsx` — the route
  properties panel. Defines all 12 selectable route types and the "Generate
  Routes" button.
  - The full selectable list (lines 23–34), `ROUTE_TYPES`:
    ```ts
    { value: "rail", ... }, { value: "highway", ... }, { value: "road", ... },
    { value: "shipping_lane", ... }, { value: "canal", ... },
    { value: "air_corridor", ... }, { value: "ferry", ... },
    { value: "pipeline", ... }, { value: "power_grid", ... },
    { value: "fiber", ... }, { value: "military_supply", ... },
    { value: "military_naval", ... }
    ```
  - The generate mutation (line 87): `const generateRoutes = api.transport.generateRoutes.useMutation({...})`
  - The generate handler (lines 733–745) sends **all** selected types:
    ```tsx
    onClick={async () => {
      if (!countryId || selectedTypes.length === 0) return;
      try {
        await generateRoutes.mutateAsync({
          countryId,
          routeTypes: selectedTypes,
          clearExisting,
        });
      } catch { /* shown via state */ }
    }}
    ```
  - Errors already render to the user at lines 727–731 (`generateRoutes.error.message`).
- `src/server/api/routers/transport/routeMutations.ts:139-143` — the server
  enum. **Leave it exactly as-is** (this is the Plan 046 decision):
  ```ts
  routeTypes: z.array(
    z.enum(["rail", "highway", "road", "shipping_lane", "canal", "air_corridor", "ferry"])
  ).default(["rail", "highway"]),
  ```

Convention: this file uses Tailwind v4 classes and small inline handlers; match
the existing style (see the existing red error box at lines 727–731 for the
"info message" pattern to mirror).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck file | `bun run typecheck:file src/components/maps/editor/properties/TransportPropertyForm.tsx` | exit 0, no errors |
| Lint | `bun run lint` | exit 0 (pre-existing warnings OK) |

## Scope

**In scope:**
- `src/components/maps/editor/properties/TransportPropertyForm.tsx`

**Out of scope (do NOT touch):**
- `src/server/api/routers/transport/routeMutations.ts` — the enum exclusion is
  the intended Plan 046 decision. Changing it would re-introduce a silent no-op
  (the generator `generateTransportNetwork` has no algorithm for these types).
- `src/lib/transport-generator.ts` — no generation logic for the manual types,
  by design.

## Git workflow

- Branch: `advisor/069-route-generate-manual-only-types`
- Conventional-commit message, e.g. `fix(maps): don't send manual-only route types to generateRoutes`
- Do NOT push or open a PR unless told to.

## Steps

### Step 1: Add a generatable-types constant

Near the top of the file (after the `ROUTE_TYPES` array, ~line 35), add:

```ts
// Route types the server can generate procedurally (must match the generateRoutes
// Zod enum in routeMutations.ts). All other ROUTE_TYPES are manual-draw only — see Plan 046.
const GENERATABLE_ROUTE_TYPES = [
  "rail", "highway", "road", "shipping_lane", "canal", "air_corridor", "ferry",
] as const;
```

### Step 2: Filter the generate request and message the user

Replace the `onClick` handler body (lines 734–744) so it only sends generatable
types, and reports when the user selected manual-only ones:

```tsx
onClick={async () => {
  if (!countryId || selectedTypes.length === 0) return;
  const generatable = selectedTypes.filter((t) =>
    (GENERATABLE_ROUTE_TYPES as readonly string[]).includes(t)
  );
  const manualOnly = selectedTypes.filter(
    (t) => !(GENERATABLE_ROUTE_TYPES as readonly string[]).includes(t)
  );
  if (generatable.length === 0) {
    setGenerateNotice(
      "These route types must be drawn manually — only rail, highway, road, shipping, canal, air, and ferry can be generated."
    );
    return;
  }
  setGenerateNotice(
    manualOnly.length > 0
      ? "Generating only the supported types; pipeline/power/fiber/military routes must be drawn manually."
      : null
  );
  try {
    await generateRoutes.mutateAsync({ countryId, routeTypes: generatable, clearExisting });
  } catch { /* shown via state */ }
}}
```

Add the `generateNotice` state near the other `useState` calls in the component:
```ts
const [generateNotice, setGenerateNotice] = useState<string | null>(null);
```
And render it next to the existing error box (after line 731), mirroring its style:
```tsx
{generateNotice && (
  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
    {generateNotice}
  </div>
)}
```

**Verify**: `bun run typecheck:file src/components/maps/editor/properties/TransportPropertyForm.tsx` → exit 0.

### Step 3: Confirm the server enum is untouched

**Verify**: `git diff --name-only` lists only
`src/components/maps/editor/properties/TransportPropertyForm.tsx`.

## Test plan

No unit test (pure UI wiring; the component has no existing test file). Manual
check for the reviewer: in the maps editor route panel, select only "Pipeline"
and click Generate → an amber notice appears, no red Zod error. Select "Rail" +
"Pipeline" → generation runs for rail, amber notice explains pipeline is manual.

## Done criteria

ALL must hold:

- [ ] `bun run typecheck:file src/components/maps/editor/properties/TransportPropertyForm.tsx` exits 0
- [ ] `git diff --name-only` shows only `TransportPropertyForm.tsx`
- [ ] `grep -n "GENERATABLE_ROUTE_TYPES" src/components/maps/editor/properties/TransportPropertyForm.tsx` returns the constant + its 2 uses
- [ ] The server enum in `routeMutations.ts:141` is unchanged (`git diff routeMutations.ts` empty)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- `TransportPropertyForm.tsx` no longer matches the "Current state" excerpts.
- `selectedTypes` is not the variable feeding `routeTypes` (find the real source first; do not guess).
- You find yourself wanting to edit `routeMutations.ts` or `transport-generator.ts` — that means the approach drifted from Plan 046; STOP.

## Maintenance notes

- If a future plan adds procedural generation for any manual type (e.g. pipelines
  via the land-MST), move that value from manual-only into both
  `GENERATABLE_ROUTE_TYPES` here **and** the server enum + `ROUTE_CONFIGS` +
  generator logic together — keep the two lists in sync.
- Reviewer: confirm no change to the server enum and that the amber notice copy
  names exactly the 7 generatable types.
