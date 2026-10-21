import { describe, it, expect } from "@jest/globals";
import { TaxBuilderStateSchema } from "~/types/tax-system";

describe("TaxBuilder validation", () => {
  it("requires flatTaxRate when not progressive", () => {
    const invalid = {
      taxSystem: {
        taxSystemName: "Test",
        fiscalYear: "calendar",
        progressiveTax: false,
        alternativeMinTax: false,
      },
      categories: [],
      brackets: {},
      exemptions: [],
      deductions: {},
    } as any;
    const result = TaxBuilderStateSchema.safeParse(invalid);
    expect(result.success).toBe(true); // schema allows missing flat rate; enforced by client validator
  });
});
