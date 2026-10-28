/** @jest-environment node */
/**
 * C-10: "Government Staffing Shortage" is raised only by the over-capacity check (never by the template evaluator),
 * once per 30 IxTime days. C-32 (owner ruling 2026-10-28): it is raised when executive bandwidth is over capacity,
 * and each answer fixes that cause: expanding the civil service hires the shortfall, scaling back pauses the newest
 * programs until their staff covers it. Once fixed the issue stops; it returns only if the nation goes over again.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));

import { IxTime } from "~/lib/ixtime";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import { loadExecBandwidthState } from "~/lib/government/exec-bandwidth";
import { NationalIssuesConsequences, NationalIssuesEngine } from "~/lib/national-issues";
import { buildTemplateWhere } from "~/lib/national-issues/evaluators/candidate-selection";
import {
  maybeTriggerStaffingShortage,
  STAFFING_SHORTAGE_SLUG,
} from "~/lib/national-issues/evaluators/issue-generator";
import type { EvaluationResult } from "~/lib/national-issues/types";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation } from "~/tests/helpers/nation-world";

const DAY = 86_400_000;
const T0 = Date.UTC(2043, 0, 15);
const result = (): EvaluationResult => ({
  issuesGenerated: 0,
  issuesSkippedCooldown: 0,
  issuesSkippedMaxActive: 0,
  templatesEvaluated: 0,
  templatesPassed: 0,
  executionTimeMs: 0,
  errors: [],
});
/** The biggest staff users first, so a few components put a 10M nation (capacity 160) over. */
const HEAVY = Object.entries(ATOMIC_COMPONENTS)
  .map(([type, c]) => ({ type, staff: c.metadata.staffRequired ?? 0 }))
  .sort((a, b) => b.staff - a.staff);

let db: MemoryPrisma;
beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(T0);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, { id: "testland", baselineDate: new Date(T0 - 365 * DAY) });
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

async function addComponents(from: number, count: number) {
  for (let i = from; i < from + count; i++) {
    await db.governmentComponent.create({
      data: {
        id: `gc${i}`,
        countryId: "testland",
        componentType: HEAVY[i]!.type as never,
        isActive: true,
        implementationDate: new Date(T0 - (100 - i) * DAY),
      },
    });
  }
}
const bandwidth = () => loadExecBandwidthState(db as never, "testland", { now: T0 });
const snapshotAt = async (t: number) =>
  (await NationalIssuesEngine.buildCountrySnapshot("testland", db as never, t))!;
async function raise(t: number) {
  const r = result();
  await maybeTriggerStaffingShortage("testland", db as never, await snapshotAt(t), r);
  expect(r.errors).toEqual([]);
  return db.nationalIssue.findFirst({
    where: { status: "pending" },
    orderBy: { createdIxTime: "desc" },
  });
}

it("keeps the staffing template out of the template evaluator", () => {
  expect(buildTemplateWhere().NOT).toEqual(
    expect.arrayContaining([{ slug: STAFFING_SHORTAGE_SLUG }])
  );
});

it("is not raised while executive bandwidth is under capacity", async () => {
  await addComponents(0, 1);
  expect((await bandwidth()).overCapacity).toBe(false);
  expect(await raise(T0)).toBeNull();
});

it("expanding the civil service hires the shortfall, so it stops, and returns only when over again", async () => {
  await addComponents(0, 8);
  expect((await bandwidth()).overCapacity).toBe(true);
  const issue = (await raise(T0))!;
  expect(issue).not.toBeNull();
  await NationalIssuesConsequences.resolveIssue(issue.id, "expand_civil_service", db as never);
  expect((await bandwidth()).overCapacity).toBe(false);
  expect(await raise(T0 + 31 * DAY)).toBeNull();

  await addComponents(8, 8);
  expect(await raise(T0 + 62 * DAY)).not.toBeNull();
});

it("scaling back pauses the newest programs until the shortfall is covered", async () => {
  await addComponents(0, 8);
  const issue = (await raise(T0))!;
  await NationalIssuesConsequences.resolveIssue(issue.id, "scale_back_programs", db as never);
  const state = await bandwidth();
  expect(state.overCapacity).toBe(false);
  const paused = await db.governmentComponent.findMany({ where: { isActive: false } });
  expect(paused.length).toBeGreaterThan(0);
  // The newest went first: the oldest component is still running
  expect((await db.governmentComponent.findUnique({ where: { id: "gc0" } }))?.isActive).toBe(true);
  expect(await raise(T0 + 31 * DAY)).toBeNull();
});
