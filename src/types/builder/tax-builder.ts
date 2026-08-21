/**
 * Tax Builder State & Input Contracts
 */

import type {
  TaxSystemInput,
  TaxCategoryInput,
  TaxBracketInput,
  TaxExemptionInput,
  TaxDeductionInput,
} from "~/types/tax-system";

export interface TaxBuilderState {
  taxSystem: TaxSystemInput;
  categories: TaxCategoryInput[];
  brackets: Record<string, TaxBracketInput[]>; // categoryIndex -> brackets
  exemptions: TaxExemptionInput[];
  deductions: Record<string, TaxDeductionInput[]>; // categoryIndex -> deductions
  selectedAtomicTaxComponents?: string[];
  isValid: boolean;
  errors: Record<string, any>;
}

export type {
  TaxSystemInput,
  TaxCategoryInput,
  TaxBracketInput,
  TaxExemptionInput,
  TaxDeductionInput,
};
