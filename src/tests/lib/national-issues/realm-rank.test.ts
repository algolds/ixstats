/**
 * Realm-relative issue thresholds (owner decision 2): a `rank` condition fires for the worst share of the realm on a
 * field, the share set by the template's severity band, crises also past the field's absolute floor. Ties are strict
 * rank (tiebreak field, then id) and a value at or better than the realm median never counts.
 */
import { describe, expect, it } from "@jest/globals";
import {
  evaluateTriggerCondition,
  type TriggerCondition,
} from "~/lib/national-issues/evaluators/condition-evaluator";
import {
  bandForSeverity,
  buildRankTable,
  passesCrisisFloor,
  RANKED_FIELDS,
  rankRowOf,
  type RankRow,
} from "~/lib/national-issues/evaluators/realm-rank";
import { triggerConditionErrors } from "~/lib/national-issues/evaluators/trigger-validation";
import type { CountrySnapshot } from "~/lib/national-issues/types";

/** A realm of n nations: n0 .. n{n-1}, with `field` = value(i). */
function realm(n: number, field: string, value: (i: number) => number, extra?: (i: number) => object) {
  return Array.from({ length: n }, (_, i) => ({ id: `n${i}`, [field]: value(i), ...(extra?.(i) ?? {}) }));
}

function firing(
  nations: Array<{ id: string } & Record<string, unknown>>,
  condition: TriggerCondition,
  severity: string,
  platform?: RankRow[]
): string[] {
  const ranks = buildRankTable(
    nations.map((n) => rankRowOf(n)),
    platform
  );
  return nations
    .filter((n) => evaluateTriggerCondition(condition, n as unknown as CountrySnapshot, { ranks, severity }))
    .map((n) => n.id);
}

const worst = (field: string, share?: number): TriggerCondition => ({
  rank: share === undefined ? { field } : { field, share },
});
const best = (field: string, share?: number): TriggerCondition => ({
  rank: share === undefined ? { field, side: "best" } : { field, side: "best", share },
});

describe("severity bands", () => {
  it("maps low and medium to mild, high to serious, critical to crisis, any case", () => {
    expect(["low", "medium", "LOW", "MEDIUM", undefined, "odd"].map(bandForSeverity)).toEqual(
      Array(6).fill("mild")
    );
    expect(bandForSeverity("high")).toBe("serious");
    expect(bandForSeverity("HIGH")).toBe("serious");
    expect(bandForSeverity("critical")).toBe("crisis");
    expect(bandForSeverity("CRITICAL")).toBe("crisis");
  });

  it("gives a mild issue to the worst 25%, a serious one to the worst 10% of 100 nations", () => {
    const nations = realm(100, "inflationRate", (i) => i / 10); // n99 has the highest inflation
    expect(firing(nations, worst("inflationRate"), "medium")).toHaveLength(25);
    expect(firing(nations, worst("inflationRate"), "high")).toEqual(
      Array.from({ length: 10 }, (_, k) => `n${90 + k}`)
    );
  });

  it("lets a condition override the band's share", () => {
    const nations = realm(100, "inflationRate", (i) => i);
    expect(firing(nations, worst("inflationRate", 0.4), "high")).toHaveLength(40);
  });
});

describe("direction", () => {
  it("reads low as bad for stability and high as bad for inflation", () => {
    const nations = realm(20, "stabilityScore", (i) => 40 + i, (i) => ({ inflationRate: 1 + i }));
    expect(firing(nations, worst("stabilityScore"), "low")).toEqual(["n0", "n1", "n2", "n3", "n4"]);
    expect(firing(nations, worst("inflationRate"), "low")).toEqual(["n15", "n16", "n17", "n18", "n19"]);
  });

  it("ranks the other end with side best", () => {
    const nations = realm(20, "actualGdpGrowth", (i) => i / 4);
    expect(firing(nations, best("actualGdpGrowth"), "low")).toEqual(["n15", "n16", "n17", "n18", "n19"]);
  });

  it("names a bad end for every ranked field", () => {
    for (const spec of Object.values(RANKED_FIELDS)) expect(["high", "low"]).toContain(spec.bad);
  });
});

describe("the crisis floor", () => {
  const unemployment = (top: number) =>
    realm(100, "unemploymentRate", (i) => (i === 99 ? top : 3 + i / 25));

  it("gives a crisis to the worst 3% only past the absolute floor", () => {
    // worst three: 6.88, 6.92 and the top value; the floor is 10%
    expect(firing(unemployment(14), worst("unemploymentRate"), "critical")).toEqual(["n99"]);
    expect(firing(unemployment(9), worst("unemploymentRate"), "critical")).toEqual([]);
  });

  it("gives a healthy realm grumbles but no crisis", () => {
    const healthy = realm(40, "inflationRate", (i) => 1 + i / 20); // 1% .. 2.95%
    expect(firing(healthy, worst("inflationRate"), "medium")).toHaveLength(10);
    expect(firing(healthy, worst("inflationRate"), "critical")).toEqual([]);
  });

  it("skips the floor for a supporting condition with its own share, and never applies it to side best", () => {
    const nations = unemployment(9);
    expect(firing(nations, worst("unemploymentRate", 0.03), "critical")).toEqual(["n97", "n98", "n99"]);
    expect(firing(realm(100, "actualGdpGrowth", (i) => i), best("actualGdpGrowth"), "critical")).toEqual([
      "n97",
      "n98",
      "n99",
    ]);
  });

  it("checks the floor in the field's direction, and a field with no floor never makes a crisis", () => {
    expect(passesCrisisFloor("stabilityScore", 34)).toBe(true);
    expect(passesCrisisFloor("stabilityScore", 35)).toBe(false);
    expect(passesCrisisFloor("inflationRate", 5.1)).toBe(true);
    expect(passesCrisisFloor("inflationRate", 5)).toBe(false);
    expect(passesCrisisFloor("currentTotalGdp", 0)).toBe(false);
    const sizes = realm(40, "currentTotalGdp", (i) => i * 1e9);
    expect(firing(sizes, worst("currentTotalGdp"), "critical")).toEqual([]);
  });
});

describe("ties", () => {
  it("lets in exactly the band, not half the realm, when a tie straddles the cut", () => {
    // 20 nations: 4 at 9%, 12 at 5% (the cut falls inside them), 4 at 1%; median 5
    const values = [...Array(4).fill(9), ...Array(12).fill(5), ...Array(4).fill(1)];
    const nations = realm(20, "inflationRate", (i) => values[i]!);
    // mild = 5 nations: the four at 9 strictly worse; the tie at 5 is the median, so none of it counts
    expect(firing(nations, worst("inflationRate"), "low")).toEqual(["n0", "n1", "n2", "n3"]);
  });

  it("breaks a tie past the median on the tiebreak field, then the id, and fills the band exactly", () => {
    // 20 nations: 10 tied at 8% (all worse than the median 5), 10 at 2%; band = 5 of the tie
    const nations = realm(
      20,
      "inflationRate",
      (i) => (i < 10 ? 8 : 2),
      (i) => ({ stabilityScore: i === 7 ? 10 : 50 })
    );
    const got = firing(nations, worst("inflationRate"), "low");
    expect(got).toHaveLength(5);
    expect(got).toContain("n7"); // least stable of the tie wins first
    expect(got).toEqual(["n0", "n1", "n2", "n3", "n7"]); // then by id
    // the same input gives the same answer
    expect(firing([...nations].reverse(), worst("inflationRate"), "low").sort()).toEqual(got);
  });

  it("never calls a value most of the realm shares the worst (a seeded default such as approval 50)", () => {
    const nations = realm(30, "publicApproval", (i) => (i < 2 ? 41 : i < 28 ? 50 : 80));
    expect(firing(nations, worst("publicApproval"), "low")).toEqual(["n0", "n1"]);
  });

  it("keeps everyone out when every nation has the same value (nobody is worse)", () => {
    expect(firing(realm(30, "povertyRate", () => 0), worst("povertyRate"), "low")).toEqual([]);
  });
});

describe("small realms and missing figures", () => {
  it("ranks a realm of fewer than 10 nations against the platform", () => {
    const small = realm(4, "inflationRate", (i) => 1 + i); // n3 is the realm's worst at 4%
    const others = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, values: { inflationRate: 6 + i / 10 } }));
    const platform = [...small.map((n) => rankRowOf(n)), ...others];
    expect(firing(small, worst("inflationRate"), "low")).toEqual(["n3"]); // alone, the worst of four
    expect(firing(small, worst("inflationRate"), "low", platform)).toEqual([]); // against everyone, healthy
  });

  it("keeps a large realm's own distribution even when platform rows are given", () => {
    const nations = realm(20, "inflationRate", (i) => i);
    const platform = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, values: { inflationRate: 100 + i } }));
    expect(firing(nations, worst("inflationRate"), "low", platform)).toHaveLength(5);
  });

  it("is false for a missing or non-finite value, an unknown field, or no rank table", () => {
    const nations = realm(20, "inflationRate", (i) => i);
    const ranks = buildRankTable(nations.map((n) => rankRowOf(n)));
    const at = (snapshot: object, condition: TriggerCondition, ctx = { ranks, severity: "low" }) =>
      evaluateTriggerCondition(condition, snapshot as CountrySnapshot, ctx);
    expect(at({ id: "n19", inflationRate: 19 }, worst("inflationRate"))).toBe(true);
    expect(at({ id: "n19" }, worst("inflationRate"))).toBe(false);
    expect(at({ id: "n19", inflationRate: Number.NaN }, worst("inflationRate"))).toBe(false);
    expect(at({ id: "stranger", inflationRate: 99 }, worst("inflationRate"))).toBe(false);
    expect(at({ id: "n19", inflationRate: 19, shoeSize: 3 }, worst("shoeSize"))).toBe(false);
    expect(evaluateTriggerCondition(worst("inflationRate"), { id: "n19", inflationRate: 19 } as never)).toBe(false);
  });

  it("combines with and/or/not and absolute conditions", () => {
    const nations = realm(20, "inflationRate", (i) => i, (i) => ({ activeAllianceCount: i % 2 }));
    const cond: TriggerCondition = {
      and: [worst("inflationRate"), { field: "activeAllianceCount", op: "<", value: 1 }],
    };
    expect(firing(nations, cond, "low")).toEqual(["n16", "n18"]);
    expect(firing(nations, { not: worst("inflationRate") }, "low")).toHaveLength(15);
  });
});

describe("the admin editor's trigger check", () => {
  it("accepts every condition kind, rank included", () => {
    const ok: TriggerCondition = {
      and: [
        { rank: { field: "inflationRate" } },
        { rank: { field: "actualGdpGrowth", side: "best", share: 0.5 } },
        { or: [{ field: "activeAllianceCount", op: ">", value: 0 }, { random: 0.2 }] },
        { not: { count: { field: "activeComponents", op: ">=", value: 3 } } },
        { any: { field: "partners", condition: { field: "band", op: "==", value: "ALLY" } } },
      ],
    };
    expect(triggerConditionErrors(ok)).toEqual([]);
  });

  it("refuses an unknown ranked field, side or share, an unknown kind or operator, and an empty list", () => {
    expect(triggerConditionErrors({ rank: { field: "shoeSize" } })[0]).toMatch(/not a ranked field/);
    expect(triggerConditionErrors({ rank: { field: "inflationRate", side: "middle" } })[0]).toMatch(/side/);
    expect(triggerConditionErrors({ rank: { field: "inflationRate", share: 1.5 } })[0]).toMatch(/share/);
    expect(triggerConditionErrors({ maybe: true })[0]).toMatch(/exactly one/);
    expect(triggerConditionErrors({ field: "inflationRate", op: "~", value: 1 })[0]).toMatch(/operator/);
    expect(triggerConditionErrors({ and: [] })[0]).toMatch(/non-empty/);
    expect(triggerConditionErrors("x")[0]).toMatch(/object/);
  });
});
