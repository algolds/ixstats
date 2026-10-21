/**
 * Statecraft simulation: foreign policy impacts, power brokers, the whip, and the vote and
 * consequence fog (which never fabricates a figure).
 */

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
});

import { ComponentType } from "@prisma/client";
import { deriveBrokers } from "~/lib/statecraft/power-brokers";

describe("Statecraft Power Brokers Derivation", () => {
  it("should satisfy Technocrats when spend meets the threshold", () => {
    const components = [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES];
    const spend = { "Science and Technology": 10.0, Education: 6.0 }; // 16% total
    const brokers = deriveBrokers(components, spend);
    const tech = brokers.find((b) => b.id === "technocrats");
    expect(tech?.unlocked).toBe(true);
    expect(tech?.satisfied).toBe(true);
    expect(tech?.gapPercent).toBe(0.0);
  });
});

import { tallyVote, type VotingBloc } from "~/lib/statecraft/legislative-vote";
import { fogVoteProjection } from "~/lib/statecraft/whip";

const blocs: VotingBloc[] = [
  { partyId: "a", partyName: "Left", ideology: "left", seats: 40 },
  { partyId: "b", partyName: "Centre", ideology: "center", seats: 30 }, // abstains on a left bill
  { partyId: "c", partyName: "Right", ideology: "right", seats: 30 },
];

describe("tallyVote — Mandate whip (S3.B)", () => {
  const leftBill = -2;
  it("high backing whips abstainers to yes (more decisive)", () => {
    const low = tallyVote(leftBill, blocs, 0);
    const high = tallyVote(leftBill, blocs, 1);
    expect(high.yesSeats).toBeGreaterThan(low.yesSeats);
    expect(high.abstainSeats).toBeLessThan(low.abstainSeats);
  });
});

describe("fogVoteProjection — standing gates precision (S3.A)", () => {
  const result = tallyVote(-2, blocs);
  it("middling standing gives direction but hides seats (never fabricates)", () => {
    const w = fogVoteProjection(result, 45);
    expect(w.level).toBe("questioned");
    expect(w.yesSeats).toBeUndefined();
    expect(["leaning_pass", "too_close"]).toContain(w.verdict);
  });

  it("weak standing reads nothing", () => {
    const w = fogVoteProjection(result, 20);
    expect(w.level).toBe("greyed");
    expect(w.verdict).toBe("unknown");
  });
});

import { revealConsequences } from "~/lib/statecraft/recon";

const democratic = {
  componentTypes: ["ELECTORAL_LEGITIMACY", "DEMOCRATIC_PROCESS", "MIXED_ECONOMY"],
  departmentCategories: ["Finance", "Foreign Affairs"],
  overCapacity: false,
  lowEfficiency: false,
};

const stratocracy = {
  componentTypes: ["MILITARY_ADMINISTRATION", "SURVEILLANCE_SYSTEM", "STATE_CAPITALISM"],
  departmentCategories: ["Defense", "Interior"],
  overCapacity: false,
  lowEfficiency: false,
};
describe("revealConsequences — fog is the build's blind spots", () => {
  const cs = [{ targetField: "publicApproval" }, { targetField: "gdpGrowth" }];
  it("a stratocracy greys approval (can't read consent) but sees the economy", () => {
    const out = revealConsequences(cs, stratocracy);
    expect(out.find((r) => r.domain === "approval")!.state).toBe("greyed");
    expect(out.find((r) => r.domain === "economic")!.state).toBe("revealed");
  });

  it("over-capacity questions an otherwise-revealed point (never hides, captions)", () => {
    const out = revealConsequences(cs, { ...democratic, overCapacity: true });
    const approval = out.find((r) => r.domain === "approval")!;
    expect(approval.state).toBe("questioned");
    expect(approval.reason).toMatch(/over capacity/i);
  });
});
