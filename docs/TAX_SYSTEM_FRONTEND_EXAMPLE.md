# Tax System Frontend Integration Guide

## Overview

This guide shows how to structure data from the tax builder UI to properly save all tax system configuration to the database.

## Frontend Data Structure

### Complete Tax Builder State

```typescript
interface TaxBuilderState {
  // Core system fields
  taxSystemName: string;
  taxAuthority?: string;
  fiscalYear?: string;
  taxCode?: string;
  baseRate?: number;
  progressiveTax: boolean;
  flatTaxRate?: number;
  alternativeMinTax?: boolean;
  alternativeMinRate?: number;
  taxHolidays?: string; // JSON stringified array
  complianceRate?: number;
  collectionEfficiency?: number;
  lastReform?: Date;

  // Categories
  categories: TaxCategory[];

  // System-wide exemptions
  systemWideExemptions: TaxExemption[];

  // Policies
  policies: TaxPolicy[];
}

interface TaxCategory {
  categoryName: string;
  categoryType: 'Direct' | 'Indirect';
  description?: string;
  isActive: boolean;
  baseRate?: number;
  calculationMethod: 'percentage' | 'fixed' | 'tiered';
  minimumAmount?: number;
  maximumAmount?: number;
  exemptionAmount?: number;
  deductionAllowed: boolean;
  standardDeduction?: number;
  priority: number;
  color?: string;
  icon?: string;

  // Nested arrays
  brackets: TaxBracket[];
  exemptions: TaxExemption[];
  deductions: TaxDeduction[];
}

interface TaxBracket {
  bracketName?: string;
  minIncome: number;
  maxIncome?: number | null; // null for highest bracket
  rate: number;
  flatAmount?: number;
  marginalRate: boolean;
  isActive: boolean;
  priority: number;
}

interface TaxExemption {
  exemptionName: string;
  exemptionType: 'Individual' | 'Corporate' | 'Sector' | 'Geographic';
  description?: string;
  exemptionAmount?: number;
  exemptionRate?: number;
  qualifications?: string; // JSON stringified criteria
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
}

interface TaxDeduction {
  deductionName: string;
  deductionType: 'Standard' | 'Itemized';
  description?: string;
  maximumAmount?: number;
  percentage?: number;
  qualifications?: string; // JSON stringified criteria
  isActive: boolean;
  priority: number;
}

interface TaxPolicy {
  policyName: string;
  policyType: 'Rate Change' | 'Exemption' | 'Deduction';
  description?: string;
  targetCategory?: string;
  impactType: 'Increase' | 'Decrease' | 'Neutral';
  rateChange?: number;
  effectiveDate: Date;
  expiryDate?: Date;
  isActive: boolean;
  estimatedRevenue?: number;
  affectedPopulation?: number;
}
```

## React Hook Example

```typescript
// src/hooks/useTaxBuilder.ts
import { useState } from 'react';
import { api } from '~/utils/api';

interface UseTaxBuilderReturn {
  taxSystem: TaxBuilderState;
  addCategory: (category: TaxCategory) => void;
  removeCategory: (index: number) => void;
  updateCategory: (index: number, updates: Partial<TaxCategory>) => void;
  addBracket: (categoryIndex: number, bracket: TaxBracket) => void;
  addExemption: (categoryIndex: number, exemption: TaxExemption) => void;
  addDeduction: (categoryIndex: number, deduction: TaxDeduction) => void;
  addSystemExemption: (exemption: TaxExemption) => void;
  addPolicy: (policy: TaxPolicy) => void;
  saveTaxSystem: () => Promise<void>;
}

export function useTaxBuilder(): UseTaxBuilderReturn {
  const [taxSystem, setTaxSystem] = useState<TaxBuilderState>({
    taxSystemName: 'National Tax System',
    progressiveTax: true,
    categories: [],
    systemWideExemptions: [],
    policies: []
  });

  const createCountryMutation = api.countries.createCountry.useMutation();

  const addCategory = (category: TaxCategory) => {
    setTaxSystem(prev => ({
      ...prev,
      categories: [...prev.categories, category]
    }));
  };

  const removeCategory = (index: number) => {
    setTaxSystem(prev => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index)
    }));
  };

  const updateCategory = (index: number, updates: Partial<TaxCategory>) => {
    setTaxSystem(prev => ({
      ...prev,
      categories: prev.categories.map((cat, i) =>
        i === index ? { ...cat, ...updates } : cat
      )
    }));
  };

  const addBracket = (categoryIndex: number, bracket: TaxBracket) => {
    setTaxSystem(prev => ({
      ...prev,
      categories: prev.categories.map((cat, i) =>
        i === categoryIndex
          ? { ...cat, brackets: [...cat.brackets, bracket] }
          : cat
      )
    }));
  };

  const addExemption = (categoryIndex: number, exemption: TaxExemption) => {
    setTaxSystem(prev => ({
      ...prev,
      categories: prev.categories.map((cat, i) =>
        i === categoryIndex
          ? { ...cat, exemptions: [...cat.exemptions, exemption] }
          : cat
      )
    }));
  };

  const addDeduction = (categoryIndex: number, deduction: TaxDeduction) => {
    setTaxSystem(prev => ({
      ...prev,
      categories: prev.categories.map((cat, i) =>
        i === categoryIndex
          ? { ...cat, deductions: [...cat.deductions, deduction] }
          : cat
      )
    }));
  };

  const addSystemExemption = (exemption: TaxExemption) => {
    setTaxSystem(prev => ({
      ...prev,
      systemWideExemptions: [...prev.systemWideExemptions, exemption]
    }));
  };

  const addPolicy = (policy: TaxPolicy) => {
    setTaxSystem(prev => ({
      ...prev,
      policies: [...prev.policies, policy]
    }));
  };

  const saveTaxSystem = async () => {
    await createCountryMutation.mutateAsync({
      name: 'Your Country Name',
      taxSystemData: taxSystem
      // ... other country data
    });
  };

  return {
    taxSystem,
    addCategory,
    removeCategory,
    updateCategory,
    addBracket,
    addExemption,
    addDeduction,
    addSystemExemption,
    addPolicy,
    saveTaxSystem
  };
}
```

## Component Example

```typescript
// src/components/TaxBuilder.tsx
import React from 'react';
import { useTaxBuilder } from '~/hooks/useTaxBuilder';

export function TaxBuilder() {
  const {
    taxSystem,
    addCategory,
    addBracket,
    addExemption,
    addDeduction,
    saveTaxSystem
  } = useTaxBuilder();

  const handleAddIncomeCategory = () => {
    addCategory({
      categoryName: 'Personal Income Tax',
      categoryType: 'Direct',
      description: 'Progressive tax on individual income',
      isActive: true,
      calculationMethod: 'tiered',
      deductionAllowed: true,
      priority: 10,
      color: '#3B82F6',
      icon: 'user-dollar',
      brackets: [],
      exemptions: [],
      deductions: []
    });
  };

  const handleAddBracket = (categoryIndex: number) => {
    addBracket(categoryIndex, {
      minIncome: 0,
      maxIncome: 10000,
      rate: 10,
      marginalRate: true,
      isActive: true,
      priority: 50
    });
  };

  const handleAddExemption = (categoryIndex: number) => {
    addExemption(categoryIndex, {
      exemptionName: 'Personal Allowance',
      exemptionType: 'Individual',
      exemptionAmount: 12000,
      isActive: true
    });
  };

  const handleAddDeduction = (categoryIndex: number) => {
    addDeduction(categoryIndex, {
      deductionName: 'Standard Deduction',
      deductionType: 'Standard',
      maximumAmount: 10000,
      isActive: true,
      priority: 1
    });
  };

  const handleSave = async () => {
    try {
      await saveTaxSystem();
      alert('Tax system saved successfully!');
    } catch (error) {
      console.error('Failed to save tax system:', error);
      alert('Failed to save tax system');
    }
  };

  return (
    <div className="tax-builder">
      <h1>Tax System Builder</h1>

      <div className="system-info">
        <input
          type="text"
          value={taxSystem.taxSystemName}
          onChange={(e) => {/* update taxSystemName */}}
          placeholder="Tax System Name"
        />
      </div>

      <div className="categories">
        <h2>Tax Categories</h2>
        <button onClick={handleAddIncomeCategory}>
          Add Income Tax Category
        </button>

        {taxSystem.categories.map((category, idx) => (
          <div key={idx} className="category">
            <h3>{category.categoryName}</h3>

            <div className="brackets">
              <h4>Brackets</h4>
              <button onClick={() => handleAddBracket(idx)}>
                Add Bracket
              </button>
              {category.brackets.map((bracket, bIdx) => (
                <div key={bIdx} className="bracket">
                  ${bracket.minIncome} - ${bracket.maxIncome || '∞'}: {bracket.rate}%
                </div>
              ))}
            </div>

            <div className="exemptions">
              <h4>Exemptions</h4>
              <button onClick={() => handleAddExemption(idx)}>
                Add Exemption
              </button>
              {category.exemptions.map((exemption, eIdx) => (
                <div key={eIdx} className="exemption">
                  {exemption.exemptionName}: ${exemption.exemptionAmount}
                </div>
              ))}
            </div>

            <div className="deductions">
              <h4>Deductions</h4>
              <button onClick={() => handleAddDeduction(idx)}>
                Add Deduction
              </button>
              {category.deductions.map((deduction, dIdx) => (
                <div key={dIdx} className="deduction">
                  {deduction.deductionName}: ${deduction.maximumAmount}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleSave} className="save-button">
        Save Complete Tax System
      </button>
    </div>
  );
}
```

## API Call Example

```typescript
// Direct API call (without hook)
import { api } from '~/utils/api';

const taxSystemData = {
  taxSystemName: 'Federal Tax System',
  taxAuthority: 'Internal Revenue Service',
  fiscalYear: 'calendar',
  progressiveTax: true,
  complianceRate: 92.5,
  collectionEfficiency: 88.0,

  categories: [
    {
      categoryName: 'Personal Income Tax',
      categoryType: 'Direct',
      description: 'Progressive tax on individual income',
      isActive: true,
      calculationMethod: 'tiered',
      baseRate: 20,
      deductionAllowed: true,
      priority: 10,
      color: '#3B82F6',
      icon: 'user-dollar',

      brackets: [
        {
          bracketName: 'Tax-Free Bracket',
          minIncome: 0,
          maxIncome: 10000,
          rate: 0,
          marginalRate: true,
          isActive: true,
          priority: 1
        },
        {
          bracketName: 'Low Income',
          minIncome: 10000,
          maxIncome: 40000,
          rate: 10,
          marginalRate: true,
          isActive: true,
          priority: 2
        },
        {
          bracketName: 'Middle Income',
          minIncome: 40000,
          maxIncome: 85000,
          rate: 22,
          marginalRate: true,
          isActive: true,
          priority: 3
        },
        {
          bracketName: 'High Income',
          minIncome: 85000,
          maxIncome: null, // null for highest bracket
          rate: 35,
          marginalRate: true,
          isActive: true,
          priority: 4
        }
      ],

      exemptions: [
        {
          exemptionName: 'Personal Allowance',
          exemptionType: 'Individual',
          description: 'Standard personal allowance for all taxpayers',
          exemptionAmount: 12000,
          isActive: true
        },
        {
          exemptionName: 'Senior Citizen Exemption',
          exemptionType: 'Individual',
          description: 'Additional exemption for taxpayers 65+',
          exemptionAmount: 5000,
          qualifications: JSON.stringify({ age: '>= 65' }),
          isActive: true
        }
      ],

      deductions: [
        {
          deductionName: 'Standard Deduction',
          deductionType: 'Standard',
          description: 'Standard deduction available to all taxpayers',
          maximumAmount: 12000,
          isActive: true,
          priority: 1
        },
        {
          deductionName: 'Mortgage Interest',
          deductionType: 'Itemized',
          description: 'Deduction for mortgage interest payments',
          maximumAmount: 750000,
          percentage: 100,
          isActive: true,
          priority: 2
        }
      ]
    },

    {
      categoryName: 'Corporate Income Tax',
      categoryType: 'Direct',
      description: 'Tax on business profits',
      isActive: true,
      calculationMethod: 'tiered',
      baseRate: 25,
      deductionAllowed: true,
      priority: 20,
      color: '#10B981',
      icon: 'building',

      brackets: [
        {
          bracketName: 'Small Business',
          minIncome: 0,
          maxIncome: 500000,
          rate: 15,
          marginalRate: true,
          isActive: true,
          priority: 1
        },
        {
          bracketName: 'Large Corporation',
          minIncome: 500000,
          maxIncome: null,
          rate: 25,
          marginalRate: true,
          isActive: true,
          priority: 2
        }
      ],

      exemptions: [
        {
          exemptionName: 'R&D Tax Credit',
          exemptionType: 'Sector',
          description: '25% credit for R&D expenditure',
          exemptionRate: 25,
          isActive: true
        }
      ],

      deductions: [
        {
          deductionName: 'Operating Expenses',
          deductionType: 'Standard',
          description: 'Full deduction for ordinary business expenses',
          percentage: 100,
          isActive: true,
          priority: 1
        }
      ]
    }
  ],

  systemWideExemptions: [
    {
      exemptionName: 'Non-Profit Organizations',
      exemptionType: 'Corporate',
      description: 'Full exemption for registered non-profits',
      exemptionRate: 100,
      isActive: true
    }
  ],

  policies: [
    {
      policyName: 'Economic Stimulus Tax Relief',
      policyType: 'Rate Change',
      description: 'Temporary reduction in corporate tax to stimulate economy',
      targetCategory: 'Corporate Income Tax',
      impactType: 'Decrease',
      rateChange: -5,
      effectiveDate: new Date('2025-01-01'),
      expiryDate: new Date('2026-12-31'),
      isActive: true,
      estimatedRevenue: -5000000000,
      affectedPopulation: 250000
    }
  ]
};

// Make the API call
const result = await api.countries.createCountry.mutate({
  name: 'Example Country',
  slug: 'example-country',
  taxSystemData: taxSystemData,
  // ... other country fields
});

console.log('Country created with tax system:', result);
```

## Validation Example

```typescript
// Frontend validation before sending
function validateTaxSystem(taxSystem: TaxBuilderState): string[] {
  const errors: string[] = [];

  // Check system name
  if (!taxSystem.taxSystemName || taxSystem.taxSystemName.trim() === '') {
    errors.push('Tax system name is required');
  }

  // Check categories
  if (!taxSystem.categories || taxSystem.categories.length === 0) {
    errors.push('At least one tax category is required');
  }

  // Validate each category
  taxSystem.categories.forEach((category, idx) => {
    if (!category.categoryName) {
      errors.push(`Category ${idx + 1}: Name is required`);
    }

    if (!category.categoryType) {
      errors.push(`Category ${idx + 1}: Type is required`);
    }

    // Validate brackets
    if (category.brackets && category.brackets.length > 1) {
      // Check for gaps or overlaps
      const sortedBrackets = [...category.brackets].sort((a, b) => a.minIncome - b.minIncome);

      for (let i = 0; i < sortedBrackets.length - 1; i++) {
        const current = sortedBrackets[i];
        const next = sortedBrackets[i + 1];

        if (current.maxIncome && current.maxIncome !== next.minIncome) {
          errors.push(`Category ${category.categoryName}: Gap between brackets ${i + 1} and ${i + 2}`);
        }
      }
    }
  });

  return errors;
}

// Usage
const errors = validateTaxSystem(taxSystem);
if (errors.length > 0) {
  console.error('Validation errors:', errors);
  alert('Please fix the following errors:\n' + errors.join('\n'));
  return;
}

// Proceed with save
await saveTaxSystem();
```

## Best Practices

### 1. Bracket Management
```typescript
// Always sort brackets by minIncome
const sortedBrackets = brackets.sort((a, b) => a.minIncome - b.minIncome);

// Set last bracket maxIncome to null
const lastBracket = sortedBrackets[sortedBrackets.length - 1];
lastBracket.maxIncome = null;
```

### 2. Exemption Qualifications
```typescript
// Use JSON strings for complex criteria
const exemption: TaxExemption = {
  exemptionName: 'Family Exemption',
  exemptionType: 'Individual',
  qualifications: JSON.stringify({
    dependents: '>= 2',
    income: '< 50000',
    filingStatus: ['married', 'head-of-household']
  }),
  exemptionAmount: 5000,
  isActive: true
};
```

### 3. Policy Dates
```typescript
// Always use Date objects
const policy: TaxPolicy = {
  policyName: 'COVID-19 Tax Relief',
  policyType: 'Rate Change',
  impactType: 'Decrease',
  effectiveDate: new Date('2025-01-01'),
  expiryDate: new Date('2025-12-31'),
  rateChange: -5,
  isActive: true
};
```

### 4. Category Colors
```typescript
// Use consistent color scheme
const categoryColors = {
  'Personal Income Tax': '#3B82F6',  // Blue
  'Corporate Income Tax': '#10B981', // Green
  'Sales Tax': '#F59E0B',            // Amber
  'Property Tax': '#8B5CF6',         // Purple
  'Payroll Tax': '#EC4899',          // Pink
  'Excise Tax': '#EF4444'            // Red
};
```

## Error Handling

```typescript
async function saveTaxSystemWithErrorHandling() {
  try {
    // Validate first
    const errors = validateTaxSystem(taxSystem);
    if (errors.length > 0) {
      throw new Error('Validation failed: ' + errors.join(', '));
    }

    // Save
    const result = await createCountryMutation.mutateAsync({
      name: countryName,
      taxSystemData: taxSystem
    });

    // Success
    console.log('✅ Tax system saved successfully:', result.id);
    alert('Tax system saved successfully!');

    return result;
  } catch (error) {
    // Handle different error types
    if (error instanceof Error) {
      if (error.message.includes('Validation failed')) {
        alert('Please fix validation errors');
      } else if (error.message.includes('already exists')) {
        alert('A country with this name already exists');
      } else {
        alert('Failed to save tax system: ' + error.message);
      }
    }

    console.error('❌ Failed to save tax system:', error);
    throw error;
  }
}
```

## Testing Frontend Integration

```typescript
// Test with minimal data
const minimalTest = {
  taxSystemName: 'Test System',
  progressiveTax: true,
  categories: [
    {
      categoryName: 'Income Tax',
      categoryType: 'Direct',
      isActive: true,
      calculationMethod: 'percentage',
      deductionAllowed: true,
      priority: 10,
      brackets: [],
      exemptions: [],
      deductions: []
    }
  ]
};

// Test with complete data
const completeTest = {
  // ... (full example from above)
};

// Test with edge cases
const edgeCaseTest = {
  taxSystemName: 'Edge Case System',
  progressiveTax: true,
  categories: [
    {
      categoryName: 'Income Tax',
      categoryType: 'Direct',
      isActive: true,
      calculationMethod: 'tiered',
      deductionAllowed: true,
      priority: 10,
      brackets: [
        { minIncome: 0, maxIncome: null, rate: 20, marginalRate: true, isActive: true, priority: 1 }
      ],
      exemptions: [],
      deductions: []
    }
  ]
};
```

## Summary

1. **Structure data** hierarchically: system → categories → brackets/exemptions/deductions
2. **Validate** before sending to API
3. **Use Date objects** for date fields
4. **Use JSON strings** for complex qualifications
5. **Handle errors** gracefully with user-friendly messages
6. **Test** with minimal, complete, and edge case data

The backend will handle all persistence, creating all necessary database records in a single atomic transaction.
