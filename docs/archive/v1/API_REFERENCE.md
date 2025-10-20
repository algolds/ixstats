# IxStats API Reference

**Version**: 1.1.1
**Last Updated**: October 17, 2025
**Architecture**: tRPC v11 with Next.js App Router

## Overview

IxStats exposes **545 type-safe API endpoints** across **36 tRPC routers**. All endpoints use tRPC for end-to-end type safety between client and server.

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
| [achievements](#achievements-router) | 4 | Achievement system | Protected |
| [activities](#activities-router) | 10 | Live activity feed | Protected |
| [admin](#admin-router) | 31 | System administration | Admin |
| [archetypes](#archetypes-router) | 10 | Country archetypes | Public |
| [atomicEconomic](#atomic-economic-router) | 6 | Atomic economic components | Protected |
| [atomicGovernment](#atomic-government-router) | 12 | Atomic government components | Protected |
| [atomicTax](#atomic-tax-router) | 6 | Atomic tax components | Protected |
| [countries](#countries-router) | 47 | Country management | Mixed |
| [customTypes](#custom-types-router) | 5 | Custom government types | Protected |
| [diplomatic](#diplomatic-router) | 26 | Diplomatic relations | Protected |
| [diplomaticIntelligence](#diplomatic-intelligence-router) | 5 | Diplomatic intelligence | Protected |
| [eci](#eci-router) | 19 | Executive Command Intelligence | Premium |
| [economics](#economics-router) | 19 | Economic data | Protected |
| [enhancedEconomics](#enhanced-economics-router) | 6 | Advanced economic indices | Protected |
| [formulas](#formulas-router) | 6 | Economic formulas | Public |
| [government](#government-router) | 14 | Government structures | Protected |
| [intelligence](#intelligence-router) | 11 | Intelligence system | Protected |
| [intelligenceBriefing](#intelligence-briefing-router) | 3 | Stored intelligence briefings | Protected |
| [meetings](#meetings-router) | 27 | Cabinet meetings | Protected |
| [mycountry](#mycountry-router) | 5 | MyCountry dashboard | Country Owner |
| [notifications](#notifications-router) | 11 | Notification system | Protected |
| [policies](#policies-router) | 23 | Policy management | Protected |
| [quickActions](#quick-actions-router) | 21 | Quick action system | Protected |
| [roles](#roles-router) | 10 | Role management | Admin |
| [scheduledChanges](#scheduled-changes-router) | 7 | Delayed impact system | Protected |
| [sdi](#sdi-router) | 33 | Strategic Defense Intelligence | Premium |
| [security](#security-router) | 34 | Defense & security | Protected |
| [taxSystem](#tax-system-router) | 11 | Tax configuration | Protected |
| [thinkpages](#thinkpages-router) | 56 | Social platform | Protected |
| [unifiedAtomic](#unified-atomic-router) | 6 | Cross-builder components | Protected |
| [unifiedIntelligence](#unified-intelligence-router) | 9 | Unified intelligence system | Protected |
| [userLogging](#user-logging-router) | 10 | Activity logging | Protected |
| [users](#users-router) | 19 | User management | Protected |
| [wikiCache](#wiki-cache-router) | 11 | Wiki cache management | Admin |
| [wikiImporter](#wiki-importer-router) | 5 | Wiki data import | Protected |

**Total**: 545 endpoints across 36 routers (35 active + 1 alias)

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

## Notifications Router

**Purpose**: Comprehensive notification system for real-time user updates
**Endpoints**: 11 (7 queries, 4 mutations, 1 subscription)
**Authentication**: Protected

### Overview

The notifications router provides a complete notification delivery system with:
- User-specific and country-wide notifications
- Priority-based delivery (critical/high/medium/low)
- Multiple delivery methods (modal/dynamic-island/toast/command-palette)
- Real-time subscriptions via tRPC
- Rich metadata support
- Actionable notifications with deep links

### Queries

#### getUserNotifications

Get user's notifications with filtering and pagination.

```typescript
const { data } = api.notifications.getUserNotifications.useQuery({
  limit: 20,
  offset: 0,
  includeRead: false,
  category: 'economic',
  priority: 'high'
});
```

**Parameters:**
- `limit` (optional, default: 20): Max notifications to return
- `offset` (optional, default: 0): Pagination offset
- `includeRead` (optional, default: false): Include read notifications
- `category` (optional): Filter by category (economic, diplomatic, governance, social, security, system)
- `priority` (optional): Filter by priority (critical, high, medium, low)

**Returns:**
```typescript
{
  notifications: Notification[],
  total: number,
  unread: number
}
```

#### getUnreadCount

Get count of unread notifications (used for badges).

```typescript
const { data } = api.notifications.getUnreadCount.useQuery();
// Returns: { count: 5 }
```

**Returns:**
- `count` (number): Unread notification count

#### getNotificationStats

Get notification statistics and breakdown.

```typescript
const { data } = api.notifications.getNotificationStats.useQuery();
```

**Returns:**
```typescript
{
  total: number,
  unread: number,
  byCategory: Record<string, number>,
  byPriority: Record<string, number>,
  recent: number
}
```

#### getCountryNotifications

Get country-wide notifications (visible to all country members).

```typescript
const { data } = api.notifications.getCountryNotifications.useQuery({
  countryId: 'country-001',
  limit: 10
});
```

**Parameters:**
- `countryId` (required): Country ID
- `limit` (optional, default: 10): Max notifications

**Returns:** Array of Notification objects

### Mutations

#### markAsRead

Mark single notification as read.

```typescript
await api.notifications.markAsRead.mutate({
  id: 'notif-123'
});
```

**Parameters:**
- `id` (required): Notification ID

**Returns:**
```typescript
{
  success: boolean,
  notification: Notification
}
```

#### markAllAsRead

Mark all user notifications as read.

```typescript
await api.notifications.markAllAsRead.mutate();
```

**Returns:**
```typescript
{
  success: boolean,
  count: number  // Number of notifications marked as read
}
```

#### dismiss

Dismiss (hide) a notification without marking as read.

```typescript
await api.notifications.dismiss.mutate({
  id: 'notif-123'
});
```

**Parameters:**
- `id` (required): Notification ID

**Returns:**
```typescript
{
  success: boolean
}
```

#### dismissAll

Dismiss all user notifications.

```typescript
await api.notifications.dismissAll.mutate();
```

**Returns:**
```typescript
{
  success: boolean,
  count: number
}
```

#### createNotification (Admin Only)

Manually create a notification (admin use).

```typescript
await api.notifications.createNotification.mutate({
  title: 'System Maintenance',
  message: 'Platform will be down Sunday 2AM-4AM',
  userId: 'user_123', // or null for global
  category: 'system',
  priority: 'high',
  severity: 'important',
  deliveryMethod: 'dynamic-island',
  href: '/system-status',
  actionable: true
});
```

**Parameters:**
- `title` (required): Notification title
- `message` (optional): Detailed message
- `userId` (optional): Target user (null for global)
- `countryId` (optional): Target country
- `category` (optional): economic, diplomatic, governance, social, security, system, achievement, crisis
- `type` (optional): info, success, warning, error, alert, update
- `priority` (optional, default: medium): critical, high, medium, low
- `severity` (optional, default: informational): urgent, important, informational
- `deliveryMethod` (optional): modal, dynamic-island, toast, command-palette
- `href` (optional): Action link
- `actionable` (optional, default: false): Can user act on it
- `metadata` (optional): JSON metadata

**Returns:**
```typescript
{
  success: boolean,
  notification: Notification
}
```

#### updatePreferences

Update user notification preferences.

```typescript
await api.notifications.updatePreferences.mutate({
  emailNotifications: true,
  pushNotifications: false,
  categoryPreferences: {
    economic: true,
    social: false,
    diplomatic: true
  },
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '08:00'
  }
});
```

**Parameters:**
- `emailNotifications` (optional): Enable email notifications
- `pushNotifications` (optional): Enable push notifications
- `categoryPreferences` (optional): Category-specific settings
- `quietHours` (optional): Quiet hours schedule

**Returns:**
```typescript
{
  success: boolean,
  preferences: UserPreferences
}
```

### Subscriptions

#### onNotificationAdded

Real-time notification subscription (WebSocket/SSE).

```typescript
api.notifications.onNotificationAdded.useSubscription(undefined, {
  onData: (notification) => {
    console.log('New notification:', notification);
    // Update UI, play sound, etc.
  },
  onError: (error) => {
    console.error('Subscription error:', error);
  }
});
```

**Events:**
- Fires when new notification is created for user
- Includes full notification object
- Auto-reconnects on disconnect

### Notification Schema

```typescript
interface Notification {
  id: string;
  userId: string | null;
  countryId: string | null;
  title: string;
  description: string | null;
  message: string | null;
  read: boolean;
  dismissed: boolean;
  href: string | null;
  type: 'info' | 'success' | 'warning' | 'error' | 'alert' | 'update' | null;
  category: 'economic' | 'diplomatic' | 'governance' | 'social' | 'security' | 'system' | 'achievement' | 'crisis' | 'opportunity' | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
  severity: 'urgent' | 'important' | 'informational';
  source: string | null;
  actionable: boolean;
  metadata: string | null; // JSON
  relevanceScore: number | null;
  deliveryMethod: 'toast' | 'dynamic-island' | 'modal' | 'command-palette' | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Integration Examples

#### Example 1: React Component

```typescript
'use client';

import { useLiveNotifications } from '~/hooks/useLiveNotifications';

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useLiveNotifications();

  return (
    <div>
      <h2>Notifications ({unreadCount})</h2>
      {notifications.map(notif => (
        <div key={notif.id} onClick={() => markAsRead(notif.id)}>
          <h3>{notif.title}</h3>
          <p>{notif.message}</p>
        </div>
      ))}
      <button onClick={markAllAsRead}>Mark All Read</button>
    </div>
  );
}
```

#### Example 2: Server-Side Notification Creation

```typescript
// In your tRPC router
import { notificationHooks } from '~/lib/notification-hooks';

export const myRouter = createTRPCRouter({
  doSomething: protectedProcedure
    .mutation(async ({ ctx, input }) => {
      // Your business logic
      const result = await performAction();

      // Send notification
      try {
        await notificationHooks.onEconomicDataChange({
          countryId: ctx.country.id,
          metric: 'GDP',
          currentValue: result.newGdp,
          previousValue: result.oldGdp,
        });
      } catch (error) {
        console.error('Notification failed:', error);
      }

      return result;
    })
});
```

### Performance Considerations

- **Polling**: Default 30-second interval
- **Caching**: React Query with 1-minute stale time
- **Indexing**: Optimized for userId + read + dismissed queries
- **Batch Operations**: Use markAllAsRead for bulk actions
- **Real-time**: EventEmitter-based (lightweight)

### Related Documentation

- [NOTIFICATION_SYSTEM.md](./NOTIFICATION_SYSTEM.md) - Complete system overview
- [NOTIFICATION_HOOKS_GUIDE.md](./NOTIFICATION_HOOKS_GUIDE.md) - Developer integration guide
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - Dynamic Island UI specs

---

## Support

- **Documentation**: [/docs/DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)
- **Issues**: Report bugs via GitHub issues
- **API Status**: Check `/api/health` endpoint

---

**Last Updated**: October 18, 2025
**Version**: 1.1.1
