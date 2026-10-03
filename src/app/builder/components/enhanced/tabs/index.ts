/**
 * Lazy-loaded tab components for Economy Builder
 *
 * Using React lazy loading to reduce initial bundle size and improve performance.
 * Each tab component is code-split and loaded on demand when the user navigates to it.
 */

import { lazy } from "react";

// Lazy load tab components
export const EconomySectorsTab = lazy(() =>
  import("./EconomySectorsTab").then((module) => ({ default: module.EconomySectorsTab }))
);

export const WorkforceSocietyTab = lazy(() =>
  import("./WorkforceSocietyTab").then((module) => ({ default: module.WorkforceSocietyTab }))
);
