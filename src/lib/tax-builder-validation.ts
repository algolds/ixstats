/**
 * Tax Builder Validation Logic
 *
 * Provides comprehensive validation for tax builder state including:
 * - Tax system validation
 * - Category validation
 * - Bracket validation
 * - Error generation and completeness checks
 */

import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, any>;
}

/**
 * Validate entire tax builder state
 */
export function validateTaxBuilderState(builderState: TaxBuilderState): ValidationResult {
  const errors: any = {};

  // Validate tax system
  const taxSystemErrors = validateTaxSystem(builderState);
  if (Object.keys(taxSystemErrors).length > 0) {
    errors.taxSystem = taxSystemErrors;
  }

  // Validate categories
  const categoryErrors = validateCategories(builderState);
  if (Object.keys(categoryErrors).length > 0) {
    errors.categories = categoryErrors;
  }

  // Validate brackets
  const bracketErrors = validateBrackets(builderState);
  if (Object.keys(bracketErrors).length > 0) {
    errors.brackets = bracketErrors;
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

/**
 * Validate tax system configuration
 */
function validateTaxSystem(builderState: TaxBuilderState): Record<string, string[]> {
  const taxSystemFieldErrors: Record<string, string[]> = {};

  // Tax system name is required
  if (!builderState.taxSystem.taxSystemName?.trim()) {
    taxSystemFieldErrors.taxSystemName = ["Tax system name is required"];
  }

  // Fiscal year is required
  if (!builderState.taxSystem.fiscalYear) {
    taxSystemFieldErrors.fiscalYear = ["Fiscal year is required"];
  }

  // Flat tax rate validation
  if (
    !builderState.taxSystem.progressiveTax &&
    (builderState.taxSystem.flatTaxRate === undefined ||
      builderState.taxSystem.flatTaxRate === null)
  ) {
    taxSystemFieldErrors.flatTaxRate = [
      "Flat tax rate is required when not using progressive taxation",
    ];
  }

  if (
    builderState.taxSystem.flatTaxRate !== undefined &&
    (builderState.taxSystem.flatTaxRate < 0 || builderState.taxSystem.flatTaxRate > 100)
  ) {
    taxSystemFieldErrors.flatTaxRate = ["Flat tax rate must be between 0 and 100"];
  }

  // Alternative minimum tax validation
  if (
    builderState.taxSystem.alternativeMinTax &&
    (builderState.taxSystem.alternativeMinRate === undefined ||
      builderState.taxSystem.alternativeMinRate === null)
  ) {
    taxSystemFieldErrors.alternativeMinRate = ["AMT rate is required when AMT is enabled"];
  }

  return taxSystemFieldErrors;
}

/**
 * Validate tax categories
 */
function validateCategories(builderState: TaxBuilderState): Record<number, string[]> {
  const categoryErrors: Record<number, string[]> = {};

  builderState.categories.forEach((category, index) => {
    const catErrors: string[] = [];

    // Category name is required
    if (!category.categoryName?.trim()) {
      catErrors.push("Category name is required");
    }

    // Category type is required
    if (!category.categoryType) {
      catErrors.push("Category type is required");
    }

    // Calculation method is required
    if (!category.calculationMethod) {
      catErrors.push("Calculation method is required");
    }

    // Base rate validation
    if (category.baseRate !== undefined && (category.baseRate < 0 || category.baseRate > 100)) {
      catErrors.push("Base rate must be between 0 and 100");
    }

    // Progressive categories need brackets
    if (category.calculationMethod === "progressive") {
      const brackets = builderState.brackets[index.toString()] || [];
      if (brackets.length === 0) {
        catErrors.push("Progressive categories need at least one bracket");
      }
    }

    if (catErrors.length > 0) {
      categoryErrors[index] = catErrors;
    }
  });

  return categoryErrors;
}

/**
 * Validate tax brackets
 */
function validateBrackets(builderState: TaxBuilderState): Record<string, Record<number, string[]>> {
  const bracketErrors: Record<string, Record<number, string[]>> = {};

  Object.entries(builderState.brackets).forEach(([categoryIndex, brackets]) => {
    const sorted = [...brackets].sort((a, b) => a.minIncome - b.minIncome);

    for (let i = 0; i < sorted.length; i++) {
      const bracket = sorted[i]!;

      // Validate tax rate range
      if (bracket.rate < 0 || bracket.rate > 100) {
        bracketErrors[categoryIndex] = bracketErrors[categoryIndex] || {};
        bracketErrors[categoryIndex][i] = bracketErrors[categoryIndex][i] || [];
        bracketErrors[categoryIndex][i].push("Tax rate must be between 0 and 100");
      }

      // Validate income range
      if (bracket.maxIncome !== undefined && bracket.minIncome >= bracket.maxIncome) {
        bracketErrors[categoryIndex] = bracketErrors[categoryIndex] || {};
        bracketErrors[categoryIndex][i] = bracketErrors[categoryIndex][i] || [];
        bracketErrors[categoryIndex][i].push("Maximum income must be greater than minimum income");
      }

      // Validate no overlaps
      if (i > 0) {
        const prev = sorted[i - 1]!;
        const prevEnd = prev.maxIncome ?? Number.POSITIVE_INFINITY;
        if (bracket.minIncome < prevEnd) {
          bracketErrors[categoryIndex] = bracketErrors[categoryIndex] || {};
          bracketErrors[categoryIndex][i] = bracketErrors[categoryIndex][i] || [];
          bracketErrors[categoryIndex][i].push("Bracket overlaps previous bracket");
        }
      }
    }
  });

  return bracketErrors;
}

/**
 * Check if validation has errors for a specific step
 */
export function hasStepErrors(
  stepId: string,
  validationErrors: Record<string, any>
): boolean {
  switch (stepId) {
    case "atomic":
      // No specific validation errors for atomic components
      return false;
    case "configuration":
      return !!(validationErrors.taxSystem || validationErrors.categories);
    case "exemptions":
      // Exemptions don't have specific validation currently
      return false;
    case "calculator":
      // Calculator step shows all errors
      return Object.keys(validationErrors).length > 0;
    default:
      return false;
  }
}

/**
 * Get completion percentage for builder state
 */
export function getCompletionPercentage(builderState: TaxBuilderState): number {
  let completed = 0;
  let total = 0;

  // Tax system basics (25%)
  total += 25;
  if (builderState.taxSystem.taxSystemName?.trim()) completed += 10;
  if (builderState.taxSystem.fiscalYear) completed += 5;
  if (builderState.taxSystem.progressiveTax !== undefined) completed += 5;
  if (builderState.taxSystem.complianceRate) completed += 2.5;
  if (builderState.taxSystem.collectionEfficiency) completed += 2.5;

  // Categories (50%)
  total += 50;
  if (builderState.categories.length > 0) {
    const categoryWeight = 50 / builderState.categories.length;
    builderState.categories.forEach((cat, idx) => {
      let catCompletion = 0;
      if (cat.categoryName?.trim()) catCompletion += 0.3;
      if (cat.categoryType) catCompletion += 0.2;
      if (cat.calculationMethod) catCompletion += 0.2;
      if (cat.baseRate !== undefined) catCompletion += 0.15;
      if (builderState.brackets[idx.toString()]?.length > 0) catCompletion += 0.15;
      completed += categoryWeight * catCompletion;
    });
  }

  // Validation (25%)
  total += 25;
  const validation = validateTaxBuilderState(builderState);
  if (validation.isValid) {
    completed += 25;
  } else {
    // Partial credit for having some valid data
    const errorCount = Object.keys(validation.errors).length;
    completed += Math.max(0, 25 - errorCount * 5);
  }

  return Math.min(100, Math.round((completed / total) * 100));
}
