/** @jest-environment node */
/**
 * Stress finding C-10: "Government Staffing Shortage" was raised for every nation with a single government component
 * (its stored template trigger is "consumedStaff > 0", so the evaluator picked it up like any template: Kandara got it
 * 32 times in three years while under capacity), and once answered the auto-trigger raised it again on the next
 * evaluation. It is now raised only by the overstaffing check, once per 30 IxTime days.
 */
import { buildTemplateWhere } from "~/lib/national-issues/evaluators/candidate-selection";
import {
  maybeTriggerStaffingShortage,
  STAFFING_SHORTAGE_SLUG,
} from "~/lib/national-issues/evaluators/issue-generator";
import type { CountrySnapshot, EvaluationResult } from "~/lib/national-issues/types";
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
const overstaffedAt = (currentIxTime: number) =>
  ({
    name: "Testland",
    consumedStaff: 2000,
    civilServiceCapacity: 900,
    currentIxTime,
    activeComponents: [],
    implementingComponents: [],
  }) as unknown as CountrySnapshot;

let db: MemoryPrisma;
beforeEach(async () => {
  db = createMemoryPrisma();
  await addIxnay(db as never);
  await addNation(db as never, { id: "testland", baselineDate: new Date(T0 - 365 * DAY) });
});

it("keeps the staffing template out of the template evaluator", () => {
  expect(buildTemplateWhere().NOT).toEqual(
    expect.arrayContaining([{ slug: STAFFING_SHORTAGE_SLUG }])
  );
});

it("raises the shortage once per 30 IxTime days, however often the nation is evaluated", async () => {
  const raise = async (t: number) => {
    const r = result();
    await maybeTriggerStaffingShortage("testland", db as never, overstaffedAt(t), r);
    expect(r.errors).toEqual([]);
  };
  await raise(T0);
  expect(await db.nationalIssue.count()).toBe(1);
  await db.nationalIssue.updateMany({ data: { status: "responded" } });

  await raise(T0 + 2 * DAY);
  await raise(T0 + 29 * DAY);
  expect(await db.nationalIssue.count()).toBe(1);

  await raise(T0 + 31 * DAY);
  expect(await db.nationalIssue.count()).toBe(2);
});
