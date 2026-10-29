/** @jest-environment node */
/**
 * Stress findings C-06/C-07: three concurrent answers to one issue apply its consequences once (the first claims the
 * issue, the others are refused), and a delegated (dismissed) issue can no longer be answered for its consequences.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));

import { IxTime } from "~/lib/ixtime";
import { NationalIssuesEngine } from "~/lib/national-issues";
import { createCallerFactory } from "~/server/api/trpc";
import { nationalIssuesPlayerRouter } from "~/server/api/routers/national-issues/player";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addIssueTemplate,
  addIxnay,
  addNation,
  addOwner,
  asOwner,
} from "~/tests/helpers/nation-world";

const issues = createCallerFactory(nationalIssuesPlayerRouter);
const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, { id: "testland", baselineDate: new Date(NOW - 365 * 86_400_000) });
  await addIssueTemplate(db as never, {
    id: "strike",
    title: "Port strike",
    domain: "economic",
    options: [
      {
        id: "negotiate",
        label: "Negotiate",
        consequences: [
          { targetModel: "Country", targetField: "publicApproval", operation: "add", value: 4 },
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

it("applies an issue's consequences once however many answers race", async () => {
  const owner = issues(asOwner(db as never, await addOwner(db as never, "lena", "testland")));
  const issueId = (await NationalIssuesEngine.forceGenerate("strike", "testland", db as never))!;
  const results = await Promise.allSettled(
    [1, 2, 3].map(() => owner.respond({ issueId, optionId: "negotiate" }))
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.nationalIssueConsequence.count({ where: { issueId } })).toBe(1);
  expect((await db.country.findUnique({ where: { id: "testland" } }))?.publicApproval).toBe(54);
});

it("refuses to answer a delegated issue", async () => {
  const owner = issues(asOwner(db as never, await addOwner(db as never, "lena", "testland")));
  const issueId = (await NationalIssuesEngine.forceGenerate("strike", "testland", db as never))!;
  await db.nationalIssue.update({ where: { id: issueId }, data: { status: "dismissed" } });
  await expect(owner.respond({ issueId, optionId: "negotiate" })).rejects.toMatchObject({
    code: "BAD_REQUEST",
    message: "Issue already resolved",
  });
  expect((await db.country.findUnique({ where: { id: "testland" } }))?.publicApproval).toBe(50);
});

it("writes the consequence log the brief shows in plain words (no emoji, no shouting)", async () => {
  await db.nationalIssueTemplate.update({
    where: { id: "strike" },
    data: {
      responseOptions: JSON.stringify([
        { id: "gamble", label: "Gamble", description: "Gamble", isRisky: true, consequences: [] },
      ]),
    },
  });
  jest.spyOn(Math, "random").mockReturnValue(0.1); // the gamble backfires
  const owner = issues(asOwner(db as never, await addOwner(db as never, "lena", "testland")));
  const issueId = (await NationalIssuesEngine.forceGenerate("strike", "testland", db as never))!;
  const { consequenceLog } = await owner.respond({ issueId, optionId: "gamble" });
  expect(consequenceLog).toContain("The gamble backfired");
  expect(consequenceLog).not.toMatch(/[☀-➿]|[A-Z]{4,}/u);
});
