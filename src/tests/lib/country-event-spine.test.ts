import { CountryEventSpine } from "~/lib/activity";

// Mock external dependency functions
jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(true),
}));

jest.mock("~/lib/activity/hooks", () => ({
  ActivityHooks: {
    Economic: {
      onTaxPolicyChange: jest.fn().mockResolvedValue(true),
    },
  },
}));

describe("CountryEventSpine", () => {
  let mockDb: any;
  const countryId = "test-country-id";

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up a mock database client
    mockDb = {
      country: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: countryId, name: "Testland", publicApproval: 70 }),
        update: jest.fn().mockResolvedValue({ id: countryId }),
      },
      governmentStructure: {
        findUnique: jest.fn().mockResolvedValue({ countryId, totalBudget: 50000 }),
        update: jest.fn().mockResolvedValue({ countryId }),
      },
      internalStabilityMetrics: {
        findUnique: jest.fn().mockResolvedValue({ countryId, stabilityScore: 70 }),
        update: jest.fn().mockResolvedValue({ countryId }),
      },
      countryChangeLog: {
        create: jest.fn().mockResolvedValue({ id: "log-id" }),
      },
    };
  });
  test("clamps values to specified bounds", async () => {
    mockDb.country.findUnique.mockResolvedValue({ id: countryId, publicApproval: 95 });

    const results = await CountryEventSpine.recordCountryEvent({
      db: mockDb,
      countryId,
      sourceType: "policy",
      sourceId: "policy-123",
      description: "Activate policy",
      consequences: [
        {
          targetModel: "Country",
          targetField: "publicApproval",
          operation: "add",
          value: 15,
        },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0].newValue).toBe(100); // clamped to 100
    expect(results[0].delta).toBe(5); // 100 - 95

    expect(mockDb.country.update).toHaveBeenCalledWith({
      where: { id: countryId },
      data: { publicApproval: 100 },
    });
  });

  test("skips a stat that has no stored value instead of treating it as 0", async () => {
    mockDb.country.findUnique.mockResolvedValue({ id: countryId, unemploymentRate: null });

    const results = await CountryEventSpine.recordCountryEvent({
      db: mockDb,
      countryId,
      sourceType: "decision",
      description: "Directive",
      consequences: [
        {
          targetModel: "Country",
          targetField: "unemploymentRate",
          operation: "subtract",
          value: 0.6,
        },
      ],
    });

    expect(results).toHaveLength(0);
    expect(mockDb.country.update).not.toHaveBeenCalled();
  });
});
