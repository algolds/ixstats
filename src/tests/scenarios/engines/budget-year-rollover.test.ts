/** @jest-environment node */
/**
 * The budget year is the IxTime game year. In FY2042 Testland's power brokers read the 2042 budget, and the
 * policy-maintenance job, run twice, expires a lapsed policy and charges each active one once, as spending within the
 * year: the yearly budget itself is never debited. The IxTime year turns
 * over: the 2042 budget stays in effect, the rollover cron reminds each owned nation behind on its budget once (one
 * failed reminder does not stop the others), and a nation with no budget gets nothing. The owner starts FY2043, which
 * copies the shares of the budget in effect, each worth its share of today's budget, without overwriting the line
 * already set, and the brokers follow it. In 2043 the job charges once more, and a policy enacted later in the year is
 * charged alone; a policy that costs more than the year's budget has left is charged only what is left.
 *
 * Folds budget-rollover (carry-forward, the no-overwrite roll, once-per-year reminders, nothing without a budget),
 * budget-year (the IxTime game year, MC-1), elections-brokers-budget-year (brokers read the budget in effect across
 * the rollover), policy-maintenance-cron (once per budget year, PL-8; lapsed policies first, MC-5; no budget, no
 * marker) and government-start-budget-year's owner copy.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));

import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notifications";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { loadEffectiveBudget, rollBudgetForward } from "~/lib/government/budget-allocations";
import { runBudgetYearRollover } from "~/lib/government/budget-year-rollover-cron";
import { runPolicyMaintenanceDebits } from "~/lib/policies/maintenance-cron";
import { maintenanceByYear } from "~/lib/government/budget-math";
import { deriveBrokers } from "~/lib/statecraft/power-brokers";
import { createCallerFactory } from "~/server/api/trpc";
import { electionsBrokersRouter } from "~/server/api/routers/elections/brokers";
import { governmentCrudRouter } from "~/server/api/routers/government/crud";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, asOwner, type Owner } from "~/tests/helpers/nation-world";

const brokers = createCallerFactory(electionsBrokersRouter);
const government = createCallerFactory(governmentCrudRouter);
const notify = jest.mocked(notificationAPI.create);

const FY2042 = Date.UTC(2042, 5, 15);
const FY2043 = Date.UTC(2043, 1, 1);
const BUDGET = 1e10;
const SPEND_2042 = { Finance: 20, Defense: 25, Education: 30, Health: 25 };

let db: MemoryPrisma;
let lena: Owner;

/** The clock stands still at `ixTime` (a pause, then an override, reads back exactly). */
function setClock(ixTime: number) {
  // Pause first: a pause after the override would anchor wherever the clock ran to in between
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(ixTime);
}

async function addPolicy(
  id: string,
  countryId: string,
  maintenanceCost: number,
  expiryDate?: Date
) {
  await db.policy.create({
    data: {
      id,
      countryId,
      userId: "lena",
      name: `Policy ${id}`,
      description: "Upkeep",
      policyType: "economic",
      category: "fiscal",
      status: "active",
      maintenanceCost,
      expiryDate: expiryDate ?? null,
    },
  });
}

const totalBudget = async (countryId: string) =>
  (await db.governmentStructure.findUniqueOrThrow({ where: { countryId } })).totalBudget;
/** Maintenance spent per budget year, from the charge markers. */
const maintenanceSpent = async () =>
  maintenanceByYear(
    await db.policyEffectLog.findMany({
      where: { effectType: "MAINTENANCE_DEBIT", policy: { countryId: "testland" } },
      select: { notes: true, actualEffect: true },
    })
  );
const debitMarkers = (notes: string) =>
  db.policyEffectLog.findMany({
    where: { effectType: "MAINTENANCE_DEBIT", notes },
    select: { policyId: true },
    orderBy: { policyId: "asc" },
  });

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  setClock(FY2042);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  const baselineDate = new Date(FY2042 - 365 * 86_400_000);
  await addNation(db as never, {
    id: "testland",
    baselineDate,
    budgetYear: 2042,
    totalBudget: BUDGET,
  });
  await addNation(db as never, {
    id: "twinland",
    baselineDate,
    budgetYear: 2042,
    totalBudget: BUDGET,
  });
  await addNation(db as never, {
    id: "npcland",
    baselineDate,
    budgetYear: 2041,
    totalBudget: BUDGET,
  });
  await db.country.create({
    data: {
      id: "newland",
      name: "Newland",
      baselinePopulation: 1,
      baselineGdpPerCapita: 1,
      maxGdpGrowthRate: 0,
      adjustedGdpGrowth: 0,
      populationGrowthRate: 0,
      currentPopulation: 1,
      currentGdpPerCapita: 1,
      currentTotalGdp: 1,
      economicTier: "Developing",
      populationTier: "1",
    },
  });
  lena = await addOwner(db as never, "lena", "testland");
  await addOwner(db as never, "omar", "twinland");
  // The cron's reminder, as the notification API stores it (the first reminder for Twinland fails)
  let twinlandFails = true;
  notify.mockReset().mockImplementation(async (input) => {
    if (input.countryId === "twinland" && twinlandFails) {
      twinlandFails = false;
      throw new Error("Notification suppressed");
    }
    const row = await db.notification.create({
      data: {
        title: input.title,
        message: input.message,
        countryId: input.countryId,
        source: input.source,
        metadata: JSON.stringify(input.metadata),
      },
    });
    return row.id;
  });
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

it("carries the budget across the IxTime year, reminds once, rolls it forward and debits upkeep once a year", async () => {
  const owner = asOwner(db as never, lena);
  const powerBrokers = () => brokers(owner).getPowerBrokers({ countryId: "testland" });

  // FY2042 is the IxTime game year, not the calendar year; the brokers read its budget
  expect(currentBudgetYear()).toBe(2042);
  expect(currentBudgetYear()).toBe(IxTime.getCurrentGameYear());
  expect(currentBudgetYear()).not.toBe(new Date().getUTCFullYear());
  expect(await powerBrokers()).toEqual(deriveBrokers([], SPEND_2042));

  // Upkeep: the lapsed policy expires first, the others are debited once however often the job runs
  await addPolicy("p1", "testland", 1000);
  await addPolicy("p2", "testland", 500);
  await addPolicy("lapsed", "testland", 300, new Date(Date.now() - 60_000));
  await addPolicy("orphan", "newland", 700);
  const first = await runPolicyMaintenanceDebits(db as never);
  expect(first).toMatchObject({ policiesExpired: 1, totalCostDebited: 1500 });
  expect((await db.policy.findUniqueOrThrow({ where: { id: "lapsed" } })).status).toBe("expired");
  expect(await runPolicyMaintenanceDebits(db as never)).toMatchObject({ totalCostDebited: 0 });
  // Spending within the year: the yearly budget is not debited
  expect(await totalBudget("testland")).toBe(BUDGET);
  expect(await maintenanceSpent()).toEqual({ 2042: 1500 });
  expect(await debitMarkers("FY2042")).toEqual([{ policyId: "p1" }, { policyId: "p2" }]);

  // The IxTime year turns over: 2042's budget stays in effect for the brokers and every reader
  setClock(FY2043);
  expect(currentBudgetYear()).toBe(2043);
  expect(await powerBrokers()).toEqual(deriveBrokers([], SPEND_2042));
  expect(await loadEffectiveBudget(db as never, "testland")).toMatchObject({
    budgetYear: 2042,
    currentYear: 2043,
    carriedForward: true,
    allocations: expect.arrayContaining([expect.objectContaining({ budgetYear: 2042 })]),
  });
  expect(await loadEffectiveBudget(db as never, "newland")).toMatchObject({
    budgetYear: null,
    carriedForward: false,
    allocations: [],
  });

  // The cron reminds each owned nation behind once; a failed reminder does not stop the others; NPCs get none
  const reminded = await runBudgetYearRollover(db as never);
  expect(reminded).toMatchObject({ budgetYear: 2043, countriesBehind: 2, notified: 1, failed: 1 });
  const again = await runBudgetYearRollover(db as never);
  expect(again).toMatchObject({ countriesBehind: 2, notified: 1, alreadyNotified: 1, failed: 0 });
  expect(await runBudgetYearRollover(db as never)).toMatchObject({
    notified: 0,
    alreadyNotified: 2,
  });
  const reminders = await db.notification.findMany({
    where: { source: "budgetYear" },
    select: { countryId: true, metadata: true },
    orderBy: { countryId: "asc" },
  });
  expect(reminders).toEqual([
    {
      countryId: "testland",
      metadata: JSON.stringify({ budgetYear: 2043, carriedForwardFrom: 2042 }),
    },
    {
      countryId: "twinland",
      metadata: JSON.stringify({ budgetYear: 2043, carriedForwardFrom: 2042 }),
    },
  ]);

  // The owner already set FY2043 Defense; starting the year copies the rest and leaves that line alone
  const structureId = (
    await db.governmentStructure.findUniqueOrThrow({ where: { countryId: "testland" } })
  ).id;
  await db.budgetAllocation.create({
    data: {
      governmentStructureId: structureId,
      departmentId: "testland-defense",
      budgetYear: 2043,
      allocatedPercent: 40,
      allocatedAmount: 4e9,
    },
  });
  expect(await government(owner).startBudgetYear({ countryId: "testland" })).toEqual({
    fromYear: 2042,
    toYear: 2043,
    created: 3,
  });
  expect(await rollBudgetForward(db as never, "newland", 2043)).toEqual({
    fromYear: null,
    toYear: 2043,
    created: 0,
  });
  expect(await powerBrokers()).toEqual(deriveBrokers([], { ...SPEND_2042, Defense: 40 }));
  expect(await runBudgetYearRollover(db as never)).toMatchObject({ countriesBehind: 1 });

  // FY2043's upkeep is debited once more; a policy enacted later in the year is debited alone
  expect(await runPolicyMaintenanceDebits(db as never)).toMatchObject({ totalCostDebited: 1500 });
  await addPolicy("p3", "testland", 200);
  expect(await runPolicyMaintenanceDebits(db as never)).toMatchObject({
    policiesProcessed: 1,
    totalCostDebited: 200,
  });
  expect(await runPolicyMaintenanceDebits(db as never)).toMatchObject({ totalCostDebited: 0 });
  expect(await totalBudget("testland")).toBe(BUDGET);
  expect(await maintenanceSpent()).toEqual({ 2042: 1500, 2043: 1700 });
  expect(await debitMarkers("FY2043")).toEqual([
    { policyId: "p1" },
    { policyId: "p2" },
    { policyId: "p3" },
  ]);
  // A policy costing more than the year's budget has left is charged only what is left: never below zero
  await addPolicy("p4", "testland", 2 * BUDGET);
  expect(await runPolicyMaintenanceDebits(db as never)).toMatchObject({
    totalCostDebited: BUDGET - 1700,
  });
  expect(await maintenanceSpent()).toEqual({ 2042: 1500, 2043: BUDGET });
  expect(await totalBudget("testland")).toBe(BUDGET);
  // A nation with no government has no budget to debit, and keeps no marker
  expect(await db.policyEffectLog.count({ where: { policyId: "orphan" } })).toBe(0);
});
