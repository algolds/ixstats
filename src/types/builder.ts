import type {
  TaxSystemInput,
  TaxCategoryInput,
  TaxBracketInput,
  TaxExemptionInput,
  TaxDeductionInput,
} from "~/types/tax-system";

// ─── 1. Country Reference & Core Indicators ─────────────────────────────────
// ─── 2. Economic Inputs & Demographic Contracts ─────────────────────────────
// ─── 3. Tax Builder State ───────────────────────────────────────────────────

export interface TaxBuilderState {
  taxSystem: TaxSystemInput;
  categories: TaxCategoryInput[];
  brackets: Record<string, TaxBracketInput[]>;
  exemptions: TaxExemptionInput[];
  deductions: Record<string, TaxDeductionInput[]>;
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

// ─── 4. Builder Suggestions ─────────────────────────────────────────────────
