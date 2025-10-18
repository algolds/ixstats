# Tax System Architecture

**Version:** 1.1.0
**Last Updated:** October 2025
**Status:** Production Ready

## Overview

The Tax System is a comprehensive, multi-tiered taxation framework that enables countries to design sophisticated tax structures with progressive brackets, exemptions, deductions, and atomic component integration. The system includes a visual builder, real-time calculator, economic integration, and effectiveness analytics.

## Architecture Overview

The Tax System is built on a modular architecture with three primary layers:

1. **Data Layer**: Prisma models (TaxSystem, TaxCategory, TaxBracket, etc.)
2. **Business Logic**: tRPC router with 16 endpoints + integration services
3. **Presentation Layer**: 42 atomic components + TaxBuilder interface

### Core Components

```
Tax System
├── TaxBuilder (Main Interface)
│   ├── TaxSystemForm (Basic configuration)
│   ├── TaxCategoryForm (Category management)
│   ├── TaxCalculator (Real-time calculations)
│   └── Preview & Templates
├── Atomic Components (42 total)
│   ├── AtomicTaxComponents (Component selector)
│   ├── TaxSystemForm (System-level settings)
│   ├── TaxCategoryForm (Category editor)
│   └── TaxCalculator (Revenue projections)
├── Integration Services
│   ├── Tax-Economy Sync
│   ├── Tax-Government Sync
│   └── Unified Effectiveness Calculator
└── tRPC Router (16 endpoints)
```

## Atomic Tax Components

### Component System (42 Components)

The tax system uses a modular atomic component architecture enabling flexible tax structure design:

#### Revenue-Based Components (12)
```typescript
INCOME_TAX              // Personal income taxation
CORPORATE_TAX           // Business profit taxation
CAPITAL_GAINS_TAX       // Investment income taxation
WEALTH_TAX              // Net worth taxation
ESTATE_TAX              // Inheritance taxation
PROPERTY_TAX            // Real estate taxation
PAYROLL_TAX             // Employment-based taxation
SALES_TAX               // Consumption taxation
VALUE_ADDED_TAX         // Multi-stage consumption tax
EXCISE_TAX              // Specific goods taxation
CUSTOMS_DUTY            // Import taxation
CARBON_TAX              // Environmental taxation
```

#### Administration Components (10)
```typescript
TAX_AUTHORITY           // Central tax administration
REGIONAL_TAX_OFFICES    // Local tax collection
AUDIT_DIVISION          // Compliance enforcement
TAXPAYER_SERVICES       // Support and education
APPEALS_TRIBUNAL        // Dispute resolution
E_FILING_SYSTEM         // Digital filing infrastructure
TAX_INCENTIVES_OFFICE   // Economic development incentives
WITHHOLDING_SYSTEM      // Automated collection
REVENUE_FORECASTING     // Projection and planning
TAX_RESEARCH_UNIT       // Policy analysis
```

#### Compliance Components (10)
```typescript
TAXPAYER_IDENTIFICATION // Registration system
FILING_DEADLINES        // Schedule management
PENALTY_STRUCTURE       // Non-compliance penalties
INTEREST_ON_ARREARS     // Late payment interest
TAX_AMNESTY_PROGRAM     // Compliance recovery
VOLUNTARY_DISCLOSURE    // Self-correction program
TRANSFER_PRICING_RULES  // International tax compliance
ANTI_AVOIDANCE_RULES    // Tax evasion prevention
AUTOMATIC_EXCHANGE      // International information sharing
WHISTLEBLOWER_PROGRAM   // Fraud detection
```

#### Policy Components (10)
```typescript
PROGRESSIVE_STRUCTURE   // Income-based progression
FLAT_TAX_OPTION        // Simplified taxation
DUAL_INCOME_SYSTEM     // Split income types
TERRITORIAL_SYSTEM     // Location-based taxation
WORLDWIDE_SYSTEM       // Citizen-based taxation
TAX_TREATIES           // International agreements
SPECIAL_ECONOMIC_ZONES // Regional incentives
STARTUP_INCENTIVES     // New business support
GREEN_TAX_CREDITS      // Environmental incentives
RESEARCH_CREDITS       // Innovation support
```

### Component Selection

```typescript
import { AtomicTaxComponentSelector } from './atoms/AtomicTaxComponents';

<AtomicTaxComponentSelector
  selectedComponents={selectedComponents}
  onComponentChange={setSelectedComponents}
  maxComponents={15}
  isReadOnly={false}
/>
```

### Component Effectiveness

Each component contributes to overall tax system effectiveness:

```typescript
interface ComponentEffectiveness {
  collectionEfficiency: number;    // Revenue capture rate (0-100)
  complianceRate: number;          // Taxpayer compliance (0-100)
  administrativeCost: number;      // % of revenue spent on admin
  economicImpact: number;          // GDP impact multiplier
  synergies: ComponentType[];      // Complementary components
  conflicts: ComponentType[];      // Incompatible components
}
```

## TaxBuilder Component

### Main Interface

**Location:** `/src/components/tax-system/TaxBuilder.tsx`

The TaxBuilder is the central interface for designing tax systems, providing a step-by-step workflow:

#### Step 1: Tax System Configuration
```typescript
interface TaxSystemInput {
  taxSystemName: string;
  taxAuthority?: string;
  fiscalYear: 'calendar' | 'april-march' | 'july-june' | 'october-september';
  taxCode?: string;
  baseRate?: number;
  progressiveTax: boolean;
  flatTaxRate?: number;
  alternativeMinTax: boolean;
  alternativeMinRate?: number;
  complianceRate?: number;
  collectionEfficiency?: number;
}
```

#### Step 2: Tax Categories
```typescript
interface TaxCategoryInput {
  categoryName: string;
  categoryType: string;
  description?: string;
  baseRate?: number;
  calculationMethod: 'percentage' | 'fixed' | 'tiered' | 'progressive';
  isActive: boolean;
  deductionAllowed: boolean;
  priority: number;
  color?: string;
}
```

#### Step 3: Tax Brackets
```typescript
interface TaxBracketInput {
  bracketName?: string;
  minIncome: number;
  maxIncome?: number;
  rate: number;
  flatAmount?: number;
  marginalRate: boolean;
}
```

#### Step 4: Exemptions & Deductions
```typescript
interface TaxExemptionInput {
  exemptionName: string;
  exemptionType: string;
  description?: string;
  exemptionAmount?: number;
  exemptionRate?: number;
  qualifications?: string;
  endDate?: Date;
  isActive: boolean;
}

interface TaxDeductionInput {
  deductionName: string;
  deductionType: string;
  description?: string;
  maximumAmount?: number;
  percentage?: number;
}
```

### Usage Example

```typescript
import { TaxBuilder } from '~/components/tax-system/TaxBuilder';

<TaxBuilder
  countryId={countryId}
  initialData={existingTaxData}
  onSave={async (data) => {
    await api.taxSystem.create.mutateAsync({
      countryId,
      data
    });
  }}
  onChange={(data) => {
    console.log('Tax system updated:', data);
  }}
  showAtomicIntegration={true}
  enableAutoSync={true}
  economicData={economicData}
  governmentData={governmentData}
/>
```

## Tax Calculation Engine

### TaxCalculator Component

**Location:** `/src/components/tax-system/atoms/TaxCalculator.tsx`

Real-time tax calculation with comprehensive analytics:

```typescript
interface TaxCalculationResult {
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
  breakdown: TaxBreakdown[];
  projectedRevenue?: number;
  revenueByCategory?: Record<string, number>;
}

interface TaxBreakdown {
  categoryId: string;
  categoryName: string;
  taxableAmount: number;
  taxAmount: number;
  effectiveRate: number;
  appliedBrackets: {
    bracketId: string;
    incomeInBracket: number;
    rate: number;
    taxAmount: number;
  }[];
}
```

### Calculation Methods

#### 1. Progressive Taxation
```typescript
function calculateProgressiveTax(
  income: number,
  brackets: TaxBracket[]
): number {
  let totalTax = 0;
  let remainingIncome = income;

  for (const bracket of brackets.sort((a, b) => a.minIncome - b.minIncome)) {
    if (remainingIncome <= 0) break;

    const bracketIncome = Math.min(
      remainingIncome,
      (bracket.maxIncome || Infinity) - bracket.minIncome
    );

    totalTax += bracketIncome * (bracket.rate / 100);
    remainingIncome -= bracketIncome;
  }

  return totalTax;
}
```

#### 2. Flat Tax
```typescript
function calculateFlatTax(
  income: number,
  rate: number,
  exemption: number
): number {
  return Math.max(0, income - exemption) * (rate / 100);
}
```

#### 3. Tiered Taxation
```typescript
function calculateTieredTax(
  amount: number,
  brackets: TaxBracket[]
): number {
  const applicableBracket = brackets.find(b =>
    amount >= b.minIncome &&
    (!b.maxIncome || amount < b.maxIncome)
  );

  return applicableBracket
    ? amount * (applicableBracket.rate / 100)
    : 0;
}
```

## Integration with Government and Economy Systems

### Tax-Government Integration

```typescript
import { getUnifiedTaxEffectiveness } from '~/lib/unified-atomic-tax-integration';

const effectiveness = getUnifiedTaxEffectiveness(
  taxSystem,
  governmentComponents,
  economicData
);

// Returns:
{
  baseEffectiveness: 75,
  governmentBonus: 12,
  economicModifier: 8,
  totalEffectiveness: 95,
  collectionRate: 92,
  complianceRate: 88,
  administrativeEfficiency: 85
}
```

### Tax-Economy Sync

```typescript
import { TaxEconomySyncDisplay } from './TaxEconomySyncDisplay';

<TaxEconomySyncDisplay
  taxSystem={taxSystem}
  economicData={economicData}
  onOptimize={() => {
    // Automatically adjust tax rates for optimal revenue
    const optimized = optimizeTaxRates(
      taxSystem,
      economicData,
      targetRevenue
    );
  }}
/>
```

### Revenue Projections

```typescript
import { calculateRecommendedTaxRevenue } from '~/lib/tax-data-parser';

const projections = calculateRecommendedTaxRevenue(
  governmentData,
  economicData
);

// Returns:
{
  totalRevenue: 450_000_000_000,
  revenueByCategory: {
    incomeTax: 180_000_000_000,
    corporateTax: 120_000_000_000,
    salesTax: 90_000_000_000,
    propertyTax: 40_000_000_000,
    other: 20_000_000_000
  },
  gdpPercent: 28.5,
  perCapita: 4500
}
```

## tRPC Router Endpoints (16 endpoints)

**Location:** `/src/server/api/routers/taxSystem.ts`

### Query Endpoints (3)

#### 1. Get Tax System
```typescript
taxSystem.getByCountryId.useQuery({ countryId: string })

// Returns: TaxBuilderState | null
```

#### 2. Calculate Unified Effectiveness
```typescript
taxSystem.calculateUnifiedEffectiveness.useQuery({
  taxSystemId: string
})

// Returns: UnifiedEffectiveness
```

#### 3. Get Tax Recommendations
```typescript
taxSystem.getTaxRecommendations.useQuery({ countryId: string })

// Returns: {
//   tier: 'Advanced' | 'Developed' | 'Emerging' | 'Developing',
//   gdpPerCapita: number,
//   recommendations: TaxRecommendation[],
//   analysis: TaxSystemAnalysis
// }
```

### Mutation Endpoints (13)

#### 1. Parse Economic Data
```typescript
taxSystem.parseEconomicDataForTax.useMutation({
  coreIndicators: {
    gdpPerCapita: number,
    nominalGDP: number,
    population: number
  },
  governmentData?: any,
  options?: {
    useAggressiveParsing?: boolean,
    includeGovernmentPolicies?: boolean,
    autoGenerateBrackets?: boolean,
    targetRevenueMatch?: boolean
  }
})

// Returns: {
//   parsedData: TaxBuilderState,
//   revenueRecommendations?: RevenueProjections
// }
```

#### 2. Calculate Tax Effectiveness
```typescript
taxSystem.calculateTaxEffectiveness.useMutation({
  taxComponents: string[],
  governmentComponents: string[],
  economicData: {
    gdpPerCapita: number,
    nominalGDP: number,
    population: number
  },
  baseTaxSystem: {
    collectionEfficiency: number,
    complianceRate: number,
    auditCapacity?: number
  }
})

// Returns: EnhancedEffectiveness
```

#### 3. Check Conflicts
```typescript
taxSystem.checkConflicts.useMutation({
  countryId: string,
  data: TaxBuilderState
})

// Returns: {
//   warnings: ConflictWarning[]
// }
```

#### 4. Create Tax System
```typescript
taxSystem.create.useMutation({
  countryId: string,
  data: TaxBuilderState,
  skipConflictCheck?: boolean
})

// Returns: {
//   taxSystem: TaxSystem,
//   syncResult: SyncResult,
//   warnings: ConflictWarning[]
// }
```

#### 5. Update Tax System
```typescript
taxSystem.update.useMutation({
  countryId: string,
  data: TaxBuilderState,
  skipConflictCheck?: boolean
})

// Returns: {
//   taxSystem: TaxSystem,
//   syncResult: SyncResult,
//   warnings: ConflictWarning[]
// }
```

#### 6. Delete Tax System
```typescript
taxSystem.delete.useMutation({ countryId: string })

// Returns: { success: boolean }
```

## Database Models

### TaxSystem Model

```prisma
model TaxSystem {
  id                    String         @id @default(cuid())
  countryId             String         @unique
  country               Country        @relation(fields: [countryId], references: [id], onDelete: Cascade)

  taxSystemName         String
  taxAuthority          String?
  fiscalYear            String
  taxCode               String?
  baseRate              Float?
  progressiveTax        Boolean        @default(true)
  flatTaxRate           Float?
  alternativeMinTax     Boolean        @default(false)
  alternativeMinRate    Float?
  taxHolidays           String?
  complianceRate        Float?
  collectionEfficiency  Float?
  lastReform            DateTime?

  taxCategories         TaxCategory[]
  taxBrackets           TaxBracket[]
  taxExemptions         TaxExemption[]

  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  @@index([countryId])
}
```

### TaxCategory Model

```prisma
model TaxCategory {
  id                String         @id @default(cuid())
  taxSystemId       String
  taxSystem         TaxSystem      @relation(fields: [taxSystemId], references: [id], onDelete: Cascade)

  categoryName      String
  categoryType      String
  description       String?
  isActive          Boolean        @default(true)
  baseRate          Float?
  calculationMethod String         @default("percentage")
  minimumAmount     Float          @default(0)
  maximumAmount     Float?
  exemptionAmount   Float?
  deductionAllowed  Boolean        @default(true)
  standardDeduction Float?
  priority          Int            @default(100)
  color             String?
  icon              String?

  taxBrackets       TaxBracket[]
  taxExemptions     TaxExemption[]
  taxDeductions     TaxDeduction[]

  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@index([taxSystemId])
  @@index([categoryType])
}
```

### TaxBracket Model

```prisma
model TaxBracket {
  id              String         @id @default(cuid())
  taxSystemId     String
  taxSystem       TaxSystem      @relation(fields: [taxSystemId], references: [id], onDelete: Cascade)
  categoryId      String
  category        TaxCategory    @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  bracketName     String?
  minIncome       Float
  maxIncome       Float?
  rate            Float
  flatAmount      Float?
  marginalRate    Boolean        @default(true)

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([taxSystemId])
  @@index([categoryId])
}
```

## Tax Effectiveness Formulas

### Base Effectiveness

```typescript
baseEffectiveness = (
  (collectionEfficiency * 0.4) +
  (complianceRate * 0.3) +
  (administrativeEfficiency * 0.3)
)
```

### Government Component Bonus

```typescript
governmentBonus = governmentComponents.length * 2 // +2% per component
```

### Economic Tier Multiplier

```typescript
economicTierMultiplier =
  gdpPerCapita > 50000 ? 1.10 :
  gdpPerCapita > 25000 ? 1.05 :
  gdpPerCapita > 10000 ? 1.00 :
  0.95
```

### Total Effectiveness

```typescript
totalEffectiveness = Math.min(100,
  (baseEffectiveness + governmentBonus) * economicTierMultiplier
)
```

### Revenue Collection Rate

```typescript
actualRevenue = theoreticalRevenue * (totalEffectiveness / 100)
```

## Development Guide

### Creating a New Tax Category

```typescript
const newCategory: TaxCategoryInput = {
  categoryName: 'Digital Services Tax',
  categoryType: 'Indirect Tax',
  description: 'Tax on digital platform revenues',
  baseRate: 3,
  calculationMethod: 'percentage',
  isActive: true,
  deductionAllowed: false,
  priority: 75,
  color: '#10b981'
};

// Add brackets for tiered structure
const brackets: TaxBracketInput[] = [
  { minIncome: 0, maxIncome: 1_000_000, rate: 2, marginalRate: false },
  { minIncome: 1_000_000, maxIncome: 10_000_000, rate: 3, marginalRate: false },
  { minIncome: 10_000_000, rate: 5, marginalRate: false }
];

// Save to database
await api.taxSystem.create.mutateAsync({
  countryId,
  data: {
    taxSystem: currentTaxSystem,
    categories: [...existingCategories, newCategory],
    brackets: {
      ...existingBrackets,
      [newCategoryIndex]: brackets
    },
    exemptions: existingExemptions,
    deductions: existingDeductions
  }
});
```

### Implementing Custom Calculation Method

```typescript
// Add to TaxCalculator.tsx
function calculateCustomTax(
  baseAmount: number,
  category: TaxCategory,
  customParams: any
): number {
  // Custom calculation logic
  const adjustedBase = baseAmount * customParams.adjustment;
  const rawTax = adjustedBase * (category.baseRate / 100);

  // Apply caps and floors
  return Math.max(
    category.minimumAmount || 0,
    Math.min(rawTax, category.maximumAmount || Infinity)
  );
}
```

### Adding Integration Services

```typescript
// Create /src/lib/custom-tax-integration.ts
export function integrateTaxWithCustomSystem(
  taxSystem: TaxSystem,
  customData: any
): IntegrationResult {
  // Integration logic
  const mappedData = mapTaxToCustom(taxSystem);
  const validations = validateIntegration(mappedData, customData);

  if (validations.errors.length > 0) {
    return { success: false, errors: validations.errors };
  }

  return {
    success: true,
    data: mappedData,
    metrics: calculateIntegrationMetrics(mappedData)
  };
}
```

## Templates

The system includes 5 pre-built tax system templates:

1. **Caphirian Imperial Tax System**: Complex multi-tiered with imperial structure
2. **Progressive Tax System**: Standard multi-bracket progressive rates
3. **Flat Tax System**: Simple flat rate with basic exemptions
4. **Nordic Social Democratic Model**: High-tax comprehensive welfare state
5. **East Asian Developmental Model**: Business-friendly growth-oriented system

### Using Templates

```typescript
import { taxSystemTemplates } from './TaxBuilder';

const template = taxSystemTemplates.find(t =>
  t.name === 'Progressive Tax System'
);

const initialData = {
  taxSystem: {
    taxSystemName: `${template.name} for ${countryName}`,
    fiscalYear: template.fiscalYear,
    progressiveTax: template.progressiveTax,
    complianceRate: 85,
    collectionEfficiency: 90
  },
  categories: template.categories,
  brackets: buildBracketsFromTemplate(template),
  exemptions: template.categories.flatMap(c => c.exemptions || []),
  deductions: buildDeductionsFromTemplate(template)
};
```

## Testing

### Unit Testing Tax Calculations

```typescript
import { describe, it, expect } from 'vitest';
import { calculateProgressiveTax } from './TaxCalculator';

describe('Progressive Tax Calculation', () => {
  it('should calculate correct tax for income within single bracket', () => {
    const brackets = [
      { minIncome: 0, maxIncome: 50000, rate: 10, marginalRate: true },
      { minIncome: 50000, rate: 20, marginalRate: true }
    ];

    const tax = calculateProgressiveTax(30000, brackets);
    expect(tax).toBe(3000); // 30,000 * 10%
  });

  it('should calculate correct tax across multiple brackets', () => {
    const brackets = [
      { minIncome: 0, maxIncome: 50000, rate: 10, marginalRate: true },
      { minIncome: 50000, rate: 20, marginalRate: true }
    ];

    const tax = calculateProgressiveTax(70000, brackets);
    expect(tax).toBe(9000); // (50,000 * 10%) + (20,000 * 20%)
  });
});
```

## Performance Optimization

### Caching Calculations

```typescript
import { useMemo } from 'react';

const calculationResult = useMemo(() => {
  return calculateTax(income, taxSystem, categories, brackets);
}, [income, taxSystem, categories, brackets]);
```

### Debouncing Real-time Updates

```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedCalculate = useDebouncedCallback(
  (income: number) => {
    const result = calculateTax(income, taxSystem);
    setCalculationResult(result);
  },
  300 // 300ms delay
);
```

## Related Documentation

- [Atomic Components Guide](/docs/ATOMIC_COMPONENTS_GUIDE.md)
- [Economic Systems](/docs/technical/ECONOMIC_SYSTEMS_README.md)
- [Database Schema](/prisma/schema.prisma)
- [API Reference](/docs/API_REFERENCE.md)
- [Builder System](/docs/BUILDER_SYSTEM.md)

---

**Note:** The tax system is fully integrated with the economic and government systems. Changes to tax structure automatically trigger recalculations of revenue projections and government budget impacts.
