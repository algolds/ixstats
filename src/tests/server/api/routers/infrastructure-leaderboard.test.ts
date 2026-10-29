/** @jest-environment node */
/**
 * The achievements leaderboard ranks infrastructure by the effective rating (derived from the sim
 * plus the stored offset, owner decision 3), not the stored column every nation seeded at 50.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { achievementsCountryRouter } from "~/server/api/routers/achievements/country";
import { loadSoftScores } from "~/lib/government/soft-scores-store";
import { IxTime } from "~/lib/ixtime";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, asOwner } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, { id: "richland", baselineDate: new Date(NOW) });
  await addNation(db as never, { id: "poorland", baselineDate: new Date(NOW) });
  // Same stored 50; richland is far wealthier, so it rates higher
  await db.country.update({ where: { id: "richland" }, data: { currentGdpPerCapita: 80_000 } });
  await db.country.update({ where: { id: "poorland" }, data: { currentGdpPerCapita: 3_000 } });
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
});

it("ranks infrastructure by the effective rating", async () => {
  const viewer = await addOwner(db as never, "lena", "poorland");
  const rows = await createCallerFactory(achievementsCountryRouter)(
    asOwner(db as never, viewer)
  ).getCountryLeaderboard({ metric: "infrastructure" });

  const effective = async (id: string) =>
    (await loadSoftScores(db as never, id, NOW))!.effective.infrastructureRating;
  expect(rows.map((r) => r.countryId)).toEqual(["richland", "poorland"]);
  expect(rows[0]!.value).toBe(await effective("richland"));
  expect(rows[1]!.value).toBe(await effective("poorland"));
  expect(rows[0]!.value).toBeGreaterThan(rows[1]!.value + 20);
});
