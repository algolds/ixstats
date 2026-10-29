/** @jest-environment node */
/**
 * Stress findings C-01..C-05 on the directive commit path: a foreign goal is a bad request (not a server fault), a
 * blank or NUL goal is refused before it reaches the database, keywords match whole words ("support family farms" is
 * not a defense goal), the broker option needs its broker's backing and the structural option is never committable,
 * and an upgraded draft takes the goal it was committed with.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));
jest.mock("~/lib/intent/intent-summation", () => ({
  generateIntentSummationDraft: jest.fn(async () => null),
}));
jest.mock("~/lib/national-issues/config", () => ({
  ...jest.requireActual("~/lib/national-issues/config"),
  getNationalIssuesConfig: () => ({
    maxIssuesPerSession: 3,
    maxIssuesPerWeek: 5,
    spawnMode: "off",
  }),
}));

import { IxTime } from "~/lib/ixtime";
import { classifyGoal } from "~/lib/intent/assemble";
import { createCallerFactory } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, asOwner, type Owner } from "~/tests/helpers/nation-world";

const intents = createCallerFactory(intentRouter);
const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;
let owner: Owner;
const caller = () => intents(asOwner(db as never, owner));

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, {
    id: "testland",
    baselineDate: new Date(NOW - 365 * 86_400_000),
    budgetYear: 2043,
  });
  owner = await addOwner(db as never, "lena", "testland");
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

it("answers a foreign goal as a bad request, on suggest and commit", async () => {
  await expect(
    caller().suggest({ countryId: "testland", goal: "war with Urcea" })
  ).rejects.toMatchObject({
    code: "BAD_REQUEST",
    message: expect.stringContaining("restricted to domestic policy"),
  });
  await expect(
    caller().commit({ countryId: "testland", goal: "Sign a peace treaty", tier: "measured" })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("refuses a blank or NUL goal before it reaches the database", async () => {
  await expect(caller().suggest({ countryId: "testland", goal: "   " })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  await expect(
    caller().commit({ countryId: "testland", goal: "ab\u0000cd", tier: "proposed" })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  const saved = await caller().commit({
    countryId: "testland",
    goal: "  build rail  ",
    tier: "proposed",
  });
  expect(saved.intent.goal).toBe("build rail");
});

it.each([
  ["Support family farms", "social"],
  ["Improve software education", "social"],
  ["Toward better reporting of hospital waits", "social"],
  ["Reduce unemployment", "economy"],
  ["Expand the national defense industry", "defense"],
])("classifies %p by whole words as %s", (goal, category) => {
  expect(classifyGoal(goal).category).toBe(category);
});

it("commits the broker option only with its broker's backing, and never the structural one", async () => {
  const goal = "Boost military defense readiness";
  await expect(
    caller().commit({ countryId: "testland", goal, tier: "broker_unlocked" })
  ).rejects.toMatchObject({
    code: "PRECONDITION_FAILED",
  });
  await expect(
    caller().commit({ countryId: "testland", goal, tier: "structural_unlocked" })
  ).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  expect((await caller().getStatus({ countryId: "testland" })).usedThisWeek).toBe(0);

  await db.governmentComponent.create({
    data: { countryId: "testland", componentType: "MILITARY_ADMINISTRATION", isActive: true },
  });
  const { intent } = await caller().commit({
    countryId: "testland",
    goal,
    tier: "broker_unlocked",
  });
  expect(intent.status).toBe("active");
});

it("stores the committed goal on an upgraded draft", async () => {
  const draft = await caller().commit({
    countryId: "testland",
    goal: "Build rail",
    tier: "proposed",
  });
  const { intent } = await caller().commit({
    countryId: "testland",
    goal: "Crack down on urban crime",
    tier: "measured",
    intentId: draft.intent.id,
  });
  expect(intent).toMatchObject({ goal: "Crack down on urban crime", category: "security" });
});
