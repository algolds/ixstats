# Plan 076: Remove the large blank area at the bottom of the MyCountry executive infobox map

> **Executor instructions**: Follow step by step, verify, update this plan's row
> in `plans/README.md`. Honor STOP conditions. Located-then-investigate CSS plan.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/components/mycountry/OverviewHero.tsx src/components/maps/widgets/CountryMapEmbed.tsx`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (UI)
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

QA reported: *"Top infobox map has a large blank section at the bottom."* The
executive overview's hero map renders with empty space below it, wasting layout
and looking unfinished.

## Current state

- `src/components/mycountry/OverviewHero.tsx:38-42` dynamically imports the map:
  ```tsx
  const CountryMapEmbed = dynamic(
    () => import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({ default: m.CountryMapEmbed })),
    ...
  );
  ```
- It is rendered at `OverviewHero.tsx:584` (`<CountryMapEmbed ... />`).
- The map widget itself is `src/components/maps/widgets/CountryMapEmbed.tsx`.

The blank-bottom symptom is almost always one of: (a) the map container has a
**fixed height taller than the rendered map/canvas**, (b) an **aspect-ratio**
wrapper that doesn't match the map's actual content, or (c) the MapLibre/canvas
element not stretching to fill its parent (so the parent's reserved height shows
through below it). You must open both files and inspect the container height/
aspect classes around line 584 and inside `CountryMapEmbed` before editing.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Inspect container | `grep -n "height\|h-\|aspect\|min-h\|CountryMapEmbed\|className" src/components/mycountry/OverviewHero.tsx` | the container lines near 584 |
| Inspect widget | `grep -n "height\|h-\|aspect\|w-full\|className\|canvas\|MapContainer" src/components/maps/widgets/CountryMapEmbed.tsx` | the widget's sizing |
| Typecheck | `bun run typecheck:file src/components/mycountry/OverviewHero.tsx` | exit 0 |

## Scope

**In scope:** the map container sizing in `OverviewHero.tsx` (around line 584)
and/or the root element sizing in `CountryMapEmbed.tsx`.

**Out of scope:**
- The MapLibre/map rendering logic, layers, projection — purely a container
  sizing fix.
- Other consumers of `CountryMapEmbed` — if you change the widget's internal
  sizing, verify you don't break other call sites (grep for them first); prefer
  fixing the container in `OverviewHero` if the widget is shared.

## Git workflow

- Branch: `advisor/076-executive-infobox-map-blank-bottom`
- Commit: `fix(mycountry): remove blank space below executive infobox map`

## Steps

### Step 1: Identify the source of the blank height

Open `OverviewHero.tsx` around line 584 and `CountryMapEmbed.tsx`. Determine
which element reserves more vertical space than the map fills. Confirm by reading
the height/aspect classes. **If `CountryMapEmbed` is used elsewhere and the blank
space comes from inside the widget, check those call sites first** so the fix
doesn't shrink the map where it currently looks right.

### Step 2: Make the map fill its container (or size the container to the map)

Apply the minimal CSS fix:
- If the container has a fixed height larger than the map: make the map element
  `h-full w-full` so it fills, or reduce the container to the intended height/
  aspect.
- If an aspect-ratio wrapper is wrong: set it to the map's intended ratio.

Use existing Tailwind sizing utilities; do not add JS measurement.

**Verify**: `bun run typecheck:file src/components/mycountry/OverviewHero.tsx` (and the widget if edited) → exit 0.

## Test plan

No unit test (visual layout). Reviewer manual check: MyCountry → Executive top
infobox — the map fills its frame with no empty band beneath it, at desktop and
narrow widths.

## Done criteria

- [ ] `bun run typecheck:file` passes for each edited file
- [ ] No blank band below the executive infobox map (reviewer confirms)
- [ ] If `CountryMapEmbed.tsx` was edited, its other call sites still render correctly
- [ ] `git diff --name-only` limited to in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

- The blank space is actually a sibling element (legend/attribution/controls) that
  belongs there → STOP and report; it may not be a bug.
- Fixing it requires changing `CountryMapEmbed` in a way that breaks another call
  site → STOP and report the tradeoff.

## Maintenance notes

- Reviewer: check responsiveness — a height fix that looks right on desktop can
  collapse the map on mobile. Verify both.
