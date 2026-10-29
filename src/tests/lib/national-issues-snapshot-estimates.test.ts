/** @jest-environment node */
/**
 * Owner decision 2026-10-28: issues read a blank inflation, unemployment or debt figure as the estimate derived from
 * the economy (not 0), and a recorded figure as recorded.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import { buildCountrySnapshot } from "~/lib/national-issues/country-snapshot";
import { estimateEconomicFigures } from "~/lib/economy/figure-estimates";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  // Recorded: unemployment 6.5, inflation 2.1; debt blank. $30k, founding growth 2%.
  await addNation(db as never, { id: "testland", baselineDate: new Date(NOW) });
});

it("estimates a blank debt figure and keeps the recorded ones", async () => {
  const snapshot = await buildCountrySnapshot("testland", db as never, NOW);
  expect(snapshot?.totalDebtGDPRatio).toBe(55);
  expect(snapshot?.unemploymentRate).toBe(6.5);
  expect(snapshot?.inflationRate).toBe(2.1);
});

it("reads a poor nation's blank figures as its estimate, never 0", async () => {
  await db.country.update({
    where: { id: "testland" },
    data: { unemploymentRate: null, inflationRate: null, currentGdpPerCapita: 2_000 },
  });
  const snapshot = await buildCountrySnapshot("testland", db as never, NOW);
  const estimate = estimateEconomicFigures({ gdpPerCapita: 2_000, realGrowthPct: 2 });
  expect(snapshot?.unemploymentRate).toBe(estimate.unemploymentRate);
  expect(snapshot?.inflationRate).toBe(estimate.inflationRate);
  expect(estimate.unemploymentRate).toBeGreaterThan(10);
});
