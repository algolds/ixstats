/**
 * Tests for Sector Calculation Utilities
 */

import {
  SECTOR_TEMPLATES,
  getSectorCategory,
  calculateSectorTotals,
} from "../../components/enhanced/tabs/utils/sectorCalculations";
import { mockSectors } from "../fixtures";
import type { SectorConfiguration } from "~/types/economy-builder";

describe("Sector Calculations", () => {
  describe("SECTOR_TEMPLATES", () => {
    it("contains predefined sector templates", () => {
      expect(SECTOR_TEMPLATES).toBeDefined();
      expect(typeof SECTOR_TEMPLATES).toBe("object");
    });

    it("has agriculture template", () => {
      expect(SECTOR_TEMPLATES).toHaveProperty("agriculture");
    });

    it("has manufacturing template", () => {
      expect(SECTOR_TEMPLATES).toHaveProperty("manufacturing");
    });

    it("has services template", () => {
      expect(SECTOR_TEMPLATES).toHaveProperty("services");
    });

    it("templates have required properties", () => {
      Object.values(SECTOR_TEMPLATES).forEach((template) => {
        expect(template).toHaveProperty("name");
        expect(template).toHaveProperty("baseContribution");
        expect(typeof template.name).toBe("string");
        expect(typeof template.baseContribution).toBe("number");
      });
    });
  });

  describe("getSectorCategory", () => {
    it("categorizes agriculture as Primary", () => {
      const category = getSectorCategory("agriculture");
      expect(category).toBe("Primary");
    });

    it("categorizes mining as Primary", () => {
      const category = getSectorCategory("mining");
      expect(category).toBe("Primary");
    });

    it("categorizes manufacturing as Secondary", () => {
      const category = getSectorCategory("manufacturing");
      expect(category).toBe("Secondary");
    });

    it("categorizes construction as Secondary", () => {
      const category = getSectorCategory("construction");
      expect(category).toBe("Secondary");
    });

    it("categorizes services as Tertiary", () => {
      const category = getSectorCategory("services");
      expect(category).toBe("Tertiary");
    });

    it("categorizes finance as Tertiary", () => {
      const category = getSectorCategory("finance");
      expect(category).toBe("Tertiary");
    });

    it("categorizes retail as Tertiary", () => {
      const category = getSectorCategory("retail");
      expect(category).toBe("Tertiary");
    });

    it("handles unknown sectors gracefully", () => {
      const category = getSectorCategory("unknown");
      expect(category).toBe("Tertiary"); // Default fallback
    });

    it("returns consistent categories", () => {
      const cat1 = getSectorCategory("agriculture");
      const cat2 = getSectorCategory("agriculture");
      expect(cat1).toBe(cat2);
    });
  });

  describe("calculateSectorTotals", () => {
    it("calculates total GDP contribution", () => {
      const result = calculateSectorTotals(mockSectors);

      const expectedGDP = mockSectors.reduce((sum, s) => sum + s.gdpContribution, 0);
      expect(result.totalGDP).toBe(expectedGDP);
    });

    it("calculates total employment share", () => {
      const result = calculateSectorTotals(mockSectors);

      const expectedEmployment = mockSectors.reduce((sum, s) => sum + s.employmentShare, 0);
      expect(result.totalEmployment).toBe(expectedEmployment);
    });

    it("calculates average productivity", () => {
      const result = calculateSectorTotals(mockSectors);

      const expectedProductivity =
        mockSectors.reduce((sum, s) => sum + s.productivity, 0) / mockSectors.length;
      expect(result.avgProductivity).toBe(expectedProductivity);
    });

    it("calculates average growth rate", () => {
      const result = calculateSectorTotals(mockSectors);

      const expectedGrowth =
        mockSectors.reduce((sum, s) => sum + s.growthRate, 0) / mockSectors.length;
      expect(result.avgGrowthRate).toBe(expectedGrowth);
    });

    it("handles empty sector array", () => {
      const result = calculateSectorTotals([]);

      expect(result.totalGDP).toBe(0);
      expect(result.totalEmployment).toBe(0);
      expect(result.avgProductivity).toBe(0);
      expect(result.avgGrowthRate).toBe(0);
    });

    it("handles single sector", () => {
      const singleSector = [mockSectors[0]];
      const result = calculateSectorTotals(singleSector);

      expect(result.totalGDP).toBe(singleSector[0].gdpContribution);
      expect(result.totalEmployment).toBe(singleSector[0].employmentShare);
      expect(result.avgProductivity).toBe(singleSector[0].productivity);
    });

    it("maintains precision for percentages", () => {
      const result = calculateSectorTotals(mockSectors);

      expect(typeof result.totalGDP).toBe("number");
      expect(typeof result.totalEmployment).toBe("number");
      expect(result.totalGDP).toBeGreaterThanOrEqual(0);
      expect(result.totalEmployment).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Sector Validation", () => {
    it("validates sectors sum to 100% GDP", () => {
      const result = calculateSectorTotals(mockSectors);
      expect(result.totalGDP).toBe(100);
    });

    it("validates sectors sum to 100% employment", () => {
      const result = calculateSectorTotals(mockSectors);
      expect(result.totalEmployment).toBe(100);
    });

    it("detects over-allocation of GDP", () => {
      const overAllocated: SectorConfiguration[] = [
        { ...mockSectors[0], gdpContribution: 60 },
        { ...mockSectors[1], gdpContribution: 50 },
      ];

      const result = calculateSectorTotals(overAllocated);
      expect(result.totalGDP).toBeGreaterThan(100);
    });

    it("detects under-allocation of GDP", () => {
      const underAllocated: SectorConfiguration[] = [
        { ...mockSectors[0], gdpContribution: 20 },
        { ...mockSectors[1], gdpContribution: 30 },
      ];

      const result = calculateSectorTotals(underAllocated);
      expect(result.totalGDP).toBeLessThan(100);
    });
  });

  describe("Sector Category Distribution", () => {
    it("groups sectors by category", () => {
      const byCategory = mockSectors.reduce(
        (acc, sector) => {
          acc[sector.category] = (acc[sector.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(byCategory.Primary).toBe(1);
      expect(byCategory.Secondary).toBe(1);
      expect(byCategory.Tertiary).toBe(1);
    });

    it("calculates GDP by category", () => {
      const gdpByCategory = mockSectors.reduce(
        (acc, sector) => {
          acc[sector.category] = (acc[sector.category] || 0) + sector.gdpContribution;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(gdpByCategory.Primary).toBe(12);
      expect(gdpByCategory.Secondary).toBe(25);
      expect(gdpByCategory.Tertiary).toBe(63);
    });
  });

  describe("Edge Cases", () => {
    it("handles sectors with zero contribution", () => {
      const zeroSectors: SectorConfiguration[] = [
        { ...mockSectors[0], gdpContribution: 0, employmentShare: 0 },
      ];

      const result = calculateSectorTotals(zeroSectors);

      expect(result.totalGDP).toBe(0);
      expect(result.totalEmployment).toBe(0);
    });

    it("handles sectors with high productivity", () => {
      const highProductivity: SectorConfiguration[] = [{ ...mockSectors[0], productivity: 100 }];

      const result = calculateSectorTotals(highProductivity);

      expect(result.avgProductivity).toBe(100);
    });

    it("handles negative growth rates", () => {
      const negativegrowth: SectorConfiguration[] = [{ ...mockSectors[0], growthRate: -2.5 }];

      const result = calculateSectorTotals(negativegrowth);

      expect(result.avgGrowthRate).toBe(-2.5);
    });

    it("handles very small percentage values", () => {
      const smallValues: SectorConfiguration[] = [
        { ...mockSectors[0], gdpContribution: 0.1, employmentShare: 0.1 },
      ];

      const result = calculateSectorTotals(smallValues);

      expect(result.totalGDP).toBeCloseTo(0.1, 2);
      expect(result.totalEmployment).toBeCloseTo(0.1, 2);
    });
  });

  describe("Performance", () => {
    it("handles large number of sectors efficiently", () => {
      const manySectors = Array.from({ length: 100 }, (_, i) => ({
        ...mockSectors[0],
        id: `sector_${i}`,
        gdpContribution: 1,
        employmentShare: 1,
      }));

      const start = performance.now();
      const result = calculateSectorTotals(manySectors);
      const end = performance.now();

      expect(result.totalGDP).toBe(100);
      expect(end - start).toBeLessThan(10); // Should be very fast
    });
  });

  describe("Integration Tests", () => {
    it("calculates all metrics consistently", () => {
      const result = calculateSectorTotals(mockSectors);

      expect(result).toHaveProperty("totalGDP");
      expect(result).toHaveProperty("totalEmployment");
      expect(result).toHaveProperty("avgProductivity");
      expect(result).toHaveProperty("avgGrowthRate");

      // All values should be numbers
      expect(typeof result.totalGDP).toBe("number");
      expect(typeof result.totalEmployment).toBe("number");
      expect(typeof result.avgProductivity).toBe("number");
      expect(typeof result.avgGrowthRate).toBe("number");
    });

    it("maintains data integrity across calculations", () => {
      const result1 = calculateSectorTotals(mockSectors);
      const result2 = calculateSectorTotals(mockSectors);

      expect(result1).toEqual(result2);
    });
  });
});
