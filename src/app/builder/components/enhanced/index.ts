/**
 * Enhanced Builder Components - Main exports
 *
 * Large components are lazy-loaded to improve bundle size and initial load performance.
 * Smaller components are eagerly loaded for immediate availability.
 */

import { lazy } from "react";

// Eager exports for small/critical components
export { CountrySelector } from "./CountrySelector";

import type { ComponentType } from "react";

import { EconomyBuilderPage } from "./EconomyBuilderPage";
export { EconomyBuilderPage };

import type { EconomicArchetypeDisplayProps } from "./EconomicArchetypeDisplay";

export const EconomicArchetypeDisplay = lazy<ComponentType<EconomicArchetypeDisplayProps>>(() =>
  import("./EconomicArchetypeDisplay").then((module) => ({
    default: module.EconomicArchetypeDisplay,
  }))
);

