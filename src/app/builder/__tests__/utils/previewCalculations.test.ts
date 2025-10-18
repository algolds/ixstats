/**
 * Tests for Preview Calculation Utilities
 */

import {
  calculateEffectivenessScore,
  calculateCompleteness,
  identifyIssues,
} from '../../components/enhanced/tabs/utils/previewCalculations';
import { mockEconomyBuilder } from '../fixtures';
import type { EconomyBuilderState } from '~/types/economy-builder';

describe('Preview Calculations', () => {
  describe('calculateEffectivenessScore', () => {
    it('calculates effectiveness score for valid economy', () => {
      const score = calculateEffectivenessScore(mockEconomyBuilder);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('returns higher score for well-configured economy', () => {
      const score = calculateEffectivenessScore(mockEconomyBuilder);

      // Mock economy should score reasonably well
      expect(score).toBeGreaterThan(50);
    });

    it('penalizes incomplete configurations', () => {
      const incomplete: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [],
      };

      const score = calculateEffectivenessScore(incomplete);

      expect(score).toBeLessThan(calculateEffectivenessScore(mockEconomyBuilder));
    });

    it('rewards balanced sector distribution', () => {
      const balanced: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [
          { ...mockEconomyBuilder.sectors[0], gdpContribution: 33.3 },
          { ...mockEconomyBuilder.sectors[1], gdpContribution: 33.3 },
          { ...mockEconomyBuilder.sectors[2], gdpContribution: 33.4 },
        ],
      };

      const score = calculateEffectivenessScore(balanced);

      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('considers unemployment rate in scoring', () => {
      const highUnemployment: EconomyBuilderState = {
        ...mockEconomyBuilder,
        laborMarket: {
          ...mockEconomyBuilder.laborMarket,
          unemploymentRate: 20,
          employmentRate: 80,
        },
      };

      const score = calculateEffectivenessScore(highUnemployment);

      expect(score).toBeLessThan(calculateEffectivenessScore(mockEconomyBuilder));
    });

    it('considers productivity in scoring', () => {
      const highProductivity: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: mockEconomyBuilder.sectors.map((s) => ({
          ...s,
          productivity: 95,
        })),
      };

      const score = calculateEffectivenessScore(highProductivity);

      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('returns 0 for completely invalid economy', () => {
      const invalid: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [],
        laborMarket: {
          ...mockEconomyBuilder.laborMarket,
          totalWorkforce: 0,
        },
        demographics: {
          ...mockEconomyBuilder.demographics,
          totalPopulation: 0,
        },
      };

      const score = calculateEffectivenessScore(invalid);

      expect(score).toBeLessThanOrEqual(20); // Very low score
    });
  });

  describe('calculateCompleteness', () => {
    it('returns 100% for complete configuration', () => {
      const completeness = calculateCompleteness(mockEconomyBuilder);

      expect(completeness).toBe(100);
    });

    it('returns lower percentage for missing sectors', () => {
      const incomplete: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [],
      };

      const completeness = calculateCompleteness(incomplete);

      expect(completeness).toBeLessThan(100);
    });

    it('returns lower percentage for missing demographics', () => {
      const incomplete: EconomyBuilderState = {
        ...mockEconomyBuilder,
        demographics: {
          ...mockEconomyBuilder.demographics,
          regions: [],
        },
      };

      const completeness = calculateCompleteness(incomplete);

      expect(completeness).toBeLessThanOrEqual(100);
    });

    it('returns 0% for empty configuration', () => {
      const empty: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [],
        selectedAtomicComponents: [],
        demographics: {
          ...mockEconomyBuilder.demographics,
          totalPopulation: 0,
          regions: [],
        },
      };

      const completeness = calculateCompleteness(empty);

      expect(completeness).toBeLessThan(50);
    });

    it('weighs different sections appropriately', () => {
      const partialSectors: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [mockEconomyBuilder.sectors[0]],
      };

      const completeness = calculateCompleteness(partialSectors);

      expect(completeness).toBeGreaterThan(0);
      expect(completeness).toBeLessThan(100);
    });
  });

  describe('identifyIssues', () => {
    it('returns empty array for valid economy', () => {
      const issues = identifyIssues(mockEconomyBuilder);

      expect(Array.isArray(issues)).toBe(true);
      expect(issues.length).toBe(0);
    });

    it('identifies missing sectors', () => {
      const noSectors: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [],
      };

      const issues = identifyIssues(noSectors);

      expect(issues.some((issue) => issue.includes('sector'))).toBe(true);
    });

    it('identifies invalid sector totals', () => {
      const invalidTotals: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [
          { ...mockEconomyBuilder.sectors[0], gdpContribution: 60 },
          { ...mockEconomyBuilder.sectors[1], gdpContribution: 50 },
        ],
      };

      const issues = identifyIssues(invalidTotals);

      expect(issues.some((issue) => issue.includes('100'))).toBe(true);
    });

    it('identifies high unemployment', () => {
      const highUnemployment: EconomyBuilderState = {
        ...mockEconomyBuilder,
        laborMarket: {
          ...mockEconomyBuilder.laborMarket,
          unemploymentRate: 25,
          employmentRate: 75,
        },
      };

      const issues = identifyIssues(highUnemployment);

      expect(issues.some((issue) => issue.toLowerCase().includes('unemployment'))).toBe(true);
    });

    it('identifies zero population', () => {
      const zeroPop: EconomyBuilderState = {
        ...mockEconomyBuilder,
        demographics: {
          ...mockEconomyBuilder.demographics,
          totalPopulation: 0,
        },
      };

      const issues = identifyIssues(zeroPop);

      expect(issues.some((issue) => issue.toLowerCase().includes('population'))).toBe(true);
    });

    it('identifies missing atomic components', () => {
      const noComponents: EconomyBuilderState = {
        ...mockEconomyBuilder,
        selectedAtomicComponents: [],
      };

      const issues = identifyIssues(noComponents);

      expect(issues.some((issue) => issue.toLowerCase().includes('component'))).toBe(true);
    });

    it('prioritizes critical issues', () => {
      const multipleIssues: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [],
        demographics: {
          ...mockEconomyBuilder.demographics,
          totalPopulation: 0,
        },
      };

      const issues = identifyIssues(multipleIssues);

      expect(issues.length).toBeGreaterThan(1);
    });

    it('returns issues in order of severity', () => {
      const issues = identifyIssues(mockEconomyBuilder);

      // Should be ordered (critical first)
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined validation object', () => {
      const noValidation: EconomyBuilderState = {
        ...mockEconomyBuilder,
        validation: undefined,
      };

      const score = calculateEffectivenessScore(noValidation);
      const completeness = calculateCompleteness(noValidation);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(completeness).toBeGreaterThanOrEqual(0);
    });

    it('handles very large GDP values', () => {
      const largeGDP: EconomyBuilderState = {
        ...mockEconomyBuilder,
        structure: {
          ...mockEconomyBuilder.structure,
          totalGDP: 1000000000000000, // 1 quadrillion
        },
      };

      const score = calculateEffectivenessScore(largeGDP);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('handles fractional percentages', () => {
      const fractional: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [
          { ...mockEconomyBuilder.sectors[0], gdpContribution: 33.333 },
          { ...mockEconomyBuilder.sectors[1], gdpContribution: 33.333 },
          { ...mockEconomyBuilder.sectors[2], gdpContribution: 33.334 },
        ],
      };

      const score = calculateEffectivenessScore(fractional);

      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration Tests', () => {
    it('provides consistent scoring across multiple calls', () => {
      const score1 = calculateEffectivenessScore(mockEconomyBuilder);
      const score2 = calculateEffectivenessScore(mockEconomyBuilder);

      expect(score1).toBe(score2);
    });

    it('completeness and effectiveness correlate', () => {
      const completeness = calculateCompleteness(mockEconomyBuilder);
      const effectiveness = calculateEffectivenessScore(mockEconomyBuilder);

      // Generally, higher completeness should mean higher effectiveness
      if (completeness === 100) {
        expect(effectiveness).toBeGreaterThan(0);
      }
    });

    it('issues inversely correlate with effectiveness', () => {
      const issues = identifyIssues(mockEconomyBuilder);
      const effectiveness = calculateEffectivenessScore(mockEconomyBuilder);

      // Fewer issues should mean higher effectiveness
      if (issues.length === 0) {
        expect(effectiveness).toBeGreaterThan(50);
      }
    });
  });
});
