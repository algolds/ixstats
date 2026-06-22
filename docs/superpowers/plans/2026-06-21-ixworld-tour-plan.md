# IxWorld Cinematic Tour & Demo Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium, 3D animated tour mode on the IxWorld map that visits 6 core nations (Caphiria, Fiannria, Faneria, Kiravia, Tierrador, and Daxia), displaying beautiful info overlays and a progress indicator before moving to the next country, with manual control overlays.

**Architecture:** Use a custom React hook `useMapTour` inside the map context/state to manage the tour state machine, handle asynchronous camera transition end events, run timers, and render a floating glassmorphic `<TourHUD />` panel.

**Tech Stack:** React 19, Lucide React, MapLibre GL JS, Tailwind CSS 4.

---

## Global Constraints
- **Package manager**: `bun` (never npm/yarn/pnpm).
- **TypeScript limits**: NEVER run `tsc --noEmit` globally. Use `bun run dev` for incremental type checks.
- **Tailwind CSS v4**: Uses modern theme mapping. No `tailwind.config.js`.

---

## File Structure & Proposed Changes

### Component Changes
1. [NEW] **useMapTour hook**: [useMapTour.ts](file:///ixwiki/public/projects/ixstats/src/components/maps/core/hooks/useMapTour.ts) — manages state, timers, and MapLibre events.
2. [NEW] **TourHUD component**: [TourHUD.tsx](file:///ixwiki/public/projects/ixstats/src/components/maps/core/components/TourHUD.tsx) — renders the overlay card with controls, blurb, progress, and live statistics.
3. [MODIFY] **MapWelcomeModal**: [MapWelcomeModal.tsx](file:///ixwiki/public/projects/ixstats/src/components/maps/core/MapWelcomeModal.tsx) — adds the "Take a Tour" button.
4. [MODIFY] **MapContainer**: [MapContainer.tsx](file:///ixwiki/public/projects/ixstats/src/components/maps/core/MapContainer.tsx) — integrates hook and HUD component.

---

### Task 1: Create the useMapTour Hook

Create the custom hook to manage all transitions, step data, state, progress bar timers, and MapLibre interaction handlers.

**Files:**
- Create: `src/components/maps/core/hooks/useMapTour.ts`

**Interfaces:**
- Consumes: MapLibre Map instance via React ref.
- Produces: `useMapTour` hook returning `{ tourState, currentStepIndex, isPaused, progress, startTour, exitTour, nextStep, prevStep, togglePause, currentStepData }`.

- [ ] **Step 1: Write static coordinates and blurbs config**

Define the static centroids (derived from doc specs) and fallback descriptions for the 6 countries in `useMapTour.ts`:

```typescript
export interface TourStep {
  name: string;
  featureId: string;
  countryId: string;
  fallbackCapital: string;
  fallbackBlurb: string;
  camera: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  };
}

export const TOUR_STEPS: TourStep[] = [
  {
    name: "Caphiria",
    featureId: "caphiria",
    countryId: "caphiria",
    fallbackCapital: "Caphiria City",
    fallbackBlurb: "Sarpedon's preeminent empire, characterized by its classical military heritage and administrative centralization.",
    camera: { center: [15.0, -25.0], zoom: 4.2, pitch: 45, bearing: 15 }
  },
  {
    name: "Fiannria",
    featureId: "fiannria",
    countryId: "fiannria",
    fallbackCapital: "Fiannria Harbor",
    fallbackBlurb: "A historic maritime gateway in Levantia, pivotal in regional trade corridors across the Kilikas Sea.",
    camera: { center: [18.0, 50.0], zoom: 4.8, pitch: 35, bearing: -20 }
  },
  {
    name: "Faneria",
    featureId: "faneria",
    countryId: "faneria",
    fallbackCapital: "Faneria Harbor",
    fallbackBlurb: "Located on the Gallia Magna coast of Levantia, a industrial powerhouse built on engineering and maritime commerce.",
    camera: { center: [10.0, 52.0], zoom: 5.0, pitch: 40, bearing: 30 }
  },
  {
    name: "Kiravia",
    featureId: "kiravia",
    countryId: "kiravia",
    fallbackCapital: "Kiravia Prime",
    fallbackBlurb: "The expansive northern state of Kiroborea, boasting massive natural resource industries and high technological research hubs.",
    camera: { center: [80.0, 60.0], zoom: 4.5, pitch: 50, bearing: 45 }
  },
  {
    name: "Tierrador",
    featureId: "tierrador",
    countryId: "tierrador",
    fallbackCapital: "Tierrador Port",
    fallbackBlurb: "The gateway of South Crona, critical for agricultural exports and raw mineral shipping routes.",
    camera: { center: [-90.0, -30.0], zoom: 4.4, pitch: 30, bearing: -15 }
  },
  {
    name: "Daxia",
    featureId: "daxia",
    countryId: "daxia",
    fallbackCapital: "Daxia Harbor",
    fallbackBlurb: "Audonia's southern trading hub, dominating commerce in the Levantine Ocean and Southeast Asian routes.",
    camera: { center: [95.0, 18.0], zoom: 4.6, pitch: 45, bearing: 25 }
  }
];
```

- [ ] **Step 2: Scaffolding the useMapTour hook state machine**

Implement state machine transitions:
- `startTour()`: Sets projection to `dynamic`, sets zoom to `1.8`, center to `[56.1842, 0]`, pitch `0`, bearing `0`, and schedules transition to Caphiria.
- `exitTour()`: Sets state to `idle`, resets map bearing/pitch to defaults, and restores user controls.
- `nextStep()` / `prevStep()`: Moves step index, flies camera.
- `moveend` listener: When MapLibre stops moving, if `state === "flying"`, switches to `paused_at_step` and starts progress bar timer.

---

### Task 2: Create the TourHUD Overlay Component

Create the floating HUD overlay which displays controls, progress bars, descriptions, and queries dynamic stats via tRPC.

**Files:**
- Create: `src/components/maps/core/components/TourHUD.tsx`

**Interfaces:**
- Consumes: useMapTour hook outputs, tRPC routers.
- Produces: `<TourHUD />` React component.

- [ ] **Step 1: Write TourHUD.tsx structure and glassmorphic styling**

Use backdrop-blur and border highlights to create a premium visual theme.

```tsx
import { Play, Pause, ChevronRight, ChevronLeft, X, Landmark, Users, TrendingUp } from "lucide-react";
// Sourcing dynamic stats from TRPC
import { api } from "~/trpc/react";
```

- [ ] **Step 2: Add dynamic stat fetching with fallback**

Wire `api.countries.getWikiRichIntro` and demographic indicators inside `TourHUD` for the active step. If loading or absent, gracefully fallback to the pre-written static text.

---

### Task 3: Integrate with Welcome Modal and Container

Wire the tour triggers into the welcome modal and mount the tour HUD in the main map canvas.

**Files:**
- Modify: `src/components/maps/core/MapWelcomeModal.tsx`
- Modify: `src/components/maps/core/MapContainer.tsx`

- [ ] **Step 1: Update Welcome Modal buttons**

Add a "Take a Tour" button next to "Start Exploring" on the final page of `MapWelcomeModal.tsx`.

- [ ] **Step 2: Mount useMapTour and HUD in MapContainer.tsx**

Render `<TourHUD />` inside the absolute parent container, passing down the hook handles. Disable user country interactions when tour is active.

---

## Verification Plan

### Automated Tests
- Validate TypeScript compilation of modified files:
  `bun run typecheck:file src/components/maps/core/MapContainer.tsx`
  `bun run typecheck:file src/components/maps/core/hooks/useMapTour.ts`

### Manual Verification
1. Run local dev server: `bun run dev`
2. Open `http://localhost:3000/maps` in a browser.
3. Click "Take a Tour" on the Welcome Modal.
4. Verify the camera flies from globe view to Caphiria, Fiannria, Faneria, Kiravia, Tierrador, and Daxia.
5. Check that the HUD displays matching blurbs and progress indicators.
6. Verify pausing, skipping, going back, and exiting work correctly.
