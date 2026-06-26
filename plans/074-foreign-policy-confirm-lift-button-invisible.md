# Plan 074: Make the foreign-policy "Confirm Lift" button label visible at rest (not only on hover)

> **Executor instructions**: Follow step by step, verify, update this plan's row
> in `plans/README.md`. Honor STOP conditions.
>
> **Drift check (run first)**:
> `git diff --stat a5efa254..HEAD -- src/components/diplomacy/foreign-policy/ActivePoliciesList.tsx src/components/ui/button.tsx`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (UI)
- **Planned at**: commit `a5efa254`, 2026-06-17

## Why this matters

QA reported: *"Foreign policy 'confirm lift' button in pop-up appears blank when
not moused over. Functionally works fine."* The button text is invisible at rest
(text color matches the background until `:hover` sets a contrasting color),
which makes a working action look broken.

## Current state

`src/components/diplomacy/foreign-policy/ActivePoliciesList.tsx:203-210` — the
confirm button inside the lift `AlertDialog`. It uses the **default** `Button`
variant (no `variant` prop), while the adjacent Cancel uses `variant="outline"`
and renders fine:

```tsx
<AlertDialogClose asChild>
  <Button variant="outline">Cancel</Button>
</AlertDialogClose>
<AlertDialogClose asChild>
  <Button
    onClick={() => liftMutation.mutate({ actionId: policy.id })}
    disabled={liftMutation.isPending}
  >
    {liftMutation.isPending ? "Lifting..." : "Confirm Lift"}
  </Button>
</AlertDialogClose>
```

The Button variant definitions live in `src/components/ui/button.tsx` (the
shadcn/Facet button). The default variant's at-rest text color is the suspect.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Inspect variants | `grep -n "variant\|text-\|bg-" src/components/ui/button.tsx` | the variant class strings |
| Typecheck file | `bun run typecheck:file src/components/diplomacy/foreign-policy/ActivePoliciesList.tsx` | exit 0 |

## Scope

**In scope:** `src/components/diplomacy/foreign-policy/ActivePoliciesList.tsx` —
the "Confirm Lift" `<Button>` only.

**Out of scope:**
- `src/components/ui/button.tsx` — do NOT change the shared Button variants
  (would affect the whole app). Fix this one button's variant/classes.
- The `liftMutation` logic — it works; don't touch it.

## Git workflow

- Branch: `advisor/074-confirm-lift-button-visible`
- Commit: `fix(diplomacy): make Confirm Lift button label visible at rest`

## Steps

### Step 1: Reproduce and confirm the cause

Open `src/components/ui/button.tsx` and read the `default` variant's classes.
Confirm the at-rest text color matches the at-rest background (e.g. a
`text-*-foreground` that resolves to the same value as the bg in this dialog's
theme, or a `text-transparent`/hover-only text color). If the default variant
looks correct in isolation, check whether an ancestor in the AlertDialog sets a
conflicting text color. **If the cause is in `button.tsx` and affects all default
buttons, STOP and report** — that's a wider change than this plan's scope.

### Step 2: Give the Confirm button an explicit visible variant

Lifting a policy is a destructive/undo action, so the semantically correct and
guaranteed-contrast fix is to use the `destructive` variant:

```tsx
<Button
  variant="destructive"
  onClick={() => liftMutation.mutate({ actionId: policy.id })}
  disabled={liftMutation.isPending}
>
```

If `destructive` isn't the right look, use whichever existing variant renders a
visible label at rest in this dialog (confirm by eye). Do not invent new classes
if an existing variant works.

**Verify**: `bun run typecheck:file src/components/diplomacy/foreign-policy/ActivePoliciesList.tsx` → exit 0.

## Test plan

No unit test (pure styling). Reviewer manual check: open a foreign policy's Lift
dialog — "Confirm Lift" is legible without hovering; clicking still lifts the
policy.

## Done criteria

- [ ] `bun run typecheck:file src/components/diplomacy/foreign-policy/ActivePoliciesList.tsx` exits 0
- [ ] `git diff --name-only` shows only `ActivePoliciesList.tsx`
- [ ] The Confirm Lift button has an explicit, visible-at-rest variant
- [ ] `plans/README.md` status row updated

## STOP conditions

- The root cause is the shared default Button variant (affects all default buttons app-wide) → STOP and report; a global fix is out of scope.
- The button text was already visible at rest (can't reproduce) → STOP, report; the QA note may be stale or theme-specific.

## Maintenance notes

- If `destructive` was chosen, reviewer should confirm it reads as intended (a
  lift is reversible-ish; some teams prefer a neutral primary). Cosmetic, easily
  revisited.
