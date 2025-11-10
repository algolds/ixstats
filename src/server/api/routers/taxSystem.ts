import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import type { GovernmentBuilderState } from "~/types/government";
import {
  detectTaxConflicts,
  syncTaxData,
  type ConflictWarning,
} from "~/server/services/builderIntegrationService";
import { TaxBuilderStateSchema } from "~/types/validation/tax";
import {
  parseEconomicDataForTaxSystem,
  calculateRecommendedTaxRevenue,
} from "~/lib/tax-data-parser";
import {
  getUnifiedTaxEffectiveness,
  getTaxEconomyImpact,
} from "~/lib/unified-atomic-tax-integration";
import { ComponentType } from "@prisma/client";
import { notificationHooks } from "~/lib/notification-hooks";

// Validation helpers for brackets
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

export const taxSystemRouter = createTRPCRouter({
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
        ctx.db,
        input.countryId,
        input.data as TaxBuilderState
      );
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
        brackets: taxSystem.taxCategories.reduce(
          (acc: Record<string, any[]>, cat, idx) => {
            acc[idx.toString()] = cat.taxBrackets.map((bracket) => ({
              minIncome: bracket.minIncome,
              maxIncome: bracket.maxIncome || undefined,
              rate: bracket.rate,
              flatAmount: bracket.flatAmount || undefined,
              marginalRate: bracket.marginalRate,
              description: undefined, // Not in schema - could use bracketName
            }));
            return acc;
          },
          {} as Record<string, any[]>
        ),
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
        deductions: taxSystem.taxCategories.reduce(
          (acc: Record<string, any[]>, cat, idx) => {
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
          },
          {} as Record<string, any[]>
        ),
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
        skipConflictCheck: z.boolean().optional().default(false),
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
              create: data.categories.map(
                (cat: TaxBuilderState["categories"][number], catIdx: number) => ({
                  categoryName: cat.categoryName,
                  categoryType: cat.categoryType,
                  description: cat.description,
                  baseRate: cat.baseRate,
                  calculationMethod: cat.calculationMethod,
                  taxBrackets: {
                    create: (data.brackets[catIdx.toString()] || []).map(
                      (bracket: TaxBuilderState["brackets"][string][number]) => ({
                        minIncome: bracket.minIncome,
                        maxIncome: bracket.maxIncome,
                        rate: bracket.rate,
                        flatAmount: bracket.flatAmount,
                        marginalRate: bracket.marginalRate,
                        taxSystem: {
                          connect: { countryId: input.countryId },
                        },
                      })
                    ),
                  },
                  taxExemptions: {
                    create: data.exemptions
                      .filter((ex: TaxBuilderState["exemptions"][number]) => ex.exemptionName)
                      .map((exemption: TaxBuilderState["exemptions"][number]) => ({
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
                    create: (data.deductions[catIdx.toString()] || []).map(
                      (deduction: TaxBuilderState["deductions"][string][number]) => ({
                        deductionName: deduction.deductionName,
                        deductionType: deduction.deductionType,
                        description: deduction.description,
                        maximumAmount: deduction.maximumAmount,
                        percentage: deduction.percentage,
                      })
                    ),
                  },
                })
              ),
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
        const message = typeof e?.message === "string" ? e.message : "";
        const uniqueViolation =
          message.includes("Unique constraint failed") || message.includes("P2002");
        if (!uniqueViolation) {
          throw e;
        }
        // Unique on countryId exists already: perform update path
        await ctx.db.taxCategory.deleteMany({
          where: {
            taxSystemId: {
              in: (
                await ctx.db.taxSystem.findMany({
                  where: { countryId: input.countryId },
                  select: { id: true },
                })
              ).map((ts) => ts.id),
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
              create: data.categories.map(
                (cat: TaxBuilderState["categories"][number], catIdx: number) => ({
                  categoryName: cat.categoryName,
                  categoryType: cat.categoryType,
                  description: cat.description,
                  baseRate: cat.baseRate,
                  calculationMethod: cat.calculationMethod,
                  taxBrackets: {
                    create: (data.brackets[catIdx.toString()] || []).map(
                      (bracket: TaxBuilderState["brackets"][string][number]) => ({
                        minIncome: bracket.minIncome,
                        maxIncome: bracket.maxIncome,
                        rate: bracket.rate,
                        flatAmount: bracket.flatAmount,
                        marginalRate: bracket.marginalRate,
                        taxSystem: {
                          connect: { countryId: input.countryId },
                        },
                      })
                    ),
                  },
                  taxExemptions: {
                    create: data.exemptions
                      .filter((ex: TaxBuilderState["exemptions"][number]) => ex.exemptionName)
                      .map((exemption: TaxBuilderState["exemptions"][number]) => ({
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
                    create: (data.deductions[catIdx.toString()] || []).map(
                      (deduction: TaxBuilderState["deductions"][string][number]) => ({
                        deductionName: deduction.deductionName,
                        deductionType: deduction.deductionType,
                        description: deduction.description,
                        maximumAmount: deduction.maximumAmount,
                        percentage: deduction.percentage,
                      })
                    ),
                  },
                })
              ),
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

      // Notify about tax system creation
      try {
        await notificationHooks.onTaxSystemChange({
          countryId: input.countryId,
          changeType: "created",
          systemName: data.taxSystem.taxSystemName,
          details: `Tax system created with ${data.categories.length} categories`,
        });
      } catch (error) {
        console.error("[TaxSystem] Failed to send tax system creation notification:", error);
      }

      return {
        taxSystem,
        syncResult,
        warnings,
      };
    }),

  // Update tax system
  update: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: TaxBuilderStateSchema,
        skipConflictCheck: z.boolean().optional().default(false),
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
            in: (
              await ctx.db.taxSystem.findMany({
                where: { countryId: input.countryId },
                select: { id: true },
              })
            ).map((ts) => ts.id),
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
                    connect: { countryId: input.countryId },
                  },
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

      // Check for significant revenue projection changes
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: {
            taxRevenueGDPPercent: true,
            currentGdpPerCapita: true,
            currentPopulation: true,
          },
        });

        if (country && data.taxSystem.collectionEfficiency) {
          const previousRevenue = country.taxRevenueGDPPercent || 0;
          const newRevenue = data.taxSystem.collectionEfficiency;
          const changePercent =
            previousRevenue > 0 ? ((newRevenue - previousRevenue) / previousRevenue) * 100 : 0;

          // Notify if revenue projection changed by more than 10%
          if (Math.abs(changePercent) > 10) {
            await notificationHooks.onTaxSystemChange({
              countryId: input.countryId,
              changeType: "revenue_projection_change",
              systemName: data.taxSystem.taxSystemName,
              previousValue: previousRevenue,
              newValue: newRevenue,
              changePercent,
            });
          }
        }

        // Notify about tax system update
        await notificationHooks.onTaxSystemChange({
          countryId: input.countryId,
          changeType: "updated",
          systemName: data.taxSystem.taxSystemName,
          details: `Tax system updated with ${data.categories.length} categories`,
        });
      } catch (error) {
        console.error("[TaxSystem] Failed to send tax system update notification:", error);
      }

      return {
        taxSystem,
        syncResult,
        warnings,
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

  // Autosave tax system (partial updates)
  autosave: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: z.object({
          taxSystemName: z.string().optional(),
          taxAuthority: z.string().optional(),
          fiscalYear: z.string().optional(),
          taxCode: z.string().optional(),
          baseRate: z.number().optional(),
          progressiveTax: z.boolean().optional(),
          flatTaxRate: z.number().optional(),
          alternativeMinTax: z.boolean().optional(),
          alternativeMinRate: z.number().optional(),
          complianceRate: z.number().optional(),
          collectionEfficiency: z.number().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, data } = input;

      // Verify user owns the country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!userProfile || userProfile.countryId !== countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to edit this country.",
        });
      }

      try {
        // Upsert tax system with partial data
        const taxSystem = await ctx.db.taxSystem.upsert({
          where: { countryId },
          create: {
            countryId,
            taxSystemName: data.taxSystemName || "National Tax System",
            taxAuthority: data.taxAuthority,
            fiscalYear: data.fiscalYear || "calendar",
            taxCode: data.taxCode,
            baseRate: data.baseRate,
            progressiveTax: data.progressiveTax ?? true,
            flatTaxRate: data.flatTaxRate,
            alternativeMinTax: data.alternativeMinTax ?? false,
            alternativeMinRate: data.alternativeMinRate,
            complianceRate: data.complianceRate,
            collectionEfficiency: data.collectionEfficiency,
          },
          update: {
            ...(data.taxSystemName && { taxSystemName: data.taxSystemName }),
            ...(data.taxAuthority !== undefined && { taxAuthority: data.taxAuthority }),
            ...(data.fiscalYear && { fiscalYear: data.fiscalYear }),
            ...(data.taxCode !== undefined && { taxCode: data.taxCode }),
            ...(data.baseRate !== undefined && { baseRate: data.baseRate }),
            ...(data.progressiveTax !== undefined && { progressiveTax: data.progressiveTax }),
            ...(data.flatTaxRate !== undefined && { flatTaxRate: data.flatTaxRate }),
            ...(data.alternativeMinTax !== undefined && { alternativeMinTax: data.alternativeMinTax }),
            ...(data.alternativeMinRate !== undefined && { alternativeMinRate: data.alternativeMinRate }),
            ...(data.complianceRate !== undefined && { complianceRate: data.complianceRate }),
            ...(data.collectionEfficiency !== undefined && { collectionEfficiency: data.collectionEfficiency }),
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

        // Log autosave to audit trail
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth.userId,
            action: "autosave:taxSystem",
            target: countryId,
            details: JSON.stringify({
              fields: Object.keys(data),
              timestamp: new Date().toISOString(),
            }),
            success: true,
          },
        });

        return {
          success: true,
          data: taxSystem,
          message: "Tax system autosaved successfully",
        };
      } catch (error) {
        // Log autosave failure to audit trail
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth.userId,
            action: "autosave:taxSystem",
            target: countryId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });

        throw error;
      }
    }),

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
