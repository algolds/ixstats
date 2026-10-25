/** @jest-environment node */
/**
 * P1-08 (F-P1-12, F21): intelligence alert thresholds are evaluated when the simulation moves a stat, not only when the
 * owner saves the country row. Stat progression evaluates them against the stats it just wrote, and an event-spine
 * consequence evaluates them after it applies.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));
jest.mock("~/lib/diplomacy/news-generator", () => ({ generateDiplomaticNews: jest.fn() }));

import { IxTime } from "~/lib/ixtime";
import { CountryEventSpine } from "~/lib/activity/event-spine";
import { runStatProgression } from "~/server/cron/stat-progression";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation } from "~/tests/helpers/nation-world";

const YEAR = 365.25 * 86_400_000;
const NOW = Date.UTC(2043, 0, 15);

let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, { id: "testland", baselineDate: new Date(NOW - YEAR) });
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

function watch(metricName: string, band: { criticalMin?: number; criticalMax?: number }) {
  return db.intelligenceAlertThreshold.create({
    data: { countryId: "testland", userId: "u1", alertType: "economic", metricName, ...band },
  });
}

const alerts = () => db.intelligenceAlert.findMany({ where: { countryId: "testland" } });

it("stat progression raises an alert for a threshold the GDP it just stored breaches", async () => {
  // The stored GDP (3e11) is inside the band; the projection half a year on is above it
  await watch("totalGDP", { criticalMax: 3e11 });
  expect(await alerts()).toHaveLength(0);

  await runStatProgression({ db: db as never, ixTime: NOW + YEAR / 2 });

  const raised = await alerts();
  expect(raised).toHaveLength(1);
  expect(raised[0]).toMatchObject({ title: "totalGDP breached critical threshold" });
  expect(raised[0]!.currentValue).toBeGreaterThan(3e11);
});

it("an event-spine consequence raises an alert for the stat it moved", async () => {
  await watch("publicApproval", { criticalMin: 40 });

  await CountryEventSpine.recordCountryEvent({
    db: db as never,
    countryId: "testland",
    sourceType: "issue",
    description: "A scandal",
    consequences: [
      { targetModel: "Country", targetField: "publicApproval", operation: "subtract", value: 20 },
    ],
  });

  const raised = await alerts();
  expect(raised).toHaveLength(1);
  expect(raised[0]).toMatchObject({
    title: "publicApproval breached critical threshold",
    currentValue: 30,
  });
});
