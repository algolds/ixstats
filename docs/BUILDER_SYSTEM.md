# Builder System Documentation

**Version:** 1.1.0
**Last Updated:** October 2025
**Status:** Production-Ready (90% Feature Complete)

## Table of Contents

1. [Overview](#overview)
2. [7-Step Workflow](#7-step-workflow)
3. [Integration Services](#integration-services)
4. [Auto-Save Mechanism](#auto-save-mechanism)
5. [Validation System](#validation-system)
6. [Cross-System Synergy](#cross-system-synergy)
7. [Component Mapping](#component-mapping)
8. [Country Creation](#country-creation)
9. [Development Guide](#development-guide)

---

## Overview

The Builder System is a comprehensive country creation workflow that guides users through building a complete nation from foundation to preview. It integrates atomic components, economic data, government structures, and tax systems into a unified country entity.

### Key Features

- **7-Step Workflow**: Foundation → Core → Components → Economics → Government → Tax → Preview
- **12+ Integration Services**: Cross-system validation and synergy detection
- **Auto-Save**: 500ms debounce with localStorage persistence
- **Real-time Validation**: Step-by-step validation with blocking progression
- **Component Synergy**: Government components suggest economic settings
- **Quick-Start**: Skip foundation and start with default values

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Builder System                            │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Foundation  │   Atomic     │ Integration  │   Validation   │
│   Selector   │  Components  │   Services   │     Engine     │
└──────────────┴──────────────┴──────────────┴────────────────┘
       │               │               │               │
       └───────────────┴───────────────┴───────────────┘
                           │
                    ┌──────▼──────┐
                    │  Unified    │
                    │   Builder   │
                    │   State     │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐     ┌─────▼─────┐    ┌─────▼─────┐
    │ Country │     │ Government│    │   Tax     │
    │  Data   │     │ Structure │    │  System   │
    └─────────┘     └───────────┘    └───────────┘
```

---

## 7-Step Workflow

### Step 1: Foundation (Optional)

**Purpose**: Select a real-world country as a starting point
**Location**: `/app/builder/page.tsx` (foundation view)
**Skippable**: Yes (Quick-Start mode)

**Features:**
- Search 195+ real countries
- Filter by region, economic tier, population tier
- Preview country card with key metrics
- Import economic/demographic data

**Data Imported:**
```typescript
interface RealCountryData {
  name: string;
  flag: string;
  capital: string;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  growthRate: number;
  populationGrowthRate: number;
  economicTier: 'developed' | 'emerging' | 'developing';
  populationTier: 'tiny' | 'small' | 'medium' | 'large' | 'massive';
  region: string;
  continent: string;
  governmentType: string;
  // ... other fields
}
```

**User Actions:**
- **Select Country**: Load foundation data and proceed to Core
- **Skip**: Quick-start with default values
- **Import Custom**: Upload JSON data file

**Validation:**
- None (optional step)

---

### Step 2: Core Identity

**Purpose**: Define national identity and core indicators
**Location**: `/app/builder/components/enhanced/steps/CoreStep.tsx`
**Required**: Yes

**Tabs:**
1. **Identity**: Name, capital, currency, language, symbols
2. **Indicators**: GDP, population, growth rates, tier classifications
3. **Geography**: Land area, climate, resources

**Identity Fields:**

```typescript
interface NationalIdentity {
  countryName: string;           // Required, unique
  capitalCity: string;            // Required
  currency: string;               // Required
  officialLanguages: string;      // Optional
  nationalAnthem: string;         // Optional
  motto: string;                  // Optional
  flagUrl?: string;               // Optional (uploaded)
  coatOfArmsUrl?: string;         // Optional (uploaded)
}
```

**Core Indicators:**

```typescript
interface CoreIndicators {
  gdpPerCapita: number;          // Required, > 0
  totalPopulation: number;        // Required, > 0
  realGDPGrowthRate: number;      // Required, -20 to 20%
  populationGrowthRate: number;   // Required, -5 to 10%
  economicTier: 'developed' | 'emerging' | 'developing';
  populationTier: 'tiny' | 'small' | 'medium' | 'large' | 'massive';
}
```

**Validation Rules:**
- ✅ Country name must be unique
- ✅ GDP per capita > $500
- ✅ Population > 1,000
- ✅ Growth rates within realistic bounds

**User Actions:**
- **Continue**: Validate and proceed to Components
- **Import from Wiki**: Fetch data from IxWiki/IIWiki
- **Load Template**: Use economic archetype

---

### Step 3: Component Selection

**Purpose**: Select atomic government components
**Location**: `/app/builder/components/enhanced/steps/ComponentSelectionStep.tsx`
**Required**: Yes (minimum 3 components)

**Component Categories:**

```typescript
type ComponentCategory =
  | 'executive'      // Leadership (President, PM, Monarch, Council)
  | 'legislative'    // Parliament, Congress, Assembly
  | 'judicial'       // Courts, tribunals, legal system
  | 'administrative' // Bureaucracy, civil service
  | 'security'       // Military, police, intelligence
  | 'economic'       // Central bank, regulators
  | 'cultural'       // Education, arts, heritage
  | 'infrastructure' // Transport, utilities, communications
```

**Component Structure:**

```typescript
interface ComponentType {
  id: string;
  name: string;
  category: ComponentCategory;
  description: string;
  powerLevel: number;            // 0-100
  autonomy: number;              // 0-100
  transparency: number;          // 0-100
  efficiency: number;            // 0-100
  prerequisites: string[];       // Required components
  conflicts: string[];           // Incompatible components
  economicImpact: {
    gdpEffect: number;           // -10 to +10%
    spendingCost: number;        // % of GDP
    sectors: string[];           // Affected sectors
  };
  synergies: Array<{
    componentId: string;
    bonus: number;               // +5 to +20%
    effect: string;
  }>;
}
```

**Selection Rules:**
- ✅ Minimum 3 components
- ✅ Maximum 24 components
- ✅ At least 1 executive component
- ✅ At least 1 legislative component
- ✅ No conflicting components
- ✅ Prerequisites satisfied

**Synergy Detection:**

```typescript
// Auto-detect synergies between selected components
const synergies = crossBuilderSynergyService.detectSynergies(
  selectedComponents
);

// Example synergy: Parliament + Judiciary
{
  componentIds: ['parliament', 'supreme_court'],
  synergyType: 'checks_balances',
  bonus: 15, // +15% effectiveness
  effect: 'Enhanced rule of law and accountability',
  economicBonus: { gdp: 2, stability: 10 }
}
```

**User Actions:**
- **Add Component**: Select from component library
- **Remove Component**: Deselect component
- **View Details**: Show component card with full stats
- **Check Synergies**: Highlight detected synergies
- **Continue**: Validate selection and proceed to Economics

---

### Step 4: Economics Configuration

**Purpose**: Configure economic systems (sectors, labor, demographics)
**Location**: `/app/builder/components/enhanced/steps/EconomicsStep.tsx`
**Required**: Yes

**Tabs:**
1. **Economy**: Sector composition, trade, fiscal policy
2. **Sectors**: Industry breakdown (primary, secondary, tertiary)
3. **Labor**: Employment, wages, workforce
4. **Demographics**: Age distribution, urban/rural

**Economy Tab:**

```typescript
interface EconomySectorComposition {
  agriculture: number;           // % of GDP
  manufacturing: number;         // % of GDP
  services: number;              // % of GDP
  technology: number;            // % of GDP
  finance: number;               // % of GDP
  // Must sum to 100%
}

interface TradeData {
  exportsGDP: number;            // % of GDP
  importsGDP: number;            // % of GDP
  tradeBalance: number;          // Calculated
  majorExports: string[];        // Top 5 exports
  majorImports: string[];        // Top 5 imports
  tradingPartners: string[];     // Top 5 partners
}
```

**Labor Tab:**

```typescript
interface LaborMarket {
  unemploymentRate: number;      // %
  laborForceParticipation: number; // %
  averageWage: number;           // Annual
  minimumWage: number;           // Hourly
  workingHours: number;          // Weekly average
  unionization: number;          // % unionized
  employmentBySector: {
    agriculture: number;         // %
    manufacturing: number;       // %
    services: number;            // %
  };
}
```

**Demographics Tab:**

```typescript
interface Demographics {
  ageDistribution: {
    '0-14': number;              // %
    '15-64': number;             // %
    '65+': number;               // %
  };
  medianAge: number;             // Years
  urbanPopulation: number;       // %
  ruralPopulation: number;       // %
  populationDensity: number;     // per km²
  literacyRate: number;          // %
}
```

**Auto-Suggestions:**

```typescript
// Economic component suggestions based on government
const suggestions = unifiedBuilderService.getSuggestedEconomicComponents();

// Example: Parliament selected → suggests regulated economy
if (hasComponent('parliament')) {
  suggestions.push({
    setting: 'economicSystem',
    value: 'mixed',
    reason: 'Parliamentary systems typically favor mixed economies'
  });
}
```

**Validation Rules:**
- ✅ Sector percentages sum to 100%
- ✅ Age distribution sums to 100%
- ✅ Urban + rural = 100%
- ✅ Unemployment rate realistic (0-25%)
- ✅ Labor force participation (40-90%)

**User Actions:**
- **Adjust Sliders**: Fine-tune percentages
- **Apply Template**: Use archetype preset
- **View Impact**: See effect on vitality scores
- **Continue**: Validate and proceed to Government

---

### Step 5: Government Structure

**Purpose**: Design traditional government structure (optional)
**Location**: `/app/builder/components/enhanced/steps/GovernmentStep.tsx`
**Required**: No (can skip if using atomic only)

**Builder Options:**
1. **Atomic Only**: Use only component-based government
2. **Traditional Builder**: Use classic government structure
3. **Hybrid**: Combine atomic components with traditional structure

**Traditional Structure:**

```typescript
interface GovernmentStructure {
  type: 'presidential' | 'parliamentary' | 'semi-presidential' | 'monarchy' | 'custom';
  executiveBranch: {
    headOfState: string;         // Title (President, PM, etc.)
    termLength: number;          // Years
    termLimits: number;          // Max terms
    electionType: 'direct' | 'indirect' | 'appointed';
    cabinet: Array<{
      title: string;
      portfolio: string;
      powerLevel: number;
    }>;
  };
  legislativeBranch: {
    type: 'unicameral' | 'bicameral';
    lowerHouse: {
      name: string;
      seats: number;
      termLength: number;
    };
    upperHouse?: {
      name: string;
      seats: number;
      termLength: number;
    };
  };
  judicialBranch: {
    supremeCourt: {
      justices: number;
      termType: 'life' | 'fixed';
      appointment: 'executive' | 'legislative' | 'election';
    };
    lowerCourts: Array<{
      name: string;
      jurisdiction: string;
    }>;
  };
}
```

**Integration with Atomic:**

```typescript
// Bidirectional sync between atomic and traditional
const syncService = new BidirectionalGovernmentSyncService();

// Traditional → Atomic
const components = syncService.convertTraditionalToAtomic(governmentStructure);

// Atomic → Traditional
const structure = syncService.convertAtomicToTraditional(selectedComponents);
```

**Validation Rules:**
- ✅ At least one branch defined
- ✅ Seats > 0 for legislative bodies
- ✅ Term lengths realistic (1-10 years)
- ✅ Cabinet positions have unique portfolios

**User Actions:**
- **Choose Type**: Select government template
- **Customize Structure**: Modify branches and positions
- **Sync with Atomic**: Convert between representations
- **Continue**: Validate and proceed to Tax

---

### Step 6: Tax System

**Purpose**: Configure tax policy and revenue sources
**Location**: `/app/builder/components/enhanced/steps/TaxSystemStep.tsx`
**Required**: Yes

**Tax Categories:**

```typescript
interface TaxSystem {
  incomeTax: {
    enabled: boolean;
    brackets: Array<{
      threshold: number;         // Annual income
      rate: number;              // %
    }>;
    standardDeduction: number;
    capitalGainRate: number;     // %
  };
  corporateTax: {
    enabled: boolean;
    standardRate: number;        // %
    smallBusinessRate: number;   // %
    threshold: number;           // Revenue threshold
  };
  consumptionTax: {
    enabled: boolean;
    vatRate: number;             // %
    luxuryRate: number;          // %
    essentialsRate: number;      // %
    exemptions: string[];
  };
  propertyTax: {
    enabled: boolean;
    residentialRate: number;     // %
    commercialRate: number;      // %
    landRate: number;            // %
  };
  customTaxes: Array<{
    name: string;
    description: string;
    rate: number;
    base: 'income' | 'consumption' | 'wealth' | 'transaction';
  }>;
}
```

**Revenue Calculation:**

```typescript
interface TaxRevenue {
  totalRevenue: number;          // Annual
  revenueBySource: {
    income: number;
    corporate: number;
    consumption: number;
    property: number;
    other: number;
  };
  percentOfGDP: number;          // Total revenue as % of GDP
  perCapita: number;             // Revenue per citizen
}

// Calculate total revenue
function calculateTotalRevenue(
  taxSystem: TaxSystem,
  economicData: EconomicInputs
): TaxRevenue {
  const income = calculateIncomeTaxRevenue(taxSystem.incomeTax, economicData);
  const corporate = calculateCorporateTaxRevenue(taxSystem.corporateTax, economicData);
  const consumption = calculateConsumptionTaxRevenue(taxSystem.consumptionTax, economicData);
  const property = calculatePropertyTaxRevenue(taxSystem.propertyTax, economicData);

  const total = income + corporate + consumption + property;

  return {
    totalRevenue: total,
    revenueBySource: { income, corporate, consumption, property, other: 0 },
    percentOfGDP: (total / economicData.totalGdp) * 100,
    perCapita: total / economicData.population
  };
}
```

**Integration with Economy:**

```typescript
// Tax-Economy sync service
const taxEconomySync = new RevenueTaxIntegrationService();

// Check if tax rates align with economic system
const validation = taxEconomySync.validateTaxEconomyAlignment({
  taxSystem,
  economicInputs,
  governmentComponents
});

// Suggest adjustments
if (validation.warnings.length > 0) {
  console.log('Tax recommendations:', validation.recommendations);
}
```

**Validation Rules:**
- ✅ At least one tax category enabled
- ✅ Tax rates realistic (0-70%)
- ✅ Income brackets in ascending order
- ✅ Total revenue covers minimum government spending
- ✅ Progressive tax brackets (each rate ≥ previous)

**User Actions:**
- **Toggle Category**: Enable/disable tax type
- **Add Bracket**: Add income tax bracket
- **Adjust Rates**: Modify tax percentages
- **View Revenue**: See projected tax revenue
- **Apply Template**: Use preset tax system
- **Continue**: Validate and proceed to Preview

---

### Step 7: Preview & Create

**Purpose**: Review all configurations before creating country
**Location**: `/app/builder/components/enhanced/steps/PreviewStep.tsx`
**Required**: Yes (final step)

**Preview Sections:**

```typescript
interface PreviewData {
  nationalIdentity: {
    name: string;
    capital: string;
    flag: string;
    // ... other identity fields
  };
  coreIndicators: {
    gdp: string;
    population: string;
    growthRate: string;
    tier: string;
  };
  governmentSummary: {
    componentCount: number;
    totalPowerLevel: number;
    effectivenessScore: number;
    synergiesDetected: number;
  };
  economicSummary: {
    sectorBreakdown: Record<string, number>;
    laborForce: number;
    unemployment: number;
    tradeBalance: number;
  };
  taxSummary: {
    totalRevenue: number;
    revenueGDPRatio: number;
    enabledCategories: string[];
    topRate: number;
  };
  validationStatus: {
    allValid: boolean;
    errors: string[];
    warnings: string[];
  };
}
```

**Validation Summary:**

```typescript
// Final validation before creation
const validation = unifiedValidationService.validateComplete({
  nationalIdentity,
  coreIndicators,
  governmentComponents,
  governmentStructure,
  economicInputs,
  taxSystem
});

if (!validation.isValid) {
  // Block creation, show errors
  return {
    errors: validation.errors,
    warnings: validation.warnings,
    canCreate: false
  };
}
```

**Country Creation:**

```typescript
// Create country in database
const { mutate: createCountry } = api.countries.create.useMutation({
  onSuccess: (country) => {
    // Redirect to MyCountry dashboard
    router.push(`/mycountry`);

    // Clear builder state
    clearDraft();

    // Show success notification
    toast.success(`${country.name} has been created!`);
  },
  onError: (error) => {
    toast.error(`Failed to create country: ${error.message}`);
  }
});

createCountry({
  // National identity
  name: nationalIdentity.countryName,
  capital: nationalIdentity.capitalCity,
  currency: nationalIdentity.currency,
  flag: nationalIdentity.flagUrl,

  // Core indicators
  currentGdpPerCapita: coreIndicators.gdpPerCapita,
  currentPopulation: coreIndicators.totalPopulation,
  realGDPGrowthRate: coreIndicators.realGDPGrowthRate,
  populationGrowthRate: coreIndicators.populationGrowthRate,
  economicTier: coreIndicators.economicTier,
  populationTier: coreIndicators.populationTier,

  // Government (JSON serialized)
  governmentComponents: JSON.stringify(governmentComponents),
  governmentStructure: JSON.stringify(governmentStructure),

  // Economy (JSON serialized)
  economicData: JSON.stringify(economicInputs),

  // Tax system (JSON serialized)
  taxSystem: JSON.stringify(taxSystem),

  // Metadata
  createdBy: user.clerkUserId,
  createdAt: new Date(),
  lastCalculated: new Date()
});
```

**User Actions:**
- **Edit Section**: Return to specific step
- **Export Data**: Download configuration JSON
- **Create Country**: Finalize and create
- **Save Draft**: Save for later (auto-saved already)

---

## Integration Services

### 1. UnifiedBuilderIntegrationService

**Purpose**: Central coordination of all builder subsystems

```typescript
class UnifiedBuilderIntegrationService {
  private nationalIdentity: NationalIdentity | null = null;
  private governmentComponents: ComponentType[] = [];
  private governmentBuilder: any = null;
  private taxBuilder: TaxBuilderState | null = null;
  private economicData: EconomicInputs | null = null;

  // Update methods
  updateNationalIdentity(identity: NationalIdentity): void;
  updateGovernmentComponents(components: ComponentType[]): void;
  updateGovernmentBuilder(structure: any): void;
  updateTaxBuilder(taxData: TaxBuilderState): void;
  updateEconomicData(data: EconomicInputs): void;

  // Validation
  validateAll(): ValidationResult;
  getValidationErrors(): string[];
  getValidationWarnings(): string[];

  // Synergy
  getSuggestedEconomicComponents(): EconomicSuggestion[];
  detectGovernmentEconomySynergies(): Synergy[];

  // Export
  exportCompleteState(): CompleteBuilderState;
  importCompleteState(state: CompleteBuilderState): void;
}
```

### 2. BidirectionalGovernmentSyncService

**Purpose**: Sync atomic components ↔ traditional structure

```typescript
class BidirectionalGovernmentSyncService {
  // Atomic → Traditional
  convertAtomicToTraditional(
    components: ComponentType[]
  ): GovernmentStructure;

  // Traditional → Atomic
  convertTraditionalToAtomic(
    structure: GovernmentStructure
  ): ComponentType[];

  // Sync changes
  syncAtomicChanges(
    components: ComponentType[],
    existingStructure: GovernmentStructure
  ): GovernmentStructure;

  syncTraditionalChanges(
    structure: GovernmentStructure,
    existingComponents: ComponentType[]
  ): ComponentType[];
}
```

### 3. BidirectionalTaxSyncService

**Purpose**: Sync tax system ↔ economic data

```typescript
class BidirectionalTaxSyncService {
  // Calculate revenue based on economy
  calculateExpectedRevenue(
    taxSystem: TaxSystem,
    economicData: EconomicInputs
  ): TaxRevenue;

  // Suggest tax rates based on spending needs
  suggestTaxRates(
    requiredRevenue: number,
    economicData: EconomicInputs
  ): TaxSystem;

  // Validate alignment
  validateTaxEconomyAlignment(data: {
    taxSystem: TaxSystem;
    economicInputs: EconomicInputs;
    governmentComponents: ComponentType[];
  }): ValidationResult;
}
```

### 4. CrossBuilderSynergyService

**Purpose**: Detect synergies across subsystems

```typescript
class CrossBuilderSynergyService {
  // Detect component synergies
  detectSynergies(components: ComponentType[]): Synergy[];

  // Calculate total effectiveness
  calculateTotalEffectiveness(components: ComponentType[]): number;

  // Suggest complementary components
  suggestComponents(
    existing: ComponentType[],
    economicData?: EconomicInputs
  ): ComponentSuggestion[];

  // Calculate economic impact
  calculateEconomicImpact(
    components: ComponentType[],
    baseGDP: number
  ): EconomicImpact;
}
```

### 5. UnifiedValidationService

**Purpose**: Comprehensive validation across all systems

```typescript
class UnifiedValidationService {
  // Validate complete builder state
  validateComplete(state: CompleteBuilderState): ValidationResult;

  // Individual validations
  validateNationalIdentity(identity: NationalIdentity): ValidationResult;
  validateCoreIndicators(indicators: CoreIndicators): ValidationResult;
  validateGovernmentComponents(components: ComponentType[]): ValidationResult;
  validateEconomicInputs(inputs: EconomicInputs): ValidationResult;
  validateTaxSystem(taxSystem: TaxSystem): ValidationResult;

  // Cross-system validations
  validateGovernmentEconomyAlignment(data: {
    components: ComponentType[];
    economicInputs: EconomicInputs;
  }): ValidationResult;

  validateTaxRevenueAdequacy(data: {
    taxSystem: TaxSystem;
    economicInputs: EconomicInputs;
    governmentComponents: ComponentType[];
  }): ValidationResult;
}
```

### 6. UnifiedEffectivenessCalculator

**Purpose**: Calculate overall country effectiveness

```typescript
class UnifiedEffectivenessCalculator {
  // Calculate final effectiveness score
  calculateFinalEffectiveness(state: CompleteBuilderState): number;

  // Component contributions
  calculateComponentEffectiveness(components: ComponentType[]): number;

  // Economic contributions
  calculateEconomicEffectiveness(economicInputs: EconomicInputs): number;

  // Tax system contributions
  calculateFiscalEffectiveness(taxSystem: TaxSystem, economicInputs: EconomicInputs): number;

  // Synergy bonuses
  calculateSynergyBonuses(components: ComponentType[]): number;
}
```

---

## Auto-Save Mechanism

### Implementation

```typescript
// src/app/builder/hooks/useBuilderState.ts

export function useBuilderState() {
  const [builderState, setBuilderState] = useState<BuilderState>(initialState);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Auto-save with 500ms debounce
  useEffect(() => {
    const saveState = async () => {
      setIsAutoSaving(true);
      try {
        safeSetItemSync('builder_state', JSON.stringify(builderState));
        const now = new Date();
        safeSetItemSync('builder_last_saved', now.toISOString());
        setLastSaved(now);
      } catch (error) {
        console.error('Failed to save builder state:', error);
      } finally {
        setIsAutoSaving(false);
      }
    };

    // Debounce: save 500ms after last change
    const timeoutId = setTimeout(saveState, 500);
    return () => clearTimeout(timeoutId);
  }, [builderState]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        safeSetItemSync('builder_state', JSON.stringify(builderState));
        safeSetItemSync('builder_last_saved', new Date().toISOString());
      } catch (error) {
        console.error('Failed to save on unload:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [builderState]);

  return { builderState, lastSaved, isAutoSaving, /* ... */ };
}
```

### Storage Schema

```typescript
// localStorage keys
const STORAGE_KEYS = {
  BUILDER_STATE: 'builder_state',
  LAST_SAVED: 'builder_last_saved',
  QUICK_START: 'builder_quick_start_section'
};

// Saved state structure
interface SavedBuilderState {
  step: BuilderStep;
  selectedCountry: RealCountryData | null;
  economicInputs: EconomicInputs | null;
  governmentComponents: ComponentType[];
  taxSystemData: TaxBuilderState | null;
  governmentStructure: any;
  completedSteps: BuilderStep[];
  activeCoreTab: string;
  activeGovernmentTab: string;
  activeEconomicsTab: string;
  showAdvancedMode: boolean;
}
```

### Recovery

```typescript
// Load saved state on mount
useEffect(() => {
  try {
    const savedState = safeGetItemSync('builder_state');
    const savedLastSaved = safeGetItemSync('builder_last_saved');

    if (savedState) {
      const parsedState = JSON.parse(savedState);
      setBuilderState(parsedState);

      // Show recovery notification
      if (savedLastSaved) {
        const lastSavedDate = new Date(savedLastSaved);
        toast.info(`Draft recovered from ${lastSavedDate.toLocaleString()}`);
      }
    }
  } catch (error) {
    console.error('Failed to load saved state:', error);
    // Continue with default state
  }
}, []);
```

---

## Validation System

### Validation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   Validation Pipeline                        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Field-Level │ Step-Level   │ Cross-System │   Final        │
│  Validation  │  Validation  │  Validation  │  Validation    │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

### Field-Level Validation

```typescript
// Validate individual fields as user types
function validateField(field: string, value: any): ValidationError | null {
  switch (field) {
    case 'countryName':
      if (!value || value.length < 2) {
        return { field, message: 'Country name must be at least 2 characters' };
      }
      if (!/^[a-zA-Z\s-]+$/.test(value)) {
        return { field, message: 'Country name can only contain letters, spaces, and hyphens' };
      }
      break;

    case 'gdpPerCapita':
      if (value < 500) {
        return { field, message: 'GDP per capita must be at least $500' };
      }
      if (value > 200000) {
        return { field, message: 'GDP per capita cannot exceed $200,000' };
      }
      break;

    case 'population':
      if (value < 1000) {
        return { field, message: 'Population must be at least 1,000' };
      }
      if (value > 10000000000) {
        return { field, message: 'Population cannot exceed 10 billion' };
      }
      break;

    // ... other fields
  }

  return null;
}
```

### Step-Level Validation

```typescript
// Validate entire step before progression
function validateStep(step: BuilderStep, data: any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  switch (step) {
    case 'core':
      // Validate national identity
      if (!data.nationalIdentity?.countryName) {
        errors.push({ field: 'countryName', message: 'Country name is required' });
      }
      if (!data.nationalIdentity?.capitalCity) {
        errors.push({ field: 'capitalCity', message: 'Capital city is required' });
      }

      // Validate core indicators
      if (!data.coreIndicators?.gdpPerCapita) {
        errors.push({ field: 'gdpPerCapita', message: 'GDP per capita is required' });
      }
      if (!data.coreIndicators?.totalPopulation) {
        errors.push({ field: 'population', message: 'Population is required' });
      }

      // Warnings
      if (data.coreIndicators?.gdpPerCapita < 5000) {
        warnings.push({
          field: 'gdpPerCapita',
          message: 'Very low GDP per capita may limit economic options'
        });
      }
      break;

    case 'government':
      // Validate component selection
      if (data.components.length < 3) {
        errors.push({ field: 'components', message: 'At least 3 components required' });
      }

      // Check prerequisites
      const missingPrereqs = checkComponentPrerequisites(data.components);
      if (missingPrereqs.length > 0) {
        errors.push({
          field: 'components',
          message: `Missing prerequisites: ${missingPrereqs.join(', ')}`
        });
      }

      // Check conflicts
      const conflicts = checkComponentConflicts(data.components);
      if (conflicts.length > 0) {
        errors.push({
          field: 'components',
          message: `Conflicting components: ${conflicts.join(', ')}`
        });
      }
      break;

    // ... other steps
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    canProceed: errors.length === 0
  };
}
```

### Cross-System Validation

```typescript
// Validate interactions between subsystems
function validateCrossSystem(state: BuilderState): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Government-Economy alignment
  const govEconValidation = validateGovernmentEconomyAlignment({
    components: state.governmentComponents,
    economicInputs: state.economicInputs
  });
  errors.push(...govEconValidation.errors);
  warnings.push(...govEconValidation.warnings);

  // 2. Tax-Revenue adequacy
  const taxValidation = validateTaxRevenueAdequacy({
    taxSystem: state.taxSystemData,
    economicInputs: state.economicInputs,
    governmentComponents: state.governmentComponents
  });
  errors.push(...taxValidation.errors);
  warnings.push(...taxValidation.warnings);

  // 3. Component effectiveness
  const effectiveness = calculateTotalEffectiveness(state.governmentComponents);
  if (effectiveness < 30) {
    warnings.push({
      field: 'effectiveness',
      message: 'Low overall effectiveness - consider adding more components'
    });
  }

  // 4. Synergy opportunities
  const missedSynergies = detectMissedSynergies(state.governmentComponents);
  if (missedSynergies.length > 0) {
    warnings.push({
      field: 'synergies',
      message: `Missed synergy opportunities: ${missedSynergies.join(', ')}`
    });
  }

  return { isValid: errors.length === 0, errors, warnings };
}
```

### Validation Points

| Step | Validation Timing | Blocking |
|------|-------------------|----------|
| Foundation | On select | No |
| Core | On field blur | Yes (for continue button) |
| Components | On add/remove | Yes (for continue button) |
| Economics | On field blur | Yes (for continue button) |
| Government | On structure change | No (warnings only) |
| Tax | On rate change | Yes (for continue button) |
| Preview | On page load | Yes (for create button) |

---

## Cross-System Synergy

### Government → Economy Mapping

```typescript
// Component economic effects
const COMPONENT_ECONOMIC_EFFECTS: Record<string, EconomicEffect> = {
  'parliament': {
    gdpEffect: +2,
    sectors: ['services', 'finance'],
    suggestedSystem: 'mixed',
    reason: 'Parliamentary systems favor regulated markets'
  },
  'central_bank': {
    gdpEffect: +5,
    sectors: ['finance', 'services'],
    suggestedSystem: 'mixed',
    reason: 'Central banks support stable monetary policy'
  },
  'ministry_of_trade': {
    gdpEffect: +3,
    sectors: ['manufacturing', 'services'],
    suggestedSystem: 'market',
    reason: 'Trade ministries promote export-oriented growth'
  },
  'state_planning_committee': {
    gdpEffect: +1,
    sectors: ['manufacturing', 'agriculture'],
    suggestedSystem: 'planned',
    reason: 'Planning committees coordinate centralized economies'
  },
  // ... 20+ more components
};
```

### Synergy Detection

```typescript
// Detect synergies between components
function detectSynergies(components: ComponentType[]): Synergy[] {
  const synergies: Synergy[] = [];

  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const comp1 = components[i];
      const comp2 = components[j];

      // Check if synergy exists in definition
      const synergyDef = comp1.synergies?.find(s => s.componentId === comp2.id);

      if (synergyDef) {
        synergies.push({
          componentIds: [comp1.id, comp2.id],
          synergyType: synergyDef.type,
          bonus: synergyDef.bonus,
          effect: synergyDef.effect,
          economicBonus: synergyDef.economicBonus
        });
      }
    }
  }

  return synergies;
}
```

### Example Synergies

```typescript
// Parliament + Judiciary
{
  componentIds: ['parliament', 'supreme_court'],
  synergyType: 'checks_balances',
  bonus: 15,
  effect: 'Enhanced rule of law and accountability',
  economicBonus: { gdp: +2, stability: +10 }
}

// Central Bank + Ministry of Finance
{
  componentIds: ['central_bank', 'ministry_finance'],
  synergyType: 'fiscal_monetary_coordination',
  bonus: 20,
  effect: 'Coordinated fiscal and monetary policy',
  economicBonus: { gdp: +3, inflation: -2 }
}

// President + Parliament
{
  componentIds: ['president', 'parliament'],
  synergyType: 'executive_legislative_balance',
  bonus: 12,
  effect: 'Balanced governance with checks and balances',
  economicBonus: { stability: +8 }
}
```

---

## Component Mapping

### Government Components → Economic Settings

| Government Component | Suggested Economic System | Sector Emphasis | GDP Effect |
|----------------------|---------------------------|-----------------|------------|
| Parliament | Mixed economy | Services, Finance | +2% |
| Absolute Monarchy | Market or Planned | Resources, Luxury | +1% |
| Presidential System | Market economy | Finance, Technology | +3% |
| Council System | Planned economy | Manufacturing, Agriculture | +1% |
| Central Bank | Mixed economy | Finance, Services | +5% |
| State Planning Committee | Planned economy | Manufacturing, Infrastructure | +1% |
| Ministry of Trade | Market economy | Manufacturing, Services | +3% |
| Ministry of Finance | Mixed economy | Finance, Services | +2% |
| Ministry of Industry | Planned/Mixed | Manufacturing, Technology | +2% |
| Securities Regulator | Market economy | Finance, Services | +2% |

### Atomic Components → Traditional Structure

```typescript
// Conversion table
const ATOMIC_TO_TRADITIONAL: Record<string, TraditionalEquivalent> = {
  'president': {
    branch: 'executive',
    position: 'headOfState',
    title: 'President',
    termLength: 4,
    termLimits: 2
  },
  'prime_minister': {
    branch: 'executive',
    position: 'headOfGovernment',
    title: 'Prime Minister',
    termLength: 5,
    termLimits: 0
  },
  'parliament': {
    branch: 'legislative',
    type: 'unicameral',
    house: 'lowerHouse',
    name: 'Parliament',
    seats: 300
  },
  'senate': {
    branch: 'legislative',
    type: 'bicameral',
    house: 'upperHouse',
    name: 'Senate',
    seats: 100
  },
  'supreme_court': {
    branch: 'judicial',
    court: 'supreme',
    justices: 9,
    termType: 'life'
  },
  // ... all 24 components
};
```

---

## Country Creation

### Transaction Flow

```typescript
// Complete country creation transaction
async function createCountry(state: CompleteBuilderState): Promise<Country> {
  return await db.$transaction(async (tx) => {
    // 1. Create country record
    const country = await tx.country.create({
      data: {
        // National identity
        name: state.nationalIdentity.countryName,
        slug: slugify(state.nationalIdentity.countryName),
        capital: state.nationalIdentity.capitalCity,
        currency: state.nationalIdentity.currency,
        flag: state.nationalIdentity.flagUrl,
        coatOfArms: state.nationalIdentity.coatOfArmsUrl,

        // Core indicators
        currentGdpPerCapita: state.coreIndicators.gdpPerCapita,
        currentPopulation: state.coreIndicators.totalPopulation,
        currentTotalGdp: state.coreIndicators.gdpPerCapita * state.coreIndicators.totalPopulation,
        realGDPGrowthRate: state.coreIndicators.realGDPGrowthRate / 100,
        populationGrowthRate: state.coreIndicators.populationGrowthRate / 100,
        economicTier: state.coreIndicators.economicTier,
        populationTier: state.coreIndicators.populationTier,

        // Initial vitality scores (calculated)
        economicVitality: calculateInitialVitality('economic', state),
        populationWellbeing: calculateInitialVitality('population', state),
        diplomaticStanding: calculateInitialVitality('diplomatic', state),
        governmentalEfficiency: calculateInitialVitality('governmental', state),

        // Metadata
        createdBy: state.userId,
        createdAt: new Date(),
        lastCalculated: new Date(),
        baselineDate: new Date()
      }
    });

    // 2. Store government components (JSON)
    await tx.countryData.create({
      data: {
        countryId: country.id,
        dataType: 'governmentComponents',
        data: JSON.stringify(state.governmentComponents)
      }
    });

    // 3. Store traditional structure (if present)
    if (state.governmentStructure) {
      await tx.countryData.create({
        data: {
          countryId: country.id,
          dataType: 'governmentStructure',
          data: JSON.stringify(state.governmentStructure)
        }
      });
    }

    // 4. Store economic data
    await tx.countryData.create({
      data: {
        countryId: country.id,
        dataType: 'economicInputs',
        data: JSON.stringify(state.economicInputs)
      }
    });

    // 5. Store tax system
    await tx.countryData.create({
      data: {
        countryId: country.id,
        dataType: 'taxSystem',
        data: JSON.stringify(state.taxSystemData)
      }
    });

    // 6. Create initial historical snapshot
    await tx.historicalData.create({
      data: {
        countryId: country.id,
        gdpPerCapita: country.currentGdpPerCapita,
        population: country.currentPopulation,
        totalGdp: country.currentTotalGdp,
        economicVitality: country.economicVitality,
        populationWellbeing: country.populationWellbeing,
        diplomaticStanding: country.diplomaticStanding,
        governmentalEfficiency: country.governmentalEfficiency,
        timestamp: new Date()
      }
    });

    // 7. Assign to user
    await tx.user.update({
      where: { clerkUserId: state.userId },
      data: { countryId: country.id }
    });

    return country;
  });
}
```

### Initial Vitality Calculation

```typescript
function calculateInitialVitality(
  area: 'economic' | 'population' | 'diplomatic' | 'governmental',
  state: CompleteBuilderState
): number {
  switch (area) {
    case 'economic':
      const gdpScore = normalizeGDP(state.coreIndicators.gdpPerCapita);
      const growthScore = normalizeGrowth(state.coreIndicators.realGDPGrowthRate);
      const tierScore = tierToScore(state.coreIndicators.economicTier);
      const componentBonus = calculateComponentBonus(state.governmentComponents, 'economic');

      return Math.min(100, gdpScore * 0.4 + growthScore * 0.3 + tierScore * 0.2 + componentBonus * 0.1);

    case 'population':
      const popScore = normalizePopulation(state.coreIndicators.totalPopulation);
      const popGrowthScore = normalizeGrowth(state.coreIndicators.populationGrowthRate);
      const popTierScore = tierToScore(state.coreIndicators.populationTier);

      return Math.min(100, popScore * 0.3 + popGrowthScore * 0.4 + popTierScore * 0.3);

    case 'diplomatic':
      // Initial score based on government type
      const baseScore = 50;
      const govTypeBonus = calculateDiplomaticBonus(state.governmentComponents);

      return Math.min(100, baseScore + govTypeBonus);

    case 'governmental':
      const effectiveness = calculateTotalEffectiveness(state.governmentComponents);
      const synergyBonus = detectSynergies(state.governmentComponents).length * 5;

      return Math.min(100, effectiveness + synergyBonus);
  }
}
```

---

## Development Guide

### Setting Up Builder

1. **Install dependencies**

```bash
npm install
```

2. **Start development server**

```bash
npm run dev
```

3. **Access builder**

```
http://localhost:3000/builder
```

### Testing Workflow

```typescript
// Mock builder state for testing
const mockState: BuilderState = {
  step: 'core',
  selectedCountry: null,
  economicInputs: createDefaultEconomicInputs(),
  governmentComponents: [
    { id: 'president', name: 'President', category: 'executive', /* ... */ },
    { id: 'parliament', name: 'Parliament', category: 'legislative', /* ... */ },
    { id: 'supreme_court', name: 'Supreme Court', category: 'judicial', /* ... */ }
  ],
  taxSystemData: {
    incomeTax: { enabled: true, brackets: [{ threshold: 0, rate: 15 }] },
    // ... other tax data
  },
  governmentStructure: null,
  completedSteps: ['foundation', 'core'],
  // ... other fields
};

// Test validation
const validation = unifiedValidationService.validateComplete(mockState);
expect(validation.isValid).toBe(true);

// Test synergy detection
const synergies = crossBuilderSynergyService.detectSynergies(
  mockState.governmentComponents
);
expect(synergies.length).toBeGreaterThan(0);
```

### Quick-Start Testing

```typescript
// Enable quick-start mode
localStorage.setItem('builder_quick_start_section', 'core');

// Refresh page - should start at Core step with defaults
```

### Common Issues

**Issue**: Auto-save not working
**Solution**: Check localStorage is enabled and not full

**Issue**: Components not showing synergies
**Solution**: Ensure component definitions include `synergies` array

**Issue**: Validation blocking progression
**Solution**: Check browser console for validation errors, fix before continuing

**Issue**: Tax revenue calculation incorrect
**Solution**: Verify economic inputs are complete and realistic

---

## Conclusion

The Builder System provides a comprehensive country creation workflow with 7 steps, 12+ integration services, auto-save persistence, and cross-system validation. The atomic component approach enables emergent behaviors through synergy detection, while traditional government builder provides familiar structure.

For additional support, consult:
- **Builder Hooks**: `/src/app/builder/hooks/`
- **Integration Services**: `/src/app/builder/services/`
- **Component Library**: `/src/components/government/atoms/`
- **Validation Logic**: `/src/app/builder/utils/governmentValidation.ts`

**Version**: 1.1.0
**Last Updated**: October 2025
**Status**: Production-Ready (90% Feature Complete)
