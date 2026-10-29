/** @jest-environment node */
/**
 * Owner decision 3 (2026-10-28): issues read the soft scores derived from the sim plus the stored
 * value's lasting offset, and the internal stability the formula computes, never the flat seeded
 * defaults (stability 75, corruption 50, infrastructure 50).
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import { buildCountrySnapshot } from "~/lib/national-issues/country-snapshot";
import { loadSoftScores } from "~/lib/government/soft-scores-store";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, { id: "testland", baselineDate: new Date(NOW) });
});

it("reads the effective governance and infrastructure scores, offsets included", async () => {
  const state = await loadSoftScores(db as never, "testland", NOW);
  const snapshot = await buildCountrySnapshot("testland", db as never, NOW);
  expect(snapshot?.corruptionIndex).toBe(state?.effective.corruptionIndex);
  expect(snapshot?.infrastructureRating).toBe(state?.effective.infrastructureRating);
  expect(snapshot?.democracyIndex).toBe(state?.effective.democracyIndex);

  await db.country.update({ where: { id: "testland" }, data: { infrastructureRating: 62 } });
  const raised = await buildCountrySnapshot("testland", db as never, NOW);
  expect(raised!.infrastructureRating - snapshot!.infrastructureRating).toBeCloseTo(12, 5);
});

it("reads the computed internal stability, not the seeded 75", async () => {
  await db.internalStabilityMetrics.deleteMany({ where: { countryId: "testland" } });
  const snapshot = await buildCountrySnapshot("testland", db as never, NOW);
  expect(Number.isFinite(snapshot?.stabilityScore)).toBe(true);
  expect(snapshot?.stabilityScore).not.toBe(75);
  expect(snapshot?.policingEffectiveness).not.toBe(50);
});
