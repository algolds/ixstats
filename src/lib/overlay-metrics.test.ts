import { describe, it, expect } from "@jest/globals";
import { deriveNationalHealthScore, deriveNetTradeBalance } from "./overlay-metrics";

describe("deriveNationalHealthScore", () => {
  it("returns a 0-100 score weighted toward dedicated health metrics when present", () => {
    const score = deriveNationalHealthScore({
      lifeExpectancy: 80,
      literacyRate: 95,
      povertyRate: 10,
      populationWellbeing: 70,
      economicVitality: 60,
      currentGdpPerCapita: 35_000,
    });

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
    // High life expectancy + literacy + low poverty should yield a strong score.
    expect(score).toBeGreaterThan(70);
  });

  it("falls back to GDP/vitality/wellbeing when health metrics are absent", () => {
    const highGdp = deriveNationalHealthScore({
      currentGdpPerCapita: 80_000,
      economicVitality: 80,
      populationWellbeing: 75,
    });
    const lowGdp = deriveNationalHealthScore({
      currentGdpPerCapita: 1_000,
      economicVitality: 10,
      populationWellbeing: 15,
    });

    expect(highGdp).toBeGreaterThan(lowGdp);
    expect(highGdp).toBeGreaterThan(0);
    expect(lowGdp).toBeGreaterThanOrEqual(0);
    expect(highGdp).toBeLessThanOrEqual(100);
    expect(lowGdp).toBeLessThanOrEqual(100);
  });

  it("clamps the result to [0, 100]", () => {
    expect(
      deriveNationalHealthScore({
        lifeExpectancy: 200,
        literacyRate: 150,
        povertyRate: -50,
        populationWellbeing: 200,
        economicVitality: 200,
        currentGdpPerCapita: 1_000_000,
      })
    ).toBe(100);

    expect(
      deriveNationalHealthScore({
        lifeExpectancy: 0,
        literacyRate: 0,
        povertyRate: 200,
        populationWellbeing: 0,
        economicVitality: 0,
        currentGdpPerCapita: 0,
      })
    ).toBe(0);
  });

  it("varies with GDP per capita in the sparse-health fallback", () => {
    const a = deriveNationalHealthScore({ currentGdpPerCapita: 50_000 });
    const b = deriveNationalHealthScore({ currentGdpPerCapita: 5_000 });
    expect(a).toBeGreaterThan(b);
  });
});

describe("deriveNetTradeBalance", () => {
  it("sums tradeBalance1 when country is country1 and subtracts when country is country2", () => {
    const trades = [
      { country1Id: "A", country2Id: "B", tradeBalance1: 100 },
      { country1Id: "C", country2Id: "A", tradeBalance1: 30 },
      { country1Id: "B", country2Id: "C", tradeBalance1: 50 },
    ];

    // A: +100 (as country1) - 30 (as country2 from C-A row) = 70
    expect(deriveNetTradeBalance("A", trades)).toBe(70);
    // B: -100 (as country2 from A-B row) + 50 (as country1) = -50
    expect(deriveNetTradeBalance("B", trades)).toBe(-50);
    // C: -50 (as country2 from B-C row) + 30 (as country1 from C-A row) = -20
    expect(deriveNetTradeBalance("C", trades)).toBe(-20);
  });

  it("falls back to exports when tradeBalance1 is zero or missing", () => {
    const trades = [
      { country1Id: "A", country2Id: "B", exportsFrom1: 200, exportsFrom2: 150, tradeBalance1: 0 },
      { country1Id: "A", country2Id: "C", exportsFrom1: 80, exportsFrom2: 120 },
    ];

    // A as country1: (200 - 150) + (80 - 120) = 50 - 40 = 10
    expect(deriveNetTradeBalance("A", trades)).toBe(10);
    // B as country2: -(200 - 150) = -50
    expect(deriveNetTradeBalance("B", trades)).toBe(-50);
    // C as country2: -(80 - 120) = 40
    expect(deriveNetTradeBalance("C", trades)).toBe(40);
  });

  it("returns 0 when the country has no trade rows", () => {
    expect(deriveNetTradeBalance("X", [])).toBe(0);
  });
});
