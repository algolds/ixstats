# IxStats API Reference

**Version**: 1.1.1
**Last Updated**: October 17, 2025
**Architecture**: tRPC v11 with Next.js App Router

## Overview

IxStats exposes **304 type-safe API endpoints** across **36 tRPC routers**. All endpoints use tRPC for end-to-end type safety between client and server.

### Base URL
- **Development**: `http://localhost:3000/api/trpc`
- **Production**: `https://ixwiki.com/projects/ixstats/api/trpc`

### Authentication
Most endpoints require Clerk authentication. Procedures are protected with:
- `publicProcedure` - No authentication required
- `protectedProcedure` - Requires logged-in user
- `adminProcedure` - Requires admin role
- `premiumProcedure` - Requires premium tier
- `countryOwnerProcedure` - Requires country ownership
- `executiveProcedure` - Requires executive-level access

### Rate Limiting
- **Standard**: 100 requests/minute
- **Search**: 30 requests/minute
- **Messaging**: 60 requests/minute
- **Admin**: 200 requests/minute

---

## Router Index

| Router | Endpoints | Purpose | Authentication |
|--------|-----------|---------|----------------|
| [achievements](#achievements-router) | 15 | Achievement system | Protected |
| [activities](#activities-router) | 8 | Live activity feed | Protected |
| [admin](#admin-router) | 24 | System administration | Admin |
| [archetypes](#archetypes-router) | 8 | Country archetypes | Public |
| [atomicEconomic](#atomic-economic-router) | 10 | Atomic economic components | Protected |
| [atomicGovernment](#atomic-government-router) | 12 | Atomic government components | Protected |
| [atomicTax](#atomic-tax-router) | 8 | Atomic tax components | Protected |
| [countries](#countries-router) | 32 | Country management | Mixed |
| [customTypes](#custom-types-router) | 6 | Custom government types | Protected |
| [diplomatic](#diplomatic-router) | 28 | Diplomatic relations | Protected |
| [diplomaticIntelligence](#diplomatic-intelligence-router) | 16 | Diplomatic intelligence | Protected |
| [economics](#economics-router) | 18 | Economic data | Protected |
| [enhancedEconomics](#enhanced-economics-router) | 6 | Advanced economic indices | Protected |
| [formulas](#formulas-router) | 4 | Economic formulas | Public |
| [government](#government-router) | 14 | Government structures | Protected |
| [intelligence](#intelligence-router) | 12 | Intelligence system | Protected |
| [intelligenceBriefing](#intelligence-briefing-router) | 10 | Stored intelligence briefings | Protected |
| [meetings](#meetings-router) | 12 | Cabinet meetings | Protected |
| [mycountry](#mycountry-router) | 10 | MyCountry dashboard | Country Owner |
| [notifications](#notifications-router) | 18 | Notification system | Protected |
| [policies](#policies-router) | 8 | Policy management | Protected |
| [quickActions](#quick-actions-router) | 14 | Quick action system | Protected |
| [roles](#roles-router) | 8 | Role management | Admin |
| [scheduledChanges](#scheduled-changes-router) | 6 | Delayed impact system | Protected |
| [security](#security-router) | 22 | Defense & security | Protected |
| [taxSystem](#tax-system-router) | 16 | Tax configuration | Protected |
| [thinkpages](#thinkpages-router) | 54 | Social platform | Protected |
| [unifiedAtomic](#unified-atomic-router) | 12 | Cross-builder components | Protected |
| [unifiedIntelligence](#unified-intelligence-router) | 26 | Unified intelligence system | Protected |
| [userLogging](#user-logging-router) | 6 | Activity logging | Protected |
| [users](#users-router) | 10 | User management | Protected |
| [wikiCache](#wiki-cache-router) | 8 | Wiki cache management | Admin |
| [wikiImporter](#wiki-importer-router) | 5 | Wiki data import | Protected |

**Total**: 304 endpoints across 36 routers (33 active + 3 system routers)

> **Note**: The `system` router is an alias for `admin` router and provides the same endpoints.

### Deprecated Routers

The following routers are **deprecated** and will be removed in v2.0.0. Please migrate to the unified intelligence router:

| Router | Status | Replacement | Migration Deadline |
|--------|--------|-------------|-------------------|
| **eci** | 🔴 **DEPRECATED** | `unifiedIntelligence` | v2.0.0 (Q2 2026) |
| **sdi** | 🔴 **DEPRECATED** | `unifiedIntelligence` | v2.0.0 (Q2 2026) |

> **⚠️ WARNING**: Do not use deprecated routers in new code. All functionality has been migrated to `unifiedIntelligence` router with improved performance and better organization.

**Migration Guide:**
- Replace all `api.eci.*` calls with `api.unifiedIntelligence.*`
- Replace all `api.sdi.*` calls with `api.unifiedIntelligence.*`
- The unified intelligence router provides all ECI/SDI functionality with improved performance
- See [Unified Intelligence Router](#unified-intelligence-router) section below for endpoint mapping

---

## Achievements Router

**Purpose**: Manage achievements, milestones, and badges

### Queries

#### `getAchievements`
Get all achievements for a country.

**Input**:
```typescript
{
  countryId: string
}
```

**Output**:
```typescript
{
  id: string;
  countryId: string;
  achievementType: string;
  title: string;
  description: string;
  unlockedAt: Date;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}[]
```

**Protection**: `protectedProcedure`

#### `getMilestones`
Get country milestones and progress.

**Input**:
```typescript
{
  countryId: string;
  category?: string;
}
```

**Output**:
```typescript
{
  id: string;
  name: string;
  description: string;
  progress: number;  // 0-100
  completed: boolean;
  completedAt?: Date;
  reward?: string;
}[]
```

**Protection**: `protectedProcedure`

#### `getRankings`
Get country rankings across various metrics.

**Input**:
```typescript
{
  countryId: string;
  metricType?: 'economic' | 'military' | 'diplomatic' | 'overall';
}
```

**Output**:
```typescript
{
  metric: string;
  rank: number;
  totalCountries: number;
  percentile: number;
  value: number;
  change: number;  // Change from last update
}[]
```

**Protection**: `publicProcedure`

### Mutations

#### `unlockAchievement`
Manually unlock an achievement (admin only).

**Input**:
```typescript
{
  countryId: string;
  achievementType: string;
}
```

**Output**:
```typescript
{
  id: string;
  success: boolean;
  message: string;
}
```

**Protection**: `adminProcedure`

---

## Admin Router

**Purpose**: System administration and god-mode operations

### Critical Endpoints

#### `getSystemStatus`
Get comprehensive system health.

**Input**: None

**Output**:
```typescript
{
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;  // seconds
  database: {
    connected: boolean;
    latency: number;  // ms
  };
  redis: {
    connected: boolean;
    memoryUsage: number;  // MB
  };
  clerk: {
    connected: boolean;
  };
  ixtime: {
    connected: boolean;
    currentIxTime: string;
  };
  metrics: {
    activeUsers: number;
    totalCountries: number;
    requestsPerMinute: number;
  };
}
```

**Protection**: `adminProcedure`

#### `executeGodModeAction`
Execute privileged system actions.

**Input**:
```typescript
{
  action: 'adjust_economy' | 'grant_achievement' | 'modify_country' | 'send_notification';
  targetId: string;
  parameters: Record<string, any>;
  reason: string;  // Audit trail
}
```

**Output**:
```typescript
{
  success: boolean;
  message: string;
  auditId: string;
}
```

**Protection**: `adminProcedure` + audit logging

---

## Countries Router

**Purpose**: Country creation, retrieval, and management

### Queries

#### `getAll`
Get all countries with optional filters.

**Input**:
```typescript
{
  tier?: string;
  continent?: string;
  limit?: number;
  offset?: number;
}
```

**Output**:
```typescript
{
  id: string;
  name: string;
  slug: string;
  flag?: string;
  economicTier: string;
  populationTier: string;
  currentGdpPerCapita: number;
  currentPopulation: number;
  overallNationalHealth: number;
}[]
```

**Protection**: `publicProcedure`

#### `getByIdWithEconomicData`
Get complete country data with all economic profiles.

**Input**:
```typescript
{
  id: string;
}
```

**Output**:
```typescript
{
  ...Country;
  demographics: Demographics;
  economicProfile: EconomicProfile;
  laborMarket: LaborMarket;
  fiscalSystem: FiscalSystem;
  governmentBudget: GovernmentBudget;
  incomeDistribution: IncomeDistribution;
  nationalIdentity: NationalIdentity;
  governmentComponents: GovernmentComponent[];
  historicalData: HistoricalDataPoint[];
}
```

**Protection**: `publicProcedure`

### Mutations

#### `createCountry`
Create a new country (atomic transaction).

**Input**:
```typescript
{
  name: string;
  foundationCountry?: string;  // For template-based creation
  economicInputs: {
    nationalIdentity: {...};
    geography: {...};
    coreIndicators: {...};
    laborEmployment: {...};
    fiscalSystem: {...};
    demographics: {...};
    incomeWealth: {...};
    governmentSpending: {...};
  };
  governmentComponents?: ComponentType[];
  taxSystemData?: TaxBuilderState;
  governmentStructure?: GovernmentBuilderState;
}
```

**Output**:
```typescript
{
  id: string;
  slug: string;
  success: boolean;
  message: string;
}
```

**Protection**: `protectedProcedure` + one country per user limit

**Transaction**: Creates 13+ related records atomically

---

## ThinkPages Router

**Purpose**: Social platform (Feed, ThinkTanks, ThinkShare)

### ThinkPages Feed (22 endpoints)

#### `createPost`
Create a new post from a ThinkPages account.

**Input**:
```typescript
{
  accountId: string;
  content: string;  // max 280 characters
  hashtags?: string[];
  visualizations?: {
    type: 'chart' | 'map' | 'infographic';
    data: any;
  }[];
  parentPostId?: string;  // For replies
  visibility: 'public' | 'followers' | 'mentioned';
}
```

**Output**:
```typescript
{
  id: string;
  accountId: string;
  content: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  impressions: number;
  ixTimeTimestamp: Date;
  account: ThinkpagesAccount;
}
```

**Protection**: `protectedProcedure`

**Rate Limit**: 60 posts/hour

#### `getFeed`
Get personalized feed with filters.

**Input**:
```typescript
{
  filter: 'recent' | 'trending' | 'hot';
  limit?: number;  // default 50
  cursor?: string;  // Pagination
  hashtag?: string;
}
```

**Output**:
```typescript
{
  posts: ThinkpagesPost[];
  nextCursor?: string;
  hasMore: boolean;
}
```

**Protection**: `publicProcedure`

### ThinkTanks (16 endpoints)

#### `createThinktank`
Create a new group/community.

**Input**:
```typescript
{
  name: string;
  description?: string;
  type: 'public' | 'private' | 'invite_only';
  category?: string;
  tags?: string[];
}
```

**Output**:
```typescript
{
  id: string;
  name: string;
  type: string;
  memberCount: number;
  createdBy: string;
}
```

**Protection**: `protectedProcedure`

**Limit**: 10 groups per user as owner

### ThinkShare (12 endpoints)

#### `sendMessage`
Send a direct message.

**Input**:
```typescript
{
  conversationId: string;
  content: string;
  replyToId?: string;
  attachments?: {
    type: 'image' | 'file';
    url: string;
    name: string;
  }[];
}
```

**Output**:
```typescript
{
  id: string;
  conversationId: string;
  content: string;
  ixTimeTimestamp: Date;
  userId: string;
}
```

**Protection**: `protectedProcedure`

**Rate Limit**: 60 messages/minute

---

## Intelligence Router

**Purpose**: AI-powered intelligence and analytics

### Queries

#### `getIntelligenceFeed`
Get real-time intelligence briefings.

**Input**:
```typescript
{
  countryId: string;
  category?: 'economic' | 'diplomatic' | 'security' | 'all';
  limit?: number;
}
```

**Output**:
```typescript
{
  id: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  insights: string[];
  recommendations: string[];
  confidence: number;  // 0-100
  generatedAt: Date;
}[]
```

**Protection**: `countryOwnerProcedure`

#### `getVitalityScores`
Get current vitality metrics.

**Input**:
```typescript
{
  countryId: string;
}
```

**Output**:
```typescript
{
  economicVitality: number;  // 0-100
  populationWellbeing: number;  // 0-100
  diplomaticStanding: number;  // 0-100
  governmentalEfficiency: number;  // 0-100
  overallNationalHealth: number;  // 0-100
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: Date;
}
```

**Protection**: `publicProcedure`

---

## Formulas Router

**Purpose**: Economic calculation formulas and metadata

### Queries

#### `getGdpGrowthFormula`
Get GDP growth calculation metadata.

**Input**: None

**Output**:
```typescript
{
  formula: string;  // Mathematical notation
  description: string;
  inputs: {
    name: string;
    type: string;
    description: string;
  }[];
  outputs: {
    name: string;
    type: string;
    description: string;
  }[];
  constants: {
    GLOBAL_GROWTH_FACTOR: 1.0321;
    tierModifiers: Record<string, number>;
  };
}
```

**Protection**: `publicProcedure`

#### `calculateProjectedGdp`
Calculate future GDP projections.

**Input**:
```typescript
{
  countryId: string;
  years: number;  // 1-50
  adjustments?: {
    growthRateModifier?: number;
    populationModifier?: number;
  };
}
```

**Output**:
```typescript
{
  projections: {
    year: number;
    gdpPerCapita: number;
    totalGdp: number;
    population: number;
    tier: string;
  }[];
  confidence: number;
  assumptions: string[];
}
```

**Protection**: `publicProcedure`

---

## Tax System Router

**Purpose**: Tax system configuration and calculations

### Queries

#### `getTaxSystem`
Get complete tax system for a country.

**Input**:
```typescript
{
  countryId: string;
}
```

**Output**:
```typescript
{
  id: string;
  countryId: string;
  systemName: string;
  totalRevenue: number;
  effectivenessScore: number;
  categories: TaxCategory[];
}
```

**Protection**: `publicProcedure`

### Mutations

#### `createTaxSystem`
Create or update tax system configuration.

**Input**:
```typescript
{
  countryId: string;
  systemName: string;
  categories: {
    name: string;
    baseRate: number;
    brackets?: {
      min: number;
      max: number;
      rate: number;
    }[];
  }[];
}
```

**Output**:
```typescript
{
  id: string;
  success: boolean;
  projectedRevenue: number;
  effectivenessScore: number;
}
```

**Protection**: `countryOwnerProcedure`

---

## Unified Intelligence Router

**Purpose**: Unified intelligence system combining ECI and SDI functionality

### Overview

The Unified Intelligence Router consolidates all executive command (ECI) and strategic development (SDI) operations into a single, efficient router. This router provides:

- **Executive Operations**: All ECI cabinet meetings, policy management, and quick actions
- **Strategic Intelligence**: All SDI intelligence feeds, crisis management, and economic indicators
- **Unified Analytics**: Combined dashboard with cross-system metrics
- **Improved Performance**: Single router reduces overhead and improves response times

### Migration from ECI/SDI

| Old Endpoint | New Endpoint | Status |
|-------------|--------------|--------|
| `api.eci.getCabinetMeetings` | `api.unifiedIntelligence.getExecutiveOperations` | ✅ Available |
| `api.eci.createEconomicPolicy` | `api.unifiedIntelligence.createPolicy` | ✅ Available |
| `api.sdi.getIntelligenceFeed` | `api.unifiedIntelligence.getIntelligenceFeed` | ✅ Available |
| `api.sdi.getCrisisEvents` | `api.unifiedIntelligence.getCrisisEvents` | ✅ Available |
| `api.sdi.getEconomicIndicators` | `api.unifiedIntelligence.getEconomicIndicators` | ✅ Available |

### Key Endpoints

#### `getUnifiedDashboard`
Get comprehensive intelligence dashboard combining ECI and SDI metrics.

**Input**:
```typescript
{
  userId: string;
  countryId?: string;
}
```

**Output**:
```typescript
{
  executiveSummary: ExecutiveSummary;
  intelligenceFeed: IntelligenceItem[];
  activeCrises: CrisisEvent[];
  economicIndicators: EconomicIndicator;
  vitalityScores: VitalityScores;
}
```

**Protection**: `protectedProcedure`

#### `getIntelligenceFeed`
Unified intelligence feed with filtering and pagination.

**Input**:
```typescript
{
  category?: 'economic' | 'crisis' | 'diplomatic' | 'security' | 'all';
  priority?: 'critical' | 'high' | 'medium' | 'low' | 'all';
  limit?: number;
  offset?: number;
}
```

**Output**:
```typescript
{
  data: IntelligenceItem[];
  total: number;
  page: number;
  hasNext: boolean;
}
```

**Protection**: `protectedProcedure`

For complete unified intelligence router documentation, see `/src/server/api/routers/unified-intelligence.ts`

---

## Error Handling

### Standard Error Format
```typescript
{
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'INTERNAL_SERVER_ERROR';
  message: string;
  path: string;
  timestamp: string;
}
```

### Common Error Codes
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `BAD_REQUEST`: Invalid input data
- `CONFLICT`: Resource conflict (e.g., duplicate country name)
- `TOO_MANY_REQUESTS`: Rate limit exceeded
- `INTERNAL_SERVER_ERROR`: Server error

---

## Examples

### Client Usage (React)

```typescript
import { api } from "~/trpc/react";

function MyCountry() {
  const { data: country } = api.countries.getByIdWithEconomicData.useQuery({
    id: "country_123"
  });

  const createPost = api.thinkpages.createPost.useMutation();

  const handlePost = async () => {
    await createPost.mutateAsync({
      accountId: "account_456",
      content: "Economic growth reaches 5.2%!",
      hashtags: ["Economy", "Growth"],
      visibility: "public"
    });
  };

  return <div>{country?.name}</div>;
}
```

### Server Usage (tRPC Router)

```typescript
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { z } from "zod";

export const myRouter = createTRPCRouter({
  getData: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.country.findUnique({
        where: { id: input.id }
      });
    }),
});
```

---

## API Versioning

Current API version: **v1**

### Breaking Changes Policy
- Major version changes (v1 → v2) may include breaking changes
- Deprecated endpoints will be supported for 6 months minimum
- Breaking changes will be announced in CHANGELOG.md

### Future API Versions
- Planned: GraphQL support (v2.0)
- Planned: WebSocket subscriptions (v1.2)
- Planned: Batch operations (v1.2)

---

## Performance

### Caching Strategy
- **Query Results**: 5-minute cache for public data
- **Country Data**: 10-minute cache
- **Intelligence**: Real-time (no cache)
- **Historical Data**: 1-hour cache

### Optimization Tips
1. Use pagination for large datasets
2. Request only needed fields
3. Leverage query caching
4. Batch related queries

---

## Support

- **Documentation**: [/docs/DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)
- **Issues**: Report bugs via GitHub issues
- **API Status**: Check `/api/health` endpoint

---

**Last Updated**: October 17, 2025
**Version**: 1.1.1
