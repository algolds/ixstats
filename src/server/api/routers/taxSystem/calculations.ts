import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import type { TaxBuilderState } from "~/types/builder/tax-builder";

import {
  getUnifiedTaxEffectiveness,
  getTaxEconomyImpact,
} from "~/lib/economy/unified-atomic-tax-integration";
import { ComponentType } from "@prisma/client";
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

  // Real-time live tax calculation with full atomic component integration
  calculateLiveTax: publicProcedure
    .input(
      z.object({
        taxSystemId: z.string(),
        countryId: z.string(),
        income: z.number(),
        corporateIncome: z.number().optional(),
        deductions: z
          .array(
            z.object({
              deductionId: z.string(),
              amount: z.number(),
              description: z.string().optional(),
            })
          )
          .optional(),
        exemptions: z
          .array(
            z.object({
              exemptionId: z.string(),
              amount: z.number(),
              description: z.string().optional(),
            })
          )
          .optional(),
        taxYear: z.number().optional(),
        // Sector data for corporate calculations
        sectorData: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              gdpContribution: z.number(),
              taxRate: z.number().optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch tax system with all components
      const taxSystem = await ctx.db.taxSystem.findUnique({
        where: { id: input.taxSystemId },
        include: {
          taxCategories: {
            include: {
              taxBrackets: true,
              taxExemptions: true,
              taxDeductions: true,
            },
          },
          country: {
            include: {
              governmentComponents: true,
              economicComponents: true,
            },
          },
        },
      });

      if (!taxSystem) {
        throw new Error("Tax system not found");
      }

      // Fetch government components
      const governmentComponents = await ctx.db.governmentComponent.findMany({
        where: { countryId: input.countryId },
        select: { componentType: true },
      });

      // Fetch economic components
      const economicComponents = await ctx.db.economicComponent.findMany({
        where: { countryId: input.countryId },
        select: { componentType: true },
      });

      // Get economic data
      const economicData = {
        gdpPerCapita: taxSystem.country.currentGdpPerCapita,
        nominalGDP: taxSystem.country.currentGdpPerCapita * taxSystem.country.currentPopulation,
        population: taxSystem.country.currentPopulation,
        giniCoefficient: 0.35, // Default
        gdpGrowthRate: taxSystem.country.realGDPGrowthRate || 0.03,
        formalEconomyShare: 0.8,
        consumptionGDPPercent: 60,
        exportsGDPPercent: 30,
      };

      // Calculate base tax using TaxCalculatorEngine logic
      const activeTaxCategories = taxSystem.taxCategories.filter((c) => c.isActive);
      const activeBrackets = taxSystem.taxCategories.flatMap((c) =>
        c.taxBrackets.filter((b) => b.isActive)
      );
      const activeExemptions = taxSystem.taxCategories.flatMap((c) =>
        c.taxExemptions.filter((e) => e.isActive)
      );
      const activeDeductions = taxSystem.taxCategories.flatMap((c) =>
        c.taxDeductions.filter((d) => d.isActive)
      );

      // Calculate total exemptions
      let totalExemptions = 0;
      const systemExemptions = activeExemptions.filter((e) => !e.categoryId);
      for (const exemption of systemExemptions) {
        if (exemption.exemptionAmount) {
          totalExemptions += exemption.exemptionAmount;
        } else if (exemption.exemptionRate) {
          totalExemptions += (input.income * exemption.exemptionRate) / 100;
        }
      }

      for (const requested of input.exemptions || []) {
        const exemption = activeExemptions.find((e) => e.id === requested.exemptionId);
        if (exemption) {
          totalExemptions += requested.amount;
        }
      }

      // Calculate total deductions
      let totalDeductions = 0;
      for (const category of activeTaxCategories) {
        if (category.deductionAllowed && category.standardDeduction) {
          totalDeductions += category.standardDeduction;
        }
      }

      for (const requested of input.deductions || []) {
        const deduction = activeDeductions.find((d) => d.id === requested.deductionId);
        if (deduction) {
          let deductionAmount = requested.amount;

          if (deduction.maximumAmount) {
            deductionAmount = Math.min(deductionAmount, deduction.maximumAmount);
          }

          if (deduction.percentage) {
            const percentageLimit = (input.income * deduction.percentage) / 100;
            deductionAmount = Math.min(deductionAmount, percentageLimit);
          }

          totalDeductions += deductionAmount;
        }
      }

      // Calculate adjusted gross income
      const adjustedGrossIncome = Math.max(0, input.income - totalExemptions);
      const taxableIncome = Math.max(0, adjustedGrossIncome - totalDeductions);

      // Calculate government component modifiers
      const governmentComponentTypes = governmentComponents
        .map((gc) => gc.componentType)
        .filter((ct): ct is ComponentType =>
          Object.values(ComponentType).includes(ct as ComponentType)
        );
      let governmentBonus = 0;
      const taxBoostComponents: ComponentType[] = [
        ComponentType.PROFESSIONAL_BUREAUCRACY,
        ComponentType.RULE_OF_LAW,
        ComponentType.TECHNOCRATIC_AGENCIES,
        ComponentType.DIGITAL_GOVERNMENT,
      ];

      for (const comp of governmentComponentTypes) {
        if (taxBoostComponents.includes(comp)) {
          governmentBonus += 0.08; // 8% boost for tax-efficient components
        } else {
          governmentBonus += 0.02; // 2% baseline boost
        }
      }

      // Calculate economic component modifiers
      const economicComponentTypes = economicComponents.map((ec) => ec.componentType);
      const economicBonus = economicComponentTypes.length * 0.05; // 5% boost per component

      // Calculate unified effectiveness multiplier
      const economicTierMultiplier =
        economicData.gdpPerCapita > 50000 ? 1.1 : economicData.gdpPerCapita > 25000 ? 1.05 : 1.0;

      const taxCollectionEfficiency =
        (1 + governmentBonus + economicBonus) * economicTierMultiplier;

      // Calculate base tax effectiveness
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
          taxCategories: activeTaxCategories.map((cat) => ({
            ...cat,
            description: cat.description ?? undefined,
            baseRate: cat.baseRate ?? undefined,
            color: cat.color ?? undefined,
            icon: cat.icon ?? undefined,
            maximumAmount: cat.maximumAmount ?? undefined,
            exemptionAmount: cat.exemptionAmount ?? undefined,
            standardDeduction: cat.standardDeduction ?? undefined,
            minimumAmount: cat.minimumAmount ?? undefined,
            taxBrackets: cat.taxBrackets?.map((bracket) => ({
              ...bracket,
              bracketName: bracket.bracketName ?? undefined,
              maxIncome: bracket.maxIncome ?? undefined,
              flatAmount: bracket.flatAmount ?? undefined,
            })),
            taxExemptions: cat.taxExemptions?.map((exemption) => ({
              ...exemption,
              description: exemption.description ?? undefined,
              startDate: exemption.startDate ?? undefined,
              endDate: exemption.endDate ?? undefined,
              categoryId: exemption.categoryId ?? undefined,
              exemptionName: exemption.exemptionName ?? undefined,
              exemptionAmount: exemption.exemptionAmount ?? undefined,
              exemptionRate: exemption.exemptionRate ?? undefined,
              qualifications: exemption.qualifications ?? undefined,
            })),
            taxDeductions: cat.taxDeductions?.map((deduction) => ({
              ...deduction,
              description: deduction.description ?? undefined,
              categoryId: deduction.categoryId ?? undefined,
              deductionName: deduction.deductionName ?? undefined,
              maximumAmount: deduction.maximumAmount ?? undefined,
              percentage: deduction.percentage ?? undefined,
              qualifications: deduction.qualifications ?? undefined,
            })),
          })),
        },
        governmentComponentTypes,
        economicData
      );

      // Calculate tax by category
      const breakdown: Array<{
        categoryId: string;
        categoryName: string;
        taxableAmount: number;
        taxOwed: number;
        rate: number;
        exemptions: number;
        deductions: number;
      }> = [];

      let baseTaxOwed = 0;

      for (const category of activeTaxCategories) {
        let categoryTaxableAmount = taxableIncome;
        let categoryExemptions = 0;
        let categoryDeductions = 0;

        // Apply category-specific minimums and maximums
        if (category.minimumAmount && categoryTaxableAmount < category.minimumAmount) {
          categoryTaxableAmount = 0;
        }

        if (category.maximumAmount && categoryTaxableAmount > category.maximumAmount) {
          categoryTaxableAmount = category.maximumAmount;
        }

        // Apply category-specific exemptions
        if (category.exemptionAmount) {
          categoryExemptions = category.exemptionAmount;
          categoryTaxableAmount = Math.max(0, categoryTaxableAmount - categoryExemptions);
        }

        // Apply category-specific deductions
        if (category.deductionAllowed && category.standardDeduction) {
          categoryDeductions = category.standardDeduction;
          categoryTaxableAmount = Math.max(0, categoryTaxableAmount - categoryDeductions);
        }

        // Calculate tax based on method
        let categoryTaxOwed = 0;
        if (category.calculationMethod === "percentage") {
          const rate = (category.baseRate || 0) / 100;
          categoryTaxOwed = categoryTaxableAmount * rate;
        } else if (
          category.calculationMethod === "progressive" ||
          category.calculationMethod === "tiered"
        ) {
          const categoryBrackets = activeBrackets
            .filter((b) => b.categoryId === category.id)
            .sort((a, b) => a.minIncome - b.minIncome);

          let remainingIncome = categoryTaxableAmount;
          for (const bracket of categoryBrackets) {
            if (remainingIncome <= 0) break;

            const bracketMin = bracket.minIncome;
            const bracketMax = bracket.maxIncome || Infinity;

            if (categoryTaxableAmount <= bracketMin) continue;

            const taxableInThisBracket = Math.min(
              remainingIncome,
              bracketMax - bracketMin,
              categoryTaxableAmount - bracketMin
            );

            if (taxableInThisBracket > 0) {
              const bracketTax = bracket.flatAmount || (taxableInThisBracket * bracket.rate) / 100;

              categoryTaxOwed += bracketTax;
              remainingIncome -= taxableInThisBracket;
            }
          }
        }

        breakdown.push({
          categoryId: category.id,
          categoryName: category.categoryName,
          taxableAmount: categoryTaxableAmount,
          taxOwed: categoryTaxOwed,
          rate: category.baseRate || 0,
          exemptions: categoryExemptions,
          deductions: categoryDeductions,
        });

        baseTaxOwed += categoryTaxOwed;
      }

      // Apply atomic component modifiers to tax owed
      const modifiedTaxOwed = baseTaxOwed * taxCollectionEfficiency;
      const effectiveRate = input.income > 0 ? (modifiedTaxOwed / input.income) * 100 : 0;

      // Calculate marginal rate
      let marginalRate = 0;
      for (const category of activeTaxCategories) {
        const categoryBrackets = activeBrackets
          .filter((b) => b.categoryId === category.id)
          .sort((a, b) => b.minIncome - a.minIncome);

        for (const bracket of categoryBrackets) {
          if (taxableIncome >= bracket.minIncome) {
            marginalRate = Math.max(marginalRate, bracket.rate);
            break;
          }
        }

        if (categoryBrackets.length === 0 && category.baseRate) {
          marginalRate = Math.max(marginalRate, category.baseRate);
        }
      }

      // Sector breakdown for corporate calculations
      let sectorBreakdown;
      if (input.sectorData && input.sectorData.length > 0 && economicData.nominalGDP) {
        sectorBreakdown = input.sectorData.map((sector) => {
          const sectorIncome =
            ((input.corporateIncome || input.income) * sector.gdpContribution) / 100;
          const sectorTaxRate = sector.taxRate || effectiveRate;
          const sectorTaxOwed = (sectorIncome * sectorTaxRate) / 100;

          return {
            sector: sector.name,
            income: sectorIncome,
            taxOwed: sectorTaxOwed * taxCollectionEfficiency,
            effectiveRate: sectorTaxRate,
          };
        });
      }

      return {
        taxableIncome,
        totalDeductions,
        totalExemptions,
        adjustedGrossIncome,
        taxOwed: modifiedTaxOwed,
        effectiveRate,
        marginalRate,
        breakdown: breakdown.map((cat) => ({
          ...cat,
          taxOwed: cat.taxOwed * taxCollectionEfficiency,
        })),
        appliedBrackets: [],
        // Atomic component data
        atomicModifiers: {
          taxCollectionEfficiency,
          governmentBonus,
          economicBonus,
          economicTierMultiplier,
          governmentComponents: governmentComponentTypes.length,
          economicComponents: economicComponentTypes.length,
        },
        effectiveness,
        sectorBreakdown,
        timestamp: new Date().toISOString(),
      };
    }),
});
