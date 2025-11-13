/**
 * Budget Vault Calculator
 *
 * Calculates passive income multipliers based on budget allocation decisions.
 *
 * Formula: Sum of (categoryAllocation% * vaultMultiplier)
 *
 * Example Calculation:
 * - 30% Economic Development (2.0x multiplier) = 0.30 * 2.0 = 0.60
 * - 25% Military (0.5x multiplier) = 0.25 * 0.5 = 0.125
 * - 20% Education (1.5x multiplier) = 0.20 * 1.5 = 0.30
 * - 15% Healthcare (1.3x multiplier) = 0.15 * 1.3 = 0.195
 * - 10% Infrastructure (1.8x multiplier) = 0.10 * 1.8 = 0.18
 * Total Budget Multiplier: 1.395x (39.5% boost to passive income)
 *
 * Usage:
 *   import { budgetVaultCalculator } from '~/lib/budget-vault-calculator';
 *   const multiplier = await budgetVaultCalculator.calculateBudgetMultiplier(countryId, db);
 */

import { type PrismaClient } from "@prisma/client";

/**
 * Budget category multiplier breakdown
 */
export interface BudgetMultiplierBreakdown {
  /** Department category (e.g., "Economic Development", "Defense") */
  category: string;
  /** Department name */
  departmentName: string;
  /** Vault multiplier for this category (0.5x - 3.0x) */
  multiplier: number;
  /** Percentage of total budget allocated to this category (0-100) */
  allocatedPercent: number;
  /** Contribution to total multiplier (allocatedPercent * multiplier / 100) */
  contribution: number;
}

/**
 * Budget Vault Calculator
 * Calculates passive income multipliers based on budget allocation
 */
export class BudgetVaultCalculator {
  /**
   * Calculate total budget multiplier for passive income
   *
   * @param countryId Country ID
   * @param db Prisma database client
   * @returns Total budget multiplier (typically 0.8x - 2.0x)
   *
   * @example
   * ```typescript
   * const multiplier = await calculator.calculateBudgetMultiplier(countryId, db);
   * // Returns: 1.395 (39.5% boost to passive income)
   * ```
   */
  async calculateBudgetMultiplier(countryId: string, db: PrismaClient): Promise<number> {
    try {
      // Get government structure for the country
      const govStructure = await db.governmentStructure.findUnique({
        where: { countryId },
        include: {
          departments: {
            include: {
              budgetAllocations: {
                orderBy: { budgetYear: "desc" },
                take: 1, // Get most recent allocation
              },
              subBudgets: true,
            },
          },
        },
      });

      if (!govStructure || govStructure.departments.length === 0) {
        console.log(`[Budget Vault Calculator] No government structure found for ${countryId}, using default 1.0x`);
        return 1.0;
      }

      let totalWeightedMultiplier = 0;
      let totalAllocatedPercent = 0;

      // Calculate weighted multiplier from budget allocations
      for (const department of govStructure.departments) {
        const recentAllocation = department.budgetAllocations[0];

        if (!recentAllocation) continue;

        // Get average vault multiplier from sub-budgets
        const subBudgets = department.subBudgets;
        const avgMultiplier = subBudgets.length > 0
          ? subBudgets.reduce((sum, sb) => sum + sb.vaultMultiplier, 0) / subBudgets.length
          : 1.0; // Default to neutral if no sub-budgets

        const allocatedPercent = recentAllocation.allocatedPercent;
        const contribution = (allocatedPercent / 100) * avgMultiplier;

        totalWeightedMultiplier += contribution;
        totalAllocatedPercent += allocatedPercent;
      }

      // If less than 100% allocated, assume remaining goes to neutral categories (1.0x)
      if (totalAllocatedPercent < 100) {
        const remainingPercent = 100 - totalAllocatedPercent;
        totalWeightedMultiplier += (remainingPercent / 100) * 1.0;
      }

      // Round to 3 decimal places
      const finalMultiplier = Math.round(totalWeightedMultiplier * 1000) / 1000;

      console.log(
        `[Budget Vault Calculator] Calculated multiplier for ${countryId}: ${finalMultiplier}x ` +
        `(${totalAllocatedPercent.toFixed(1)}% allocated)`
      );

      return finalMultiplier;
    } catch (error) {
      console.error(`[Budget Vault Calculator] Error calculating multiplier for ${countryId}:`, error);
      return 1.0; // Default to neutral on error
    }
  }

  /**
   * Get detailed breakdown of budget multiplier by category
   *
   * @param countryId Country ID
   * @param db Prisma database client
   * @returns Array of budget multiplier breakdowns
   *
   * @example
   * ```typescript
   * const breakdown = await calculator.getBudgetBreakdown(countryId, db);
   * // Returns:
   * // [
   * //   { category: "Economic", departmentName: "Ministry of Trade", multiplier: 2.0, allocatedPercent: 30, contribution: 0.60 },
   * //   { category: "Defense", departmentName: "Ministry of Defense", multiplier: 0.5, allocatedPercent: 25, contribution: 0.125 },
   * //   ...
   * // ]
   * ```
   */
  async getBudgetBreakdown(countryId: string, db: PrismaClient): Promise<BudgetMultiplierBreakdown[]> {
    try {
      const govStructure = await db.governmentStructure.findUnique({
        where: { countryId },
        include: {
          departments: {
            include: {
              budgetAllocations: {
                orderBy: { budgetYear: "desc" },
                take: 1,
              },
              subBudgets: true,
            },
          },
        },
      });

      if (!govStructure) {
        return [];
      }

      const breakdown: BudgetMultiplierBreakdown[] = [];

      for (const department of govStructure.departments) {
        const recentAllocation = department.budgetAllocations[0];

        if (!recentAllocation) continue;

        const subBudgets = department.subBudgets;
        const avgMultiplier = subBudgets.length > 0
          ? subBudgets.reduce((sum, sb) => sum + sb.vaultMultiplier, 0) / subBudgets.length
          : 1.0;

        const allocatedPercent = recentAllocation.allocatedPercent;
        const contribution = (allocatedPercent / 100) * avgMultiplier;

        breakdown.push({
          category: department.category,
          departmentName: department.name,
          multiplier: Math.round(avgMultiplier * 100) / 100,
          allocatedPercent: Math.round(allocatedPercent * 100) / 100,
          contribution: Math.round(contribution * 1000) / 1000,
        });
      }

      // Sort by contribution (highest first)
      breakdown.sort((a, b) => b.contribution - a.contribution);

      return breakdown;
    } catch (error) {
      console.error(`[Budget Vault Calculator] Error getting breakdown for ${countryId}:`, error);
      return [];
    }
  }

  /**
   * Get budget multiplier impact description
   *
   * @param multiplier Budget multiplier value
   * @returns Human-readable description
   *
   * @example
   * ```typescript
   * getMultiplierDescription(1.395); // Returns: "Strong economic focus (+40% passive income)"
   * getMultiplierDescription(0.85);  // Returns: "Heavy military spending (-15% passive income)"
   * ```
   */
  getMultiplierDescription(multiplier: number): string {
    const percentChange = Math.round((multiplier - 1.0) * 100);

    if (multiplier >= 1.5) {
      return `Exceptional economic focus (+${percentChange}% passive income)`;
    } else if (multiplier >= 1.2) {
      return `Strong economic focus (+${percentChange}% passive income)`;
    } else if (multiplier >= 1.05) {
      return `Moderate economic focus (+${percentChange}% passive income)`;
    } else if (multiplier >= 0.95) {
      return `Balanced budget (${percentChange >= 0 ? '+' : ''}${percentChange}% passive income)`;
    } else if (multiplier >= 0.8) {
      return `Heavy military/security spending (${percentChange}% passive income)`;
    } else {
      return `Extreme defense allocation (${percentChange}% passive income)`;
    }
  }
}

// Export singleton instance
export const budgetVaultCalculator = new BudgetVaultCalculator();
