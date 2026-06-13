import { z } from "zod";
import { AppError } from "~/lib/app-error";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import {
  detectTaxConflicts,
  syncTaxData,
  type ConflictWarning,
} from "~/server/services/builderIntegrationService";
import { TaxBuilderStateSchema } from "~/types/validation/tax";




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

export const taxSystemCrudRouter = createTRPCRouter({
  // Parse economic data for tax system

  // Calculate tax effectiveness with government components

  // Check for conflicts before creating/updating

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
        warnings = await detectTaxConflicts(ctx.db as any, input.countryId, data);
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
        if (!(e instanceof AppError && e.code === "CONFLICT")) {
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
      const syncResult = await syncTaxData(ctx.db as any, input.countryId, data);

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
        warnings = await detectTaxConflicts(ctx.db as any, input.countryId, data);
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
      const syncResult = await syncTaxData(ctx.db as any, input.countryId, data);

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
            ...(data.alternativeMinTax !== undefined && {
              alternativeMinTax: data.alternativeMinTax,
            }),
            ...(data.alternativeMinRate !== undefined && {
              alternativeMinRate: data.alternativeMinRate,
            }),
            ...(data.complianceRate !== undefined && { complianceRate: data.complianceRate }),
            ...(data.collectionEfficiency !== undefined && {
              collectionEfficiency: data.collectionEfficiency,
            }),
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

  // Calculate unified tax effectiveness with government components

  // Get tier-based tax recommendations for a country

  // Real-time live tax calculation with full atomic component integration
});
