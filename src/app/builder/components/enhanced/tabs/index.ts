/**
 * Lazy-loaded tab components for Economy Builder
 *
 * Using React lazy loading to reduce initial bundle size and improve performance.
 * Each tab component is code-split and loaded on demand when the user navigates to it.
 */

import { lazy } from "react";

// Lazy load tab components
export const DemographicsPopulationTab = lazy(() =>
  import("./DemographicsPopulationTab").then((module) => ({
    default: module.DemographicsPopulationTab,
  }))
);

export const LaborEmploymentTab = lazy(() =>
  import("./LaborEmploymentTab").then((module) => ({ default: module.LaborEmploymentTab }))
);

export const EconomySectorsTab = lazy(() =>
  import("./EconomySectorsTab").then((module) => ({ default: module.EconomySectorsTab }))
);

export const EconomyPreviewTab = lazy(() =>
  import("./EconomyPreviewTab").then((module) => ({ default: module.EconomyPreviewTab }))
);
