/**
 * Core domain types for Countries Profile page (/countries/[slug])
 */

/** Generic Branded Type helper to prevent primitive obsession */
type Brand<T, B extends string> = T & { readonly __brand: B };

/** Branded domain types */
type CountrySlug = Brand<string, "CountrySlug">;
/** Type helpers for creating branded values safely */
export const toCountrySlug = (slug: string): CountrySlug => slug as CountrySlug;
/** Banner Mode options */
export type BannerMode = "dynamic" | "flag" | "gradient" | "custom";

/**
 * Top-level navigation: the Factbook (the country's own URL, which opens on its overview) and
 * the Dossier and Activity deep-dives.
 */
export type ProfileTabType = "factbook" | "dossier" | "activity";

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

/** Vitality telemetry scores as computed by the server; null when there is no record (shown as "—"). */
export interface VitalityData {
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number | null;
  governmentalEfficiency: number | null;
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
