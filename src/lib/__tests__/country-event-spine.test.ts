import { CountryEventSpine } from "../country-event-spine";

// Mock external dependency functions
jest.mock("../diplomatic-news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(true),
}));

jest.mock("../activity-hooks", () => ({
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

  test("processes event and applies consequences", async () => {
    mockDb.internalStabilityMetrics.findUnique.mockResolvedValue({ countryId, stabilityScore: 70 });

    const results = await CountryEventSpine.recordCountryEvent({
      db: mockDb,
      countryId,
      sourceType: "issue",
      sourceId: "issue-123",
      description: "Resolved issue",
      consequences: [
        {
          targetModel: "InternalStabilityMetrics",
          targetField: "stabilityScore",
          operation: "add",
          value: 10,
        },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      targetModel: "InternalStabilityMetrics",
      targetField: "stabilityScore",
      previousValue: 70,
      newValue: 80,
      delta: 10,
      description: "Stability Score increased by 10.0 (70.0 → 80.0)",
      effectType: "immediate",
    });

    expect(mockDb.internalStabilityMetrics.update).toHaveBeenCalledWith({
      where: { countryId },
      data: { stabilityScore: 80 },
    });

    expect(mockDb.countryChangeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        countryId,
        sourceType: "issue",
        sourceId: "issue-123",
        targetModel: "InternalStabilityMetrics",
        targetField: "stabilityScore",
        deltaValue: 10,
        description: "Stability Score increased by 10.0 (70.0 → 80.0)",
      }),
    });
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

  test("falls back to general ledger log when no consequences are applied", async () => {
    await CountryEventSpine.recordCountryEvent({
      db: mockDb,
      countryId,
      sourceType: "other",
      description: "General system tick event",
    });

    expect(mockDb.countryChangeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        countryId,
        sourceType: "other",
        sourceId: null,
        description: "General system tick event",
      }),
    });
  });
});
