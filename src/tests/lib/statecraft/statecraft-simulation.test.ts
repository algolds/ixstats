/**
 * The Statecraft corpus: foreign policy impacts, power brokers, the whip, the vote and consequence fog (which never
 * fabricates a figure), the directive goal classifier over real goal texts (domestic only), and the guards on the
 * resistance a directive raises (template cooldown, spawn modes, never throwing into a commit). The resistance spawn,
 * link and dedupe run in tests/scenarios/engines/directive-lifecycle.test.ts.
 *
 * Folds intent-system and the guard cases of intent/resistance.
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

describe("computeForeignPolicyImpact — coercive tools hit the target hardest", () => {
  const big: FPParty = { gdpPerCapita: 20000, population: 160_000_000 }; // 16x mid

  it.each(["sanction", "embargo", "blockade"] as const)(
    "%s between equal economies: the target takes the main hit, the initiator a quarter of it",
    (actionType) => {
      const { initiatorGdpImpact, targetGdpImpact } = computeForeignPolicyImpact({
        initiator: mid,
        target: mid,
        actionType,
      });
      expect(targetGdpImpact).toBeLessThan(-0.005);
      expect(initiatorGdpImpact).toBeCloseTo(targetGdpImpact * 0.25, 12);
    }
  );

  it("a moderate sanction on an equal economy costs the target 1% and the initiator 0.25%", () => {
    const s = computeForeignPolicyImpact({ initiator: mid, target: mid, actionType: "sanction" });
    expect(s.targetGdpImpact).toBeCloseTo(-0.01, 12);
    expect(s.initiatorGdpImpact).toBeCloseTo(-0.0025, 12);
  });

  it("scales by relative size, and the target never takes less than the initiator", () => {
    const bigOnSmall = computeForeignPolicyImpact({
      initiator: big,
      target: mid,
      actionType: "sanction",
    });
    const smallOnBig = computeForeignPolicyImpact({
      initiator: mid,
      target: big,
      actionType: "sanction",
    });
    // A larger economy hits harder and pays relatively less; a smaller one hits softer
    expect(bigOnSmall.targetGdpImpact).toBeCloseTo(-0.02, 12);
    expect(bigOnSmall.initiatorGdpImpact).toBeCloseTo(-0.00125, 12);
    expect(smallOnBig.targetGdpImpact).toBeCloseTo(-0.005, 12);
    expect(smallOnBig.initiatorGdpImpact).toBeCloseTo(-0.005, 12);
    for (const impact of [bigOnSmall, smallOnBig]) {
      expect(impact.targetGdpImpact).toBeLessThanOrEqual(impact.initiatorGdpImpact);
    }
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

import { classifyGoal } from "~/lib/intent/assemble";

describe("classifyGoal over real goal texts", () => {
  it.each([
    ["Transition to Green Energy", "infrastructure"],
    ["Provide subsidies to Clean Energy Startups", "fiscal"],
    ["Expand healthcare access to Rural Communities", "social"],
    ["Boost military defense readiness", "defense"],
    ["Crack down on urban crime and corruption", "security"],
  ])("classifies %p as %s (capitalised words are not foreign names)", (goal, category) => {
    expect(classifyGoal(goal).category).toBe(category);
  });

  it.each(["Sign military alliance with Urcea", "Declare war against hostile nation"])(
    "refuses the foreign goal %p",
    (goal) => {
      expect(() => classifyGoal(goal)).toThrow(
        "Cabinet Directives are restricted to domestic policy"
      );
    }
  );
});

import { IxTime } from "~/lib/ixtime";
import { spawnIntentResistance, spawnResistanceForIntent } from "~/lib/intent/resistance";
import { NationalIssuesEngine, nationalIssuesConfig } from "~/lib/national-issues";

describe("directive resistance guards", () => {
  const template = {
    id: "tmpl-economic",
    title: "Economic Resistance in {{country}}",
    description: "Citizens are demonstrating against economic reforms in {{country}}.",
    triggerReason: "Policy resistance triggered",
    domain: "economic",
    category: "economic",
    options: [{ id: "opt_1", label: "Compromise", description: "Offer", consequences: [] }],
    cooldownDays: 30,
    maxActivePerCountry: 1,
    baseUrgency: 60,
  };
  const intent = { id: "intent-1", category: "economy", tier: "extreme" };
  const db = {
    nationalIssueTemplate: { findMany: jest.fn(), findUnique: jest.fn() },
    nationalIssue: { findFirst: jest.fn(), count: jest.fn() },
  };
  let forceGenerate: jest.SpiedFunction<typeof NationalIssuesEngine.forceGenerate>;
  const spawnMode = (mode: "deterministic" | "probability" | "off") =>
    jest
      .spyOn(nationalIssuesConfig, "getNationalIssuesConfig")
      .mockReturnValue({ maxIssuesPerSession: 3, maxIssuesPerWeek: 5, spawnMode: mode });

  beforeEach(() => {
    jest.spyOn(IxTime, "getCurrentIxTime").mockReturnValue(1_000_000);
    forceGenerate = jest.spyOn(NationalIssuesEngine, "forceGenerate").mockResolvedValue("issue-1");
    db.nationalIssueTemplate.findMany.mockReset().mockResolvedValue([template]);
    db.nationalIssueTemplate.findUnique.mockReset().mockResolvedValue(template);
    db.nationalIssue.findFirst.mockReset().mockResolvedValue(null);
    db.nationalIssue.count.mockReset().mockResolvedValue(0);
  });
  afterEach(() => jest.restoreAllMocks());

  it("raises nothing from a template still cooling down after a recent spawn", async () => {
    db.nationalIssue.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "recent" });
    await expect(
      spawnResistanceForIntent({
        db: db as never,
        countryId: "country-1",
        intent,
        tokens: ["economic"],
      })
    ).resolves.toBeNull();
    expect(forceGenerate).not.toHaveBeenCalled();
  });

  it.each(["probability", "off"] as const)("raises nothing in %s mode", async (mode) => {
    spawnMode(mode);
    await expect(
      spawnIntentResistance({ db: db as never, countryId: "country-1", intent })
    ).resolves.toBeNull();
    expect(db.nationalIssueTemplate.findMany).not.toHaveBeenCalled();
  });

  it("never throws into the commit when the database fails", async () => {
    spawnMode("deterministic");
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    db.nationalIssueTemplate.findMany.mockRejectedValue(new Error("boom"));
    await expect(
      spawnIntentResistance({ db: db as never, countryId: "country-1", intent })
    ).resolves.toBeNull();
  });
});
