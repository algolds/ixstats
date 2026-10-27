import type { PrismaClient } from "@prisma/client";
import { getEconomicConfigFromDB } from "~/lib/config-service";
import {
  getCountryComponentsStatsData,
  projectCountryStats,
} from "~/server/shared/country-helpers";
import { clockForCountry } from "~/server/shared/realm-time";

/**
 * The nation's population now, projected the way every surface shows it (baseline progressed
 * with its active effects), rather than the stored `currentPopulation`, which only moves when the
 * stat-progression job runs. `ixTime` defaults to now on the nation's realm clock. Null when the country does not
 * exist.
 */
export async function loadProjectedPopulation(
  db: PrismaClient,
  countryId: string,
  at?: number
): Promise<number | null> {
  const ixTime = at ?? (await clockForCountry(db, countryId)).now();
  const [country, components, econConfig] = await Promise.all([
    db.country.findUnique({
      where: { id: countryId },
      omit: { geometry: true, centroid: true, boundingBox: true },
      include: { storytellerEffects: { where: { isActive: true } } },
    }),
    getCountryComponentsStatsData(db, countryId, ixTime),
    getEconomicConfigFromDB(db),
  ]);
  if (!country) return null;
  return projectCountryStats(country, components, econConfig, ixTime).currentPopulation;
}
