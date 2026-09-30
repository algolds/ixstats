/**
 * Stat progression (MC-7): persist the economic projection into the stored `current*` columns.
 *
 * MyCountry shows `getByIdWithEconomicData`, which projects population and GDP from each
 * country's baseline with its active StorytellerEffects. Rankings, vitality, CivCap, foreign-policy
 * maths and passive income read the stored `current*` columns instead, which used to move only
 * when an admin pressed "force recalculation". This job writes the same projection (the one the
 * admin button uses: `projectCountryStats` in server/shared/country-helpers) for every country,
 * so both read the same numbers.
 *
 * - Batched by id cursor; components and history are loaded per batch, not per country.
 * - A country whose projection equals its stored stats (within STAT_UNCHANGED_TOLERANCE) is not
 *   written. `force` writes every country (the admin button).
 * - Only projected columns are written (`projectedStatsUpdate`); baselines are never touched.
 * - One HistoricalDataPoint per country per IxTime month (HISTORY_PERIOD), skipped when the
 *   period already has one, so reruns are idempotent and history charts stop being synthesised.
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { getEconomicConfigFromDB } from "~/lib/config-service";
import {
  getComponentsStatsDataForCountries,
  projectCountryStats,
  projectedStatsUpdate,
} from "~/server/shared/country-helpers";
import type { CountryStats } from "~/types/ixstats";

/** Countries loaded and projected per batch. */
export const STAT_PROGRESSION_BATCH_SIZE = 50;
/** Relative change below which a stored stat counts as unchanged. */
export const STAT_UNCHANGED_TOLERANCE = 1e-6;

/** Start of the IxTime month containing `ixTime` (UTC): the history throttle period. */
export function historyPeriodStart(ixTime: number): number {
  const d = new Date(ixTime);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Start of the IxTime month after the one containing `ixTime`. */
export function historyPeriodEnd(ixTime: number): number {
  return IxTime.addMonths(historyPeriodStart(ixTime), 1);
}

type ProjectedUpdate = ReturnType<typeof projectedStatsUpdate>;

interface StoredStats {
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
}

function sameNumber(stored: number, next: number): boolean {
  if (stored === next) return true;
  const scale = Math.max(Math.abs(stored), Math.abs(next));
  return Math.abs(stored - next) <= scale * STAT_UNCHANGED_TOLERANCE;
}

/** True when writing `next` would not change what readers of the stored stats see. */
export function isProjectionUnchanged(stored: StoredStats, next: ProjectedUpdate): boolean {
  return (
    sameNumber(stored.currentPopulation, next.currentPopulation) &&
    sameNumber(stored.currentGdpPerCapita, next.currentGdpPerCapita) &&
    sameNumber(stored.currentTotalGdp, next.currentTotalGdp) &&
    stored.economicTier === next.economicTier &&
    stored.populationTier === next.populationTier
  );
}

/** The HistoricalDataPoint row for a projection (same fields as createHistoricalDataPoint). */
export function historyPointData(countryId: string, stats: CountryStats, ixTime: number) {
  return {
    countryId,
    ixTimeTimestamp: new Date(ixTime),
    population: stats.currentPopulation,
    gdpPerCapita: stats.currentGdpPerCapita,
    totalGdp: stats.currentTotalGdp,
    populationGrowthRate: stats.populationGrowthRate,
    gdpGrowthRate: stats.adjustedGdpGrowth,
    landArea: stats.landArea ?? null,
    populationDensity: stats.populationDensity ?? null,
    gdpDensity: stats.gdpDensity ?? null,
  };
}

/** Columns the projection reads (prepareBaseCountryData) plus the stored stats it compares. */
const PROGRESSION_SELECT = {
  id: true,
  name: true,
  continent: true,
  region: true,
  governmentType: true,
  religion: true,
  leader: true,
  baselinePopulation: true,
  baselineGdpPerCapita: true,
  baselineDate: true,
  landArea: true,
  areaSqMi: true,
  maxGdpGrowthRate: true,
  adjustedGdpGrowth: true,
  populationGrowthRate: true,
  projected2040Population: true,
  projected2040Gdp: true,
  projected2040GdpPerCapita: true,
  actualGdpGrowth: true,
  localGrowthFactor: true,
  totalGovernmentSpending: true,
  taxRevenueGDPPercent: true,
  unemploymentRate: true,
  inflationRate: true,
  currentPopulation: true,
  currentGdpPerCapita: true,
  currentTotalGdp: true,
  economicTier: true,
  populationTier: true,
  storytellerEffects: {
    where: { isActive: true },
    orderBy: { ixTimeTimestamp: "desc" as const },
  },
} as const;

export interface StatProgressionOptions {
  db?: PrismaClient;
  /** Target IxTime; defaults to now. */
  ixTime?: number;
  /** Write every country even when its stored stats already match. */
  force?: boolean;
  batchSize?: number;
  /** CalculationLog note. */
  note?: string;
}

export interface StatProgressionResult {
  processed: number;
  updated: number;
  unchanged: number;
  failed: number;
  historyPointsWritten: number;
  ixTime: number;
  executionTimeMs: number;
}

export async function runStatProgression(
  options: StatProgressionOptions = {}
): Promise<StatProgressionResult> {
  const startedAt = Date.now();
  const db = options.db ?? (await import("~/server/db")).db;
  const ixTime = options.ixTime ?? IxTime.getCurrentIxTime();
  const batchSize = options.batchSize ?? STAT_PROGRESSION_BATCH_SIZE;
  const econConfig = await getEconomicConfigFromDB(db);
  const periodStart = new Date(historyPeriodStart(ixTime));
  const periodEnd = new Date(historyPeriodEnd(ixTime));

  const result: StatProgressionResult = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    historyPointsWritten: 0,
    ixTime,
    executionTimeMs: 0,
  };

  let cursor: string | undefined;
  for (;;) {
    const batch = await db.country.findMany({
      select: PROGRESSION_SELECT,
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1]!.id;

    const ids = batch.map((c) => c.id);
    const [components, existingHistory] = await Promise.all([
      getComponentsStatsDataForCountries(db, ids),
      db.historicalDataPoint.findMany({
        where: { countryId: { in: ids }, ixTimeTimestamp: { gte: periodStart, lt: periodEnd } },
        select: { countryId: true },
      }),
    ]);
    const hasHistory = new Set(existingHistory.map((h) => h.countryId));
    const historyRows: Array<ReturnType<typeof historyPointData>> = [];

    for (const country of batch) {
      result.processed++;
      try {
        const stats = projectCountryStats(country, components.get(country.id), econConfig, ixTime);
        const data = projectedStatsUpdate(stats, ixTime);

        if (options.force || !isProjectionUnchanged(country, data)) {
          await db.country.update({ where: { id: country.id }, data });
          result.updated++;
        } else {
          result.unchanged++;
        }

        if (!hasHistory.has(country.id)) {
          historyRows.push(historyPointData(country.id, stats, ixTime));
        }
      } catch (err) {
        result.failed++;
        console.error(`[stat-progression] Failed to project ${country.name}:`, err);
      }
    }

    if (historyRows.length > 0) {
      const created = await db.historicalDataPoint.createMany({ data: historyRows });
      result.historyPointsWritten += created.count;
    }

    if (batch.length < batchSize) break;
  }

  result.executionTimeMs = Date.now() - startedAt;

  await db.calculationLog.create({
    data: {
      timestamp: new Date(),
      ixTimeTimestamp: new Date(ixTime),
      countriesUpdated: result.updated,
      executionTimeMs: result.executionTimeMs,
      globalGrowthFactor: econConfig.globalGrowthFactor,
      notes:
        options.note ??
        `Stat progression: ${result.updated} updated, ${result.unchanged} unchanged, ${result.failed} failed, ${result.historyPointsWritten} history points`,
    },
  });

  return result;
}
