/**
 * Tax-Revenue Pure Mapping Utilities
 *
 * Stateless conversion functions between Government Revenue Sources and Tax Categories/Brackets.
 */

import type { RevenueSourceInput, RevenueCategory } from "~/types/government";
import { COLLECTION_METHODS } from "~/types/government";
import type { TaxCategoryInput, TaxBracketInput } from "~/types/tax-system";

export interface RevenueTaxMapping {
  revenueCategory: RevenueCategory;
  taxCategoryType: string;
  calculationMethod: string;
  defaultRate: number;
  brackets?: TaxBracketInput[];
}

export const REVENUE_TAX_MAPPINGS: RevenueTaxMapping[] = [
  {
    revenueCategory: "Direct Tax",
    taxCategoryType: "Direct Tax",
    calculationMethod: "progressive",
    defaultRate: 15,
  },
  {
    revenueCategory: "Indirect Tax",
    taxCategoryType: "Indirect Tax",
    calculationMethod: "percentage",
    defaultRate: 10,
  },
  {
    revenueCategory: "Non-Tax Revenue",
    taxCategoryType: "Non-Tax Revenue",
    calculationMethod: "fixed",
    defaultRate: 0,
  },
  {
    revenueCategory: "Fees and Fines",
    taxCategoryType: "Fees and Fines",
    calculationMethod: "fixed",
    defaultRate: 0,
  },
  {
    revenueCategory: "Other",
    taxCategoryType: "Other",
    calculationMethod: "fixed",
    defaultRate: 0,
  },
];

export function mapRevenueSourceToTaxCategory(
  revenueSource: RevenueSourceInput
): Partial<TaxCategoryInput> {
  const mapping =
    REVENUE_TAX_MAPPINGS.find((m) => m.revenueCategory === revenueSource.category) ||
    REVENUE_TAX_MAPPINGS[0]!;
  const method = COLLECTION_METHODS.find((m) => m.id === revenueSource.collectionMethod);

  return {
    categoryName: revenueSource.name,
    categoryType: mapping.taxCategoryType,
    description: revenueSource.description || `${revenueSource.name} tax collection`,
    baseRate: revenueSource.rate || mapping.defaultRate,
    calculationMethod: (method?.calculationMethod || mapping.calculationMethod) as any,
    minimumAmount: 0,
    exemptionAmount: 0,
    deductionAllowed: mapping.taxCategoryType === "Direct Tax",
    standardDeduction: mapping.taxCategoryType === "Direct Tax" ? 10000 : undefined,
    isActive: true,
  };
}

export function revenueSourcesToTaxCategories(
  revenueSources: RevenueSourceInput[]
): TaxCategoryInput[] {
  return (revenueSources || [])
    .filter((rs) => rs && rs.name && rs.category)
    .map((rs) => mapRevenueSourceToTaxCategory(rs) as TaxCategoryInput);
}

export function mapTaxCategoryToRevenueSource(
  taxCategory: TaxCategoryInput,
  totalRevenue = 1000000
): Partial<RevenueSourceInput> {
  const mapping = REVENUE_TAX_MAPPINGS.find((m) => m.taxCategoryType === taxCategory.categoryType);
  const category = mapping?.revenueCategory || "Other";
  const collectionMethod =
    COLLECTION_METHODS.find((m) => m.taxCategoryType === taxCategory.categoryType && m.isTaxRelated)
      ?.id || "self_assessment";
  const rate = taxCategory.baseRate ?? 10;

  return {
    name: taxCategory.categoryName,
    category,
    revenueAmount: (rate / 100) * totalRevenue,
    rate,
    collectionMethod,
    description: taxCategory.description,
  };
}

export function getTaxBracketsForRevenueSource(
  revenueSource: RevenueSourceInput
): TaxBracketInput[] {
  if (revenueSource.category !== "Direct Tax") return [];

  const baseRate = revenueSource.rate || 15;

  return [
    {
      bracketName: "Basic Rate",
      minIncome: 0,
      maxIncome: 50000,
      rate: Math.max(5, baseRate * 0.67),
      marginalRate: true,
      isActive: true,
      priority: 1,
    },
    {
      bracketName: "Standard Rate",
      minIncome: 50000,
      maxIncome: 150000,
      rate: baseRate,
      marginalRate: true,
      isActive: true,
      priority: 2,
    },
    {
      bracketName: "Higher Rate",
      minIncome: 150000,
      rate: Math.min(60, baseRate * 1.5),
      marginalRate: true,
      isActive: true,
      priority: 3,
    },
  ];
}

