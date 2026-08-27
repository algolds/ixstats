/**
 * Comprehensive Statecraft Simulation Test Suite
 * Covers foreign policy impacts, power brokers, whip voting mechanisms, recon fog of war,
 * temporal calendars, and diplomatic intelligence reach.
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


import { ComponentType } from "@prisma/client";
import { deriveBrokers } from "~/lib/statecraft/power-brokers";

describe("Statecraft Power Brokers Derivation", () => {
  it("should lock all brokers when no components match", () => {
    const active = deriveBrokers([], {});
    active.forEach((b) => {
      expect(b.unlocked).toBe(false);
      expect(b.satisfied).toBe(false);
    });
  });

  it("should unlock Technocrats but keep them unsatisfied when spend is low", () => {
    const components = [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES];
    const spend = { "Science and Technology": 5.0, Education: 5.0 }; // 10% total, min 15%
    const brokers = deriveBrokers(components, spend);
    const tech = brokers.find((b) => b.id === "technocrats");
    expect(tech?.unlocked).toBe(true);
    expect(tech?.satisfied).toBe(false);
    expect(tech?.gapPercent).toBe(5.0);
  });

  it("should satisfy Technocrats when spend meets the threshold", () => {
    const components = [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES];
    const spend = { "Science and Technology": 10.0, Education: 6.0 }; // 16% total
    const brokers = deriveBrokers(components, spend);
    const tech = brokers.find((b) => b.id === "technocrats");
    expect(tech?.unlocked).toBe(true);
    expect(tech?.satisfied).toBe(true);
    expect(tech?.gapPercent).toBe(0.0);
  });

  it("should support fallback Traditional unlock for the Clergy", () => {
    const components = [ComponentType.TRADITIONAL_LEGITIMACY];
    const spend = { Culture: 20.0 };
    const brokers = deriveBrokers(components, spend);
    const clergy = brokers.find((b) => b.id === "clergy");
    expect(clergy?.unlocked).toBe(true);
    expect(clergy?.satisfied).toBe(true);
  });

  it("should support fallback Military Enforcement unlock for the Generals", () => {
    const components = [ComponentType.MILITARY_ENFORCEMENT];
    const spend = { Defense: 20.0 };
    const brokers = deriveBrokers(components, spend);
    const generals = brokers.find((b) => b.id === "generals");
    expect(generals?.unlocked).toBe(true);
    expect(generals?.satisfied).toBe(true);
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

  it("is unchanged when no backing is passed (back-compat)", () => {
    const r = tallyVote(leftBill, blocs);
    // left (40) yes; centre (dist 2) abstain; right (dist 4) no
    expect(r.yesSeats).toBe(40);
    expect(r.abstainSeats).toBe(30);
    expect(r.noSeats).toBe(30);
    expect(r.passed).toBe(true);
  });

  it("high backing whips abstainers to yes (more decisive)", () => {
    const low = tallyVote(leftBill, blocs, 0);
    const high = tallyVote(leftBill, blocs, 1);
    expect(high.yesSeats).toBeGreaterThan(low.yesSeats);
    expect(high.abstainSeats).toBeLessThan(low.abstainSeats);
  });
});

describe("fogVoteProjection — standing gates precision (S3.A)", () => {
  const result = tallyVote(-2, blocs);

  it("strong standing reveals exact counts", () => {
    const w = fogVoteProjection(result, 75);
    expect(w.level).toBe("revealed");
    expect(w.yesSeats).toBe(result.yesSeats);
    expect(w.verdict).toBe("pass");
  });

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


import { revealConsequences, classifyDomain } from "~/lib/statecraft/recon";

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

describe("classifyDomain", () => {
  it("buckets fields by name", () => {
    expect(classifyDomain("publicApproval")).toBe("approval");
    expect(classifyDomain("gdpGrowthRate")).toBe("economic");
    expect(classifyDomain("crimeRate")).toBe("stability");
    expect(classifyDomain("diplomaticReputation")).toBe("diplomatic");
    expect(classifyDomain("lifeExpectancy")).toBe("economic"); // no social keyword → default
  });
});

describe("revealConsequences — fog is the build's blind spots", () => {
  const cs = [{ targetField: "publicApproval" }, { targetField: "gdpGrowth" }];

  it("a democratic+electoral build reveals approval", () => {
    const out = revealConsequences(cs, democratic);
    expect(out.find((r) => r.domain === "approval")!.state).toBe("revealed");
  });

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


import { getUpcomingEvents, formatRelativeIxDays, formatIxCountdown } from "~/lib/statecraft/calendar";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000_000_000_000;

describe("getUpcomingEvents", () => {
  it("keeps only future events, soonest first", () => {
    const out = getUpcomingEvents({
      nowIxTime: NOW,
      elections: [
        { id: "a", name: "General Election", scheduledIxTime: NOW + 10 * DAY, status: "upcoming" },
        { id: "b", name: "Past Election", scheduledIxTime: NOW - 5 * DAY, status: "upcoming" },
        { id: "c", name: "Done", scheduledIxTime: NOW + 2 * DAY, status: "completed" },
      ],
      issueDeadlines: [
        { id: "i1", title: "Border crisis", deadlineIxTime: NOW + 3 * DAY },
        { id: "i2", title: "No deadline", deadlineIxTime: null },
      ],
      termEndIxTime: NOW + 30 * DAY,
    });
    expect(out.map((e) => e.id)).toEqual(["issue-i1", "election-a", "term-end"]);
    // completed election dropped, past dropped, undated issue dropped
    expect(out.find((e) => e.id === "election-c")).toBeUndefined();
  });

  it("handles empty inputs", () => {
    expect(getUpcomingEvents({ nowIxTime: NOW })).toEqual([]);
  });
});

describe("formatRelativeIxDays", () => {
  it("buckets sensibly", () => {
    expect(formatRelativeIxDays(NOW, NOW)).toBe("today");
    expect(formatRelativeIxDays(NOW + DAY, NOW)).toBe("tomorrow");
    expect(formatRelativeIxDays(NOW + 5 * DAY, NOW)).toBe("in 5 days");
    expect(formatRelativeIxDays(NOW + 21 * DAY, NOW)).toBe("in 3 weeks");
    expect(formatRelativeIxDays(NOW + 90 * DAY, NOW)).toBe("in 3 months");
  });
});

describe("formatIxCountdown", () => {
  it("renders fine-grained countdowns and clamps at now", () => {
    expect(formatIxCountdown(NOW, NOW)).toBe("now");
    expect(formatIxCountdown(NOW - 5000, NOW)).toBe("now");
    expect(formatIxCountdown(NOW + 45 * 60 * 1000, NOW)).toBe("45m");
    expect(formatIxCountdown(NOW + (6 * 3600 + 12 * 60) * 1000, NOW)).toBe("6h 12m");
    expect(formatIxCountdown(NOW + (2 * 86400 + 4 * 3600) * 1000, NOW)).toBe("2d 4h");
  });
});


import { assessReach, fogNumber } from "~/lib/statecraft/diplo-intel";

describe("assessReach — reach drives clarity", () => {
  it("embassy → revealed", () => {
    expect(assessReach({ hasEmbassy: true, relationStrength: 0 }).level).toBe("revealed");
  });
  it("ties but no embassy → questioned", () => {
    expect(assessReach({ hasEmbassy: false, relationStrength: 55 }).level).toBe("questioned");
  });
  it("no reach → greyed", () => {
    expect(assessReach({ hasEmbassy: false, relationStrength: 10 }).level).toBe("greyed");
  });
});

describe("fogNumber — never fabricates", () => {
  it("revealed is exact, greyed is null", () => {
    expect(fogNumber(12345, "revealed")).toBe(12345);
    expect(fogNumber(12345, "greyed")).toBeNull();
    expect(fogNumber(null, "revealed")).toBeNull();
  });
  it("questioned is a coarse estimate of the real value (not invented)", () => {
    // 2 sig figs: 12345 → 12000, real magnitude preserved
    expect(fogNumber(12345, "questioned")).toBe(12000);
    expect(fogNumber(87.6, "questioned")).toBe(88);
  });
});

