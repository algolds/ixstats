# Spec: MyCountry Builder Performance, Animation & Usability Update

**Date:** July 16, 2026  
**Status:** Pending Review  
**Subsystems affected:** MyCountry Builder (`/builder`) state, router, navigation, steps, card components, and economic tab displays.

---

## 1. Goal Description
The MyCountry Builder is a core standalone system that allows users to create and edit countries. Currently, the system experiences performance lag during typing/slider dragging, double-animations (where multiple elements transition simultaneously), and minor usability gaps.

This design document outlines a unified layer-by-layer update to:
1. Optimize state updates, debouncing heavy deep-equality comparisons to keep the main thread free.
2. Clean up animations, establishing the router as the single source of truth for step transitions, re-enabling transition wait modes, and unifying spring interactions.
3. Enhance usability by adding step completion indicators, number-rolling animations using `@number-flow/react`, and synergy/conflict visual indicators.

---

## 2. User Review Required

> [!IMPORTANT]
> The performance fixes defer the `isEqual` deep-comparison check to the debounced local storage save function (500ms). This means the visual "Last Saved" timestamp will update 500ms after user interaction ceases instead of instantly during typing. This is the correct DX/UX tradeoff to prevent frame drops.

---

## 3. Proposed Changes

We will implement the refactoring sequentially under three technical layers.

### Layer 1: State & Performance Optimizations

#### [MODIFY] [useBuilderState.ts](file:///home/jxsig/projects/ixstats/src/app/builder/hooks/useBuilderState.ts)
- Introduce a mutable `lastSavedStateRef` inside the hook.
- Move the render-blocking `isEqual(prevBuilderStateRef.current, builderState)` deep-comparison inside the debounced `saveState` callback.
- The `useEffect` hook itself will now immediately trigger a `setTimeout` without running any blocking calculations. Only when the timeout fires (500ms after the last state update) will the deep comparison check if the state is dirty and save it to `localStorage`.

#### [MODIFY] [AtomicBuilderPage.tsx](file:///home/jxsig/projects/ixstats/src/app/builder/components/enhanced/AtomicBuilderPage.tsx)
- Add O(1) reference equality checks (`===`) before calling `isEqual` inside the synchronization `useEffect` blocks:
  - Check `builderState.governmentComponents === lastProcessedGovComponentsRef.current`
  - Check `govStructure === lastProcessedGovStructureRef.current`
- This immediately exits the effects if the sub-properties haven't changed reference, preventing unnecessary deep traversals on other step interactions.

---

### Layer 2: Animation & Motion System Refactor

#### [MODIFY] [StepContent.tsx](file:///home/jxsig/projects/ixstats/src/app/builder/components/enhanced/sections/StepContent.tsx)
- Remove `<AnimatePresence mode="wait">` and the outer `<motion.div>` wrapper around the step card.
- Simplify `StepContent` to return a static layout container with the `CutoutCard`, preventing double-animations on step changes.

#### [MODIFY] [AtomicBuilderPage.tsx](file:///home/jxsig/projects/ixstats/src/app/builder/components/enhanced/AtomicBuilderPage.tsx)
- Remove the `<motion.div>` wrapper around the `FoundationStep` (`key="foundation"`) to prevent double translation when entering the foundation step.

#### [MODIFY] [BuilderRouter.tsx](file:///home/jxsig/projects/ixstats/src/app/builder/components/BuilderRouter.tsx)
- Re-enable `mode="wait"` on the parent `<AnimatePresence>` to enforce a clean cross-fade where the outgoing step fully exits before the incoming step renders.
- Update the transition curve on the step container `motion.div` to a custom responsive ease-out curve (`ease: [0.23, 1, 0.32, 1]`) with a `0.25s` duration.

#### [MODIFY] [CountryFocusCardBuilder.tsx](file:///home/jxsig/projects/ixstats/src/app/builder/components/CountryFocusCardBuilder.tsx)
- Replace the dual hover-enter spring and hover-exit tween transitions with a single, unified, interruptible spring curve: `transition={{ type: "spring", stiffness: 260, damping: 26 }}` for both enter and exit.
- Tweak the hover parameters slightly (`scale: 1.05`, `y: -8`, `rotateZ: 0.5`) to feel crisp and dashboard-appropriate.
- Remove the nested text-scale animator to avoid redundant layout calculations.

#### [MODIFY] [FoundationStep.tsx](file:///home/jxsig/projects/ixstats/src/app/builder/components/enhanced/steps/FoundationStep.tsx)
- Apply Framer Motion grid stagger variants to the archetype selection grid.
- Stagger children entry by `0.04s` with a slight vertical slide up.

---

### Layer 3: Usability & UI Polish

#### [MODIFY] [BuilderStepNav.tsx](file:///home/jxsig/projects/ixstats/src/app/builder/components/BuilderStepNav.tsx)
- Add a spring scale-up animation to the step-completed checkmark icon:
  ```tsx
  <motion.span
    initial={{ scale: 0, rotate: -20 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ type: "spring", stiffness: 300, damping: 15 }}
  >
    <Check className="h-3 w-3" />
  </motion.span>
  ```

#### [MODIFY] [EconomySectorsTab.tsx](file:///home/jxsig/projects/ixstats/src/app/builder/components/enhanced/tabs/EconomySectorsTab.tsx) & [LaborEmploymentTab.tsx](file:///home/jxsig/projects/ixstats/src/app/builder/components/enhanced/tabs/LaborEmploymentTab.tsx)
- Import `NumberFlow` from `@number-flow/react`.
- Wrap the GDP share percentage displays, workforce distribution figures, and income metrics in `<NumberFlow />` so value transitions roll smoothly when sliders are dragged or presets are applied.

---

## 4. Verification Plan

### Automated Tests
- Run `bun run test:builder-perf` to check database transaction latency.
- Run `bun run typecheck:ui` to verify compiler safety on all modified builder files.

### Manual Verification
- **Typing Test:** Open `/builder`, edit the country name, and ensure input is immediate without frame drops.
- **Slider Dragging Test:** Go to the Economics step, slide sectors or labor metrics, and check for smooth value rendering and slider responsiveness.
- **Step Navigation Crossfade:** Click between step headers and verify that the outgoing step fully fades out before the incoming step slides and fades in, with no layout jumping or overlapping components.
- **Interruptible Card Hovers:** Hover rapidly in and out of faction cards to verify that cards animate smoothly without hard snaps.
- **rolling Numbers:** Select different economic archetypes and verify that GDP sector percentages roll smoothly to their new values.
