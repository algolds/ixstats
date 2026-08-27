import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import type { TaxBuilderState } from "~/types/builder/tax-builder";
import type { GovernmentBuilderState } from "~/types/government";
import { detectTaxConflicts } from "~/server/services/builderIntegrationService";
import { TaxBuilderStateSchema } from "~/types/tax-system";
import {
  parseEconomicDataForTaxSystem,
  calculateRecommendedTaxRevenue,
} from "~/lib/economy/tax-data-parser";

// Validation helpers for brackets
// oxlint-disable-next-line typescript/no-unused-vars
function validateBracketsState(
  state: TaxBuilderState
): { ok: true } | { ok: false; errors: Array<{ categoryIndex: number; message: string }> } {
  const errors: Array<{ categoryIndex: number; message: string }> = [];
  Object.entries(state.brackets).forEach(([key, brackets]) => {
    const idx = parseInt(key);
    if (!Array.isArray(brackets) || brackets.length === 0) return;

    // Sort a copy by minIncome for deterministic checks
    const sorted = [...brackets].sort((a, b) => a.minIncome - b.minIncome);

    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i];
      if (b.rate < 0 || b.rate > 100) {
        errors.push({
          categoryIndex: idx,
          message: `Bracket ${i + 1}: rate must be between 0 and 100`,
        });
      }
      if (b.maxIncome !== undefined && b.minIncome >= b.maxIncome) {
        errors.push({
          categoryIndex: idx,
          message: `Bracket ${i + 1}: maxIncome must be greater than minIncome`,
        });
      }
      if (i > 0) {
        const prev = sorted[i - 1];
        const prevEnd = prev.maxIncome ?? Number.POSITIVE_INFINITY;
        // Overlap check
        if (b.minIncome < prevEnd) {
          errors.push({
            categoryIndex: idx,
            message: `Bracket ${i + 1}: overlaps previous bracket (min ${b.minIncome} < previous max ${prev.maxIncome ?? "∞"})`,
          });
        }
      }
    }
  });

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export const taxSystemAnalysisRouter = createTRPCRouter({
  // Parse economic data for tax system
  parseEconomicDataForTax: publicProcedure
    .input(
      z.object({
        coreIndicators: z.object({
          gdpPerCapita: z.number(),
          nominalGDP: z.number(),
          population: z.number(),
        }),
        governmentData: z
          .object({
            totalBudget: z.number().optional(),
            spendingByCategory: z.record(z.string(), z.number()).optional(),
            governmentType: z.string().optional(),
            governmentEffectiveness: z.number().min(0).max(100).optional(),
            ruleOfLaw: z.number().min(0).max(100).optional(),
            corruptionIndex: z.number().min(0).max(100).optional(),
          })
          .optional(),
        options: z
          .object({
            useAggressiveParsing: z.boolean().optional(),
            includeGovernmentPolicies: z.boolean().optional(),
            autoGenerateBrackets: z.boolean().optional(),
            targetRevenueMatch: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Convert partial governmentData to GovernmentBuilderState format
      const governmentBuilderData: GovernmentBuilderState | undefined = input.governmentData
        ? {
            structure: {
              governmentName: "National Government",
              governmentType: (input.governmentData.governmentType ||
                "Federal Republic") as GovernmentBuilderState["structure"]["governmentType"],
              totalBudget: input.governmentData.totalBudget || 0,
              fiscalYear: "calendar",
              budgetCurrency: "USD",
            },
            departments: [],
            budgetAllocations: [],
            revenueSources: [],
            isValid: true,
            errors: {},
          }
        : undefined;

      const parsedData = parseEconomicDataForTaxSystem(
        input.coreIndicators as any,
        governmentBuilderData,
        input.options
      );

      let revenueRecommendations = null;
      if (governmentBuilderData) {
        revenueRecommendations = calculateRecommendedTaxRevenue(
          governmentBuilderData,
          input.coreIndicators as any
        );
      }

      return {
        parsedData,
        revenueRecommendations,
      };
    }),

  // Calculate tax effectiveness with government components
  calculateTaxEffectiveness: publicProcedure
    .input(
      z.object({
        taxComponents: z.array(z.string()),
        governmentComponents: z.array(z.string()),
        economicData: z.object({
          gdpPerCapita: z.number(),
          nominalGDP: z.number(),
          population: z.number(),
        }),
        baseTaxSystem: z.object({
          collectionEfficiency: z.number(),
          complianceRate: z.number(),
          auditCapacity: z.number().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      // Calculate synergies between tax and government components
      const governmentBonus = input.governmentComponents.length * 2; // +2% per component
      const taxComponentBonus = input.taxComponents.length * 1.5; // +1.5% per tax component

      // Calculate effectiveness modifiers based on economic tier
      const gdpPerCapita = input.economicData.gdpPerCapita;
      const economicTierMultiplier = gdpPerCapita > 50000 ? 1.1 : gdpPerCapita > 25000 ? 1.05 : 1.0;

      const enhancedEffectiveness = {
        collectionEfficiency: Math.min(
          100,
          (input.baseTaxSystem.collectionEfficiency + governmentBonus + taxComponentBonus) *
            economicTierMultiplier
        ),
        complianceRate: Math.min(
          100,
          (input.baseTaxSystem.complianceRate + governmentBonus + taxComponentBonus) *
            economicTierMultiplier
        ),
        auditCapacity: Math.min(
          100,
          ((input.baseTaxSystem.auditCapacity || 60) + governmentBonus + taxComponentBonus) *
            economicTierMultiplier
        ),
        netBonus: governmentBonus + taxComponentBonus,
        economicTierMultiplier,
      };

      return enhancedEffectiveness;
    }),

  // Check for conflicts before creating/updating
  checkConflicts: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: TaxBuilderStateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const warnings = await detectTaxConflicts(
        ctx.db as any,
        input.countryId,
        input.data as TaxBuilderState
      );
      return { warnings };
    }),

  // Get tax system by country ID

  // Create tax system

  // Update tax system

  // Delete tax system

  // Autosave tax system (partial updates)

  // Parse economic data for tax system with advanced intelligence
  parseEconomicData: protectedProcedure
    .input(
      z.object({
        economicData: z.object({
          gdpPerCapita: z.number(),
          nominalGDP: z.number(),
          population: z.number(),
        }),
        governmentData: z
          .object({
            totalBudget: z.number().optional(),
            spendingByCategory: z.record(z.string(), z.number()).optional(),
            governmentType: z.string().optional(),
            governmentEffectiveness: z.number().min(0).max(100).optional(),
            ruleOfLaw: z.number().min(0).max(100).optional(),
            corruptionIndex: z.number().min(0).max(100).optional(),
          })
          .optional(),
        options: z
          .object({
            useAggressiveParsing: z.boolean().optional(),
            includeGovernmentPolicies: z.boolean().optional(),
            autoGenerateBrackets: z.boolean().optional(),
            targetRevenueMatch: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Convert partial governmentData to GovernmentBuilderState format
      const governmentBuilderData: GovernmentBuilderState | undefined = input.governmentData
        ? {
            structure: {
              governmentName: "National Government",
              governmentType: (input.governmentData.governmentType ||
                "Federal Republic") as GovernmentBuilderState["structure"]["governmentType"],
              totalBudget: input.governmentData.totalBudget || 0,
              fiscalYear: "calendar",
              budgetCurrency: "USD",
            },
            departments: [],
            budgetAllocations: [],
            revenueSources: [],
            isValid: true,
            errors: {},
          }
        : undefined;

      // Call the parser function from tax-data-parser
      const parsedData = parseEconomicDataForTaxSystem(
        input.economicData as any,
        governmentBuilderData,
        input.options
      );

      // Calculate revenue recommendations if government data provided
      let revenueRecommendations = null;
      if (governmentBuilderData) {
        revenueRecommendations = calculateRecommendedTaxRevenue(
          governmentBuilderData,
          input.economicData as any
        );
      }

      return {
        parsedData,
        revenueRecommendations,
      };
    }),

  // Calculate unified tax effectiveness with government components

  // Get tier-based tax recommendations for a country

  // Real-time live tax calculation with full atomic component integration
});
