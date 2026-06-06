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

import type { ComponentType } from "react";

import { EconomyBuilderPage } from "./EconomyBuilderPage";
export { EconomyBuilderPage };

export const EconomicArchetypeDisplay = lazy<ComponentType<any>>(() =>
  import("./EconomicArchetypeDisplay").then((module) => ({
    default: module.EconomicArchetypeDisplay,
  }))
);

export const IntegrationTestingDisplay = lazy<ComponentType<any>>(() =>
  import("./IntegrationTestingDisplay").then((module) => ({
    default: module.IntegrationTestingDisplay,
  }))
);

export const InteractivePreview = lazy<ComponentType<any>>(() =>
  import("./InteractivePreview").then((module) => ({ default: module.InteractivePreview }))
);
