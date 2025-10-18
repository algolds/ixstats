/**
 * Tests for Real-time Atomic Effects Integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  calculateRealTimeAtomicEffects, 
  applyRealTimeEffects,
  type AtomicComponentData 
} from '../real-time-atomic-effects';
import { ComponentType, EconomicComponentType, TaxComponentType } from '@prisma/client';

describe('Real-time Atomic Effects Integration', () => {
  let mockComponents: AtomicComponentData;
  let mockBaseEconomicData: any;

  beforeEach(() => {
    mockComponents = {
      government: [ComponentType.DEMOCRACY, ComponentType.CENTRAL_BANK],
      economic: [EconomicComponentType.FREE_MARKET_SYSTEM, EconomicComponentType.PRIVATE_PROPERTY_RIGHTS],
      tax: [TaxComponentType.PROGRESSIVE_TAX, TaxComponentType.CORPORATE_TAX]
    };

    mockBaseEconomicData = {
      gdpGrowthRate: 3.0,
      nominalGDP: 1000000000,
      gdpPerCapita: 50000,
      taxRevenueGDPPercent: 20,
      unemploymentRate: 5.0,
      inflationRate: 2.0,
      population: 20000000
    };
  });

  describe('calculateRealTimeAtomicEffects', () => {
    it('should calculate effects for all component types', () => {
      const effects = calculateRealTimeAtomicEffects(mockComponents, mockBaseEconomicData);

      expect(effects).toBeDefined();
      expect(effects.gdpModifiers).toBeDefined();
      expect(effects.taxModifiers).toBeDefined();
      expect(effects.employmentModifiers).toBeDefined();
      expect(effects.inflationModifiers).toBeDefined();
      expect(effects.stabilityModifiers).toBeDefined();
      expect(effects.synergies).toBeDefined();
      expect(effects.conflicts).toBeDefined();
    });

    it('should return valid modifier values', () => {
      const effects = calculateRealTimeAtomicEffects(mockComponents, mockBaseEconomicData);

      // GDP modifiers should be positive numbers
      expect(effects.gdpModifiers.growthRateMultiplier).toBeGreaterThan(0);
      expect(effects.gdpModifiers.baseValueMultiplier).toBeGreaterThan(0);
      expect(effects.gdpModifiers.perCapitaMultiplier).toBeGreaterThan(0);

      // Tax modifiers should be positive numbers
      expect(effects.taxModifiers.revenueMultiplier).toBeGreaterThan(0);
      expect(effects.taxModifiers.collectionEfficiencyMultiplier).toBeGreaterThan(0);
      expect(effects.taxModifiers.complianceRateMultiplier).toBeGreaterThan(0);

      // Employment modifiers should be positive numbers
      expect(effects.employmentModifiers.participationRateMultiplier).toBeGreaterThan(0);
      expect(effects.employmentModifiers.productivityMultiplier).toBeGreaterThan(0);
    });

    it('should handle empty component arrays', () => {
      const emptyComponents: AtomicComponentData = {
        government: [],
        economic: [],
        tax: []
      };

      const effects = calculateRealTimeAtomicEffects(emptyComponents, mockBaseEconomicData);

      expect(effects).toBeDefined();
      // Should return base modifiers (1.0) when no components
      expect(effects.gdpModifiers.growthRateMultiplier).toBe(1.0);
      expect(effects.taxModifiers.revenueMultiplier).toBe(1.0);
    });
  });

  describe('applyRealTimeEffects', () => {
    it('should apply effects to economic data', () => {
      const effects = calculateRealTimeAtomicEffects(mockComponents, mockBaseEconomicData);
      const enhancedData = applyRealTimeEffects(mockBaseEconomicData, effects);

      expect(enhancedData).toBeDefined();
      expect(enhancedData.enhancedGdpGrowthRate).toBeDefined();
      expect(enhancedData.enhancedNominalGDP).toBeDefined();
      expect(enhancedData.enhancedGdpPerCapita).toBeDefined();
      expect(enhancedData.enhancedTaxRevenueGDPPercent).toBeDefined();
      expect(enhancedData.enhancedUnemploymentRate).toBeDefined();
      expect(enhancedData.enhancedInflationRate).toBeDefined();
    });

    it('should maintain data integrity', () => {
      const effects = calculateRealTimeAtomicEffects(mockComponents, mockBaseEconomicData);
      const enhancedData = applyRealTimeEffects(mockBaseEconomicData, effects);

      // Enhanced values should be positive
      expect(enhancedData.enhancedGdpGrowthRate).toBeGreaterThan(0);
      expect(enhancedData.enhancedNominalGDP).toBeGreaterThan(0);
      expect(enhancedData.enhancedGdpPerCapita).toBeGreaterThan(0);
      expect(enhancedData.enhancedTaxRevenueGDPPercent).toBeGreaterThan(0);
      expect(enhancedData.enhancedUnemploymentRate).toBeGreaterThanOrEqual(0);
      expect(enhancedData.enhancedInflationRate).toBeGreaterThan(0);

      // Population should remain unchanged
      expect(enhancedData.enhancedPopulation).toBe(mockBaseEconomicData.population);
    });

    it('should calculate synergy and conflict bonuses', () => {
      const effects = calculateRealTimeAtomicEffects(mockComponents, mockBaseEconomicData);
      const enhancedData = applyRealTimeEffects(mockBaseEconomicData, effects);

      expect(enhancedData.totalSynergyBonus).toBeDefined();
      expect(enhancedData.totalConflictPenalty).toBeDefined();
      expect(typeof enhancedData.totalSynergyBonus).toBe('number');
      expect(typeof enhancedData.totalConflictPenalty).toBe('number');
    });
  });

  describe('Cross-builder synergies', () => {
    it('should detect democracy and free market synergy', () => {
      const synergyComponents: AtomicComponentData = {
        government: [ComponentType.DEMOCRACY],
        economic: [EconomicComponentType.FREE_MARKET_SYSTEM],
        tax: []
      };

      const effects = calculateRealTimeAtomicEffects(synergyComponents, mockBaseEconomicData);
      
      // Should have cross-builder synergies
      expect(effects.synergies.crossBuilderSynergies.length).toBeGreaterThan(0);
      
      const democracyFreeMarketSynergy = effects.synergies.crossBuilderSynergies.find(
        s => s.id === 'democracy-free-market'
      );
      expect(democracyFreeMarketSynergy).toBeDefined();
      expect(democracyFreeMarketSynergy?.effectivenessBonus).toBeGreaterThan(0);
    });

    it('should detect central bank and progressive tax synergy', () => {
      const synergyComponents: AtomicComponentData = {
        government: [ComponentType.CENTRAL_BANK],
        economic: [],
        tax: [TaxComponentType.PROGRESSIVE_TAX]
      };

      const effects = calculateRealTimeAtomicEffects(synergyComponents, mockBaseEconomicData);
      
      const centralBankProgressiveTaxSynergy = effects.synergies.crossBuilderSynergies.find(
        s => s.id === 'central-bank-progressive-tax'
      );
      expect(centralBankProgressiveTaxSynergy).toBeDefined();
      expect(centralBankProgressiveTaxSynergy?.effectivenessBonus).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined base economic data gracefully', () => {
      const undefinedData = {
        gdpGrowthRate: undefined as any,
        nominalGDP: undefined as any,
        gdpPerCapita: undefined as any,
        taxRevenueGDPPercent: undefined as any,
        unemploymentRate: undefined as any,
        inflationRate: undefined as any,
        population: undefined as any
      };

      expect(() => {
        calculateRealTimeAtomicEffects(mockComponents, undefinedData);
      }).not.toThrow();
    });

    it('should handle extreme values', () => {
      const extremeData = {
        gdpGrowthRate: 1000, // Very high growth
        nominalGDP: 0, // Zero GDP
        gdpPerCapita: -1000, // Negative per capita
        taxRevenueGDPPercent: 200, // Very high tax rate
        unemploymentRate: 0, // No unemployment
        inflationRate: -5, // Deflation
        population: 1 // Very small population
      };

      expect(() => {
        const effects = calculateRealTimeAtomicEffects(mockComponents, extremeData);
        applyRealTimeEffects(extremeData, effects);
      }).not.toThrow();
    });
  });
});

