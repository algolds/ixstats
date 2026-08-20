# 058 — Optimize Sidebar Layout Navigation Transition

- **Status**: DONE
- **Commit**: 397885d6
- **Severity**: HIGH
- **Category**: 2. Easing & Duration / 5. Performance
- **Estimated scope**: 1 file (src/components/mycountry/MyCountrySidebarLayout.tsx)

## Problem

When the user navigates between sections in the MyCountry single-page app (e.g. Overview to Executive to Diplomacy), the active theme classes are swapped (`theme.borderClass` and `theme.shadowClass`). Currently, the layout transition is defined on the container [MyCountrySidebarLayout.tsx:113](file:///home/jxsig/projects/ixstats/src/components/mycountry/MyCountrySidebarLayout.tsx#L113) with `transition-all duration-500 ease-in-out`.
1. **Sluggishness**: A 500ms transition is sluggish for core page routing, making tab shifts feel laggy and heavy.
2. **Layout Thrashing**: Using `transition-all` triggers CSS transitions on all properties of the container (including layout-altering parameters if any change), which runs reflow and paint cycles on the main thread for the entire page's children.

```tsx
/* src/components/mycountry/MyCountrySidebarLayout.tsx:113 — current */
"rounded-t-xl border-t-2 pt-2 transition-all duration-500 ease-in-out",
```

## Target

Replace the global `transition-all` with targeted transitions on border-color and box-shadow only, and speed up the animation to 200ms using the standard `ease-out` responsive curve.

```tsx
/* target */
"rounded-t-xl border-t-2 pt-2 transition-[border-color,box-shadow] duration-200 ease-out",
```

## Repo conventions to follow

- Easing curves forEntering/Exiting/Routing elements default to `ease-out` or custom `cubic-bezier(0.23, 1, 0.32, 1)`.
- Core interactive navigation responses should complete within 150–250ms.

## Steps

1. In [MyCountrySidebarLayout.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/MyCountrySidebarLayout.tsx), locate line 113:
   ```tsx
   "rounded-t-xl border-t-2 pt-2 transition-all duration-500 ease-in-out",
   ```
2. Replace it with:
   ```tsx
   "rounded-t-xl border-t-2 pt-2 transition-[border-color,box-shadow] duration-200 ease-out",
   ```

## Boundaries

- Do NOT change other classes or structural markup in the sidebar layout.
- Do NOT touch the sidebar navigation items.

## Verification

### Mechanical
- Run typecheck to verify compiling:
  ```bash
  bun run typecheck:ui
  ```
- Run linter to ensure no style issues:
  ```bash
  bun run lint
  ```

### Feel check
- Open the `/mycountry` dashboard. Navigate between different tabs (Overview, Executive, Diplomacy, etc.).
- Confirm that:
  - The color transitions are responsive and feel snapped but smooth (200ms).
  - The content panel transitions without any micro-lag or layout jumps.
  
- **Done when**: `MyCountrySidebarLayout.tsx` has targeted transitions and section theme changes complete within 200ms.
