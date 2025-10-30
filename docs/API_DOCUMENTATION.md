# IxStats API Documentation

> **Comprehensive API Reference for IxStats Platform**
> Version 1.1.3 | Last Updated: October 26, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Rate Limiting](#rate-limiting)
5. [API Routers](#api-routers)
6. [Type Definitions](#type-definitions)
7. [Usage Examples](#usage-examples)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)
10. [WebSocket Events](#websocket-events)

---

## Overview

### API Architecture

IxStats uses **tRPC** (TypeScript Remote Procedure Call) for end-to-end type-safe API communication between the Next.js frontend and backend.

**Key Features:**
- **Type Safety**: Full TypeScript inference from server to client
- **Auto-completion**: IDE support for all API calls
- **Real-time**: WebSocket support for live updates
- **Caching**: Built-in React Query integration
- **Validation**: Zod schema validation on all inputs

### Base Configuration

```typescript
// API Root: /api/trpc
// Client Setup:
import { api } from "~/utils/api";

// Query Example:
const { data } = api.countries.getAll.useQuery();

// Mutation Example:
const createPolicy = api.policies.createPolicy.useMutation();
```

### Environment Configuration

**Development:**
- Base URL: `http://localhost:3000`
- API Path: `/api/trpc`

**Production:**
- Base URL: `https://ixwiki.com/projects/ixstats`
- API Path: `/projects/ixstats/api/trpc`

---

## Architecture

### tRPC Router Structure

IxStats contains **36 routers** with **304+ endpoints** organized by feature domain:

| Router | Endpoints | Purpose |
|--------|-----------|---------|
| `countries` | 45+ | Country data and economic statistics |
| `diplomatic` | 38+ | Diplomatic relations and embassies |
| `thinkpages` | 28+ | Social platform (posts, accounts, groups) |
| `unifiedIntelligence` | 22+ | Intelligence briefings and alerts |
| `activities` | 15+ | Activity feed and trending topics |
| `government` | 18+ | Government structure and budgets |
| `policies` | 12+ | Policy management and tracking |
| `admin` | 25+ | System administration (admin only) |
| `wikiCache` | 10+ | MediaWiki integration cache |
| `atomicGovernment` | 14+ | Atomic government components |
| `atomicEconomic` | 16+ | Atomic economic components |
| `atomicTax` | 12+ | Atomic tax system components |
| `achievements` | 6 | Achievement system |
| ... | ... | *31 additional routers* |

### Procedure Types

```typescript
// Public (no authentication required)
publicProcedure

// Rate-limited public (100 req/min per IP)
rateLimitedPublicProcedure

// Protected (requires Clerk authentication)
protectedProcedure

// Executive (requires country ownership)
executiveProcedure

// Country Owner (requires country ownership)
countryOwnerProcedure

// Admin (requires admin role)
adminProcedure
```

---

## Authentication

### Clerk Integration

IxStats uses **Clerk** for authentication with role-based access control (RBAC).

**Authentication Flow:**
1. User signs in via Clerk
2. Clerk provides `userId` and session tokens
3. tRPC middleware validates session
4. User permissions checked via database

**Protected Endpoint Example:**

```typescript
// Server-side (tRPC)
protectedProcedure
  .input(z.object({ countryId: z.string() }))
  .query(async ({ ctx, input }) => {
    // ctx.auth.userId is guaranteed to exist
    // ctx.user contains User database record
    return await ctx.db.country.findUnique({
      where: { id: input.countryId }
    });
  });
```

**Client-side Usage:**

```typescript
import { useUser } from "@clerk/nextjs";
import { api } from "~/utils/api";

function MyComponent() {
  const { user, isLoaded } = useUser();

  const { data } = api.countries.getByUserId.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user } // Only run when user exists
  );
}
```

### Authorization Levels

| Level | Description | Access |
|-------|-------------|--------|
| **Public** | No authentication | Read-only endpoints |
| **Authenticated** | Clerk user session | Basic CRUD operations |
| **Country Owner** | User owns/manages country | Country-specific operations |
| **Executive** | Premium tier user | Advanced features |
| **Admin** | System administrator | Global admin operations |
| **System Owner** | Root access | God-mode operations |

---

## Rate Limiting

### Rate Limit Tiers

**Public Endpoints:**
- 100 requests/minute per IP
- 1000 requests/hour per IP

**Authenticated Endpoints:**
- 500 requests/minute per user
- 5000 requests/hour per user

**Premium Endpoints:**
- 1000 requests/minute per user
- 10,000 requests/hour per user

**Admin Endpoints:**
- No rate limits

### Rate Limit Implementation

```typescript
// Redis-based (production)
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"),
});

// In-memory fallback (development)
const { LRUCache } = require("lru-cache");
const rateLimitCache = new LRUCache({ max: 500 });
```

### Rate Limit Errors

When rate limits are exceeded:

```json
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Rate limit exceeded. Try again in 60 seconds."
  }
}
```

---

## API Routers

<details>
<summary><strong>1. Countries Router</strong> - Country data and economic statistics (45+ endpoints)</summary>

### Path: `api.countries.*`

#### Endpoints

##### `countries.getAll`
**Type:** Query (Public, Rate Limited)
**Description:** Fetch all countries with pagination and filtering

**Input:**
```typescript
{
  limit?: number;        // Default: 100, Max: 500
  offset?: number;       // Default: 0
  search?: string;       // Search by name
  continent?: string;    // Filter by continent
  economicTier?: string; // Filter by economic tier
}
```

**Output:**
```typescript
{
  countries: Country[];
  total: number;
}
```

**Usage:**
```typescript
const { data } = api.countries.getAll.useQuery({
  limit: 50,
  continent: "Sarpedon",
  economicTier: "Advanced"
});
```

---

##### `countries.getById`
**Type:** Query (Public, Rate Limited)
**Description:** Get country by ID with full relations

**Input:**
```typescript
{ id: string }
```

**Output:**
```typescript
Country & {
  economicProfile?: EconomicProfile;
  demographics?: Demographics;
  fiscalSystem?: FiscalSystem;
  governmentBudget?: GovernmentBudget;
  historicalData: HistoricalDataPoint[];
  nationalIdentity?: NationalIdentity;
}
```

**Usage:**
```typescript
const { data: country } = api.countries.getById.useQuery({
  id: "clxxxx12345"
});
```

---

##### `countries.getSelectList`
**Type:** Query (Public, Rate Limited)
**Description:** Lightweight country list for dropdowns

**Input:**
```typescript
{
  search?: string;
  limit?: number; // Default: 500
}
```

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  slug?: string;
  flagUrl?: string;
  coatOfArmsUrl?: string;
  economicTier?: string;
}>
```

**Usage:**
```typescript
const { data: countries } = api.countries.getSelectList.useQuery({
  search: "Bur"
});
```

---

##### `countries.getStats`
**Type:** Query (Public, Rate Limited)
**Description:** Get calculated statistics for a country

**Input:**
```typescript
{ id: string }
```

**Output:**
```typescript
{
  currentStats: {
    population: number;
    gdpPerCapita: number;
    totalGdp: number;
    economicTier: string;
    populationTier: string;
  };
  projections: {
    year2040Population: number;
    year2040Gdp: number;
    year2040GdpPerCapita: number;
  };
  vitalityScores: {
    economicVitality: number;       // 0-100
    populationWellbeing: number;    // 0-100
    diplomaticStanding: number;     // 0-100
    governmentalEfficiency: number; // 0-100
    overallNationalHealth: number;  // 0-100
  };
}
```

---

##### `countries.updateEconomicData`
**Type:** Mutation (Protected, Country Owner)
**Description:** Update country economic indicators

**Input:**
```typescript
{
  countryId: string;
  data: {
    nominalGDP?: number;
    realGDPGrowthRate?: number;
    inflationRate?: number;
    unemploymentRate?: number;
    taxRevenueGDPPercent?: number;
    governmentBudgetGDPPercent?: number;
    totalDebtGDPRatio?: number;
    // ... 40+ optional economic fields
  };
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
  updated: Country;
}
```

**Usage:**
```typescript
const updateEconomicData = api.countries.updateEconomicData.useMutation();

await updateEconomicData.mutateAsync({
  countryId: "clxxx",
  data: {
    nominalGDP: 1250000000000, // $1.25 trillion
    unemploymentRate: 4.2,
    inflationRate: 2.5
  }
});
```

---

##### `countries.getHistoricalData`
**Type:** Query (Public, Rate Limited)
**Description:** Get historical economic time series

**Input:**
```typescript
{
  countryId: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number; // Default: 100
}
```

**Output:**
```typescript
Array<{
  ixTimeTimestamp: Date;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationGrowthRate: number;
  gdpGrowthRate: number;
}>
```

---

##### `countries.getLeaderboard`
**Type:** Query (Public, Rate Limited)
**Description:** Get countries ranked by metric

**Input:**
```typescript
{
  metric: 'gdpTotal' | 'gdpPerCapita' | 'population' | 'economicVitality';
  limit?: number; // Default: 20
}
```

**Output:**
```typescript
Array<{
  rank: number;
  country: {
    id: string;
    name: string;
    flag?: string;
  };
  value: number;
  change: number; // Change from previous rank
}>
```

</details>

<details>
<summary><strong>2. Diplomatic Router</strong> - Diplomatic relations and embassy network (38+ endpoints)</summary>

### Path: `api.diplomatic.*`

#### Endpoints

##### `diplomatic.getRelationships`
**Type:** Query (Public, Rate Limited)
**Description:** Get all diplomatic relationships for a country

**Input:**
```typescript
{
  countryId: string;
  status?: 'active' | 'pending' | 'suspended' | 'terminated';
  relationType?: 'alliance' | 'treaty' | 'trade_agreement' | 'cultural_exchange' | 'defense_pact';
}
```

**Output:**
```typescript
Array<{
  id: string;
  fromCountry: Country;
  toCountry: Country;
  relationType: string;
  status: string;
  trustLevel: number;      // 0-100
  cooperationIndex: number; // 0-100
  establishedDate: Date;
  lastInteraction: Date;
}>
```

**Usage:**
```typescript
const { data: relationships } = api.diplomatic.getRelationships.useQuery({
  countryId: "clxxx",
  status: "active",
  relationType: "alliance"
});
```

---

##### `diplomatic.createEmbassy`
**Type:** Mutation (Protected, Country Owner)
**Description:** Establish embassy in another country

**Input:**
```typescript
{
  hostCountryId: string;
  guestCountryId: string;
  ambassadorName?: string;
  location?: string;
  staffCount?: number;
  budget?: number;
}
```

**Output:**
```typescript
{
  success: boolean;
  embassy: Embassy;
  message: string;
}
```

**Usage:**
```typescript
const createEmbassy = api.diplomatic.createEmbassy.useMutation();

await createEmbassy.mutateAsync({
  hostCountryId: "clxxx_host",
  guestCountryId: "clxxx_guest",
  ambassadorName: "Ambassador Smith",
  staffCount: 25,
  budget: 5000000
});
```

---

##### `diplomatic.getEmbassyNetwork`
**Type:** Query (Public, Rate Limited)
**Description:** Get complete embassy network for country

**Input:**
```typescript
{ countryId: string }
```

**Output:**
```typescript
{
  embassiesHosting: Embassy[];  // Embassies in this country
  embassiesGuest: Embassy[];     // This country's embassies abroad
  networkMetrics: {
    totalEmbassies: number;
    activeRelationships: number;
    diplomaticReach: number;      // 0-100
    networkEfficiency: number;    // 0-100
  };
}
```

---

##### `diplomatic.getCulturalExchanges`
**Type:** Query (Public, Rate Limited)
**Description:** Get cultural exchange programs

**Input:**
```typescript
{
  countryId: string;
  status?: 'active' | 'completed' | 'planned';
}
```

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  description: string;
  fromCountry: Country;
  toCountry: Country;
  programType: 'academic' | 'artistic' | 'athletic' | 'scientific';
  participants: number;
  budget: number;
  startDate: Date;
  endDate: Date;
  status: string;
  impactScore: number; // 0-100
}>
```

---

##### `diplomatic.createMission`
**Type:** Mutation (Protected, Executive)
**Description:** Create diplomatic mission

**Input:**
```typescript
{
  countryId: string;
  targetCountryId: string;
  missionType: 'trade' | 'peace' | 'aid' | 'intelligence' | 'cultural';
  name: string;
  description: string;
  objectives: string[];
  budget: number;
  duration: number; // days
  priority: 'low' | 'medium' | 'high' | 'critical';
}
```

**Output:**
```typescript
{
  success: boolean;
  mission: DiplomaticMission;
  expectedOutcome: {
    trustChange: number;
    reputationChange: number;
    economicImpact: number;
  };
}
```

</details>

<details>
<summary><strong>3. ThinkPages Router</strong> - Social platform (28+ endpoints)</summary>

### Path: `api.thinkpages.*`

#### Endpoints

##### `thinkpages.createPost`
**Type:** Mutation (Protected, Rate Limited: 10/min)
**Description:** Create a ThinkPages post

**Input:**
```typescript
{
  accountId: string;
  content: string;          // Max 5000 chars
  visibility: 'public' | 'followers' | 'private';
  tags?: string[];
  attachments?: {
    type: 'image' | 'document' | 'link';
    url: string;
  }[];
  scheduledFor?: Date;
}
```

**Output:**
```typescript
{
  success: boolean;
  post: ThinkpagesPost;
}
```

**Usage:**
```typescript
const createPost = api.thinkpages.createPost.useMutation();

await createPost.mutateAsync({
  accountId: "acc_xxx",
  content: "Announcing new economic reforms...",
  visibility: "public",
  tags: ["economy", "policy"]
});
```

---

##### `thinkpages.getFeed`
**Type:** Query (Public, Rate Limited)
**Description:** Get personalized feed

**Input:**
```typescript
{
  accountId?: string;      // For authenticated feed
  filter?: 'following' | 'trending' | 'recent';
  limit?: number;          // Default: 20, Max: 50
  cursor?: string;         // For pagination
}
```

**Output:**
```typescript
{
  posts: ThinkpagesPost[];
  nextCursor?: string;
  hasMore: boolean;
}
```

---

##### `thinkpages.likePost`
**Type:** Mutation (Protected, Rate Limited: 100/min)
**Description:** Like/unlike a post

**Input:**
```typescript
{
  postId: string;
  action: 'like' | 'unlike';
}
```

**Output:**
```typescript
{
  success: boolean;
  likeCount: number;
}
```

---

##### `thinkpages.createGroup`
**Type:** Mutation (Protected, Executive)
**Description:** Create ThinkTank group

**Input:**
```typescript
{
  name: string;
  description: string;
  visibility: 'public' | 'private' | 'invite_only';
  category: 'economic' | 'diplomatic' | 'academic' | 'policy' | 'general';
  members?: string[];     // Account IDs
}
```

**Output:**
```typescript
{
  success: boolean;
  group: ThinktankGroup;
  inviteLinks?: string[];
}
```

</details>

<details>
<summary><strong>4. Unified Intelligence Router</strong> - Intelligence briefings and alerts (22+ endpoints)</summary>

### Path: `api.unifiedIntelligence.*`

#### Endpoints

##### `unifiedIntelligence.getBriefings`
**Type:** Query (Protected, Country Owner)
**Description:** Get intelligence briefings for country

**Input:**
```typescript
{
  countryId: string;
  category?: 'economic' | 'diplomatic' | 'social' | 'security' | 'governance';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  status?: 'unread' | 'acknowledged' | 'archived';
  limit?: number;
}
```

**Output:**
```typescript
Array<{
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  status: string;
  timestamp: Date;
  source: string;
  actionable: boolean;
  metadata: Record<string, any>;
}>
```

**Usage:**
```typescript
const { data: briefings } = api.unifiedIntelligence.getBriefings.useQuery({
  countryId: "clxxx",
  priority: "high",
  status: "unread"
});
```

---

##### `unifiedIntelligence.createAlert`
**Type:** Mutation (Protected, Executive)
**Description:** Create intelligence alert

**Input:**
```typescript
{
  countryId: string;
  title: string;
  message: string;
  category: 'economic' | 'diplomatic' | 'social' | 'security' | 'governance' | 'crisis';
  priority: 'critical' | 'high' | 'medium' | 'low';
  actionRequired: boolean;
  expiresAt?: Date;
}
```

**Output:**
```typescript
{
  success: boolean;
  alert: IntelligenceAlert;
}
```

---

##### `unifiedIntelligence.acknowledgeAlert`
**Type:** Mutation (Protected, Country Owner)
**Description:** Mark alert as acknowledged

**Input:**
```typescript
{
  alertId: string;
  response?: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  acknowledgedAt: Date;
}
```

---

##### `unifiedIntelligence.getOperations`
**Type:** Query (Protected, Executive)
**Description:** Get active intelligence operations

**Input:**
```typescript
{
  countryId: string;
  operationType?: 'surveillance' | 'analysis' | 'counterintelligence';
  status?: 'active' | 'completed' | 'suspended';
}
```

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  operationType: string;
  status: string;
  startDate: Date;
  progress: number; // 0-100
  findings: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}>
```

</details>

<details>
<summary><strong>5. Activities Router</strong> - Activity feed and engagement (15+ endpoints)</summary>

### Path: `api.activities.*`

#### Endpoints

##### `activities.getGlobalFeed`
**Type:** Query (Public, Rate Limited)
**Description:** Get global activity feed

**Input:**
```typescript
{
  limit?: number;    // Default: 20, Max: 50
  cursor?: string;
  filter?: 'all' | 'achievements' | 'diplomatic' | 'economic' | 'social' | 'meta';
  category?: 'all' | 'game' | 'platform' | 'social';
}
```

**Output:**
```typescript
{
  activities: Array<{
    id: string;
    type: string;
    user: {
      id: string;
      name: string;
      countryName?: string;
    };
    content: {
      title: string;
      description: string;
      metadata: Record<string, any>;
    };
    engagement: {
      likes: number;
      comments: number;
      shares: number;
      views: number;
    };
    timestamp: Date;
  }>;
  nextCursor?: string;
}
```

**Usage:**
```typescript
const { data } = api.activities.getGlobalFeed.useQuery({
  filter: 'achievements',
  limit: 20
});
```

---

##### `activities.engageWithActivity`
**Type:** Mutation (Protected, Rate Limited: 100/min)
**Description:** Like/share/view activity

**Input:**
```typescript
{
  activityId: string;
  action: 'like' | 'unlike' | 'reshare' | 'view';
  userId: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Usage:**
```typescript
const engage = api.activities.engageWithActivity.useMutation();

await engage.mutateAsync({
  activityId: "act_xxx",
  action: "like",
  userId: user.id
});
```

---

##### `activities.getTrendingTopics`
**Type:** Query (Public, Rate Limited)
**Description:** Get trending topics

**Input:**
```typescript
{
  limit?: number;    // Default: 5, Max: 10
  timeRange?: '1h' | '6h' | '24h' | '7d';
}
```

**Output:**
```typescript
Array<{
  id: string;
  title: string;
  category: string;
  participants: number;
  trend: 'up' | 'down' | 'stable';
}>
```

</details>

<details>
<summary><strong>6. Government Router</strong> - Government structure and budgets (18+ endpoints)</summary>

### Path: `api.government.*`

#### Endpoints

##### `government.getByCountryId`
**Type:** Query (Public, Rate Limited)
**Description:** Get complete government structure

**Input:**
```typescript
{ countryId: string }
```

**Output:**
```typescript
{
  id: string;
  governmentName: string;
  governmentType: string;
  headOfState?: string;
  headOfGovernment?: string;
  totalBudget: number;
  departments: Department[];
  budgetAllocations: BudgetAllocation[];
  revenueSources: RevenueSource[];
}
```

---

##### `government.create`
**Type:** Mutation (Protected, Country Owner)
**Description:** Create government structure

**Input:**
```typescript
{
  countryId: string;
  data: {
    structure: {
      governmentName: string;
      governmentType: string;
      headOfState?: string;
      headOfGovernment?: string;
      totalBudget: number;
    };
    departments: Array<{
      name: string;
      category: string;
      description?: string;
      budget: number;
    }>;
    revenueSources: Array<{
      name: string;
      category: string;
      revenueAmount: number;
    }>;
  };
  skipConflictCheck?: boolean;
}
```

**Output:**
```typescript
{
  success: boolean;
  governmentStructure: GovernmentStructure;
  warnings: ConflictWarning[];
}
```

---

##### `government.updateDepartment`
**Type:** Mutation (Protected, Country Owner)
**Description:** Update government department

**Input:**
```typescript
{
  id: string;
  data: {
    name?: string;
    description?: string;
    minister?: string;
    budget?: number;
    isActive?: boolean;
  };
}
```

**Output:**
```typescript
{
  success: boolean;
  department: GovernmentDepartment;
}
```

</details>

<details>
<summary><strong>7. Policies Router</strong> - Policy management (12+ endpoints)</summary>

### Path: `api.policies.*`

#### Endpoints

##### `policies.createPolicy`
**Type:** Mutation (Protected, Country Owner)
**Description:** Create new policy

**Input:**
```typescript
{
  countryId: string;
  userId: string;
  name: string;
  description: string;
  policyType: 'economic' | 'social' | 'diplomatic' | 'infrastructure' | 'governance';
  category: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  implementationCost?: number;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}
```

**Output:**
```typescript
{
  id: string;
  name: string;
  status: 'draft';
  createdAt: Date;
}
```

---

##### `policies.activatePolicy`
**Type:** Mutation (Protected, Country Owner)
**Description:** Activate policy

**Input:**
```typescript
{ id: string }
```

**Output:**
```typescript
{
  success: boolean;
  policy: Policy;
  effectiveDate: Date;
}
```

---

##### `policies.getPolicies`
**Type:** Query (Public, Rate Limited)
**Description:** Get country policies

**Input:**
```typescript
{
  countryId: string;
  category?: string;
  status?: 'draft' | 'active' | 'suspended' | 'expired' | 'repealed';
}
```

**Output:**
```typescript
Array<Policy>
```

</details>

<details>
<summary><strong>8. Admin Router</strong> - System administration (25+ endpoints, Admin Only)</summary>

### Path: `api.admin.*`

#### Endpoints

##### `admin.getSystemStatus`
**Type:** Query (Admin)
**Description:** Get system status overview

**Output:**
```typescript
{
  ixTime: {
    currentRealTime: string;
    currentIxTime: string;
    formattedIxTime: string;
    multiplier: number;
    isPaused: boolean;
  };
  countryCount: number;
  activeDmInputs: number;
  lastCalculation: {
    timestamp: string;
    countriesUpdated: number;
    executionTimeMs: number;
  };
}
```

---

##### `admin.forceRecalculation`
**Type:** Mutation (Admin)
**Description:** Force recalculation of all countries

**Output:**
```typescript
{
  success: boolean;
  message: string;
  countriesUpdated: number;
  executionTimeMs: number;
}
```

---

##### `admin.importRosterData`
**Type:** Mutation (Admin)
**Description:** Import country data from file

**Input:**
```typescript
{
  fileData: number[];
  fileName: string;
  replaceExisting: boolean;
}
```

**Output:**
```typescript
{
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}
```

---

##### `admin.updateCountryData` (God Mode)
**Type:** Mutation (System Owner Only)
**Description:** Direct country data manipulation

**Input:**
```typescript
{
  id: string;
  data: {
    population?: number;
    gdpPerCapita?: number;
    totalGDP?: number;
    // ... any country field
  };
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
  country: Country;
}
```

</details>

<details>
<summary><strong>9. WikiCache Router</strong> - MediaWiki integration (10+ endpoints)</summary>

### Path: `api.wikiCache.*`

#### Endpoints

##### `wikiCache.getCountryProfile`
**Type:** Query (Public, Rate Limited)
**Description:** Get cached country data from IxWiki

**Input:**
```typescript
{
  countryName: string;
  includePageVariants?: boolean;
  maxSections?: number;
  customPages?: string[];
}
```

**Output:**
```typescript
{
  infobox: Record<string, string>;
  pages: Array<{
    title: string;
    content: string;
    lastModified: Date;
  }>;
  metadata: {
    source: 'redis' | 'database' | 'api';
    cacheAge: number;
  };
}
```

---

##### `wikiCache.refreshCountryCache`
**Type:** Mutation (Protected)
**Description:** Refresh wiki cache for country

**Input:**
```typescript
{ countryName: string }
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
  timestamp: string;
}
```

</details>

<details>
<summary><strong>10. Atomic Routers</strong> - Atomic component systems</summary>

### AtomicGovernment Router (14+ endpoints)
**Path:** `api.atomicGovernment.*`

**Key Endpoints:**
- `getByCountryId` - Get atomic government components
- `addComponent` - Add government component
- `removeComponent` - Remove government component
- `detectSynergies` - Find component synergies
- `calculateEffectiveness` - Calculate government effectiveness

### AtomicEconomic Router (16+ endpoints)
**Path:** `api.atomicEconomic.*`

**Key Endpoints:**
- `getByCountryId` - Get economic components
- `addComponent` - Add economic component
- `calculateEconomicImpact` - Calculate economic effects
- `getRecommendations` - Get AI recommendations

### AtomicTax Router (12+ endpoints)
**Path:** `api.atomicTax.*`

**Key Endpoints:**
- `getByCountryId` - Get tax components
- `addComponent` - Add tax component
- `calculateRevenue` - Calculate tax revenue
- `validateSystem` - Validate tax system

</details>

<details>
<summary><strong>11. Achievements Router</strong> - Achievement system (6 endpoints)</summary>

### Path: `api.achievements.*`

#### Endpoints

##### `achievements.getRecentByCountry`
**Type:** Query (Public, Rate Limited)

**Input:**
```typescript
{
  countryId: string;
  limit?: number; // Default: 10
}
```

**Output:**
```typescript
Array<{
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string;
  category: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
  points: number;
}>
```

---

##### `achievements.getLeaderboard`
**Type:** Query (Public, Rate Limited)

**Input:**
```typescript
{
  limit?: number;    // Default: 20
  category?: string;
}
```

**Output:**
```typescript
Array<{
  countryId: string;
  countryName: string;
  totalPoints: number;
  achievementCount: number;
  rareAchievements: number;
}>
```

</details>

---

## Type Definitions

### Core Types

<details>
<summary><strong>Country Types</strong></summary>

```typescript
interface Country {
  id: string;
  name: string;
  slug?: string;

  // Geographic
  continent?: string;
  region?: string;
  landArea?: number;
  areaSqMi?: number;

  // Government
  governmentType?: string;
  religion?: string;
  leader?: string;

  // Assets
  flag?: string;
  coatOfArms?: string;

  // Economic Baseline
  baselinePopulation: number;
  baselineGdpPerCapita: number;
  baselineDate: Date;

  // Current Values
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;

  // Growth Rates
  maxGdpGrowthRate: number;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
  localGrowthFactor: number;

  // Tiers
  economicTier: string;  // 'Primitive' | 'Developing' | 'Emerging' | 'Developed' | 'Advanced' | 'Elite'
  populationTier: string; // 'Micro' | 'Small' | 'Medium' | 'Large' | 'VeryLarge' | 'Massive'

  // Calculated Metrics
  populationDensity?: number;
  gdpDensity?: number;

  // Projections
  projected2040Population: number;
  projected2040Gdp: number;
  projected2040GdpPerCapita: number;

  // Vitality Scores (0-100)
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
  overallNationalHealth: number;

  // Metadata
  usesAtomicGovernment: boolean;
  lastCalculated: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

</details>

<details>
<summary><strong>Economic Types</strong></summary>

```typescript
interface EconomicProfile {
  id: string;
  countryId: string;

  gdpGrowthVolatility?: number;
  economicComplexity?: number;
  innovationIndex?: number;
  competitivenessRank?: number;
  easeOfDoingBusiness?: number;
  corruptionIndex?: number;

  sectorBreakdown?: string; // JSON
  exportsGDPPercent?: number;
  importsGDPPercent?: number;
  tradeBalance?: number;

  createdAt: Date;
  updatedAt: Date;
}

interface FiscalSystem {
  id: string;
  countryId: string;

  personalIncomeTaxRates?: string; // JSON
  corporateTaxRates?: string;      // JSON
  salesTaxRate?: number;
  propertyTaxRate?: number;
  payrollTaxRate?: number;
  exciseTaxRates?: string;         // JSON
  wealthTaxRate?: number;

  spendingByCategory?: string;     // JSON
  fiscalBalanceGDPPercent?: number;
  primaryBalanceGDPPercent?: number;
  taxEfficiency?: number;

  createdAt: Date;
  updatedAt: Date;
}

interface LaborMarket {
  id: string;
  countryId: string;

  employmentBySector?: string;     // JSON
  youthUnemploymentRate?: number;
  femaleParticipationRate?: number;
  informalEmploymentRate?: number;
  medianWage?: number;
  wageGrowthRate?: number;
  wageBySector?: string;           // JSON

  createdAt: Date;
  updatedAt: Date;
}
```

</details>

<details>
<summary><strong>Diplomatic Types</strong></summary>

```typescript
interface DiplomaticRelationship {
  id: string;
  fromCountryId: string;
  toCountryId: string;

  relationType: 'alliance' | 'treaty' | 'trade_agreement' | 'cultural_exchange' | 'defense_pact';
  status: 'active' | 'pending' | 'suspended' | 'terminated';

  trustLevel: number;        // 0-100
  cooperationIndex: number;  // 0-100

  establishedDate: Date;
  lastInteraction: Date;

  notes?: string;
  terms?: string;            // JSON

  createdAt: Date;
  updatedAt: Date;
}

interface Embassy {
  id: string;
  hostCountryId: string;
  guestCountryId: string;

  ambassadorName?: string;
  location?: string;
  staffCount?: number;
  budget?: number;

  status: 'active' | 'inactive' | 'closed';
  establishedDate: Date;

  services?: string;         // JSON

  createdAt: Date;
  updatedAt: Date;
}
```

</details>

<details>
<summary><strong>ThinkPages Types</strong></summary>

```typescript
interface ThinkpagesPost {
  id: string;
  accountId: string;

  content: string;
  visibility: 'public' | 'followers' | 'private';

  likeCount: number;
  replyCount: number;
  repostCount: number;

  tags?: string;             // JSON
  attachments?: string;      // JSON

  trending: boolean;
  pinned: boolean;

  scheduledFor?: Date;
  publishedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface ThinkpagesAccount {
  id: string;
  userId?: string;
  countryId?: string;

  username: string;
  displayName: string;
  bio?: string;

  accountType: 'personal' | 'government' | 'organization';
  verified: boolean;

  followerCount: number;
  followingCount: number;

  createdAt: Date;
  updatedAt: Date;
}
```

</details>

<details>
<summary><strong>Government Types</strong></summary>

```typescript
interface GovernmentStructure {
  id: string;
  countryId: string;

  governmentName: string;
  governmentType: string;

  headOfState?: string;
  headOfGovernment?: string;
  legislatureName?: string;
  executiveName?: string;
  judicialName?: string;

  totalBudget: number;
  fiscalYear: string;
  budgetCurrency: string;

  createdAt: Date;
  updatedAt: Date;
}

interface GovernmentDepartment {
  id: string;
  governmentStructureId: string;

  name: string;
  shortName?: string;
  category: string;
  description?: string;

  minister?: string;
  ministerTitle: string;
  headquarters?: string;

  employeeCount?: number;
  priority: number;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

</details>

<details>
<summary><strong>Policy Types</strong></summary>

```typescript
interface Policy {
  id: string;
  countryId: string;
  userId: string;

  name: string;
  description: string;
  policyType: 'economic' | 'social' | 'diplomatic' | 'infrastructure' | 'governance';
  category: string;

  status: 'draft' | 'active' | 'suspended' | 'expired' | 'repealed';
  priority: 'critical' | 'high' | 'medium' | 'low';

  effectiveDate?: Date;
  expiryDate?: Date;

  targetMetrics?: string;    // JSON
  implementationCost?: number;
  maintenanceCost?: number;

  createdAt: Date;
  updatedAt: Date;
}
```

</details>

<details>
<summary><strong>Intelligence Types</strong></summary>

```typescript
interface IntelligenceBriefing {
  id: string;
  countryId: string;

  title: string;
  content: string;

  category: 'economic' | 'diplomatic' | 'social' | 'security' | 'governance';
  priority: 'critical' | 'high' | 'medium' | 'low';

  status: 'unread' | 'acknowledged' | 'archived';

  source: string;
  actionable: boolean;

  metadata?: string;         // JSON

  createdAt: Date;
  acknowledgedAt?: Date;
}
```

</details>

---

## Usage Examples

### Basic Query Pattern

```typescript
import { api } from "~/utils/api";

function CountryList() {
  const { data, isLoading, error } = api.countries.getAll.useQuery({
    limit: 50,
    continent: "Sarpedon"
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data?.countries.map(country => (
        <li key={country.id}>{country.name}</li>
      ))}
    </ul>
  );
}
```

### Mutation Pattern

```typescript
function CreatePolicy() {
  const createPolicy = api.policies.createPolicy.useMutation({
    onSuccess: (data) => {
      console.log("Policy created:", data);
      // Invalidate queries to refetch
      utils.policies.getPolicies.invalidate();
    },
    onError: (error) => {
      console.error("Failed to create policy:", error);
    }
  });

  const handleSubmit = async (formData) => {
    await createPolicy.mutateAsync({
      countryId: "clxxx",
      userId: user.id,
      name: formData.name,
      description: formData.description,
      policyType: "economic",
      category: "taxation",
      priority: "high"
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

### Optimistic Updates

```typescript
function LikeButton({ postId }) {
  const utils = api.useUtils();

  const likePost = api.thinkpages.likePost.useMutation({
    onMutate: async ({ postId }) => {
      // Cancel outgoing refetches
      await utils.thinkpages.getPost.cancel({ id: postId });

      // Snapshot previous value
      const previousPost = utils.thinkpages.getPost.getData({ id: postId });

      // Optimistically update
      utils.thinkpages.getPost.setData({ id: postId }, (old) => ({
        ...old!,
        likeCount: old!.likeCount + 1
      }));

      return { previousPost };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      utils.thinkpages.getPost.setData(
        { id: postId },
        context.previousPost
      );
    },
    onSettled: () => {
      utils.thinkpages.getPost.invalidate({ id: postId });
    }
  });

  return (
    <button onClick={() => likePost.mutate({ postId, action: 'like' })}>
      Like
    </button>
  );
}
```

### Infinite Query Pattern

```typescript
function ActivityFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = api.activities.getGlobalFeed.useInfiniteQuery(
    { limit: 20, filter: 'all' },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  return (
    <div>
      {data?.pages.map((page) =>
        page.activities.map((activity) => (
          <ActivityCard key={activity.id} activity={activity} />
        ))
      )}

      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

### Batched Queries

```typescript
function CountryDashboard({ countryId }) {
  // All these queries run in parallel
  const { data: country } = api.countries.getById.useQuery({ id: countryId });
  const { data: relationships } = api.diplomatic.getRelationships.useQuery({ countryId });
  const { data: policies } = api.policies.getPolicies.useQuery({ countryId });
  const { data: briefings } = api.unifiedIntelligence.getBriefings.useQuery({ countryId });

  // React Query automatically batches these into a single HTTP request

  return (
    <div>
      <h1>{country?.name}</h1>
      {/* Render data */}
    </div>
  );
}
```

### Dependent Queries

```typescript
function UserCountryData({ userId }) {
  // First query: Get user's country
  const { data: user } = api.users.getById.useQuery({ id: userId });

  // Second query: Only runs after first query succeeds
  const { data: country } = api.countries.getById.useQuery(
    { id: user?.countryId ?? "" },
    {
      enabled: !!user?.countryId, // Only run if countryId exists
    }
  );

  return <div>{country?.name}</div>;
}
```

### Server-Side Fetching (SSR)

```typescript
import { createServerSideHelpers } from '@trpc/react-query/server';
import { appRouter } from '~/server/api/root';
import { createTRPCContext } from '~/server/api/trpc';

export async function getServerSideProps(context) {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: await createTRPCContext({ req: context.req, res: context.res }),
  });

  // Prefetch data on server
  await helpers.countries.getAll.prefetch({ limit: 100 });

  return {
    props: {
      trpcState: helpers.dehydrate(),
    },
  };
}

function CountriesPage() {
  // Data is already available from SSR
  const { data } = api.countries.getAll.useQuery({ limit: 100 });

  return <div>{/* Render countries */}</div>;
}
```

---

## Error Handling

### tRPC Error Codes

```typescript
type TRPCErrorCode =
  | 'PARSE_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_SUPPORTED'
  | 'TIMEOUT'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'PAYLOAD_TOO_LARGE'
  | 'TOO_MANY_REQUESTS'
  | 'CLIENT_CLOSED_REQUEST'
  | 'INTERNAL_SERVER_ERROR';
```

### Error Response Format

```json
{
  "error": {
    "message": "Country not found",
    "code": "NOT_FOUND",
    "data": {
      "code": "NOT_FOUND",
      "httpStatus": 404,
      "path": "countries.getById",
      "stack": "..."
    }
  }
}
```

### Client-Side Error Handling

```typescript
const { data, error } = api.countries.getById.useQuery(
  { id: countryId },
  {
    retry: (failureCount, error) => {
      // Don't retry on 404
      if (error.data?.code === 'NOT_FOUND') return false;

      // Retry up to 3 times on other errors
      return failureCount < 3;
    },
    onError: (error) => {
      // Log to error tracking service
      console.error('Query failed:', error);

      // Show user-friendly message
      toast.error(error.message);
    }
  }
);

if (error?.data?.code === 'NOT_FOUND') {
  return <div>Country not found</div>;
}

if (error?.data?.code === 'FORBIDDEN') {
  return <div>You don't have permission to view this country</div>;
}
```

### Server-Side Error Throwing

```typescript
// In tRPC procedure
protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const country = await ctx.db.country.findUnique({
      where: { id: input.id }
    });

    if (!country) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Country with ID ${input.id} not found`,
      });
    }

    // Check permissions
    if (!hasAccess(ctx.auth.userId, country.id)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have access to this country',
      });
    }

    return country;
  });
```

### Global Error Boundary

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error) => {
        // Global error handler
        console.error('Query error:', error);
      },
      retry: (failureCount, error) => {
        // Global retry logic
        if (error.data?.code === 'UNAUTHORIZED') return false;
        return failureCount < 3;
      }
    },
    mutations: {
      onError: (error) => {
        console.error('Mutation error:', error);
        toast.error(error.message);
      }
    }
  }
});
```

---

## Best Practices

### 1. Query Organization

**Group related queries:**
```typescript
// Good
const countryQueries = {
  country: api.countries.getById.useQuery({ id: countryId }),
  stats: api.countries.getStats.useQuery({ id: countryId }),
  history: api.countries.getHistoricalData.useQuery({ countryId })
};

// Avoid
const country = api.countries.getById.useQuery({ id: countryId });
const stats = api.countries.getStats.useQuery({ id: countryId });
const history = api.countries.getHistoricalData.useQuery({ countryId });
```

### 2. Query Keys & Caching

**Leverage automatic query invalidation:**
```typescript
const utils = api.useUtils();

const updateCountry = api.countries.update.useMutation({
  onSuccess: () => {
    // Invalidate all country queries
    utils.countries.invalidate();

    // Or specific query
    utils.countries.getById.invalidate({ id: countryId });
  }
});
```

### 3. Loading States

**Handle loading gracefully:**
```typescript
const { data, isLoading, isFetching, isRefetching } = api.countries.getAll.useQuery();

// isLoading: Initial fetch
// isFetching: Any fetch (including background refetch)
// isRefetching: Background refetch while data exists

return (
  <div>
    {isLoading && <Skeleton />}
    {isRefetching && <RefreshIndicator />}
    {data && <CountryList countries={data.countries} />}
  </div>
);
```

### 4. Optimistic Updates

**Use for better UX:**
```typescript
const likeMutation = api.activities.engageWithActivity.useMutation({
  onMutate: async (newLike) => {
    await utils.activities.getGlobalFeed.cancel();
    const previousFeed = utils.activities.getGlobalFeed.getData();

    // Optimistic update
    utils.activities.getGlobalFeed.setData(undefined, (old) => {
      return {
        ...old,
        activities: old.activities.map(a =>
          a.id === newLike.activityId
            ? { ...a, engagement: { ...a.engagement, likes: a.engagement.likes + 1 } }
            : a
        )
      };
    });

    return { previousFeed };
  },
  onError: (err, newLike, context) => {
    utils.activities.getGlobalFeed.setData(undefined, context.previousFeed);
  }
});
```

### 5. Type Safety

**Always use generated types:**
```typescript
import { type RouterOutputs } from "~/utils/api";

type Country = RouterOutputs["countries"]["getById"];
type Countries = RouterOutputs["countries"]["getAll"];

function CountryCard({ country }: { country: Country }) {
  // Full type safety
  return <div>{country.name}</div>;
}
```

### 6. Error Boundaries

**Wrap components with error boundaries:**
```typescript
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <ErrorBoundary
      fallback={<ErrorFallback />}
      onError={(error) => {
        // Log to error tracking
        console.error(error);
      }}
    >
      <YourComponent />
    </ErrorBoundary>
  );
}
```

### 7. Pagination

**Use cursor-based pagination for large datasets:**
```typescript
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage
} = api.activities.getGlobalFeed.useInfiniteQuery(
  { limit: 20 },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  }
);
```

### 8. Request Deduplication

**tRPC automatically deduplicates:**
```typescript
// These run as a single request
function Component() {
  const query1 = api.countries.getAll.useQuery();
  const query2 = api.countries.getAll.useQuery();
  const query3 = api.countries.getAll.useQuery();

  // Only 1 HTTP request is made
}
```

### 9. Stale Time Configuration

**Configure stale time appropriately:**
```typescript
const { data } = api.countries.getAll.useQuery(undefined, {
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

### 10. React Query DevTools

**Use in development:**
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}
```

---

## WebSocket Events

### Real-Time Intelligence Updates

**Subscribe to intelligence alerts:**
```typescript
import { pusherClient } from "~/lib/pusher";

useEffect(() => {
  const channel = pusherClient.subscribe(`country-${countryId}`);

  channel.bind('intelligence-alert', (data) => {
    // New intelligence alert received
    utils.unifiedIntelligence.getBriefings.invalidate();
  });

  return () => {
    channel.unbind('intelligence-alert');
    pusherClient.unsubscribe(`country-${countryId}`);
  };
}, [countryId]);
```

### Activity Feed Live Updates

**Real-time activity updates:**
```typescript
useEffect(() => {
  const channel = pusherClient.subscribe('global-feed');

  channel.bind('new-activity', (activity) => {
    utils.activities.getGlobalFeed.setData(undefined, (old) => {
      return {
        ...old,
        activities: [activity, ...old.activities]
      };
    });
  });

  return () => {
    pusherClient.unsubscribe('global-feed');
  };
}, []);
```

### Diplomatic Notifications

**Real-time diplomatic events:**
```typescript
useEffect(() => {
  const channel = pusherClient.subscribe(`diplomatic-${countryId}`);

  channel.bind('relationship-update', (data) => {
    utils.diplomatic.getRelationships.invalidate({ countryId });
  });

  channel.bind('embassy-request', (data) => {
    toast.info(`New embassy request from ${data.countryName}`);
  });

  return () => {
    pusherClient.unsubscribe(`diplomatic-${countryId}`);
  };
}, [countryId]);
```

---

## Additional Routers Reference

### Quick Reference Table

| Router | Key Endpoints | Auth Level |
|--------|---------------|------------|
| `users` | getById, updateProfile, getUserCountry | Protected |
| `roles` | getRoles, assignRole, createRole | Admin |
| `meetings` | create, getUpcoming, joinMeeting | Protected |
| `notifications` | getAll, markAsRead, create | Protected |
| `mycountry` | getDashboard, getExecutiveData | Executive |
| `archetypes` | getAll, getUserSelection, setArchetype | Protected |
| `enhancedEconomics` | getAnalysis, getProjections | Public |
| `quickActions` | executeMeeting, createPolicy | Protected |
| `scheduledChanges` | create, getPending, apply | Protected |
| `taxSystem` | get, update, calculate | Protected |
| `wikiImporter` | import, parseInfobox | Admin |
| `security` | getMilitary, getThreats, updateDefense | Protected |
| `customTypes` | getGovernmentTypes, addCustomType | Protected |
| `economics` | getEconomicData, updateIndicators | Protected |
| `nationalIdentity` | get, update, autosave | Protected |
| `cache` | getStats, clear, warmCache | Admin |
| `diplomaticIntelligence` | getInsights, analyze | Protected |
| `intelligence` | getBriefings, createReport | Protected |
| `sdi` | getSystemData (deprecated) | Admin |
| `eci` | getExecutiveData (deprecated) | Executive |
| `formulas` | getAll, calculate | Protected |
| `unifiedAtomic` | detectSynergies, calculate | Protected |
| `userLogging` | logActivity, getActivityLog | Admin |

---

## Conclusion

This documentation covers the complete IxStats tRPC API with 304+ endpoints across 36 routers. For specific endpoint details, refer to the source code in `/src/server/api/routers/`.

**Key Resources:**
- [FORMULAS_AND_CALCULATIONS.md](./FORMULAS_AND_CALCULATIONS.md) - Economic calculation formulas
- [ATOMIC_COMPONENTS_GUIDE.md](./ATOMIC_COMPONENTS_GUIDE.md) - Atomic system documentation
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - UI/UX design patterns
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) - Feature status

**Support:**
- GitHub Issues: [ixwiki/ixstats](https://github.com/ixwiki/ixstats)
- Discord: [IxWiki Community](https://discord.gg/ixwiki)

---

*Last Updated: October 26, 2025 | Version 1.1.3*
