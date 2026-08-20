import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { unifiedAtomicRouter } from "~/server/api/routers/unifiedAtomic";
import { createCallerFactory } from "~/server/api/trpc";

// Mock the database
const mockDb = {
  governmentComponent: {
    findMany: jest.fn(),
  },
  economicComponent: {
    findMany: jest.fn(),
  },
  taxComponent: {
    findMany: jest.fn(),
  },
  crossBuilderSynergy: {
    findMany: jest.fn(),
  },
};

// Mock the auth context
const mockAuth = {
  userId: "test-user-id",
};

const createCaller = createCallerFactory(unifiedAtomicRouter);

describe("Unified Atomic API Router", () => {
  let ctx: any;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      db: mockDb,
      auth: mockAuth,
    };
  });

  describe("getAll", () => {
    it("should fetch all component types for a country", async () => {
      const mockGovernmentComponents = [
        { id: "1", componentType: "DEMOCRACY", isActive: true },
        { id: "2", componentType: "CENTRAL_BANK", isActive: true },
      ];

      const mockEconomicComponents = [
        { id: "3", componentType: "FREE_MARKET_SYSTEM", isActive: true },
        { id: "4", componentType: "PRIVATE_PROPERTY_RIGHTS", isActive: true },
      ];

      const mockTaxComponents = [
        { id: "5", componentType: "PROGRESSIVE_TAX", isActive: true },
        { id: "6", componentType: "CORPORATE_TAX", isActive: true },
      ];

      mockDb.governmentComponent.findMany.mockResolvedValue(mockGovernmentComponents);
      mockDb.economicComponent.findMany.mockResolvedValue(mockEconomicComponents);
      mockDb.taxComponent.findMany.mockResolvedValue(mockTaxComponents);

      const caller = createCaller(ctx);
      const result = await caller.getAll({ countryId: "test-country-id" });

      expect(result).toEqual({
        government: mockGovernmentComponents,
        economic: mockEconomicComponents,
        tax: mockTaxComponents,
        totalCount: 6,
      });

      expect(mockDb.governmentComponent.findMany).toHaveBeenCalledWith({
        where: { countryId: "test-country-id", isActive: true },
      });
      expect(mockDb.economicComponent.findMany).toHaveBeenCalledWith({
        where: { countryId: "test-country-id", isActive: true },
      });
      expect(mockDb.taxComponent.findMany).toHaveBeenCalledWith({
        where: { countryId: "test-country-id", isActive: true },
      });
    });

    it("should handle empty results", async () => {
      mockDb.governmentComponent.findMany.mockResolvedValue([]);
      mockDb.economicComponent.findMany.mockResolvedValue([]);
      mockDb.taxComponent.findMany.mockResolvedValue([]);

      const caller = createCaller(ctx);
      const result = await caller.getAll({ countryId: "test-country-id" });

      expect(result).toEqual({
        government: [],
        economic: [],
        tax: [],
        totalCount: 0,
      });
    });
  });

  describe("detectSynergies", () => {
    it("should detect synergies and conflicts", async () => {
      const mockGovernmentComponents = [
        { id: "1", componentType: "DEMOCRACY", isActive: true },
        { id: "2", componentType: "CENTRAL_BANK", isActive: true },
      ];

      const mockEconomicComponents = [
        { id: "3", componentType: "FREE_MARKET_SYSTEM", isActive: true },
      ];

      const mockTaxComponents = [{ id: "5", componentType: "PROGRESSIVE_TAX", isActive: true }];

      mockDb.governmentComponent.findMany.mockResolvedValue(mockGovernmentComponents);
      mockDb.economicComponent.findMany.mockResolvedValue(mockEconomicComponents);
      mockDb.taxComponent.findMany.mockResolvedValue(mockTaxComponents);
      mockDb.crossBuilderSynergy.findMany.mockResolvedValue([]);

      const caller = createCaller(ctx);
      const result = await caller.detectSynergies({ countryId: "test-country-id" });

      expect(result).toBeDefined();
      expect(result.governmentSynergies).toBeDefined();
      expect(result.governmentConflicts).toBeDefined();
      expect(result.crossBuilderSynergies).toBeDefined();
    });
  });

  describe("calculateCombinedEffectiveness", () => {
    it("should calculate combined effectiveness", async () => {
      const mockGovernmentComponents = [{ id: "1", componentType: "DEMOCRACY", isActive: true }];

      const mockEconomicComponents = [
        { id: "3", componentType: "FREE_MARKET_SYSTEM", isActive: true },
      ];

      const mockTaxComponents = [{ id: "5", componentType: "PROGRESSIVE_TAX", isActive: true }];

      mockDb.governmentComponent.findMany.mockResolvedValue(mockGovernmentComponents);
      mockDb.economicComponent.findMany.mockResolvedValue(mockEconomicComponents);
      mockDb.taxComponent.findMany.mockResolvedValue(mockTaxComponents);

      const caller = createCaller(ctx);
      const result = await caller.calculateCombinedEffectiveness({
        countryId: "test-country-id",
      });

      expect(result).toBeDefined();
      expect(result.governmentEffectiveness).toBeDefined();
      expect(result.economicEffectiveness).toBeDefined();
      expect(result.taxEffectiveness).toBeDefined();
      expect(result.combinedScore).toBeDefined();
      expect(result.economicModifiers).toBeDefined();
      expect(result.taxModifiers).toBeDefined();
      expect(result.stabilityScore).toBeDefined();
    });
  });
});
