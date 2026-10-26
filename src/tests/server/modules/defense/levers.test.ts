/** @jest-environment node */
/**
 * Realm time D2a: the defense levers on the module. Procurement (domestic within capacity and the R&D frontier,
 * imports at +15% and 1.5× lead time, domain fit, cancel), mobilisation that keeps those already reported, alert
 * raises that bite later, presets, scrapping that removes capital, operations' readiness writes, and new branches
 * that start empty.
 */
const clock = { now: 0, multiplier: 2 };
jest.mock("~/server/shared/realm-time", () => ({
  clockForCountry: jest.fn(async () => ({
    now: () => clock.now,
    multiplier: clock.multiplier,
    paused: clock.multiplier === 0,
  })),
}));
jest.mock("~/lib/government/budget-allocations", () => ({
  loadEffectiveBudget: jest.fn(async () => ({ allocations: [] })),
}));

import {
  DAY_MS,
  DEPLOY_CONDITION_COST,
  MONTH_MS,
  SHARE_PRESETS,
  TRAINING_EXERCISE_GAIN,
  mobilisedCount,
} from "~/lib/military/model";
import {
  applyOperationReadiness,
  cancelProcurementOrder,
  createEmptyBranch,
  defenseOverview,
  demobiliseReserves,
  mobiliseReserves,
  orderProcurement,
  publicDefenseOverview,
  scrapAsset,
  seedStarterBranches,
  setAlertLevel,
  setBranchAllocation,
  setDefenseShares,
  syncDefense,
} from "~/server/modules/defense";
import { resetRealmMedianCache } from "~/server/modules/defense/defense.economy";
import { fakeDefenseDb, type FakeDefenseDb } from "./fake-db";

const T0 = 1.95e12;
let db: FakeDefenseDb;
const D = () => db as never;

const catalogItem = (overrides: Record<string, unknown>) =>
  db.militaryEquipmentCatalog.create({
    data: {
      key: "F35",
      name: "F-35",
      category: "aircraft",
      subcategory: "fighter_gen5",
      era: "ADVANCED",
      acquisitionCost: 80e6,
      maintenanceCost: 4e6,
      capabilities: '{"role":"multirole"}',
      crewRequirement: 1,
      isActive: true,
      ...overrides,
    },
  });

const branchOf = (domain: string) => db.militaryBranch.rows.find((b) => b.domain === domain)!;

beforeEach(async () => {
  clock.now = T0;
  clock.multiplier = 2;
  resetRealmMedianCache();
  db = fakeDefenseDb([{ id: "c1", currentPopulation: 27e6, currentGdpPerCapita: 21_000 }]);
  await syncDefense(D(), "c1");
});

describe("procurement", () => {
  it("orders domestically at the catalog price with the domestic lead time", async () => {
    await catalogItem({ key: "TANK", category: "vehicle", subcategory: "tank", era: "CONTEMPORARY", acquisitionCost: 5e6 });
    const order = await orderProcurement(D(), {
      countryId: "c1",
      branchId: branchOf("land").id as string,
      catalogKey: "TANK",
      quantity: 10,
      source: "domestic",
    });
    expect(order).toMatchObject({ unitCost: 5e6, leadMonths: 24, source: "domestic", designYear: 2016 });
    expect(order.expectedClockMs).toBe(T0 + 24 * MONTH_MS);
  });

  it("imports at +15% and 1.5× the lead time", async () => {
    await catalogItem({});
    const order = await orderProcurement(D(), {
      countryId: "c1",
      branchId: branchOf("air").id as string,
      catalogKey: "F35",
      quantity: 4,
      source: "import",
    });
    expect(order.unitCost).toBeCloseTo(80e6 * 1.15);
    expect(order.leadMonths).toBe(63);
  });

  it("refuses a domestic order beyond industrial capacity, pointing at import or surge", async () => {
    await catalogItem({ key: "CV", category: "naval", subcategory: "carrier", era: "CONTEMPORARY", acquisitionCost: 13e9 });
    await expect(
      orderProcurement(D(), {
        countryId: "c1",
        branchId: branchOf("sea").id as string,
        catalogKey: "CV",
        quantity: 3,
        source: "domestic",
      })
    ).rejects.toThrow(/Import it, order fewer, or surge production/);
  });

  it("refuses domestic designs newer than the industry's R&D frontier", async () => {
    await catalogItem({ key: "NG", era: "NEXT_GEN", subcategory: "fighter_gen5", acquisitionCost: 1e6 });
    await expect(
      orderProcurement(D(), {
        countryId: "c1",
        branchId: branchOf("air").id as string,
        catalogKey: "NG",
        quantity: 1,
        source: "domestic",
      })
    ).rejects.toThrow(/beyond your industry's technology/);
  });

  it("shows the owner the industry's capacity, what open orders draw, and the newest design it can build", async () => {
    await catalogItem({ key: "TANK", category: "vehicle", subcategory: "tank", era: "CONTEMPORARY", acquisitionCost: 5e6 });
    const before = defenseOverview(await syncDefense(D(), "c1"));
    await orderProcurement(D(), {
      countryId: "c1",
      branchId: branchOf("land").id as string,
      catalogKey: "TANK",
      quantity: 10,
      source: "domestic",
    });
    const after = defenseOverview(await syncDefense(D(), "c1"));
    expect(before.procurement.capacityMonthly).toBeGreaterThan(0);
    expect(after.procurement.capacityUsedMonthly - before.procurement.capacityUsedMonthly).toBeCloseTo(
      (10 * 5e6) / 24
    );
    expect(after.procurement.accessibleYear).toBeCloseTo(
      after.procurement.frontierYear - after.frontierLagYears
    );
    expect(after.economy).toMatchObject({ population: 27e6, gdpPerCapita: 21_000 });
  });

  it("refuses equipment the branch's domain cannot hold", async () => {
    await catalogItem({ key: "CV", category: "naval", subcategory: "carrier", acquisitionCost: 1e6 });
    await expect(
      orderProcurement(D(), {
        countryId: "c1",
        branchId: branchOf("land").id as string,
        catalogKey: "CV",
        quantity: 1,
        source: "import",
      })
    ).rejects.toThrow(/cannot serve in a land branch/);
  });

  it("cancels only an open order of the nation", async () => {
    await catalogItem({});
    const order = await orderProcurement(D(), {
      countryId: "c1",
      branchId: branchOf("air").id as string,
      catalogKey: "F35",
      quantity: 1,
      source: "import",
    });
    await cancelProcurementOrder(D(), { countryId: "c1", orderId: order.id });
    await expect(cancelProcurementOrder(D(), { countryId: "c1", orderId: order.id })).rejects.toThrow(
      /Only an open order/
    );
  });
});

describe("another nation's view", () => {
  it("shows each branch's strength as a band, never its exact headcount", async () => {
    const snapshot = await syncDefense(D(), "c1");
    const view = publicDefenseOverview(snapshot);
    const exact = snapshot.view.branches.map((b) => Math.round(b.active));
    for (const [i, branch] of view.branches.entries()) {
      expect(Object.keys(branch).sort()).toEqual(["domain", "id", "name", "reserveStrength", "strength"]);
      expect(branch.strength.low).toBeLessThanOrEqual(snapshot.view.branches[i]!.active);
      expect(branch.strength.high).toBeGreaterThan(snapshot.view.branches[i]!.active);
    }
    const json = JSON.stringify(view);
    for (const n of exact) expect(json).not.toContain(String(n));
  });
});

describe("down payment", () => {
  const capitalOf = (rows: Record<string, unknown>[]) => rows.reduce((sum, b) => sum + (b.capital as number), 0);

  it("is paid at order, and a cancel right after sinks it from that month's procurement line", async () => {
    await catalogItem({});
    const order = await orderProcurement(D(), {
      countryId: "c1",
      branchId: branchOf("air").id as string,
      catalogKey: "F35",
      quantity: 2,
      source: "import",
    });
    expect(order.paidSoFar).toBeCloseTo(2 * 80e6 * 1.15 * 0.15);
    await cancelProcurementOrder(D(), { countryId: "c1", orderId: order.id });

    // A twin nation that never ordered: after the month end it has bought more capital with the same line.
    const cancelled = db;
    db = fakeDefenseDb([{ id: "c1", currentPopulation: 27e6, currentGdpPerCapita: 21_000 }]);
    await syncDefense(D(), "c1");
    const twin = db;
    clock.now = T0 + MONTH_MS + 1;
    await syncDefense(twin as never, "c1");
    await syncDefense(cancelled as never, "c1");
    const lost = capitalOf(twin.militaryBranch.rows) - capitalOf(cancelled.militaryBranch.rows);
    expect(lost).toBeGreaterThan(0);
    expect(cancelled.procurementOrder.rows[0]).toMatchObject({ status: "cancelled", paidSoFar: order.paidSoFar });
  });
});

describe("mobilisation", () => {
  it("calls up reservists gradually and keeps those already reported when adding to the order", async () => {
    const land = branchOf("land");
    await mobiliseReserves(D(), { countryId: "c1", branchId: land.id as string, reservists: 10_000 });
    clock.now = T0 + 5 * DAY_MS;
    const reported = mobilisedCount({
      order: land.mobilisationOrder as number,
      orderedClockMs: land.mobilisationOrderedClockMs as number,
      nowClockMs: clock.now,
      doctrine: "balanced",
    });
    expect(reported / 10_000).toBeCloseTo(1 - Math.exp(-0.5), 6);
    await mobiliseReserves(D(), { countryId: "c1", branchId: land.id as string, reservists: 10_000 });
    const after = mobilisedCount({
      order: land.mobilisationOrder as number,
      orderedClockMs: land.mobilisationOrderedClockMs as number,
      nowClockMs: clock.now,
      doctrine: "balanced",
    });
    expect(land.mobilisationOrder).toBe(20_000);
    expect(after).toBeCloseTo(reported, 3);
  });

  it("refuses more than the reserve and sends everyone home on demobilisation", async () => {
    const land = branchOf("land");
    await expect(
      mobiliseReserves(D(), { countryId: "c1", branchId: land.id as string, reservists: 1e9 })
    ).rejects.toThrow(/reservists to call up/);
    await mobiliseReserves(D(), { countryId: "c1", branchId: land.id as string, reservists: 100 });
    await demobiliseReserves(D(), { countryId: "c1", branchId: land.id as string });
    expect(land).toMatchObject({ mobilisationOrder: 0, mobilisationOrderedClockMs: null });
  });
});

describe("policy levers", () => {
  it("applies a preset", async () => {
    await setDefenseShares(D(), { countryId: "c1", preset: "rearm" });
    expect(db.defensePolicy.rows[0]).toMatchObject({
      shareProcurement: SHARE_PRESETS.rearm.procurement,
      preset: "rearm",
    });
  });

  it("orders an alert raise from the level in effect now, so flipping never skips the wait", async () => {
    await setAlertLevel(D(), { countryId: "c1", alertLevel: "war" });
    expect(db.defensePolicy.rows[0]).toMatchObject({
      alertLevel: "war",
      previousAlertLevel: "peacetime",
      alertChangedClockMs: T0,
    });
    clock.now = T0 + 10 * DAY_MS; // war has not bitten yet (30 days)
    await setAlertLevel(D(), { countryId: "c1", alertLevel: "high" });
    expect(db.defensePolicy.rows[0]).toMatchObject({ alertLevel: "high", previousAlertLevel: "peacetime" });
  });

  it("refuses another nation's branch", async () => {
    await expect(
      setBranchAllocation(D(), { countryId: "c1", branchId: "elsewhere", effortShare: 1 })
    ).rejects.toThrow(/not found/);
  });

  it("starts a new branch empty and never re-seeds a fresh force after deleting them all", async () => {
    const branch = await createEmptyBranch(D(), { countryId: "c1", domain: "marines", name: "Marines" });
    expect(branch).toMatchObject({ activeDuty: 0, capital: 0, readinessCondition: 1, lastTickClockMs: T0 });
    db.militaryBranch.rows.splice(0);
    expect(await seedStarterBranches(D(), "c1")).toMatchObject({ created: 3 });
    expect(db.militaryBranch.rows.every((b) => b.capital === 0 && b.activeDuty === 0)).toBe(true);
  });
});

describe("assets and operations", () => {
  it("scraps an asset with its share of the branch's capital", async () => {
    await catalogItem({});
    const air = branchOf("air");
    const asset = await db.militaryAsset.create({
      data: { branchId: air.id, catalogKey: "F35", quantity: 10, acquisitionCost: 80e6, designYear: 2024 },
    });
    const before = air.capital as number;
    const result = await scrapAsset(D(), { countryId: "c1", assetId: asset.id });
    expect(result.capitalRemoved).toBeCloseTo(800e6);
    expect(air.capital).toBeCloseTo(before - 800e6);
    expect(db.militaryAsset.rows).toHaveLength(0);
  });

  it("wears condition on deploy and lifts training after an exercise", async () => {
    const land = branchOf("land");
    const unit = await db.militaryUnit.create({ data: { branchId: land.id } });
    const condition = land.readinessCondition as number;
    await applyOperationReadiness(D(), { countryId: "c1", unitIds: [unit.id], assetIds: [], change: "deploy" });
    expect(land.readinessCondition).toBeCloseTo(condition - DEPLOY_CONDITION_COST);
    const training = land.readinessTraining as number;
    await applyOperationReadiness(D(), {
      countryId: "c1",
      unitIds: [unit.id],
      assetIds: [],
      change: "trainingEnded",
      generalsMultiplier: 1.1,
    });
    expect(land.readinessTraining).toBeCloseTo(Math.min(1, training + TRAINING_EXERCISE_GAIN * 1.1));
  });
});
