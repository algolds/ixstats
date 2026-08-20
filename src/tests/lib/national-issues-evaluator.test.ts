import { describe, it, expect, jest } from "@jest/globals";

// Mock env
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));

import { NationalIssuesEngine } from "~/lib/national-issues";
import type { CountrySnapshot } from "~/lib/national-issues";

const baseSnapshot: CountrySnapshot = {
  id: "country-1",
  name: "Testland",
  leader: "President A",
  governmentType: "republic",
  economicTier: "developed",
  populationTier: "large",
  continent: "Erion",
  region: "North",
  currentPopulation: 1000000,
  currentGdpPerCapita: 20000,
  currentTotalGdp: 20000000000,
  actualGdpGrowth: 3,
  unemploymentRate: 5,
  inflationRate: 2,
  tradeBalance: 0,
  taxRevenueGDPPercent: 20,
  budgetDeficitSurplus: -2,
  totalDebtGDPRatio: 60,
  debtPerCapita: 5000,
  publicApproval: 60,
  povertyRate: 10,
  incomeInequalityGini: 30,
  lifeExpectancy: 75,
  literacyRate: 95,
  urbanPopulationPercent: 60,
  infrastructureRating: 70,
  politicalStability: 65,
  democracyIndex: 70,
  governmentEffectiveness: 60,
  ruleOfLaw: 65,
  corruptionIndex: 30,
  politicalPolarization: 40,
  stabilityScore: 75,
  crimeRate: 5,
  protestFrequency: 5,
  riotRisk: 10,
  socialCohesion: 70,
  ethnicTension: 20,
  trustInGovernment: 50,
  activeEmbassyCount: 3,
  activeAllianceCount: 2,
  activePolicyCount: 5,
  pendingIssueCount: 1,
  recentCrisisCount: 0,
  activeTreatyCount: 1,
  activeComponents: [],
  implementingComponents: [],
  civilServiceCapacity: 100,
  consumedStaff: 50,
  currentIxTime: 1000000,
  currentIxYear: 2030,
  currentIxMonth: 6,
  activePoliciesList: [],
  policySettings: {},
  activeIntents: [],
  activeIntentCategories: [],
};

describe("NationalIssuesEngine.evaluateCondition — Phase 3 ops", () => {
  describe("count", () => {
    it("is true when array length meets the comparison", () => {
      const snapshot = { ...baseSnapshot, partners: [{ name: "A", band: "ALLY", strength: 80 }] };
      expect(
        NationalIssuesEngine.evaluateCondition(
          { count: { field: "partners", op: ">=", value: 1 } },
          snapshot
        )
      ).toBe(true);
    });

    it("is false when array length falls short", () => {
      const snapshot = { ...baseSnapshot, partners: [{ name: "A", band: "ALLY", strength: 80 }] };
      expect(
        NationalIssuesEngine.evaluateCondition(
          { count: { field: "partners", op: ">=", value: 2 } },
          snapshot
        )
      ).toBe(false);
    });

    it("returns false when the field is not an array", () => {
      const snapshot = { ...baseSnapshot, publicApproval: 60 };
      expect(
        NationalIssuesEngine.evaluateCondition(
          { count: { field: "publicApproval", op: ">", value: 0 } },
          snapshot
        )
      ).toBe(false);
    });
  });

  describe("any", () => {
    it("is true when any partner element satisfies the condition", () => {
      const snapshot = {
        ...baseSnapshot,
        partners: [
          { name: "A", band: "NEUTRAL", strength: 40 },
          { name: "B", band: "HOSTILE", strength: 10 },
        ],
      };
      expect(
        NationalIssuesEngine.evaluateCondition(
          {
            any: { field: "partners", condition: { field: "band", op: "==", value: "HOSTILE" } },
          },
          snapshot
        )
      ).toBe(true);
    });

    it("is false when no element satisfies the condition", () => {
      const snapshot = {
        ...baseSnapshot,
        partners: [{ name: "A", band: "NEUTRAL", strength: 40 }],
      };
      expect(
        NationalIssuesEngine.evaluateCondition(
          {
            any: { field: "partners", condition: { field: "band", op: "==", value: "HOSTILE" } },
          },
          snapshot
        )
      ).toBe(false);
    });

    it("supports nested comparison ops (strength threshold)", () => {
      const snapshot = {
        ...baseSnapshot,
        partners: [
          { name: "A", band: "ALLY", strength: 20 },
          { name: "B", band: "ALLY", strength: 90 },
        ],
      };
      expect(
        NationalIssuesEngine.evaluateCondition(
          { any: { field: "partners", condition: { field: "strength", op: ">", value: 80 } } },
          snapshot
        )
      ).toBe(true);
    });

    it("returns false when the field is not an array", () => {
      const snapshot = { ...baseSnapshot, leader: "President A" };
      expect(
        NationalIssuesEngine.evaluateCondition(
          {
            any: { field: "leader", condition: { field: "name", op: "==", value: "x" } },
          },
          snapshot
        )
      ).toBe(false);
    });
  });

  describe("and/or/not composition with new ops", () => {
    it("combines count + any", () => {
      const snapshot = {
        ...baseSnapshot,
        partners: [
          { name: "A", band: "ALLY", strength: 80 },
          { name: "B", band: "HOSTILE", strength: 10 },
        ],
      };
      const condition = {
        and: [
          { count: { field: "partners", op: ">=", value: 2 } },
          { any: { field: "partners", condition: { field: "band", op: "==", value: "ALLY" } } },
        ],
      };
      expect(NationalIssuesEngine.evaluateCondition(condition, snapshot)).toBe(true);
    });
  });
});
