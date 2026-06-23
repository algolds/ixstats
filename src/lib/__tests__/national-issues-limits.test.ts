import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock env
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));

// Mock configuration storage
const mockConfig = {
  maxIssuesPerSession: 3,
  maxIssuesPerWeek: 5,
};
jest.mock("~/lib/national-issues-config", () => ({
  getNationalIssuesConfig: () => mockConfig,
}));

import { NationalIssuesEngine } from "../national-issues-engine";
import { IxTime } from "../ixtime";

const mockDb: any = {
  nationalIssue: {
    count: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  issueGenerationLog: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  nationalIssueTemplate: {
    findMany: jest.fn(),
  },
  country: {
    findUnique: jest.fn(),
  },
  embassy: {
    count: jest.fn(),
  },
  policy: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  crisisEvent: {
    count: jest.fn(),
  },
  governmentComponent: {
    findMany: jest.fn(),
  },
  economicComponent: {
    findMany: jest.fn(),
  },
  taxComponent: {
    findMany: jest.fn(),
  },
  nPCPersonalityAssignment: {
    findUnique: jest.fn(),
  },
};

describe("National Issues Engine Limits - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig.maxIssuesPerSession = 3;
    mockConfig.maxIssuesPerWeek = 5;

    mockDb.embassy.count.mockResolvedValue(0);
    mockDb.policy.count.mockResolvedValue(0);
    mockDb.nationalIssue.count.mockResolvedValue(0);
    mockDb.crisisEvent.count.mockResolvedValue(0);
    mockDb.governmentComponent.findMany.mockResolvedValue([]);
    mockDb.economicComponent.findMany.mockResolvedValue([]);
    mockDb.taxComponent.findMany.mockResolvedValue([]);
    mockDb.policy.findMany.mockResolvedValue([]);
    mockDb.nPCPersonalityAssignment.findUnique.mockResolvedValue(null);
    mockDb.issueGenerationLog.create.mockResolvedValue({});
  });

  describe("shouldEvaluate limits check", () => {
    it("returns false if weekly count is equal to or exceeds maxIssuesPerWeek limit", async () => {
      mockDb.nationalIssue.count.mockResolvedValue(5); // weekly count equals limit (5)

      const result = await NationalIssuesEngine.shouldEvaluate("country_1", mockDb as any);
      expect(result).toBe(false);
      expect(mockDb.nationalIssue.count).toHaveBeenCalled();
    });

    it("returns true if weekly count is below limit and last log was long ago", async () => {
      mockDb.nationalIssue.count.mockResolvedValue(2); // below limit
      mockDb.issueGenerationLog.findFirst.mockResolvedValue({
        ixTimeAtEvaluation: IxTime.getCurrentIxTime() - 10 * 60 * 1000, // 10 minutes ago
      });

      const result = await NationalIssuesEngine.shouldEvaluate("country_1", mockDb as any);
      expect(result).toBe(true);
    });
  });

  describe("evaluateCountry limits enforcement", () => {
    it("stops evaluations when weekly limit is reached and bypass is false", async () => {
      mockDb.country.findUnique.mockResolvedValue({
        id: "country_1",
        name: "Testland",
        currentPopulation: 1000000,
        currentGdpPerCapita: 20000,
        currentTotalGdp: 20000000000,
        publicApproval: 60,
      });
      mockDb.nationalIssue.count.mockResolvedValue(5); // Weekly limit reached
      mockDb.issueGenerationLog.findFirst.mockResolvedValue(null);

      const result = await NationalIssuesEngine.evaluateCountry("country_1", mockDb as any, {
        bypassLimits: false,
      });

      expect(result.issuesGenerated).toBe(0);
      expect(mockDb.nationalIssueTemplate.findMany).not.toHaveBeenCalled(); // templates not fetched
    });

    it("evaluates and generates issues when weekly limit is reached if bypass is true", async () => {
      mockDb.country.findUnique.mockResolvedValue({
        id: "country_1",
        name: "Testland",
        currentPopulation: 1000000,
        currentGdpPerCapita: 20000,
        currentTotalGdp: 20000000000,
        publicApproval: 60,
      });
      mockDb.nationalIssue.count.mockResolvedValue(5); // Weekly limit reached
      mockDb.nationalIssueTemplate.findMany.mockResolvedValue([
        {
          id: "temp_1",
          slug: "test_template",
          title: "Test",
          description: "Desc",
          domain: "economic",
          category: "governance",
          baseSeverity: "medium",
          baseUrgency: 50,
          triggerConditions: JSON.stringify({ field: "publicApproval", op: ">", value: 0 }),
          cooldownDays: 30,
          maxActivePerCountry: 1,
          responseOptions: JSON.stringify([]),
        },
      ]);
      mockDb.nationalIssue.findMany.mockResolvedValue([]);
      mockDb.nPCPersonalityAssignment.findUnique.mockResolvedValue(null);

      const result = await NationalIssuesEngine.evaluateCountry("country_1", mockDb as any, {
        bypassLimits: true,
      });

      expect(result.issuesGenerated).toBe(1);
    });

    it("caps maxIssues based on capacityRemaining", async () => {
      mockConfig.maxIssuesPerWeek = 5;
      mockDb.country.findUnique.mockResolvedValue({
        id: "country_1",
        name: "Testland",
        currentPopulation: 1000000,
        currentGdpPerCapita: 20000,
        currentTotalGdp: 20000000000,
        publicApproval: 60,
      });
      mockDb.nationalIssue.count.mockResolvedValue(4); // 4 issues already this week (1 remaining capacity)
      mockDb.nationalIssueTemplate.findMany.mockResolvedValue([
        {
          id: "temp_1",
          slug: "test_template_1",
          title: "Test 1",
          description: "Desc 1",
          domain: "economic",
          category: "governance",
          baseSeverity: "medium",
          baseUrgency: 80,
          triggerConditions: JSON.stringify({ field: "publicApproval", op: ">", value: 0 }),
          cooldownDays: 30,
          maxActivePerCountry: 1,
          responseOptions: JSON.stringify([]),
        },
        {
          id: "temp_2",
          slug: "test_template_2",
          title: "Test 2",
          description: "Desc 2",
          domain: "economic",
          category: "governance",
          baseSeverity: "medium",
          baseUrgency: 70,
          triggerConditions: JSON.stringify({ field: "publicApproval", op: ">", value: 0 }),
          cooldownDays: 30,
          maxActivePerCountry: 1,
          responseOptions: JSON.stringify([]),
        },
      ]);
      mockDb.nationalIssue.findMany.mockResolvedValue([]);
      mockDb.nPCPersonalityAssignment.findUnique.mockResolvedValue(null);

      const result = await NationalIssuesEngine.evaluateCountry("country_1", mockDb as any, {
        bypassLimits: false,
        maxIssues: 3, // Request 3, but capacity remaining is 1
      });

      // Should only generate 1 issue due to capacity limit
      expect(result.issuesGenerated).toBe(1);
    });
  });
});
