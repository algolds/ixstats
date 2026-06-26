# Plan 070: Remove the stray `//` comment rendering as visible text in the Atomic Tax UI

> **Executor instructions**: Follow step by step, run the verification, update
> this plan's row in `plans/README.md` when done. Honor STOP conditions.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/components/tax-system/atoms/TaxCalculator.tsx`
> If the file changed, confirm the excerpt below still matches before editing.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

A QA pass reported: *"code line `// eslint-disable-next-line unused-imports/no-unused-vars`
appears in Atomic Tax Components UI user-end."* In JSX, a `//` line placed
directly among element children is **not** a comment — React renders it as a
literal text node. The Tax Calculator's "Tax by Category" section shows the raw
eslint directive to end users. One-line delete.

## Current state

`src/components/tax-system/atoms/TaxCalculator.tsx` around line 962 — the `//`
sits as a JSX child inside `<div className="space-y-3">`:

```tsx
                  <div className="space-y-3">
                    // eslint-disable-next-line unused-imports/no-unused-vars
                    {calculationResult.breakdown.map((category, _index) => (
                      <Card key={category.categoryId} className="p-4">
```

The directive is pointless anyway: the map's index param is already named
`_index` (underscore-prefixed), so `unused-imports/no-unused-vars` won't fire.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck file | `bun run typecheck:file src/components/tax-system/atoms/TaxCalculator.tsx` | exit 0 |
| Confirm removal | `grep -n "eslint-disable-next-line unused-imports/no-unused-vars" src/components/tax-system/atoms/TaxCalculator.tsx` | line 962 no longer present |

## Scope

**In scope:** `src/components/tax-system/atoms/TaxCalculator.tsx` — only the one
JSX-child comment line inside the "Tax by Category" `<div className="space-y-3">`.

**Out of scope:** Every other `// eslint-disable...` in this file (lines 93, 98,
102, 155, 204, 318, 332, etc.) — those are real JS comments on real statements,
not JSX children. Do NOT remove them; they suppress legitimate lint warnings.

## Git workflow

- Branch: `advisor/070-tax-ui-stray-comment-leak`
- Commit: `fix(tax-system): remove eslint comment rendered as JSX text in TaxCalculator`

## Steps

### Step 1: Delete the leaked comment line

Remove the single line
`                    // eslint-disable-next-line unused-imports/no-unused-vars`
that sits between `<div className="space-y-3">` and
`{calculationResult.breakdown.map((category, _index) => (`. Leave both
surrounding lines intact.

**Verify**: `bun run typecheck:file src/components/tax-system/atoms/TaxCalculator.tsx` → exit 0.

## Test plan

No unit test (cosmetic JSX fix). Reviewer manual check: open the Tax System →
Tax Calculator with a calculation result; the "Tax by Category" section no longer
shows the literal `// eslint-disable...` text above the category cards.

## Done criteria

- [ ] `bun run typecheck:file src/components/tax-system/atoms/TaxCalculator.tsx` exits 0
- [ ] `grep -c "eslint-disable-next-line unused-imports/no-unused-vars" src/components/tax-system/atoms/TaxCalculator.tsx` returns one fewer than before (the JSX-child one is gone; the real-comment ones remain)
- [ ] `git diff` shows exactly one deleted line
- [ ] `plans/README.md` status row updated

## STOP conditions

- The line at ~962 is not a JSX child (it's a real comment on a statement) — then it isn't the bug; STOP and report.
- More than one line needs deleting to make typecheck pass — STOP (scope is one line).

## Maintenance notes

- Reviewer: confirm the diff is a single deleted line and no real eslint directive
  was removed. A lint rule banning `//` comments as JSX children would prevent
  recurrence but is out of scope here.
