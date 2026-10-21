/** @jest-environment node */
/**
 * stat-progression (MC-7): persists the projection MyCountry shows into the stored current*
 * columns, batched, skipping unchanged countries, never touching baselines, and writing at most
 * one HistoricalDataPoint per country per IxTime month.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";

jest.mock("~/lib/config-service", () => ({
  getEconomicConfigFromDB: jest.fn().mockResolvedValue({
    globalGrowthFactor: 1.0321,
    baseInflationRate: 0.02,
    economicTierThresholds: {},
    populationTierThresholds: {},
    tierGrowthModifiers: {},
    calculationIntervalMs: 60_000,
    ixTimeUpdateFrequency: 30_000,
  }),
}));

import {
  historyPeriodEnd,
  historyPeriodStart,
  runStatProgression,
} from "~/server/cron/stat-progression";
import { projectCountryStats, projectedStatsUpdate } from "~/server/shared/country-helpers";
import { IxTime } from "~/lib/ixtime";

const BASELINE = Date.UTC(2040, 0, 1);
const NOW = IxTime.addYears(BASELINE, 3); // mid-January 2043

function country(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: `Country ${id}`,
    continent: null,
    region: null,
    governmentType: null,
    religion: null,
    leader: null,
    baselinePopulation: 10_000_000,
    baselineGdpPerCapita: 30_000,
    baselineDate: new Date(BASELINE),
    landArea: 100_000,
    areaSqMi: null,
    maxGdpGrowthRate: 0.05,
    adjustedGdpGrowth: 0.02,
    populationGrowthRate: 0.01,
    projected2040Population: 0,
    projected2040Gdp: 0,
    projected2040GdpPerCapita: 0,
    actualGdpGrowth: 0.02,
    localGrowthFactor: 1,
    totalGovernmentSpending: 0,
    taxRevenueGDPPercent: 25,
    unemploymentRate: 5,
    inflationRate: 0.02,
    currentPopulation: 10_000_000,
    currentGdpPerCapita: 30_000,
    currentTotalGdp: 3e11,
    economicTier: "Developed",
    populationTier: "2",
    storytellerEffects: [] as unknown[],
    ...extra,
  };
}

const econConfig = {
  globalGrowthFactor: 1.0321,
  baseInflationRate: 0.02,
  economicTierThresholds: {},
  populationTierThresholds: {},
  tierGrowthModifiers: {},
  calculationIntervalMs: 60_000,
  ixTimeUpdateFrequency: 30_000,
} as any;

/** A country whose stored stats already equal its projection at NOW. */
function upToDate(id: string) {
  const c = country(id);
  const data = projectedStatsUpdate(projectCountryStats(c, undefined, econConfig, NOW), NOW);
  return { ...c, ...data };
}

function makeDb(countries: ReturnType<typeof country>[], historyCountryIds: string[] = []) {
  return {
    country: {
      findMany: jest.fn(({ take, cursor }: { take: number; cursor?: { id: string } }) => {
        const start = cursor ? countries.findIndex((c) => c.id === cursor.id) + 1 : 0;
        return Promise.resolve(countries.slice(start, start + take));
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    governmentComponent: { findMany: jest.fn().mockResolvedValue([]) },
    economicComponent: { findMany: jest.fn().mockResolvedValue([]) },
    taxComponent: { findMany: jest.fn().mockResolvedValue([]) },
    policy: { findMany: jest.fn().mockResolvedValue([]) },
    historicalDataPoint: {
      findMany: jest.fn().mockResolvedValue(historyCountryIds.map((countryId) => ({ countryId }))),
      createMany: jest.fn(({ data }: { data: unknown[] }) =>
        Promise.resolve({ count: data.length })
      ),
    },
    calculationLog: { create: jest.fn().mockResolvedValue({}) },
  };
}

describe("runStatProgression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists the projection into current* and never writes a baseline column", async () => {
    const db = makeDb([country("a")]);

    const result = await runStatProgression({ db: db as any, ixTime: NOW });

    expect(result).toMatchObject({ processed: 1, updated: 1, unchanged: 0, failed: 0 });
    const expected = projectCountryStats(country("a"), undefined, econConfig, NOW);
    const { data } = db.country.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data.currentGdpPerCapita).toBeCloseTo(expected.currentGdpPerCapita, 6);
    expect(data.currentPopulation).toBeCloseTo(expected.currentPopulation, 6);
    expect(data.currentGdpPerCapita).toBeGreaterThan(30_000);
    expect(data.lastCalculated).toEqual(new Date(NOW));
    expect(Object.keys(data).filter((k) => k.startsWith("baseline"))).toEqual([]);
  });
  it("writes one history point per country per IxTime month", async () => {
    const db = makeDb([country("a"), upToDate("b"), country("c")], ["c"]);

    const result = await runStatProgression({ db: db as any, ixTime: NOW });

    expect(db.historicalDataPoint.findMany).toHaveBeenCalledWith({
      where: {
        countryId: { in: ["a", "b", "c"] },
        ixTimeTimestamp: {
          gte: new Date(historyPeriodStart(NOW)),
          lt: new Date(historyPeriodEnd(NOW)),
        },
      },
      select: { countryId: true },
    });
    const rows = (db.historicalDataPoint.createMany.mock.calls[0]![0] as { data: any[] }).data;
    expect(rows.map((r) => r.countryId)).toEqual(["a", "b"]);
    expect(rows[0]).toMatchObject({ ixTimeTimestamp: new Date(NOW), landArea: 100_000 });
    expect(result.historyPointsWritten).toBe(2);
  });

  it("walks the table in id-cursor batches", async () => {
    const db = makeDb([country("a"), country("b"), country("c")]);

    const result = await runStatProgression({ db: db as any, ixTime: NOW, batchSize: 2 });

    expect(result.processed).toBe(3);
    expect(db.country.findMany).toHaveBeenCalledTimes(2);
    expect(db.country.findMany.mock.calls[1]![0]).toMatchObject({
      take: 2,
      cursor: { id: "b" },
      skip: 1,
      orderBy: { id: "asc" },
    });
    expect(db.historicalDataPoint.createMany).toHaveBeenCalledTimes(2);
  });

  it("keeps going when one country cannot be projected", async () => {
    const db = makeDb([country("bad", { baselinePopulation: Number.NaN }), country("ok")]);

    const result = await runStatProgression({ db: db as any, ixTime: NOW });

    expect(result).toMatchObject({ processed: 2, updated: 1, failed: 1 });
    expect(db.calculationLog.create).toHaveBeenCalledTimes(1);
  });
  it("never fails the run when the tier listener throws", async () => {
    const db = makeDb([{ ...upToDate("a"), economicTier: "Impoverished" } as any]);
    const onEconomicTierChange = jest.fn(() => {
      throw new Error("activity feed down");
    });
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await runStatProgression({ db: db as any, ixTime: NOW, onEconomicTierChange });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    spy.mockRestore();
  });
});
