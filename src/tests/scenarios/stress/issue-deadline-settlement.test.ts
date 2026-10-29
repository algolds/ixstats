/** @jest-environment node */
/**
 * Stress finding C-14: with ISSUES_ENFORCE_DEADLINES on, nothing settled an overdue issue (deadlines showed and
 * blocked delegation, but an issue past its deadline stayed open forever and its stored default never applied). The
 * cron now applies the default option (auto_resolved) or, with no default, expires the issue; an issue still in time
 * and an answered one are left alone.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));

import { IxTime } from "~/lib/ixtime";
import { NationalIssuesEngine } from "~/lib/national-issues";
import { settleOverdueIssues } from "~/lib/national-issues/generation-cron";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIssueTemplate, addIxnay, addNation } from "~/tests/helpers/nation-world";

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
  await addIssueTemplate(db as never, {
    id: "strike",
    title: "Port strike",
    domain: "economic",
    options: [
      {
        id: "concede",
        label: "Concede",
        consequences: [
          { targetModel: "Country", targetField: "publicApproval", operation: "add", value: 2 },
        ],
      },
    ],
  });
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

const issueDue = async (deadlineIxTime: number, autoResolveOptionId: string | null) => {
  const id = (await NationalIssuesEngine.forceGenerate("strike", "testland", db as never))!;
  await db.nationalIssue.update({ where: { id }, data: { deadlineIxTime, autoResolveOptionId } });
  return id;
};

it("applies the default of an overdue issue, expires one with no default, and leaves the rest", async () => {
  const withDefault = await issueDue(NOW - DAY, "concede");
  const noDefault = await issueDue(NOW - DAY, null);
  const inTime = await issueDue(NOW + DAY, "concede");

  expect(await settleOverdueIssues(db as never, "testland", NOW)).toBe(2);
  const status = async (id: string) =>
    (await db.nationalIssue.findUnique({ where: { id } }))?.status;
  expect(await status(withDefault)).toBe("auto_resolved");
  expect(await status(noDefault)).toBe("expired");
  expect(await status(inTime)).toBe("pending");
  expect((await db.country.findUnique({ where: { id: "testland" } }))?.publicApproval).toBe(52);

  // Settling again changes nothing (the default applied once)
  expect(await settleOverdueIssues(db as never, "testland", NOW)).toBe(0);
  expect((await db.country.findUnique({ where: { id: "testland" } }))?.publicApproval).toBe(52);
});
