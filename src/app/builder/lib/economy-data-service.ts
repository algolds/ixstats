/**
 * Economy Data Service
 *
 * Data transformation and parsing utilities for economic data.
 * Handles real-world country data, economic inputs, and data persistence.
 *
 * @module economy-data-service
 */

import type { RealCountryData, EconomicInputs, EconomicComparison } from "./economy-types";

// Re-export all types and default generator
export * from "./economy-types";
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

export function generateEconomicComparisons(
  inputs: EconomicInputs,
  allCountries: RealCountryData[]
): EconomicComparison[] {
  const comparisons: EconomicComparison[] = [];

  const metricsToCompare: Array<{
    name: string;
    userValue: number;
    getValue: (country: RealCountryData) => number | undefined;
    formatValue: (value: number) => string;
    getTier: (value: number) => string;
  }> = [
    {
      name: "GDP per Capita",
      userValue: inputs.coreIndicators.gdpPerCapita,
      getValue: (c) => c.gdpPerCapita,
      formatValue: (v) => `$${v.toLocaleString()}`,
      getTier: (v) => getEconomicTier(v),
    },
    {
      name: "Population",
      userValue: inputs.coreIndicators.totalPopulation,
      getValue: (c) => c.population,
      formatValue: (v) => formatPopulationDisplay(v),
      getTier: (v) =>
        v >= 100000000 ? "Very Large" : v >= 25000000 ? "Large" : v >= 5000000 ? "Medium" : "Small",
    },
    {
      name: "Tax Revenue (% of GDP)",
      userValue: inputs.fiscalSystem.taxRevenueGDPPercent,
      getValue: (c) => c.taxRevenuePercent,
      formatValue: (v) => `${v.toFixed(1)}%`,
      getTier: (v) => (v >= 25 ? "High Tax" : v >= 15 ? "Moderate Tax" : "Low Tax"),
    },
    {
      name: "Unemployment Rate",
      userValue: inputs.laborEmployment.unemploymentRate,
      getValue: (c) => c.unemploymentRate,
      formatValue: (v) => `${v.toFixed(1)}%`,
      getTier: (v) =>
        v >= 15 ? "High Unemployment" : v >= 8 ? "Moderate Unemployment" : "Low Unemployment",
    },
  ];

  metricsToCompare.forEach((metric) => {
    const comparison = generateMetricComparison(
      metric.name,
      metric.userValue,
      allCountries,
      metric.getValue,
      metric.formatValue,
      metric.getTier
    );
    comparisons.push(comparison);
  });

  return comparisons;
}

function generateMetricComparison(
  metricName: string,
  userValue: number,
  allCountries: RealCountryData[],
  getValue: (country: RealCountryData) => number | undefined,
  formatValue: (value: number) => string,
  getTier: (value: number) => string
): EconomicComparison {
  const tolerance = 0.2;
  const minValue = userValue * (1 - tolerance);
  const maxValue = userValue * (1 + tolerance);

  const similarCountries = allCountries
    .map((country) => ({ country, value: getValue(country) }))
    .filter(
      ({ country, value }) =>
        typeof value === "number" &&
        !isNaN(value) &&
        value >= minValue &&
        value <= maxValue &&
        country.name !== "World"
    )
    .slice(0, 5)
    .map(({ country, value }) => ({
      name: country.name,
      value: value!,
      tier: getTier(value!),
    }));

  if (similarCountries.length === 0) {
    const sortedByCloseness = allCountries
      .filter((country) => country.name !== "World")
      .map((country) => {
        const val = getValue(country);
        return {
          country,
          value: val,
          difference: typeof val === "number" && !isNaN(val) ? Math.abs(val - userValue) : Infinity,
        };
      })
      .filter((item) => typeof item.value === "number" && !isNaN(item.value))
      .sort((a, b) => a.difference - b.difference)
      .slice(0, 3)
      .map(({ country, value }) => ({
        name: country.name,
        value: value!,
        tier: getTier(value!),
      }));
    similarCountries.push(...sortedByCloseness);
  }

  const userTier = getTier(userValue);
  const analysis = generateAnalysisText(
    metricName,
    userValue,
    formatValue(userValue),
    userTier,
    similarCountries
  );

  return {
    metric: metricName,
    userValue,
    comparableCountries: similarCountries,
    analysis,
    tier: userTier as EconomicComparison["tier"],
  };
}

function generateAnalysisText(
  metricName: string,
  userValue: number,
  formattedValue: string,
  tier: string,
  similarCountries: Array<{ name: string; value: number; tier: string }>
): string {
  const topSimilar = similarCountries.length > 0 ? similarCountries[0] : null;

  if (!topSimilar) {
    return `Your ${metricName.toLowerCase()} of ${formattedValue} places you in the '${tier}' category. No closely comparable countries found in the dataset.`;
  }

  const comparisonValue = topSimilar.value;
  const comparison =
    userValue > comparisonValue
      ? "higher than"
      : userValue < comparisonValue
        ? "lower than"
        : "similar to";

  const percentDiff =
    comparisonValue !== 0 ? Math.abs(((userValue - comparisonValue) / comparisonValue) * 100) : 0;

  let analysis = `Your ${metricName.toLowerCase()} of ${formattedValue} is ${comparison} ${topSimilar.name}`;

  if (percentDiff > 1 && userValue !== comparisonValue) {
    analysis += ` (by ${percentDiff.toFixed(0)}%)`;
  }

  analysis += `. This places your nation in the '${tier}' category for this metric`;

  if (similarCountries.length > 1) {
    const otherNames = similarCountries.slice(1, 3).map((c) => c.name);
    if (otherNames.length > 0) {
      analysis += `, comparable to nations like ${otherNames.join(" and ")}`;
    }
  }
  analysis += ".";

  return analysis;
}

function formatPopulationDisplay(population: number): string {
  if (isNaN(population)) return "N/A";
  if (population >= 1000000000) return `${Math.round(population / 1000000000)}B`;
  if (population >= 1000000) return `${Math.round(population / 1000000)}M`;
  if (population >= 1000) return `${(population / 1000).toFixed(0)}K`;
  return population.toString();
}

export function saveBaselineToStorage(inputs: EconomicInputs): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "ixeconomy_baseline",
        JSON.stringify({
          ...inputs,
          timestamp: Date.now(),
        })
      );
    }
  } catch {
    // Failed to save baseline to localStorage
  }
}

export function loadBaselineFromStorage(): EconomicInputs | null {
  try {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ixeconomy_baseline");
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      // oxlint-disable-next-line eslint/no-unused-vars
      const { timestamp, ...inputs } = parsed;
      return inputs;
    }
    return null;
  } catch {
    return null;
  }
}
