import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { getEconomicConfigFromDB } from "~/lib/config-service";
import {
  getCountryComponentsStatsData,
  projectCountryStats,
} from "~/server/shared/country-helpers";

/**
 * The nation's population now, projected the way every surface shows it (baseline progressed
 * with its active effects), rather than the stored `currentPopulation`, which only moves when the
 * stat-progression job runs. Null when the country does not exist.
 */
export async function loadProjectedPopulation(
  db: PrismaClient,
  countryId: string,
  ixTime: number = IxTime.getCurrentIxTime()
): Promise<number | null> {
  const [country, components, econConfig] = await Promise.all([
    db.country.findUnique({
      where: { id: countryId },
      omit: { geometry: true, centroid: true, boundingBox: true },
      include: { storytellerEffects: { where: { isActive: true } } },
    }),
    getCountryComponentsStatsData(db, countryId),
    getEconomicConfigFromDB(db),
  ]);
  if (!country) return null;
  return projectCountryStats(country, components, econConfig, ixTime).currentPopulation;
}
