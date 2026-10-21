/** @jest-environment node */
/**
 * Testland's owner asks for packages to create industrial jobs and commits the moderate one: it is applied once through
 * the spine (linked to the directive), a phased GDP level effect is added, its executive-bandwidth cost is held, and in
 * deterministic mode a resistance issue is raised and linked. A second economy directive raises no second issue while
 * the first is open. A security directive adds no growth effect; an abandoned one still uses its weekly slot, so a
 * fourth directive that week is refused. The outcome reports the ledger and the GDP effect. The directive cannot be
 * completed while resistance is open; as the owner answers and delegates the linked issues its progress follows, and
 * then it completes.
 *
 * Folds intent-commit-effects (spine link, non-zero levers, the level effect, the stored bandwidth cost, no growth
 * effect for security, assemblePackages' levers), intent-weekly-cap (abandoned keeps the slot, drafts never count,
 * the fourth refused), intent-outcome (ledger numbers, non-numeric rows, GDP effects, NOT_FOUND, suggest's level
 * shift), national-issues-consequences (progress from linked statuses), intent-system's five packages, the directive
 * sum and window of exec-bandwidth, and the spawn, link and deterministic-mode cases of resistance.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));
jest.mock("~/lib/activity/directive-activity", () => ({
  declareDirectiveActivity: jest.fn(async () => null),
  withdrawDirectiveActivity: jest.fn(async () => undefined),
}));
jest.mock("~/lib/intent/intent-summation", () => ({
  generateIntentSummationDraft: jest.fn(async () => null),
}));
jest.mock("~/lib/national-issues/config", () => ({
  ...jest.requireActual("~/lib/national-issues/config"),
  getNationalIssuesConfig: () => ({
    maxIssuesPerSession: 3,
    maxIssuesPerWeek: 5,
    spawnMode: "deterministic",
  }),
}));

import { IxTime } from "~/lib/ixtime";
import { growthModifierToLevelShift } from "~/lib/economy/calculations";
import {
  DIRECTIVE_EXEC_BANDWIDTH_WINDOW_MS,
  loadExecBandwidthState,
} from "~/lib/government/exec-bandwidth";
import { GROWTH_EFFECT_YEARS } from "~/lib/intent/assemble";
import { NationalIssuesConsequences, NationalIssuesEngine } from "~/lib/national-issues";
import { createCallerFactory } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { nationalIssuesPlayerRouter } from "~/server/api/routers/national-issues/player";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addIssueTemplate,
  addIxnay,
  addNation,
  addOwner,
  asOwner,
  type Owner,
} from "~/tests/helpers/nation-world";

const intents = createCallerFactory(intentRouter);
const issues = createCallerFactory(nationalIssuesPlayerRouter);

const NOW = Date.UTC(2043, 0, 15);
const JOBS = "Create industrial manufacturing jobs";
const CRIME = "Crack down on urban crime";

let db: MemoryPrisma;
let lena: Owner;

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  IxTime.setTimeOverride(NOW);
  IxTime.setMultiplierOverride(0);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, {
    id: "testland",
    name: "Testland",
    baselineDate: new Date(NOW - 365 * 86_400_000),
    budgetYear: 2043,
  });
  lena = await addOwner(db as never, "lena", "testland");
  await addIssueTemplate(db as never, {
    id: "factory-walkout",
    title: "Factory walkout",
    domain: "economic",
    category: "economic",
    options: [
      {
        id: "concede",
        label: "Concede",
        consequences: [
          { targetModel: "Country", targetField: "publicApproval", operation: "add", value: 1 },
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

it("commits, caps, resists, reports and completes a directive", async () => {
  const owner = intents(asOwner(db as never, lena));
  const status = () => owner.getStatus({ countryId: "testland" });

  // The five packages, each with the level shift commit records and no zero-value lever
  const suggested = await owner.suggest({ countryId: "testland", goal: JOBS });
  expect(suggested.category).toBe("economy");
  expect(suggested.packages.map((p) => p.tier)).toEqual([
    "measured",
    "moderate",
    "extreme",
    "broker_unlocked",
    "structural_unlocked",
  ]);
  for (const p of suggested.packages) {
    expect(p.changes.length).toBeLessThanOrEqual(4);
    expect(p.execBandwidthCost).toBeGreaterThan(0);
    expect(p.consequences.every((c) => c.value !== 0)).toBe(true);
    expect(p.gdpLevelShift).toBe(
      p.gdpGrowthModifier > 0
        ? growthModifierToLevelShift(p.gdpGrowthModifier, GROWTH_EFFECT_YEARS)
        : 0
    );
    expect(p.gdpEffectYears).toBe(GROWTH_EFFECT_YEARS);
  }
  expect(suggested.packages.some((p) => p.gdpLevelShift > 0)).toBe(true);
  const defense = await owner.suggest({
    countryId: "testland",
    goal: "Boost military defense readiness",
  });
  expect(defense.packages[1]!.consequences.map((c) => c.targetField)).toContain("stabilityScore");
  expect(defense.packages[1]!.gdpGrowthModifier).toBe(0);

  // A saved draft uses no slot
  await owner.commit({ countryId: "testland", goal: "Build rail", tier: "proposed" });
  expect((await status()).usedThisWeek).toBe(0);

  // The moderate jobs directive: applied once through the spine, a phased level effect, its bandwidth held
  const moderate = suggested.packages.find((p) => p.tier === "moderate")!;
  const { intent: jobs } = await owner.commit({
    countryId: "testland",
    goal: JOBS,
    tier: "moderate",
  });
  expect(jobs).toMatchObject({ status: "active", execBandwidthCost: moderate.execBandwidthCost });
  const ledger = await db.countryChangeLog.findMany({
    where: { sourceId: jobs.id },
    select: { targetField: true, previousValue: true, newValue: true, deltaValue: true },
  });
  expect(ledger).toEqual([
    {
      targetField: "unemploymentRate",
      previousValue: "6.5",
      newValue: "5.9",
      deltaValue: expect.any(Number),
    },
  ]);
  expect(ledger[0]!.deltaValue).toBeCloseTo(-0.6, 9);
  expect(
    (await db.country.findUniqueOrThrow({ where: { id: "testland" } })).unemploymentRate
  ).toBeCloseTo(5.9, 9);
  expect(
    await db.storytellerEffect.findMany({
      where: { createdBy: `intent:${jobs.id}` },
      select: { inputType: true, value: true, duration: true, isActive: true },
    })
  ).toEqual([{ inputType: "gdp_level_adjustment", value: 0.000583, duration: 1, isActive: true }]);

  // Deterministic mode raises one resistance issue, linked to the directive
  const resistance = await db.nationalIssue.findMany({ where: { intentId: jobs.id } });
  expect(resistance).toEqual([
    expect.objectContaining({
      templateId: "factory-walkout",
      status: "pending",
      countryId: "testland",
    }),
  ]);

  // A second jobs directive raises no second issue while the first is open; abandoned, it keeps its slot
  const { intent: again } = await owner.commit({
    countryId: "testland",
    goal: JOBS,
    tier: "moderate",
  });
  expect(await db.nationalIssue.count({ where: { templateId: "factory-walkout" } })).toBe(1);
  await owner.updateStatus({ id: again.id, status: "abandoned" });
  expect(await status()).toMatchObject({ usedThisWeek: 2, canCommit: true });

  // A security directive moves no GDP; the extreme package's cost is stored
  const extreme = (await owner.suggest({ countryId: "testland", goal: CRIME })).packages.find(
    (p) => p.tier === "extreme"
  )!;
  const { intent: crime } = await owner.commit({
    countryId: "testland",
    goal: CRIME,
    tier: "extreme",
  });
  expect(crime.execBandwidthCost).toBe(extreme.execBandwidthCost);
  expect(extreme.execBandwidthCost).toBeGreaterThan(0);
  expect(await db.storytellerEffect.count({ where: { createdBy: `intent:${crime.id}` } })).toBe(0);

  // The week's cap is full: a fourth directive is refused and writes nothing
  expect(await status()).toMatchObject({ usedThisWeek: 3, cap: 3, canCommit: false });
  await expect(
    owner.commit({ countryId: "testland", goal: CRIME, tier: "measured" })
  ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  expect(await db.intent.count({ where: { tier: { not: "proposed" } } })).toBe(3);

  // Executing directives hold their cost for the execution window (the abandoned one holds nothing)
  expect((await loadExecBandwidthState(db as never, "testland")).breakdown.directives).toBe(
    moderate.execBandwidthCost + extreme.execBandwidthCost
  );

  // The outcome: the directive's ledger as numbers (a non-numeric row degrades to nulls) and its GDP effect
  await db.countryChangeLog.create({
    data: {
      countryId: "testland",
      sourceType: "decision",
      sourceId: jobs.id,
      description: "Note",
      targetField: "publicApproval",
      previousValue: '"n/a"',
      newValue: null,
      deltaValue: 1,
      appliedIxTime: NOW + 1,
    },
  });
  const outcome = await intents(asOwner(db as never, lena)).getOutcome({ intentId: jobs.id });
  expect(outcome.ledger).toHaveLength(2);
  expect(outcome.ledger[0]).toMatchObject({
    targetField: "unemploymentRate",
    previousValue: 6.5,
    newValue: 5.9,
  });
  expect(outcome.ledger.at(-1)).toMatchObject({
    previousValue: null,
    newValue: null,
    deltaValue: 1,
  });
  expect(outcome.gdpEffects).toEqual([
    { id: expect.any(String), value: 0.000583, duration: 1, isActive: true },
  ]);
  await expect(owner.getOutcome({ intentId: "missing" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });

  // More resistance arrives (from the cron): one already auto-resolved, one seen, one new
  const linked = [resistance[0]!.id];
  for (const status of ["auto_resolved", "viewed", "pending"]) {
    const id = (await NationalIssuesEngine.forceGenerate(
      "factory-walkout",
      "testland",
      db as never
    ))!;
    await db.nationalIssue.update({ where: { id }, data: { intentId: jobs.id, status } });
    linked.push(id);
  }
  const [first, , seen, fresh] = linked;
  const progress = async () =>
    (await db.intent.findUniqueOrThrow({ where: { id: jobs.id } })).progress;

  // Open resistance blocks completion; the progress follows the answered share (responded, auto-resolved, dismissed)
  await expect(owner.updateStatus({ id: jobs.id, status: "completed" })).rejects.toMatchObject({
    code: "PRECONDITION_FAILED",
  });
  const player = issues(asOwner(db as never, lena));
  await player.respond({ issueId: first!, optionId: "concede" });
  expect(await progress()).toBe(50);
  await player.dismiss({ id: seen! });
  expect(await progress()).toBe(75);
  await player.respond({ issueId: fresh!, optionId: "concede" });
  expect(await progress()).toBe(100);
  expect(await owner.updateStatus({ id: jobs.id, status: "completed" })).toMatchObject({
    status: "completed",
  });

  // A directive with no linked issue is reset to 0
  await db.intent.update({ where: { id: crime.id }, data: { progress: 40 } });
  expect(await NationalIssuesConsequences.recomputeIntentProgress(crime.id, db as never)).toBe(0);
  expect((await db.intent.findUniqueOrThrow({ where: { id: crime.id } })).progress).toBe(0);

  // Past the execution window the directives hold no bandwidth
  IxTime.setTimeOverride(NOW + DIRECTIVE_EXEC_BANDWIDTH_WINDOW_MS + 1);
  expect((await loadExecBandwidthState(db as never, "testland")).breakdown.directives).toBe(0);
});
