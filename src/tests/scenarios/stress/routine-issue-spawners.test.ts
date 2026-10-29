/** @jest-environment node */
/**
 * Routine issue templates (budget priorities, a census) are the paced cron's fallback only. The other spawners that
 * pick a template by domain, a volatile policy's backlash roll and an intent's resistance, never pick one: a festival
 * is not a backlash.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));

import { IxTime } from "~/lib/ixtime";
import { spawnResistanceForIntent } from "~/lib/intent/resistance";
import { runPolicyMaintenanceDebits } from "~/lib/policies/maintenance-cron";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIssueTemplate, addIxnay, addNation, addOwner } from "~/tests/helpers/nation-world";

const DAY = 86_400_000;
const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, { id: "testland", baselineDate: new Date(NOW - 365 * DAY) });
  await addOwner(db as never, "lena", "testland");
  // The routine template comes first and is the most urgent, so only the exclusion keeps it out
  for (const [id, urgency] of [
    ["routine_budget_priorities", 99],
    ["price_protests", 40],
  ] as const) {
    await addIssueTemplate(db as never, {
      id,
      title: id,
      domain: "economic",
      category: "economic",
      urgency,
      options: [{ id: "accept", label: "Accept", consequences: [] }],
    });
  }
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

const templatesIssued = async () =>
  (await db.nationalIssue.findMany({ where: { countryId: "testland" } })).map((i) => i.templateId);

it("a volatile policy's backlash never picks a routine template", async () => {
  await db.policy.create({
    data: {
      id: "p1",
      countryId: "testland",
      userId: "lena",
      name: "Bold tax",
      description: "Risky",
      policyType: "economic",
      category: "fiscal",
      status: "active",
      riskRating: "volatile",
      maintenanceCost: 0,
    },
  });
  jest.spyOn(Math, "random").mockReturnValue(0); // the roll passes and the first matching template is chosen
  await runPolicyMaintenanceDebits(db as never);
  expect(await templatesIssued()).toEqual(["price_protests"]);
});

it("an intent's resistance never picks a routine template", async () => {
  await spawnResistanceForIntent({
    db: db as never,
    countryId: "testland",
    intent: { id: "i1" } as never,
    tokens: ["economic"],
    now: NOW,
  });
  expect(await templatesIssued()).toEqual(["price_protests"]);
});
