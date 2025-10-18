/**
 * Tests for Unified Atomic API Router
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTRPCMsw } from 'msw-trpc';
import { appRouter } from '../../root';
import { createInnerTRPCContext } from '../../trpc';

// Mock the database
const mockDb = {
  governmentComponent: {
    findMany: vi.fn(),
  },
  economicComponent: {
    findMany: vi.fn(),
  },
  taxComponent: {
    findMany: vi.fn(),
  },
  crossBuilderSynergy: {
    findMany: vi.fn(),
  },
};

// Mock the auth context
const mockAuth = {
  userId: 'test-user-id',
};

describe('Unified Atomic API Router', () => {
  let ctx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    ctx = {
      db: mockDb,
      auth: mockAuth,
    };
  });

  describe('getAll', () => {
    it('should fetch all component types for a country', async () => {
      const mockGovernmentComponents = [
        { id: '1', componentType: 'DEMOCRACY', isActive: true },
        { id: '2', componentType: 'CENTRAL_BANK', isActive: true },
      ];
      
      const mockEconomicComponents = [
        { id: '3', componentType: 'FREE_MARKET_SYSTEM', isActive: true },
        { id: '4', componentType: 'PRIVATE_PROPERTY_RIGHTS', isActive: true },
      ];
      
      const mockTaxComponents = [
        { id: '5', componentType: 'PROGRESSIVE_TAX', isActive: true },
        { id: '6', componentType: 'CORPORATE_TAX', isActive: true },
      ];

      mockDb.governmentComponent.findMany.mockResolvedValue(mockGovernmentComponents);
      mockDb.economicComponent.findMany.mockResolvedValue(mockEconomicComponents);
      mockDb.taxComponent.findMany.mockResolvedValue(mockTaxComponents);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.unifiedAtomic.getAll({ countryId: 'test-country-id' });

      expect(result).toEqual({
        government: mockGovernmentComponents,
        economic: mockEconomicComponents,
        tax: mockTaxComponents,
      });

      expect(mockDb.governmentComponent.findMany).toHaveBeenCalledWith({
        where: { countryId: 'test-country-id', isActive: true },
      });
      expect(mockDb.economicComponent.findMany).toHaveBeenCalledWith({
        where: { countryId: 'test-country-id', isActive: true },
      });
      expect(mockDb.taxComponent.findMany).toHaveBeenCalledWith({
        where: { countryId: 'test-country-id', isActive: true },
      });
    });

    it('should handle empty results', async () => {
      mockDb.governmentComponent.findMany.mockResolvedValue([]);
      mockDb.economicComponent.findMany.mockResolvedValue([]);
      mockDb.taxComponent.findMany.mockResolvedValue([]);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.unifiedAtomic.getAll({ countryId: 'test-country-id' });

      expect(result).toEqual({
        government: [],
        economic: [],
        tax: [],
      });
    });
  });

  describe('detectSynergies', () => {
    it('should detect synergies and conflicts', async () => {
      const mockGovernmentComponents = [
        { id: '1', componentType: 'DEMOCRACY', isActive: true },
        { id: '2', componentType: 'CENTRAL_BANK', isActive: true },
      ];
      
      const mockEconomicComponents = [
        { id: '3', componentType: 'FREE_MARKET_SYSTEM', isActive: true },
      ];
      
      const mockTaxComponents = [
        { id: '5', componentType: 'PROGRESSIVE_TAX', isActive: true },
      ];

      mockDb.governmentComponent.findMany.mockResolvedValue(mockGovernmentComponents);
      mockDb.economicComponent.findMany.mockResolvedValue(mockEconomicComponents);
      mockDb.taxComponent.findMany.mockResolvedValue(mockTaxComponents);
      mockDb.crossBuilderSynergy.findMany.mockResolvedValue([]);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.unifiedAtomic.detectSynergies({ countryId: 'test-country-id' });

      expect(result).toBeDefined();
      expect(result.governmentSynergies).toBeDefined();
      expect(result.governmentConflicts).toBeDefined();
      expect(result.crossBuilderSynergies).toBeDefined();
    });
  });

  describe('calculateCombinedEffectiveness', () => {
    it('should calculate combined effectiveness', async () => {
      const mockGovernmentComponents = [
        { id: '1', componentType: 'DEMOCRACY', isActive: true },
      ];
      
      const mockEconomicComponents = [
        { id: '3', componentType: 'FREE_MARKET_SYSTEM', isActive: true },
      ];
      
      const mockTaxComponents = [
        { id: '5', componentType: 'PROGRESSIVE_TAX', isActive: true },
      ];

      mockDb.governmentComponent.findMany.mockResolvedValue(mockGovernmentComponents);
      mockDb.economicComponent.findMany.mockResolvedValue(mockEconomicComponents);
      mockDb.taxComponent.findMany.mockResolvedValue(mockTaxComponents);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.unifiedAtomic.calculateCombinedEffectiveness({ countryId: 'test-country-id' });

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

