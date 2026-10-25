/** @jest-environment node */
/**
 * Realm time D2a: a nation's defense is brought up to date lazily on its realm clock. A nation without a policy gets
 * its starter force once (players keep their branch names; NPCs get forces from their economy); whole months tick
 * and persist with a compare-and-set so two readers never apply the same months; a paused realm never moves; a date
 * jump catches up on the next read; orders deliver into capital and asset rows.
 */
const clock = { now: 0, multiplier: 2 };
jest.mock("~/server/shared/realm-time", () => ({
  clockForCountry: jest.fn(async () => ({
    now: () => clock.now,
    multiplier: clock.multiplier,
    paused: clock.multiplier === 0,
  })),
}));
const budget = { allocations: [] as unknown[] };
jest.mock("~/lib/government/budget-allocations", () => ({
  loadEffectiveBudget: jest.fn(async () => budget),
}));

import { MONTH_MS } from "~/lib/military/model";
import {
  ensureStarterForce,
  nationalCombatPower,
  syncDefense,
} from "~/server/modules/defense";
import { resetRealmMedianCache } from "~/server/modules/defense/defense.economy";
import { fakeDefenseDb, type FakeDefenseDb } from "./fake-db";

const T0 = 1.95e12;
let db: FakeDefenseDb;
const sync = (id = "c1") => syncDefense(db as never, id);

beforeEach(() => {
  clock.now = T0;
  clock.multiplier = 2;
  budget.allocations = [];
  resetRealmMedianCache();
  db = fakeDefenseDb([
    { id: "c1", currentPopulation: 27e6, currentGdpPerCapita: 21_000 },
    { id: "npc", ownerUserId: null, currentPopulation: 10e6, currentGdpPerCapita: 15_000, governmentType: "Military junta" },
  ]);
});

describe("starter force", () => {
  it("gives a nation without a policy its starter force once, sized in the sanity band", async () => {
    const snap = await sync();
    expect(db.defensePolicy.rows).toHaveLength(1);
    expect(db.militaryBranch.rows.map((b) => b.domain)).toEqual(["land", "sea", "air"]);
    const active = snap.state.branches.reduce((s, b) => s + b.active, 0);
    expect(active / 27e6).toBeGreaterThan(0.002);
    expect(active / 27e6).toBeLessThan(0.011);
    expect(snap.budgetSource).toBe("estimate");
    expect(snap.monthsApplied).toBe(0);
    await sync();
    expect(db.defensePolicy.rows).toHaveLength(1);
    expect(db.militaryBranch.rows).toHaveLength(3);
  });

  it("keeps a nation's existing branches (names, ids) and resets their numbers", async () => {
    await db.militaryBranch.create({
      data: { countryId: "c1", domain: "land", name: "Royal Legion", activeDuty: 5_000_000, capital: 0 },
    });
    const snap = await sync();
    expect(db.militaryBranch.rows).toHaveLength(1);
    expect(db.militaryBranch.rows[0]).toMatchObject({ name: "Royal Legion" });
    expect(snap.state.branches[0]!.active).toBeLessThan(200_000);
    expect(snap.state.branches[0]!.capital).toBeGreaterThan(0);
  });

  it("loses the race quietly when another reader created the policy", async () => {
    const snap = await sync();
    expect(await ensureStarterForce(db as never, snap.country, snap.econ, T0)).toBe(false);
  });

  it("gives NPCs forces from their economy so a strike faces real defenders", async () => {
    const power = await nationalCombatPower(db as never, ["npc"]);
    expect(power.npc).toBeGreaterThan(0);
    const policy = db.defensePolicy.rows.find((p) => p.countryId === "npc")!;
    expect(policy.volunteerShare).toBeLessThan(0.5); // a junta conscripts
  });
});

describe("lazy monthly ticks", () => {
  it("applies whole months on read, persists them, and is idempotent", async () => {
    await sync();
    clock.now = T0 + 3.5 * MONTH_MS;
    const snap = await sync();
    expect(snap.monthsApplied).toBe(3);
    expect(db.defensePolicy.rows[0]!.lastTickClockMs).toBe(T0 + 3 * MONTH_MS);
    expect(db.militaryBranch.rows[0]!.lastTickClockMs).toBe(T0 + 3 * MONTH_MS);
    const again = await sync();
    expect(again.monthsApplied).toBe(0);
  });

  it("does not move on a paused realm", async () => {
    await sync();
    clock.multiplier = 0; // paused: the clock stands still however long the real gap
    const before = JSON.stringify(db.militaryBranch.rows);
    expect((await sync()).monthsApplied).toBe(0);
    expect(JSON.stringify(db.militaryBranch.rows)).toBe(before);
  });

  it("catches up a five-year jump on the next read with the closed forms", async () => {
    await sync();
    clock.now = T0 + 60 * MONTH_MS;
    const snap = await sync();
    expect(snap.monthsApplied).toBe(60);
    expect(db.defensePolicy.rows[0]!.lastTickClockMs).toBe(T0 + 60 * MONTH_MS);
    expect(db.defensePolicy.rows[0]!.priceIndex).toBeCloseTo(Math.pow(1.015, 5), 6);
  });

  it("applies months once when another reader got there first (compare-and-set)", async () => {
    await sync();
    clock.now = T0 + 2 * MONTH_MS;
    const updateMany = db.defensePolicy.updateMany;
    let raced = false;
    db.defensePolicy.updateMany = async (args) => {
      if (!raced) {
        raced = true;
        // Another process advanced the same months just before this write.
        db.defensePolicy.rows[0]!.lastTickClockMs = T0 + 2 * MONTH_MS;
      }
      return updateMany(args);
    };
    const snap = await sync();
    expect(raced).toBe(true);
    expect(snap.monthsApplied).toBe(0); // the retry found nothing left to apply
  });
});

describe("the defense budget", () => {
  it("sums every Defense line of the budget in effect", async () => {
    budget.allocations = [
      { allocatedAmount: 6e9, allocatedPercent: 6, department: { category: "Defense" } },
      { allocatedAmount: 4e9, allocatedPercent: 4, department: { category: "Defense" } },
      { allocatedAmount: 50e9, allocatedPercent: 50, department: { category: "Health" } },
    ];
    const snap = await sync();
    expect(snap.econ.defenseBudget).toBe(10e9);
    expect(snap.budgetSource).toBe("defenseDepartment");
  });
});

describe("deliveries", () => {
  it("delivers a paid order into the branch's capital and an asset row", async () => {
    await sync();
    await db.militaryEquipmentCatalog.create({
      data: {
        key: "SAM1",
        name: "Skyguard",
        category: "missile",
        subcategory: "air_defense",
        era: "CONTEMPORARY",
        acquisitionCost: 1e6,
        maintenanceCost: 1e5,
        capabilities: null,
        crewRequirement: 0,
        isActive: true,
      },
    });
    const land = db.militaryBranch.rows[0]!;
    await db.procurementOrder.create({
      data: {
        countryId: "c1",
        branchId: land.id,
        catalogKey: "SAM1",
        quantity: 10,
        unitCost: 1e6,
        unitRealValue: 1e6,
        source: "domestic",
        leadMonths: 2,
        designYear: 2016,
        orderedClockMs: T0,
        expectedClockMs: T0 + 2 * MONTH_MS,
      },
    });
    clock.now = T0 + 3 * MONTH_MS;
    await sync();
    expect(db.procurementOrder.rows[0]).toMatchObject({ status: "delivered" });
    expect(db.militaryAsset.rows[0]).toMatchObject({
      branchId: land.id,
      catalogKey: "SAM1",
      quantity: 10,
      designYear: 2016,
      assetType: "weapon_system",
    });
  });
});
