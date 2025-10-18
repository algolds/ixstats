/**
 * Tests for Labor Calculation Utilities
 */

import {
  calculateDerivedLabor,
  getEmploymentTypeColor,
  getSectorColor,
  getProtectionColor,
} from '../../components/enhanced/tabs/utils/laborCalculations';
import { mockLabor } from '../fixtures';
import type { LaborConfiguration } from '~/types/economy-builder';

describe('Labor Calculations', () => {
  describe('calculateDerivedLabor', () => {
    it('calculates employed workforce', () => {
      const result = calculateDerivedLabor(mockLabor);

      // 6.5M * 94% = 6.11M
      const expected = Math.round(mockLabor.totalWorkforce * (mockLabor.employmentRate / 100));
      expect(result.employedWorkforce).toBe(expected);
    });

    it('calculates unemployed workforce', () => {
      const result = calculateDerivedLabor(mockLabor);

      // 6.5M * 6% = 390k
      const expected = Math.round(mockLabor.totalWorkforce * (mockLabor.unemploymentRate / 100));
      expect(result.unemployedWorkforce).toBe(expected);
    });

    it('validates employment + unemployment = 100%', () => {
      const total = mockLabor.employmentRate + mockLabor.unemploymentRate;
      expect(total).toBe(100);
    });

    it('calculates average worker protection score', () => {
      const result = calculateDerivedLabor(mockLabor);

      const protections = Object.values(mockLabor.workerProtections);
      const avgExpected = protections.reduce((a, b) => a + b, 0) / protections.length;

      expect(result.avgProtectionScore).toBe(avgExpected);
    });

    it('handles zero workforce gracefully', () => {
      const zeroLabor: LaborConfiguration = {
        ...mockLabor,
        totalWorkforce: 0,
      };

      const result = calculateDerivedLabor(zeroLabor);

      expect(result.employedWorkforce).toBe(0);
      expect(result.unemployedWorkforce).toBe(0);
    });

    it('rounds workforce values to integers', () => {
      const oddLabor: LaborConfiguration = {
        ...mockLabor,
        totalWorkforce: 6543211,
        employmentRate: 93.7,
        unemploymentRate: 6.3,
      };

      const result = calculateDerivedLabor(oddLabor);

      expect(Number.isInteger(result.employedWorkforce)).toBe(true);
      expect(Number.isInteger(result.unemployedWorkforce)).toBe(true);
    });
  });

  describe('getEmploymentTypeColor', () => {
    it('returns consistent colors for employment types', () => {
      const fullTimeColor = getEmploymentTypeColor('fullTime');
      const partTimeColor = getEmploymentTypeColor('partTime');

      expect(fullTimeColor).toBeDefined();
      expect(partTimeColor).toBeDefined();
      expect(typeof fullTimeColor).toBe('string');
      expect(typeof partTimeColor).toBe('string');
    });

    it('returns different colors for different types', () => {
      const colors = new Set([
        getEmploymentTypeColor('fullTime'),
        getEmploymentTypeColor('partTime'),
        getEmploymentTypeColor('temporary'),
        getEmploymentTypeColor('seasonal'),
      ]);

      // Should have at least 2 different colors
      expect(colors.size).toBeGreaterThanOrEqual(2);
    });

    it('returns same color for same type on multiple calls', () => {
      const color1 = getEmploymentTypeColor('fullTime');
      const color2 = getEmploymentTypeColor('fullTime');

      expect(color1).toBe(color2);
    });

    it('handles all employment types', () => {
      const types = [
        'fullTime',
        'partTime',
        'temporary',
        'seasonal',
        'selfEmployed',
        'gig',
        'informal',
      ];

      types.forEach((type) => {
        const color = getEmploymentTypeColor(type);
        expect(color).toBeDefined();
        expect(typeof color).toBe('string');
      });
    });
  });

  describe('getSectorColor', () => {
    it('returns consistent colors for sectors', () => {
      const agricultureColor = getSectorColor('agriculture');
      const manufacturingColor = getSectorColor('manufacturing');

      expect(agricultureColor).toBeDefined();
      expect(manufacturingColor).toBeDefined();
    });

    it('returns different colors for different sectors', () => {
      const colors = new Set([
        getSectorColor('agriculture'),
        getSectorColor('manufacturing'),
        getSectorColor('services'),
        getSectorColor('finance'),
      ]);

      expect(colors.size).toBeGreaterThanOrEqual(2);
    });

    it('handles all major sectors', () => {
      const sectors = [
        'agriculture',
        'mining',
        'manufacturing',
        'construction',
        'utilities',
        'wholesale',
        'retail',
        'transportation',
        'information',
        'finance',
        'professional',
        'education',
        'healthcare',
        'hospitality',
        'government',
      ];

      sectors.forEach((sector) => {
        const color = getSectorColor(sector);
        expect(color).toBeDefined();
        expect(typeof color).toBe('string');
      });
    });

    it('returns same color for same sector', () => {
      const color1 = getSectorColor('manufacturing');
      const color2 = getSectorColor('manufacturing');

      expect(color1).toBe(color2);
    });
  });

  describe('getProtectionColor', () => {
    it('returns consistent colors for protections', () => {
      const jobSecurityColor = getProtectionColor('jobSecurity');
      const wageProtectionColor = getProtectionColor('wageProtection');

      expect(jobSecurityColor).toBeDefined();
      expect(wageProtectionColor).toBeDefined();
    });

    it('returns different colors for different protections', () => {
      const colors = new Set([
        getProtectionColor('jobSecurity'),
        getProtectionColor('wageProtection'),
        getProtectionColor('healthSafety'),
        getProtectionColor('discriminationProtection'),
      ]);

      expect(colors.size).toBeGreaterThanOrEqual(2);
    });

    it('handles all protection types', () => {
      const protections = [
        'jobSecurity',
        'wageProtection',
        'healthSafety',
        'discriminationProtection',
        'collectiveRights',
      ];

      protections.forEach((protection) => {
        const color = getProtectionColor(protection);
        expect(color).toBeDefined();
        expect(typeof color).toBe('string');
      });
    });

    it('returns same color for same protection', () => {
      const color1 = getProtectionColor('healthSafety');
      const color2 = getProtectionColor('healthSafety');

      expect(color1).toBe(color2);
    });
  });

  describe('Edge Cases', () => {
    it('handles 100% employment rate', () => {
      const fullEmployment: LaborConfiguration = {
        ...mockLabor,
        employmentRate: 100,
        unemploymentRate: 0,
      };

      const result = calculateDerivedLabor(fullEmployment);

      expect(result.employedWorkforce).toBe(mockLabor.totalWorkforce);
      expect(result.unemployedWorkforce).toBe(0);
    });

    it('handles high unemployment scenario', () => {
      const highUnemployment: LaborConfiguration = {
        ...mockLabor,
        employmentRate: 70,
        unemploymentRate: 30,
      };

      const result = calculateDerivedLabor(highUnemployment);

      expect(result.employmentRate).toBe(70);
      expect(result.unemploymentRate).toBe(30);
    });

    it('handles perfect worker protections', () => {
      const perfectProtections: LaborConfiguration = {
        ...mockLabor,
        workerProtections: {
          jobSecurity: 100,
          wageProtection: 100,
          healthSafety: 100,
          discriminationProtection: 100,
          collectiveRights: 100,
        },
      };

      const result = calculateDerivedLabor(perfectProtections);

      expect(result.avgProtectionScore).toBe(100);
    });

    it('handles no worker protections', () => {
      const noProtections: LaborConfiguration = {
        ...mockLabor,
        workerProtections: {
          jobSecurity: 0,
          wageProtection: 0,
          healthSafety: 0,
          discriminationProtection: 0,
          collectiveRights: 0,
        },
      };

      const result = calculateDerivedLabor(noProtections);

      expect(result.avgProtectionScore).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('calculates all metrics in single pass', () => {
      const result = calculateDerivedLabor(mockLabor);

      expect(result).toHaveProperty('employedWorkforce');
      expect(result).toHaveProperty('unemployedWorkforce');
      expect(result).toHaveProperty('avgProtectionScore');
      expect(result).toHaveProperty('employmentRate');
      expect(result).toHaveProperty('unemploymentRate');
    });

    it('maintains mathematical consistency', () => {
      const result = calculateDerivedLabor(mockLabor);

      // Employed + unemployed should equal total workforce
      const total = result.employedWorkforce + result.unemployedWorkforce;
      expect(Math.abs(total - mockLabor.totalWorkforce)).toBeLessThanOrEqual(1); // Allow for rounding
    });
  });
});
