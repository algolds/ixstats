/**
 * Stat progression (MC-7): persist the economic projection into the stored `current*` columns.
 *
 * MyCountry shows `getByIdWithEconomicData`, which projects population and GDP from each
 * country's baseline with its active StorytellerEffects. Rankings, vitality, executive bandwidth, foreign-policy
 * maths and passive income read the stored `current*` columns instead, which used to move only
 * when an admin pressed "force recalculation". This job writes the same projection (the one the
 * admin button uses: `projectCountryStats` in server/shared/country-helpers) for every country,
 * so both read the same numbers.
 *
 * - Batched by id cursor; components and history are loaded per batch, not per country.
 * - A country whose projection equals its stored stats (within STAT_UNCHANGED_TOLERANCE) is not
 *   written. `force` writes every country (the admin button).
 * - Only projected columns are written (`projectedStatsUpdate`); baselines are never touched.
 * - The yearly government budget follows GDP: it moves by the same ratio as the stored GDP.
 * - Each nation projects to its realm's time now (realm time design §2): every realm's clock is read once per run.
 *   A paused realm's nations are skipped once they stand at its time (nothing moves); a forward date jump, paused or
 *   not, is caught up by the next run, the projection being a function of the target time. A paused nation brought
 *   up to its realm's time is always written, so `lastCalculated` marks it done. `force` writes every nation.
 * - One HistoricalDataPoint per country per month of its realm's clock, skipped when the period already has one, so
 *   reruns are idempotent and history charts stop being synthesised. Months the clock passed without a run (a date
 *   jump, a stopped cron) get their points too, up to MAX_CATCH_UP_MONTHS.
 * - A country with active intelligence alert thresholds has them evaluated against the stored stats
 *   just written (best-effort: a failing evaluation never fails the run).
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { pickClock, realmClocks, type RealmClockReader } from "~/server/shared/realm-time";
import { getEconomicConfigFromDB } from "~/lib/config-service";
import {
  getComponentsStatsDataForCountries,
  projectCountryStats,
  projectedStatsUpdate,
} from "~/server/shared/country-helpers";
import type { CountryStats } from "~/types/ixstats";
import { scaleBudgetWithGdp } from "~/lib/government/budget-allocations";
import { gdpScaleRatio } from "~/lib/government/budget-math";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { evaluateThresholds } from "~/server/shared/intelligence-alert-thresholds";

/** Countries loaded and projected per batch. */
const STAT_PROGRESSION_BATCH_SIZE = 50;
/** Relative change below which a stored stat counts as unchanged. */
const STAT_UNCHANGED_TOLERANCE = 1e-6;
/** The most past months one run fills for a nation (the latest ones), after a date jump or a stopped cron. */
export const MAX_CATCH_UP_MONTHS = 120;

/** Start of the IxTime month containing `ixTime` (UTC): the history throttle period. */
export function historyPeriodStart(ixTime: number): number {
  const d = new Date(ixTime);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Start of the IxTime month after the one containing `ixTime`. */
export function historyPeriodEnd(ixTime: number): number {
  return IxTime.addMonths(historyPeriodStart(ixTime), 1);
}

/**
 * The month starts strictly between the month of `lastPointMs` and the month of `nowMs`: the months the clock passed
 * with no history point. At most MAX_CATCH_UP_MONTHS, the latest ones.
 */
export function missedHistoryMonths(lastPointMs: number, nowMs: number): number[] {
  const current = historyPeriodStart(nowMs);
  const months: number[] = [];
  for (let at = historyPeriodEnd(lastPointMs); at < current; at = IxTime.addMonths(at, 1)) {
    months.push(at);
    if (months.length > MAX_CATCH_UP_MONTHS) months.shift();
  }
  return months;
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
    gdpGrowthRate: stats.effectiveGdpGrowth ?? stats.adjustedGdpGrowth, // the realised (engine) rate
    landArea: stats.landArea ?? null,
    populationDensity: stats.populationDensity ?? null,
    gdpDensity: stats.gdpDensity ?? null,
  };
}

/**
 * Write a country's projection and move its yearly budget by the same GDP ratio, in one
 * transaction, so the budget follows every GDP step exactly once.
 */
async function writeProjection(
  db: PrismaClient,
  countryId: string,
  storedGdp: number,
  data: ProjectedUpdate,
  ixTime: number
) {
  const ratio = gdpScaleRatio(storedGdp, data.currentTotalGdp);
  await db.$transaction(async (tx) => {
    await tx.country.update({ where: { id: countryId }, data });
    await scaleBudgetWithGdp(tx, countryId, ratio, currentBudgetYear(ixTime));
  });
}

/** Users with active alert thresholds on each country of the batch. */
async function thresholdWatchers(db: PrismaClient, ids: string[]) {
  const rows = await db.intelligenceAlertThreshold.findMany({
    where: { countryId: { in: ids }, isActive: true },
    select: { countryId: true, userId: true },
    distinct: ["countryId", "userId"],
  });
  const watchers = new Map<string, string[]>();
  for (const { countryId, userId } of rows) {
    watchers.set(countryId, [...(watchers.get(countryId) ?? []), userId]);
  }
  return watchers;
}

/** Evaluates each watcher's thresholds with the growth the projection just computed. */
async function evaluateWatchedThresholds(
  db: PrismaClient,
  countryId: string,
  userIds: string[] | undefined,
  stats: CountryStats
) {
  for (const userId of userIds ?? []) {
    try {
      await evaluateThresholds(db, countryId, userId, {
        effectiveGdpGrowth: stats.effectiveGdpGrowth,
      });
    } catch (err) {
      console.error(`[stat-progression] Threshold evaluation failed for ${countryId}:`, err);
    }
  }
}

/** Columns the projection reads (prepareBaseCountryData) plus the stored stats it compares. */
const PROGRESSION_SELECT = {
  id: true,
  realmId: true,
  name: true,
  continent: true,
  region: true,
  governmentType: true,
  religion: true,
  leader: true,
  baselinePopulation: true,
  baselineGdpPerCapita: true,
  baselineDate: true,
  lastCalculated: true,
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

interface StatProgressionOptions {
  db?: PrismaClient;
  /** Each realm's clock; read once from the database when omitted. */
  clocks?: ReadonlyMap<string, RealmClockReader>;
  /** Write every country even when its stored stats already match, paused realms' too. */
  force?: boolean;
  batchSize?: number;
  /** CalculationLog note. */
  note?: string;
  /**
   * Called (never awaited, errors ignored) for each country whose stored economic tier changes,
   * so the caller can post the economic milestone to the activity feed (SL-7).
   */
  onEconomicTierChange?: (change: EconomicTierChange) => unknown;
}

export interface EconomicTierChange {
  countryId: string;
  from: string;
  to: string;
}

export interface StatProgressionResult {
  processed: number;
  updated: number;
  unchanged: number;
  failed: number;
  /** Nations of paused realms, left as they are. */
  skippedPaused: number;
  historyPointsWritten: number;
  /** Ixnay's time when the run started (its CalculationLog stamp); each realm's nations use their own. */
  ixTime: number;
  executionTimeMs: number;
}

/** Best-effort: a failing listener never fails the progression run. */
function notifyTierChange(
  listener: StatProgressionOptions["onEconomicTierChange"],
  change: EconomicTierChange
) {
  if (!listener) return;
  try {
    void Promise.resolve(listener(change)).catch((err: unknown) =>
      console.error("[stat-progression] Tier change listener failed:", err)
    );
  } catch (err) {
    console.error("[stat-progression] Tier change listener failed:", err);
  }
}

/** Each realm's time now, read from its clock once per run. */
function realmNows(clocks: ReadonlyMap<string, RealmClockReader>) {
  const nows = new Map<string, number>();
  return (realmId: string) => {
    let now = nows.get(realmId);
    if (now === undefined) {
      now = pickClock(clocks, realmId).now();
      nows.set(realmId, now);
    }
    return now;
  };
}

/** Each country's latest history point (ms), for the batch. */
async function latestHistoryPoints(db: PrismaClient, ids: string[]) {
  const rows = await db.historicalDataPoint.groupBy({
    by: ["countryId"],
    where: { countryId: { in: ids } },
    _max: { ixTimeTimestamp: true },
  });
  return new Map(rows.map((r) => [r.countryId, r._max.ixTimeTimestamp?.getTime()]));
}

type ProgressionCountry = Awaited<ReturnType<typeof loadBatch>>[number];

function loadBatch(db: PrismaClient, batchSize: number, cursor: string | undefined) {
  return db.country.findMany({
    select: PROGRESSION_SELECT,
    orderBy: { id: "asc" },
    take: batchSize,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

interface BatchContext {
  db: PrismaClient;
  options: StatProgressionOptions;
  econConfig: Awaited<ReturnType<typeof getEconomicConfigFromDB>>;
  components: Awaited<ReturnType<typeof getComponentsStatsDataForCountries>>;
  lastPoints: Map<string, number | undefined>;
  watchers: Map<string, string[]>;
  result: StatProgressionResult;
}

/** The history rows a country is owed: the months its clock passed without one, then this month's. */
function owedHistory(
  ctx: BatchContext,
  country: ProgressionCountry,
  stats: CountryStats,
  nowMs: number
) {
  const last = ctx.lastPoints.get(country.id);
  if (last !== undefined && last >= historyPeriodStart(nowMs)) return [];
  const missed = last === undefined ? [] : missedHistoryMonths(last, nowMs);
  const components = ctx.components.get(country.id);
  return [
    ...missed.map((at) =>
      historyPointData(country.id, projectCountryStats(country, components, ctx.econConfig, at), at)
    ),
    historyPointData(country.id, stats, nowMs),
  ];
}

/**
 * Project one country to its realm's now, write what changed (everything when `write`) and return the history it is
 * owed.
 */
async function progressCountry(
  ctx: BatchContext,
  country: ProgressionCountry,
  nowMs: number,
  write: boolean
) {
  const { db, options, result } = ctx;
  const stats = projectCountryStats(country, ctx.components.get(country.id), ctx.econConfig, nowMs);
  const data = projectedStatsUpdate(stats, nowMs);

  if (write || !isProjectionUnchanged(country, data)) {
    await writeProjection(db, country.id, country.currentTotalGdp, data, nowMs);
    result.updated++;
    if (country.economicTier && country.economicTier !== data.economicTier) {
      notifyTierChange(options.onEconomicTierChange, {
        countryId: country.id,
        from: country.economicTier,
        to: data.economicTier,
      });
    }
  } else {
    result.unchanged++;
  }
  await evaluateWatchedThresholds(db, country.id, ctx.watchers.get(country.id), stats);
  return owedHistory(ctx, country, stats, nowMs);
}

export async function runStatProgression(
  options: StatProgressionOptions = {}
): Promise<StatProgressionResult> {
  const startedAt = Date.now();
  const db = options.db ?? (await import("~/server/db")).db;
  const clocks = options.clocks ?? (await realmClocks(db));
  const nowOf = realmNows(clocks);
  const batchSize = options.batchSize ?? STAT_PROGRESSION_BATCH_SIZE;
  const econConfig = await getEconomicConfigFromDB(db);

  const result: StatProgressionResult = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    skippedPaused: 0,
    historyPointsWritten: 0,
    ixTime: nowOf(DEFAULT_REALM_ID),
    executionTimeMs: 0,
  };

  let cursor: string | undefined;
  for (;;) {
    const batch = await loadBatch(db, batchSize, cursor);
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1]!.id;

    // A paused realm's nations stand still once they reach its time: nothing to project, nothing to record.
    const paused = (c: ProgressionCountry) => pickClock(clocks, c.realmId).paused;
    const live = batch.filter(
      (c) => options.force || !paused(c) || c.lastCalculated.getTime() < nowOf(c.realmId)
    );
    result.skippedPaused += batch.length - live.length;
    const ids = live.map((c) => c.id);
    const realmOf = new Map(live.map((c) => [c.id, c.realmId]));
    const [components, lastPoints, watchers] = await Promise.all([
      getComponentsStatsDataForCountries(db, ids, (id) => nowOf(realmOf.get(id)!)),
      latestHistoryPoints(db, ids),
      thresholdWatchers(db, ids),
    ]);
    const ctx: BatchContext = {
      db,
      options,
      econConfig,
      components,
      lastPoints,
      watchers,
      result,
    };
    const historyRows: Array<ReturnType<typeof historyPointData>> = [];

    for (const country of live) {
      result.processed++;
      try {
        const write = Boolean(options.force) || paused(country);
        historyRows.push(...(await progressCountry(ctx, country, nowOf(country.realmId), write)));
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
      ixTimeTimestamp: new Date(result.ixTime),
      countriesUpdated: result.updated,
      executionTimeMs: result.executionTimeMs,
      globalGrowthFactor: econConfig.globalGrowthFactor,
      notes:
        options.note ??
        `Stat progression: ${result.updated} updated, ${result.unchanged} unchanged, ${result.failed} failed, ${result.skippedPaused} paused, ${result.historyPointsWritten} history points`,
    },
  });

  return result;
}
