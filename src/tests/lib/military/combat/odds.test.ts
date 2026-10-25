/** @jest-environment node */
/**
 * Research §7.5 steps 1–3: the worked odds values, band probabilities in closed form (and as the roll's frequencies),
 * the ×4 multiplier cap, and posture scaled by front density.
 */
import {
  BAND_EDGES,
  MULTIPLIER_CAP,
  OUTCOME_BANDS,
  bandOf,
  bandProbabilities,
  effectivePower,
  marginExceeds,
  marginFromUniform,
  successProbability,
} from "~/lib/military/combat";
import { landSetup, side } from "./fixtures";

describe("odds", () => {
  it.each([
    ["1:1 against a prepared defense", 1, 1, 0.29],
    ["2:1 prepared, open", 2, 1, 0.65],
    ["3:1 prepared, open", 3, 1, 0.81],
    ["3:1 prepared, urban", 3, 1.4, 0.69],
  ])("%s gives the research's P(success)", (_label, ratio, terrain, expected) => {
    const power = effectivePower(
      landSetup(ratio, { theatre: { ...landSetup(1).theatre, terrain } })
    );
    expect(power.effectiveRatio).toBeCloseTo(ratio / (1.5 * terrain), 6);
    // The research table rounds to two places (0.655 reads 0.65).
    expect(Math.abs(successProbability(power.effectiveRatio) - expected)).toBeLessThan(0.006);
  });

  it("6:1 against a fortified urban defense is 0.88", () => {
    expect(successProbability(6 / (1.6 * 1.4))).toBeCloseTo(0.88, 2);
  });

  it("keeps 5% catastrophe tails at any ratio", () => {
    expect(successProbability(100)).toBeLessThan(0.95 + 1e-9);
    expect(successProbability(0.01)).toBeGreaterThan(0.05 - 1e-9);
  });

  it("band probabilities sum to 1 and are differences of P(m > edge)", () => {
    for (const ratio of [0.3, 1, 2.5, 8]) {
      const bands = bandProbabilities(ratio);
      expect(OUTCOME_BANDS.reduce((s, b) => s + bands[b], 0)).toBeCloseTo(1, 12);
      expect(bands.breakthrough).toBeCloseTo(marginExceeds(ratio, 1), 12);
      expect(bands.repulsedHeavy).toBeCloseTo(1 - marginExceeds(ratio, -0.7), 12);
      expect(bands.marginal).toBeCloseTo(marginExceeds(ratio, 0) - marginExceeds(ratio, 0.4), 12);
    }
  });

  it("the roll's band frequencies match the closed form", () => {
    const ratio = 1.6;
    const counts = Object.fromEntries(OUTCOME_BANDS.map((b) => [b, 0])) as Record<string, number>;
    const n = 200_000;
    for (let i = 0; i < n; i++) counts[bandOf(marginFromUniform(ratio, (i + 0.5) / n))]! += 1;
    const expected = bandProbabilities(ratio);
    for (const band of OUTCOME_BANDS) expect(counts[band]! / n).toBeCloseTo(expected[band], 3);
  });

  it("bands split at the research's margins", () => {
    expect(BAND_EDGES).toEqual([-0.7, 0, 0.4, 1]);
    expect(bandOf(-0.71)).toBe("repulsedHeavy");
    expect(bandOf(-0.7)).toBe("repulsed");
    expect(bandOf(0)).toBe("marginal");
    expect(bandOf(0.4)).toBe("success");
    expect(bandOf(1)).toBe("breakthrough");
  });
});

describe("multipliers", () => {
  it("caps each side's situational product at ×4 (multiplier stacking)", () => {
    const setup = landSetup(1, {
      surprise: "complete",
      attacker: side(
        "att",
        { land: { power: 100_000, personnel: 100_000 }, air: { power: 1e5, personnel: 1_000 } },
        { doctrine: "expeditionary" }
      ),
      defender: side(
        "def",
        { land: { power: 100_000, personnel: 100_000 }, air: { power: 1e6, personnel: 1_000 } },
        { alert: "war", doctrine: "defensive", infrastructureStock: 1e12 }
      ),
      theatre: { ...landSetup(1).theatre, terrain: 1.8 },
      days: 1,
    });
    const power = effectivePower(setup);
    expect(power.defender.capped).toBe(true);
    expect(power.defender.product).toBe(MULTIPLIER_CAP);
    expect(power.defender.effective).toBeCloseTo(power.defender.raw * MULTIPLIER_CAP, 6);
  });

  it("posture only counts in full at full front density (force-to-space)", () => {
    const dense = effectivePower(landSetup(1));
    const thin = effectivePower(landSetup(1, { theatre: { ...landSetup(1).theatre, frontKm: 2_000 } }));
    expect(dense.defender.factors.find((f) => f.key === "posture")!.value).toBeCloseTo(1.5, 9);
    expect(thin.density).toBeCloseTo(0.1, 9);
    expect(thin.defender.factors.find((f) => f.key === "posture")!.value).toBeCloseTo(1.05, 9);
  });

  it("reach shrinks power projected over distance; neighbours are at full reach", () => {
    const far = effectivePower(
      landSetup(1, {
        theatre: { ...landSetup(1).theatre, neighbours: false, campaign: "overseas", distanceKm: 1_500 },
      })
    );
    expect(far.attacker.factors.find((f) => f.key === "reach")!.value).toBeCloseTo(Math.exp(-1), 9);
    expect(effectivePower(landSetup(1)).attacker.factors[0]).toEqual({ key: "reach", value: 1 });
  });
});
