# Plan 082: Persist map label rotation/opacity and wire the regions opacity slider

> **Executor instructions**: Investigate-then-fix, two related sub-bugs. Verify
> each step, update `plans/README.md`, honor STOP conditions.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/components/maps/editor/FeaturePropertyPanel.tsx src/components/maps/editor/properties/MapLabelPropertyForm.tsx src/components/maps/editor/properties/SubdivisionPropertyForm.tsx src/server/api/routers/geo/features/labels.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

QA reported, in the Maps editor:
- *"Angling text and altering opacity does not work — resets to zero degrees/full
  opacity"* (label rotation + opacity).
- *"Regions opacity slider does not seem to work."*

Users set a label's angle/opacity (or a region's opacity), and it reverts —
styling work is lost.

## Current state — important: the server already persists labels correctly

- `src/components/maps/editor/properties/MapLabelPropertyForm.tsx` **correctly
  emits** rotation and opacity via its `onChange` prop:
  - rotation: line 134–135 `onChange={(e) => onChange({ ...form, rotation: parseInt(e.target.value, 10) })}`
  - opacity: line 175–176 `onChange={(e) => onChange({ ...form, opacity: parseFloat(e.target.value) })}`
  This form is a controlled child; it owns no save logic.
- The server label schema **already accepts and stores** these fields:
  `src/server/api/routers/geo/features/labels.ts` — create input has
  `rotation` (line 257) + `opacity` (260), written at 287/290; update input has
  them (329/332), read back at 412/415.

So for labels the loss is **client-side in the owner** of the form's `form`
state + save: `src/components/maps/editor/FeaturePropertyPanel.tsx` (the panel
that renders `MapLabelPropertyForm`). Likely one of: (a) the save handler omits
`rotation`/`opacity` from the mutation payload, or (b) the form is re-initialized
from the feature **without** reading back the stored `rotation`/`opacity` (so it
resets to the schema defaults 0° / 1.0).

- Regions: `src/components/maps/editor/properties/SubdivisionPropertyForm.tsx`
  shows **no** `opacity` form field in a grep (only a `disabled:opacity-50`
  class). The regions opacity slider is either unwired or lives elsewhere — you
  must locate the actual slider and confirm whether it reaches a save path /
  server field at all.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Label form owner | `grep -n "MapLabelPropertyForm\|rotation\|opacity\|mutate\|save\|initial\|useState" src/components/maps/editor/FeaturePropertyPanel.tsx` | how the panel builds form state + saves |
| Regions opacity slider | `grep -rn "opacity" src/components/maps/editor/properties/SubdivisionPropertyForm.tsx src/components/maps/editor/FeaturePropertyPanel.tsx` | where (if anywhere) regions opacity is edited/saved |
| Typecheck | `bun run typecheck:file <edited file>` | exit 0 |

## Scope

**In scope:**
- `src/components/maps/editor/FeaturePropertyPanel.tsx` — initialize the label
  form from the stored feature (incl. rotation/opacity) and include them in the
  save payload.
- The regions opacity control + its save path (file TBD by investigation; likely
  `SubdivisionPropertyForm.tsx` and/or the subdivision save in `geo/`).

**Out of scope:**
- `MapLabelPropertyForm.tsx` — it already emits the values correctly; don't change it.
- The labels server schema — it already persists rotation/opacity; don't change it.

## Git workflow

- Branch: `advisor/082-maps-feature-style-persistence`
- Commit(s): `fix(maps): persist label rotation/opacity on save+load`, `fix(maps): wire regions opacity slider`

## Steps

### Step 1: Labels — confirm where the value is dropped

In `FeaturePropertyPanel.tsx`, check (a) the initial `form` state for a label —
does it read `rotation`/`opacity` from the existing feature, or hardcode 0/1? and
(b) the save handler — does the mutation payload include `rotation`/`opacity`?
Identify which is dropping the value.

### Step 2: Labels — fix init and/or save

- If init hardcodes defaults: seed `rotation`/`opacity` from the loaded feature.
- If save omits them: add `rotation`/`opacity` to the `mutate(...)` payload.

**Verify**: `bun run typecheck:file src/components/maps/editor/FeaturePropertyPanel.tsx` → exit 0; reviewer sets a label angle + opacity, saves, reselects the label → values persist (not 0°/1.0).

### Step 3: Regions — locate and wire the opacity slider

Find the regions/subdivision opacity slider. Determine whether it (a) updates form
state, (b) reaches a save mutation, and (c) maps to a server/DB field. Wire the
missing link(s). If the subdivision server schema has no opacity field at all,
**STOP and report** — adding a persisted field is a schema change beyond this
plan's intended scope (decide with the maintainer).

**Verify**: `bun run typecheck:file <edited region file>` → exit 0; reviewer changes a region's opacity, saves, reselects → it persists.

## Test plan

These are stateful editor flows; prefer a small pure-function test if the
save-payload assembly can be extracted, else verify manually (reviewer) per the
checks in Steps 2–3. If `geo` has router tests, add a case asserting a label
round-trips rotation/opacity through create→get.

## Done criteria

- [ ] A label's rotation and opacity survive save + reselect (no reset to 0°/1.0)
- [ ] A region's opacity change persists (or, if it needs a schema change, that's reported, not silently added)
- [ ] `bun run typecheck:file` passes for each edited file
- [ ] `plans/README.md` status row updated

## STOP conditions

- Label rotation/opacity are already in both init and save payload (can't find the drop) → STOP, report; the reset may be a re-render overwriting state.
- Regions opacity has no server field → STOP and ask before adding a schema/migration.
- The fix requires a Prisma migration → out of scope; STOP and report (DB writes are guarded in this repo).

## Maintenance notes

- Labels already persist server-side; this is purely closing the client round-trip.
  Reviewer: confirm the load path reads every styling field the form exposes
  (fontSize, letterSpacing, fontWeight, color too) — the same drop pattern may
  affect siblings.
