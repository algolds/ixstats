import type { TierFilter } from "~/lib/economic-tier-filter";

export const SORT_OPTIONS = [
  { value: "name", label: "Country name" },
  { value: "population", label: "Population" },
  { value: "gdpPerCapita", label: "GDP per capita" },
  { value: "totalGdp", label: "Total GDP" },
  { value: "economicTier", label: "Economic tier" },
  { value: "continent", label: "Continent" },
  { value: "region", label: "Region" },
  { value: "landArea", label: "Land area" },
  { value: "populationDensity", label: "Population density" },
] as const;

export type SortField = (typeof SORT_OPTIONS)[number]["value"];
export type SortDirection = "asc" | "desc";
export type { TierFilter };

export interface PopulationRange {
  min?: number;
  max?: number;
}
