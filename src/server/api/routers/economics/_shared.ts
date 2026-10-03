import type { Prisma } from "@prisma/client";

/** The economic relations both builder loaders read. */
export const ECONOMY_INCLUDE = {
  economicProfile: true,
  laborMarket: true,
  fiscalSystem: true,
  incomeDistribution: true,
  economicModel: true,
  nationalIdentity: true,
} satisfies Prisma.CountryInclude;

export type SectorRow = Record<string, any>;

/** The stored sector breakdown JSON as rows; empty when absent or unparseable. */
export function parseSectorBreakdown(json: string | null | undefined, label: string): SectorRow[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is SectorRow => x !== null && typeof x === "object")
      : [];
  } catch (e) {
    console.error(`[${label}] Failed to parse sectorBreakdown:`, e);
    return [];
  }
}
