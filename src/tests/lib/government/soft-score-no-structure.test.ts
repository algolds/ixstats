/** @jest-environment node */
/**
 * A consequence on a governance score for a nation without a GovernmentStructure row used to be
 * dropped (128 of 152 Ixnay nations have none). The spine now creates the bare row (no
 * departments, no budget) on first touch, as it does the stability row, so the delta lands and
 * moves the effective score.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/diplomacy/news-generator", () => ({ generateDiplomaticNews: jest.fn() }));
jest.mock("~/lib/activity/hooks", () => ({ ActivityHooks: {} }));
jest.mock("~/server/shared/intelligence-alert-thresholds", () => ({
  evaluateCountryThresholds: jest.fn(async () => undefined),
}));

import { CountryEventSpine } from "~/lib/activity/event-spine";
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
  // A nation that never set up a government: no structure, no departments, no budget.
  await db.budgetAllocation.deleteMany({});
  await db.governmentDepartment.deleteMany({});
  await db.governmentStructure.deleteMany({ where: { countryId: "testland" } });
});

it("an issue consequence on corruption creates the bare structure and moves the effective score", async () => {
  const before = (await loadSoftScores(db as never, "testland", NOW))!.effective.corruptionIndex;

  await CountryEventSpine.recordCountryEvent({
    db: db as never,
    countryId: "testland",
    now: NOW,
    sourceType: "issue",
    description: "Anti-graft drive",
    consequences: [
      {
        targetModel: "GovernmentStructure",
        targetField: "corruptionIndex",
        operation: "subtract",
        value: 6,
      },
    ],
  });

  const after = (await loadSoftScores(db as never, "testland", NOW))!.effective.corruptionIndex;
  expect(after).toBeCloseTo(before - 6, 5);
  const structure = await db.governmentStructure.findUnique({
    where: { countryId: "testland" },
    select: { corruptionIndex: true, totalBudget: true, departments: { select: { id: true } } },
  });
  expect(structure).toMatchObject({ corruptionIndex: 44, totalBudget: 0, departments: [] });
});
