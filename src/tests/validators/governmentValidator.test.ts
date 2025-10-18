import { describe, it, expect } from '@jest/globals';
import { GovernmentBuilderStateSchema } from '~/types/validation/government';

describe('GovernmentBuilder validation', () => {
  it('fails when totalBudget <= 0 and department name missing', () => {
    const invalid = {
      structure: {
        governmentName: '',
        governmentType: 'Unitary State',
        totalBudget: 0,
        fiscalYear: 'Calendar Year',
        budgetCurrency: 'USD',
      },
      departments: [{ name: '', category: 'Other', organizationalLevel: 'Ministry', color: '#000000', priority: 50 }],
      budgetAllocations: [],
      revenueSources: [],
    } as any;
    const result = GovernmentBuilderStateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('passes for minimal valid structure', () => {
    const valid = {
      structure: {
        governmentName: 'Test Gov',
        governmentType: 'Unitary State',
        totalBudget: 100,
        fiscalYear: 'Calendar Year',
        budgetCurrency: 'USD',
      },
      departments: [{ name: 'Finance', category: 'Finance', organizationalLevel: 'Ministry', color: '#000000', priority: 50 }],
      budgetAllocations: [],
      revenueSources: [],
    };
    const result = GovernmentBuilderStateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});


