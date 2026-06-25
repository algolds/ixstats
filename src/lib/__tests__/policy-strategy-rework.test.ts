import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock env and dependencies
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  db: { systemLog: { create: jest.fn(() => Promise.resolve()) } },
}));
jest.mock("~/lib/notification-api", () => ({
  notificationAPI: { create: jest.fn(() => Promise.resolve("note_1")) },
}));
jest.mock("~/lib/country-event-spine", () => ({
  CountryEventSpine: { recordCountryEvent: jest.fn(() => Promise.resolve()) },
}));
jest.mock("~/lib/diplomatic-news-generator", () => ({
  generateDiplomaticNews: jest.fn(() => Promise.resolve()),
}));
jest.mock("~/lib/activity-hooks", () => ({
  ActivityHooks: {
    Economic: {
      onTaxPolicyChange: jest.fn(() => Promise.resolve()),
    },
  },
}));

import { PREDEFINED_DECRETALS } from "../policies/registry";
import { NationalIssuesEngine, type CountrySnapshot } from "../national-issues-engine";
import { createCallerFactory } from "../../server/api/trpc";
import { policiesRouter } from "../../server/api/routers/policies";

type MockFn = any;

const mockDb = {
  policy: {
    create: jest.fn() as MockFn,
    update: jest.fn() as MockFn,
    findMany: jest.fn() as MockFn,
    findUnique: jest.fn() as MockFn,
  },
  governmentStructure: {
    findUnique: jest.fn() as MockFn,
    update: jest.fn() as MockFn,
  },
  cabinetMeeting: {
    create: jest.fn() as MockFn,
  },
  meetingDecision: {
    create: jest.fn() as MockFn,
  },
  meetingActionItem: {
    create: jest.fn() as MockFn,
  },
  user: {
    findFirst: jest.fn() as MockFn,
    findUnique: jest.fn() as MockFn,
  },
  country: {
    findUnique: jest.fn() as MockFn,
  },
  storytellerEffect: {
    create: jest.fn() as MockFn,
    updateMany: jest.fn() as MockFn,
  },
  systemLog: {
    create: jest.fn() as MockFn,
  },
  $transaction: jest.fn((callback: any) => callback(mockDb)) as MockFn,
};

const baseContext = {
  db: mockDb,
  user: { clerkUserId: "user_1", countryId: "country_1" },
  auth: { userId: "user_1" },
} as any;

describe("Policy Strategy Rework - Unit & Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Predefined Policy Registry & Formulas", () => {
    it("calculates UBI settings correctly", () => {
      const ubi = PREDEFINED_DECRETALS["universal-basic-income"];
      expect(ubi).toBeDefined();

      const pop = 2000000;
      const metrics = { currentPopulation: pop };

      // Inactive stipend
      const resultsInactive = ubi.calculate({ stipend: 0, funding: 0 }, metrics);
      expect(resultsInactive.implementationCost).toBe(0);
      expect(resultsInactive.maintenanceCost).toBe(0);
      expect(resultsInactive.gdpEffect).toBe(0);

      // Active stipend + VAT funding model
      const resultsActive = ubi.calculate({ stipend: 2, funding: 1 }, metrics);
      // stipend rate: 800. maintenance cost: 800 * 2,000,000 = 1,600,000,000.
      expect(resultsActive.maintenanceCost).toBe(1600000000);
      expect(resultsActive.implementationCost).toBe(1600000000 * 0.05);
      // gdpEffect: stipendVal(2) * 0.8 - stipendVal(2) * 0.2 = 1.2
      expect(resultsActive.gdpEffect).toBeCloseTo(1.2);
    });

    it("calculates border tariffs settings correctly", () => {
      const tariffs = PREDEFINED_DECRETALS["border-tariffs"];
      expect(tariffs).toBeDefined();

      // Free trade (rate 0)
      const resultsFree = tariffs.calculate({ tariffRate: 0, exceptions: 0 }, {});
      expect(resultsFree.gdpEffect).toBe(1.5);
      expect(resultsFree.employmentEffect).toBe(0.5);

      // High tariffs with allied exceptions
      const resultsProtected = tariffs.calculate({ tariffRate: 3, exceptions: 1 }, {});
      // gdpEffect: -rate * 0.8 + rate * 0.2 = -3 * 0.8 + 3 * 0.2 = -2.4 + 0.6 = -1.8
      expect(resultsProtected.gdpEffect).toBeCloseTo(-1.8);
      // taxRevenueEffect: rate * 2.0 - rate * 0.3 = 3 * 2.0 - 3 * 0.3 = 6.0 - 0.9 = 5.1
      expect(resultsProtected.taxRevenueEffect).toBeCloseTo(5.1);
    });

    it("calculates surveillance oversight settings correctly", () => {
      const surveillance = PREDEFINED_DECRETALS["surveillance-oversight"];
      expect(surveillance).toBeDefined();

      // None (0)
      const resultsNone = surveillance.calculate({ surveillance: 0 }, {});
      expect(resultsNone.stabilityEffect).toBe(1.0);
      expect(resultsNone.implementationCost).toBe(0);

      // Maximum metadata tracking (3)
      const resultsMax = surveillance.calculate({ surveillance: 3 }, {});
      expect(resultsMax.implementationCost).toBe(30000000);
      expect(resultsMax.maintenanceCost).toBe(6000000);
      expect(resultsMax.stabilityEffect).toBeCloseTo(-2.4);
    });
  });

  describe("2. National Issues Engine dotted-path evaluations", () => {
    const dummySnapshot = {
      id: "country_1",
      name: "Testland",
      activePoliciesList: ["universal-basic-income", "border-tariffs"],
      policySettings: {
        "universal-basic-income": {
          stipend: 2,
          funding: 1,
        },
        "border-tariffs": {
          tariffRate: 3,
        },
      },
    } as unknown as CountrySnapshot;

    it("evaluates true condition when dotted-notation value matches", () => {
      const condition = {
        field: "policySettings.universal-basic-income.stipend",
        op: "==",
        value: 2,
      } as any;

      const res = NationalIssuesEngine.evaluateCondition(condition, dummySnapshot);
      expect(res).toBe(true);
    });

    it("evaluates false condition when dotted-notation value doesn't match", () => {
      const condition = {
        field: "policySettings.universal-basic-income.stipend",
        op: ">",
        value: 2,
      } as any;

      const res = NationalIssuesEngine.evaluateCondition(condition, dummySnapshot);
      expect(res).toBe(false);
    });

    it("handles missing settings or nested paths gracefully", () => {
      const condition = {
        field: "policySettings.surveillance-oversight.surveillance",
        op: "==",
        value: 0,
      } as any;

      const res = NationalIssuesEngine.evaluateCondition(condition, dummySnapshot);
      expect(res).toBe(false); // field value is null/undefined
    });
  });

  describe("3. Policy Activation Transaction and Cabinet Integration", () => {
    it("deducts budget and creates cabinet meeting, decision, and action item", async () => {
      const policyRecord = {
        id: "policy_1",
        countryId: "country_1",
        name: "Universal Basic Income Act",
        category: "fiscal",
        status: "draft",
        priority: "high",
        implementationCost: 500000,
        maintenanceCost: 100000,
        gdpEffect: 1.2,
        employmentEffect: -0.8,
        inflationEffect: 1.5,
      };

      const structureRecord = {
        countryId: "country_1",
        totalBudget: 1000000,
      };

      mockDb.policy.findUnique.mockResolvedValue(policyRecord);
      mockDb.governmentStructure.findUnique.mockResolvedValue(structureRecord);
      mockDb.cabinetMeeting.create.mockResolvedValue({ id: "meeting_1" });
      mockDb.meetingDecision.create.mockResolvedValue({ id: "decision_1" });
      mockDb.meetingActionItem.create.mockResolvedValue({ id: "action_1" });
      mockDb.policy.update.mockResolvedValue({ ...policyRecord, status: "active" });
      mockDb.storytellerEffect.create.mockResolvedValue({ id: "effect_1" });
      mockDb.storytellerEffect.updateMany.mockResolvedValue({ count: 1 });
      mockDb.user.findFirst.mockResolvedValue({ clerkUserId: "user_1" });
      mockDb.country.findUnique.mockResolvedValue({ name: "Testland" });

      const caller = createCallerFactory(policiesRouter)(baseContext);

      const updated = await caller.activatePolicy({ id: "policy_1" });

      expect(updated.status).toBe("active");
      expect(mockDb.governmentStructure.update).toHaveBeenCalledWith({
        where: { countryId: "country_1" },
        data: {
          totalBudget: { decrement: 500000 },
        },
      });
      expect(mockDb.cabinetMeeting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Cabinet Session: Enactment of Universal Basic Income Act",
            status: "completed",
          }),
        })
      );
      expect(mockDb.meetingDecision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Enactment of Universal Basic Income Act",
            relatedPolicyId: "policy_1",
          }),
        })
      );
      expect(mockDb.meetingActionItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Oversee rollout of Universal Basic Income Act",
            assignedTo: "Minister of Finance",
            status: "pending",
          }),
        })
      );
    });
  });
});
