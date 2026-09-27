import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { TaxBuilderState } from "~/types/builder/tax-builder";

import {
  getUnifiedTaxEffectiveness,
  getTaxEconomyImpact,
} from "~/lib/economy/unified-atomic-tax-integration";
import { notificationHooks } from "~/lib/notifications/hooks";

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

export const taxSystemCalculationsRouter = createTRPCRouter({
  // Parse economic data for tax system

  // Calculate tax effectiveness with government components

  // Check for conflicts before creating/updating

  // Get tax system by country ID

  // Create tax system

  // Update tax system

  // Delete tax system

  // Autosave tax system (partial updates)

  // Parse economic data for tax system with advanced intelligence

  // Calculate unified tax effectiveness with government components
  calculateUnifiedEffectiveness: protectedProcedure
    .input(
      z.object({
        taxSystemId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Fetch tax system with all categories
      const taxSystem = await ctx.db.taxSystem.findUnique({
        where: { id: input.taxSystemId },
        include: {
          taxCategories: true,
          country: true,
        },
      });

      if (!taxSystem) {
        throw new Error("Tax system not found");
      }

      // Fetch user's government components
      const governmentComponents = await ctx.db.governmentComponent.findMany({
        where: { countryId: taxSystem.countryId },
        select: { componentType: true },
      });

      const componentTypes = governmentComponents.map((gc) => gc.componentType);

      // Get latest economic data
      const coreIndicator = taxSystem.country;
      if (!coreIndicator) {
        throw new Error("No economic data found for country");
      }

      // Prepare economic data object
      const economicData = {
        gdpPerCapita: taxSystem.country.currentGdpPerCapita,
        giniCoefficient: 0.35, // Default value since not available in Country model
        gdpGrowthRate: taxSystem.country.realGDPGrowthRate || 0.03,
        formalEconomyShare: 0.8, // Default, could be calculated
        consumptionGDPPercent: 60, // Default value since not available in Country model
        exportsGDPPercent: 30, // Default value since not available in Country model
      };

      // Calculate unified effectiveness
      const effectiveness = getUnifiedTaxEffectiveness(
        {
          ...taxSystem,
          taxAuthority: taxSystem.taxAuthority ?? undefined,
          taxCode: taxSystem.taxCode ?? undefined,
          baseRate: taxSystem.baseRate ?? undefined,
          flatTaxRate: taxSystem.flatTaxRate ?? undefined,
          alternativeMinRate: taxSystem.alternativeMinRate ?? undefined,
          taxHolidays: taxSystem.taxHolidays ?? undefined,
          complianceRate: taxSystem.complianceRate ?? undefined,
          collectionEfficiency: taxSystem.collectionEfficiency ?? undefined,
          lastReform: taxSystem.lastReform ?? undefined,
          taxCategories: taxSystem.taxCategories?.map((cat) => ({
            ...cat,
            description: cat.description ?? undefined,
            baseRate: cat.baseRate ?? undefined,
            color: cat.color ?? undefined,
            icon: cat.icon ?? undefined,
            maximumAmount: cat.maximumAmount ?? undefined,
            exemptionAmount: cat.exemptionAmount ?? undefined,
            standardDeduction: cat.standardDeduction ?? undefined,
            minimumAmount: cat.minimumAmount ?? undefined,
          })),
        },
        componentTypes,
        economicData
      );

      // Check for significant effectiveness changes and notify
      try {
        // Get previous effectiveness calculation (if exists in metadata or cache)
        const previousEffectiveness = taxSystem.collectionEfficiency || 75; // Default baseline
        const currentEffectiveness = effectiveness.overallScore || 0;
        const changePercent =
          previousEffectiveness > 0
            ? ((currentEffectiveness - previousEffectiveness) / previousEffectiveness) * 100
            : 0;

        // Notify if effectiveness changed significantly
        if (Math.abs(changePercent) > 10) {
          await notificationHooks.onTaxSystemChange({
            countryId: taxSystem.countryId,
            changeType: "effectiveness_change",
            systemName: taxSystem.taxSystemName,
            previousValue: previousEffectiveness,
            newValue: currentEffectiveness,
            changePercent,
          });
        }
      } catch (error) {
        console.error("[TaxSystem] Failed to send effectiveness change notification:", error);
      }

      return effectiveness;
    }),

  // Get tier-based tax recommendations for a country
  getTaxRecommendations: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Fetch country's economic data
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        include: {
          taxSystem: {
            include: {
              taxCategories: true,
            },
          },
        },
      });

      if (!country) {
        throw new Error("Country not found");
      }

      // Determine economic tier using country's economic data
      const gdpPerCapita = country.currentGdpPerCapita;
      let tier: string;
      if (gdpPerCapita >= 50000) {
        tier = "Advanced";
      } else if (gdpPerCapita >= 25000) {
        tier = "Developed";
      } else if (gdpPerCapita >= 10000) {
        tier = "Emerging";
      } else {
        tier = "Developing";
      }

      // Get tax economy impacts for existing or recommended categories
      let taxCategories = country.taxSystem?.taxCategories || [];

      // If no tax system exists, generate recommended categories
      if (taxCategories.length === 0) {
        // Generate basic recommended categories based on tier
        const recommendedTypes =
          tier === "Advanced" || tier === "Developed"
            ? ["INCOME", "CORPORATE", "SALES", "PROPERTY"]
            : ["INCOME", "SALES", "EXCISE"];

        taxCategories = recommendedTypes.map((type, idx) => ({
          id: `recommended-${idx}`,
          taxSystemId: "recommended",
          categoryName: type,
          categoryType: type,
          description: `Recommended ${type} tax for ${tier} economy`,
          isActive: true,
          baseRate: tier === "Advanced" ? 25 : tier === "Developed" ? 20 : 15,
          calculationMethod: "percentage",
          minimumAmount: 0,
          maximumAmount: null,
          exemptionAmount: null,
          deductionAllowed: true,
          standardDeduction: null,
          priority: 100 - idx * 10,
          color: "#3b82f6",
          icon: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
      }

      // Get economic impacts for recommendations
      const recommendations = getTaxEconomyImpact(
        taxCategories.map((cat) => ({
          ...cat,
          description: cat.description ?? undefined,
          baseRate: cat.baseRate ?? undefined,
          color: cat.color ?? undefined,
          icon: cat.icon ?? undefined,
          maximumAmount: cat.maximumAmount ?? undefined,
          exemptionAmount: cat.exemptionAmount ?? undefined,
          standardDeduction: cat.standardDeduction ?? undefined,
          minimumAmount: cat.minimumAmount ?? undefined,
        }))
      );

      return {
        tier,
        gdpPerCapita,
        recommendations,
        analysis: {
          currentTaxCount: country.taxSystem?.taxCategories?.length || 0,
          recommendedTaxCount: tier === "Advanced" || tier === "Developed" ? 5 : 3,
          complianceRate:
            country.taxSystem?.complianceRate ||
            (tier === "Advanced" ? 85 : tier === "Developed" ? 75 : 65),
          collectionEfficiency:
            country.taxSystem?.collectionEfficiency ||
            (tier === "Advanced" ? 90 : tier === "Developed" ? 80 : 70),
        },
      };
    }),
});
