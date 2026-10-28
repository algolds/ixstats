/** @jest-environment node */
/**
 * Owner ruling 2026-10-28 (stress finding C-33): abandoning a directive stops its GDP level shift at the share phased
 * in by then; the remainder never lands. Abandoned the day it was committed (effects take hold the next IxTime day),
 * it leaves nothing applied; abandoned half way through its one-year phase-in, it keeps half; a fully phased one
 * keeps all of it.
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
import { levelPhaseIn } from "~/lib/economy/calculations";
import { createCallerFactory } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, asOwner } from "~/tests/helpers/nation-world";

const DAY = 86_400_000;
const YEAR = 365.25 * DAY;
const NOW = Date.UTC(2043, 0, 15, 9);
const JOBS = "Create industrial manufacturing jobs";
let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, {
    id: "testland",
    baselineDate: new Date(NOW - 365 * DAY),
    budgetYear: 2043,
  });
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

/** The GDP level factor the directive's rows apply at `t`, as the projection multiplies them. */
async function levelAt(intentId: string, t: number) {
  const rows = await db.storytellerEffect.findMany({ where: { createdBy: `intent:${intentId}` } });
  return rows.reduce((f, r) => f * (1 + r.value * levelPhaseIn(r, t)), 1) - 1;
}

async function commitThenAbandonAfter(days: number) {
  const owner = intentRouterFor();
  const { intent } = await owner.commit({ countryId: "testland", goal: JOBS, tier: "extreme" });
  const full = await levelAt(intent.id, NOW + 2 * YEAR);
  expect(full).toBeGreaterThan(0);
  IxTime.setTimeOverride(NOW + days * DAY);
  await owner.updateStatus({ id: intent.id, status: "abandoned" });
  return { id: intent.id, full };
}
let lena: Awaited<ReturnType<typeof addOwner>>;
const intentRouterFor = () => createCallerFactory(intentRouter)(asOwner(db as never, lena));
beforeEach(async () => {
  lena = await addOwner(db as never, "lena", "testland");
});

it("leaves nothing applied when abandoned the day it was committed", async () => {
  const { id } = await commitThenAbandonAfter(0);
  for (const t of [NOW + DAY, NOW + 0.5 * YEAR, NOW + 3 * YEAR]) {
    expect(Math.abs(await levelAt(id, t))).toBeLessThan(1e-6);
  }
});

it("keeps the share phased in by the abandon and never lands the rest", async () => {
  const { id, full } = await commitThenAbandonAfter(182);
  const kept = await levelAt(id, NOW + 183 * DAY);
  expect(kept / full).toBeGreaterThan(0.48);
  expect(kept / full).toBeLessThan(0.52);
  expect(await levelAt(id, NOW + 270 * DAY)).toBeCloseTo(kept, 6);
  expect(await levelAt(id, NOW + 3 * YEAR)).toBeCloseTo(kept, 6);
});

it("keeps all of a directive that had fully phased in", async () => {
  const { id, full } = await commitThenAbandonAfter(400);
  expect(await levelAt(id, NOW + 3 * YEAR)).toBeCloseTo(full, 9);
  expect(
    await db.storytellerEffect.count({ where: { description: { startsWith: "Abandoned" } } })
  ).toBe(0);
});
