/**
 * Core domain types for Countries Profile page (/countries/[slug])
 */

/** Generic Branded Type helper to prevent primitive obsession */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Branded domain types */
export type CountrySlug = Brand<string, "CountrySlug">;
export type CountryId = Brand<string, "CountryId">;

/** Type helpers for creating branded values safely */
export const toCountrySlug = (slug: string): CountrySlug => slug as CountrySlug;
export const toCountryId = (id: string): CountryId => id as CountryId;

/** Banner Mode options */
export type BannerMode = "dynamic" | "flag" | "gradient" | "custom";

/** Top-level navigation: the profile itself and its three deep-dive routes. */
export type ProfileTabType = "profile" | "factbook" | "dossier" | "activity";

/** Activity feed filters */
export type ActivityFilter = "all" | "posts" | "economic" | "diplomatic" | "social";
export type ActivityTimeRange = "7d" | "30d" | "90d";

/** Base Country attributes required across header & layout */
export interface BaseCountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  adjustedGdpGrowth?: number | null;
  landArea?: number | null;
  continent?: string | null;
  populationDensity?: number | null;
  populationGrowthRate?: number | null;
}

/** Vitality telemetry scores calculated from country stats */
export interface VitalityData {
  economicVitality: number;
  populationWellbeing: number;
  /** From the country's diplomatic record; null when it has none (shown as "—"). */
  diplomaticStanding: number | null;
  governmentalEfficiency: number;
}

/** Metric card format used in country metrics display grids */
export interface MetricCardData {
  label: string;
  value: string;
  subtext: string;
  colorClass: string;
  tooltip: {
    title: string;
    details: string[];
  };
}

/** Activity Feed Item shape */
export interface CountryActivityItem {
  id: string;
  type: string;
  source: string;
  title: string;
  description: string;
  timestamp: Date;
  engagement?: {
    likes: number;
    comments: number;
    shares?: number;
  } | null;
  metadata?: Record<string, unknown> | null;
}
