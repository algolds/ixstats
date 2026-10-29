/**
 * Engine fuzz (stress test B): seeded random inputs through the budget math and the floor vote. Shares stay within
 * 100%, amounts follow shares, maintenance never outspends the year's budget, and a floor vote's seats always add
 * up whatever the government's standing (B-10: a non-finite standing turned every tally into NaN).
 */
import {
  allocationAt,
  chargeMaintenance,
  gdpScaleRatio,
  nudgeShare,
  sharesForDepartments,
} from "~/lib/government/budget-math";
import { IDEOLOGY_AXIS, tallyVote, type Ideology } from "~/lib/statecraft/legislative-vote";
import { chamberSeatProblem, fptpAllocation } from "~/lib/government/election-simulation";

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const IDEOLOGIES = Object.keys(IDEOLOGY_AXIS) as Ideology[];
const ODD = [NaN, Infinity, -Infinity, -1, 0, 1e-12, 1e15];

describe("budget math fuzz", () => {
  it.each(SEEDS)(
    "seed %i: a nudge never allocates more than 100%, and amounts follow shares",
    (seed) => {
      const r = rng(seed);
      const lines = Array.from({ length: 1 + Math.floor(r() * 12) }, (_, i) => ({
        id: `d${i}`,
        allocatedPercent: r() * 40,
      }));
      const target = lines[Math.floor(r() * lines.length)]!.id;
      const next = nudgeShare(lines, target, (r() - 0.3) * 150);
      const sum = next.reduce((s, l) => s + l.allocatedPercent, 0);
      const before = lines.reduce((s, l) => s + l.allocatedPercent, 0);
      expect(sum).toBeLessThanOrEqual(Math.max(100, before) + 1e-9);
      for (const l of next) expect(l.allocatedPercent).toBeGreaterThanOrEqual(0);
      const total = r() * 1e13;
      const pct = r() * 120 - 10;
      const fig = allocationAt(total, pct);
      expect(fig.allocatedPercent).toBeGreaterThanOrEqual(0);
      expect(fig.allocatedPercent).toBeLessThanOrEqual(100);
      expect(fig.allocatedAmount).toBeCloseTo((total * fig.allocatedPercent) / 100, 0);
    }
  );

  it.each(SEEDS)("seed %i: maintenance never spends more than the year's budget", (seed) => {
    const r = rng(seed);
    const budget = r() < 0.2 ? ODD[Math.floor(r() * ODD.length)]! : r() * 1e10;
    const spent = r() * 1e10;
    const costs = Array.from({ length: Math.floor(r() * 8) }, () => (r() - 0.1) * 5e9);
    const charges = chargeMaintenance(budget, spent, costs);
    for (const c of charges) expect(c).toBeGreaterThanOrEqual(0);
    const cap = Number.isFinite(budget) && budget > 0 ? Math.max(0, budget - spent) : 0;
    expect(charges.reduce((s, c) => s + c, 0)).toBeLessThanOrEqual(cap + 1e-6);
  });

  it.each(ODD)("a GDP scale ratio is finite and positive for a previous GDP of %p", (prev) => {
    const ratio = gdpScaleRatio(prev, 1e12);
    expect(Number.isFinite(ratio) && ratio > 0).toBe(true);
  });

  it.each(SEEDS)("seed %i: shares for unbudgeted departments add up to 100%", (seed) => {
    const r = rng(seed);
    const cats = ["Defense", "Health", "executive", "Other", "Finance"];
    const categories = Array.from(
      { length: 1 + Math.floor(r() * 9) },
      () => cats[Math.floor(r() * cats.length)]!
    );
    const defaults = new Map([
      ["Defense", 0.1],
      ["Health", 0.2],
      ["Finance", 0.1],
    ]);
    const shares = sharesForDepartments(categories, defaults);
    expect(shares.reduce((s, x) => s + x, 0)).toBeCloseTo(100, 6);
    for (const s of shares) expect(s).toBeGreaterThan(0);
  });
});

describe("floor vote and seat fuzz", () => {
  it.each(SEEDS)(
    "seed %i: a tally's seats add up and it passes only on more yes than no",
    (seed) => {
      const r = rng(seed);
      const blocs = Array.from({ length: 1 + Math.floor(r() * 8) }, (_, i) => ({
        partyId: `p${i}`,
        partyName: `P${i}`,
        ideology: IDEOLOGIES[Math.floor(r() * IDEOLOGIES.length)]!,
        seats: Math.floor(r() * 300),
      }));
      const seats = blocs.reduce((s, b) => s + b.seats, 0);
      const backing = r() < 0.4 ? ODD[Math.floor(r() * ODD.length)] : r();
      const result = tallyVote(Math.round(r() * 6) - 3, blocs, backing);
      expect(result.yesSeats + result.noSeats + result.abstainSeats).toBe(seats);
      expect(result.totalSeats).toBe(seats);
      expect(result.passed).toBe(result.yesSeats > result.noSeats);
    }
  );

  it.each(SEEDS)("seed %i: FPTP seats add up and the plurality never trails", (seed) => {
    const r = rng(seed);
    const votes = Array.from({ length: 2 + Math.floor(r() * 7) }, (_, i) => ({
      partyId: `p${i}`,
      votes: Math.round(1000 + r() * 98000),
    }));
    const n = 1 + Math.floor(r() * 5000);
    const seats = fptpAllocation(votes, n);
    expect([...seats.values()].reduce((s, x) => s + x, 0)).toBe(n);
    const top = [...votes].sort((a, b) => b.votes - a.votes)[0]!.partyId;
    expect(Math.max(...seats.values())).toBe(seats.get(top));
  });

  it.each([
    [[{ name: "A", seats: 5001 }], true],
    [[{ name: "A", seats: 0 }], true],
    [[{ name: "A", seats: 2.5 }], true],
    [
      [
        { name: "A", seats: 5000 },
        { name: "B", seats: 5000 },
      ],
      false,
    ],
    [
      [
        { name: "A", seats: 5000 },
        { name: "B", seats: 5000 },
        { name: "C", seats: 1 },
      ],
      true,
    ],
  ])("chamber seats %j refused: %p", (chambers, refused) => {
    const full = chambers.map((c) => ({
      ...c,
      electoralSystem: "proportional" as const,
      selectionMethod: "elected" as const,
    }));
    expect(chamberSeatProblem(full) !== null).toBe(refused);
  });
});
