/**
 * Executive bandwidth capacity follows the projected population (the one the Standing card
 * shows), not the stored `currentPopulation`, which only moves when stat-progression runs.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import { IxTime } from "~/lib/ixtime";
import { calculateCivilServiceCapacity } from "~/lib/government/atomic-utils";
import { createCallerFactory } from "~/server/api/trpc";
import { policiesRouter } from "~/server/api/routers/policies";
import { loadProjectedPopulation } from "~/server/shared/projected-population";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { loadSoftScores } from "~/lib/government/soft-scores-store";
import { addIxnay, addNation, addOwner, asOwner } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  // Ten IxTime years of 1% growth since the baseline; the stored figure never moved.
  await addNation(db as never, {
    id: "testland",
    name: "Testland",
    baselineDate: new Date(NOW - 10 * 365 * 86_400_000),
  });
});

afterEach(() => {
  IxTime.clearTimeOverride();
  IxTime.clearMultiplierOverride();
});

it("derives capacity from the projected population", async () => {
  const owner = await addOwner(db as never, "lena", "testland");
  const projected = await loadProjectedPopulation(db as never, "testland");
  expect(projected).toBeGreaterThan(10_500_000);

  const context = await createCallerFactory(policiesRouter)(
    asOwner(db as never, owner)
  ).getPolicyReconContext({ countryId: "testland" });

  // Capacity reads the effective government effectiveness (derived from the sim plus the stored offset)
  const effectiveness = (await loadSoftScores(db as never, "testland", NOW))!.effective
    .governmentEffectiveness;
  expect(context.capacity).toBe(calculateCivilServiceCapacity(projected!, effectiveness));
  expect(context.capacity).toBeGreaterThan(
    calculateCivilServiceCapacity(10_000_000, effectiveness)
  );
});
