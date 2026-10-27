/** @jest-environment node */
/**
 * Layer (c): readiness P/S/Rc/T, the soft minimum, C-levels and alert levels (research §7.3).
 */
import {
  DAY_MS,
  conditionAfter,
  cLevel,
  effectiveAlert,
  equipmentOnHand,
  maintenanceRequirement,
  omFunding,
  personnelFill,
  readinessScore,
  stepCondition,
  stepTraining,
  trainingAfter,
  trainingCap,
  trainingMax,
} from "~/lib/military/model";

describe("soft-min readiness and C-levels", () => {
  it("is 1 when every area is full and keeps the weakest-link feel", () => {
    expect(readinessScore({ personnel: 1, equipment: 1, condition: 1, training: 1 })).toBeCloseTo(1);
    // One area at 0.5: 0.6 × 0.5 + 0.4 × 0.5^(1/4) = 0.636
    expect(readinessScore({ personnel: 1, equipment: 0.5, condition: 1, training: 1 })).toBeCloseTo(0.636, 3);
    expect(readinessScore({ personnel: 1, equipment: 0, condition: 1, training: 1 })).toBe(0);
  });

  it("bands C-1 ≥ 0.90, C-2 ≥ 0.80, C-3 ≥ 0.70, else C-4", () => {
    expect(cLevel(0.91)).toBe("C-1");
    expect(cLevel(0.85)).toBe("C-2");
    expect(cLevel(0.73)).toBe("C-3");
    expect(cLevel(0.5)).toBe("C-4");
  });
});

describe("personnel fill and equipment on hand", () => {
  it("fills against the larger of funded strength and catalog crews", () => {
    expect(personnelFill(800, 1000, 0)).toBeCloseTo(0.8);
    expect(personnelFill(1000, 1000, 2000)).toBeCloseTo(0.5);
    expect(personnelFill(1500, 1000, 0)).toBe(1);
  });

  it("scores soldiers without equipment low (the conscript horde)", () => {
    const equipped = equipmentOnHand({ domain: "land", capital: 10e9, personnel: 50_000, gdpPerCapita: 20_000, volunteerShare: 1 });
    const horde = equipmentOnHand({ domain: "land", capital: 10e9, personnel: 1_000_000, gdpPerCapita: 20_000, volunteerShare: 0 });
    expect(equipped).toBe(1);
    expect(horde).toBeLessThan(0.3);
  });
});

describe("condition and training dynamics", () => {
  it("recovers condition slowly (0.06/month) and loses it faster (0.10/month)", () => {
    expect(stepCondition(0.5, 1)).toBeCloseTo(0.53);
    expect(stepCondition(1, 0.5)).toBeCloseTo(0.95);
    // ~3 years of backlog to reach 90% from 0.
    expect(conditionAfter(0, 1, 36)).toBeGreaterThan(0.85);
    expect(conditionAfter(0, 1, 24)).toBeLessThan(0.8);
  });

  it("closes 90% of a training gap in 8 months and decays with a 9-month half-life", () => {
    expect(trainingAfter(0, 1, 8)).toBeGreaterThan(0.89);
    expect(trainingAfter(1, 0, 9)).toBeCloseTo(0.5, 6);
  });

  it("matches the stepwise paths in closed form", () => {
    let c = 0.2;
    let t = 0.95;
    for (let k = 0; k < 60; k++) {
      c = stepCondition(c, 0.9);
      t = stepTraining(t, 0.4);
    }
    expect(conditionAfter(0.2, 0.9, 60)).toBeCloseTo(c, 10);
    expect(trainingAfter(0.95, 0.4, 60)).toBeCloseTo(t, 10);
  });

  it("caps training by manpower (conscripts 0.75) and the alert ceiling (peacetime 0.85)", () => {
    expect(trainingMax(0)).toBeCloseTo(0.75);
    expect(trainingCap(1, 1, "peacetime")).toBeCloseTo(0.85);
    expect(trainingCap(1, 1, "war")).toBeCloseTo(1);
    expect(trainingCap(1, 0.5, "war")).toBeCloseTo(0.5);
  });
});

describe("O&M funding", () => {
  it("splits the line in proportion to requirement, the favoured area weighing 1.25", () => {
    expect(omFunding({ omMonthly: 100, maintenanceRequired: 50, trainingRequired: 50, priority: "balanced" })).toEqual({
      maintenance: 1,
      training: 1,
    });
    const favoured = omFunding({ omMonthly: 100, maintenanceRequired: 100, trainingRequired: 100, priority: "training" });
    expect(favoured.training).toBeGreaterThan(favoured.maintenance);
  });

  it("scales the maintenance bill with capital, alert and wear (the hollow giant pays upkeep)", () => {
    expect(maintenanceRequirement(12e9, "peacetime", 1)).toBeCloseTo(0.06e9);
    expect(maintenanceRequirement(12e9, "war", 3)).toBeCloseTo(0.06e9 * 2 * 3);
  });
});

describe("alert levels (exploit 1: alert flipping before an attack)", () => {
  const ordered = (alertLevel: "elevated" | "war" | "peacetime", previousAlertLevel: "peacetime" | "war") => ({
    alertLevel,
    previousAlertLevel,
    alertChangedClockMs: 0,
  });

  it("raises take 7 (Elevated) to 30 (War) days to bite", () => {
    expect(effectiveAlert(ordered("elevated", "peacetime"), 6 * DAY_MS)).toBe("peacetime");
    expect(effectiveAlert(ordered("elevated", "peacetime"), 7 * DAY_MS)).toBe("elevated");
    expect(effectiveAlert(ordered("war", "peacetime"), 29 * DAY_MS)).toBe("peacetime");
    expect(effectiveAlert(ordered("war", "peacetime"), 30 * DAY_MS)).toBe("war");
  });

  it("lowers at once", () => {
    expect(effectiveAlert(ordered("peacetime", "war"), 0)).toBe("peacetime");
  });
});
