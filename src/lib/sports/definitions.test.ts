import { describe, it, expect } from "@jest/globals";
import { getSportDefinition, SPORT_DEFINITIONS } from "./definitions";

describe("SportDefinition Protocol & Multi-Sport Adapters", () => {
  it("registers all 7 canonical sport definitions", () => {
    const keys = ["soccer", "hockey", "f1", "basketball", "football", "baseball", "boxing"];
    for (const key of keys) {
      expect(SPORT_DEFINITIONS[key]).toBeDefined();
      expect(SPORT_DEFINITIONS[key].id).toBe(key);
    }
  });

  it("resolves hockey with 3 periods, OTL points, and rink surface", () => {
    const hockey = getSportDefinition("hockey");
    expect(hockey.name).toBe("Ice Hockey");
    expect(hockey.surfaceType).toBe("rink");
    expect(hockey.periods.count).toBe(3);
    expect(hockey.periods.periodName).toBe("Period");
    expect(hockey.scoringRules.otLossPoints).toBe(1);
    expect(hockey.scoringRules.winPoints).toBe(2);
    expect(hockey.terminology.match).toBe("Game");
    expect(hockey.terminology.surfaceName).toBe("Rink");
  });

  it("resolves Formula 1 with constructor/driver terminology and circuit surface", () => {
    const f1 = getSportDefinition("f1");
    expect(f1.name).toBe("Formula 1");
    expect(f1.surfaceType).toBe("circuit");
    expect(f1.terminology.athlete).toBe("Driver");
    expect(f1.terminology.organization).toBe("Constructor");
    expect(f1.terminology.match).toBe("Grand Prix");
    expect(f1.scoringRules.winPoints).toBe(25);
  });

  it("falls back gracefully to soccer for unknown sport keys", () => {
    const fallback = getSportDefinition("curling");
    expect(fallback.id).toBe("soccer");
    expect(fallback.surfaceType).toBe("pitch");
  });
});
