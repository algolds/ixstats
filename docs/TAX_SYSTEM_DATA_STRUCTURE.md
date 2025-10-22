# Tax System Data Structure - Visual Guide

## Database Schema Relationships

```
Country (id)
    ↓ (countryId - unique)
TaxSystem (1)
    ├─→ taxCategories (N)
    │   └─→ TaxCategory
    │       ├─→ taxBrackets (N)
    │       │   └─→ TaxBracket
    │       ├─→ taxExemptions (N)
    │       │   └─→ TaxExemption [category-specific]
    │       └─→ taxDeductions (N)
    │           └─→ TaxDeduction
    │
    ├─→ taxExemptions (N)
    │   └─→ TaxExemption [system-wide, categoryId = null]
    │
    └─→ taxPolicy (N)
        └─→ TaxPolicy
```

## Example Data Flow

### Input Structure
```
┌─────────────────────────────────────────────────┐
│           taxSystemData (Input)                 │
├─────────────────────────────────────────────────┤
│ • taxSystemName: "Federal Tax System"          │
│ • progressiveTax: true                          │
│ • complianceRate: 92.5                          │
│                                                 │
│ categories: [                                   │
│   ┌───────────────────────────────────────┐   │
│   │ Category 1: Personal Income Tax       │   │
│   ├───────────────────────────────────────┤   │
│   │ • categoryName: "Personal Income Tax" │   │
│   │ • categoryType: "Direct"              │   │
│   │ • baseRate: 20                        │   │
│   │                                       │   │
│   │ brackets: [                           │   │
│   │   ┌─────────────────────────────┐   │   │
│   │   │ Bracket 1                   │   │   │
│   │   │ • minIncome: 0              │   │   │
│   │   │ • maxIncome: 10000          │   │   │
│   │   │ • rate: 10                  │   │   │
│   │   └─────────────────────────────┘   │   │
│   │   ┌─────────────────────────────┐   │   │
│   │   │ Bracket 2                   │   │   │
│   │   │ • minIncome: 10000          │   │   │
│   │   │ • maxIncome: 50000          │   │   │
│   │   │ • rate: 20                  │   │   │
│   │   └─────────────────────────────┘   │   │
│   │   ┌─────────────────────────────┐   │   │
│   │   │ Bracket 3                   │   │   │
│   │   │ • minIncome: 50000          │   │   │
│   │   │ • maxIncome: null           │   │   │
│   │   │ • rate: 35                  │   │   │
│   │   └─────────────────────────────┘   │   │
│   │ ]                                    │   │
│   │                                       │   │
│   │ exemptions: [                         │   │
│   │   ┌─────────────────────────────┐   │   │
│   │   │ Personal Allowance          │   │   │
│   │   │ • exemptionAmount: 12000    │   │   │
│   │   └─────────────────────────────┘   │   │
│   │ ]                                    │   │
│   │                                       │   │
│   │ deductions: [                         │   │
│   │   ┌─────────────────────────────┐   │   │
│   │   │ Standard Deduction          │   │   │
│   │   │ • maximumAmount: 10000      │   │   │
│   │   └─────────────────────────────┘   │   │
│   │ ]                                    │   │
│   └───────────────────────────────────────┘   │
│                                                 │
│   ┌───────────────────────────────────────┐   │
│   │ Category 2: Corporate Income Tax      │   │
│   ├───────────────────────────────────────┤   │
│   │ • categoryName: "Corporate Tax"       │   │
│   │ • brackets: [...]                     │   │
│   │ • exemptions: [...]                   │   │
│   │ • deductions: [...]                   │   │
│   └───────────────────────────────────────┘   │
│ ]                                               │
│                                                 │
│ systemWideExemptions: [                        │
│   ┌───────────────────────────────────────┐   │
│   │ Non-Profit Organizations              │   │
│   │ • exemptionRate: 100                  │   │
│   └───────────────────────────────────────┘   │
│ ]                                               │
│                                                 │
│ policies: [                                     │
│   ┌───────────────────────────────────────┐   │
│   │ Economic Stimulus                     │   │
│   │ • rateChange: -5                      │   │
│   │ • effectiveDate: 2025-01-01           │   │
│   └───────────────────────────────────────┘   │
│ ]                                               │
└─────────────────────────────────────────────────┘
```

### Database Records Created

```
┌────────────────────────────────────────────────┐
│           Database (After Persistence)         │
├────────────────────────────────────────────────┤
│                                                │
│ TaxSystem Table                                │
│ ┌─────────────────────────────────────────┐  │
│ │ id: "tax-sys-123"                       │  │
│ │ countryId: "country-456"                │  │
│ │ taxSystemName: "Federal Tax System"     │  │
│ │ progressiveTax: true                    │  │
│ │ complianceRate: 92.5                    │  │
│ └─────────────────────────────────────────┘  │
│                         ↓                      │
│ TaxCategory Table                              │
│ ┌─────────────────────────────────────────┐  │
│ │ id: "cat-001"                           │  │
│ │ taxSystemId: "tax-sys-123"              │  │
│ │ categoryName: "Personal Income Tax"     │  │
│ │ categoryType: "Direct"                  │  │
│ └─────────────────────────────────────────┘  │
│           ↓             ↓            ↓         │
│    ┌─────────┐   ┌──────────┐  ┌──────────┐ │
│    │Brackets │   │Exemptions│  │Deductions│ │
│    └─────────┘   └──────────┘  └──────────┘ │
│                                                │
│ TaxBracket Table                               │
│ ┌─────────────────────────────────────────┐  │
│ │ id: "bracket-001"                       │  │
│ │ categoryId: "cat-001"                   │  │
│ │ minIncome: 0                            │  │
│ │ maxIncome: 10000                        │  │
│ │ rate: 10                                │  │
│ └─────────────────────────────────────────┘  │
│ ┌─────────────────────────────────────────┐  │
│ │ id: "bracket-002"                       │  │
│ │ categoryId: "cat-001"                   │  │
│ │ minIncome: 10000                        │  │
│ │ maxIncome: 50000                        │  │
│ │ rate: 20                                │  │
│ └─────────────────────────────────────────┘  │
│ ┌─────────────────────────────────────────┐  │
│ │ id: "bracket-003"                       │  │
│ │ categoryId: "cat-001"                   │  │
│ │ minIncome: 50000                        │  │
│ │ maxIncome: null                         │  │
│ │ rate: 35                                │  │
│ └─────────────────────────────────────────┘  │
│                                                │
│ TaxExemption Table                             │
│ ┌─────────────────────────────────────────┐  │
│ │ id: "exempt-001"                        │  │
│ │ categoryId: "cat-001"                   │  │
│ │ exemptionName: "Personal Allowance"     │  │
│ │ exemptionAmount: 12000                  │  │
│ └─────────────────────────────────────────┘  │
│ ┌─────────────────────────────────────────┐  │
│ │ id: "exempt-002"                        │  │
│ │ categoryId: null [SYSTEM-WIDE]          │  │
│ │ exemptionName: "Non-Profit Orgs"        │  │
│ │ exemptionRate: 100                      │  │
│ └─────────────────────────────────────────┘  │
│                                                │
│ TaxDeduction Table                             │
│ ┌─────────────────────────────────────────┐  │
│ │ id: "deduct-001"                        │  │
│ │ categoryId: "cat-001"                   │  │
│ │ deductionName: "Standard Deduction"     │  │
│ │ maximumAmount: 10000                    │  │
│ └─────────────────────────────────────────┘  │
│                                                │
│ TaxPolicy Table                                │
│ ┌─────────────────────────────────────────┐  │
│ │ id: "policy-001"                        │  │
│ │ taxSystemId: "tax-sys-123"              │  │
│ │ policyName: "Economic Stimulus"         │  │
│ │ rateChange: -5                          │  │
│ │ effectiveDate: 2025-01-01               │  │
│ └─────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘

Total Records: 9
  - 1 TaxSystem
  - 1 TaxCategory
  - 3 TaxBrackets
  - 2 TaxExemptions (1 category, 1 system-wide)
  - 1 TaxDeduction
  - 1 TaxPolicy
```

## Comprehensive Example

### Full System with 4 Categories

```
TaxSystem: "National Tax System"
│
├─ Category 1: Personal Income Tax
│  ├─ Bracket 1: $0 - $15,000 → 0%
│  ├─ Bracket 2: $15,000 - $50,000 → 10%
│  ├─ Bracket 3: $50,000 - $100,000 → 20%
│  ├─ Bracket 4: $100,000 - $200,000 → 30%
│  └─ Bracket 5: $200,000+ → 40%
│  │
│  ├─ Exemption 1: Personal Allowance ($15,000)
│  ├─ Exemption 2: Senior Citizen ($5,000)
│  └─ Exemption 3: Dependent Allowance ($3,000 each)
│  │
│  ├─ Deduction 1: Standard ($10,000)
│  ├─ Deduction 2: Mortgage Interest (up to $750,000)
│  └─ Deduction 3: Charitable Contributions (50% of AGI)
│
├─ Category 2: Corporate Income Tax
│  ├─ Bracket 1: $0 - $500,000 → 15%
│  ├─ Bracket 2: $500,000 - $5M → 25%
│  └─ Bracket 3: $5M+ → 30%
│  │
│  ├─ Exemption 1: Startup Exemption (50% off, 3 years)
│  └─ Exemption 2: R&D Tax Credit (25%)
│  │
│  ├─ Deduction 1: Operating Expenses (100%)
│  └─ Deduction 2: Depreciation (100%)
│
├─ Category 3: Sales Tax (VAT)
│  ├─ Base Rate: 20%
│  │
│  ├─ Exemption 1: Essential Goods (100% exempt)
│  │   - Food, medicine, education
│  └─ Exemption 2: Small Business (revenue < $100k)
│
└─ Category 4: Property Tax
   ├─ Base Rate: 1.5% of assessed value
   │
   └─ Exemption 1: Primary Residence ($250k exempt)

System-Wide Exemptions:
├─ Non-Profit Organizations (100% exempt)
└─ Government Entities (100% exempt)

Tax Policies:
├─ Policy 1: Economic Stimulus Tax Relief
│  - Corporate rate -5% (2025-2026)
│  - Estimated impact: -$5B
│
└─ Policy 2: Green Energy Tax Credit
   - 25% credit for renewable investments
   - Estimated impact: -$1B
```

### Database Record Count

```
1 TaxSystem
  ├─ 4 TaxCategories
  │   ├─ 11 TaxBrackets (5+3+1+1+1)
  │   ├─ 7 Category Exemptions (3+2+2)
  │   └─ 5 TaxDeductions (3+2)
  ├─ 2 System-Wide Exemptions
  └─ 2 TaxPolicies

Total: 32 database records
```

## Data Retrieval

### Query Structure

```typescript
const completeSystem = await db.taxSystem.findUnique({
  where: { countryId: 'country-id' },
  include: {
    taxCategories: {
      include: {
        taxBrackets: true,
        taxExemptions: true,
        taxDeductions: true
      }
    },
    taxExemptions: {
      where: { categoryId: null } // System-wide only
    },
    taxPolicy: true
  }
});
```

### Returned Structure

```javascript
{
  id: "tax-sys-123",
  taxSystemName: "National Tax System",
  progressiveTax: true,
  complianceRate: 92.5,

  taxCategories: [
    {
      id: "cat-001",
      categoryName: "Personal Income Tax",
      categoryType: "Direct",

      taxBrackets: [
        { id: "bracket-001", minIncome: 0, maxIncome: 15000, rate: 0 },
        { id: "bracket-002", minIncome: 15000, maxIncome: 50000, rate: 10 },
        { id: "bracket-003", minIncome: 50000, maxIncome: 100000, rate: 20 },
        { id: "bracket-004", minIncome: 100000, maxIncome: 200000, rate: 30 },
        { id: "bracket-005", minIncome: 200000, maxIncome: null, rate: 40 }
      ],

      taxExemptions: [
        { id: "exempt-001", exemptionName: "Personal Allowance", exemptionAmount: 15000 },
        { id: "exempt-002", exemptionName: "Senior Citizen", exemptionAmount: 5000 },
        { id: "exempt-003", exemptionName: "Dependent Allowance", exemptionAmount: 3000 }
      ],

      taxDeductions: [
        { id: "deduct-001", deductionName: "Standard", maximumAmount: 10000 },
        { id: "deduct-002", deductionName: "Mortgage Interest", maximumAmount: 750000 },
        { id: "deduct-003", deductionName: "Charitable", percentage: 50 }
      ]
    },
    // ... more categories
  ],

  taxExemptions: [ // System-wide only
    { id: "exempt-sys-001", categoryId: null, exemptionName: "Non-Profit Orgs", exemptionRate: 100 },
    { id: "exempt-sys-002", categoryId: null, exemptionName: "Government", exemptionRate: 100 }
  ],

  taxPolicy: [
    { id: "policy-001", policyName: "Economic Stimulus", rateChange: -5 },
    { id: "policy-002", policyName: "Green Energy Credit", exemptionRate: 25 }
  ]
}
```

## Key Relationships

### One-to-One
```
Country ←→ TaxSystem (unique countryId)
```

### One-to-Many
```
TaxSystem → TaxCategory (many categories per system)
TaxSystem → TaxExemption (system-wide exemptions)
TaxSystem → TaxPolicy (many policies per system)

TaxCategory → TaxBracket (many brackets per category)
TaxCategory → TaxExemption (many exemptions per category)
TaxCategory → TaxDeduction (many deductions per category)
```

### Special Case: System-Wide Exemptions
```
TaxExemption with categoryId = null
  - Applies to entire tax system
  - Not tied to specific category
  - Examples: Non-profits, government entities
```

## Transaction Flow

```
BEGIN TRANSACTION

1. Create TaxSystem
   ↓
2. For each category:
   a. Create TaxCategory
      ↓
   b. For each bracket:
      - Create TaxBracket
      ↓
   c. For each exemption:
      - Create TaxExemption (with categoryId)
      ↓
   d. For each deduction:
      - Create TaxDeduction
      ↓
3. For each system-wide exemption:
   - Create TaxExemption (categoryId = null)
   ↓
4. For each policy:
   - Create TaxPolicy

COMMIT TRANSACTION
```

If any step fails, entire transaction rolls back (no partial data).

## Summary

### Hierarchical Structure
```
TaxSystem (1)
  └─ Categories (N)
      ├─ Brackets (N per category)
      ├─ Exemptions (N per category)
      └─ Deductions (N per category)
  └─ System Exemptions (N)
  └─ Policies (N)
```

### Field Counts
- **TaxSystem**: 14 fields
- **TaxCategory**: 14 fields + 3 nested arrays
- **TaxBracket**: 9 fields
- **TaxExemption**: 11 fields
- **TaxDeduction**: 9 fields
- **TaxPolicy**: 13 fields

**Total**: 50+ unique fields across 6 models

### Database Operations
- **Create**: All models support full CRUD
- **Read**: Includes with nested relations
- **Update**: Individual model updates
- **Delete**: Cascade delete (remove country → removes all tax data)

### Performance
- Single transaction for atomicity
- Indexed foreign keys for fast lookups
- Efficient nested queries with Prisma includes
- Scalable to hundreds of brackets/exemptions per country
