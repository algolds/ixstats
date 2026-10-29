/** @jest-environment node */
/**
 * Engine edge-case and property tests from the 2026-10-28 MyCountry stress run (agent C): directive package
 * assembly over arbitrary goals, the weekly cap over random commit histories, issue projection effects, foreign-policy
 * impact over extreme nations, and the recon reveal. Seeded, so a failure reproduces.
 */
import { assemblePackages, ForeignGoalError } from "~/lib/intent/assemble";
import { cooldownStatus, WEEK_MS } from "~/server/modules/intent/weekly-cap";
import {
  issueConsequenceToEffect,
  MAX_ISSUE_GDP_LEVEL_SHIFT,
  MAX_ISSUE_POPULATION_LEVEL_SHIFT,
} from "~/lib/national-issues/projection-effects";
import { computeForeignPolicyImpact } from "~/lib/statecraft/foreign-policy";
import { revealConsequences } from "~/lib/statecraft/recon";
import { createMemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation } from "~/tests/helpers/nation-world";

/** Mulberry32: a small seeded PRNG. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
const WORDS = [
  "tax",
  "army",
  "school",
  "roads",
  "crime",
  "growth",
  "jobs",
  "support",
  "farms",
  "software",
  "port",
  "reform",
  "healthcare",
  "debt",
  "solar",
  "police",
  "unemployment",
  "pension",
  "with",
  "war",
  "the",
  "and",
  "改善",
  "🏥",
  "'",
  "<b>",
  "--",
  "​",
  "OR",
  "1=1",
];
const LOCKED = new Set([
  "currentTotalGdp",
  "currentGdpPerCapita",
  "currentPopulation",
  "nominalGDP",
  "landArea",
]);

describe("directive package assembly over arbitrary goals", () => {
  it("returns five bounded packages or refuses the goal as foreign, never anything else", () => {
    const r = rng(7);
    for (let i = 0; i < 2000; i++) {
      const goal = Array.from({ length: 1 + Math.floor(r() * 8) }, () => pick(r, WORDS)).join(" ");
      let result: ReturnType<typeof assemblePackages>;
      try {
        result = assemblePackages(goal);
      } catch (e) {
        expect(e).toBeInstanceOf(ForeignGoalError);
        continue;
      }
      expect(result.packages.map((p) => p.tier)).toEqual([
        "measured",
        "moderate",
        "extreme",
        "broker_unlocked",
        "structural_unlocked",
      ]);
      for (const p of result.packages) {
        expect(p.changes.length).toBeLessThanOrEqual(4);
        expect(p.gdpGrowthModifier).toBeGreaterThanOrEqual(0);
        expect(p.gdpGrowthModifier).toBeLessThanOrEqual(0.05);
        for (const c of p.consequences) {
          expect(Number.isFinite(c.value)).toBe(true);
          expect(c.value).not.toBe(0);
          expect(LOCKED.has(c.targetField)).toBe(false);
        }
      }
      // A bigger push never moves the improved stat less
      const improve = (tier: number) =>
        Math.abs(result.packages[tier]!.consequences[0]?.value ?? 0);
      expect(improve(1)).toBeGreaterThanOrEqual(improve(0));
      expect(improve(2)).toBeGreaterThanOrEqual(improve(1));
    }
  });
});

describe("weekly cap over random commit histories", () => {
  it("counts exactly the committed directives of the trailing week, and frees a slot a week after the oldest", async () => {
    const r = rng(11);
    for (let run = 0; run < 25; run++) {
      const db = createMemoryPrisma();
      await addIxnay(db as never);
      await addNation(db as never, { id: "n", baselineDate: new Date(0) });
      const now = Date.UTC(2043, 0, 15);
      const rows = Array.from({ length: Math.floor(r() * 8) }, (_, i) => ({
        id: `i${i}`,
        createdIxTime: now - Math.floor(r() * 2 * WEEK_MS),
        tier: r() < 0.25 ? "proposed" : "measured",
      }));
      for (const row of rows) {
        await db.intent.create({
          data: {
            ...row,
            countryId: "n",
            goal: "g",
            category: "economy",
            status: "active",
            changesJson: "[]",
          },
        });
      }
      const counted = rows.filter((x) => x.tier !== "proposed" && x.createdIxTime >= now - WEEK_MS);
      const status = await cooldownStatus(db as never, "n", now);
      expect(status.usedThisWeek).toBe(counted.length);
      expect(status.canCommit).toBe(counted.length < 3);
      if (!status.canCommit) {
        const oldest = Math.min(...counted.map((x) => x.createdIxTime));
        expect(status.cooldownUntil).toBe(oldest + WEEK_MS);
        expect(
          (await cooldownStatus(db as never, "n", oldest + WEEK_MS + 1)).usedThisWeek
        ).toBeLessThan(counted.length);
      }
    }
  });
});

describe("issue projection effects", () => {
  it("are finite and within their level caps for any value and duration", () => {
    const r = rng(3);
    const fields = [
      "actualGdpGrowth",
      "currentTotalGdp",
      "currentGdpPerCapita",
      "currentPopulation",
    ];
    for (let i = 0; i < 5000; i++) {
      const value = pick(r, [0, -0, 1e9, -1e9, r() * 200 - 100, r() * 2, NaN, Infinity]);
      const spec = issueConsequenceToEffect({
        targetModel: "Country",
        targetField: pick(r, fields),
        operation: pick(r, ["add", "subtract", "multiply", "set"] as const),
        value,
        durationDays: pick(r, [undefined, 0, -5, 1, 365, 3650, 1e7]),
      });
      if (!spec) continue;
      expect(Number.isFinite(spec.value)).toBe(true);
      const cap = spec.inputType.toLowerCase().includes("population")
        ? MAX_ISSUE_POPULATION_LEVEL_SHIFT
        : MAX_ISSUE_GDP_LEVEL_SHIFT;
      expect(Math.abs(spec.value)).toBeLessThanOrEqual(cap + 1e-9);
      if (spec.duration !== null) expect(spec.duration).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("foreign-policy impact over extreme nations", () => {
  it("is finite, hurts both sides for coercion and helps both for cooperation", () => {
    const r = rng(5);
    const sizes = [0, 1, 1394, 2485, 3e5, 2e7, 7.9e8, 5e9];
    const incomes = [0, 1, 1034, 30000, 100156, 1e7];
    for (let i = 0; i < 3000; i++) {
      const party = () => ({ population: pick(r, sizes), gdpPerCapita: pick(r, incomes) });
      const actionType = pick(r, [
        "embargo",
        "sanction",
        "free_trade",
        "military_alliance",
        "blockade",
      ] as const);
      const impact = computeForeignPolicyImpact({
        initiator: party(),
        target: party(),
        actionType,
        severity: pick(r, ["light", "moderate", "severe"] as const),
      });
      for (const v of [
        impact.initiatorGdpImpact,
        impact.targetGdpImpact,
        impact.relationshipDelta,
      ]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      const coercive = actionType !== "free_trade" && actionType !== "military_alliance";
      expect(Math.sign(impact.targetGdpImpact)).toBe(coercive ? -1 : 1);
      expect(Math.sign(impact.initiatorGdpImpact)).toBe(coercive ? -1 : 1);
      expect(Math.abs(impact.targetGdpImpact)).toBeLessThanOrEqual(0.1);
      // The initiator never pays more for coercion than the target loses
      if (coercive)
        expect(Math.abs(impact.initiatorGdpImpact)).toBeLessThanOrEqual(
          Math.abs(impact.targetGdpImpact)
        );
    }
  });
});

describe("recon reveal", () => {
  it("answers every consequence once, in a known state, with a reason when not revealed and plain copy", () => {
    const r = rng(9);
    const fields = [
      "publicApproval",
      "stabilityScore",
      "inflationRate",
      "unemploymentRate",
      "trustInGovernment",
      "x",
    ];
    for (let i = 0; i < 500; i++) {
      const cons = Array.from({ length: Math.floor(r() * 6) }, () => ({
        targetField: pick(r, fields),
      }));
      const out = revealConsequences(cons, {
        componentTypes: r() < 0.5 ? [] : ["PROFESSIONAL_BUREAUCRACY", "INDEPENDENT_JUDICIARY"],
        departmentCategories: r() < 0.5 ? [] : ["Finance", "Interior", "Health"],
        overCapacity: r() < 0.3,
        lowEfficiency: r() < 0.3,
      } as never);
      expect(out).toHaveLength(cons.length);
      for (const o of out) {
        expect(["revealed", "greyed", "questioned"]).toContain(o.state);
        if (o.state !== "revealed") expect(o.reason).not.toMatch(/—/);
      }
    }
  });
});
