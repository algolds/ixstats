# 059 — Align EnhancedTooltip Transform Origin to Trigger

- **Status**: DONE
- **Commit**: 397885d6
- **Severity**: MEDIUM
- **Category**: 3. Physicality & Origin
- **Estimated scope**: 1 file (src/components/ui/enhanced-tooltip.tsx)

## Problem

The [EnhancedTooltip](file:///home/jxsig/projects/ixstats/src/components/ui/enhanced-tooltip.tsx) component renders tooltips with an entrance scale/fade animation. However, it does not specify a transform origin on its absolute wrapper `<motion.div>` [enhanced-tooltip.tsx:166](file:///home/jxsig/projects/ixstats/src/components/ui/enhanced-tooltip.tsx#L166). As a result, the tooltip scales from its own center rather than originating physically from the trigger point.

```tsx
/* src/components/ui/enhanced-tooltip.tsx:182 — current */
          style={{
            left: coordinates.x,
            top: coordinates.y,
            zIndex,
          }}
```

## Target

Apply a dynamic `transformOrigin` to the tooltip style property depending on its position relative to the trigger.
- When positioned `top`, it should scale from `bottom center`.
- When positioned `bottom`, it should scale from `top center`.
- When positioned `left`, it should scale from `right center`.
- When positioned `right`, it should scale from `left center`.

```tsx
/* target style */
          style={{
            left: coordinates.x,
            top: coordinates.y,
            zIndex,
            transformOrigin:
              tooltipPosition === "top"
                ? "bottom center"
                : tooltipPosition === "bottom"
                  ? "top center"
                  : tooltipPosition === "left"
                    ? "right center"
                    : tooltipPosition === "right"
                      ? "left center"
                      : "center",
          }}
```

## Repo conventions to follow

- Radix popovers and tooltips use dynamic transform origins, e.g. `origin-[var(--radix-tooltip-content-transform-origin)]`.
- Inline styles in Framer Motion components can directly control transform origins.

## Steps

1. In [enhanced-tooltip.tsx](file:///home/jxsig/projects/ixstats/src/components/ui/enhanced-tooltip.tsx), find the `<motion.div>` style prop on line 182:
   ```tsx
   style={{
     left: coordinates.x,
     top: coordinates.y,
     zIndex,
   }}
   ```
2. Update it to include `transformOrigin`:
   ```tsx
   style={{
     left: coordinates.x,
     top: coordinates.y,
     zIndex,
     transformOrigin:
       tooltipPosition === "top"
         ? "bottom center"
         : tooltipPosition === "bottom"
           ? "top center"
           : tooltipPosition === "left"
             ? "right center"
             : tooltipPosition === "right"
               ? "left center"
               : "center",
   }}
   ```

## Boundaries

- Do NOT change coordinates calculations or placement logic.
- Do NOT touch the arrow layout positioning classes in `getArrowClasses()`.

## Verification

### Mechanical
- Run typechecking of UI components:
  ```bash
  bun run typecheck:ui
  ```
- Verify linter runs clean:
  ```bash
  bun run lint
  ```

### Feel check
- Navigate to pages displaying tooltips (e.g. MyCountry Tab System metrics tooltips).
- Hover on various metrics to trigger tooltips.
- Inspect the entrance animation in slow motion (10% speed). Confirm that:
  - Tooltips that appear above their trigger scale outwards starting from their bottom edge.
  - Tooltips that appear below their trigger scale outwards starting from their top edge.

- **Done when**: `enhanced-tooltip.tsx` has dynamic `transformOrigin` applied based on the calculated `tooltipPosition`.
