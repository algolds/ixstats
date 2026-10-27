/**
 * The population details modal's pure parts: chart points on the nation's realm clock, the
 * population tiers, and the performance summary (growth, global comparison, rank, density).
 */
import { realmYear } from "~/lib/realms/nation-time";
import { formatRealmDate, type RealmCalendar } from "~/lib/realms/realm-clock";

export interface PopulationChartDataPoint {
  year: number;
  population: number;
  populationGrowthRate: number;
  populationDensity: number | null;
  totalGdp: number;
  timestamp: number;
  date: string;
}

/**
 * Fields this modal reads from `countries.getByIdWithEconomicData`, whose router
 * output is currently untyped (the procedure casts its return value).
 */
export interface PopulationCountryData {
  currentPopulation: number;
  populationGrowthRate: number;
  populationDensity?: number | null;
  landArea?: number | null;
  economicTier: string;
  urbanPopulationPercent?: number | null;
  ruralPopulationPercent?: number | null;
}

export const POPULATION_TIERS = [
  { name: "Tier 1", min: 0, max: 9_999_999, description: "0-9.99M" },
  { name: "Tier 2", min: 10_000_000, max: 29_999_999, description: "10-29.99M" },
  { name: "Tier 3", min: 30_000_000, max: 49_999_999, description: "30-49.99M" },
  { name: "Tier 4", min: 50_000_000, max: 79_999_999, description: "50-79.99M" },
  { name: "Tier 5", min: 80_000_000, max: 119_999_999, description: "80-119.99M" },
  { name: "Tier 6", min: 120_000_000, max: 349_999_999, description: "120-349.99M" },
  { name: "Tier 7", min: 350_000_000, max: 499_999_999, description: "350-499.99M" },
  { name: "Tier X", min: 500_000_000, max: Infinity, description: "500M+" },
];

/** A point on the country's realm clock, dated and yeared in its calendar. */
export function toChartPoint(
  point: {
    population?: number;
    populationGrowthRate?: number;
    populationDensity?: number | null;
    totalGdp?: number;
  },
  rawTimestamp: string | number | Date,
  calendar: RealmCalendar
): PopulationChartDataPoint {
  const timestamp =
    typeof rawTimestamp === "number" ? rawTimestamp : new Date(rawTimestamp).getTime();
  return {
    year: realmYear(timestamp, calendar),
    population: Number(point?.population ?? 0),
    populationGrowthRate: Number(point?.populationGrowthRate ?? 0) * 100,
    populationDensity: point.populationDensity ?? null,
    totalGdp: point.totalGdp ?? 0,
    timestamp,
    date: formatRealmDate(timestamp, calendar),
  };
}

export interface PerformanceMetrics {
  growth: number;
  globalComparison: number;
  globalAverage: number;
  rank: number;
  totalCountries: number;
  density: number;
}

export interface GlobalStats {
  count: number;
  totalPopulation: number;
}

/** Growth between the last two chart points when there are two, else the live rate. */
function trailingGrowth(chartData: PopulationChartDataPoint[], liveGrowthRate: number): number {
  const [previous, current] = chartData.slice(-2);
  if (!previous || !current || previous.population <= 0) return liveGrowthRate;
  return ((current.population - previous.population) / previous.population) * 100;
}

export function computePerformance(
  country: PopulationCountryData,
  chartData: PopulationChartDataPoint[],
  globalStats: GlobalStats | undefined,
  rankIndex: number,
  totalCountries: number
): PerformanceMetrics {
  const population = country.currentPopulation;
  const globalAverage =
    globalStats && globalStats.count > 0 ? globalStats.totalPopulation / globalStats.count : 0;

  return {
    growth: trailingGrowth(chartData, country.populationGrowthRate * 100),
    globalComparison: globalAverage > 0 ? ((population - globalAverage) / globalAverage) * 100 : 0,
    globalAverage,
    rank: rankIndex === -1 ? 1 : rankIndex + 1,
    totalCountries: totalCountries || 1,
    density: country.populationDensity || population / (country.landArea || 1),
  };
}
