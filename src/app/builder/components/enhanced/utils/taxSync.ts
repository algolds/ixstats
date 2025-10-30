import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";

type TaxSyncPayload = Record<string, string | number | boolean | null>;

const EMPTY_TAX_PAYLOAD: TaxSyncPayload = {
  personalIncomeTaxRates: "[]",
  corporateTaxRates: "[]",
  salesTaxRate: 0,
  propertyTaxRate: 0,
  payrollTaxRate: 0,
};

function normaliseText(value?: string): string {
  return (value || "").toLowerCase();
}

function findCategoryIndex(
  taxState: TaxBuilderState,
  keywords: string[],
): number {
  const lowered = keywords.map((keyword) => keyword.toLowerCase());
  return taxState.categories.findIndex((category) => {
    const haystack = `${normaliseText(category.categoryName)} ${normaliseText(
      category.categoryType,
    )}`.trim();
    return lowered.some((keyword) => haystack.includes(keyword));
  });
}

function extractBrackets(taxState: TaxBuilderState, index: number) {
  if (index < 0) {
    return [] as Array<{ minIncome: number; maxIncome: number | null; rate: number }>;
  }

  const rawBrackets = taxState.brackets[String(index)] || [];
  return rawBrackets.map((bracket) => ({
    minIncome: bracket.minIncome,
    maxIncome: bracket.maxIncome ?? null,
    rate: bracket.rate,
  }));
}

function resolveRate(
  taxState: TaxBuilderState,
  index: number,
  fallback: number,
): number {
  if (index < 0) {
    return fallback;
  }

  const category = taxState.categories[index];
  if (category?.baseRate !== undefined && category.baseRate !== null) {
    return category.baseRate;
  }

  const brackets = extractBrackets(taxState, index);
  if (brackets.length > 0) {
    return brackets[brackets.length - 1]?.rate ?? fallback;
  }

  return fallback;
}

export function buildTaxSyncPayload(
  taxState: TaxBuilderState | null | undefined,
): TaxSyncPayload {
  if (!taxState) {
    return { ...EMPTY_TAX_PAYLOAD };
  }

  const personalIndex = findCategoryIndex(taxState, ["personal", "income", "individual"]);
  const corporateIndex = findCategoryIndex(taxState, ["corporate", "business", "company"]);
  const salesIndex = findCategoryIndex(taxState, ["sales", "vat", "consumption"]);
  const propertyIndex = findCategoryIndex(taxState, ["property", "land", "estate"]);
  const payrollIndex = findCategoryIndex(taxState, ["payroll", "wage", "salary"]);

  const defaultRate = taxState.taxSystem.baseRate ?? 0;

  return {
    personalIncomeTaxRates: JSON.stringify(extractBrackets(taxState, personalIndex)),
    corporateTaxRates: JSON.stringify(extractBrackets(taxState, corporateIndex)),
    salesTaxRate: resolveRate(taxState, salesIndex, defaultRate),
    propertyTaxRate: resolveRate(taxState, propertyIndex, 0),
    payrollTaxRate: resolveRate(taxState, payrollIndex, 0),
  };
}
