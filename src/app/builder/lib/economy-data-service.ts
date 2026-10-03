/**
 * Economy Data Service
 *
 * Data transformation and parsing utilities for economic data.
 * Handles real-world country data, economic inputs, and data persistence.
 */

import type { RealCountryData } from "~/types/builder";

// Re-export all types and default generator
export * from "~/types/builder";
export * from "./default-economic-inputs";

let cachedEconomyData: RealCountryData[] | null = null;

export async function parseEconomyData(): Promise<RealCountryData[]> {
  if (cachedEconomyData) return cachedEconomyData;
  const mod = await import("./economy-data.json");
  cachedEconomyData = (mod.default || mod) as RealCountryData[];
  return cachedEconomyData;
}

export function getEconomicTier(
  gdpPerCapita: number
): "Developing" | "Emerging" | "Developed" | "Advanced" {
  if (gdpPerCapita >= 50000) return "Advanced";
  if (gdpPerCapita >= 25000) return "Developed";
  if (gdpPerCapita >= 10000) return "Emerging";
  return "Developing";
}
