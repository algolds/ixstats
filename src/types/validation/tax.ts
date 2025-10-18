import { z } from 'zod';

export const TaxSystemInputSchema = z.object({
  taxSystemName: z.string().min(1, 'Tax system name is required'),
  taxAuthority: z.string().optional(),
  fiscalYear: z.string().min(1, 'Fiscal year is required'),
  taxCode: z.string().optional(),
  baseRate: z.number().min(0).max(100).optional(),
  progressiveTax: z.boolean(),
  flatTaxRate: z.number().min(0).max(100).optional(),
  alternativeMinTax: z.boolean(),
  alternativeMinRate: z.number().min(0).max(100).optional(),
  complianceRate: z.number().min(0).max(100).optional(),
  collectionEfficiency: z.number().min(0).max(100).optional(),
});

export const TaxCategoryInputSchema = z.object({
  categoryName: z.string().min(1, 'Category name is required'),
  categoryType: z.string().min(1, 'Category type is required'),
  description: z.string().optional(),
  isActive: z.boolean(),
  baseRate: z.number().min(0).max(100).optional(),
  calculationMethod: z.enum(['percentage', 'fixed', 'tiered', 'progressive']),
  minimumAmount: z.number().nonnegative().optional(),
  maximumAmount: z.number().nonnegative().optional(),
  exemptionAmount: z.number().nonnegative().optional(),
  deductionAllowed: z.boolean(),
  standardDeduction: z.number().nonnegative().optional(),
  priority: z.number().int().min(1).max(100),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const TaxBracketInputSchema = z.object({
  bracketName: z.string().optional(),
  minIncome: z.number().nonnegative(),
  maxIncome: z.number().nonnegative().optional(),
  rate: z.number().min(0).max(100),
  flatAmount: z.number().nonnegative().optional(),
  marginalRate: z.boolean(),
  isActive: z.boolean(),
  priority: z.number().int().min(1),
});

export const TaxExemptionInputSchema = z.object({
  categoryId: z.string().optional(),
  exemptionName: z.string().min(1),
  exemptionType: z.string().min(1),
  description: z.string().optional(),
  exemptionAmount: z.number().nonnegative().optional(),
  exemptionRate: z.number().min(0).max(100).optional(),
  qualifications: z.any().optional(),
  isActive: z.boolean().default(true),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

export const TaxDeductionInputSchema = z.object({
  deductionName: z.string().min(1),
  deductionType: z.string().min(1),
  description: z.string().optional(),
  maximumAmount: z.number().nonnegative().optional(),
  percentage: z.number().min(0).max(100).optional(),
  qualifications: z.any().optional(),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(1).optional(),
});

export const TaxBuilderStateSchema = z.object({
  taxSystem: TaxSystemInputSchema,
  categories: z.array(TaxCategoryInputSchema),
  brackets: z.record(z.string(), z.array(TaxBracketInputSchema)),
  exemptions: z.array(TaxExemptionInputSchema),
  deductions: z.record(z.string(), z.array(TaxDeductionInputSchema)),
  // UI-only flags omitted on server; zod schema for API should not include isValid/errors
});

export type TaxBuilderStateZod = z.infer<typeof TaxBuilderStateSchema>;


