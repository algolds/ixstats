/** @jest-environment node */
/**
 * WP-A2 → WP-H: the issue snapshot's `actualGdpGrowth` is the realised growth (the latest history point stat
 * progression wrote), not the founding input, so growth-triggered templates such as foreign_investment_boom (> 3%)
 * can fire. Before any history point exists it falls back to the stored founding rate.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import { buildCountrySnapshot } from "~/lib/national-issues/country-snapshot";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  // Founding actualGdpGrowth is 0.02 (2%)
  await addNation(db as never, { id: "testland", baselineDate: new Date(NOW) });
});

function historyPoint(month: number, gdpGrowthRate: number) {
  return db.historicalDataPoint.create({
    data: {
      countryId: "testland",
      ixTimeTimestamp: new Date(Date.UTC(2043, month, 1)),
      population: 1e7,
      gdpPerCapita: 30_000,
      totalGdp: 3e11,
      populationGrowthRate: 0.01,
      gdpGrowthRate,
    },
  });
}

it("falls back to the founding growth before stat progression has written history", async () => {
  expect((await buildCountrySnapshot("testland", db as never))?.actualGdpGrowth).toBe(2);
});

it("reads the latest history point's realised growth, in percent", async () => {
  await historyPoint(1, 0.035);
  await historyPoint(0, 0.025);
  expect((await buildCountrySnapshot("testland", db as never))?.actualGdpGrowth).toBe(3.5);
});
