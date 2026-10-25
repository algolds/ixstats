/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
//
// One source per figure on the country economy reads (MyCountry fix plan, WP-A2):
// - GDP growth is the engine's rate after the tier cap and diminishing returns, not the static input (an
//   Extravagant nation with input 3% grows about 0.32%).
// - getByIdAtTime never returns the stored current* columns (frozen between stat-progression runs) beside the
//   projection, and the activity rings never prefer the stale stored vitality.
// - The tier-change projection counts IxTime years, not real ones.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
jest.mock("~/server/shared/clerk-public-profile", () => ({
  clerkPublicProfile: jest.fn(async () => ({ imageUrl: null, role: null })),
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { IxTime } from "~/lib/ixtime";
import { economyProcedures } from "~/server/api/routers/countries/economy";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const NOW = Date.UTC(2043, 5, 1);
const COUNTRY = {
  id: "c1",
  slug: "aurum",
  name: "Aurum",
  baselineDate: new Date(Date.UTC(2040, 0, 1)),
  lastCalculated: new Date(Date.UTC(2040, 0, 1)),
  baselinePopulation: 10_000_000,
  baselineGdpPerCapita: 70_000,
  maxGdpGrowthRate: 0.05,
  adjustedGdpGrowth: 0.03,
  populationGrowthRate: 0.01,
  actualGdpGrowth: 0.03,
  localGrowthFactor: 1,
  landArea: 100_000,
  // Stored figures nothing has refreshed: never shown beside the projection.
  currentPopulation: 1,
  currentGdpPerCapita: 1,
  currentTotalGdp: 1,
  nominalGDP: 1,
  economicTier: "Impoverished",
  populationTier: "1",
  economicVitality: 99,
  populationWellbeing: 99,
  populationDensity: 5000,
  publicApproval: 50,
  storytellerEffects: [],
  owner: null,
};

function makeDb() {
  const db = createMockPrisma();
  db.country.findMany.mockResolvedValue([{ id: "c1", slug: "aurum" }]);
  db.country.findFirst.mockResolvedValue(COUNTRY);
  db.country.findUnique.mockResolvedValue(COUNTRY);
  return db;
}

const caller = (db: object) =>
  createCallerFactory(createTRPCRouter({ ...economyProcedures }))(
    createMockRouterContext({ auth: null, user: null, db }) as never
  );

interface EconomicRead {
  currentPopulation: number;
  economicTier: string;
  calculatedStats: { gdpGrowth: number };
  analytics: { tierChangeProjection: { year: number } };
}

describe("country economy reads show the engine's figures", () => {
  beforeEach(() => {
    clearTrpcMemoryCache();
    jest.spyOn(IxTime, "getCurrentIxTime").mockReturnValue(NOW);
  });
  afterEach(() => jest.restoreAllMocks());

  it("getByIdWithEconomicData: GDP growth is the capped, diminished rate", async () => {
    const read = (await caller(makeDb()).getByIdWithEconomicData({ id: "aurum" })) as EconomicRead;

    expect(read.calculatedStats.gdpGrowth).toBeGreaterThan(0.003);
    expect(read.calculatedStats.gdpGrowth).toBeLessThan(0.0035);
    expect(read.economicTier).toBe("Extravagant");
    expect(read.analytics.tierChangeProjection.year).toBe(2043);
  });

  it("getByIdAtTime: the top-level current figures are the projection, not the stored columns", async () => {
    const read = await caller(makeDb()).getByIdAtTime({ id: "c1" });

    expect(read!.currentPopulation).toBe(read!.calculatedStats.currentPopulation);
    expect(read!.currentGdpPerCapita).toBe(read!.calculatedStats.currentGdpPerCapita);
    expect(read!.currentTotalGdp).toBe(read!.calculatedStats.currentTotalGdp);
    expect(read!.currentPopulation).toBeGreaterThan(10_000_000);
    expect(read!.economicTier).toBe("Extravagant");
  });

  it("getActivityRingsData: vitality and growth are computed, never the stale stored values", async () => {
    const rings = await caller(makeDb()).getActivityRingsData({ countryId: "c1" });

    expect(rings.economicVitality).not.toBe(99);
    expect(rings.populationWellbeing).not.toBe(99);
    expect(rings.economicMetrics.growthRate).toBe("0.3%");
  });
});
