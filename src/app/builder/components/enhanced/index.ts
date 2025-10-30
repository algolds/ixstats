/**
 * Enhanced Builder Components - Main exports
 *
 * Large components are lazy-loaded to improve bundle size and initial load performance.
 * Smaller components are eagerly loaded for immediate availability.
 */

import { lazy } from "react";

// Eager exports for small/critical components
export { CountrySelector } from "./CountrySelector";
export { EconomicCustomizationHub } from "./EconomicCustomizationHub";
export { EconomyBuilderSidebar } from "./EconomyBuilderSidebar";

// Lazy-loaded large components (code-split)
export const EconomyBuilderPage = lazy(() =>
  import("./EconomyBuilderPage").then((module) => ({ default: module.EconomyBuilderPage }))
);

export const EconomicArchetypeDisplay = lazy(() =>
  import("./EconomicArchetypeDisplay").then((module) => ({
    default: module.EconomicArchetypeDisplay,
  }))
);

export const IntegrationTestingDisplay = lazy(() =>
  import("./IntegrationTestingDisplay").then((module) => ({
    default: module.IntegrationTestingDisplay,
  }))
);

export const InteractivePreview = lazy(() =>
  import("./InteractivePreview").then((module) => ({ default: module.InteractivePreview }))
);
