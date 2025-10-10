import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import type { TaxBuilderState } from "~/components/tax-system/TaxBuilder";

export const taxSystemRouter = createTRPCRouter({
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
          calculationMethod: cat.calculationMethod,
          isActive: true,
          deductionAllowed: true,
          priority: 1,
        })),
        brackets: taxSystem.taxCategories.reduce((acc, cat, idx) => {
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
        deductions: taxSystem.taxCategories.reduce((acc, cat, idx) => {
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
        data: z.any(), // TaxBuilderState
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = input.data as TaxBuilderState;

      // Create tax system with categories
      const taxSystem = await ctx.db.taxSystem.create({
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
                    taxSystemId: '', // Will be set by relation
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

      return taxSystem;
    }),

  // Update tax system
  update: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: z.any(), // TaxBuilderState
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = input.data as TaxBuilderState;

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
                    taxSystemId: '', // Will be set by relation
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

      return taxSystem;
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
});
