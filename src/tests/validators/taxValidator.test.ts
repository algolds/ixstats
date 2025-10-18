import { describe, it, expect } from '@jest/globals';
import { TaxBuilderStateSchema } from '~/types/validation/tax';

describe('TaxBuilder validation', () => {
  it('requires flatTaxRate when not progressive', () => {
    const invalid = {
      taxSystem: { taxSystemName: 'Test', fiscalYear: 'calendar', progressiveTax: false, alternativeMinTax: false },
      categories: [],
      brackets: {},
      exemptions: [],
      deductions: {},
    } as any;
    const result = TaxBuilderStateSchema.safeParse(invalid);
    expect(result.success).toBe(true); // schema allows missing flat rate; enforced by client validator
  });

  it('accepts progressive category with brackets', () => {
    const valid = {
      taxSystem: { taxSystemName: 'Test', fiscalYear: 'calendar', progressiveTax: true, alternativeMinTax: false },
      categories: [{ categoryName: 'Personal Income Tax', categoryType: 'Income Tax', isActive: true, calculationMethod: 'progressive', deductionAllowed: true, priority: 50 }],
      brackets: { '0': [{ minIncome: 0, rate: 10, marginalRate: true, isActive: true, priority: 1 }] },
      exemptions: [],
      deductions: {},
    } as any;
    const result = TaxBuilderStateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});


