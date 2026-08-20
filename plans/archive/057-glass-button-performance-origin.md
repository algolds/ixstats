# 057 — Resolve double-transition and scale(0) on GlassButton

- **Status**: DONE
- **Commit**: 397885d6
- **Severity**: HIGH
- **Category**: 5. Performance / 3. Physicality & Origin
- **Estimated scope**: 1 file (src/components/ui/glass-button.tsx)

## Problem

1. **Double-Transition Conflict**: The main button element in [glass-button.tsx](file:///home/jxsig/projects/ixstats/src/components/ui/glass-button.tsx#L115) contains the Tailwind class `transition-all duration-200` on the outer element, while simultaneously utilizing Framer Motion's `whileHover` and `whileTap` transforms via dynamic spring physics [glass-button.tsx:145-147](file:///home/jxsig/projects/ixstats/src/components/ui/glass-button.tsx#L145-L147). This causes the browser's CSS transition engine to fight Framer Motion's inline style modifications on `transform` and `scale`, resulting in double rendering transitions, visual jitter, and heavy style recalculations under load.
2. **`scale(0)` Hover Ripple**: The background hover ripple [glass-button.tsx:195](file:///home/jxsig/projects/ixstats/src/components/ui/glass-button.tsx#L195) scales up from `scale: 0`, violating the design engineering guideline that interface elements should never emerge from absolute zero.

```tsx
/* src/components/ui/glass-button.tsx:115 — current */
"relative overflow-hidden rounded-xl border transition-all duration-200",

/* src/components/ui/glass-button.tsx:195 — current */
initial={{ scale: 0, opacity: 0 }}
whileHover={{ scale: 1, opacity: 0.3 }}
transition={{ duration: 0.3 }}
```

## Target

1. Use targeted transitions (`transition-colors duration-200`) in the CSS classes for styling properties like background, border-color, and outline, leaving all scaling and displacement transforms entirely to Framer Motion.
2. Adjust the initial scale of the hover ripple to start from `scale: 0.9` and fade in/out smoothly.

```tsx
/* target */
"relative overflow-hidden rounded-xl border transition-colors duration-200",

/* target hover ripple */
initial={{ scale: 0.9, opacity: 0 }}
whileHover={{ scale: 1, opacity: 0.3 }}
transition={{ duration: 0.2, ease: "easeOut" }}
```

## Repo conventions to follow

- Easing and spring defaults live in `src/components/mycountry/primitives/tabs/TabMotionConfig.ts`.
- The hover transition should be responsive and crisp; standard duration for hovers is under 200ms.

## Steps

1. In [glass-button.tsx](file:///home/jxsig/projects/ixstats/src/components/ui/glass-button.tsx), modify the `className` template array to replace `"relative overflow-hidden rounded-xl border transition-all duration-200"` with `"relative overflow-hidden rounded-xl border transition-colors duration-200"`.
2. In [glass-button.tsx](file:///home/jxsig/projects/ixstats/src/components/ui/glass-button.tsx), locate the hover ripple `<motion.div>` on line 190 and modify its framer motion props to:
   ```tsx
   initial={{ scale: 0.9, opacity: 0 }}
   whileHover={{ scale: 1, opacity: 0.3 }}
   transition={{ duration: 0.2, ease: "easeOut" }}
   ```

## Boundaries

- Do NOT modify any other classes or props on the button.
- Do NOT change the layout structures or other child elements inside the button.

## Verification

### Mechanical
- Run standard typecheck of UI subproject:
  ```bash
  bun run typecheck:ui
  ```
- Run linter to ensure no syntax/formatting errors:
  ```bash
  bun run lint
  ```

### Feel check
- Hover over any `<GlassButton>` (such as in MyCountry tabs). Verify:
  - There is zero visual stutter or jitter on hover/tap.
  - The hover ripple fades in smoothly from a scale of `0.9` instead of snapping from absolute zero.
  - Toggle `prefers-reduced-motion` and ensure no horizontal/vertical shifts occur but color transitions still apply.

- **Done when**: `glass-button.tsx` compiles cleanly and double-transitions are resolved.
