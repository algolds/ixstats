/**
 * Government Builder Validation Utilities
 *
 * This module provides utilities to validate that government spending
 * data comes from the government builder system and not from independent sources.
 */

import type { EconomicInputs } from "../lib/economy-data-service";
import type { GovernmentBuilderState, DepartmentInput } from "~/types/government";

export interface GovernmentValidationResult {
  isValid: boolean;
  hasGovernmentBuilder: boolean;
  hasDepartments: boolean;
  hasBudgetAllocations: boolean;
  errorMessage?: string;
  warningMessage?: string;
}

/**
 * Check if the government spending data is properly sourced from the government builder
 */
export function validateGovernmentSpendingSource(
  inputs: EconomicInputs,
  governmentData?: GovernmentBuilderState | null
): GovernmentValidationResult {
  // Check if we have government builder data
  const hasGovernmentBuilder = !!governmentData;
  const hasDepartments = hasGovernmentBuilder && governmentData.departments.length > 0;
  const hasBudgetAllocations = hasGovernmentBuilder && governmentData.budgetAllocations.length > 0;

  // Check if spending categories match government builder departments
  const spendingCategoriesFromBuilder = hasDepartments
    ? governmentData.departments.map((dept: DepartmentInput) => dept.name)
    : [];

  const currentSpendingCategories = inputs.governmentSpending.spendingCategories.map(
    (cat: { category: string }) => cat.category
  );

  // Check if spending categories are sourced from government builder
  const categoriesMatchBuilder =
    spendingCategoriesFromBuilder.length > 0 &&
    spendingCategoriesFromBuilder.some((builderCat) =>
      currentSpendingCategories.includes(builderCat)
    );

  // Determine validation result
  if (!hasGovernmentBuilder) {
    return {
      isValid: false,
      hasGovernmentBuilder: false,
      hasDepartments: false,
      hasBudgetAllocations: false,
      errorMessage: "Government Builder Required",
      warningMessage:
        "You must configure your government structure using the Government Builder before setting spending priorities. Please use the Government Builder first to define departments and budget allocations.",
    };
  }

  if (!hasDepartments) {
    return {
      isValid: false,
      hasGovernmentBuilder: true,
      hasDepartments: false,
      hasBudgetAllocations: false,
      errorMessage: "Government Departments Required",
      warningMessage:
        "Your government structure has no departments configured. Please add departments in the Government Builder before setting spending priorities.",
    };
  }

  if (!hasBudgetAllocations) {
    return {
      isValid: false,
      hasGovernmentBuilder: true,
      hasDepartments: true,
      hasBudgetAllocations: false,
      errorMessage: "Budget Allocations Required",
      warningMessage:
        "Your government structure has departments but no budget allocations. Please configure budget allocations in the Government Builder before setting spending priorities.",
    };
  }

  if (!categoriesMatchBuilder && currentSpendingCategories.length > 0) {
    return {
      isValid: false,
      hasGovernmentBuilder: true,
      hasDepartments: true,
      hasBudgetAllocations: true,
      errorMessage: "Spending Data Out of Sync",
      warningMessage:
        "Your spending categories don't match your government departments. Please update your spending data through the Government Builder to ensure consistency.",
    };
  }

  return {
    isValid: true,
    hasGovernmentBuilder: true,
    hasDepartments: true,
    hasBudgetAllocations: true,
  };
}

/**
 * Check if spending categories are using default/template data
 */
export function isUsingDefaultSpendingData(spendingCategories: any[]): boolean {
  if (!spendingCategories || spendingCategories.length === 0) {
    return false;
  }

  // Check for common default category names
  const defaultCategories = [
    "Defense",
    "Education",
    "Healthcare",
    "Infrastructure",
    "Social Security",
    "Other",
    "Environmental",
  ];

  const hasDefaultCategories = spendingCategories.some((cat) =>
    defaultCategories.includes(cat.category)
  );

  // Check if categories have default descriptions or generic content
  const hasDefaultDescriptions = spendingCategories.some(
    (cat) =>
      cat.description &&
      (cat.description.includes("Military, security") ||
        cat.description.includes("Schools, universities") ||
        cat.description.includes("Public health services") ||
        cat.description.includes("Roads, utilities") ||
        cat.description.includes("Welfare, pensions") ||
        cat.description.includes("Administration, debt service"))
  );

  return hasDefaultCategories && hasDefaultDescriptions;
}

/**
 * Generate government builder URL for navigation
 */
export function getGovernmentBuilderUrl(): string {
  // This should match your routing structure
  return "/builder?section=government";
}

/**
 * Create a standardized error component for missing government builder
 */
export function createGovernmentBuilderErrorComponent(
  validation: GovernmentValidationResult,
  onNavigateToBuilder?: () => void
) {
  const handleNavigateToBuilder = () => {
    if (onNavigateToBuilder) {
      onNavigateToBuilder();
    } else {
      window.location.href = getGovernmentBuilderUrl();
    }
  };

  return {
    errorMessage: validation.errorMessage,
    warningMessage: validation.warningMessage,
    onNavigateToBuilder: handleNavigateToBuilder,
    hasGovernmentBuilder: validation.hasGovernmentBuilder,
    hasDepartments: validation.hasDepartments,
    hasBudgetAllocations: validation.hasBudgetAllocations,
  };
}
