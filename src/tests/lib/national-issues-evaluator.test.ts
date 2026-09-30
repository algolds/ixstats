import { describe, expect, it } from "@jest/globals";
import {
  evaluateTriggerCondition,
  type TriggerCondition,
} from "~/lib/national-issues/evaluators/condition-evaluator";
import { substituteVariables } from "~/lib/national-issues/evaluators/issue-generator";
import type { CountrySnapshot } from "~/lib/national-issues/engine";

describe("National Issues Condition Evaluator", () => {
  const mockSnapshot: CountrySnapshot = {
    id: "c-1",
    name: "Aethelgard",
    leader: "High Chancellor Vane",
    governmentType: "Constitutional Republic",
    economicTier: "Developed",
    populationTier: "Medium",
    continent: "Oriente",
    region: "Northern Coast",
    currentPopulation: 45000000,
    currentGdpPerCapita: 42000,
    currentTotalGdp: 1890000000000,
    actualGdpGrowth: 2.5,
    unemploymentRate: 4.8,
    inflationRate: 2.1,
    tradeBalance: 15000000000,
    taxRevenueGDPPercent: 28.5,
    budgetDeficitSurplus: -5000000000,
    totalDebtGDPRatio: 45.2,
    debtPerCapita: 19000,
    publicApproval: 68.4,
    povertyRate: 8.2,
    incomeInequalityGini: 32.5,
    lifeExpectancy: 81.2,
    literacyRate: 99.1,
    urbanPopulationPercent: 78.4,
    infrastructureRating: 84.5,
    politicalStability: 75.0,
    democracyIndex: 82.0,
    governmentEffectiveness: 80.0,
    ruleOfLaw: 85.0,
    corruptionIndex: 18.0,
    politicalPolarization: 35.0,
    stabilityScore: 78.0,
    crimeRate: 22.0,
    protestFrequency: 10.0,
    riotRisk: 5.0,
    socialCohesion: 72.0,
    ethnicTension: 15.0,
    trustInGovernment: 64.0,
    activeEmbassyCount: 12,
    activeAllianceCount: 3,
    activePolicyCount: 15,
    pendingIssueCount: 2,
    recentCrisisCount: 0,
    activeTreatyCount: 5,
    currentIxYear: 2026,
    currentIxMonth: 8,
    currentIxTime: 1772412800000,
    civilServiceCapacity: 2500,
    consumedStaff: 1800,
    activeComponents: ["comp-1", "comp-2", "comp-3"],
    implementingComponents: ["comp-4"],
    activePoliciesList: ["tax_reform_policy"],
    policySettings: {},
    activeIntents: ["intent-1"],
    activeIntentCategories: ["economy", "defense"],
    activeIntentGoals: ["economic_growth", "border_security"],
    partners: [
      { name: "Nordland", band: "ALLY", strength: 80 },
      { name: "Valeria", band: "HOSTILE", strength: 70 },
    ],
    neighbors: [{ name: "Nordland", countryId: "c-2" }],
  };

  describe("Scalar comparison operators", () => {
    it("evaluates > correctly", () => {
      const condition: TriggerCondition = { field: "currentPopulation", op: ">", value: 40000000 };
      expect(evaluateTriggerCondition(condition, mockSnapshot)).toBe(true);

      const falseCond: TriggerCondition = { field: "currentPopulation", op: ">", value: 50000000 };
      expect(evaluateTriggerCondition(falseCond, mockSnapshot)).toBe(false);
    });

    it("evaluates >= and <= correctly", () => {
      const gteCond: TriggerCondition = { field: "unemploymentRate", op: ">=", value: 4.8 };
      expect(evaluateTriggerCondition(gteCond, mockSnapshot)).toBe(true);

      const lteCond: TriggerCondition = { field: "unemploymentRate", op: "<=", value: 4.8 };
      expect(evaluateTriggerCondition(lteCond, mockSnapshot)).toBe(true);
    });

    it("evaluates < correctly", () => {
      const ltCond: TriggerCondition = { field: "inflationRate", op: "<", value: 3.0 };
      expect(evaluateTriggerCondition(ltCond, mockSnapshot)).toBe(true);
    });

    it("evaluates == and != correctly", () => {
      const eqCond: TriggerCondition = { field: "economicTier", op: "==", value: "Developed" };
      expect(evaluateTriggerCondition(eqCond, mockSnapshot)).toBe(true);

      const neqCond: TriggerCondition = { field: "economicTier", op: "!=", value: "Developing" };
      expect(evaluateTriggerCondition(neqCond, mockSnapshot)).toBe(true);
    });

    it("evaluates 'in' correctly for scalar field against array target", () => {
      const inCond: TriggerCondition = {
        field: "economicTier",
        op: "in",
        value: ["Developed", "Advanced"],
      };
      expect(evaluateTriggerCondition(inCond, mockSnapshot)).toBe(true);

      const notInCond: TriggerCondition = {
        field: "economicTier",
        op: "in",
        value: ["Underdeveloped", "Developing"],
      };
      expect(evaluateTriggerCondition(notInCond, mockSnapshot)).toBe(false);
    });

    it("evaluates 'between' correctly", () => {
      const betweenCond: TriggerCondition = {
        field: "actualGdpGrowth",
        op: "between",
        value: 1.0,
        value2: 4.0,
      };
      expect(evaluateTriggerCondition(betweenCond, mockSnapshot)).toBe(true);

      const outsideCond: TriggerCondition = {
        field: "actualGdpGrowth",
        op: "between",
        value: 3.0,
        value2: 6.0,
      };
      expect(evaluateTriggerCondition(outsideCond, mockSnapshot)).toBe(false);
    });
  });

  describe("Array field membership and aggregations", () => {
    it("checks array membership with '==' and 'in'", () => {
      const arrayContains: TriggerCondition = {
        field: "activeComponents",
        op: "==",
        value: "comp-2",
      };
      expect(evaluateTriggerCondition(arrayContains, mockSnapshot)).toBe(true);

      const arrayAbsence: TriggerCondition = {
        field: "activeComponents",
        op: "!=",
        value: "comp-99",
      };
      expect(evaluateTriggerCondition(arrayAbsence, mockSnapshot)).toBe(true);
    });

    it("evaluates count aggregator on array fields", () => {
      const countCond: TriggerCondition = {
        count: { field: "activeComponents", op: ">=", value: 3 },
      };
      expect(evaluateTriggerCondition(countCond, mockSnapshot)).toBe(true);

      const countFail: TriggerCondition = {
        count: { field: "activeComponents", op: ">", value: 5 },
      };
      expect(evaluateTriggerCondition(countFail, mockSnapshot)).toBe(false);
    });

    it("evaluates 'any' recursion on array of objects", () => {
      const anyHostile: TriggerCondition = {
        any: {
          field: "partners",
          condition: { field: "band", op: "==", value: "HOSTILE" },
        },
      };
      expect(evaluateTriggerCondition(anyHostile, mockSnapshot)).toBe(true);

      const anyVassal: TriggerCondition = {
        any: {
          field: "partners",
          condition: { field: "band", op: "==", value: "VASSAL" },
        },
      };
      expect(evaluateTriggerCondition(anyVassal, mockSnapshot)).toBe(false);
    });
  });

  describe("Logical operators (and, or, not)", () => {
    it("evaluates 'and' with all conditions passing", () => {
      const andCond: TriggerCondition = {
        and: [
          { field: "publicApproval", op: ">", value: 50 },
          { field: "democracyIndex", op: ">", value: 70 },
        ],
      };
      expect(evaluateTriggerCondition(andCond, mockSnapshot)).toBe(true);
    });

    it("evaluates 'or' with at least one passing", () => {
      const orCond: TriggerCondition = {
        or: [
          { field: "publicApproval", op: "<", value: 20 },
          { field: "democracyIndex", op: ">", value: 70 },
        ],
      };
      expect(evaluateTriggerCondition(orCond, mockSnapshot)).toBe(true);
    });

    it("evaluates 'not' inversion", () => {
      const notCond: TriggerCondition = {
        not: { field: "publicApproval", op: "<", value: 50 },
      };
      expect(evaluateTriggerCondition(notCond, mockSnapshot)).toBe(true);
    });
  });

  describe("Variable substitution", () => {
    it("substitutes built-in country variables", () => {
      const template = "{{countryName}} is governed by {{leaderName}} under a {{governmentType}}.";
      const rendered = substituteVariables(template, mockSnapshot);
      expect(rendered).toBe("Aethelgard is governed by High Chancellor Vane under a Constitutional Republic.");
    });

    it("substitutes grounded relationships and intent goals", () => {
      const template = "Relations with {{allyName}} flourish while {{rivalName}} poses border friction.";
      const rendered = substituteVariables(template, mockSnapshot);
      expect(rendered).toBe("Relations with Nordland flourish while Valeria poses border friction.");
    });

    it("accepts override extra variables", () => {
      const template = "Target state {{targetCountryName}} has approached {{countryName}}.";
      const rendered = substituteVariables(template, mockSnapshot, { targetCountryName: "Zandaria" });
      expect(rendered).toBe("Target state Zandaria has approached Aethelgard.");
    });
  });
});
