# Unified Intelligence Router

## Overview

The Unified Intelligence Router (`unified-intelligence.ts`) is a comprehensive tRPC router that combines SDI (Sovereign Digital Interface) and ECI (Executive Command Interface) functionality with advanced intelligence operations, diplomatic channels, and executive dashboard features.

**Location:** `/src/server/api/routers/unified-intelligence.ts`
**Router Name:** `unifiedIntelligence`
**Access:** Available via `api.unifiedIntelligence.*`

---

## Features

### 1. Executive Dashboard Operations
- **Overview Data**: Vitality metrics, active alerts, intelligence briefings, recent meetings, and policy status
- **Real-time Metrics**: Economic vitality, social wellbeing, diplomatic standing, governmental efficiency
- **Activity Tracking**: Cabinet meetings, policy decisions, pending implementations
- **Alert Management**: Critical, high, medium, and low priority alerts with categorization

### 2. Quick Actions System
- **Context-Aware Actions**: Actions recommended based on country conditions
- **Real Database Effects**: All actions create actual database records and apply effects
- **Action Types**:
  - `infrastructure_boost`: +2.5% GDP growth for 6 months
  - `security_review`: Review and monitor active threats
  - `education_expansion`: +1.5% productivity boost for 1 year
  - `trade_mission`: Create diplomatic trade opportunities
  - `diplomatic_outreach`: Improve diplomatic standing by +5
  - `economic_stimulus`: +3% GDP growth for 3 months
  - `policy_implementation`: Implement intelligence recommendations
  - `emergency_response`: Deploy emergency crisis mitigation

### 3. Diplomatic Channel Management
- **Classification-Based Access**: PUBLIC, RESTRICTED, CONFIDENTIAL, SECRET, TOP_SECRET
- **Secure Messaging**: Encrypted diplomatic communications
- **Channel Types**: BILATERAL, MULTILATERAL, EMERGENCY
- **Real-time Notifications**: Automatic notifications to all participants

### 4. Intelligence Feed
- **Real-time Updates**: Live intelligence items from database
- **Advanced Filtering**: By category, priority, country, region
- **Pagination Support**: Efficient data loading with offset/limit
- **Multi-category Support**: Economic, diplomatic, security, crisis, technology

### 5. Analytics Dashboard
- **Historical Analysis**: GDP trends, population growth, policy effectiveness
- **Time Series Data**: 7d, 30d, 90d, 1y timeframes
- **Alert Analytics**: By severity and category
- **Policy Tracking**: By type and status

---

## API Endpoints

### Executive Dashboard

#### `getOverview`
Get comprehensive executive dashboard overview.

**Access Level:** `protectedProcedure`

**Input:**
```typescript
{
  countryId: string
}
```

**Output:**
```typescript
{
  country: {
    id: string;
    name: string;
    economicTier: string;
    populationTier: string;
    overallNationalHealth: number;
  };
  vitality: {
    economic: number;
    social: number;
    diplomatic: number;
    governance: number;
    snapshots: VitalitySnapshot[];
  };
  alerts: {
    total: number;
    critical: number;
    items: Alert[];
  };
  briefings: {
    total: number;
    highPriority: number;
    items: Briefing[];
  };
  activity: {
    recentMeetings: number;
    pendingDecisions: number;
    activePolicies: number;
  };
  lastUpdated: Date;
}
```

**Example Usage:**
```typescript
const overview = await api.unifiedIntelligence.getOverview.query({
  countryId: "country_123"
});

console.log(`Critical Alerts: ${overview.alerts.critical}`);
console.log(`Economic Vitality: ${overview.vitality.economic}/100`);
```

---

#### `getQuickActions`
Get context-aware quick actions for executive operations.

**Access Level:** `protectedProcedure`

**Input:**
```typescript
{
  countryId: string
}
```

**Output:**
```typescript
{
  actions: Array<{
    id: string;
    title: string;
    description: string;
    actionType: ActionType;
    category: string;
    urgency: string;
    estimatedDuration: string;
    successProbability: number;
    estimatedBenefit: string;
    requirements: string[];
    risks: string[];
    recommendationId?: string;
  }>;
  context: {
    countryTier: string;
    recentThreats: number;
    activeRecommendations: number;
  };
}
```

**Example Usage:**
```typescript
const { actions } = await api.unifiedIntelligence.getQuickActions.query({
  countryId: "country_123"
});

// Display urgent actions
const urgentActions = actions.filter(a => a.urgency === 'urgent');
```

---

#### `executeAction`
Execute a quick action with real database effects.

**Access Level:** `premiumProcedure`

**Input:**
```typescript
{
  countryId: string;
  actionType: ActionType;
  parameters?: Record<string, any>;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';
  notes?: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
  effect: string;
}
```

**Example Usage:**
```typescript
const result = await api.unifiedIntelligence.executeAction.mutate({
  countryId: "country_123",
  actionType: "infrastructure_boost",
  priority: "HIGH",
  notes: "Urgent infrastructure development needed"
});

// Result: { success: true, message: "Infrastructure boost applied", effect: "+2.5% GDP growth for 6 months" }
```

**Database Effects:**
- Creates `DmInputs` record for economic effects
- Updates `Country` fields for immediate changes
- Creates `DiplomaticEvent` records for diplomatic actions
- Updates `IntelligenceAlert` and `IntelligenceRecommendation` status
- Sends notifications to country leadership

---

### Diplomatic Channels

#### `getDiplomaticChannels`
Get secure diplomatic channels with classification filtering.

**Access Level:** `protectedProcedure`

**Input:**
```typescript
{
  countryId: string;
  clearanceLevel?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';
}
```

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  type: string;
  classification: string;
  encrypted: boolean;
  lastActivity: Date;
  unreadCount: number;
  participants: Array<{
    countryId: string;
    countryName: string;
    flagUrl?: string;
    role: string;
  }>;
}>
```

**Example Usage:**
```typescript
// Get confidential and below channels
const channels = await api.unifiedIntelligence.getDiplomaticChannels.query({
  countryId: "country_123",
  clearanceLevel: "CONFIDENTIAL"
});
```

---

#### `sendSecureMessage`
Send encrypted diplomatic message through secure channel.

**Access Level:** `protectedProcedure`

**Input:**
```typescript
{
  channelId: string;
  fromCountryId: string;
  fromCountryName: string;
  toCountryId?: string;
  toCountryName?: string;
  subject?: string;
  content: string;
  classification?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';
  encrypted?: boolean;
}
```

**Output:**
```typescript
{
  success: boolean;
  message: DiplomaticMessage;
  recipientCount: number;
}
```

**Example Usage:**
```typescript
const result = await api.unifiedIntelligence.sendSecureMessage.mutate({
  channelId: "channel_123",
  fromCountryId: "country_123",
  fromCountryName: "Caphiria",
  toCountryId: "country_456",
  toCountryName: "Urcea",
  subject: "Trade Agreement Proposal",
  content: "We propose a new bilateral trade agreement...",
  classification: "CONFIDENTIAL",
  priority: "HIGH",
  encrypted: true
});

// Automatically sends notifications to recipients
```

**Security Features:**
- Verifies user owns sending country
- Validates channel access permissions
- Enforces classification levels
- Supports end-to-end encryption
- Audit logs all sensitive messages
- Rate limits high-priority messages

---

### Intelligence Feed

#### `getIntelligenceFeed`
Get real-time intelligence feed with advanced filtering.

**Access Level:** `protectedProcedure`

**Input:**
```typescript
{
  countryId?: string;
  category?: 'all' | 'economic' | 'crisis' | 'diplomatic' | 'security' | 'technology' | 'environment';
  priority?: 'all' | 'low' | 'medium' | 'high' | 'critical';
  limit?: number; // 1-100, default 20
  offset?: number; // default 0
}
```

**Output:**
```typescript
{
  items: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    priority: string;
    severity: string;
    source: string;
    timestamp: Date;
    region?: string;
    affectedCountries: string[];
    actionable: boolean;
    confidence?: number;
  }>;
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}
```

**Example Usage:**
```typescript
// Get critical security intelligence
const feed = await api.unifiedIntelligence.getIntelligenceFeed.query({
  category: "security",
  priority: "critical",
  limit: 20,
  offset: 0
});

// Infinite scroll pagination
if (feed.pagination.hasMore) {
  const nextPage = await api.unifiedIntelligence.getIntelligenceFeed.query({
    category: "security",
    priority: "critical",
    limit: 20,
    offset: feed.pagination.offset + feed.pagination.limit
  });
}
```

---

### Analytics Dashboard

#### `getAnalytics`
Get advanced analytics dashboard data with historical trends.

**Access Level:** `premiumProcedure`

**Input:**
```typescript
{
  countryId: string;
  timeframe?: '7d' | '30d' | '90d' | '1y'; // default '30d'
}
```

**Output:**
```typescript
{
  overview: {
    gdpTrend: string; // percentage
    populationTrend: string; // percentage
    alertsGenerated: number;
    briefingsCreated: number;
    policiesProposed: number;
  };
  timeSeries: {
    gdp: Array<{ timestamp: Date; value: number }>;
    population: Array<{ timestamp: Date; value: number }>;
    gdpPerCapita: Array<{ timestamp: Date; value: number }>;
  };
  alerts: {
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byCategory: Record<string, number>;
  };
  policies: {
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
}
```

**Example Usage:**
```typescript
const analytics = await api.unifiedIntelligence.getAnalytics.query({
  countryId: "country_123",
  timeframe: "90d"
});

// Display GDP trend
console.log(`GDP Growth: ${analytics.overview.gdpTrend}%`);

// Render time series chart
analytics.timeSeries.gdp.forEach(point => {
  console.log(`${point.timestamp}: $${point.value.toFixed(2)}B`);
});
```

---

### Admin Operations

#### `createBriefing`
Create intelligence briefing (admin only).

**Access Level:** `adminProcedure`

**Input:**
```typescript
{
  countryId: string;
  title: string;
  description: string;
  type: 'HOT_ISSUE' | 'OPPORTUNITY' | 'RISK_MITIGATION' | 'STRATEGIC_INITIATIVE';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  area: 'ECONOMIC' | 'DIPLOMATIC' | 'SOCIAL' | 'GOVERNANCE' | 'SECURITY' | 'INFRASTRUCTURE' | 'CRISIS';
  confidence: number; // 0-100
  urgency: 'IMMEDIATE' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_QUARTER';
}
```

**Output:**
```typescript
IntelligenceBriefing
```

**Example Usage:**
```typescript
const briefing = await api.unifiedIntelligence.createBriefing.mutate({
  countryId: "country_123",
  title: "Economic Slowdown Warning",
  description: "GDP growth has declined for 3 consecutive quarters...",
  type: "HOT_ISSUE",
  priority: "HIGH",
  area: "ECONOMIC",
  confidence: 85,
  urgency: "THIS_WEEK"
});

// Automatically sends notification to country leadership
```

---

## Security & Access Control

### Classification Levels
1. **PUBLIC**: Available to all authenticated users
2. **RESTRICTED**: Limited to country leadership and authorized personnel
3. **CONFIDENTIAL**: Senior government officials only
4. **SECRET**: Top government leadership and intelligence officials
5. **TOP_SECRET**: Highest level officials only

### Procedure Types
- **`publicProcedure`**: No authentication required
- **`protectedProcedure`**: Requires authentication
- **`premiumProcedure`**: Requires MyCountry Premium membership
- **`executiveProcedure`**: Requires country ownership + authentication
- **`adminProcedure`**: Requires admin role

### Audit Logging
All sensitive operations are automatically logged with:
- User ID and country ID
- Action type and timestamp
- Input parameters (sanitized)
- Success/failure status
- IP address and user agent
- Security classification level

High-security events are persisted to the `AuditLog` database table.

---

## Integration with Other Systems

### Intelligence System
- Reads from `IntelligenceItem`, `IntelligenceBriefing`, `IntelligenceAlert`, `IntelligenceRecommendation`
- Creates intelligence briefings and recommendations
- Updates vitality snapshots

### ECI Router
- Shares quick actions implementation
- Uses same policy and meeting models
- Integrates with cabinet meeting system

### SDI Router
- Shares intelligence feed
- Common diplomatic event handling
- Unified notification system

### Diplomatic Router
- Uses same channel and message models
- Shared embassy and cultural exchange data
- Common relationship management

### Notification System
- Automatic notifications for all major events
- Priority-based routing
- Category-specific templates
- Metadata attachment for context

---

## Database Models Used

### Core Models
- `Country`: Country data and vitality scores
- `User`: User authentication and permissions
- `HistoricalDataPoint`: Time series data

### Intelligence Models
- `IntelligenceBriefing`: Executive intelligence briefings
- `IntelligenceRecommendation`: Actionable recommendations
- `IntelligenceAlert`: Real-time alerts
- `VitalitySnapshot`: Vitality score snapshots
- `IntelligenceItem`: Intelligence feed items

### Diplomatic Models
- `DiplomaticChannel`: Secure communication channels
- `DiplomaticChannelParticipant`: Channel membership
- `DiplomaticMessage`: Secure messages
- `DiplomaticEvent`: Diplomatic events and outcomes

### Policy Models
- `Policy`: Government policies
- `PolicyEffectLog`: Policy effect tracking
- `CabinetMeeting`: Cabinet meetings
- `MeetingDecision`: Meeting decisions

### Economic Models
- `DmInputs`: Dungeon Master economic inputs
- `EconomicModel`: Economic projections

---

## Error Handling

All endpoints use consistent error handling:

```typescript
try {
  // Operation
  return result;
} catch (error) {
  console.error('[Unified Intelligence] Error:', error);
  throw error instanceof TRPCError ? error : new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Operation failed'
  });
}
```

### Common Error Codes
- `NOT_FOUND`: Resource not found
- `FORBIDDEN`: Insufficient permissions
- `BAD_REQUEST`: Invalid input
- `UNAUTHORIZED`: Authentication required
- `INTERNAL_SERVER_ERROR`: Server error

---

## Performance Considerations

### Database Queries
- Uses proper indexes on all query fields
- Limits result sets with `take` and pagination
- Includes only necessary relations
- Optimized `where` clauses

### Caching Strategy
- Client-side caching via tRPC
- Database query optimization
- Batch operations where possible
- Efficient data transformations

### Rate Limiting
- Premium endpoints have rate limits
- Executive actions are throttled
- Diplomatic messages are rate-limited by priority
- Admin operations have separate limits

---

## Testing

### Example Test Cases

```typescript
// Test executive overview
test('getOverview returns complete dashboard', async () => {
  const overview = await caller.unifiedIntelligence.getOverview({
    countryId: testCountry.id
  });

  expect(overview.country).toBeDefined();
  expect(overview.vitality.economic).toBeGreaterThanOrEqual(0);
  expect(overview.alerts.items).toBeInstanceOf(Array);
});

// Test quick action execution
test('executeAction applies database effects', async () => {
  const result = await caller.unifiedIntelligence.executeAction({
    countryId: testCountry.id,
    actionType: 'infrastructure_boost'
  });

  expect(result.success).toBe(true);
  expect(result.effect).toContain('GDP growth');

  // Verify DmInputs record created
  const dmInput = await db.dmInputs.findFirst({
    where: {
      countryId: testCountry.id,
      inputType: 'economic_policy'
    }
  });
  expect(dmInput).toBeDefined();
  expect(dmInput.value).toBe(2.5);
});

// Test diplomatic messaging
test('sendSecureMessage enforces access control', async () => {
  await expect(
    caller.unifiedIntelligence.sendSecureMessage({
      channelId: 'restricted_channel',
      fromCountryId: 'unauthorized_country',
      fromCountryName: 'Test',
      content: 'Test message'
    })
  ).rejects.toThrow('Access denied');
});
```

---

## Migration Guide

### From ECI Router
```typescript
// Old (ECI)
const actions = await api.eci.getQuickActions.query({ userId });

// New (Unified)
const actions = await api.unifiedIntelligence.getQuickActions.query({ countryId });
```

### From SDI Router
```typescript
// Old (SDI)
const feed = await api.sdi.getIntelligenceFeed.query({ category, priority });

// New (Unified)
const feed = await api.unifiedIntelligence.getIntelligenceFeed.query({
  countryId,
  category,
  priority
});
```

### From Intelligence Router
```typescript
// Old (Intelligence)
const briefings = await api.intelligenceBriefing.getForCountry.query({ countryId });

// New (Unified) - Available in getOverview
const overview = await api.unifiedIntelligence.getOverview.query({ countryId });
const briefings = overview.briefings.items;
```

---

## Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] Advanced AI-powered recommendations
- [ ] Multi-country coalition management
- [ ] Historical playback of intelligence events
- [ ] Export analytics to CSV/PDF
- [ ] Custom alert thresholds
- [ ] Predictive analytics dashboard
- [ ] Machine learning threat detection

---

## Support

For questions or issues:
1. Check this documentation
2. Review existing router implementations (ECI, SDI, Intelligence)
3. Examine database schema in `/prisma/schema.prisma`
4. Check notification system in `/src/lib/notification-api.ts`

---

**Last Updated:** 2025-10-17
**Version:** 1.0.0
**Maintainer:** IxStats Development Team
