import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";

export function buildTaxSyncPayload(taxSystemData: TaxBuilderState) {
  return {
    taxSystem: taxSystemData.taxSystem,
    categories: taxSystemData.categories,
    brackets: taxSystemData.brackets,
    exemptions: taxSystemData.exemptions,
    deductions: taxSystemData.deductions,
    isValid: taxSystemData.isValid,
    errors: taxSystemData.errors,
  };
}
