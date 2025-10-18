/**
 * Tests for Demographics Calculation Utilities
 */

import {
  calculateDerivedDemographics,
  getRegionColor,
} from '../../components/enhanced/tabs/utils/demographicsCalculations';
import { mockDemographics } from '../fixtures';

describe('Demographics Calculations', () => {
  describe('calculateDerivedDemographics', () => {
    it('calculates working age population correctly', () => {
      const result = calculateDerivedDemographics(mockDemographics);

      // 10M * 65% = 6.5M
      expect(result.workingAge).toBe(6500000);
    });

    it('calculates youth population correctly', () => {
      const result = calculateDerivedDemographics(mockDemographics);

      // 10M * 25% = 2.5M
      expect(result.youthPop).toBe(2500000);
    });

    it('calculates elderly population correctly', () => {
      const result = calculateDerivedDemographics(mockDemographics);

      // 10M * 10% = 1M
      expect(result.elderlyPop).toBe(1000000);
    });

    it('calculates urban population correctly', () => {
      const result = calculateDerivedDemographics(mockDemographics);

      // 10M * 70% = 7M
      expect(result.urbanPop).toBe(7000000);
    });

    it('calculates rural population correctly', () => {
      const result = calculateDerivedDemographics(mockDemographics);

      // 10M - 7M = 3M
      expect(result.ruralPop).toBe(3000000);
    });

    it('returns correct dependency ratio', () => {
      const result = calculateDerivedDemographics(mockDemographics);

      expect(result.dependencyRatio).toBe(53.9);
    });

    it('returns correct working age share', () => {
      const result = calculateDerivedDemographics(mockDemographics);

      expect(result.workingAgeShare).toBe(65);
    });

    it('returns correct urban share', () => {
      const result = calculateDerivedDemographics(mockDemographics);

      expect(result.urbanShare).toBe(70);
    });

    it('handles zero population gracefully', () => {
      const zeroPop = {
        ...mockDemographics,
        totalPopulation: 0,
      };

      const result = calculateDerivedDemographics(zeroPop);

      expect(result.workingAge).toBe(0);
      expect(result.youthPop).toBe(0);
      expect(result.elderlyPop).toBe(0);
      expect(result.urbanPop).toBe(0);
      expect(result.ruralPop).toBe(0);
    });

    it('rounds population values to nearest integer', () => {
      const oddPop = {
        ...mockDemographics,
        totalPopulation: 10000001,
        ageDistribution: {
          under15: 33.3,
          age15to64: 33.3,
          over65: 33.4,
        },
      };

      const result = calculateDerivedDemographics(oddPop);

      expect(Number.isInteger(result.workingAge)).toBe(true);
      expect(Number.isInteger(result.youthPop)).toBe(true);
      expect(Number.isInteger(result.elderlyPop)).toBe(true);
    });

    it('handles large population numbers', () => {
      const largePop = {
        ...mockDemographics,
        totalPopulation: 1000000000, // 1 billion
      };

      const result = calculateDerivedDemographics(largePop);

      expect(result.workingAge).toBe(650000000);
      expect(result.youthPop).toBe(250000000);
      expect(result.elderlyPop).toBe(100000000);
    });

    it('maintains precision for percentage calculations', () => {
      const result = calculateDerivedDemographics(mockDemographics);

      expect(result.workingAgeShare).toBe(mockDemographics.ageDistribution.age15to64);
      expect(result.urbanShare).toBe(mockDemographics.urbanRuralSplit.urban);
    });
  });

  describe('getRegionColor', () => {
    it('returns first color for index 0', () => {
      const color = getRegionColor(0);
      expect(color).toBe('blue');
    });

    it('returns different colors for sequential indices', () => {
      const color0 = getRegionColor(0);
      const color1 = getRegionColor(1);
      const color2 = getRegionColor(2);

      expect(color0).not.toBe(color1);
      expect(color1).not.toBe(color2);
      expect(color0).not.toBe(color2);
    });

    it('cycles through color palette', () => {
      const colors = Array.from({ length: 10 }, (_, i) => getRegionColor(i));

      // Should have 10 unique colors
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(10);
    });

    it('wraps around after 10 colors', () => {
      const color0 = getRegionColor(0);
      const color10 = getRegionColor(10);
      const color20 = getRegionColor(20);

      expect(color0).toBe(color10);
      expect(color10).toBe(color20);
    });

    it('handles negative indices', () => {
      // JavaScript modulo with negative numbers
      const color = getRegionColor(-1);
      expect(color).toBeDefined();
      expect(typeof color).toBe('string');
    });

    it('returns consistent colors for same index', () => {
      const color1 = getRegionColor(5);
      const color2 = getRegionColor(5);

      expect(color1).toBe(color2);
    });

    it('returns valid color names', () => {
      const validColors = [
        'blue',
        'green',
        'orange',
        'purple',
        'cyan',
        'pink',
        'yellow',
        'red',
        'indigo',
        'teal',
      ];

      for (let i = 0; i < 10; i++) {
        const color = getRegionColor(i);
        expect(validColors).toContain(color);
      }
    });

    it('handles large index values', () => {
      const color = getRegionColor(9999);
      expect(color).toBeDefined();
      expect(typeof color).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('handles 100% working age population', () => {
      const allWorkingAge = {
        ...mockDemographics,
        ageDistribution: {
          under15: 0,
          age15to64: 100,
          over65: 0,
        },
      };

      const result = calculateDerivedDemographics(allWorkingAge);

      expect(result.workingAge).toBe(10000000);
      expect(result.youthPop).toBe(0);
      expect(result.elderlyPop).toBe(0);
    });

    it('handles 100% urban population', () => {
      const allUrban = {
        ...mockDemographics,
        urbanRuralSplit: {
          urban: 100,
          rural: 0,
        },
      };

      const result = calculateDerivedDemographics(allUrban);

      expect(result.urbanPop).toBe(10000000);
      expect(result.ruralPop).toBe(0);
    });

    it('handles 100% rural population', () => {
      const allRural = {
        ...mockDemographics,
        urbanRuralSplit: {
          urban: 0,
          rural: 100,
        },
      };

      const result = calculateDerivedDemographics(allRural);

      expect(result.urbanPop).toBe(0);
      expect(result.ruralPop).toBe(10000000);
    });
  });

  describe('Integration Tests', () => {
    it('calculates all metrics in single pass', () => {
      const result = calculateDerivedDemographics(mockDemographics);

      expect(result).toHaveProperty('workingAge');
      expect(result).toHaveProperty('youthPop');
      expect(result).toHaveProperty('elderlyPop');
      expect(result).toHaveProperty('urbanPop');
      expect(result).toHaveProperty('ruralPop');
      expect(result).toHaveProperty('dependencyRatio');
      expect(result).toHaveProperty('workingAgeShare');
      expect(result).toHaveProperty('urbanShare');
    });

    it('maintains mathematical consistency', () => {
      const result = calculateDerivedDemographics(mockDemographics);

      // Total population should equal sum of age groups
      const totalAgeGroups = result.workingAge + result.youthPop + result.elderlyPop;
      expect(totalAgeGroups).toBe(mockDemographics.totalPopulation);

      // Total population should equal sum of urban/rural
      const totalUrbanRural = result.urbanPop + result.ruralPop;
      expect(totalUrbanRural).toBe(mockDemographics.totalPopulation);
    });
  });
});
