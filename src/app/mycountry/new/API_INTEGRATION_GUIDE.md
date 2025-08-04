# MyCountry API Integration Guide

## 🌐 Overview

This document provides a comprehensive guide to all API endpoints, data flows, and integration points for the MyCountry system. It serves as the definitive reference for developers working with MyCountry data.

---

## 📡 API Endpoints

### MyCountry Router (`/api/trpc/mycountry`)

All MyCountry-specific endpoints are organized under the `mycountry` router for clean separation of concerns.

#### 🏠 **`getCountryDashboard`** - Public
**Purpose**: Get comprehensive country data with calculated vitality scores

**Input:**
```typescript
{
  countryId: string;
  includeHistory?: boolean; // Default: false
}
```

**Output:**
```typescript
{
  // All Country model fields plus:
  economicVitality: number;      // 0-100 calculated score
  populationWellbeing: number;   // 0-100 calculated score
  diplomaticStanding: number;    // 0-100 calculated score
  governmentalEfficiency: number; // 0-100 calculated score
  overallScore: number;          // Average of all vitality scores
  lastCalculated: number;        // Unix timestamp
  baselineDate: number;          // Unix timestamp
  // Optional historical data if includeHistory=true
  historicalData?: HistoricalDataPoint[];
  demographics?: Demographics;
  economicProfile?: EconomicProfile;
  // ... other related models
}
```

**Data Sources**: 
- `Country` table (primary data)
- `HistoricalDataPoint` table (trend calculation)
- Related economic models

**Cache**: 3 minutes TTL

---

#### 🧠 **`getIntelligenceFeed`** - Protected
**Purpose**: Generate real-time intelligence feed for executive dashboard

**Input:**
```typescript
{
  countryId: string;
  limit?: number; // 1-50, default: 20
}
```

**Output:**
```typescript
IntelligenceItem[] = [
  {
    id: string;
    type: 'alert' | 'opportunity' | 'update' | 'prediction';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    category: 'economic' | 'diplomatic' | 'social' | 'governance' | 'security';
    timestamp: number;
    actionable: boolean;
    source: string;
    confidence?: number; // 0-1 scale
  }
]
```

**Data Sources**:
- `IntelligenceItem` table (global intelligence)
- `HistoricalDataPoint` table (trend analysis)
- `Country` table (current state analysis)
- Real-time calculations for economic alerts

**Intelligence Generation Logic**:
1. **Economic Intelligence**: GDP changes >2%, population growth anomalies
2. **System Intelligence**: From `IntelligenceItem` table filtered by region/country
3. **Trend Intelligence**: Historical pattern analysis
4. **Crisis Intelligence**: From `CrisisEvent` table

**Cache**: 2 minutes TTL

---

#### 🏆 **`getAchievements`** - Public
**Purpose**: Calculate and return achievements based on country performance

**Input:**
```typescript 
{
  countryId: string;
}
```

**Output:**
```typescript
Achievement[] = [
  {
    id: string;
    title: string;
    description: string;
    category: 'economic' | 'diplomatic' | 'social' | 'governance' | 'special';
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    achievedAt: number; // Unix timestamp
    points: number;
    icon: string; // Lucide icon name
    progress: number; // 0-100
  }
]
```

**Achievement Calculation Logic**:
- **Wealthy Nation**: GDP per capita > $50,000
- **Population Giant**: Population > 100 million
- **Rapid Growth**: GDP growth > 5% annually
- **Economic Powerhouse**: Top 10% in regional GDP rankings
- **Diplomatic Excellence**: High treaty count and positive relations

**Data Sources**:
- `Country` table (current metrics)
- `HistoricalDataPoint` table (historical achievements)
- `DiplomaticRelation` table (diplomatic achievements)
- `Treaty` table (international agreements)

**Cache**: 5 minutes TTL

---

#### 📊 **`getRankings`** - Public
**Purpose**: Generate comparative international rankings

**Input:**
```typescript
{
  countryId: string;
}
```

**Output:**
```typescript
Ranking[] = [
  {
    category: 'GDP per Capita' | 'Population' | 'Total GDP' | ...;
    global: { position: number; total: number };
    regional: { position: number; total: number; region: string };
    tier: { position: number; total: number; tier: string };
    trend: 'improving' | 'stable' | 'declining';
    percentile: number; // 0-100
  }
]
```

**Ranking Categories**:
- GDP per Capita (global, regional, tier-based)
- Population (global, regional, tier-based)
- Total GDP (computed metric)
- Economic Growth Rate
- Population Growth Rate

**Data Sources**:
- `Country` table (all countries for comparison)
- Complex sorting and ranking algorithms
- Regional and tier-based segmentation

**Cache**: 10 minutes TTL

---

#### 📅 **`getMilestones`** - Public
**Purpose**: Generate historical milestones and development timeline

**Input:**
```typescript
{
  countryId: string;
}
```

**Output:**
```typescript
Milestone[] = [
  {
    id: string;
    title: string;
    description: string;
    achievedAt: number; // Unix timestamp
    impact: string;
    category: 'population' | 'economic' | 'diplomatic' | 'governance' | 'infrastructure';
    significance: 'minor' | 'moderate' | 'major' | 'historic';
  }
]
```

**Milestone Detection**:
- **Population Milestones**: 1M, 5M, 10M, 25M, 50M, 100M citizens
- **Economic Milestones**: $10K, $25K, $50K, $75K, $100K GDP per capita
- **Growth Milestones**: Sustained high growth periods
- **Tier Advancement**: Economic/population tier changes

**Data Sources**:
- `HistoricalDataPoint` table (milestone detection)
- `Country` table (current status validation)

**Cache**: 15 minutes TTL

---

#### ⚡ **`getExecutiveActions`** - Protected
**Purpose**: Get available executive actions for country leaders

**Input:**
```typescript
{
  countryId: string;
}
```

**Output:**
```typescript
ExecutiveAction[] = [
  {
    id: string;
    title: string;
    description: string;
    category: 'economic' | 'diplomatic' | 'social' | 'military' | 'infrastructure' | 'emergency';
    urgency: 'low' | 'medium' | 'high' | 'critical';
    estimatedImpact: {
      economic?: string;
      social?: string;
      diplomatic?: string;
      timeframe: string;
    };
    requirements: string[];
    enabled: boolean;
  }
]
```

**Action Generation Logic**:
- **Economic Actions**: Based on GDP growth < 2%, high unemployment
- **Social Actions**: Based on population growth trends, quality metrics
- **Emergency Actions**: Based on crisis events, system alerts
- **Diplomatic Actions**: Based on relationship status, treaty opportunities

**Authorization**: Verified country ownership through `User.countryId`

**Data Sources**:
- `Country` table (current state analysis)
- `User` table (ownership verification)
- Dynamic action calculation based on country conditions

**Cache**: No caching (real-time decisions)

---

#### 🚀 **`executeAction`** - Protected
**Purpose**: Execute an executive action and log to the system

**Input:**
```typescript
{
  countryId: string;
  actionId: string;
  parameters?: Record<string, any>;
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
  timestamp: number;
}
```

**Execution Process**:
1. Verify user owns the country
2. Log action as `DmInputs` entry
3. Clear relevant caches
4. Return execution confirmation

**Data Modifications**:
- Creates entry in `DmInputs` table
- Clears related caches for immediate UI updates

**Authorization**: Strict ownership verification

---

#### 📈 **`getNationalSummary`** - Public
**Purpose**: Get high-level summary for national overview widgets

**Input:**
```typescript
{
  countryId: string;
}
```

**Output:**
```typescript
{
  countryId: string;
  countryName: string;
  overallHealth: number; // 0-100 composite score
  keyMetrics: {
    population: number;
    gdpPerCapita: number;
    totalGdp: number;
    economicTier: string;
    populationTier: string;
  };
  growthRates: {
    population: number;
    economic: number;
  };
  vitalityScores: VitalityScores;
  lastUpdated: number;
}
```

**Data Sources**:
- `Country` table
- Calculated vitality scores
- No expensive joins or calculations

**Cache**: 3 minutes TTL

---

## 🗄️ Database Schema Integration

### Core Country Data
The MyCountry system primarily reads from these database tables:

#### **Country Table** - Primary Data Source
```sql
Country {
  id: String (Primary Key)
  name: String (Unique)
  continent?: String
  region?: String
  -- Basic identifiers
  governmentType?: String
  leader?: String
  flag?: String
  
  -- Economic metrics (live calculated)
  currentPopulation: Float
  currentGdpPerCapita: Float  
  currentTotalGdp: Float
  adjustedGdpGrowth: Float
  populationGrowthRate: Float
  
  -- Tier classifications
  economicTier: String
  populationTier: String
  
  -- Timestamps
  lastCalculated: DateTime
  baselineDate: DateTime
  
  -- Relations
  user?: User
  historicalData: HistoricalDataPoint[]
  demographics?: Demographics
  economicProfile?: EconomicProfile
  -- ... other economic models
}
```

#### **HistoricalDataPoint Table** - Trend Analysis
```sql
HistoricalDataPoint {
  id: String (Primary Key)
  countryId: String (Foreign Key)
  ixTimeTimestamp: DateTime (Indexed)
  
  -- Snapshot data
  population: Float
  gdpPerCapita: Float
  totalGdp: Float
  populationGrowthRate: Float
  gdpGrowthRate: Float
  
  -- Optional geographic data
  landArea?: Float
  populationDensity?: Float
  gdpDensity?: Float
}
```

#### **IntelligenceItem Table** - Global Intelligence Feed
```sql
IntelligenceItem {
  id: String (Primary Key)
  title: String
  content: String
  category: String ('economic', 'diplomatic', etc.)
  priority: String ('low', 'medium', 'high', 'critical')
  source: String
  timestamp: DateTime
  
  -- Targeting
  region?: String
  affectedCountries?: String (JSON array)
  isActive: Boolean (Default: true)
}
```

#### **User Table** - Ownership & Authorization
```sql
User {
  id: String (Primary Key)
  clerkUserId: String (Unique, Clerk integration)
  countryId?: String (Unique, one-to-one with Country)
  
  -- Relations
  country?: Country
}
```

#### **DmInputs Table** - Action & Event Logging
```sql
DmInputs {
  id: String (Primary Key)
  countryId?: String (Foreign Key)
  ixTimeTimestamp: DateTime (IxTime when action occurred)
  inputType: String ('executive_action', 'policy_change', etc.)
  value: Float (Magnitude/intensity of action)
  description?: String (Human-readable description)
  duration?: Int (Effect duration in time periods)
  isActive: Boolean (Default: true)
  createdBy?: String (User ID who created the action)
}
```

### Supporting Tables

#### **CrisisEvent Table** - Crisis Intelligence
```sql
CrisisEvent {
  id: String (Primary Key)
  type: String ('natural_disaster', 'economic_crisis', etc.)
  title: String
  severity: String ('low', 'medium', 'high', 'critical')
  affectedCountries?: String (JSON array)
  casualties?: Int
  economicImpact?: Float
  responseStatus?: String
  timestamp: DateTime
  description?: String
  location?: String
}
```

#### **DiplomaticRelation Table** - Diplomatic Intelligence
```sql
DiplomaticRelation {
  id: String (Primary Key)
  country1: String (Country name)
  country2: String (Country name)
  relationship: String ('ally', 'neutral', 'hostile')
  strength: Int (1-10 scale)
  treaties?: String (JSON array)
  lastContact: DateTime
  status: String ('active', 'frozen', 'improving', 'deteriorating')
}
```

#### **Treaty Table** - International Agreements
```sql
Treaty {
  id: String (Primary Key)
  name: String
  parties?: String (JSON array of country names)
  type: String ('trade', 'defense', 'environmental', etc.)
  status: String ('active', 'expired', 'suspended')
  signedDate: DateTime
  expiryDate: DateTime
  description?: String
  complianceRate?: Int (0-100)
}
```

---

## 📊 Data Flow Architecture

### 1. **Country Data Import & Initialization**
```
Excel/CSV Import → Data Parser → Country Creation → Baseline Calculation → Historical Tracking
```

**Flow Detail**:
1. **Import Source**: Excel files with country economic data
2. **Parser**: `parseRosterFile()` in `lib/data-parser.ts`
3. **Database Write**: Creates `Country` record with baseline metrics
4. **Initial Calculation**: Runs economic calculations to establish baseline
5. **Historical Entry**: Creates first `HistoricalDataPoint` entry

### 2. **Real-Time Economic Calculations**
```
IxTime Tick → Economic Calculator → Country Updates → Historical Logging → UI Refresh
```

**Flow Detail**:
1. **Trigger**: IxTime system advancement (time acceleration)
2. **Calculator**: `IxStatsCalculator` in `lib/calculations.ts`
3. **Updates**: Batch update all country metrics
4. **Logging**: Create `HistoricalDataPoint` entries
5. **Refresh**: MyCountry UI detects changes via tRPC

### 3. **MyCountry Dashboard Data Flow**
```
User Request → Country Ownership Check → Data Aggregation → Vitality Calculation → Response
```

**Flow Detail**:
1. **Request**: User visits `/mycountry/new`
2. **Auth Check**: Verify user via Clerk → get `User.countryId`
3. **Data Fetch**: Get country data + related models
4. **Calculations**: 
   - Vitality scores (real-time calculation)
   - Intelligence feed aggregation
   - Achievement detection
   - Ranking computation
5. **Response**: Comprehensive dashboard data

### 4. **Intelligence Feed Generation**
```
Multiple Sources → Data Aggregation → Filtering & Prioritization → Cache → Response
```

**Sources**:
- **Economic Analysis**: Historical data trend detection
- **System Intelligence**: `IntelligenceItem` table queries
- **Crisis Events**: `CrisisEvent` table active events
- **Diplomatic Events**: `DiplomaticRelation` changes

**Processing**:
1. **Country Context**: Filter relevant intelligence by region/name
2. **Trend Analysis**: Detect significant changes in historical data
3. **Prioritization**: Sort by severity and timestamp
4. **Formatting**: Convert to standardized `IntelligenceItem` format

### 5. **Executive Action Flow**
```
Action Request → Authorization → Validation → Logging → Cache Invalidation → Response
```

**Flow Detail**:
1. **Request**: Executive dashboard action click
2. **Auth**: Verify `User.countryId` matches requested country
3. **Validation**: Check action availability and requirements
4. **Logging**: Create `DmInputs` entry for tracking
5. **Effects**: Future economic calculations will consider this input
6. **Invalidation**: Clear related caches for immediate UI updates

---

## 🔄 Caching Strategy

### Cache Layers

#### **1. Application Cache** (In-Memory)
- **Location**: `myCountryCache` Map in mycountry router
- **Purpose**: Expensive calculations and aggregations
- **TTL**: Variable (1-15 minutes based on data type)
- **Cleanup**: Automatic every 5 minutes

#### **2. tRPC Query Cache** (Client-Side)
- **Location**: React Query cache in browser
- **Purpose**: UI responsiveness and reduced API calls
- **TTL**: Configured per query (30-300 seconds)
- **Invalidation**: Manual triggers on data mutations

#### **3. Database Query Optimization**
- **Indexes**: Strategic indexes on frequently queried fields
- **Relations**: Careful use of `include` to avoid N+1 queries
- **Batch Operations**: Group related queries where possible

### Cache Invalidation Strategy

#### **Automatic Invalidation**
- **Time-based**: TTL expiration
- **Action-based**: Cache clearing on executive actions
- **System-based**: Calculation cycle completion

#### **Manual Invalidation** 
- **Data mutations**: Clear related caches on country updates
- **Admin actions**: System-wide cache clearing capability
- **User actions**: Clear user-specific caches on profile changes

---

## 🔐 Security & Authorization

### Access Control Patterns

#### **Public Data** (`publicProcedure`)
- Country basic information
- Public achievements and rankings
- Historical milestones
- National summaries
- **No sensitive data**: No internal intelligence or executive actions

#### **Protected Data** (`protectedProcedure`)
- Intelligence feed (executive-only information)
- Executive actions (country leadership tools)
- **Authorization**: Requires Clerk authentication
- **Ownership**: Verified via `User.countryId` matching

### Data Privacy

#### **Sensitive Information Protection**
- Internal economic modeling parameters
- Executive action logs and parameters
- Real-time intelligence assessments
- Strategic planning data

#### **Public Information** 
- Basic country metrics (population, GDP, growth rates)
- Historical achievements and milestones
- International rankings
- General timeline of development

---

## 🚨 Error Handling & Monitoring

### Error Categories

#### **1. Data Validation Errors**
- Invalid country IDs
- Malformed input parameters
- Missing required fields
- **Response**: 400 Bad Request with descriptive message

#### **2. Authorization Errors**
- Unauthenticated requests to protected endpoints
- Country ownership mismatches
- **Response**: 401 Unauthorized or 403 Forbidden

#### **3. System Errors**
- Database connection failures
- Calculation errors
- External service failures
- **Response**: 500 Internal Server Error
- **Logging**: Full error details logged for debugging

#### **4. Not Found Errors**
- Nonexistent country IDs
- Missing user profiles
- **Response**: 404 Not Found

### Monitoring & Observability

#### **Performance Metrics**
- API response times
- Cache hit/miss ratios
- Database query performance
- Memory usage patterns

#### **Business Metrics**
- Intelligence feed generation success rate
- Achievement calculation accuracy
- User engagement with executive actions
- Data freshness and update frequency

#### **Error Tracking**
- Error frequency by endpoint
- Failed authorization attempts
- Database constraint violations
- Cache invalidation failures

---

## 🔧 Development & Testing

### Local Development Setup

1. **Database**: SQLite for development (matches production schema)
2. **Seed Data**: Import sample country data via admin interface
3. **Authentication**: Clerk development keys for testing
4. **Time System**: IxTime in development mode (faster acceleration)

### Testing Strategy

#### **Unit Tests**
- Vitality score calculations
- Intelligence feed generation logic
- Achievement detection algorithms
- Ranking computation accuracy

#### **Integration Tests**
- Full API endpoint testing
- Database transaction integrity
- Cache invalidation correctness
- Authorization flow validation

#### **Performance Tests**
- Large dataset handling
- Concurrent user scenarios
- Cache performance under load
- Database query optimization

---

## 📈 Performance Optimization

### Query Optimization

#### **Strategic Indexing**
```sql
-- Most important indexes for MyCountry
CREATE INDEX idx_country_tier ON Country(economicTier);
CREATE INDEX idx_country_region ON Country(region);
CREATE INDEX idx_historical_country_time ON HistoricalDataPoint(countryId, ixTimeTimestamp);
CREATE INDEX idx_intelligence_active ON IntelligenceItem(isActive, timestamp);
CREATE INDEX idx_user_clerk ON User(clerkUserId);
```

#### **Query Patterns**
- **Single Country Queries**: Direct ID lookup with selective includes
- **Ranking Queries**: Batch fetch with sorting and filtering
- **Intelligence Queries**: Time-range and region filtering
- **Historical Queries**: Limited result sets with proper ordering

### Data Loading Optimization

#### **Selective Loading**
- Only load required fields for specific use cases
- Use separate endpoints for detailed vs. summary data
- Implement pagination for large datasets

#### **Batch Operations**
- Group related database operations
- Use database transactions for consistency
- Minimize round trips between API and database

### Caching Best Practices

#### **Cache Key Design**
```typescript
// Hierarchical cache keys for efficient invalidation
const cacheKey = `${operation}_${countryId}_${additionalParams}`;

// Examples:
'intelligence_clk123_limit20'
'achievements_clk123'
'rankings_clk123'
'summary_clk123'
```

#### **TTL Strategy**
- **High Frequency Data**: 1-3 minutes (intelligence, summary)
- **Medium Frequency Data**: 5-10 minutes (achievements, rankings)
- **Low Frequency Data**: 15+ minutes (milestones, historical)

---

## 🚀 Future Enhancements

### Planned API Extensions

#### **Advanced Analytics Endpoints**
- Predictive modeling for country development
- Comparative analysis with peer countries
- Economic scenario modeling
- Risk assessment calculations

#### **Real-Time Features**
- WebSocket integration for live updates
- Event streaming for intelligence feed
- Real-time collaboration for executive teams
- Live diplomatic negotiations

#### **External Integrations**
- MediaWiki integration for national documentation
- Discord bot integration for notifications
- External economic data feeds
- International organization APIs

### Scalability Considerations

#### **Database Scaling**
- Read replicas for analytics queries
- Partitioning strategies for historical data
- Archive policies for old intelligence items
- Connection pooling optimization

#### **API Scaling**
- Rate limiting per user/endpoint
- Request queuing for expensive operations
- Microservice extraction for specialized functions
- CDN integration for static assets

---

*Last Updated: August 2025*  
*API Version: 1.0*  
*Next Review: Monthly during active development*