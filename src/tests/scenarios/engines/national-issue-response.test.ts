/** @jest-environment node */
/**
 * A port strike hits Testland. The engine raises the issue from the nation's snapshot; a rival player's answer is
 * refused and the issue stays open. Testland's owner negotiates: approval and stability land in the columns the
 * Standing bands read, the GDP and GDP-growth consequences become level effects (never field writes), and the issue is
 * closed with a consequence log. A consequence the engine cannot apply is left out. Two IxTime years on, the stat
 * progression has moved Testland's stored GDP by exactly the phased effects, against an untouched twin nation.
 *
 * Folds national-issues-resolve-effects (the column writes, the StorytellerEffects and their consequence rows, the
 * log line, the unappliable consequence; its no-IxCredits tombstone is not carried), the +X pp, multiplier and
 * dropped-consequence cases of national-issues-projection-effects, and stat-progression's level-effect case.
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
import { runStatProgression } from "~/server/cron/stat-progression";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addIssueTemplate,
  addIxnay,
  addNation,
  addOwner,
  asOwner,
} from "~/tests/helpers/nation-world";

const issues = createCallerFactory(nationalIssuesPlayerRouter);

const YEAR = 365.25 * 86_400_000;
const NOW = Date.UTC(2043, 0, 15);

const approval = {
  targetModel: "Country",
  targetField: "publicApproval",
  operation: "add",
  value: 4,
};
const stability = {
  targetModel: "InternalStabilityMetrics",
  targetField: "stabilityScore",
  operation: "subtract",
  value: 3,
};
const growth = {
  targetModel: "Country",
  targetField: "actualGdpGrowth",
  operation: "add",
  value: 0.3,
};
const gdpShock = {
  targetModel: "Country",
  targetField: "currentTotalGdp",
  operation: "multiply",
  value: 0.995,
};
const unappliable = {
  targetModel: "Country",
  targetField: "currentTotalGdp",
  operation: "set",
  value: 1,
};

let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  // The clock stands still at NOW (an override followed by a pause reads back exactly)
  IxTime.setTimeOverride(NOW);
  IxTime.setMultiplierOverride(0);
  db = createMemoryPrisma();
  mockDb = db;
  const baselineDate = new Date(NOW - YEAR);
  await addIxnay(db as never);
  await addNation(db as never, { id: "testland", name: "Testland", baselineDate });
  await addNation(db as never, { id: "twinland", name: "Twinland", baselineDate });
  await addIssueTemplate(db as never, {
    id: "port-strike",
    title: "Port strike",
    domain: "economic",
    category: "economic",
    options: [
      {
        id: "negotiate",
        label: "Negotiate",
        consequences: [approval, stability, growth, gdpShock] as never,
      },
      { id: "ignore", label: "Ignore", consequences: [] },
    ],
  });
  await addIssueTemplate(db as never, {
    id: "harbour-audit",
    title: "Harbour audit",
    domain: "economic",
    category: "economic",
    options: [{ id: "publish", label: "Publish", consequences: [approval, unappliable] as never }],
  });
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

it("raises an issue, refuses a rival, applies the owner's answer and moves the projected GDP", async () => {
  const lena = await addOwner(db as never, "lena", "testland");
  const omar = await addOwner(db as never, "omar", "twinland");

  const issueId = (await NationalIssuesEngine.forceGenerate(
    "port-strike",
    "testland",
    db as never
  ))!;
  expect(await db.nationalIssue.findUniqueOrThrow({ where: { id: issueId } })).toMatchObject({
    countryId: "testland",
    title: "Port strike",
    status: "pending",
    createdIxTime: NOW,
  });

  await expect(
    issues(asOwner(db as never, omar)).respond({ issueId, optionId: "negotiate" })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect((await db.nationalIssue.findUniqueOrThrow({ where: { id: issueId } })).status).toBe(
    "pending"
  );

  const result = await issues(asOwner(db as never, lena)).respond({
    issueId,
    optionId: "negotiate",
  });
  expect(result.consequences.map((c) => c.targetField)).toEqual([
    "publicApproval",
    "stabilityScore",
    "actualGdpGrowth",
    "currentTotalGdp",
  ]);
  expect(result.consequences.slice(2)).toEqual([
    expect.objectContaining({ effectType: "projection", delta: 0.3 }),
    expect.objectContaining({ effectType: "projection" }),
  ]);
  expect(result.consequenceLog).toContain("GDP per capita +0.30% over 1 IxTime year");

  // Approval and stability land in the columns the Standing bands read; growth and GDP are not written
  expect(
    await db.country.findUniqueOrThrow({
      where: { id: "testland" },
      select: { publicApproval: true, actualGdpGrowth: true, currentTotalGdp: true },
    })
  ).toEqual({ publicApproval: 54, actualGdpGrowth: 0.02, currentTotalGdp: 3e11 });
  expect(
    (await db.internalStabilityMetrics.findUniqueOrThrow({ where: { countryId: "testland" } }))
      .stabilityScore
  ).toBe(57);

  // They become level effects the projection reads: growth phased in over a year, the shock at once
  expect(
    await db.storytellerEffect.findMany({
      where: { countryId: "testland" },
      select: {
        inputType: true,
        value: true,
        duration: true,
        isActive: true,
        createdBy: true,
        ixTimeTimestamp: true,
      },
      orderBy: { value: "desc" },
    })
  ).toEqual([
    {
      inputType: "gdp_level_adjustment",
      value: 0.003,
      duration: 1,
      isActive: true,
      createdBy: `issue:${issueId}`,
      ixTimeTimestamp: new Date(NOW),
    },
    {
      inputType: "gdp_level_adjustment",
      value: -0.005,
      duration: null,
      isActive: true,
      createdBy: `issue:${issueId}`,
      ixTimeTimestamp: new Date(NOW),
    },
  ]);
  expect(
    await db.nationalIssueConsequence.findMany({
      where: { issueId, effectType: "projection" },
      select: { targetField: true },
    })
  ).toEqual(expect.arrayContaining([{ targetField: "actualGdpGrowth" }]));
  expect(await db.nationalIssue.findUniqueOrThrow({ where: { id: issueId } })).toMatchObject({
    status: "responded",
    chosenOptionId: "negotiate",
    respondedIxTime: NOW,
  });

  // A consequence the engine cannot apply is left out, with no effect and no GDP line
  const auditId = (await NationalIssuesEngine.forceGenerate(
    "harbour-audit",
    "testland",
    db as never
  ))!;
  const audit = await issues(asOwner(db as never, lena)).respond({
    issueId: auditId,
    optionId: "publish",
  });
  expect(audit.consequences.map((c) => c.targetField)).toEqual(["publicApproval"]);
  expect(audit.consequenceLog).not.toContain("GDP");
  expect(await db.storytellerEffect.count({ where: { createdBy: `issue:${auditId}` } })).toBe(0);

  // Two IxTime years on, the stored GDP per head differs from the untouched twin by the two effects, fully phased in
  await runStatProgression({ db: db as never, ixTime: NOW + 2 * YEAR });
  const perHead = async (id: string) =>
    (await db.country.findUniqueOrThrow({ where: { id } })).currentGdpPerCapita;
  expect((await perHead("testland")) / (await perHead("twinland"))).toBeCloseTo(1.003 * 0.995, 9);
});
