# IxStats Core Library Documentation

**Version:** 1.1.0
**Last Updated:** October 2025
**Status:** Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Library Organization](#library-organization)
3. [Core Categories](#core-categories)
4. [Key Modules](#key-modules)
5. [Usage Patterns](#usage-patterns)
6. [Dependency Relationships](#dependency-relationships)
7. [Testing Approaches](#testing-approaches)
8. [Performance Considerations](#performance-considerations)
9. [Adding New Utilities](#adding-new-utilities)
10. [Module Reference](#module-reference)

---

## Overview

The `src/lib/` directory contains the foundational utility libraries, services, and helper functions that power the IxStats platform. These modules provide:

- **Pure calculation functions** for economic, government, and tax systems
- **Time management utilities** via the IxTime system
- **Data transformation services** for economic modeling
- **State management systems** for atomic components
- **Integration services** connecting multiple platform systems
- **Helper utilities** for formatting, validation, and common operations

### Architecture Principles

1. **Pure Functions**: Most library modules export pure, side-effect-free functions
2. **Client-Server Split**: Clear separation between client-safe and server-only modules
3. **Type Safety**: 100% TypeScript coverage with strict typing
4. **Single Responsibility**: Each module has a focused, well-defined purpose
5. **Composability**: Modules can be combined to build complex functionality

### Module Count

- **120+ utility modules** organized into logical categories
- **~15,000 lines** of production TypeScript code
- **Zero technical debt** after v1.0.0 audit completion

---

## Library Organization

### Directory Structure

```
src/lib/
├── Core Time & Calculations
│   ├── ixtime.ts                        # Time system (2x/4x speed)
│   ├── ixtime-sync.ts                   # Bot synchronization
│   ├── ixtime-accuracy.ts               # Time precision utilities
│   ├── ixtime-economic-utils.ts         # Time-based economic helpers
│   ├── calculations.ts                  # Core GDP/population progression
│   ├── enhanced-calculations.ts         # Advanced economic indicators
│   └── enhanced-economic-calculations.ts # ERI, PII, SEWI, ECTI indices
│
├── Atomic Systems
│   ├── atomic-builder-state.ts          # Atomic state management
│   ├── atomic-client-calculations.ts    # Client-safe component calculations
│   ├── atomic-economic-integration.ts   # Economic impact modeling
│   ├── atomic-economic-integration.server.ts # Server-side integration
│   ├── atomic-intelligence-integration.ts # Intelligence feed generation
│   ├── atomic-recommendations.ts        # AI-powered recommendations
│   ├── atomic-tax-integration.ts        # Tax system integration
│   └── unified-atomic-state.ts          # Cross-system state management
│
├── Economic Systems
│   ├── economic-data-templates.ts       # Default data generation
│   ├── economic-calculation-groups.ts   # Grouped calculation sets
│   ├── enhanced-economic-service.ts     # Full-featured economic service
│   ├── intuitive-economic-analysis.ts   # User-friendly analysis tools
│   ├── historical-trends.ts             # Time-series analysis
│   ├── predictive-analytics-engine.ts   # Forecasting models
│   └── change-impact-calculator.ts      # Policy impact modeling
│
├── Government & Tax Systems
│   ├── government-spending-bridge.ts    # Spending system integration
│   ├── government-spending-defaults.ts  # Default spending allocations
│   ├── tax-calculator.ts                # Progressive tax computation
│   ├── tax-data-parser.ts               # Tax system parsing
│   └── defense-integration.ts           # Military spending integration
│
├── Intelligence & Analytics
│   ├── intelligence-engine.ts           # Core intelligence generation
│   ├── intelligence-calculator.ts       # Database-backed calculations
│   ├── intelligence-cache.ts            # Performance caching
│   ├── intelligence-broadcast-service.ts # Real-time updates
│   ├── vitality-calculator.ts           # 5-metric vitality system
│   └── stability-formulas.ts            # Crime, cohesion, protests
│
├── Data Services
│   ├── data-service.ts                  # General data operations
│   ├── data-parser.ts                   # Data parsing utilities
│   ├── preview-seeder.ts                # Preview data generation
│   ├── preview-config.ts                # Preview configuration
│   └── activity-generator.ts            # Activity feed generation
│
├── External Integrations
│   ├── mediawiki-service.ts             # IxWiki API client
│   ├── mediawiki-config.ts              # MediaWiki configuration
│   ├── wiki-search-service.ts           # Wiki search functionality
│   ├── wiki-search-service.client.ts    # Client-side search
│   ├── wiki-search-service.shared.ts    # Shared search utilities
│   ├── wiki-infobox-mapper.ts           # Infobox data extraction
│   ├── wikitext-parser.ts               # Wikitext parsing
│   ├── discord-webhook.ts               # Discord notifications
│   └── country-flag-service.ts          # Flag image management
│
├── Media & Assets
│   ├── flag-service.ts                  # Flag storage system
│   ├── flag-color-analysis.ts           # Color extraction
│   ├── flag-color-extractor.ts          # Advanced color analysis
│   ├── flag-debug.ts                    # Flag debugging tools
│   ├── flag-prefetch-initializer.ts     # Preload optimization
│   ├── unified-flag-service.ts          # Unified flag API
│   ├── unified-media-service.ts         # Media management
│   ├── wiki-commons-flag-service.ts     # Wikimedia Commons integration
│   ├── image-color-extractor.ts         # Image color analysis
│   ├── image-download-service.ts        # External image fetching
│   ├── unsplash-service.ts              # Unsplash API integration
│   └── excel-handler.ts                 # Excel import/export
│
├── Notification & Communication
│   ├── notification-api.ts              # Notification system API
│   ├── notification-hooks.ts            # React notification hooks
│   ├── activity-hooks.ts                # Activity feed hooks
│   └── action-queue-system.ts           # Async action queue
│
├── State Management
│   ├── unified-atomic-state.ts          # Atomic component state
│   ├── unified-atomic-tax-integration.ts # Tax-atomic integration
│   └── localStorageMutex.ts             # Browser storage locking
│
├── Validation & Security
│   ├── validation-schemas.ts            # Zod schemas
│   ├── access-control.ts                # Permission management
│   ├── rate-limiter.ts                  # API rate limiting
│   └── type-guards.ts                   # TypeScript guards
│
├── Utilities & Helpers
│   ├── utils.ts                         # General utilities (cn)
│   ├── format-utils.ts                  # Number/date formatting
│   ├── number-utils.ts                  # Number operations
│   ├── text-formatter.ts                # Text processing
│   ├── slug-utils.ts                    # URL slug generation
│   ├── url-utils.ts                     # URL manipulation
│   ├── color-utils.ts                   # Color operations
│   ├── chart-colors.ts                  # Chart color schemes
│   ├── chart-utils.ts                   # Chart helpers
│   └── navigation-utils.ts              # Navigation utilities
│
├── Advanced Systems
│   ├── advanced-cache-system.ts         # Multi-layer caching
│   ├── database-optimizations.ts        # Query optimization
│   ├── production-optimizations.ts      # Production performance
│   ├── query-optimizations.ts           # Database query tuning
│   ├── performance-monitor.tsx          # Performance tracking
│   ├── webgl-context-manager.ts         # WebGL optimization
│   └── policy-recommender.ts            # AI policy recommendations
│
├── Domain-Specific
│   ├── membership.ts                    # Organization membership
│   ├── power-classification.ts          # Country power tiers
│   ├── constellation-builder.ts         # Network visualization
│   ├── agenda-taxonomy.ts               # Political agenda classification
│   ├── policy-taxonomy.ts               # Policy classification
│   ├── sentiment-analysis.ts            # Text sentiment scoring
│   ├── social-profile-transformer.ts    # Social data transformation
│   └── user-utils.ts                    # User data utilities
│
├── Military & Defense
│   ├── military-equipment.ts            # Equipment catalog
│   ├── military-equipment-extended.ts   # Extended equipment data
│   └── small-arms-equipment.ts          # Small arms catalog
│
├── Logging & Monitoring
│   ├── logger.ts                        # Structured logging
│   ├── error-logger.ts                  # Error tracking
│   ├── log-retention.ts                 # Log cleanup
│   ├── user-logger.ts                   # User activity logging
│   └── user-logging-middleware.ts       # Logging middleware
│
├── Builder Systems
│   ├── builder-theme-utils.ts           # Builder UI theming
│   ├── mycountry-theme.ts               # MyCountry section theming
│   └── theme-utils.ts                   # General theme utilities
│
├── WebSocket & Real-time
│   ├── diplomatic-websocket.ts          # Diplomatic updates
│   ├── websocket-server.ts              # WebSocket server
│   └── websocket/
│       ├── intelligence-websocket-client.ts
│       ├── intelligence-websocket-server.ts
│       ├── thinkpages-websocket-server.ts
│       ├── thinkpages-types.ts
│       └── types.ts
│
├── Services (Complex Business Logic)
│   └── services/
│       ├── defenseGovernmentBridge.ts   # Defense-government integration
│       ├── wiki-cache-service.ts        # Wiki data caching
│       ├── wikiCommonsImageService.ts   # Wikimedia image service
│       └── wiki-preload.ts              # Wiki data preloading
│
└── Transformers (Data Mapping)
    └── transformers/
        ├── database-adapters.ts         # DB to interface mapping
        └── interface-adapters.ts        # Interface standardization
```

---

## Core Categories

### 1. Time Management

**Primary Module:** `ixtime.ts`

The IxTime system is the foundation for all time-based calculations in IxStats. It manages a custom time system that runs at 2x or 4x real-world speed.

```typescript
import { IxTime } from '~/lib/ixtime';

// Get current game time
const currentTime = IxTime.getCurrentIxTime();

// Calculate years elapsed
const yearsSince = IxTime.getYearsSinceGameEpoch();

// Format for display
const formatted = IxTime.formatIxTime(currentTime, true);
// Output: "Wednesday, March 15, 2039 14:30:45 (ILT)"

// Convert real time to game time
const gameTime = IxTime.convertToIxTime(Date.now());
```

**Key Features:**
- Dual speed support (4x before July 2025, 2x after)
- Epoch management (Oct 4, 2020 → Jan 1, 2028 baseline)
- Discord bot synchronization
- Admin controls (pause, override, speed adjustment)

**Related Modules:**
- `ixtime-sync.ts` - Bot synchronization logic
- `ixtime-accuracy.ts` - Precision time calculations
- `ixtime-economic-utils.ts` - Economic time helpers

---

### 2. Economic Calculations

**Primary Modules:** `calculations.ts`, `enhanced-economic-calculations.ts`

Core economic progression and advanced economic indices.

#### Basic GDP Progression

```typescript
import { IxStatsCalculator, EconomicConfig } from '~/lib/calculations';

const config: EconomicConfig = {
  globalGrowthFactor: 1.0321,  // 3.21% boost
  localGrowthFactor: 1.0,
  tierMaxGrowthRates: {
    EXTRAVAGANT: 0.005,  // 0.5%
    VERY_STRONG: 0.015,  // 1.5%
    // ... other tiers
  }
};

const calculator = new IxStatsCalculator(config);

// Calculate current stats
const stats = calculator.calculateCurrentStats({
  currentPopulation: 15000000,
  baselinePopulation: 14000000,
  currentGdpPerCapita: 35000,
  baselineGdpPerCapita: 32000,
  adjustedGdpGrowth: 0.035,  // 3.5%
  adjustedPopulationGrowth: 0.015,  // 1.5%
  baselineDate: IxTime.getInGameEpoch(),
  lastCalculated: IxTime.getCurrentIxTime()
});

console.log(stats.currentGdpPerCapita);  // Current GDP per capita
console.log(stats.economicTier);         // "HEALTHY"
console.log(stats.currentTotalGdp);      // Population × GDP per capita
```

#### Enhanced Economic Indices

```typescript
import { EnhancedEconomicCalculator } from '~/lib/enhanced-economic-calculations';

const enhancedCalc = new EnhancedEconomicCalculator(config);

// Economic Resilience Index (ERI)
const resilience = enhancedCalc.calculateEconomicResilience(
  countryStats,
  economyData,
  historicalData
);

console.log(resilience.overallScore);  // 0-100
console.log(resilience.components);
// {
//   fiscalStability: 75,
//   monetaryStability: 82,
//   structuralBalance: 68,
//   socialCohesion: 71
// }

// Productivity & Innovation Index (PII)
const productivity = enhancedCalc.calculateProductivityInnovation(
  countryStats,
  economyData
);

// Social Economic Wellbeing Index (SEWI)
const wellbeing = enhancedCalc.calculateSocialEconomicWellbeing(
  countryStats,
  economyData
);

// Economic Complexity & Trade Integration (ECTI)
const complexity = enhancedCalc.calculateEconomicComplexity(
  countryStats,
  economyData
);
```

**Key Features:**
- Tier-based growth constraints (7 economic tiers)
- Compound growth with diminishing returns
- DM input modifiers for events
- Historical data tracking
- 4 comprehensive economic indices

---

### 3. Atomic Component Systems

**Primary Module:** `unified-atomic-state.ts`

Centralized state management for atomic government components with real-time effectiveness calculation.

```typescript
import { UnifiedAtomicStateManager } from '~/lib/unified-atomic-state';
import { ComponentType } from '@prisma/client';

// Initialize manager
const manager = new UnifiedAtomicStateManager({
  countryContext: {
    countryId: 'country-123',
    size: 'medium',
    developmentLevel: 'emerging',
    politicalTradition: 'democratic'
  }
});

// Subscribe to state changes
const unsubscribe = manager.subscribe((state) => {
  console.log('Effectiveness:', state.effectivenessScore);
  console.log('GDP Boost:', state.economicModifiers.gdpGrowthModifier);
  console.log('Tax Efficiency:', state.economicModifiers.taxCollectionMultiplier);
  console.log('Synergies:', state.synergies.length);
  console.log('Conflicts:', state.conflicts.length);
});

// Update components (triggers cascade calculations)
manager.setSelectedComponents([
  ComponentType.RULE_OF_LAW,           // Base: 85%
  ComponentType.PROFESSIONAL_BUREAUCRACY, // Base: 85%
  ComponentType.TECHNOCRATIC_PROCESS,  // Creates synergy!
  ComponentType.DEMOCRATIC_PROCESS
]);

// Access current state
const state = manager.getState();
console.log(state.traditionalStructure.governmentType);
// "Technocratic Democracy"

console.log(state.traditionalStructure.departments);
// [
//   { name: 'Ministry of Interior', priority: 1, effectivenessBonus: 0 },
//   { name: 'Civil Service Commission', priority: 2, effectivenessBonus: 15 },
//   { name: 'Strategic Planning Agency', priority: 2, effectivenessBonus: 18 }
// ]

console.log(state.intelligenceFeeds);
// Real-time intelligence about opportunities, risks, trends

// Get component contribution
const contribution = manager.getComponentContribution(
  ComponentType.PROFESSIONAL_BUREAUCRACY
);
console.log(contribution);
// {
//   effectiveness: 85,
//   economicImpact: 0.20,  // +20% GDP
//   taxImpact: 0.25,       // +25% tax collection
//   structureImpact: ['Civil Service Commission', 'Admin Excellence Dept']
// }

// Cleanup
unsubscribe();
```

**Key Features:**
- 36 atomic government components
- Synergy detection (15+ defined synergies)
- Conflict detection (10+ defined conflicts)
- Auto-generated traditional structures
- Real-time economic impact modeling
- AI-powered intelligence feeds

**Related Modules:**
- `atomic-builder-state.ts` - Core builder state
- `atomic-client-calculations.ts` - Client-safe calculations
- `atomic-economic-integration.ts` - Economic modeling
- `atomic-intelligence-integration.ts` - Intelligence generation
- `atomic-recommendations.ts` - AI recommendations
- `atomic-tax-integration.ts` - Tax system integration

---

### 4. Intelligence & Vitality

**Primary Modules:** `vitality-calculator.ts`, `intelligence-engine.ts`

Calculate national health scores and generate intelligence briefings.

#### Vitality Scores

```typescript
import {
  calculateEconomicVitality,
  calculatePopulationWellbeing,
  calculateDiplomaticStanding,
  calculateGovernmentalEfficiency,
  calculateOverallNationalHealth
} from '~/lib/vitality-calculator';

// Calculate economic vitality (0-100)
const economicVitality = calculateEconomicVitality({
  gdpPerCapita: 42000,
  gdpGrowth: 0.028,
  unemploymentRate: 4.2,
  economicTier: 'HEALTHY',
  tradeBalance: 5000000000,
  inflationRate: 0.025
});
// Returns: { score: 92, breakdown: {...} }

// Calculate population wellbeing (0-100)
const wellbeing = calculatePopulationWellbeing({
  lifeExpectancy: 78,
  literacyRate: 97,
  giniCoefficient: 0.33,
  povertyRate: 8,
  populationGrowth: 0.012,
  socialMobilityIndex: 72
});
// Returns: { score: 88, breakdown: {...} }

// Calculate overall national health
const overallHealth = calculateOverallNationalHealth(
  economicVitality.score,
  wellbeing.score,
  diplomaticStanding.score,
  governmentalEfficiency.score
);
// Weighted average: 35% economic, 30% wellbeing, 20% govt, 15% diplomatic
```

#### Intelligence Generation

```typescript
import { generateIntelligenceReport } from '~/lib/intelligence-engine';

const report = generateIntelligenceReport(
  country,
  {
    gdpHistory: [32000, 33500, 35000, 36800],
    populationHistory: [14000000, 14200000, 14500000, 15000000],
    unemploymentHistory: [5.2, 4.8, 4.5, 4.2]
  },
  {
    gdpPerCapita: 35500,  // Peer average
    population: 16000000,
    unemployment: 5.0
  }
);

console.log(report.alerts);
// [
//   {
//     type: 'opportunity',
//     title: 'GDP Growth Exceeding Peer Average',
//     severity: 'medium',
//     metrics: { current: 36800, expected: 35500, deviation: 3.7 },
//     recommendations: ['Invest in infrastructure', 'Expand trade']
//   }
// ]
```

**Key Features:**
- 5 vitality metrics (economic, population, diplomatic, government, overall)
- Advanced anomaly detection
- Z-score-based statistical analysis
- Peer comparison analytics
- AI-generated recommendations

---

### 5. Tax Systems

**Primary Module:** `tax-calculator.ts`

Progressive tax calculation with brackets, deductions, and exemptions.

```typescript
import { calculateTax } from '~/lib/tax-calculator';

const taxSystem = {
  type: 'progressive',
  categories: [
    {
      name: 'Income Tax',
      baseRate: 0,
      calculationMethod: 'tiered',
      brackets: [
        { minIncome: 0, maxIncome: 10000, rate: 10 },
        { minIncome: 10001, maxIncome: 40000, rate: 15 },
        { minIncome: 40001, maxIncome: 85000, rate: 22 },
        { minIncome: 85001, maxIncome: 160000, rate: 24 },
        { minIncome: 160001, maxIncome: Infinity, rate: 28 }
      ],
      exemptionAmount: 4000,
      standardDeduction: 12000
    }
  ]
};

const result = calculateTax(
  150000,  // Gross income
  taxSystem
);

console.log(result);
// {
//   totalTaxOwed: 27160,
//   effectiveRate: 18.11,
//   marginalRate: 24,
//   adjustedGrossIncome: 146000,
//   taxableIncome: 134000,
//   categoryBreakdown: [
//     {
//       category: 'Income Tax',
//       tax: 27160,
//       appliedBrackets: [...]
//     }
//   ]
// }
```

**Key Features:**
- Progressive, flat, and tiered tax systems
- Bracket-based calculations
- Exemptions and deductions
- Alternative minimum tax (AMT)
- Effective vs. marginal rate calculation

---

### 6. Stability & Social Metrics

**Primary Module:** `stability-formulas.ts`

Calculate crime rates, social cohesion, protests, and overall stability.

```typescript
import {
  calculateCrimeRate,
  calculateOrganizedCrimeLevel,
  calculateSocialCohesion,
  calculateProtestFrequency,
  calculateRiotRisk,
  calculateTrustInGovernment,
  calculateOverallStability
} from '~/lib/stability-formulas';

// Crime rate (per 100k population)
const crimeRate = calculateCrimeRate({
  unemploymentRate: 6.5,
  giniIndex: 42,
  povertyRate: 12,
  youthUnemployment: 14.3,
  urbanizationRate: 68,
  policingBudget: 5000000000,
  population: 15000000
});
// Returns: { overall: 42.3, violent: 12.1, property: 30.2 }

// Social cohesion (0-100)
const cohesion = calculateSocialCohesion({
  gdpGrowth: 0.028,
  giniIndex: 38,
  politicalStability: 1.2,
  politicalPolarization: 45,
  ethnicDiversity: 32
});
// Returns: 72.5

// Protest frequency (events per year)
const protests = calculateProtestFrequency({
  politicalPolarization: 55,
  unemploymentRate: 6.5,
  giniIndex: 42,
  recentPolicies: [
    { popularityImpact: -15, daysSince: 45 },
    { popularityImpact: -8, daysSince: 20 }
  ],
  democracyIndex: 78
});
// Returns: 23 (protests per year)

// Overall stability (0-100)
const stability = calculateOverallStability({
  socialCohesion: 72.5,
  trustInGovernment: 65,
  crimeRate: 42.3,
  ethnicTension: 25,
  riotRisk: 18,
  policingEffectiveness: 75
});
// Returns: { score: 68, trend: 'stable' }
```

**Key Features:**
- 15+ stability metrics
- Crime modeling (violent, property, organized)
- Social cohesion analysis
- Protest and riot risk calculation
- Trust and legitimacy scoring

---

### 7. Data Services & Transformation

**Primary Modules:** `data-service.ts`, `economic-data-templates.ts`

Generate realistic economic data and transform between formats.

```typescript
import { generateEconomicData } from '~/lib/economic-data-templates';

const economyData = generateEconomicData({
  population: 15000000,
  gdpPerCapita: 35000,
  unemploymentRate: 4.5,
  participationRate: 68,
  giniCoefficient: 0.38,
  literacyRate: 96
});

console.log(economyData);
// {
//   core: {
//     nominalGDP: 525000000000,
//     realGDP: 512000000000,
//     gdpPerCapita: 35000,
//     gdpGrowthRate: 0.028,
//     inflationRate: 0.025,
//     ...
//   },
//   labor: {
//     totalWorkforce: 9750000,
//     employed: 9311250,
//     unemployed: 438750,
//     laborForceParticipationRate: 68,
//     ...
//   },
//   income: {
//     nationalMeanIncome: 29750,
//     nationalMedianIncome: 21420,
//     incomeClasses: [...],
//     incomeInequalityGini: 0.38,
//     ...
//   },
//   sectors: [...],
//   trade: {...},
//   fiscal: {...}
// }
```

**Key Features:**
- Realistic economic data generation
- Income distribution modeling
- Sector employment and GDP allocation
- Trade data generation
- Fiscal policy defaults

---

### 8. External Integrations

#### MediaWiki Integration

```typescript
import { MediaWikiService } from '~/lib/mediawiki-service';

const wikiService = new MediaWikiService();

// Fetch country roster
const roster = await wikiService.fetchCountryRoster();

// Search wiki
const searchResults = await wikiService.searchWiki('democracy');

// Parse infobox
const infobox = await wikiService.parseInfobox('Country_Name');
```

#### Discord Webhooks

```typescript
import { sendDiscordNotification } from '~/lib/discord-webhook';

await sendDiscordNotification({
  type: 'economy',
  title: 'GDP Milestone Reached',
  description: 'Country X has surpassed $50,000 GDP per capita',
  severity: 'info',
  metadata: { countryId: 'country-123', gdp: 52000 }
});
```

#### Flag Services

```typescript
import { FlagService } from '~/lib/country-flag-service';

const flagService = new FlagService();

// Get flag URL
const flagUrl = await flagService.getFlagUrl('country-slug');

// Get flag colors
const colors = await flagService.extractColors('country-slug');
// Returns: ['#FF0000', '#FFFFFF', '#0000FF']

// Prefetch flags
await flagService.prefetchFlags(['country1', 'country2']);
```

---

## Usage Patterns

### Pattern 1: Pure Calculation Functions

Most library modules export pure functions that take inputs and return outputs without side effects.

```typescript
// ✅ Good: Pure function usage
import { calculateEconomicTier } from '~/lib/calculations';

const tier = calculateEconomicTier(45000);
// Returns: EconomicTier.STRONG
```

### Pattern 2: Class-Based Services

Complex services use classes to manage state and provide methods.

```typescript
// ✅ Good: Service instantiation
import { EnhancedEconomicCalculator } from '~/lib/enhanced-economic-calculations';

const calculator = new EnhancedEconomicCalculator(config);
const resilience = calculator.calculateEconomicResilience(...);
```

### Pattern 3: Observable State Managers

State managers use observer pattern for reactive updates.

```typescript
// ✅ Good: Observable state
import { UnifiedAtomicStateManager } from '~/lib/unified-atomic-state';

const manager = new UnifiedAtomicStateManager();

const unsubscribe = manager.subscribe((state) => {
  // React to state changes
  updateUI(state);
});

// Cleanup
useEffect(() => unsubscribe, []);
```

### Pattern 4: Client-Server Split

Some modules have separate client and server implementations.

```typescript
// Client-safe calculations
import { calculateClientAtomicEconomicImpact } from '~/lib/atomic-client-calculations';

// Server-only calculations (requires database)
import { calculateServerAtomicEconomicImpact } from '~/lib/atomic-economic-integration.server';
```

### Pattern 5: Utility Composition

Combine utilities to build complex functionality.

```typescript
import { IxTime } from '~/lib/ixtime';
import { calculateCurrentStats } from '~/lib/calculations';
import { formatCurrency } from '~/lib/format-utils';

const stats = calculateCurrentStats({
  // ... params with IxTime
  baselineDate: IxTime.getInGameEpoch(),
  lastCalculated: IxTime.getCurrentIxTime()
});

const formatted = formatCurrency(stats.currentTotalGdp);
// "$525.3B"
```

---

## Dependency Relationships

### Core Dependencies

```
IxTime System
  ↓
Core Calculations (GDP, Population)
  ↓
┌──────────────┴──────────────┐
│                             │
Enhanced Economic         Atomic Systems
Calculations                  │
│                             │
├─ Economic Resilience        ├─ Component Effectiveness
├─ Productivity Index         ├─ Synergy Detection
├─ Wellbeing Index           ├─ Economic Integration
└─ Complexity Index          └─ Intelligence Feeds
  │                             │
  └──────────┬──────────────────┘
             ↓
    Intelligence Engine
             ↓
    ┌────────┴────────┐
    │                 │
Vitality         Stability
Calculator       Formulas
    │                 │
    └────────┬────────┘
             ↓
     Analytics Systems
```

### Module Coupling

**Low Coupling (✅ Good):**
- `utils.ts` - No dependencies
- `format-utils.ts` - Standalone formatting
- `ixtime.ts` - Self-contained time system

**Medium Coupling (⚠️ Monitor):**
- `calculations.ts` - Depends on IxTime
- `atomic-client-calculations.ts` - Depends on ComponentType enum
- `vitality-calculator.ts` - Depends on multiple data types

**High Coupling (🔄 By Design):**
- `unified-atomic-state.ts` - Orchestrates 5+ systems
- `intelligence-calculator.ts` - Database + multiple calculators
- `enhanced-economic-service.ts` - Full-stack integration

---

## Testing Approaches

### Unit Testing Pure Functions

```typescript
// calculations.test.ts
import { calculateEconomicTier } from '~/lib/calculations';

describe('calculateEconomicTier', () => {
  it('returns IMPOVERISHED for GDP per capita under $10,000', () => {
    expect(calculateEconomicTier(5000)).toBe(EconomicTier.IMPOVERISHED);
  });

  it('returns STRONG for GDP per capita $45,000-$54,999', () => {
    expect(calculateEconomicTier(50000)).toBe(EconomicTier.STRONG);
  });

  it('handles edge cases', () => {
    expect(calculateEconomicTier(0)).toBe(EconomicTier.IMPOVERISHED);
    expect(calculateEconomicTier(100000)).toBe(EconomicTier.EXTRAVAGANT);
  });
});
```

### Integration Testing Services

```typescript
// intelligence-calculator.test.ts
import { generateIntelligenceReport } from '~/lib/intelligence-engine';

describe('IntelligenceEngine', () => {
  it('generates alerts for significant deviations', () => {
    const report = generateIntelligenceReport(
      mockCountry,
      mockHistory,
      mockPeerAverages
    );

    expect(report.alerts).toHaveLength(3);
    expect(report.alerts[0].type).toBe('opportunity');
    expect(report.alerts[0].severity).toBe('high');
  });
});
```

### Testing with Mocks

```typescript
// mediawiki-service.test.ts
import { MediaWikiService } from '~/lib/mediawiki-service';

jest.mock('node-fetch');

describe('MediaWikiService', () => {
  it('fetches country roster', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ countries: [...] })
    });

    const service = new MediaWikiService();
    const roster = await service.fetchCountryRoster();

    expect(roster).toHaveLength(50);
  });
});
```

### Testing State Managers

```typescript
// unified-atomic-state.test.ts
import { UnifiedAtomicStateManager } from '~/lib/unified-atomic-state';
import { ComponentType } from '@prisma/client';

describe('UnifiedAtomicStateManager', () => {
  it('notifies subscribers on state change', () => {
    const manager = new UnifiedAtomicStateManager();
    const listener = jest.fn();

    manager.subscribe(listener);
    manager.setSelectedComponents([ComponentType.RULE_OF_LAW]);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        effectivenessScore: expect.any(Number)
      })
    );
  });
});
```

---

## Performance Considerations

### Calculation Caching

```typescript
// ✅ Good: Memoized expensive calculations
import { useMemo } from 'react';
import { calculateEconomicResilience } from '~/lib/enhanced-economic-calculations';

function EconomicDashboard({ countryData }) {
  const resilience = useMemo(
    () => calculateEconomicResilience(countryData),
    [countryData.gdpPerCapita, countryData.population]
  );

  return <div>Resilience: {resilience.overallScore}</div>;
}
```

### Batch Processing

```typescript
// ✅ Good: Process multiple countries in batches
import { calculateVitalityScores } from '~/lib/vitality-calculator';

async function* calculateCountryBatch(countries: Country[]) {
  for (const country of countries) {
    yield calculateVitalityScores(country);
  }
}

// Process 10 at a time
for await (const scores of calculateCountryBatch(allCountries)) {
  await saveToDatabase(scores);
}
```

### Lazy Evaluation

```typescript
// ✅ Good: Only calculate when needed
function CountryAnalysis({ country, showDetailed }) {
  const basicStats = calculateBasicStats(country);

  // Only calculate expensive metrics if detailed view is open
  const detailedStats = showDetailed
    ? calculateDetailedEconomicAnalysis(country)
    : null;

  return (
    <div>
      <BasicView stats={basicStats} />
      {showDetailed && <DetailedView stats={detailedStats} />}
    </div>
  );
}
```

### Database Query Optimization

```typescript
// ✅ Good: Select only needed fields
import { db } from '~/server/db';

const countries = await db.country.findMany({
  select: {
    id: true,
    currentGdpPerCapita: true,
    currentPopulation: true,
    economicTier: true
    // Don't fetch unnecessary fields
  },
  where: { economicTier: 'STRONG' }
});
```

---

## Adding New Utilities

### When to Add a New Utility

✅ **Add a new utility when:**
- Functionality is reused in 3+ places
- Logic is complex and deserves isolated testing
- Functionality is domain-specific (economic, time, etc.)
- Code can be made into a pure function

❌ **Don't add a utility for:**
- One-off calculations used in a single component
- Simple operations (use inline code)
- Component-specific logic (keep in component file)

### Step 1: Determine Category

Choose the appropriate category:
- **Time utilities** → `ixtime-*.ts`
- **Economic calculations** → `*-calculations.ts` or `economic-*.ts`
- **Formatting** → `format-utils.ts` or new `*-formatter.ts`
- **Data transformation** → `transformers/` directory
- **External integration** → `*-service.ts`
- **General helpers** → `utils.ts` or new specific file

### Step 2: Create Module File

```typescript
// src/lib/my-new-utility.ts

/**
 * My New Utility Module
 *
 * Description of what this module does and when to use it.
 *
 * @module my-new-utility
 * @since 1.1.0
 */

/**
 * Calculate something useful
 *
 * @param input - Description of input parameter
 * @returns Description of return value
 *
 * @example
 * ```typescript
 * const result = calculateSomething(42);
 * console.log(result); // 84
 * ```
 */
export function calculateSomething(input: number): number {
  return input * 2;
}

/**
 * Transform data from one format to another
 */
export function transformData(raw: RawData): ProcessedData {
  return {
    // ... transformation logic
  };
}
```

### Step 3: Add Tests

```typescript
// src/lib/my-new-utility.test.ts
import { calculateSomething, transformData } from './my-new-utility';

describe('my-new-utility', () => {
  describe('calculateSomething', () => {
    it('doubles the input', () => {
      expect(calculateSomething(21)).toBe(42);
    });

    it('handles edge cases', () => {
      expect(calculateSomething(0)).toBe(0);
      expect(calculateSomething(-5)).toBe(-10);
    });
  });

  describe('transformData', () => {
    it('transforms data correctly', () => {
      const result = transformData(mockRawData);
      expect(result).toEqual(expectedOutput);
    });
  });
});
```

### Step 4: Document in This README

Add your new utility to the appropriate category section above and include a usage example.

### Step 5: Export from Index (If Applicable)

For frequently used utilities, consider creating an index file:

```typescript
// src/lib/economic/index.ts
export * from './calculations';
export * from './enhanced-calculations';
export * from './economic-data-templates';
```

---

## Module Reference

### Time System (6 modules)

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `ixtime.ts` | Core time system | `IxTime` class, time conversion |
| `ixtime-sync.ts` | Bot synchronization | `syncWithBot()`, `fetchFromBot()` |
| `ixtime-accuracy.ts` | Precision utilities | `validateTimestamp()`, `calculateDrift()` |
| `ixtime-economic-utils.ts` | Economic time helpers | `getQuarterInfo()`, `getYearRange()` |

### Core Calculations (8 modules)

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `calculations.ts` | GDP/population progression | `IxStatsCalculator`, `EconomicTier` |
| `enhanced-calculations.ts` | Advanced indicators | `calculateGrowthRate()`, `calculateTier()` |
| `enhanced-economic-calculations.ts` | Economic indices | `EnhancedEconomicCalculator` (ERI, PII, SEWI, ECTI) |
| `economic-calculation-groups.ts` | Grouped calculations | `CalculationGroup` types |
| `economic-data-templates.ts` | Data generation | `generateEconomicData()` |
| `enhanced-economic-service.ts` | Full economic service | `EconomicService` class |
| `intuitive-economic-analysis.ts` | User-friendly analysis | `analyzeEconomy()` |
| `historical-trends.ts` | Time-series analysis | `calculateTrend()`, `detectPattern()` |

### Atomic Systems (8 modules)

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `atomic-builder-state.ts` | Core atomic state | `AtomicBuilderStateManager` |
| `atomic-client-calculations.ts` | Client-safe calcs | `calculateClientAtomicEconomicImpact()` |
| `atomic-economic-integration.ts` | Economic modeling | `integrateAtomicEconomics()` |
| `atomic-intelligence-integration.ts` | Intelligence feeds | `generateAtomicIntelligence()` |
| `atomic-recommendations.ts` | AI recommendations | `generateRecommendations()` |
| `atomic-tax-integration.ts` | Tax integration | `calculateAtomicTaxEffectiveness()` |
| `unified-atomic-state.ts` | Unified management | `UnifiedAtomicStateManager` |
| `unified-atomic-tax-integration.ts` | Tax-atomic bridge | `syncTaxWithAtomic()` |

### Intelligence & Vitality (7 modules)

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `intelligence-engine.ts` | Intelligence generation | `generateIntelligenceReport()` |
| `intelligence-calculator.ts` | DB-backed calculations | `calculateIntelligence()` |
| `intelligence-cache.ts` | Performance caching | `IntelligenceCache` class |
| `intelligence-broadcast-service.ts` | Real-time updates | `broadcastIntelligence()` |
| `vitality-calculator.ts` | Vitality scoring | 5 vitality calculation functions |
| `stability-formulas.ts` | Stability metrics | 15+ stability calculation functions |
| `predictive-analytics-engine.ts` | Forecasting | `forecastEconomicTrends()` |

### Government & Tax (5 modules)

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `government-spending-bridge.ts` | Spending integration | `bridgeSpendingToEconomy()` |
| `government-spending-defaults.ts` | Default allocations | `DEFAULT_SPENDING_CATEGORIES` |
| `tax-calculator.ts` | Tax computation | `calculateTax()`, `TaxResult` |
| `tax-data-parser.ts` | Tax parsing | `parseTaxSystem()` |
| `defense-integration.ts` | Military spending | `integrateDefenseSpending()` |

### External Integrations (12 modules)

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `mediawiki-service.ts` | IxWiki API | `MediaWikiService` class |
| `wiki-search-service.ts` | Wiki search | `searchWiki()` |
| `wiki-infobox-mapper.ts` | Infobox parsing | `parseInfobox()` |
| `wikitext-parser.ts` | Wikitext parsing | `parseWikitext()` |
| `discord-webhook.ts` | Discord notifications | `sendDiscordNotification()` |
| `country-flag-service.ts` | Flag management | `FlagService` class |
| `flag-color-analysis.ts` | Color extraction | `extractColors()` |
| `unified-flag-service.ts` | Unified flag API | `UnifiedFlagService` class |
| `wiki-commons-flag-service.ts` | Wikimedia integration | `fetchFromCommons()` |
| `image-download-service.ts` | External images | `downloadImage()` |
| `unsplash-service.ts` | Unsplash API | `UnsplashService` class |
| `excel-handler.ts` | Excel import/export | `exportToExcel()`, `importFromExcel()` |

### Utilities (15 modules)

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `utils.ts` | General utilities | `cn()` (className merge) |
| `format-utils.ts` | Formatting | `formatCurrency()`, `formatPercent()` |
| `number-utils.ts` | Number operations | `clamp()`, `round()`, `abbreviate()` |
| `text-formatter.ts` | Text processing | `capitalize()`, `truncate()` |
| `slug-utils.ts` | URL slugs | `createSlug()`, `validateSlug()` |
| `url-utils.ts` | URL manipulation | `buildUrl()`, `parseQuery()` |
| `color-utils.ts` | Color operations | `hexToRgb()`, `lighten()` |
| `chart-colors.ts` | Chart colors | `CHART_COLOR_SCHEMES` |
| `chart-utils.ts` | Chart helpers | `formatAxisLabel()` |
| `navigation-utils.ts` | Navigation | `getActivePath()` |
| `validation-schemas.ts` | Zod schemas | 50+ validation schemas |
| `type-guards.ts` | TypeScript guards | `isCountry()`, `isEconomyData()` |
| `access-control.ts` | Permissions | `checkPermission()` |
| `rate-limiter.ts` | Rate limiting | `RateLimiter` class |
| `localStorageMutex.ts` | Storage locking | `LocalStorageMutex` class |

---

## Best Practices Summary

### Do's ✅

1. **Pure Functions First**: Prefer pure functions over stateful classes
2. **Type Everything**: Use TypeScript strict mode, no `any` types
3. **Document Functions**: Add JSDoc comments for all exported functions
4. **Test Thoroughly**: Write unit tests for calculation logic
5. **Cache Wisely**: Memoize expensive calculations
6. **Handle Errors**: Use try-catch and return meaningful errors
7. **Validate Inputs**: Check bounds and handle edge cases
8. **Use Utilities**: Import existing utilities before creating new ones

### Don'ts ❌

1. **No Side Effects**: Library functions should not mutate external state
2. **No Direct DB Access**: Use tRPC routers for database operations
3. **No Component Logic**: Keep UI logic in components
4. **No Duplication**: Check for existing utilities first
5. **No Magic Numbers**: Use named constants
6. **No Implicit Any**: Always specify types
7. **No Circular Dependencies**: Keep dependencies linear
8. **No Premature Optimization**: Optimize after measuring

---

## Version History

### v1.1.0 (October 2025)
- Added unified atomic state management
- Enhanced intelligence generation with DB backing
- Improved vitality calculation accuracy
- Added 15+ stability formulas
- Performance optimizations across all calculators

### v1.0.0 (September 2025)
- Initial production release
- 120+ utility modules
- Core economic calculation engine
- IxTime system implementation
- Atomic component framework
- Intelligence and vitality systems

---

## Related Documentation

- [Formulas and Calculations](../docs/FORMULAS_AND_CALCULATIONS.md) - Detailed formula reference
- [Code Standards](../docs/CODE_STANDARDS.md) - Coding conventions
- [API Reference](../docs/API_REFERENCE.md) - tRPC API documentation
- [Testing Guide](../docs/TESTING_GUIDE.md) - Testing best practices

---

**For questions or contributions, see [CONTRIBUTING.md](../docs/CONTRIBUTING.md)**
