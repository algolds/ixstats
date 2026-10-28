/** @jest-environment node */
/**
 * Politics drift rewards the governing party for the growth the nation actually had: the latest history point's
 * `gdpGrowthRate` (written by stat-progression from the engine's effective rate), not the static
 * `adjustedGdpGrowth` input, which stands in only before the first history point.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/diplomacy/news-generator", () => ({ generateDiplomaticNews: jest.fn() }));

import { IxTime } from "~/lib/ixtime";
import { driftJitter, runPoliticsDrift } from "~/lib/government/politics-drift-cron";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, ixnayRunningAt } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, {
    id: "testland",
    baselineDate: new Date(NOW - 365.25 * 86_400_000),
  });
  await addOwner(db as never, "lena", "testland");
  // Ids starting with "e" have no jitter ((101 % 7) - 3 = 0), so only growth moves support.
  for (const id of ["e-gov", "e-opp"]) {
    await db.politicalParty.create({
      data: {
        id,
        countryId: "testland",
        name: id,
        ideology: "center",
        baseSupport: 40,
        currentSupport: 40,
      },
    });
  }
});

afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

const support = async (id: string) =>
  (await db.politicalParty.findUniqueOrThrow({ where: { id } })).currentSupport;

it("moves party support with the realised growth, not the static input", async () => {
  await db.country.update({ where: { id: "testland" }, data: { adjustedGdpGrowth: 0 } });
  await db.historicalDataPoint.create({
    data: {
      countryId: "testland",
      ixTimeTimestamp: new Date(NOW),
      population: 1e7,
      gdpPerCapita: 3e4,
      totalGdp: 3e11,
      populationGrowthRate: 0.01,
      gdpGrowthRate: 0.05,
    },
  });

  await runPoliticsDrift({ clocks: ixnayRunningAt(NOW) });
  // 5% growth: +5 points x 0.3 for the governing party, the opposition loses the same (plus each party's jitter)
  const now = ixnayRunningAt(NOW).get("default")!.now();
  expect(await support("e-gov")).toBeCloseTo(41.5 + driftJitter("e-gov", now), 9);
  expect(await support("e-opp")).toBeCloseTo(38.5 + driftJitter("e-opp", now), 9);
});

it("reads the static input before the nation's first history point", async () => {
  await db.country.update({ where: { id: "testland" }, data: { adjustedGdpGrowth: -0.02 } });
  await runPoliticsDrift({ clocks: ixnayRunningAt(NOW) });
  const now = ixnayRunningAt(NOW).get("default")!.now();
  expect(await support("e-gov")).toBeCloseTo(39.4 + driftJitter("e-gov", now), 9);
});
