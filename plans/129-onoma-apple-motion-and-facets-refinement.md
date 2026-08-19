# Plan 129: Onoma Apple Motion, Facet Materials, and Ergonomic UX Refinement

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7508ff4d..HEAD -- src/app/labs/onoma/components/shared/NameResultCard.tsx src/app/labs/onoma/components/OnomaRouter.tsx src/app/labs/onoma/components/shared/GeneratorPanel.tsx`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/127-onoma-performance-code-splitting-and-lazy-lm.md
- **Category**: direction
- **Planned at**: commit `7508ff4d`, 2026-08-18
- **Status**: DONE

## Why this matters

Expanding a name result card currently shifts the entire CSS grid layout abruptly (`col-span-1 sm:col-span-2`), breaking visual continuity and spatial stability. Additionally, interactive buttons lack immediate pointer-down feedback, relying on delayed click release. Applying Apple interface principles—spring-damped layout transitions, instant press compression, optical typography tracking, and graceful `prefers-reduced-motion` fallbacks—elevates Onoma to a world-class, tactile design experience.

## Current state

- `src/app/labs/onoma/components/shared/NameResultCard.tsx:237`:
  Grid column snapping (`col-span-1 sm:col-span-2`) causes sudden reflow of neighbouring cards.
- `src/app/labs/onoma/components/OnomaRouter.tsx:528-540`:
  Stash bookmark rotation and scaling does not check `prefers-reduced-motion`.
- `src/app/labs/onoma/components/shared/NameResultCard.tsx:310`:
  Lacks negative tracking on large display names and optical sizing.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Install   | `bun install` | exit 0 |
| Tests     | `bun run test -- src/lib/onoma` | all pass |
| Lint      | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/app/labs/onoma/components/shared/NameResultCard.tsx`
- `src/app/labs/onoma/components/OnomaRouter.tsx`
- `src/app/labs/onoma/components/shared/LinguisticProfile.tsx`

**Out of scope**:
- Modifications to core tRPC routers or generation engines.

## Git workflow

- Branch: `advisor/129-onoma-motion-refinement`
- Commit style: `style(onoma): <summary>`

## Steps

### Step 1: Smooth Fluid Card Expansion with Framer Motion `layout`

In `src/app/labs/onoma/components/shared/NameResultCard.tsx`:
1. Use Framer Motion's `layout` prop on `FacetCard` or internal wrapper with a critically damped spring (`bounce: 0, duration: 0.35`).
2. Animate the `LinguisticProfile` disclosure with an accordion fade-and-slide spring transition:

```typescript
<AnimatePresence initial={false}>
  {showDetailsModal && (
    <motion.div
      initial={{ opacity: 0, height: 0, scale: 0.98 }}
      animate={{ opacity: 1, height: "auto", scale: 1 }}
      exit={{ opacity: 0, height: 0, scale: 0.98 }}
      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
      className="overflow-hidden"
    >
      <LinguisticProfile
        name={name}
        morphology={morphology}
        savedAt={savedAt}
        originLabel={originLabel}
        localSaved={localSaved}
      />
    </motion.div>
  )}
</AnimatePresence>
```

**Verify**: `bun run lint` → exit 0

### Step 2: Instant Touch-Down & Active Scale Feedback

In `src/app/labs/onoma/components/shared/NameResultCard.tsx` and `QuickGeneratorControls.tsx`:
Add instant press response on all buttons:
- Buttons: `active:scale-[0.96] transition-transform duration-100 ease-out`
- Dynamic tracking: Display name receives `tracking-[-0.015em]`, IPA monospace badges receive `tracking-[0.02em]`

**Verify**: `bun run lint` → exit 0

### Step 3: Accessibility & `prefers-reduced-motion`

In `src/app/labs/onoma/components/OnomaRouter.tsx`:
Import `useReducedMotion` from `framer-motion`:

```typescript
import { useReducedMotion } from "framer-motion";
// ...
const shouldReduceMotion = useReducedMotion();

<motion.button
  animate={
    shouldAnimateStash
      ? shouldReduceMotion
        ? { opacity: [1, 0.6, 1] }
        : { scale: [1, 1.15, 0.95, 1.05, 1] }
      : { scale: 1, opacity: 1 }
  }
  transition={{ duration: 0.4, ease: "easeInOut" }}
```

**Verify**: `bun run test -- src/lib/onoma` → all pass

## Done criteria

- [ ] Card expansion smoothly animates height and opacity without grid jarring
- [ ] Buttons provide instant physical feedback on pointer down
- [ ] Accessibility: `useReducedMotion` disables rotational shakes when user prefers reduced motion
- [ ] Status updated in `plans/README.md`

## STOP conditions

- If `height: "auto"` animation causes content clipping, ensure `overflow-hidden` is scoped only during active transition.
