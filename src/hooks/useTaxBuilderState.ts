/**
 * Tax Builder State Management Hook
 *
 * Consolidates all builder state logic including:
 * - State initialization and management
 * - State transformations and updates
 * - Category and bracket management
 * - Template application
 */

import { useState, useCallback } from "react";
import type {
  TaxSystemInput,
  TaxCategoryInput,
  TaxBracketInput,
  TaxExemptionInput,
  TaxDeductionInput,
  TaxSystemTemplate,
} from "~/types/tax-system";
import { CALCULATION_METHODS } from "~/types/tax-system";

export interface TaxBuilderState {
  taxSystem: TaxSystemInput;
  categories: TaxCategoryInput[];
  brackets: Record<string, TaxBracketInput[]>; // categoryIndex -> brackets
  exemptions: TaxExemptionInput[];
  deductions: Record<string, TaxDeductionInput[]>; // categoryIndex -> deductions
  isValid: boolean;
  errors: Record<string, any>;
}

interface UseTaxBuilderStateOptions {
  initialData?: Partial<TaxBuilderState>;
  countryId?: string;
}

/**
 * Custom hook for managing tax builder state with all transformation logic
 */
export function useTaxBuilderState(options: UseTaxBuilderStateOptions = {}) {
  const { initialData, countryId } = options;

  const [builderState, setBuilderState] = useState<TaxBuilderState>({
    taxSystem: {
      taxSystemName: "",
      fiscalYear: "calendar",
      progressiveTax: true,
      alternativeMinTax: false,
      complianceRate: 85,
      collectionEfficiency: 90,
      ...initialData?.taxSystem,
    },
    categories: initialData?.categories || [],
    brackets: initialData?.brackets || {},
    exemptions: initialData?.exemptions || [],
    deductions: initialData?.deductions || {},
    isValid: false,
    errors: {},
  });

  /**
   * Update tax system configuration
   */
  const handleTaxSystemChange = useCallback((taxSystem: TaxSystemInput) => {
    setBuilderState((prev) => ({ ...prev, taxSystem }));
  }, []);

  /**
   * Update tax categories
   */
  const handleCategoriesChange = useCallback((categories: TaxCategoryInput[]) => {
    setBuilderState((prev) => ({ ...prev, categories }));
  }, []);

  /**
   * Update tax brackets for a specific category
   */
  const handleBracketsChange = useCallback(
    (categoryIndex: string, brackets: TaxBracketInput[]) => {
      setBuilderState((prev) => ({
        ...prev,
        brackets: { ...prev.brackets, [categoryIndex]: brackets },
      }));
    },
    []
  );

  /**
   * Update tax exemptions
   */
  const handleExemptionsChange = useCallback((exemptions: TaxExemptionInput[]) => {
    setBuilderState((prev) => ({ ...prev, exemptions }));
  }, []);

  /**
   * Update tax deductions for a specific category
   */
  const handleDeductionsChange = useCallback(
    (categoryIndex: string, deductions: TaxDeductionInput[]) => {
      setBuilderState((prev) => ({
        ...prev,
        deductions: { ...prev.deductions, [categoryIndex]: deductions },
      }));
    },
    []
  );

  /**
   * Add a new tax category
   */
  const addCategory = useCallback(() => {
    const newCategory: TaxCategoryInput = {
      categoryName: "Personal Income Tax",
      categoryType: "Direct Tax",
      description: "",
      isActive: true,
      calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      baseRate: 10,
      deductionAllowed: true,
      priority: 50,
      color: "#3b82f6",
    };

    setBuilderState((prev) => ({
      ...prev,
      categories: [...prev.categories, newCategory],
    }));
  }, []);

  /**
   * Remove a tax category and reindex associated data
   */
  const removeCategory = useCallback((index: number) => {
    setBuilderState((prev) => {
      const newCategories = prev.categories.filter((_: TaxCategoryInput, i: number) => i !== index);
      const newBrackets = { ...prev.brackets };
      const newDeductions = { ...prev.deductions };

      // Remove associated brackets and deductions
      delete newBrackets[index.toString()];
      delete newDeductions[index.toString()];

      // Reindex remaining brackets and deductions
      const reindexedBrackets: Record<string, TaxBracketInput[]> = {};
      const reindexedDeductions: Record<string, TaxDeductionInput[]> = {};

      Object.entries(newBrackets).forEach(([oldIndex, brackets]) => {
        const numIndex = parseInt(oldIndex);
        if (numIndex > index) {
          reindexedBrackets[(numIndex - 1).toString()] = brackets as TaxBracketInput[];
        } else if (numIndex < index) {
          reindexedBrackets[oldIndex] = brackets as TaxBracketInput[];
        }
      });

      Object.entries(newDeductions).forEach(([oldIndex, deductions]) => {
        const numIndex = parseInt(oldIndex);
        if (numIndex > index) {
          reindexedDeductions[(numIndex - 1).toString()] = deductions as TaxDeductionInput[];
        } else if (numIndex < index) {
          reindexedDeductions[oldIndex] = deductions as TaxDeductionInput[];
        }
      });

      return {
        ...prev,
        categories: newCategories,
        brackets: reindexedBrackets,
        deductions: reindexedDeductions,
      };
    });
  }, []);

  /**
   * Apply a tax system template
   */
  const applyTemplate = useCallback(
    (template: TaxSystemTemplate) => {
      const newState: Partial<TaxBuilderState> = {
        taxSystem: {
          taxSystemName: `${template.name} for ${countryId || "Country"}`,
          fiscalYear: template.fiscalYear,
          progressiveTax: template.progressiveTax,
          alternativeMinTax: false,
          complianceRate: 85,
          collectionEfficiency: 90,
        },
        categories: template.categories.map((cat) => ({
          categoryName: cat.categoryName,
          categoryType: cat.categoryType,
          description: cat.description,
          isActive: true,
          baseRate: cat.baseRate,
          calculationMethod: cat.calculationMethod,
          deductionAllowed: true,
          priority: 50,
          color: "#3b82f6",
        })),
        brackets: {},
        exemptions: [],
        deductions: {},
      };

      // Set up brackets
      template.categories.forEach((cat, catIndex) => {
        if (cat.brackets) {
          newState.brackets![catIndex.toString()] = cat.brackets.map((bracket) => ({
            bracketName: bracket.bracketName,
            minIncome: bracket.minIncome,
            maxIncome: bracket.maxIncome,
            rate: bracket.rate,
            marginalRate: bracket.marginalRate,
            isActive: true,
            priority: 50,
          }));
        }
      });

      setBuilderState((prev) => ({ ...prev, ...newState }));
    },
    [countryId]
  );

  /**
   * Update validation state
   */
  const updateValidation = useCallback((validation: { isValid: boolean; errors: any }) => {
    setBuilderState((prev) => ({ ...prev, ...validation }));
  }, []);

  return {
    builderState,
    setBuilderState,
    handleTaxSystemChange,
    handleCategoriesChange,
    handleBracketsChange,
    handleExemptionsChange,
    handleDeductionsChange,
    addCategory,
    removeCategory,
    applyTemplate,
    updateValidation,
  };
}
