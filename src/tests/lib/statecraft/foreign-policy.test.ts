import { computeForeignPolicyImpact, type FPParty } from "~/lib/statecraft/foreign-policy";

const mid: FPParty = { gdpPerCapita: 20000, population: 10_000_000 };
const rich: FPParty = { gdpPerCapita: 60000, population: 10_000_000 };
const poor: FPParty = { gdpPerCapita: 5000, population: 10_000_000 };

describe("computeForeignPolicyImpact — free trade asymmetry (Keaor)", () => {
  it("a richer partner gives you more GDP than a poorer one", () => {
    const vsRich = computeForeignPolicyImpact({
      initiator: mid,
      target: rich,
      actionType: "free_trade",
    });
    const vsPoor = computeForeignPolicyImpact({
      initiator: mid,
      target: poor,
      actionType: "free_trade",
    });
    expect(vsRich.initiatorGdpImpact).toBeGreaterThan(vsPoor.initiatorGdpImpact);
  });

  it("a bigger imbalance gives a bigger relations boost", () => {
    const vsEqual = computeForeignPolicyImpact({
      initiator: mid,
      target: mid,
      actionType: "free_trade",
    });
    const vsPoor = computeForeignPolicyImpact({
      initiator: mid,
      target: poor,
      actionType: "free_trade",
    });
    expect(vsPoor.relationshipDelta).toBeGreaterThan(vsEqual.relationshipDelta);
  });

  it("the poorer side gains more GDP from the deal than the richer side", () => {
    const r = computeForeignPolicyImpact({
      initiator: rich,
      target: poor,
      actionType: "free_trade",
    });
    expect(r.targetGdpImpact).toBeGreaterThan(r.initiatorGdpImpact); // poor target out-gains rich initiator
  });
});

describe("computeForeignPolicyImpact — coercive tools", () => {
  it("embargo/blockade hurt both sides and tank relations", () => {
    const e = computeForeignPolicyImpact({ initiator: mid, target: mid, actionType: "embargo" });
    expect(e.initiatorGdpImpact).toBeLessThan(0);
    expect(e.targetGdpImpact).toBeLessThan(0);
    expect(e.relationshipDelta).toBeLessThan(0);
    expect(
      computeForeignPolicyImpact({ initiator: mid, target: mid, actionType: "blockade" }).category
    ).toBe("military");
  });

  it("severity scales magnitude", () => {
    const light = computeForeignPolicyImpact({
      initiator: mid,
      target: mid,
      actionType: "sanction",
      severity: "light",
    });
    const severe = computeForeignPolicyImpact({
      initiator: mid,
      target: mid,
      actionType: "sanction",
      severity: "severe",
    });
    expect(Math.abs(severe.relationshipDelta)).toBeGreaterThan(Math.abs(light.relationshipDelta));
  });
});
