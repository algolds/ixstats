/** @jest-environment node */
/**
 * Realm time D3 end to end on the in-memory defense db: a strike commits with a seed bound to its orders and replays
 * exactly; losses come off the forces; war damage and deaths are written as level effects on the realm clock; a
 * struck NPC stands to; a PvP conflict resolves once; nations of different realms cannot fight; and the economy
 * feedback (crowd-out, NPC Richardson) runs once per in-game month, idempotently.
 */
const clock = { now: 0, multiplier: 2 };
jest.mock("~/server/shared/realm-time", () => ({
  clockForCountry: jest.fn(async () => ({
    now: () => clock.now,
    multiplier: clock.multiplier,
    paused: clock.multiplier === 0,
  })),
  clocksForRealms: jest.fn(async () => new Map()),
  realmNowsOnce: jest.fn(() => () => clock.now),
}));
const budget = { allocations: [] as { allocatedAmount: number; allocatedPercent: number; department: { category: string } }[] };
jest.mock("~/lib/government/budget-allocations", () => ({
  loadEffectiveBudget: jest.fn(async () => budget),
}));

import { MONTH_MS } from "~/lib/military/model";
import { SAME_REALM_MESSAGE } from "~/lib/realms/same-realm";
import { FEEDBACK_KEYS } from "~/lib/military/economy/feedback";
import {
  buildEngagement,
  combatOdds,
  combatSeed,
  commitStrike,
  concludePvP,
  normaliseOrders,
  ordersHash,
  replayEngagement,
  resetTheatreCache,
  sealPvP,
} from "~/server/modules/combat";
import { syncDefense } from "~/server/modules/defense";
import { resetRealmMedianCache } from "~/server/modules/defense/defense.economy";
import { fakeDefenseDb, type FakeDefenseDb } from "../defense/fake-db";

const T0 = 1.95e12;
let db: FakeDefenseDb;
const asDb = () => db as never;

beforeEach(() => {
  clock.now = T0;
  clock.multiplier = 2;
  budget.allocations = [];
  resetRealmMedianCache();
  resetTheatreCache();
  db = fakeDefenseDb([
    { id: "player", currentPopulation: 27e6, currentGdpPerCapita: 21_000 },
    { id: "npc", ownerUserId: null, currentPopulation: 10e6, currentGdpPerCapita: 15_000, governmentType: "Military junta" },
    { id: "rival", currentPopulation: 20e6, currentGdpPerCapita: 25_000 },
    { id: "elsewhere", realmId: "other", currentPopulation: 5e6, currentGdpPerCapita: 30_000 },
  ]);
});

const activeOf = (countryId: string) =>
  db.militaryBranch.rows.filter((b) => b.countryId === countryId).reduce((s, b) => s + (b.activeDuty as number), 0);

describe("a PvNPC strike", () => {
  it("commits a seed bound to its orders, stores the inputs, and replays exactly", async () => {
    const { conflict, result } = await commitStrike(asDb(), { attackerId: "player", defenderId: "npc", commitment: 0.5 });
    expect(conflict).toMatchObject({ type: "pvnpc", status: "resolved", outcomeBand: result.band });
    expect(conflict.seed).toBe(combatSeed(conflict.id, T0, conflict.ordersHash!));
    const replay = replayEngagement(conflict.inputSnapshot!);
    expect(replay).toEqual(result);
    expect(conflict.margin).toBe(result.margin);
  });

  it("takes its losses off both forces and writes war damage and deaths on the realm clock", async () => {
    await syncDefense(asDb(), "player");
    await syncDefense(asDb(), "npc");
    const before = { player: activeOf("player"), npc: activeOf("npc") };
    const { result, conflict } = await commitStrike(asDb(), { attackerId: "player", defenderId: "npc" });
    expect(activeOf("player")).toBeCloseTo(before.player - result.attacker.casualties, 3);
    expect(activeOf("npc")).toBeLessThan(before.npc);
    const effects = db.storytellerEffect.rows.filter((e) => String(e.createdBy).startsWith(`conflict:${conflict.id}`));
    expect(effects.map((e) => e.inputType).sort()).toEqual([
      "gdp_level_adjustment",
      "population_level_adjustment",
      "population_level_adjustment",
    ]);
    expect(effects.every((e) => (e.ixTimeTimestamp as Date).getTime() === T0)).toBe(true);
    expect(effects.every((e) => (e.value as number) < 0)).toBe(true);
  });

  it("makes the struck NPC stand to, so the next strike cannot surprise it", async () => {
    await commitStrike(asDb(), { attackerId: "player", defenderId: "npc" });
    expect(db.defensePolicy.rows.find((p) => p.countryId === "npc")).toMatchObject({ alertLevel: "high" });
    clock.now = T0 + 20 * 24 * 3600 * 1000; // High bites after 14 days
    const engagement = await buildEngagement(asDb(), normaliseOrders({ mode: "strike", attackerId: "player", defenderId: "npc", days: 3 }));
    expect(engagement.setup.surprise).toBe("none");
  });
});

describe("seed shopping and date jumps", () => {
  it("the seed is fixed by battle, commit time and orders: the same orders always roll the same", () => {
    const orders = normaliseOrders({ mode: "strike", attackerId: "a", defenderId: "b", commitment: 0.5, days: 3 });
    const hash = ordersHash(orders);
    expect(combatSeed("battle", T0, hash)).toBe(combatSeed("battle", T0, ordersHash({ ...orders })));
    expect(combatSeed("battle", T0, hash)).not.toBe(combatSeed("battle", T0 + 1, hash));
    expect(ordersHash({ ...orders, commitment: 0.6 })).not.toBe(hash);
  });

  it("a date jump after the commit changes nothing about the stored result", async () => {
    const { conflict, result } = await commitStrike(asDb(), { attackerId: "player", defenderId: "npc" });
    clock.now = T0 + 60 * MONTH_MS;
    await syncDefense(asDb(), "player");
    expect(replayEngagement(conflict.inputSnapshot!)).toEqual(result);
  });
});

describe("a PvP conflict", () => {
  it("is sealed at acceptance and resolves once", async () => {
    const row = await db.militaryConflict.create({
      data: {
        type: "pvp",
        status: "active",
        initiatorId: "player",
        defenderId: "rival",
        pvpRules: JSON.stringify({ maxDuration: 10 }),
        orders: null,
        seed: null,
        startClockMs: T0,
      },
    });
    Object.assign(row, sealPvP(row as never, T0));
    const conflict = row as never;
    const first = await concludePvP(asDb(), conflict);
    expect(first?.result.days).toBeLessThanOrEqual(10);
    const effects = db.storytellerEffect.rows.length;
    expect(await concludePvP(asDb(), conflict)).toBeNull();
    expect(db.storytellerEffect.rows.length).toBe(effects);
    expect(row).toMatchObject({ status: "resolved", winner: first!.winner, outcomeBand: first!.result.band });
  });
});

describe("cross-realm guard", () => {
  it("refuses an engagement between nations of different realms", async () => {
    await expect(
      buildEngagement(asDb(), normaliseOrders({ mode: "strike", attackerId: "player", defenderId: "elsewhere", days: 3 }))
    ).rejects.toThrow(SAME_REALM_MESSAGE);
  });
});

describe("the odds screen", () => {
  it("never carries the defender's true strength", async () => {
    const odds = await combatOdds(asDb(), { attackerId: "player", defenderId: "npc", mode: "strike", days: 3 });
    const truth = (await syncDefense(asDb(), "npc")).view.combatPower;
    expect(odds.theatre.source).toBe("default");
    expect(odds.odds.defenderStrength.low).toBeLessThan(odds.odds.defenderStrength.high);
    expect(JSON.stringify(odds)).not.toContain(String(truth));
    expect(odds.preview.runs).toBe(1_000);
  });
});

describe("economic feedback on the realm clock", () => {
  it("holds a nation spending 4% of GDP at a crowd-out level, written once a month and idempotently", async () => {
    const gdp = 27e6 * 21_000;
    budget.allocations = [{ allocatedAmount: 0.04 * gdp, allocatedPercent: 10, department: { category: "Defense" } }];
    await syncDefense(asDb(), "player");
    expect(db.storytellerEffect.rows).toHaveLength(0); // no month applied yet
    clock.now = T0 + 1.2 * MONTH_MS;
    await syncDefense(asDb(), "player");
    const crowd = db.storytellerEffect.rows.filter((e) => e.createdBy === FEEDBACK_KEYS.crowdOut);
    expect(crowd).toHaveLength(1);
    expect(crowd[0]!.value as number).toBeCloseTo(-0.099, 3);
    expect((crowd[0]!.ixTimeTimestamp as Date).getTime()).toBe(T0 + 1.2 * MONTH_MS);
    clock.now = T0 + 2.2 * MONTH_MS;
    await syncDefense(asDb(), "player");
    expect(db.storytellerEffect.rows.filter((e) => e.createdBy === FEEDBACK_KEYS.crowdOut)).toHaveLength(1);
  });

  it("moves an NPC's burden up by the Richardson step when a rival fights it", async () => {
    await syncDefense(asDb(), "npc");
    await syncDefense(asDb(), "rival");
    await db.militaryConflict.create({
      data: { type: "pvp", status: "active", initiatorId: "rival", defenderId: "npc" },
    });
    const budgetBefore = (await syncDefense(asDb(), "npc")).econ.defenseBudget;
    clock.now = T0 + 12.5 * MONTH_MS;
    await syncDefense(asDb(), "npc");
    const adjustment = db.defensePolicy.rows.find((p) => p.countryId === "npc")!.npcBurdenAdjustment as number;
    expect(adjustment).toBeGreaterThan(0);
    expect((await syncDefense(asDb(), "npc")).econ.defenseBudget).toBeGreaterThan(budgetBefore);
  });
});
