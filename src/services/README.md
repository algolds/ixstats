# Services Layer Documentation

**Version:** 1.1.0
**Last Updated:** October 2025
**Status:** Production-Ready

## Table of Contents

1. [Overview](#overview)
2. [Service Architecture](#service-architecture)
3. [Client vs Server Services](#client-vs-server-services)
4. [Core Service Patterns](#core-service-patterns)
5. [Service Catalog](#service-catalog)
6. [Creating a New Service](#creating-a-new-service)
7. [Service Integration](#service-integration)
8. [Performance Considerations](#performance-considerations)
9. [Testing Services](#testing-services)
10. [Best Practices](#best-practices)

---

## Overview

The IxStats services layer provides business logic, data processing, and domain-specific functionality that sits between the UI components and the tRPC API layer. Services encapsulate complex operations, provide reusable functionality, and maintain separation of concerns.

### Key Principles

- **Single Responsibility**: Each service has one clear purpose
- **Stateless Operations**: Services prefer pure functions over maintaining state
- **Singleton Pattern**: Most services use singleton instances for efficiency
- **Type Safety**: Full TypeScript coverage with strict typing
- **Performance Optimized**: Caching, memoization, and efficient algorithms

### Service Categories

```
src/services/                    # Client-side services
├── Notification Services        # 8 notification-related services
├── Policy & Effect Services     # 1 policy calculation service
├── Intelligence Services        # 2 intelligence and context engines
└── Atomic Services              # 1 atomic effectiveness calculator

src/server/services/             # Server-side services
├── Builder Integration          # Government/Tax builder sync
├── Wiki Integration            # IxWiki API services (2)
└── Query Optimization          # Database query optimization
```

---

## Service Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    UI Components                         │
├─────────────────────────────────────────────────────────┤
│                  React Hooks Layer                       │
│            (useEconomyData, useIntelligence)            │
├─────────────────────────────────────────────────────────┤
│                   Services Layer                         │
│  ┌────────────────┬────────────────┬─────────────────┐ │
│  │ Notifications  │ Intelligence   │ Atomic Effects  │ │
│  │   Services     │   Engines      │   Calculator    │ │
│  └────────────────┴────────────────┴─────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                    tRPC API Layer                        │
│              (31 routers, 304 endpoints)                │
├─────────────────────────────────────────────────────────┤
│                 Server Services Layer                    │
│  ┌────────────────┬────────────────┬─────────────────┐ │
│  │ Builder Sync   │ Wiki Cache     │ Query Optimizer │ │
│  └────────────────┴────────────────┴─────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                    Database (Prisma)                     │
│              (124 models, PostgreSQL/SQLite)            │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```typescript
// Typical service interaction flow

// 1. Component calls hook
const { data, isLoading } = useIntelligenceData(countryId);

// 2. Hook calls tRPC endpoint
const intelligence = api.intelligence.getReport.useQuery({ countryId });

// 3. tRPC endpoint calls server service
export const intelligenceRouter = createTRPCRouter({
  getReport: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 4. Server service processes data
      const report = await generateIntelligenceReport(
        country,
        historicalData,
        peerAverages
      );

      // 5. Client service enriches/transforms response
      const enriched = contextIntelligenceEngine.analyzeContext(
        report,
        userContext
      );

      return enriched;
    }),
});
```

---

## Client vs Server Services

### Client Services (`src/services/`)

**Purpose**: Browser-side business logic, UI state management, and user interaction processing

**Characteristics**:
- Run in browser environment
- No database access (use tRPC instead)
- Can use browser APIs (localStorage, WebSocket, etc.)
- Focus on UI state, notifications, and user context
- Singleton pattern with lazy initialization

**Examples**:

```typescript
// Client service - Notification Orchestrator
// src/services/NotificationOrchestrator.ts

export class NotificationOrchestrator {
  private config: OrchestratorConfig;
  private eventEmitter: NotificationEventEmitter;
  private processingQueue: QueueItem[] = [];

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.eventEmitter = new NotificationEventEmitter();
    this.startProcessing();
  }

  async createNotification(
    notification: Omit<UnifiedNotification, 'id' | 'timestamp'>,
    context: NotificationContext
  ): Promise<string> {
    // Client-side notification processing
    const id = this.generateId();
    const relevanceScore = await this.calculateRelevanceScore(notification, context);

    if (await this.shouldSuppress(notification, context)) {
      return id;
    }

    this.addToQueue(notification, context);
    return id;
  }
}

// Singleton export
let orchestratorInstance: NotificationOrchestrator | null = null;

export function getNotificationOrchestrator(
  config?: Partial<OrchestratorConfig>
): NotificationOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new NotificationOrchestrator(config);
  }
  return orchestratorInstance;
}
```

### Server Services (`src/server/services/`)

**Purpose**: Server-side business logic, database operations, and external API integration

**Characteristics**:
- Run on server (Node.js environment)
- Full database access via Prisma
- Can make external API calls
- Focus on data persistence, complex calculations, integration
- Injected dependencies (PrismaClient)

**Examples**:

```typescript
// Server service - Builder Integration
// src/server/services/builderIntegrationService.ts

export async function syncGovernmentData(
  db: PrismaClient,
  countryId: string,
  governmentData: GovernmentBuilderState
): Promise<IntegrationResult> {
  const affectedTables: string[] = [];
  const syncedFields: string[] = [];

  try {
    const warnings = await detectGovernmentConflicts(db, countryId, governmentData);

    await db.$transaction(async (tx) => {
      // 1. Sync Country table
      await tx.country.update({
        where: { id: countryId },
        data: {
          governmentType: governmentData.structure.governmentType,
          leader: governmentData.structure.headOfState,
        }
      });
      affectedTables.push('Country');

      // 2. Sync GovernmentBudget table
      const spendingByCategory = calculateSpendingCategories(governmentData);
      await tx.governmentBudget.upsert({
        where: { countryId },
        update: { spendingCategories: JSON.stringify(spendingByCategory) },
        create: { countryId, spendingCategories: JSON.stringify(spendingByCategory) }
      });
      affectedTables.push('GovernmentBudget');
    });

    return { success: true, warnings, affectedTables, syncedFields };
  } catch (error) {
    return { success: false, warnings: [], affectedTables, syncedFields, errors: [error.message] };
  }
}
```

### When to Use Each

**Use Client Services When**:
- Processing UI state or user interactions
- Managing browser-specific functionality (notifications, storage)
- Analyzing user context or behavior patterns
- Real-time UI updates without server round-trip
- Lightweight calculations that don't require database

**Use Server Services When**:
- Performing database operations
- Making external API calls
- Running complex calculations on large datasets
- Enforcing business rules that require data integrity
- Operations requiring authentication/authorization

---

## Core Service Patterns

### 1. Singleton Pattern

Most services use singletons to avoid re-instantiation overhead.

```typescript
// Service class
export class MyService {
  private cache = new Map<string, any>();

  constructor(private config: MyServiceConfig) {
    console.log('[MyService] Initialized');
  }

  async doSomething(input: string): Promise<Result> {
    // Service logic
  }
}

// Singleton instance management
let serviceInstance: MyService | null = null;

export function getMyService(config?: MyServiceConfig): MyService {
  if (!serviceInstance) {
    serviceInstance = new MyService(config || DEFAULT_CONFIG);
  }
  return serviceInstance;
}

// Usage in component
import { getMyService } from '~/services/MyService';

const service = getMyService();
const result = await service.doSomething('input');
```

### 2. Event Emitter Pattern

Services that need to communicate changes use event emitters.

```typescript
class NotificationEventEmitter extends EventTarget {
  emit(type: NotificationEventType, data: any) {
    const event = new CustomEvent(type, {
      detail: { ...data, timestamp: Date.now() }
    });
    this.dispatchEvent(event);
  }

  on(type: NotificationEventType, handler: (event: CustomEvent) => void) {
    this.addEventListener(type, handler as EventListener);
  }

  off(type: NotificationEventType, handler: (event: CustomEvent) => void) {
    this.removeEventListener(type, handler as EventListener);
  }
}

export class NotificationOrchestrator {
  private eventEmitter = new NotificationEventEmitter();

  async createNotification(notification: UnifiedNotification) {
    // Process notification
    this.eventEmitter.emit('created', notification);
  }

  on(eventType: NotificationEventType, handler: (event: CustomEvent) => void) {
    this.eventEmitter.on(eventType, handler);
  }
}

// Usage
const orchestrator = getNotificationOrchestrator();
orchestrator.on('created', (event) => {
  console.log('Notification created:', event.detail);
});
```

### 3. Caching Pattern

Services cache expensive calculations with TTL management.

```typescript
export class AtomicEffectivenessService {
  private cache = new Map<string, { data: AtomicEffectiveness; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getCountryEffectiveness(
    countryId: string,
    useCache: boolean = true
  ): Promise<AtomicEffectiveness> {
    if (useCache) {
      const cached = this.cache.get(countryId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    const effectiveness = await this.calculateEffectiveness(countryId);
    this.cache.set(countryId, { data: effectiveness, timestamp: Date.now() });

    return effectiveness;
  }

  invalidateCache(countryId: string): void {
    this.cache.delete(countryId);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

### 4. Builder/Factory Pattern

Complex object construction uses builders.

```typescript
export class IntelligenceReportBuilder {
  private alerts: IntelligenceAlert[] = [];
  private insights: CorrelationInsight[] = [];
  private trends: TrendAnalysis[] = [];

  addAlert(alert: IntelligenceAlert): this {
    this.alerts.push(alert);
    return this;
  }

  addInsight(insight: CorrelationInsight): this {
    this.insights.push(insight);
    return this;
  }

  addTrend(trend: TrendAnalysis): this {
    this.trends.push(trend);
    return this;
  }

  build(countryId: string): IntelligenceReport {
    return {
      countryId,
      generated: Date.now(),
      alerts: this.alerts,
      correlations: this.insights,
      trends: this.trends,
      summary: this.calculateSummary(),
    };
  }

  private calculateSummary() {
    return {
      overallHealth: this.calculateOverallHealth(),
      criticalIssues: this.alerts.filter(a => a.severity === 'critical').length,
      opportunities: this.alerts.filter(a => a.type === 'opportunity').length,
      riskLevel: this.calculateRiskLevel(),
    };
  }
}

// Usage
const report = new IntelligenceReportBuilder()
  .addAlert({ type: 'economic', severity: 'high', message: '...' })
  .addInsight({ factor1: 'gdp', factor2: 'unemployment', correlation: -0.7 })
  .addTrend({ metric: 'gdp', direction: 'increasing', strength: 0.8 })
  .build(countryId);
```

### 5. Strategy Pattern

Services use strategies for different calculation methods.

```typescript
interface CalculationStrategy {
  calculate(input: EconomicData): number;
}

class TierBasedStrategy implements CalculationStrategy {
  calculate(input: EconomicData): number {
    const tier = calculateTier(input.gdpPerCapita);
    return input.gdp * TIER_MULTIPLIERS[tier];
  }
}

class HistoricalStrategy implements CalculationStrategy {
  calculate(input: EconomicData): number {
    return input.historicalGrowth * input.gdp;
  }
}

export class PolicyEffectService {
  private strategy: CalculationStrategy;

  setStrategy(strategy: CalculationStrategy) {
    this.strategy = strategy;
  }

  calculateEffect(data: EconomicData): number {
    return this.strategy.calculate(data);
  }
}

// Usage
const service = new PolicyEffectService();
service.setStrategy(new TierBasedStrategy());
const effect = service.calculateEffect(economicData);
```

---

## Service Catalog

### Notification Services

#### 1. NotificationOrchestrator

**Location**: `src/services/NotificationOrchestrator.ts`
**Purpose**: Central hub for processing, routing, and delivering all notifications

**Key Features**:
- Priority-based queue management
- Rate limiting per priority level
- Event emission for lifecycle tracking
- Multi-channel delivery routing
- Suppression rule evaluation

**Usage**:

```typescript
import { getNotificationOrchestrator } from '~/services/NotificationOrchestrator';

const orchestrator = getNotificationOrchestrator();

// Create notification
const notificationId = await orchestrator.createNotification({
  category: 'economic',
  priority: 'high',
  title: 'GDP Growth Alert',
  message: 'Your GDP grew by 5% this quarter',
  sourceSystem: 'intelligence',
}, {
  userId: user.id,
  currentRoute: '/mycountry',
  isExecutiveMode: false,
  sessionDuration: 300000,
  recentActions: ['view-dashboard'],
});

// Listen for events
orchestrator.on('delivered', (event) => {
  console.log('Notification delivered:', event.detail.notification);
});
```

**Integration Points**:
- Components via `useNotifications` hook
- Intelligence system via `IntelligenceNotificationPipeline`
- Diplomatic system via `DiplomaticNotificationService`

---

#### 2. ContextIntelligenceEngine

**Location**: `src/services/ContextIntelligenceEngine.ts`
**Purpose**: Analyzes user context to provide intelligent notification delivery recommendations

**Key Features**:
- Focus level detection (deep-work, focused, browsing, distracted)
- Cognitive load assessment
- Activity pattern recognition
- Learning from user engagement
- Contextual delivery method recommendations

**Usage**:

```typescript
import { getContextIntelligenceEngine } from '~/services/ContextIntelligenceEngine';

const engine = getContextIntelligenceEngine();

// Analyze context
const analysis = await engine.analyzeContext(
  notification,
  {
    userId: user.id,
    currentRoute: '/executive/dashboard',
    isExecutiveMode: true,
    sessionDuration: 1800000, // 30 minutes
    recentActions: ['view-report', 'analyze-trends'],
    activeFeatures: ['intelligence', 'economic-dashboard'],
  },
  userPreferences
);

// Result includes:
// - userState: { focusLevel, activityPattern, cognitiveLoad }
// - recommendedDeliveryMethod: 'dynamic-island' | 'toast' | 'modal'
// - urgencyMultiplier: 1.5
// - suppressionRecommendation: { shouldSuppress: false }
// - contextualRelevance: 85
```

**Machine Learning**:
- Tracks user engagement patterns over 30-day window
- Learns preferred delivery times by hour of day
- Measures response times by delivery method
- Identifies dismissal patterns by category
- Requires minimum 10 samples for learning

---

#### 3. NotificationCategorization

**Location**: `src/services/NotificationCategorization.ts`
**Purpose**: Auto-categorize notifications based on content

**Categories**:
- `economic`: GDP, trade, fiscal matters
- `diplomatic`: Relations, treaties, missions
- `governance`: Government structure, policies
- `security`: Defense, crises, threats
- `achievement`: Milestones, rankings
- `social`: Demographics, culture
- `system`: Platform updates, errors

---

#### 4. NotificationGrouping

**Location**: `src/services/NotificationGrouping.ts`
**Purpose**: Batch similar notifications to reduce notification fatigue

**Grouping Rules**:
- Same category within 2-minute window
- Same priority level
- Same source system
- Maximum 3 notifications per group

---

#### 5. EnhancedNotificationPriority

**Location**: `src/services/EnhancedNotificationPriority.ts`
**Purpose**: Calculate dynamic priority based on multiple factors

**Priority Factors**:
- Base severity (critical, high, medium, low)
- User context (executive mode, deep work)
- Time sensitivity (expires in X minutes)
- Source credibility (intelligence system vs user action)
- Historical engagement (user clicked similar notifications)

---

#### 6. IntelligenceNotificationPipeline

**Location**: `src/services/IntelligenceNotificationPipeline.ts`
**Purpose**: Convert intelligence alerts into notifications

**Pipeline Stages**:
1. Filter alerts by severity threshold
2. Enrich with context (affected metrics, historical comparison)
3. Add actionable recommendations
4. Set priority based on alert type
5. Route to NotificationOrchestrator

---

#### 7. DiplomaticNotificationService

**Location**: `src/services/DiplomaticNotificationService.ts`
**Purpose**: Generate notifications for diplomatic events

**Event Types**:
- Embassy established/closed
- Mission sent/completed
- Cultural exchange started/ended
- Treaty proposed/signed/rejected
- Diplomatic incident occurred

---

#### 8. GlobalNotificationBridge & GlobalNotificationStore

**Location**: `src/services/GlobalNotificationBridge.ts`, `GlobalNotificationStore.ts`
**Purpose**: Manage global notification state and cross-component communication

---

### Intelligence Services

#### 9. ContextIntelligenceEngine

*See Notification Services section above*

---

### Atomic Services

#### 10. AtomicEffectivenessService

**Location**: `src/services/AtomicEffectivenessService.ts`
**Purpose**: Calculate government effectiveness based on atomic component composition

**Key Features**:
- 30+ component effectiveness mappings
- Synergy detection (multiplicative bonuses)
- Conflict detection (penalties)
- Tax impact calculations
- Economic policy scoring
- 5-minute result caching

**Component Categories**:
- Power Distribution: Centralized, Federal, Confederate, Unitary
- Decision Process: Democratic, Autocratic, Technocratic, Consensus
- Legitimacy Sources: Electoral, Traditional, Performance, Charismatic
- Institution Types: Professional Bureaucracy, Military, Judiciary
- Control Mechanisms: Rule of Law, Surveillance, Economic Incentives

**Usage**:

```typescript
import { getAtomicEffectivenessService } from '~/services/AtomicEffectivenessService';

const service = getAtomicEffectivenessService(db);

// Calculate effectiveness
const effectiveness = await service.getCountryEffectiveness(countryId);

// Result includes:
// - overallScore: 75
// - taxEffectiveness: 85
// - economicPolicyScore: 80
// - stabilityScore: 70
// - legitimacyScore: 65
// - componentCount: 8
// - synergyBonus: 15
// - conflictPenalty: 5

// Detect synergies
const synergies = service.detectPotentialSynergies([
  ComponentType.TECHNOCRATIC_PROCESS,
  ComponentType.PROFESSIONAL_BUREAUCRACY,
  ComponentType.PERFORMANCE_LEGITIMACY
]);

// Synergy example:
// {
//   components: [TECHNOCRATIC_PROCESS, PROFESSIONAL_BUREAUCRACY, PERFORMANCE_LEGITIMACY],
//   synergyType: 'MULTIPLICATIVE',
//   effectMultiplier: 1.5,
//   description: 'Technocratic Efficiency State: Expert-driven governance with professional implementation'
// }
```

**Synergy Examples**:

```typescript
// Democratic Institutional State
[DEMOCRATIC_PROCESS, INDEPENDENT_JUDICIARY, RULE_OF_LAW]
// → 40% effectiveness bonus

// Authoritarian Control State
[CENTRALIZED_POWER, AUTOCRATIC_PROCESS, SURVEILLANCE_SYSTEM]
// → 60% effectiveness bonus (but legitimacy penalty)

// Expert Administration
[PROFESSIONAL_BUREAUCRACY, TECHNOCRATIC_AGENCIES]
// → 25% effectiveness bonus
```

**Integration Points**:
- Government Builder (component selection)
- MyCountry Dashboard (effectiveness display)
- Intelligence System (governance alerts)
- tRPC router: `government.getAtomicEffectiveness`

---

### Policy Services

#### 11. PolicyEffectService

**Location**: `src/services/PolicyEffectService.ts`
**Purpose**: Calculate effects of policy changes on country metrics

**Policy Types**:
- Tax policy changes
- Spending allocation shifts
- Economic reforms
- Diplomatic initiatives
- Social programs

---

### Server Services

#### 12. builderIntegrationService

**Location**: `src/server/services/builderIntegrationService.ts`
**Purpose**: Sync Government and Tax Builder data to database tables

**Key Features**:
- Intelligent field mapping (100+ mappings)
- Conflict detection with warnings
- Cross-table synchronization
- Atomic transactions
- Rollback support

**Government Field Mappings**:
```typescript
// GovernmentStructure table
structure.governmentName → GovernmentStructure.governmentName
structure.governmentType → GovernmentStructure.governmentType
structure.headOfState → GovernmentStructure.headOfState
structure.totalBudget → GovernmentStructure.totalBudget

// Cross-table mappings
structure.governmentType → Country.governmentType (requires confirmation)
structure.headOfState → Country.leader (requires confirmation)
structure.totalBudget → GovernmentBudget.totalBudget
departments → GovernmentDepartment.*
budgetAllocations → BudgetAllocation.*
revenueSources → RevenueSource.*
```

**Tax Field Mappings**:
```typescript
// TaxSystem table
taxSystem.taxSystemName → TaxSystem.taxSystemName
taxSystem.baseRate → TaxSystem.baseRate
taxSystem.progressiveTax → TaxSystem.progressiveTax

// Cross-table mappings
categories (Income Tax) → FiscalSystem.personalIncomeTaxRates
categories (Corporate Tax) → FiscalSystem.corporateTaxRates
categories (Sales Tax) → FiscalSystem.salesTaxRate
categories → TaxCategory.*
brackets → TaxBracket.*
exemptions → TaxExemption.*
```

**Usage**:

```typescript
import { syncGovernmentData, detectGovernmentConflicts } from '~/server/services/builderIntegrationService';

// Detect conflicts before saving
const warnings = await detectGovernmentConflicts(db, countryId, governmentData);

// warnings include:
// [
//   {
//     field: 'Government Type',
//     currentValue: 'Presidential Republic',
//     newValue: 'Parliamentary Democracy',
//     affectedSystems: ['GovernmentStructure', 'Country'],
//     severity: 'warning',
//     message: 'Changing government type will update your country profile.'
//   }
// ]

// Sync data to database
const result = await syncGovernmentData(db, countryId, governmentData);

// result.success: true/false
// result.warnings: ConflictWarning[]
// result.affectedTables: ['Country', 'GovernmentStructure', 'GovernmentBudget']
// result.syncedFields: ['Country.governmentType', 'Country.leader', ...]
```

**Conflict Detection**:
- Government type changes
- Head of state changes
- Total budget changes >10%
- Department deletions
- Budget allocation >100% or <100%
- Parent department self-cycles
- Revenue vs budget mismatches
- Tax structure changes (progressive ↔ flat)

---

#### 13. wiki-cache-refresh & wiki-preload

**Location**: `src/server/services/wiki-cache-refresh.ts`, `wiki-preload.ts`
**Purpose**: Manage IxWiki data caching for performance

**Features**:
- Background refresh of wiki data
- Pre-loading popular pages
- Cache invalidation strategies
- Fallback to live API on cache miss

---

#### 14. optimized-query-service

**Location**: `src/server/services/optimized-query-service.ts`
**Purpose**: Optimize complex database queries

**Optimizations**:
- Query result caching
- Selective field loading
- Batch query execution
- Index hint usage

---

## Creating a New Service

### Step 1: Define Service Interface

```typescript
// src/services/MyService.ts

/**
 * MyService - Brief description of what this service does
 *
 * Key features:
 * - Feature 1
 * - Feature 2
 * - Feature 3
 */

// Types
export interface MyServiceConfig {
  cacheEnabled: boolean;
  cacheTTL: number;
  maxRetries: number;
}

export interface MyServiceResult {
  success: boolean;
  data: any;
  metadata: {
    processingTime: number;
    cached: boolean;
  };
}

// Default configuration
const DEFAULT_CONFIG: MyServiceConfig = {
  cacheEnabled: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxRetries: 3,
};
```

### Step 2: Implement Service Class

```typescript
export class MyService {
  private config: MyServiceConfig;
  private cache = new Map<string, { data: any; timestamp: number }>();

  constructor(config: Partial<MyServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[MyService] Initialized with config:', this.config);
  }

  /**
   * Main service method
   */
  async process(input: string): Promise<MyServiceResult> {
    const startTime = Date.now();

    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache(input);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            processingTime: Date.now() - startTime,
            cached: true,
          },
        };
      }
    }

    // Process data
    const result = await this.doProcessing(input);

    // Cache result
    if (this.config.cacheEnabled) {
      this.setInCache(input, result);
    }

    return {
      success: true,
      data: result,
      metadata: {
        processingTime: Date.now() - startTime,
        cached: false,
      },
    };
  }

  private async doProcessing(input: string): Promise<any> {
    // Actual processing logic
    return { processed: input };
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.config.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setInCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

### Step 3: Export Singleton

```typescript
let serviceInstance: MyService | null = null;

export function getMyService(config?: Partial<MyServiceConfig>): MyService {
  if (!serviceInstance) {
    serviceInstance = new MyService(config);
  }
  return serviceInstance;
}

export default MyService;
```

### Step 4: Add Unit Tests

```typescript
// src/services/__tests__/MyService.test.ts

import { MyService, getMyService } from '../MyService';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService({ cacheEnabled: false });
  });

  afterEach(() => {
    service.clearCache();
  });

  it('should process input correctly', async () => {
    const result = await service.process('test');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ processed: 'test' });
    expect(result.metadata.cached).toBe(false);
  });

  it('should return cached results when enabled', async () => {
    const cachedService = new MyService({ cacheEnabled: true });

    const result1 = await cachedService.process('test');
    const result2 = await cachedService.process('test');

    expect(result1.metadata.cached).toBe(false);
    expect(result2.metadata.cached).toBe(true);
    expect(result2.metadata.processingTime).toBeLessThan(result1.metadata.processingTime);
  });

  it('should use singleton pattern', () => {
    const instance1 = getMyService();
    const instance2 = getMyService();

    expect(instance1).toBe(instance2);
  });
});
```

### Step 5: Integrate with tRPC

```typescript
// src/server/api/routers/myFeature.ts

import { createTRPCRouter, protectedProcedure } from '../trpc';
import { getMyService } from '~/services/MyService';

export const myFeatureRouter = createTRPCRouter({
  processData: protectedProcedure
    .input(z.object({ data: z.string() }))
    .query(async ({ input }) => {
      const service = getMyService();
      return await service.process(input.data);
    }),
});
```

### Step 6: Use in Component

```typescript
// src/app/myfeature/page.tsx

import { api } from '~/lib/trpc';

export default function MyFeaturePage() {
  const { data, isLoading } = api.myFeature.processData.useQuery({
    data: 'test'
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <h1>Result: {data?.data.processed}</h1>
      <p>Processing time: {data?.metadata.processingTime}ms</p>
    </div>
  );
}
```

---

## Service Integration

### Integration with tRPC Routers

Services are consumed by tRPC routers to provide API endpoints.

```typescript
// Pattern: Service → Router → Hook → Component

// 1. Service provides business logic
export class EconomicService {
  calculateGDP(country: Country): number {
    return country.population * country.gdpPerCapita;
  }
}

// 2. Router exposes service via tRPC
export const economicsRouter = createTRPCRouter({
  calculateGDP: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId }
      });

      const service = new EconomicService();
      return service.calculateGDP(country);
    }),
});

// 3. Hook wraps tRPC call
export function useGDPCalculation(countryId: string) {
  return api.economics.calculateGDP.useQuery({ countryId });
}

// 4. Component uses hook
export function GDPDisplay({ countryId }: { countryId: string }) {
  const { data: gdp, isLoading } = useGDPCalculation(countryId);

  if (isLoading) return <Spinner />;
  return <div>GDP: ${gdp?.toLocaleString()}</div>;
}
```

### Cross-Service Communication

Services can call other services for complex operations.

```typescript
export class NotificationOrchestrator {
  private contextEngine = getContextIntelligenceEngine();

  async createNotification(notification: UnifiedNotification, context: NotificationContext) {
    // Use context engine to analyze user state
    const analysis = await this.contextEngine.analyzeContext(
      notification,
      context,
      userPreferences
    );

    // Use analysis results for delivery decisions
    if (analysis.suppressionRecommendation.shouldSuppress) {
      return;
    }

    notification.deliveryMethod = analysis.recommendedDeliveryMethod;

    // Continue processing...
  }
}
```

### Service Dependency Injection

Server services receive dependencies via constructor.

```typescript
// Server service with injected dependencies
export class AtomicEffectivenessService {
  constructor(private db: PrismaClient) {}

  async calculateEffectiveness(countryId: string) {
    const components = await this.db.governmentComponent.findMany({
      where: { countryId, isActive: true }
    });

    // Calculate effectiveness...
  }
}

// Factory function handles injection
export function getAtomicEffectivenessService(db: PrismaClient): AtomicEffectivenessService {
  if (!atomicEffectivenessService) {
    atomicEffectivenessService = new AtomicEffectivenessService(db);
  }
  return atomicEffectivenessService;
}

// Usage in tRPC router
export const governmentRouter = createTRPCRouter({
  getEffectiveness: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = getAtomicEffectivenessService(ctx.db);
      return await service.getCountryEffectiveness(input.countryId);
    }),
});
```

---

## Performance Considerations

### Caching Strategies

**1. In-Memory Cache**

```typescript
export class MyService {
  private cache = new Map<string, CachedData>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getData(key: string): Promise<Data> {
    // Check cache
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Fetch fresh data
    const data = await this.fetchData(key);
    this.cache.set(key, { data, timestamp: Date.now() });

    return data;
  }
}
```

**2. LRU Cache for Large Datasets**

```typescript
import LRU from 'lru-cache';

export class LargeDataService {
  private cache = new LRU<string, Data>({
    max: 500, // Maximum 500 items
    ttl: 1000 * 60 * 5, // 5 minute TTL
    updateAgeOnGet: true,
  });

  async getData(key: string): Promise<Data> {
    const cached = this.cache.get(key);
    if (cached) return cached;

    const data = await this.fetchData(key);
    this.cache.set(key, data);

    return data;
  }
}
```

### Debouncing and Throttling

```typescript
export class NotificationOrchestrator {
  private processingQueue: QueueItem[] = [];
  private isProcessing = false;

  // Debounced queue processing
  private startProcessing() {
    const processNext = async () => {
      if (this.isProcessing || this.processingQueue.length === 0) {
        setTimeout(processNext, 100); // Check every 100ms
        return;
      }

      this.isProcessing = true;
      const item = this.processingQueue.shift();

      if (item) {
        await this.processNotification(item);
      }

      this.isProcessing = false;
      setTimeout(processNext, 50); // Process next in 50ms
    };

    processNext();
  }
}
```

### Batching Operations

```typescript
export class BatchService {
  private pendingOperations: Operation[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  addOperation(operation: Operation) {
    this.pendingOperations.push(operation);

    // Batch operations after 100ms of inactivity
    if (this.batchTimer) clearTimeout(this.batchTimer);

    this.batchTimer = setTimeout(() => {
      this.executeBatch();
    }, 100);
  }

  private async executeBatch() {
    const operations = [...this.pendingOperations];
    this.pendingOperations = [];

    // Execute all operations in single database transaction
    await db.$transaction(
      operations.map(op => db[op.table][op.operation](op.data))
    );
  }
}
```

### Lazy Loading

```typescript
export class HeavyService {
  private expensiveData: ExpensiveData | null = null;

  async getExpensiveData(): Promise<ExpensiveData> {
    // Only load once when first requested
    if (!this.expensiveData) {
      console.log('[HeavyService] Loading expensive data...');
      this.expensiveData = await this.loadExpensiveData();
    }

    return this.expensiveData;
  }

  private async loadExpensiveData(): Promise<ExpensiveData> {
    // Expensive operation
    const data = await fetchLargeDataset();
    return processLargeDataset(data);
  }
}
```

---

## Testing Services

### Unit Testing

```typescript
// src/services/__tests__/AtomicEffectivenessService.test.ts

import { AtomicEffectivenessService } from '../AtomicEffectivenessService';
import { ComponentType } from '@prisma/client';

describe('AtomicEffectivenessService', () => {
  let service: AtomicEffectivenessService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      governmentComponent: {
        findMany: jest.fn(),
      },
      componentSynergy: {
        findMany: jest.fn(),
      },
      atomicEffectiveness: {
        upsert: jest.fn(),
      },
    };

    service = new AtomicEffectivenessService(mockDb);
  });

  it('should calculate base effectiveness correctly', async () => {
    mockDb.governmentComponent.findMany.mockResolvedValue([
      { componentType: ComponentType.TECHNOCRATIC_PROCESS },
      { componentType: ComponentType.PROFESSIONAL_BUREAUCRACY },
    ]);

    mockDb.componentSynergy.findMany.mockResolvedValue([]);

    const result = await service.calculateEffectiveness('country-1');

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.componentCount).toBe(2);
  });

  it('should detect synergies', () => {
    const synergies = service.detectPotentialSynergies([
      ComponentType.TECHNOCRATIC_PROCESS,
      ComponentType.PROFESSIONAL_BUREAUCRACY,
      ComponentType.PERFORMANCE_LEGITIMACY,
    ]);

    expect(synergies.length).toBeGreaterThan(0);
    expect(synergies[0].synergyType).toBe('MULTIPLICATIVE');
  });

  it('should cache results', async () => {
    mockDb.governmentComponent.findMany.mockResolvedValue([]);
    mockDb.componentSynergy.findMany.mockResolvedValue([]);

    // First call
    await service.getCountryEffectiveness('country-1', true);

    // Second call (should use cache)
    await service.getCountryEffectiveness('country-1', true);

    // Database should only be called once
    expect(mockDb.governmentComponent.findMany).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Testing

```typescript
// tests/integration/services/builderIntegration.test.ts

import { syncGovernmentData } from '~/server/services/builderIntegrationService';
import { db } from '~/server/db';

describe('Builder Integration Service', () => {
  let testCountryId: string;

  beforeAll(async () => {
    // Create test country
    const country = await db.country.create({
      data: {
        name: 'Test Country',
        slug: 'test-country',
        userId: 'test-user',
      },
    });
    testCountryId = country.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.country.delete({ where: { id: testCountryId } });
  });

  it('should sync government data to multiple tables', async () => {
    const governmentData = {
      structure: {
        governmentName: 'Test Government',
        governmentType: 'Presidential Republic',
        headOfState: 'Test President',
        totalBudget: 1000000,
      },
      departments: [],
      budgetAllocations: [],
      revenueSources: [],
    };

    const result = await syncGovernmentData(db, testCountryId, governmentData);

    expect(result.success).toBe(true);
    expect(result.affectedTables).toContain('Country');
    expect(result.affectedTables).toContain('GovernmentBudget');

    // Verify data was synced
    const country = await db.country.findUnique({ where: { id: testCountryId } });
    expect(country?.governmentType).toBe('Presidential Republic');
    expect(country?.leader).toBe('Test President');
  });
});
```

### Performance Testing

```typescript
// tests/performance/services/caching.test.ts

import { performance } from 'perf_hooks';
import { AtomicEffectivenessService } from '~/services/AtomicEffectivenessService';

describe('Service Performance', () => {
  it('should benefit from caching', async () => {
    const service = new AtomicEffectivenessService(db);
    const countryId = 'test-country';

    // Warm up cache
    await service.getCountryEffectiveness(countryId, false);

    // Measure uncached performance
    const uncachedStart = performance.now();
    await service.getCountryEffectiveness(countryId, false);
    const uncachedTime = performance.now() - uncachedStart;

    // Measure cached performance
    const cachedStart = performance.now();
    await service.getCountryEffectiveness(countryId, true);
    const cachedTime = performance.now() - cachedStart;

    // Cached should be significantly faster
    expect(cachedTime).toBeLessThan(uncachedTime * 0.1);
  });
});
```

---

## Best Practices

### 1. Error Handling

Always handle errors gracefully with proper logging.

```typescript
export class MyService {
  async process(input: string): Promise<ServiceResult> {
    try {
      const result = await this.doProcessing(input);
      return { success: true, data: result };
    } catch (error) {
      console.error('[MyService] Processing failed:', error);

      // Log to monitoring service
      if (error instanceof Error) {
        this.logError({
          service: 'MyService',
          method: 'process',
          error: error.message,
          stack: error.stack,
        });
      }

      return {
        success: false,
        error: 'Processing failed. Please try again.',
      };
    }
  }
}
```

### 2. Type Safety

Use strict TypeScript types for all service interfaces.

```typescript
// ✅ Good: Strict types
export interface ServiceConfig {
  enabled: boolean;
  timeout: number;
  retries: number;
}

export class MyService {
  constructor(private config: ServiceConfig) {}

  async execute(input: string): Promise<ServiceResult> {
    // Implementation
  }
}

// ❌ Bad: Loose types
export class MyService {
  constructor(private config: any) {}

  async execute(input: any): Promise<any> {
    // Implementation
  }
}
```

### 3. Documentation

Document all public methods with JSDoc.

```typescript
/**
 * Calculate country effectiveness based on atomic component composition
 *
 * @param countryId - The ID of the country to calculate effectiveness for
 * @param useCache - Whether to use cached results (default: true)
 * @returns AtomicEffectiveness object with scores and metadata
 *
 * @example
 * ```typescript
 * const service = getAtomicEffectivenessService(db);
 * const effectiveness = await service.getCountryEffectiveness('country-123');
 * console.log('Overall score:', effectiveness.overallScore);
 * ```
 */
async getCountryEffectiveness(
  countryId: string,
  useCache: boolean = true
): Promise<AtomicEffectiveness> {
  // Implementation
}
```

### 4. Logging

Use consistent logging patterns for debugging.

```typescript
export class MyService {
  constructor() {
    console.log('[MyService] Initialized');
  }

  async process(input: string) {
    console.log('[MyService] Processing input:', input);

    const result = await this.doWork(input);

    console.log('[MyService] Processing complete:', result);
    return result;
  }
}
```

### 5. Configuration

Externalize configuration with sensible defaults.

```typescript
export interface ServiceConfig {
  cacheEnabled: boolean;
  cacheTTL: number;
  maxRetries: number;
  timeout: number;
}

const DEFAULT_CONFIG: ServiceConfig = {
  cacheEnabled: true,
  cacheTTL: 5 * 60 * 1000,
  maxRetries: 3,
  timeout: 30000,
};

export class MyService {
  private config: ServiceConfig;

  constructor(config: Partial<ServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
}
```

### 6. Separation of Concerns

Keep services focused on single responsibilities.

```typescript
// ✅ Good: Focused service
export class TaxCalculationService {
  calculateIncomeTax(income: number, brackets: TaxBracket[]): number {
    // Tax calculation logic only
  }
}

// ❌ Bad: Mixed responsibilities
export class TaxService {
  calculateIncomeTax(income: number): number { /* ... */ }
  saveTaxReturn(data: TaxReturn): Promise<void> { /* ... */ }
  generatePDF(taxReturn: TaxReturn): Buffer { /* ... */ }
  sendEmail(recipient: string, pdf: Buffer): Promise<void> { /* ... */ }
}
```

### 7. Testability

Design services to be easily testable.

```typescript
// ✅ Good: Dependency injection
export class NotificationService {
  constructor(
    private emailProvider: EmailProvider,
    private db: PrismaClient
  ) {}

  async send(notification: Notification) {
    // Implementation
  }
}

// Easy to test with mocks
const mockEmailProvider = { send: jest.fn() };
const mockDb = { notification: { create: jest.fn() } };
const service = new NotificationService(mockEmailProvider, mockDb);

// ❌ Bad: Hard-coded dependencies
export class NotificationService {
  async send(notification: Notification) {
    await sendgrid.send(notification.email);
    await prisma.notification.create({ data: notification });
  }
}
```

---

## Related Documentation

- [CODE_STANDARDS.md](../docs/CODE_STANDARDS.md) - Coding standards and conventions
- [BUILDER_SYSTEM.md](../docs/BUILDER_SYSTEM.md) - Builder system integration
- [INTELLIGENCE_SYSTEM.md](../docs/INTELLIGENCE_SYSTEM.md) - Intelligence system architecture
- [API_REFERENCE.md](../docs/API_REFERENCE.md) - tRPC API documentation
- [TESTING_GUIDE.md](../docs/TESTING_GUIDE.md) - Testing strategies

---

**Version:** 1.1.0
**Maintained by:** IxStats Development Team
**Last Updated:** October 2025
