import { describe, expect, it } from "@jest/globals";
import {
  evaluateTriggerCondition,
  type TriggerCondition,
} from "~/lib/national-issues/evaluators/condition-evaluator";
import { substituteVariables } from "~/lib/national-issues/evaluators/issue-generator";
import type { CountrySnapshot } from "~/lib/national-issues/engine";
import { growthDecimalToPercent } from "~/lib/national-issues/country-snapshot";

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
    policySettings: { "universal-basic-income": { stipend: 2, funding: 1 } },
    activeIntents: ["intent-1"],
    activeIntentCategories: ["economy", "defense"],
    activeIntentGoals: ["economic_growth", "border_security"],
    partners: [
      { name: "Nordland", band: "ALLY", strength: 80 },
      { name: "Valeria", band: "HOSTILE", strength: 70 },
    ],
    neighbors: [{ name: "Nordland", countryId: "c-2" }],
  };

  const cases: Array<[string, TriggerCondition, boolean]> = [
    [">", { field: "currentPopulation", op: ">", value: 40_000_000 }, true],
    ["> (false)", { field: "currentPopulation", op: ">", value: 50_000_000 }, false],
    [">= at the value", { field: "unemploymentRate", op: ">=", value: 4.8 }, true],
    ["<= at the value", { field: "unemploymentRate", op: "<=", value: 4.8 }, true],
    ["<", { field: "inflationRate", op: "<", value: 3.0 }, true],
    ["==", { field: "economicTier", op: "==", value: "Developed" }, true],
    ["!=", { field: "economicTier", op: "!=", value: "Developing" }, true],
    ["in", { field: "economicTier", op: "in", value: ["Developed", "Advanced"] }, true],
    ["in (false)", { field: "economicTier", op: "in", value: ["Developing"] }, false],
    ["between", { field: "actualGdpGrowth", op: "between", value: 1.0, value2: 4.0 }, true],
    ["between (outside)", { field: "actualGdpGrowth", op: "between", value: 3, value2: 6 }, false],
    ["array == is membership", { field: "activeComponents", op: "==", value: "comp-2" }, true],
    ["array != is absence", { field: "activeComponents", op: "!=", value: "comp-99" }, true],
    ["count", { count: { field: "activeComponents", op: ">=", value: 3 } }, true],
    ["count (false)", { count: { field: "activeComponents", op: ">", value: 5 } }, false],
    [
      "any over objects",
      { any: { field: "partners", condition: { field: "band", op: "==", value: "HOSTILE" } } },
      true,
    ],
    [
      "any (none match)",
      { any: { field: "partners", condition: { field: "band", op: "==", value: "VASSAL" } } },
      false,
    ],
    [
      "and",
      {
        and: [
          { field: "publicApproval", op: ">", value: 50 },
          { field: "democracyIndex", op: ">", value: 70 },
        ],
      },
      true,
    ],
    [
      "or",
      {
        or: [
          { field: "publicApproval", op: "<", value: 20 },
          { field: "democracyIndex", op: ">", value: 70 },
        ],
      },
      true,
    ],
    ["not", { not: { field: "publicApproval", op: "<", value: 50 } }, true],
    [
      "a dotted policy setting",
      { field: "policySettings.universal-basic-income.stipend", op: "==", value: 2 },
      true,
    ],
    [
      "a missing dotted path",
      { field: "policySettings.surveillance-oversight.surveillance", op: "==", value: 0 },
      false,
    ],
  ];

  it.each(cases)("evaluates %s", (_label, condition, expected) => {
    expect(evaluateTriggerCondition(condition, mockSnapshot)).toBe(expected);
  });

  it.each([
    [
      "{{countryName}} is governed by {{leaderName}} under a {{governmentType}}.",
      undefined,
      "Aethelgard is governed by High Chancellor Vane under a Constitutional Republic.",
    ],
    [
      "Relations with {{allyName}} flourish while {{rivalName}} poses border friction.",
      undefined,
      "Relations with Nordland flourish while Valeria poses border friction.",
    ],
    [
      "Target state {{targetCountryName}} has approached {{countryName}}.",
      { targetCountryName: "Zandaria" },
      "Target state Zandaria has approached Aethelgard.",
    ],
  ])("renders %p", (template, extra, rendered) => {
    expect(substituteVariables(template, mockSnapshot, extra)).toBe(rendered);
  });

  describe("GDP growth units (#49)", () => {
    // Country.actualGdpGrowth is stored as a decimal; templates compare it in percent.
    const withStoredGrowth = (stored: number): CountrySnapshot => ({
      ...mockSnapshot,
      actualGdpGrowth: growthDecimalToPercent(stored),
    });
    const boom: TriggerCondition = { field: "actualGdpGrowth", op: ">", value: 3 };
    const slump: TriggerCondition = { field: "actualGdpGrowth", op: "<", value: 0.5 };

    it("fires a percent threshold on a stored decimal growth rate", () => {
      expect(evaluateTriggerCondition(boom, withStoredGrowth(0.035))).toBe(true);
      expect(evaluateTriggerCondition(boom, withStoredGrowth(0.02))).toBe(false);
      // 2% growth is not a slump; compared raw (0.02 < 0.5) it used to be.
      expect(evaluateTriggerCondition(slump, withStoredGrowth(0.02))).toBe(false);
      expect(evaluateTriggerCondition(slump, withStoredGrowth(0.003))).toBe(true);
    });

    it("renders {{gdpGrowth}} in percent", () => {
      expect(substituteVariables("{{gdpGrowth}}", withStoredGrowth(0.035))).toBe("3.5%");
    });
  });
});
