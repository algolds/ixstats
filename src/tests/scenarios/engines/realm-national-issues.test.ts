/** @jest-environment node */
/**
 * Realm time design §2: national issues run on each nation's realm clock. An issue is raised at its nation's time,
 * answered at it (its GDP effect starts then), and the weekly cap and debounce count on that clock: Ixnay's nation
 * on IxTime, a paused realm's nation at its frozen time, a 6× realm's nation years ahead.
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
import { NationalIssuesConsequences, NationalIssuesEngine } from "~/lib/national-issues";
import { resetRealmClockCache } from "~/server/shared/realm-time";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIssueTemplate, addIxnay, addNation, addRealm } from "~/tests/helpers/nation-world";

const YEAR = 365.25 * 86_400_000;
const IXNAY_NOW = Date.UTC(2043, 0, 15);
const FROZEN_NOW = IXNAY_NOW - YEAR;
const FAST_NOW = IXNAY_NOW + 3 * YEAR;

let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(IXNAY_NOW);
  resetRealmClockCache();
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addRealm(db as never, "frozen", { nowMs: FROZEN_NOW, multiplier: 0 });
  await addRealm(db as never, "fast", { nowMs: FAST_NOW, multiplier: 6 });
  const baselineDate = new Date(FROZEN_NOW - YEAR);
  await addNation(db as never, { id: "ixland", baselineDate });
  await addNation(db as never, { id: "frostland", baselineDate, realmId: "frozen" });
  await addNation(db as never, { id: "swiftland", baselineDate, realmId: "fast" });
  await addIssueTemplate(db as never, {
    id: "port-strike",
    title: "Port strike",
    domain: "economic",
    category: "economic",
    options: [
      {
        id: "negotiate",
        label: "Negotiate",
        consequences: [
          {
            targetModel: "Country",
            targetField: "currentTotalGdp",
            operation: "multiply",
            value: 0.995,
          },
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

async function raiseAndAnswer(countryId: string) {
  const issueId = (await NationalIssuesEngine.forceGenerate(
    "port-strike",
    countryId,
    db as never
  ))!;
  const resolved = await NationalIssuesConsequences.resolveIssue(issueId, "negotiate", db as never);
  expect(resolved.success).toBe(true);
  const issue = await db.nationalIssue.findUniqueOrThrow({ where: { id: issueId } });
  const effect = await db.storytellerEffect.findFirstOrThrow({
    where: { createdBy: `issue:${issueId}` },
  });
  return {
    created: issue.createdIxTime,
    responded: issue.respondedIxTime!,
    effect: effect.ixTimeTimestamp.getTime(),
  };
}

it("raises and answers each nation's issue at its realm's time", async () => {
  expect(await raiseAndAnswer("ixland")).toEqual({
    created: IXNAY_NOW,
    responded: IXNAY_NOW,
    effect: IXNAY_NOW,
  });
  expect(await raiseAndAnswer("frostland")).toEqual({
    created: FROZEN_NOW,
    responded: FROZEN_NOW,
    effect: FROZEN_NOW,
  });
  const swift = await raiseAndAnswer("swiftland");
  for (const at of Object.values(swift)) {
    expect(at - FAST_NOW).toBeGreaterThanOrEqual(0);
    expect(at - FAST_NOW).toBeLessThan(60_000);
  }
});

it("debounces evaluation on each nation's clock", async () => {
  for (const [countryId, at] of [
    ["ixland", IXNAY_NOW],
    ["frostland", FROZEN_NOW],
  ] as const) {
    await db.issueGenerationLog.create({
      data: { countryId, ixTimeAtEvaluation: at, templatesEvaluated: 0, issuesGenerated: 0 },
    });
  }
  // Evaluated just now on their own clocks: not due again
  expect(await NationalIssuesEngine.shouldEvaluate("ixland", db as never)).toBe(false);
  expect(await NationalIssuesEngine.shouldEvaluate("frostland", db as never)).toBe(false);
  // Swiftland's realm stands years past that stamp
  await db.issueGenerationLog.create({
    data: {
      countryId: "swiftland",
      ixTimeAtEvaluation: IXNAY_NOW,
      templatesEvaluated: 0,
      issuesGenerated: 0,
    },
  });
  expect(await NationalIssuesEngine.shouldEvaluate("swiftland", db as never)).toBe(true);
});
