/** @jest-environment node */
/**
 * Layer (d): combat power CP_b = R × CEV × Q̄ × A × (K/k_ref)^α × N^(1−α) (research §7.4).
 */
import {
  DOMAIN_PARAMS,
  branchQuality,
  combatEffectiveness,
  combatPower,
  designQuality,
  enablerFactor,
  frontierLag,
  genericQuality,
  RD_REFERENCE_GDP_SHARE,
} from "~/lib/military/model";

const cp = (overrides: Partial<Parameters<typeof combatPower>[0]> = {}) =>
  combatPower({
    domain: "land",
    readiness: 1,
    cev: 1,
    quality: 1,
    enabler: 1,
    capital: 50_000 * DOMAIN_PARAMS.land.capitalPerMemberRef,
    personnel: 50_000,
    ...overrides,
  });

describe("combat power", () => {
  it("scores a fully equipped branch at about its headcount", () => {
    expect(cp()).toBeCloseTo(50_000, 0);
  });

  it("is sub-linear in each factor (no blob stacking) and zero without people or capital", () => {
    expect(cp({ personnel: 100_000 }) / cp()).toBeCloseTo(Math.pow(2, 0.55), 6);
    expect(cp({ capital: 2 * 50_000 * DOMAIN_PARAMS.land.capitalPerMemberRef }) / cp()).toBeCloseTo(
      Math.pow(2, 0.45),
      6
    );
    expect(cp({ personnel: 0 })).toBe(0);
    expect(cp({ capital: 0 })).toBe(0);
  });

  it("multiplies by readiness, so unfunded O&M shows at once (paper strength)", () => {
    expect(cp({ readiness: 0.5 })).toBeCloseTo(cp() / 2);
  });

  it("weights capital far more in air and sea (α 0.8) than on land (α 0.45)", () => {
    const air = (capital: number) =>
      combatPower({ domain: "air", readiness: 1, cev: 1, quality: 1, enabler: 1, capital, personnel: 10_000 });
    const land = (capital: number) =>
      combatPower({ domain: "land", readiness: 1, cev: 1, quality: 1, enabler: 1, capital, personnel: 10_000 });
    expect(air(2e10) / air(1e10)).toBeGreaterThan(land(2e10) / land(1e10));
  });
});

describe("CEV", () => {
  it("rises gently with GDP per capita against the realm median and is clamped to 0.6–1.5", () => {
    expect(combatEffectiveness(20_000, 20_000, "balanced")).toBeCloseTo(1);
    expect(combatEffectiveness(80_000, 20_000, "balanced")).toBeCloseTo(Math.pow(4, 0.12));
    expect(combatEffectiveness(1e9, 1, "balanced")).toBe(1.5);
    expect(combatEffectiveness(1, 1e9, "balanced")).toBe(0.6);
  });
});

describe("quality against the frontier (exploit 5: obsolete bulk)", () => {
  it("decays 3% a year of design age", () => {
    expect(designQuality(2030, 2030)).toBe(1);
    expect(designQuality(2040, 2030)).toBe(1);
    expect(designQuality(2020, 2030)).toBeCloseTo(Math.exp(-0.3));
    expect(designQuality(1975, 2030)).toBeLessThan(0.2);
  });

  it("weights catalog assets by value and treats the rest of K as uncatalogued", () => {
    const q = branchQuality({
      capital: 200,
      assets: [{ quantity: 1, unitRealValue: 100, designYear: 2030 }],
      frontierYear: 2030,
      lagYears: 0,
    });
    expect(q).toBeCloseTo((100 * 1 + 100 * 0.8) / 200);
  });

  it("lags the frontier without R&D and keeps up with the reference stock", () => {
    expect(frontierLag(0, 1e12)).toBe(10);
    expect(frontierLag(RD_REFERENCE_GDP_SHARE * 1e12, 1e12)).toBe(0);
    expect(genericQuality(10)).toBeLessThan(genericQuality(0));
  });
});

describe("enablers", () => {
  const sam = { subcategory: "air_defense", role: null, quantity: 1, unitRealValue: 1e9 };

  it("covers uncatalogued capital itself and penalises a catalogued army without air defense", () => {
    expect(enablerFactor({ domain: "land", capital: 10e9, branchAssets: [], nationAssets: [] })).toBe(1);
    const tanks = [{ subcategory: "tank", role: null, quantity: 100, unitRealValue: 1e8 }];
    expect(enablerFactor({ domain: "land", capital: 10e9, branchAssets: tanks, nationAssets: tanks })).toBeCloseTo(0.85);
  });

  it("needs enabler value against 5% of capital, so one token system does not lift a large force", () => {
    const tanks = [{ subcategory: "tank", role: null, quantity: 1000, unitRealValue: 1e8 }];
    const token = enablerFactor({ domain: "land", capital: 100e9, branchAssets: tanks, nationAssets: [...tanks, sam] });
    const full = enablerFactor({
      domain: "land",
      capital: 100e9,
      branchAssets: tanks,
      nationAssets: [...tanks, { ...sam, quantity: 5 }],
    });
    expect(token).toBeLessThan(0.9);
    expect(full).toBe(1);
  });
});
