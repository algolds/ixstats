import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import type { TaxBuilderState } from "~/components/tax-system/TaxBuilder";
import {
  detectTaxConflicts,
  syncTaxData,
  type ConflictWarning
} from "~/server/services/builderIntegrationService";
import { TaxBuilderStateSchema } from "~/types/validation/tax";
import { parseEconomicDataForTaxSystem, calculateRecommendedTaxRevenue } from "~/lib/tax-data-parser";
import { getUnifiedTaxEffectiveness, getTaxEconomyImpact } from "~/lib/unified-atomic-tax-integration";
import { ComponentType } from "@prisma/client";

// Validation helpers for brackets
function validateBracketsState(state: TaxBuilderState): { ok: true } | { ok: false; errors: Array<{ categoryIndex: number; message: string }> } {
  const errors: Array<{ categoryIndex: number; message: string }> = [];
  Object.entries(state.brackets).forEach(([key, brackets]) => {
    const idx = parseInt(key);
    if (!Array.isArray(brackets) || brackets.length === 0) return;

    // Sort a copy by minIncome for deterministic checks
    const sorted = [...brackets].sort((a, b) => a.minIncome - b.minIncome);

    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i];
      if (b.rate < 0 || b.rate > 100) {
        errors.push({ categoryIndex: idx, message: `Bracket ${i + 1}: rate must be between 0 and 100` });
      }
      if (b.maxIncome !== undefined && b.minIncome >= b.maxIncome) {
        errors.push({ categoryIndex: idx, message: `Bracket ${i + 1}: maxIncome must be greater than minIncome` });
      }
      if (i > 0) {
        const prev = sorted[i - 1];
        const prevEnd = prev.maxIncome ?? Number.POSITIVE_INFINITY;
        // Overlap check
        if (b.minIncome < prevEnd) {
          errors.push({ categoryIndex: idx, message: `Bracket ${i + 1}: overlaps previous bracket (min ${b.minIncome} < previous max ${prev.maxIncome ?? '∞'})` });
        }
      }
    }
  });

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export const taxSystemRouter = createTRPCRouter({
  // Parse economic data for tax system
  parseEconomicDataForTax: publicProcedure
    .input(z.object({
      coreIndicators: z.object({
        gdpPerCapita: z.number(),
        nominalGDP: z.number(),
        population: z.number(),
      }),
      governmentData: z.any().optional(),
      options: z.object({
        useAggressiveParsing: z.boolean().optional(),
        includeGovernmentPolicies: z.boolean().optional(),
        autoGenerateBrackets: z.boolean().optional(),
        targetRevenueMatch: z.boolean().optional(),
      }).optional()
    }))
    .mutation(async ({ input }) => {
      const parsedData = parseEconomicDataForTaxSystem(
        input.coreIndicators as any,
        input.governmentData,
        input.options
      );

      let revenueRecommendations = null;
      if (input.governmentData) {
        revenueRecommendations = calculateRecommendedTaxRevenue(
          input.governmentData,
          input.coreIndicators as any
        );
      }

      return {
        parsedData,
        revenueRecommendations
      };
    }),

  // Calculate tax effectiveness with government components
  calculateTaxEffectiveness: publicProcedure
    .input(z.object({
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
      })
    }))
    .mutation(async ({ input }) => {
      // Calculate synergies between tax and government components
      const governmentBonus = input.governmentComponents.length * 2; // +2% per component
      const taxComponentBonus = input.taxComponents.length * 1.5; // +1.5% per tax component

      // Calculate effectiveness modifiers based on economic tier
      const gdpPerCapita = input.economicData.gdpPerCapita;
      const economicTierMultiplier = gdpPerCapita > 50000 ? 1.1 : gdpPerCapita > 25000 ? 1.05 : 1.0;

      const enhancedEffectiveness = {
        collectionEfficiency: Math.min(100,
          (input.baseTaxSystem.collectionEfficiency + governmentBonus + taxComponentBonus) * economicTierMultiplier
        ),
        complianceRate: Math.min(100,
          (input.baseTaxSystem.complianceRate + governmentBonus + taxComponentBonus) * economicTierMultiplier
        ),
        auditCapacity: Math.min(100,
          ((input.baseTaxSystem.auditCapacity || 60) + governmentBonus + taxComponentBonus) * economicTierMultiplier
        ),
        netBonus: governmentBonus + taxComponentBonus,
        economicTierMultiplier,
      };

      return enhancedEffectiveness;
    }),

  // Check for conflicts before creating/updating
  checkConflicts: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      data: TaxBuilderStateSchema
    }))
    .mutation(async ({ ctx, input }) => {
      const warnings = await detectTaxConflicts(ctx.db, input.countryId, input.data as TaxBuilderState);
      return { warnings };
    }),

  // Get tax system by country ID
  getByCountryId: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const taxSystem = await ctx.db.taxSystem.findUnique({
        where: { countryId: input.countryId },
        include: {
          taxCategories: {
            include: {
              taxBrackets: true,
              taxExemptions: true,
              taxDeductions: true,
            },
          },
        },
      });

      if (!taxSystem) {
        return null;
      }

      // Transform database model to TaxBuilderState
      const builderState: TaxBuilderState = {
        taxSystem: {
          taxSystemName: taxSystem.taxSystemName,
          taxAuthority: taxSystem.taxAuthority || undefined,
          fiscalYear: taxSystem.fiscalYear as any,
          taxCode: taxSystem.taxCode || undefined,
          baseRate: taxSystem.baseRate || undefined,
          progressiveTax: taxSystem.progressiveTax,
          flatTaxRate: taxSystem.flatTaxRate || undefined,
          alternativeMinTax: taxSystem.alternativeMinTax,
          alternativeMinRate: taxSystem.alternativeMinRate || undefined,
          complianceRate: taxSystem.complianceRate || undefined,
          collectionEfficiency: taxSystem.collectionEfficiency || undefined,
        },
        categories: taxSystem.taxCategories.map((cat) => ({
          categoryName: cat.categoryName,
          categoryType: cat.categoryType,
          description: cat.description || undefined,
          baseRate: cat.baseRate || undefined,
          calculationMethod: cat.calculationMethod as any,
          isActive: true,
          deductionAllowed: true,
          priority: 1,
        })),
        brackets: taxSystem.taxCategories.reduce((acc: Record<string, any[]>, cat, idx) => {
          acc[idx.toString()] = cat.taxBrackets.map((bracket) => ({
            minIncome: bracket.minIncome,
            maxIncome: bracket.maxIncome || undefined,
            rate: bracket.rate,
            flatAmount: bracket.flatAmount || undefined,
            marginalRate: bracket.marginalRate,
            description: undefined, // Not in schema - could use bracketName
          }));
          return acc;
        }, {} as Record<string, any[]>),
        exemptions: taxSystem.taxCategories.flatMap((cat) =>
          cat.taxExemptions.map((exemption) => ({
            exemptionName: exemption.exemptionName,
            exemptionType: exemption.exemptionType,
            description: exemption.description || undefined,
            exemptionAmount: exemption.exemptionAmount || undefined,
            exemptionRate: exemption.exemptionRate || undefined,
            qualifications: exemption.qualifications || undefined,
            endDate: exemption.endDate || undefined,
            isActive: true,
          }))
        ),
        deductions: taxSystem.taxCategories.reduce((acc: Record<string, any[]>, cat, idx) => {
          acc[idx.toString()] = cat.taxDeductions.map((deduction) => ({
            deductionName: deduction.deductionName,
            deductionType: deduction.deductionType,
            description: deduction.description || undefined,
            maximumAmount: deduction.maximumAmount || undefined,
            percentage: deduction.percentage || undefined,
            phaseOutIncome: undefined, // Not in schema
            carryForward: undefined, // Not in schema
          }));
          return acc;
        }, {} as Record<string, any[]>),
        isValid: true,
        errors: {},
      };

      return builderState;
    }),

  // Create tax system
  create: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: TaxBuilderStateSchema,
        skipConflictCheck: z.boolean().optional().default(false)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = input.data as TaxBuilderState;
      const { skipConflictCheck } = input;

      // Server-side validation for bracket continuity/overlaps
      const bracketValidation = validateBracketsState(data);
      if (bracketValidation.ok === false) {
        return {
          taxSystem: null,
          syncResult: null,
          warnings: [],
          errors: bracketValidation.errors,
        } as any;
      }

      // Detect conflicts if not skipped
      let warnings: ConflictWarning[] = [];
      if (!skipConflictCheck) {
        warnings = await detectTaxConflicts(ctx.db, input.countryId, data);
      }

      // Create tax system with categories; fallback to update on unique constraint
      let taxSystem;
      try {
        taxSystem = await ctx.db.taxSystem.create({
          data: {
            countryId: input.countryId,
            taxSystemName: data.taxSystem.taxSystemName,
            taxAuthority: data.taxSystem.taxAuthority,
            fiscalYear: data.taxSystem.fiscalYear,
            taxCode: data.taxSystem.taxCode,
            baseRate: data.taxSystem.baseRate,
            progressiveTax: data.taxSystem.progressiveTax,
            flatTaxRate: data.taxSystem.flatTaxRate,
            alternativeMinTax: data.taxSystem.alternativeMinTax,
            alternativeMinRate: data.taxSystem.alternativeMinRate,
            complianceRate: data.taxSystem.complianceRate,
            collectionEfficiency: data.taxSystem.collectionEfficiency,
            taxCategories: {
              create: data.categories.map((cat, catIdx) => ({
                categoryName: cat.categoryName,
                categoryType: cat.categoryType,
                description: cat.description,
                baseRate: cat.baseRate,
                calculationMethod: cat.calculationMethod,
                taxBrackets: {
                  create: (data.brackets[catIdx.toString()] || []).map((bracket) => ({
                    minIncome: bracket.minIncome,
                    maxIncome: bracket.maxIncome,
                    rate: bracket.rate,
                    flatAmount: bracket.flatAmount,
                    marginalRate: bracket.marginalRate,
                    taxSystem: {
                      connect: { countryId: input.countryId }
                    }
                  })),
                },
                taxExemptions: {
                  create: data.exemptions
                    .filter((ex) => ex.exemptionName)
                    .map((exemption) => ({
                      exemptionName: exemption.exemptionName,
                      exemptionType: exemption.exemptionType,
                      description: exemption.description,
                      exemptionAmount: exemption.exemptionAmount,
                      exemptionRate: exemption.exemptionRate,
                      qualifications: exemption.qualifications,
                      endDate: exemption.endDate,
                      taxSystem: { connect: { countryId: input.countryId } },
                    })),
                },
                taxDeductions: {
                  create: (data.deductions[catIdx.toString()] || []).map((deduction) => ({
                    deductionName: deduction.deductionName,
                    deductionType: deduction.deductionType,
                    description: deduction.description,
                    maximumAmount: deduction.maximumAmount,
                    percentage: deduction.percentage,
                  })),
                },
              })),
            },
          },
          include: {
            taxCategories: {
              include: {
                taxBrackets: true,
                taxExemptions: true,
                taxDeductions: true,
              },
            },
          },
        });
      } catch (e: any) {
        const message = typeof e?.message === 'string' ? e.message : '';
        const uniqueViolation = message.includes('Unique constraint failed') || message.includes('P2002');
        if (!uniqueViolation) {
          throw e;
        }
        // Unique on countryId exists already: perform update path
        await ctx.db.taxCategory.deleteMany({
          where: {
            taxSystemId: {
              in: (await ctx.db.taxSystem.findMany({
                where: { countryId: input.countryId },
                select: { id: true }
              })).map(ts => ts.id)
            },
          },
        });

        taxSystem = await ctx.db.taxSystem.update({
          where: { countryId: input.countryId },
          data: {
            taxSystemName: data.taxSystem.taxSystemName,
            taxAuthority: data.taxSystem.taxAuthority,
            fiscalYear: data.taxSystem.fiscalYear,
            taxCode: data.taxSystem.taxCode,
            baseRate: data.taxSystem.baseRate,
            progressiveTax: data.taxSystem.progressiveTax,
            flatTaxRate: data.taxSystem.flatTaxRate,
            alternativeMinTax: data.taxSystem.alternativeMinTax,
            alternativeMinRate: data.taxSystem.alternativeMinRate,
            complianceRate: data.taxSystem.complianceRate,
            collectionEfficiency: data.taxSystem.collectionEfficiency,
            taxCategories: {
              create: data.categories.map((cat, catIdx) => ({
                categoryName: cat.categoryName,
                categoryType: cat.categoryType,
                description: cat.description,
                baseRate: cat.baseRate,
                calculationMethod: cat.calculationMethod,
                taxBrackets: {
                  create: (data.brackets[catIdx.toString()] || []).map((bracket) => ({
                    minIncome: bracket.minIncome,
                    maxIncome: bracket.maxIncome,
                    rate: bracket.rate,
                    flatAmount: bracket.flatAmount,
                    marginalRate: bracket.marginalRate,
                    taxSystem: {
                      connect: { countryId: input.countryId }
                    }
                  })),
                },
                taxExemptions: {
                  create: data.exemptions
                    .filter((ex) => ex.exemptionName)
                    .map((exemption) => ({
                      exemptionName: exemption.exemptionName,
                      exemptionType: exemption.exemptionType,
                      description: exemption.description,
                      exemptionAmount: exemption.exemptionAmount,
                      exemptionRate: exemption.exemptionRate,
                      qualifications: exemption.qualifications,
                      endDate: exemption.endDate,
                      taxSystem: { connect: { countryId: input.countryId } },
                    })),
                },
                taxDeductions: {
                  create: (data.deductions[catIdx.toString()] || []).map((deduction) => ({
                    deductionName: deduction.deductionName,
                    deductionType: deduction.deductionType,
                    description: deduction.description,
                    maximumAmount: deduction.maximumAmount,
                    percentage: deduction.percentage,
                  })),
                },
              })),
            },
          },
          include: {
            taxCategories: {
              include: {
                taxBrackets: true,
                taxExemptions: true,
                taxDeductions: true,
              },
            },
          },
        });
      }

      // Sync with FiscalSystem table
      const syncResult = await syncTaxData(ctx.db, input.countryId, data);

      return {
        taxSystem,
        syncResult,
        warnings
      };
    }),

  // Update tax system
  update: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: TaxBuilderStateSchema,
        skipConflictCheck: z.boolean().optional().default(false)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = input.data as TaxBuilderState;
      const { skipConflictCheck } = input;

      // Server-side validation for bracket continuity/overlaps
      const bracketValidation = validateBracketsState(data);
      if (bracketValidation.ok === false) {
        return {
          taxSystem: null,
          syncResult: null,
          warnings: [],
          errors: bracketValidation.errors,
        } as any;
      }

      // Detect conflicts if not skipped
      let warnings: ConflictWarning[] = [];
      if (!skipConflictCheck) {
        warnings = await detectTaxConflicts(ctx.db, input.countryId, data);
      }

      // Delete existing categories and recreate (easier than updating)
      await ctx.db.taxCategory.deleteMany({
        where: {
          taxSystemId: {
            in: (await ctx.db.taxSystem.findMany({
              where: { countryId: input.countryId },
              select: { id: true }
            })).map(ts => ts.id)
          },
        },
      });

      // Update tax system
      const taxSystem = await ctx.db.taxSystem.update({
        where: { countryId: input.countryId },
        data: {
          taxSystemName: data.taxSystem.taxSystemName,
          taxAuthority: data.taxSystem.taxAuthority,
          fiscalYear: data.taxSystem.fiscalYear,
          taxCode: data.taxSystem.taxCode,
          baseRate: data.taxSystem.baseRate,
          progressiveTax: data.taxSystem.progressiveTax,
          flatTaxRate: data.taxSystem.flatTaxRate,
          alternativeMinTax: data.taxSystem.alternativeMinTax,
          alternativeMinRate: data.taxSystem.alternativeMinRate,
          complianceRate: data.taxSystem.complianceRate,
          collectionEfficiency: data.taxSystem.collectionEfficiency,
          taxCategories: {
            create: data.categories.map((cat, catIdx) => ({
              categoryName: cat.categoryName,
              categoryType: cat.categoryType,
              description: cat.description,
              baseRate: cat.baseRate,
              calculationMethod: cat.calculationMethod,
              taxBrackets: {
                create: (data.brackets[catIdx.toString()] || []).map((bracket) => ({
                  minIncome: bracket.minIncome,
                  maxIncome: bracket.maxIncome,
                  rate: bracket.rate,
                  flatAmount: bracket.flatAmount,
                  marginalRate: bracket.marginalRate,
                  taxSystem: {
                    connect: { countryId: input.countryId }
                  }
                })),
              },
              taxExemptions: {
                create: data.exemptions
                  .filter((ex) => ex.exemptionName)
                  .map((exemption) => ({
                    exemptionName: exemption.exemptionName,
                    exemptionType: exemption.exemptionType,
                    description: exemption.description,
                    exemptionAmount: exemption.exemptionAmount,
                    exemptionRate: exemption.exemptionRate,
                    qualifications: exemption.qualifications,
                    endDate: exemption.endDate,
                    taxSystem: { connect: { countryId: input.countryId } },
                  })),
              },
              taxDeductions: {
                create: (data.deductions[catIdx.toString()] || []).map((deduction) => ({
                  deductionName: deduction.deductionName,
                  deductionType: deduction.deductionType,
                  description: deduction.description,
                  maximumAmount: deduction.maximumAmount,
                  percentage: deduction.percentage,
                })),
              },
            })),
          },
        },
        include: {
          taxCategories: {
            include: {
              taxBrackets: true,
              taxExemptions: true,
              taxDeductions: true,
            },
          },
        },
      });

      // Sync with FiscalSystem table
      const syncResult = await syncTaxData(ctx.db, input.countryId, data);

      return {
        taxSystem,
        syncResult,
        warnings
      };
    }),

  // Delete tax system
  delete: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.taxSystem.delete({
        where: { countryId: input.countryId },
      });
      return { success: true };
    }),

  // Parse economic data for tax system with advanced intelligence
  parseEconomicData: protectedProcedure
    .input(z.object({
      economicData: z.object({
        gdpPerCapita: z.number(),
        nominalGDP: z.number(),
        population: z.number(),
      }),
      governmentData: z.any().optional(),
      options: z.object({
        useAggressiveParsing: z.boolean().optional(),
        includeGovernmentPolicies: z.boolean().optional(),
        autoGenerateBrackets: z.boolean().optional(),
        targetRevenueMatch: z.boolean().optional(),
      }).optional()
    }))
    .mutation(async ({ input }) => {
      // Call the parser function from tax-data-parser
      const parsedData = parseEconomicDataForTaxSystem(
        input.economicData as any,
        input.governmentData,
        input.options
      );

      // Calculate revenue recommendations if government data provided
      let revenueRecommendations = null;
      if (input.governmentData) {
        revenueRecommendations = calculateRecommendedTaxRevenue(
          input.governmentData,
          input.economicData as any
        );
      }

      return {
        parsedData,
        revenueRecommendations
      };
    }),

  // Calculate unified tax effectiveness with government components
  calculateUnifiedEffectiveness: protectedProcedure
    .input(z.object({
      taxSystemId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Fetch tax system with all categories
      const taxSystem = await ctx.db.taxSystem.findUnique({
        where: { id: input.taxSystemId },
        include: {
          taxCategories: true,
          country: true
        }
      });

      if (!taxSystem) {
        throw new Error('Tax system not found');
      }

      // Fetch user's government components
      const governmentComponents = await ctx.db.governmentComponent.findMany({
        where: { countryId: taxSystem.countryId },
        select: { componentType: true }
      });

      const componentTypes = governmentComponents.map(gc => gc.componentType);

      // Get latest economic data
      const coreIndicator = taxSystem.country;
      if (!coreIndicator) {
        throw new Error('No economic data found for country');
      }

      // Prepare economic data object
      const economicData = {
        gdpPerCapita: taxSystem.country.currentGdpPerCapita,
        giniCoefficient: 0.35, // Default value since not available in Country model
        gdpGrowthRate: taxSystem.country.realGDPGrowthRate || 0.03,
        formalEconomyShare: 0.80, // Default, could be calculated
        consumptionGDPPercent: 60, // Default value since not available in Country model
        exportsGDPPercent: 30 // Default value since not available in Country model
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
          taxCategories: taxSystem.taxCategories?.map(cat => ({
            ...cat,
            description: cat.description ?? undefined,
            baseRate: cat.baseRate ?? undefined,
            color: cat.color ?? undefined,
            icon: cat.icon ?? undefined,
            maximumAmount: cat.maximumAmount ?? undefined,
            exemptionAmount: cat.exemptionAmount ?? undefined,
            standardDeduction: cat.standardDeduction ?? undefined,
            minimumAmount: cat.minimumAmount ?? undefined
          }))
        },
        componentTypes,
        economicData
      );

      return effectiveness;
    }),

  // Get tier-based tax recommendations for a country
  getTaxRecommendations: protectedProcedure
    .input(z.object({
      countryId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Fetch country's economic data
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        include: {
          taxSystem: {
            include: {
              taxCategories: true
            }
          }
        }
      });

      if (!country) {
        throw new Error('Country not found');
      }

      // Determine economic tier using country's economic data
      const gdpPerCapita = country.currentGdpPerCapita;
      let tier: string;
      if (gdpPerCapita >= 50000) {
        tier = 'Advanced';
      } else if (gdpPerCapita >= 25000) {
        tier = 'Developed';
      } else if (gdpPerCapita >= 10000) {
        tier = 'Emerging';
      } else {
        tier = 'Developing';
      }

      // Get tax economy impacts for existing or recommended categories
      let taxCategories = country.taxSystem?.taxCategories || [];

      // If no tax system exists, generate recommended categories
      if (taxCategories.length === 0) {
        // Generate basic recommended categories based on tier
        const recommendedTypes = tier === 'Advanced' || tier === 'Developed'
          ? ['INCOME', 'CORPORATE', 'SALES', 'PROPERTY']
          : ['INCOME', 'SALES', 'EXCISE'];

        taxCategories = recommendedTypes.map((type, idx) => ({
          id: `recommended-${idx}`,
          taxSystemId: 'recommended',
          categoryName: type,
          categoryType: type,
          description: `Recommended ${type} tax for ${tier} economy`,
          isActive: true,
          baseRate: tier === 'Advanced' ? 25 : tier === 'Developed' ? 20 : 15,
          calculationMethod: 'percentage',
          minimumAmount: 0,
          maximumAmount: null,
          exemptionAmount: null,
          deductionAllowed: true,
          standardDeduction: null,
          priority: 100 - (idx * 10),
          color: '#3b82f6',
          icon: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
      }

      // Get economic impacts for recommendations
      const recommendations = getTaxEconomyImpact(
        taxCategories.map(cat => ({
          ...cat,
          description: cat.description ?? undefined,
          baseRate: cat.baseRate ?? undefined,
          color: cat.color ?? undefined,
          icon: cat.icon ?? undefined,
          maximumAmount: cat.maximumAmount ?? undefined,
          exemptionAmount: cat.exemptionAmount ?? undefined,
          standardDeduction: cat.standardDeduction ?? undefined,
          minimumAmount: cat.minimumAmount ?? undefined
        }))
      );

      return {
        tier,
        gdpPerCapita,
        recommendations,
        analysis: {
          currentTaxCount: country.taxSystem?.taxCategories?.length || 0,
          recommendedTaxCount: tier === 'Advanced' || tier === 'Developed' ? 5 : 3,
          complianceRate: country.taxSystem?.complianceRate || (tier === 'Advanced' ? 85 : tier === 'Developed' ? 75 : 65),
          collectionEfficiency: country.taxSystem?.collectionEfficiency || (tier === 'Advanced' ? 90 : tier === 'Developed' ? 80 : 70)
        }
      };
    }),
});
