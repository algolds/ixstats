# Plan 073: Title-case government type in infoboxes (so legacy lowercase shows "Republic" not "republic")

> **Executor instructions**: Follow step by step, verify, update this plan's row
> in `plans/README.md`. Honor STOP conditions.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/components/mycountry/OverviewHero.tsx src/components/dashboard/DashboardRouter.tsx src/components/countries/ExpandedCardContent.tsx`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

QA reported gov type renders lowercase (`republic` vs `Republic`) in MyCountry
and Dashboard infoboxes, and that re-saving gov type in the builder fixes it.
That means **legacy/older country records store the type lowercase** while the
builder now writes a properly-cased value. The robust fix is to title-case at
**display time** so both old and new data render correctly, rather than a data
migration.

## Current state

No title-case helper exists in `src/lib/`. Gov type is rendered raw at (at least)
these sites:

- `src/components/mycountry/OverviewHero.tsx:771-772`
  `{stats.governmentType && (<LocationBadge type="government" value={stats.governmentType} />)}`
- `src/components/dashboard/DashboardRouter.tsx:682-683` — same `LocationBadge` usage.
- `src/components/countries/ExpandedCardContent.tsx:170-171`
  `{country.governmentType && (<DetailRow label="Govt" value={country.governmentType} />)}`

There may be more infobox sites — `grep -rn "governmentType" src/components` lists
them all (~10 files). Only the ones that **display** the value to users need the
fix; ones that store/pass it through do not.

Convention: shared utilities live in `src/lib/`. Check whether `src/lib/utils.ts`
exists (it usually holds the shadcn `cn` helper) and add the helper there to match
the repo's util placement; if it doesn't exist, create `src/lib/text-format.ts`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Find all sites | `grep -rn "governmentType" src/components` | the list to triage |
| Typecheck files | `bun run typecheck:file <each edited file>` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope:**
- A new tiny `toTitleCase` helper (in `src/lib/utils.ts` if present, else a new `src/lib/text-format.ts`).
- The user-facing **display** sites of `governmentType` (start with the 3 above; add any other infobox display sites found via grep).

**Out of scope:**
- Database / Prisma schema — no data migration.
- The builder's write path (it already writes proper casing).
- Any `governmentType` reference that is stored, compared, or passed as a key/prop without being rendered to the user.

## Git workflow

- Branch: `advisor/073-government-type-capitalization`
- Commit: `fix(ui): title-case government type at display sites`

## Steps

### Step 1: Add the helper

```ts
/** Title-case a snake/space/lower string for display, e.g. "constitutional monarchy" → "Constitutional Monarchy". Idempotent. */
export function toTitleCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
```

It is idempotent: already-cased values (`"Republic"`) pass through unchanged.

### Step 2: Apply at the display sites

Wrap the rendered value, e.g.:
- `value={stats.governmentType}` → `value={toTitleCase(stats.governmentType)}`
- `value={country.governmentType}` → `value={toTitleCase(country.governmentType)}`

Import `toTitleCase` in each edited file. Apply to every infobox **display** site
found in Step (grep). Do NOT wrap stored/compared/keyed usages.

**Verify**: `bun run typecheck:file` on each edited file → exit 0.

### Step 3: Confirm no display site was missed

Re-run `grep -rn "governmentType" src/components` and confirm every site that
renders the value into JSX user-facing text now passes through `toTitleCase`.

## Test plan

Add a unit test for the helper (it has branchy logic), modeled after any existing
test in `src/lib/__tests__/` or `src/lib/*.test.ts`:

```ts
// asserts: toTitleCase("republic") === "Republic"
//          toTitleCase("constitutional monarchy") === "Constitutional Monarchy"
//          toTitleCase("Republic") === "Republic"   // idempotent
//          toTitleCase("federal_republic") === "Federal Republic"
```
**Verify**: `bun run test -- <new test path>` → all pass.

## Done criteria

- [ ] `toTitleCase` exists and is unit-tested; `bun run test -- <path>` passes
- [ ] `bun run typecheck:file` passes for every edited component
- [ ] The 3 named display sites (and any others found) render via `toTitleCase`
- [ ] `bun run lint` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- You find `governmentType` is already title-cased before reaching these sites (the QA note is stale) → STOP, report.
- A "display" site turns out to also be used as a key/identifier where casing matters → leave it, note it, and report.

## Maintenance notes

- If a gov-type **filter/grouping** feature is added later, group on a normalized
  (lowercased) value, not the title-cased display string.
- Reviewer: confirm only render sites were wrapped, not storage/compare paths.
