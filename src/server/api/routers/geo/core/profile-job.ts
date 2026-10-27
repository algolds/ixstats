/**
 * Geo profile recalculation as a background job (Atlas R0). The admin mutation `geoCore.recalculateGeoProfiles`
 * only marks profiles stale (`queueGeoProfileRecalculation`); the `geo-profiles` cron job (src/server/cron/jobs.ts,
 * run under the job lease `geo-profiles`) recomputes them here, one country at a time. A country whose profile is
 * stale or missing is pending, so a run that stops (budget spent, crash, one country failing) is simply continued
 * by the next one: each finished country leaves the queue on its own.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { buildGeoProfile, computeEconomicGeoModifiers } from "~/lib/maps/geo-analytics";
import { refreshGeographicResources } from "~/lib/maps/geographic-resources";
import { parseRealmMapSettings } from "~/lib/maps/realm-map-settings";
import { buildClimateZones, buildElevationZones, countryZoneFills } from "./profile-zones";

/** The job's name in the cron registry (src/server/cron/jobs.ts) and so in its `CronRun` rows. */
const GEO_PROFILE_JOB = "geo-profiles";

/** A profile calculated at this instant or earlier is stale (a queued recalculation sets it). */
export const GEO_PROFILE_STALE_AT = new Date(0);

/** A run starts no new country after this long; the lease (jobs.ts) outlasts it, the next run carries on. */
export const GEO_PROFILE_RUN_BUDGET_MS = 20 * 60_000;

const MAX_REPORTED_ERRORS = 20;

/** Countries with a map outline: SQL NULL and a JSON null both mean none. */
const WITH_GEOMETRY: Prisma.CountryWhereInput = {
  AND: [{ geometry: { not: Prisma.DbNull } }, { geometry: { not: Prisma.JsonNull } }],
};

interface GeoProfileProgress {
  done: number;
  total: number;
  country: string;
}

interface GeoProfileRunResult {
  /** Countries that were pending when the run started. */
  total: number;
  processed: number;
  failed: number;
  /** Pending countries still stale after the run (failed, or not reached before the budget ran out). */
  remaining: number;
  resourcesWritten: number;
  errors: string[];
}

/** Computes and stores one country's geo profile; throws "no geometry" when it has none. */
async function recalculateGeoProfile(db: PrismaClient, countryId: string) {
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: {
      coastlineKm: true,
      landArea: true,
      areaSqMi: true,
      geometry: true,
      boundingBox: true,
      realmId: true,
      realm: { select: { settings: true } },
    },
  });
  if (!country?.geometry) throw new Error("no geometry");

  const coastlineKm = country.coastlineKm ?? 0;
  const areaKm2 = country.landArea ?? (country.areaSqMi ? country.areaSqMi / 0.386102 : 0);
  const bbox = country.boundingBox as [number, number, number, number] | null;

  // Climate/altitude layers of the country's own realm, its zones named by its climate key
  const place = { id: countryId, realmId: country.realmId };
  const [climateFills, altitudeFills] = await Promise.all([
    countryZoneFills(db, place, "climate", bbox),
    countryZoneFills(db, place, "altitudes", bbox),
  ]);
  const climateKey = parseRealmMapSettings(country.realm?.settings).climateKey ?? null;
  const climateDistribution = buildClimateZones(climateFills, false, climateKey);
  const elevationProfile = buildElevationZones(altitudeFills);

  const profile = buildGeoProfile({
    climateDistribution,
    elevationProfile,
    coastlineKm,
    neighborCount: 0,
    totalRiverLengthKm: 0,
    totalLakeAreaSqKm: 0,
    areaKm2,
  });
  const econ = computeEconomicGeoModifiers(profile);

  const fields = {
    climateDistribution: climateDistribution.map((zone) => ({ ...zone })),
    elevationProfile: elevationProfile.map((zone) => ({ ...zone })),
    arableLandPercent: profile.arableLandPercent,
    coastlineKm,
    isLandlocked: profile.isLandlocked,
    isIsland: profile.isIsland,
    dominantClimate: profile.dominantClimate,
    dominantElevation: profile.dominantElevation,
    meanElevation: profile.meanElevation,
    terrainRoughness: profile.terrainRoughness,
    gdpModifier: econ.gdpModifier,
    tradeModifier: econ.tradeModifier,
    infraCostModifier: econ.infraCostModifier,
    lastCalculatedAt: new Date(),
  };
  await db.countryGeoProfile.upsert({
    where: { countryId },
    create: {
      countryId,
      riverKm: 0,
      lakeAreaSqKm: 0,
      neighborCount: profile.neighborCount,
      ...fields,
    },
    update: fields,
  });
}

/**
 * Marks the stored profiles of one country, or of every country with geometry, stale so the `geo-profiles` job
 * recomputes them. Computes nothing itself. Returns how many countries that queues and when the job last ran (null:
 * never, so it is probably not in `CRON_ENABLED_JOBS`), so the admin can tell a queue that will drain from one that
 * will not.
 */
export async function queueGeoProfileRecalculation(
  db: PrismaClient,
  countryId?: string
): Promise<{ queued: number; lastRunAt: Date | null }> {
  const where: Prisma.CountryWhereInput = countryId
    ? { ...WITH_GEOMETRY, id: countryId }
    : WITH_GEOMETRY;
  const queued = await db.country.count({ where });
  await db.countryGeoProfile.updateMany({
    where: { country: where },
    data: { lastCalculatedAt: GEO_PROFILE_STALE_AT },
  });
  const lastRun = await db.cronRun.findFirst({
    where: { job: GEO_PROFILE_JOB },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  return { queued, lastRunAt: lastRun?.startedAt ?? null };
}

interface CountryOutcome {
  processed: boolean;
  resources: number;
  error?: string;
}

/** One country: its profile, then its map-derived resources (a resource failure keeps the profile). */
async function recomputeCountry(
  db: PrismaClient,
  country: { id: string; name: string }
): Promise<CountryOutcome> {
  try {
    await recalculateGeoProfile(db, country.id);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { processed: false, resources: 0, error: `${country.name}: ${reason}` };
  }
  try {
    return { processed: true, resources: await refreshGeographicResources(db, country.id) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { processed: true, resources: 0, error: `${country.name} (resources): ${reason}` };
  }
}

const logProgress = ({ done, total, country }: GeoProfileProgress) =>
  console.info(`[geo-profiles] ${done}/${total} ${country}`);

/**
 * The `geo-profiles` cron job: recomputes every country whose profile is stale or missing, one at a time, and
 * reports progress after each. Returns the counts the cron run records.
 */
export async function runGeoProfileRecalculation(
  db: PrismaClient,
  deps: { onProgress?: (progress: GeoProfileProgress) => void } = {}
): Promise<GeoProfileRunResult> {
  const onProgress = deps.onProgress ?? logProgress;
  const pending = await db.country.findMany({
    where: {
      ...WITH_GEOMETRY,
      OR: [
        { geoProfile: null },
        { geoProfile: { lastCalculatedAt: { lte: GEO_PROFILE_STALE_AT } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const startedAt = Date.now();
  const result: GeoProfileRunResult = {
    total: pending.length,
    processed: 0,
    failed: 0,
    remaining: pending.length,
    resourcesWritten: 0,
    errors: [],
  };
  for (const [index, country] of pending.entries()) {
    if (Date.now() - startedAt >= GEO_PROFILE_RUN_BUDGET_MS) break;
    const outcome = await recomputeCountry(db, country);
    if (outcome.processed) result.processed++;
    result.resourcesWritten += outcome.resources;
    if (outcome.error) {
      result.failed++;
      if (result.errors.length < MAX_REPORTED_ERRORS) result.errors.push(outcome.error);
    }
    result.remaining = pending.length - result.processed;
    onProgress({ done: index + 1, total: pending.length, country: country.name });
  }
  return result;
}
