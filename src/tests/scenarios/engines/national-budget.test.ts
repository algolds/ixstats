/** @jest-environment node */
/**
 * The National budget tab (owner decision 1). Bareland has no government departments, so its budget and cabinet first
 * steps cannot be done; its owner creates the form's government from the budget tab (once), which leaves the budget
 * step open until they set a department's share. The share sets the amount; a department can be added, funded and
 * removed; a rival can edit neither Bareland's budget nor its departments through their own nation.
 *
 * A directive's budget line moves the amount with the share. Stat progression moves the yearly budget and the
 * allocations in effect with GDP (past years and the owner's review stamp stay put), and the next budget year starts
 * from the moved budget.
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

import { IxTime } from "~/lib/ixtime";
import { departmentsForForm } from "~/lib/government/form-departments";
import { DEFAULT_BUDGET_SHARE_OF_GDP } from "~/lib/government/budget-math";
import { createCallerFactory } from "~/server/api/trpc";
import { governmentRouter } from "~/server/api/routers/government";
import { intentRouter } from "~/server/api/routers/intent";
import { myCountryFirstStepsRouter } from "~/server/api/routers/mycountry/first-steps";
import { runStatProgression } from "~/server/cron/stat-progression";
import { inferFormId } from "~/server/shared/founding-snapshot";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addIxnay,
  addNation,
  addOwner,
  asOwner,
  type Owner,
  ixnayRunningAt,
} from "~/tests/helpers/nation-world";

const government = createCallerFactory(governmentRouter);
const intents = createCallerFactory(intentRouter);
const firstSteps = createCallerFactory(myCountryFirstStepsRouter);

const YEAR = 365.25 * 86_400_000;
const NOW = Date.UTC(2043, 0, 15);

let db: MemoryPrisma;

function setClock(ixTime: number) {
  // Pause first: a pause after the override would anchor wherever the clock ran to in between
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(ixTime);
}

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  setClock(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

const allocations = (countryId: string, budgetYear: number) =>
  db.budgetAllocation.findMany({
    where: { governmentStructure: { countryId }, budgetYear },
    include: { department: { select: { name: true, category: true } } },
  });
const structureOf = (countryId: string) =>
  db.governmentStructure.findUniqueOrThrow({ where: { countryId } });

async function steps(owner: Owner) {
  const result = await firstSteps(asOwner(db as never, owner)).getFirstSteps();
  return Object.fromEntries(result!.items.map((item) => [item.id, item.done]));
}

it("creates a government from the budget tab once, and an owner edit sets shares, amounts and the first step", async () => {
  await addNation(db as never, { id: "bareland", baselineDate: new Date(NOW - YEAR) });
  await db.governmentStructure.delete({ where: { countryId: "bareland" } });
  // Founded a minute ago (wall clock), so an edit now is past the founding grace window
  await db.country.update({
    where: { id: "bareland" },
    data: { createdAt: new Date(Date.now() - 60_000) },
  });
  const lena = await addOwner(db as never, "lena", "bareland");
  const owner = government(asOwner(db as never, lena));
  expect(await steps(lena)).toMatchObject({ budget: false, cabinet: false });

  // The form's departments, each with its share of a yearly budget set from GDP
  const form = departmentsForForm(inferFormId([]));
  expect(await owner.createStructure({ countryId: "bareland" })).toMatchObject({
    departments: form.length,
  });
  const totalBudget = 3e11 * DEFAULT_BUDGET_SHARE_OF_GDP;
  expect((await structureOf("bareland")).totalBudget).toBe(totalBudget);
  const created = await allocations("bareland", 2043);
  expect(created).toHaveLength(form.length);
  for (const a of created) {
    expect(a.allocatedAmount).toBeCloseTo((totalBudget * a.allocatedPercent) / 100, 3);
  }
  // A generated budget is not the owner's review, and a second create is refused
  expect(await steps(lena)).toMatchObject({ budget: false });
  await expect(owner.createStructure({ countryId: "bareland" })).rejects.toMatchObject({
    code: "CONFLICT",
  });

  // Setting a share sets its amount, and ticks the budget step
  const first = created[0]!;
  await owner.setAllocation({
    countryId: "bareland",
    departmentId: first.departmentId,
    allocatedPercent: 15,
  });
  expect(await db.budgetAllocation.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
    allocatedPercent: 15,
    allocatedAmount: totalBudget * 0.15,
  });
  expect(await steps(lena)).toMatchObject({ budget: true, cabinet: false });

  // A new department is funded in the budget in effect, and removed with its allocation
  const fisheries = await owner.addDepartment({
    countryId: "bareland",
    name: "Ministry of Fisheries",
    category: "Agriculture",
  });
  await owner.setAllocation({
    countryId: "bareland",
    departmentId: fisheries.id,
    allocatedPercent: 2,
  });
  expect(
    await db.budgetAllocation.findFirstOrThrow({ where: { departmentId: fisheries.id } })
  ).toMatchObject({ budgetYear: 2043, allocatedPercent: 2, allocatedAmount: totalBudget * 0.02 });
  await owner.removeDepartment({ countryId: "bareland", departmentId: fisheries.id });
  expect(await db.governmentDepartment.count({ where: { id: fisheries.id } })).toBe(0);
  expect(await db.budgetAllocation.count({ where: { departmentId: fisheries.id } })).toBe(0);

  // A rival can edit neither Bareland's budget nor its departments through their own nation
  await addNation(db as never, { id: "rivalland", baselineDate: new Date(NOW - YEAR) });
  const omar = government(asOwner(db as never, await addOwner(db as never, "omar", "rivalland")));
  await expect(
    omar.setAllocation({
      countryId: "bareland",
      departmentId: first.departmentId,
      allocatedPercent: 0,
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    omar.setAllocation({
      countryId: "rivalland",
      departmentId: first.departmentId,
      allocatedPercent: 0,
    })
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    omar.removeDepartment({ countryId: "rivalland", departmentId: first.departmentId })
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(await db.budgetAllocation.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
    allocatedPercent: 15,
  });
});

it("moves a directive's allocation amount with its share", async () => {
  await addNation(db as never, {
    id: "testland",
    baselineDate: new Date(NOW - YEAR),
    budgetYear: 2043,
    totalBudget: 1e10,
  });
  const lena = await addOwner(db as never, "lena", "testland");
  await intents(asOwner(db as never, lena)).commit({
    countryId: "testland",
    goal: "Boost military defense readiness",
    tier: "measured",
  });
  const defense = (await allocations("testland", 2043)).find(
    (a) => a.department.category === "Defense"
  )!;
  expect(defense.allocatedPercent).toBeCloseTo(26.5, 9);
  expect(defense.allocatedAmount).toBeCloseTo(1e10 * 0.265, 3);
  // The other departments give the 1.5 points up in proportion: the budget stays at 100%
  const after = await allocations("testland", 2043);
  expect(after.reduce((sum, a) => sum + a.allocatedPercent, 0)).toBeCloseTo(100, 9);
  const education = after.find((a) => a.department.category === "Education")!;
  expect(education.allocatedPercent).toBeCloseTo(30 * (73.5 / 75), 9);
  for (const a of after) {
    expect(a.allocatedAmount).toBeCloseTo((1e10 * a.allocatedPercent) / 100, 3);
  }
});

it("starts a new government's budget at the nation's revenue", async () => {
  await addNation(db as never, { id: "bareland", baselineDate: new Date(NOW - YEAR) });
  await db.governmentStructure.delete({ where: { countryId: "bareland" } });
  const lena = await addOwner(db as never, "lena", "bareland");
  await government(asOwner(db as never, lena)).createStructure({
    countryId: "bareland",
    revenue: 6e9,
  });
  expect((await structureOf("bareland")).totalBudget).toBe(6e9);
  const created = await allocations("bareland", 2043);
  expect(created.reduce((sum, a) => sum + a.allocatedAmount, 0)).toBeCloseTo(6e9, 0);
});

it("moves the yearly budget and the budget in effect with GDP, and starts the next year from it", async () => {
  await addNation(db as never, {
    id: "testland",
    baselineDate: new Date(NOW - YEAR),
    budgetYear: 2043,
    totalBudget: 1e10,
  });
  const lena = await addOwner(db as never, "lena", "testland");
  const { id: structureId } = await structureOf("testland");
  const past = await db.budgetAllocation.create({
    data: {
      governmentStructureId: structureId,
      departmentId: "testland-health",
      budgetYear: 2042,
      allocatedPercent: 25,
      allocatedAmount: 2.5e9,
    },
  });
  const reviewed = (await allocations("testland", 2043)).map((a) => a.lastReviewed.getTime());

  await runStatProgression({ db: db as never, clocks: ixnayRunningAt(NOW + YEAR / 2) });
  const gdp = (await db.country.findUniqueOrThrow({ where: { id: "testland" } })).currentTotalGdp;
  const ratio = gdp / 3e11;
  expect(ratio).not.toBeCloseTo(1, 3);
  const budget = (await structureOf("testland")).totalBudget;
  expect(budget).toBeCloseTo(1e10 * ratio, 0);
  const inEffect = await allocations("testland", 2043);
  for (const a of inEffect) {
    expect(a.allocatedAmount).toBeCloseTo((budget * a.allocatedPercent) / 100, 0);
  }
  expect(inEffect.map((a) => a.lastReviewed.getTime())).toEqual(reviewed);
  expect(await db.budgetAllocation.findUniqueOrThrow({ where: { id: past.id } })).toMatchObject({
    allocatedAmount: 2.5e9,
  });

  // The next budget year: each share is worth its part of the moved budget
  setClock(Date.UTC(2044, 1, 1));
  await government(asOwner(db as never, lena)).startBudgetYear({ countryId: "testland" });
  for (const a of await allocations("testland", 2044)) {
    expect(a.allocatedAmount).toBeCloseTo((budget * a.allocatedPercent) / 100, 0);
  }
});
