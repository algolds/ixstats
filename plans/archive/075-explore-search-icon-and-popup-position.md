# Plan 075: Fix the Explore search — off-center magnifier icon and mispositioned results popup

> **Executor instructions**: Follow step by step, verify, update this plan's row
> in `plans/README.md`. Honor STOP conditions. This is a located-then-investigate
> CSS plan: the entry points are exact, the fix requires you to inspect and
> reproduce.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/app/explore/page.tsx src/components/countries/_components/CountriesSearch.tsx`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (UI)
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

QA reported two Explore search issues: *"Looking glass icon next to search bar is
off-centered"* and *"Search box pop-up appears in wrong location or jumps screen
down the list."* Both make the primary discovery surface feel broken.

## Current state

- `src/app/explore/page.tsx` renders the Explore page and imports the search from
  `../countries/_components/CountriesSearch` (see the import around line 12). It
  wires `searchTerm`/`onSearchChange` (lines ~28, 268, 299).
- `src/components/countries/_components/CountriesSearch.tsx` is the search input +
  results popup component. The off-center magnifier icon is almost certainly an
  absolutely-positioned `<Search>` icon whose vertical centering is off (e.g.
  `top-2`/`top-3` instead of `top-1/2 -translate-y-1/2`), and the popup
  "jumps/wrong location" is a positioning/anchor issue on the results dropdown
  (e.g. not anchored to the input, or pushing layout instead of overlaying).

You must open `CountriesSearch.tsx` to read the actual icon wrapper and the
results-popup container classes before changing anything.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Find icon + popup markup | `grep -n "Search\|absolute\|top-\|translate\|z-\|dropdown\|results\|popover\|Command" src/components/countries/_components/CountriesSearch.tsx` | the relevant lines |
| Typecheck file | `bun run typecheck:file src/components/countries/_components/CountriesSearch.tsx` | exit 0 |

## Scope

**In scope:** `src/components/countries/_components/CountriesSearch.tsx` (icon
centering + results popup positioning). Touch `src/app/explore/page.tsx` only if
the popup mispositioning is caused by the parent container's overflow/positioning
context (and only minimally).

**Out of scope:**
- Search **logic / filtering** — works; this is purely visual positioning.
- Any shared UI primitive (Input, Popover, Command) — fix the usage, not the primitive.

## Git workflow

- Branch: `advisor/075-explore-search-position`
- Commit: `fix(explore): center search icon and anchor results popup`

## Steps

### Step 1: Fix the magnifier icon centering

In `CountriesSearch.tsx`, find the absolutely-positioned search icon. Make it
vertically centered relative to the input using the repo's standard pattern —
`absolute left-3 top-1/2 -translate-y-1/2` (with `pointer-events-none`) and
matching input left-padding (`pl-9`/`pl-10`). Match an existing centered-icon
input elsewhere in the codebase if one exists (grep `-translate-y-1/2` for an
exemplar).

**Verify**: visually, the icon is centered in the input field (reviewer check).

### Step 2: Fix the results popup position

Determine why the popup appears in the wrong place / jumps. Common causes and
fixes:
- The results list is rendered **in normal flow** (pushing the page down) instead
  of as an overlay → make its container `absolute` positioned relative to a
  `relative` wrapper around the input, with a `z-` above siblings.
- The popup is anchored to the wrong element → anchor it to the input wrapper.

Use the lazy fix that matches existing search/dropdown patterns in the repo; do
not introduce a new positioning library.

**Verify**: `bun run typecheck:file src/components/countries/_components/CountriesSearch.tsx` → exit 0; reviewer confirms the popup opens directly under the input and does not shove the page.

## Test plan

No unit test (visual). Reviewer manual check on `/explore`: icon centered; typing
opens a results popup anchored under the input that overlays content rather than
displacing it.

## Done criteria

- [ ] `bun run typecheck:file src/components/countries/_components/CountriesSearch.tsx` exits 0
- [ ] Icon is vertically centered (uses `top-1/2 -translate-y-1/2` or equivalent)
- [ ] Results popup is positioned as an overlay anchored to the input
- [ ] `git diff --name-only` is limited to the in-scope file(s)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The search popup is a shared primitive (e.g. a `Command`/`Popover`) used in many
  places and the misposition is in that primitive → STOP and report; a shared fix
  is out of scope.
- You cannot reproduce either issue → report what you see; the note may be browser/zoom-specific.

## Maintenance notes

- Reviewer: confirm the icon change uses the standard centering utility and the
  popup overlays (doesn't reflow). Watch for z-index regressions against the
  Explore filters bar.
