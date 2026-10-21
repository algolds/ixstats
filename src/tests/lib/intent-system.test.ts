import { describe, it, expect } from "@jest/globals";
// `~/env` is already replaced by jest-mocks/env.ts via moduleNameMapper; no jest.mock needed.

import { assemblePackages, classifyGoal, weightAcceptance } from "~/lib/intent/assemble";
describe("Intent System & Package Assembly", () => {
  it("correctly classifies domestic goals without regex rejection on capitalized words", () => {
    const goals = [
      { text: "Transition to Green Energy", expected: "infrastructure" },
      { text: "Provide subsidies to Clean Energy Startups", expected: "fiscal" },
      { text: "Invest with High Speed Rail Transit", expected: "infrastructure" },
      { text: "Expand healthcare access to Rural Communities", expected: "social" },
      { text: "Boost military defense readiness", expected: "defense" },
      { text: "Crack down on urban crime and corruption", expected: "security" },
      { text: "Create industrial manufacturing jobs", expected: "economy" },
    ];

    for (const g of goals) {
      const { category } = classifyGoal(g.text);
      expect(category).toBe(g.expected);
    }
  });

  it("blocks explicit bilateral foreign military or diplomatic treaties", () => {
    const foreignGoals = [
      "Prepare for war with Burgundie",
      "Sign military alliance with Urcea",
      "Open embassy in Morstaybishlia",
      "Impose sanctions on enemy state",
      "Declare war against hostile nation",
    ];

    for (const g of foreignGoals) {
      expect(() => classifyGoal(g)).toThrow("Cabinet Directives are restricted to domestic policy");
    }
  });

  it("assembles all 5 packages with valid consequences and zero forbidden fields", () => {
    const result = assemblePackages("Build modern public transit network");
    expect(result.category).toBe("infrastructure");
    expect(result.packages).toHaveLength(5);

    const tiers = result.packages.map((p) => p.tier);
    expect(tiers).toEqual([
      "measured",
      "moderate",
      "extreme",
      "broker_unlocked",
      "structural_unlocked",
    ]);

    for (const pkg of result.packages) {
      expect(pkg.changes.length).toBeLessThanOrEqual(4);
      expect(pkg.execBandwidthCost).toBeGreaterThan(0);
    }
  });

  it("weights stakeholder acceptance based on aligned power broker status", () => {
    expect(weightAcceptance("bad", { brokerUnlocked: true })).toBe("mid");
    expect(weightAcceptance("good", { brokerUnlocked: true })).toBe("good");
    expect(weightAcceptance("mid", {})).toBe("mid");
  });
});
