/** @jest-environment node */
/**
 * Research §7.7 and §7.6: crowd-out above 2% approaching the research's level through a level effect, R&D spillover
 * above the default, the labour hit, the collapse hazard band, war damage scale, casualties off population, and the
 * damped Richardson step's stability.
 */
import { levelPhaseIn } from "~/lib/economy/calculations";
import {
  CROWD_OUT_PHASE_YEARS,
  FEEDBACK_KEYS,
  RD_BASELINE_GDP_SHARE,
  collapseHazard,
  crowdOutLevel,
  defenseFeedbackTargets,
  labourLevel,
  populationLevel,
  rdSpilloverLevel,
  warDamageLevels,
  warIntensity,
} from "~/lib/military/economy/feedback";
import {
  NPC_BURDEN_CEILING,
  intentOf,
  richardsonAfter,
  richardsonEquilibrium,
  threatOf,
} from "~/lib/military/economy/richardson";

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

describe("crowding out", () => {
  it("costs nothing up to 2% and −0.15 ln(m / 2%) in the long run above it", () => {
    expect(crowdOutLevel(0.01)).toBe(0);
    expect(crowdOutLevel(0.02)).toBe(0);
    expect(Math.log(1 + crowdOutLevel(0.04))).toBeCloseTo(-0.104, 3);
    expect(Math.log(1 + crowdOutLevel(0.1))).toBeCloseTo(-0.241, 3);
  });

  it("at 4% for ten years the projected GDP sits near the research's −2.9%", () => {
    const [crowd] = defenseFeedbackTargets({
      countryId: "c",
      burden: 0.04,
      rdStock: 0,
      gdp: 1e12,
      mobilised: 0,
      conscripts: 0,
      population: 1e7,
    });
    expect(crowd).toMatchObject({ createdBy: FEEDBACK_KEYS.crowdOut, inputType: "gdp_level_adjustment" });
    expect(crowd!.duration).toBeCloseTo(CROWD_OUT_PHASE_YEARS, 9);
    // The projection applies value × phase-in (calculations.ts applySpecialModifiers).
    const tenYears = crowd!.value * levelPhaseIn({ ixTimeTimestamp: 0, duration: crowd!.duration }, 10 * YEAR_MS);
    expect(tenYears).toBeGreaterThan(-0.036);
    expect(tenYears).toBeLessThan(-0.026);
  });

  it("leaves out levels at zero, so a nation back at 2% ends its keyed level", () => {
    expect(
      defenseFeedbackTargets({
        countryId: "c",
        burden: 0.02,
        rdStock: RD_BASELINE_GDP_SHARE * 1e12,
        gdp: 1e12,
        mobilised: 0,
        conscripts: 0,
        population: 1e7,
      })
    ).toEqual([]);
  });
});

describe("R&D spillover and labour", () => {
  it("rises with R&D above the default nation's and is never negative", () => {
    expect(rdSpilloverLevel(RD_BASELINE_GDP_SHARE * 1e12, 1e12)).toBeCloseTo(0, 9);
    expect(rdSpilloverLevel(0, 1e12)).toBe(0);
    expect(rdSpilloverLevel(4 * RD_BASELINE_GDP_SHARE * 1e12, 1e12)).toBeGreaterThan(0.01);
  });

  it("withdraws mobilised reservists and half of conscripts from the labour force", () => {
    // 390k mobilised from a labour force of 39M: −0.6 × 1%.
    expect(labourLevel({ mobilised: 390_000, conscripts: 0, population: 1e8 })).toBeCloseTo(-0.006, 9);
    expect(labourLevel({ mobilised: 0, conscripts: 780_000, population: 1e8 })).toBeCloseTo(-0.006, 9);
  });
});

describe("burden collapse", () => {
  it("has no hazard to 50%, rises quadratically to 2% a month at 75%", () => {
    expect(collapseHazard(0.5)).toBe(0);
    expect(collapseHazard(0.625)).toBeCloseTo(0.005, 9);
    expect(collapseHazard(0.75)).toBeCloseTo(0.02, 9);
    expect(collapseHazard(0.9)).toBeCloseTo(0.02, 9);
  });
});

describe("war damage and casualties", () => {
  it("approaches −30% at home and −10% for neighbours after five years of full-intensity war", () => {
    expect(warDamageLevels(1, 5 * 365.25)).toEqual({ home: -0.3, neighbour: -0.1 });
    const fortnight = warDamageLevels(1, 14);
    expect(fortnight.home).toBeCloseTo((-0.3 * 14) / (5 * 365.25), 9);
    expect(warDamageLevels(0.5, 14).home).toBeCloseTo(fortnight.home / 2, 9);
  });

  it("scales intensity by the forces engaged against the defender's population", () => {
    expect(warIntensity(250_000, 1e8)).toBeCloseTo(0.5, 9);
    expect(warIntensity(5e6, 1e8)).toBe(1);
  });

  it("removes deaths from population as a level", () => {
    expect(populationLevel(10_000, 1e7)).toBeCloseTo(-0.001, 9);
  });
});

describe("NPC Richardson step", () => {
  it("settles where the threat gain meets the damping, and is stable from any start", () => {
    const star = richardsonEquilibrium(0.5, 0);
    expect(star).toBeCloseTo(0.2, 9);
    for (const start of [-0.02, 0, 0.3]) {
      const after = richardsonAfter({ current: start, baseBurden: 0.03, threatSum: 0.5, grievance: 0, years: 40 });
      expect(after).toBeCloseTo(star, 3);
    }
  });

  it("two NPCs threatening each other stay bounded (0.10 < 0.25)", () => {
    let a = 0;
    let b = 0;
    const base = 0.03;
    for (let year = 0; year < 200; year++) {
      const threatA = threatOf({ projected: base + b, own: base + a, intent: 0.5 });
      const threatB = threatOf({ projected: base + a, own: base + b, intent: 0.5 });
      [a, b] = [
        richardsonAfter({ current: a, baseBurden: base, threatSum: threatA, grievance: 0, years: 1 }),
        richardsonAfter({ current: b, baseBurden: base, threatSum: threatB, grievance: 0, years: 1 }),
      ];
    }
    expect(base + a).toBeLessThan(NPC_BURDEN_CEILING);
    expect(a).toBeCloseTo(b, 6);
    expect(Number.isFinite(a)).toBe(true);
  });

  it("intent rises with hostility, conflict and a war alert", () => {
    const calm = intentOf({ relationStrength: 90, inConflict: false, hostileActs: 0, alert: "peacetime", mobilising: false });
    const hot = intentOf({ relationStrength: 10, inConflict: true, hostileActs: 1, alert: "war", mobilising: true });
    expect(calm).toBeCloseTo(0.05, 9);
    expect(hot).toBe(1);
  });
});
