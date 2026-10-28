/** @jest-environment node */
/**
 * Politics drift runs on the nation's realm clock (realm time design §2; stress test B-12a): a party's support moves
 * by the realm time since its last drift, so a 12x realm drifts 12 times as far per real day as a 1x realm, a second
 * run at the same instant adds nothing, and a long gap converges toward the same equilibrium instead of overshooting.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/diplomacy/news-generator", () => ({ generateDiplomaticNews: jest.fn() }));

import { IxTime } from "~/lib/ixtime";
import {
  DRIFT_STEP_CLOCK_MS,
  driftJitter,
  driftedSupport,
  runPoliticsDrift,
} from "~/lib/government/politics-drift-cron";
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
  await db.country.update({ where: { id: "testland" }, data: { adjustedGdpGrowth: 0 } });
  for (const [id, support] of [
    ["p-a", 60],
    ["p-b", 20],
  ] as const) {
    await db.politicalParty.create({
      data: {
        id,
        countryId: "testland",
        name: id,
        ideology: "center",
        baseSupport: 40,
        currentSupport: support,
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

describe("driftedSupport", () => {
  it("is one step for one step of realm time, and nothing for none", () => {
    expect(driftedSupport({ current: 60, base: 40, perStep: 0, steps: 1 })).toBeCloseTo(58, 9);
    expect(driftedSupport({ current: 60, base: 40, perStep: 0, steps: 0 })).toBe(60);
  });
  it("converges to its equilibrium over a long gap, never past it", () => {
    expect(driftedSupport({ current: 60, base: 40, perStep: 0.5, steps: 1e6 })).toBeCloseTo(45, 6);
    expect(driftedSupport({ current: 60, base: 40, perStep: 50, steps: 1e6 })).toBe(99);
  });
});

describe("runPoliticsDrift on the realm clock", () => {
  it("adds nothing on a second run at the same instant", async () => {
    await runPoliticsDrift({ clocks: ixnayRunningAt(NOW) });
    const once = await support("p-a");
    await runPoliticsDrift({ clocks: ixnayRunningAt(NOW) });
    expect(await support("p-a")).toBe(once);
  });

  it("moves twelve steps for twelve steps of realm time (a 12x realm's real day vs a 1x realm's two hours)", async () => {
    await runPoliticsDrift({ clocks: ixnayRunningAt(NOW) });
    const start = await support("p-b");
    const later = NOW + 12 * DRIFT_STEP_CLOCK_MS;
    await runPoliticsDrift({ clocks: ixnayRunningAt(later) });
    const governing = await db.politicalParty.findUniqueOrThrow({ where: { id: "p-a" } });
    expect(governing.currentSupport).toBeGreaterThan(40); // still above its base, converging
    expect(await support("p-b")).toBeCloseTo(
      driftedSupport({ current: start, base: 40, perStep: driftJitter("p-b", later), steps: 12 }),
      2
    );
  });
});
