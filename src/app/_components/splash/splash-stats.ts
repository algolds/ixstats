/** Type guard for countries.getGlobalStats splash usage */
export function isValidGlobalStats(stats: unknown): stats is {
  totalCountries: number;
  totalGdp: number;
  totalPopulation: number;
  globalGrowthRate: number;
} {
  return typeof stats === "object" && stats !== null && "totalCountries" in stats;
}
