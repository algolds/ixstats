# MyCountry System Documentation

**Version:** 1.1.0
**Last Updated:** October 2025
**Status:** Production-Ready (95% Feature Complete)

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [8-Tab System](#8-tab-system)
4. [Intelligence System](#intelligence-system)
5. [Vitality Scoring](#vitality-scoring)
6. [Activity Rings](#activity-rings)
7. [Data Transformers](#data-transformers)
8. [Component Catalog](#component-catalog)
9. [State Management](#state-management)
10. [tRPC Integration](#trpc-integration)
11. [Development Guide](#development-guide)

---

## Overview

The MyCountry system is the central executive dashboard for managing your nation in IxStats. It provides real-time intelligence, vitality monitoring, and comprehensive analytics across all national systems.

### Key Features

- **8 Specialized Tabs**: Executive, Intelligence, Overview, Economy, Labor, Government, Demographics, Analytics
- **Real-time Intelligence**: Live data from 304 tRPC endpoints
- **Vitality Scoring**: 5 comprehensive scores (economic, population, diplomatic, governmental, overall)
- **Activity Rings**: Apple Watch-style progress tracking
- **Holographic UI**: Glass physics design with depth hierarchy
- **Adaptive Content**: Executive vs detailed vs crisis modes

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MyCountry Dashboard                       │
├─────────────────┬─────────────────┬──────────────────────────┤
│  Intelligence   │   Vitality      │      Activities          │
│   Engine        │   Calculator    │      Tracker             │
├─────────────────┼─────────────────┼──────────────────────────┤
│ • Alerts        │ • Economic      │ • Activity Rings         │
│ • Insights      │ • Population    │ • Progress Tracking      │
│ • Predictions   │ • Diplomatic    │ • Goal Monitoring        │
│ • Risks         │ • Governmental  │ • Achievements           │
│ • Opportunities │ • Overall       │ • Milestones             │
└─────────────────┴─────────────────┴──────────────────────────┘
```

### Technology Stack

- **Frontend**: React 18 with Next.js 15 App Router
- **State Management**: React hooks with context providers
- **API Layer**: tRPC v10 for type-safe data fetching
- **Real-time**: WebSocket intelligence broadcasts
- **UI Framework**: Tailwind CSS v4 with glass physics
- **Charts**: Recharts for data visualization

### Page Structure

```typescript
/app/mycountry/
├── page.tsx                          // Main dashboard entry
├── components/
│   ├── ExecutiveCommandCenter.tsx    // Executive tab
│   ├── RealTimeIntelligenceDashboard.tsx  // Intelligence tab
│   ├── HolographicNationCard.tsx     // Overview tab
│   ├── EnhancedEconomicIntelligence.tsx  // Economy tab
│   ├── ActivityRings.tsx             // Activity tracking
│   ├── IntelligenceBriefings.tsx     // Alerts & insights
│   └── ForwardLookingIntelligence.tsx  // Predictions
├── hooks/
│   └── useDataSync.ts                // Real-time data sync
├── utils/
│   ├── dataTransformers.ts           // Data transformation
│   ├── liveDataTransformers.ts       // Live API integration
│   └── intelligence.ts               // Intelligence calculations
└── types/
    └── intelligence.ts               // TypeScript interfaces
```

---

## 8-Tab System

### Tab Overview

| Tab | Purpose | Key Features | Color Theme |
|-----|---------|--------------|-------------|
| **Executive** | High-level summary | Critical alerts, urgent actions, overall status | Gold |
| **Intelligence** | Advanced analytics | Vitality scores, predictions, risk assessment | Blue |
| **Overview** | Nation snapshot | Holographic card, key metrics, quick stats | Gold |
| **Economy** | Economic data | GDP, growth, sectors, trade, fiscal policy | Green |
| **Labor** | Employment metrics | Unemployment, wages, labor force, demographics | Purple |
| **Government** | Structure & efficiency | Departments, budgets, effectiveness, policies | Indigo |
| **Demographics** | Population data | Age distribution, growth, density, urbanization | Orange |
| **Analytics** | Historical trends | Charts, comparisons, forecasts, correlations | Cyan |

### Tab Navigation

```typescript
type TabId = 'executive' | 'intelligence' | 'overview' | 'economy' |
             'labor' | 'government' | 'demographics' | 'analytics';

interface TabConfig {
  id: TabId;
  label: string;
  icon: LucideIcon;
  color: string;
  component: React.ComponentType;
  description: string;
}

const tabs: TabConfig[] = [
  {
    id: 'executive',
    label: 'Executive',
    icon: Crown,
    color: 'from-amber-500 to-yellow-600',
    component: ExecutiveCommandCenter,
    description: 'High-level executive summary'
  },
  // ... other tabs
];
```

---

## Intelligence System

### Intelligence Types

The intelligence system generates 4 types of insights:

1. **Critical Alerts**: Immediate attention required
2. **Trending Insights**: Performance patterns and changes
3. **Actionable Recommendations**: Strategic suggestions
4. **Forward Intelligence**: Predictions and opportunities

### Intelligence Engine Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Intelligence Generation                     │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Anomaly    │    Trend     │ Correlation  │   Threshold    │
│  Detection   │   Analysis   │   Analysis   │   Monitoring   │
└──────────────┴──────────────┴──────────────┴────────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                           │
                    ┌──────▼──────┐
                    │  Unified    │
                    │ Intelligence│
                    │   Report    │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐     ┌─────▼─────┐    ┌─────▼─────┐
    │ Alerts  │     │  Insights │    │ Forecasts │
    └─────────┘     └───────────┘    └───────────┘
```

### Critical Alerts

```typescript
interface CriticalAlert {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  category: 'economic' | 'population' | 'diplomatic' | 'governance' | 'crisis';
  priority: 'critical' | 'high' | 'medium' | 'low';
  actionRequired: boolean;
  timeframe: 'immediate' | 'short' | 'medium' | 'long';
  estimatedImpact: {
    magnitude: 'low' | 'medium' | 'high' | 'severe';
    areas: string[];
  };
  recommendedActions: string[];
  createdAt: number;
  expiresAt?: number;
}
```

**Detection Methods:**

1. **Z-Score Analysis**: Values > 3.0 or < -3.0 standard deviations
2. **Modified Z-Score**: Better for non-normal economic data
3. **Threshold Monitoring**: Key benchmarks (GDP < peer average, unemployment > 8%)
4. **Trend Reversal**: Sudden changes in direction

**Example Alerts:**

```typescript
// GDP anomaly detected
{
  title: 'Unusual GDP Per Capita detected',
  message: 'GDP per capita is 25.3% lower than historical average (z-score: -2.8)',
  severity: 'high',
  category: 'economic',
  recommendedActions: [
    'Review economic growth strategies',
    'Analyze productivity barriers',
    'Consider investment incentives'
  ]
}

// Unemployment threshold breach
{
  title: 'High Unemployment Rate',
  message: 'Unemployment at 9.2% exceeds healthy threshold of 5-6%',
  severity: 'critical',
  category: 'economic',
  recommendedActions: [
    'Implement job creation programs',
    'Review labor market policies',
    'Invest in skills training'
  ]
}
```

### Trending Insights

```typescript
interface TrendingInsight {
  id: string;
  title: string;
  description: string;
  category: 'performance' | 'ranking' | 'opportunity' | 'comparison';
  icon: LucideIcon;
  trend: 'up' | 'down' | 'stable';
  significance: 'major' | 'moderate' | 'minor';
  metrics: IntelligenceMetric[];
  context: {
    comparison?: 'peer' | 'historical' | 'target';
    timeframe: string;
    confidence: number; // 0-100
  };
  actionable: boolean;
  nextReview?: number;
}
```

**Insight Categories:**

- **Performance**: Your country's metrics trending
- **Ranking**: Position changes vs other nations
- **Opportunity**: Growth opportunities detected
- **Comparison**: How you stack up against peers

### Actionable Recommendations

```typescript
interface ActionableRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'economic' | 'population' | 'diplomatic' | 'governance';
  urgency: 'urgent' | 'important' | 'routine' | 'future';
  difficulty: 'easy' | 'moderate' | 'complex' | 'major';
  estimatedDuration: string;
  estimatedCost: string;
  estimatedBenefit: string;
  prerequisites: string[];
  risks: string[];
  successProbability: number; // 0-100
  impact: {
    economic?: number;
    social?: number;
    diplomatic?: number;
    governance?: number;
  };
}
```

**Recommendation Engine:**

The system analyzes vitality scores, trends, and alerts to generate contextual recommendations:

```typescript
// Example: Economic vitality < 50
{
  title: 'Accelerate Economic Reforms',
  urgency: 'important',
  difficulty: 'moderate',
  estimatedDuration: '6-12 months',
  estimatedBenefit: '+15 economic vitality',
  prerequisites: [
    'Stable government structure',
    'Fiscal space for investments',
    'Political will for reform'
  ],
  risks: [
    'Short-term economic disruption',
    'Political opposition',
    'Implementation complexity'
  ],
  successProbability: 70
}
```

### Forward Intelligence

```typescript
interface ForwardIntelligence {
  predictions: Array<{
    id: string;
    title: string;
    category: string;
    metric: string;
    currentValue: number;
    predictedValue: number;
    timeframe: string;
    confidence: number;
    factors: string[];
    trend: 'up' | 'down' | 'stable';
  }>;

  opportunities: Array<{
    id: string;
    title: string;
    category: string;
    potentialImpact: {
      magnitude: string;
      areas: string[];
      timeframe: string;
    };
    requirements: string[];
    confidence: number;
    expirationDate: number;
  }>;

  risks: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    probability: number;
    impact: {
      magnitude: string;
      areas: string[];
    };
    mitigation: string[];
    timeline: string;
  }>;
}
```

**Prediction Models:**

1. **Linear Forecast**: Based on historical velocity
2. **Dynamic Factor Models**: Multi-variate forecasting
3. **Correlation-Based**: Leveraging factor relationships
4. **Confidence Bands**: Uncertainty quantification

---

## Vitality Scoring

### Overview

Vitality scores provide a holistic health assessment across 5 dimensions:

1. **Economic Vitality** (0-100): Economic health and growth
2. **Population Wellbeing** (0-100): Quality of life and demographics
3. **Diplomatic Standing** (0-100): International relations
4. **Governmental Efficiency** (0-100): Administrative effectiveness
5. **Overall Vitality** (0-100): Weighted average of all scores

### Score Calculation

```typescript
interface VitalityIntelligence {
  area: 'economic' | 'population' | 'diplomatic' | 'governance';
  score: number; // 0-100 from API
  trend: 'up' | 'down' | 'stable';
  change: {
    value: number;
    period: string;
    reason: string;
  };
  status: 'excellent' | 'good' | 'concerning' | 'critical';
  keyMetrics: IntelligenceMetric[];
  criticalAlerts: CriticalAlert[];
  recommendations: ActionableRecommendation[];
  forecast: {
    shortTerm: {
      projected: number;
      confidence: number;
      factors: string[];
    };
    longTerm: {
      projected: number;
      confidence: number;
      factors: string[];
    };
  };
  comparisons: {
    peerAverage: number;
    regionalAverage: number;
    historicalBest: number;
    rank: number;
    totalCountries: number;
  };
}
```

### Economic Vitality

**Calculation Factors:**
- GDP per capita (40% weight)
- Real GDP growth rate (30% weight)
- Economic tier classification (20% weight)
- Fiscal health (10% weight)

**Status Thresholds:**
- **Excellent**: 85-100
- **Good**: 70-84
- **Concerning**: 50-69
- **Critical**: 0-49

**Key Metrics:**

```typescript
[
  {
    id: 'gdp-per-capita',
    label: 'GDP per Capita',
    value: 52000,
    unit: '',
    trend: 'up',
    changeValue: 2500,
    changePercent: 5.1,
    status: 'excellent'
  },
  {
    id: 'growth-rate',
    label: 'Growth Rate',
    value: 3.2,
    unit: '%',
    trend: 'up',
    changeValue: 0.5,
    status: 'excellent'
  },
  {
    id: 'economic-tier',
    label: 'Economic Tier',
    value: 'Developed',
    trend: 'stable',
    status: 'excellent'
  }
]
```

### Population Wellbeing

**Calculation Factors:**
- Current population size (20% weight)
- Population growth rate (25% weight)
- Population tier classification (20% weight)
- Quality of life indicators (35% weight)

**Key Metrics:**

```typescript
[
  {
    id: 'total-population',
    label: 'Population',
    value: '25.3M',
    trend: 'up',
    changeValue: 350000,
    changePercent: 1.4
  },
  {
    id: 'population-growth',
    label: 'Growth Rate',
    value: 1.8,
    unit: '%',
    trend: 'up'
  },
  {
    id: 'population-tier',
    label: 'Population Tier',
    value: 'Medium',
    trend: 'stable'
  }
]
```

### Diplomatic Standing

**Calculation Factors:**
- Embassy network size (30% weight)
- Active diplomatic missions (25% weight)
- Alliance memberships (20% weight)
- Cultural influence (15% weight)
- Regional integration (10% weight)

**Key Metrics:**

```typescript
[
  {
    id: 'diplomatic-standing',
    label: 'Diplomatic Standing',
    value: 78,
    unit: '/100',
    trend: 'up',
    changeValue: 3
  },
  {
    id: 'regional-influence',
    label: 'Regional Influence',
    value: 'Moderate',
    trend: 'stable'
  },
  {
    id: 'embassy-count',
    label: 'Embassies',
    value: 42,
    trend: 'up'
  }
]
```

### Governmental Efficiency

**Calculation Factors:**
- Administrative effectiveness (30% weight)
- Budget execution rate (25% weight)
- Policy implementation (20% weight)
- Public service quality (15% weight)
- Corruption control (10% weight)

**Key Metrics:**

```typescript
[
  {
    id: 'government-efficiency',
    label: 'Government Efficiency',
    value: 82,
    unit: '/100',
    trend: 'up',
    changeValue: 2
  },
  {
    id: 'government-type',
    label: 'Government Type',
    value: 'Parliamentary Democracy',
    trend: 'stable'
  },
  {
    id: 'budget-execution',
    label: 'Budget Execution',
    value: 94,
    unit: '%',
    trend: 'up'
  }
]
```

### Overall Vitality

**Calculation:**

```typescript
const overallVitality = (
  economicVitality * 0.35 +
  populationWellbeing * 0.25 +
  diplomaticStanding * 0.20 +
  governmentalEfficiency * 0.20
);
```

**Weighted Factors:**
- Economic: 35% (most important)
- Population: 25%
- Diplomatic: 20%
- Governmental: 20%

### Forecasting

**Short-term (3 months):**

```typescript
{
  projected: Math.min(100, currentScore + (growthRate * 50)),
  confidence: 75,
  factors: [
    'Current growth trajectory',
    'Economic momentum',
    'Policy effectiveness'
  ]
}
```

**Long-term (1 year):**

```typescript
{
  projected: Math.min(100, currentScore + (growthRate * 200)),
  confidence: 65,
  factors: [
    'Long-term economic trends',
    'Demographic changes',
    'Global economic conditions',
    'Policy reforms impact'
  ]
}
```

---

## Activity Rings

### Overview

Activity Rings provide an Apple Watch-style visual representation of daily progress across 3 dimensions:

1. **Move Ring** (Blue): Economic activity and growth
2. **Exercise Ring** (Green): Government effectiveness and actions
3. **Stand Ring** (Red): Population engagement and participation

### Ring Calculation

```typescript
interface ActivityRing {
  id: string;
  label: string;
  color: string;
  current: number;
  target: number;
  percentage: number;
  status: 'on-track' | 'behind' | 'ahead' | 'complete';
  unit: string;
  icon: LucideIcon;
}

// Economic Activity Ring (Move)
const economicRing: ActivityRing = {
  id: 'economic',
  label: 'Economic Activity',
  color: 'blue',
  current: country.currentTotalGdp / 1e9, // Billions
  target: calculateEconomicTarget(country),
  percentage: (current / target) * 100,
  status: percentage >= 100 ? 'complete' :
          percentage >= 80 ? 'on-track' :
          percentage >= 60 ? 'behind' : 'critical',
  unit: 'B GDP',
  icon: DollarSign
};

// Government Effectiveness Ring (Exercise)
const governmentRing: ActivityRing = {
  id: 'government',
  label: 'Government Actions',
  color: 'green',
  current: country.governmentalEfficiency,
  target: 100,
  percentage: country.governmentalEfficiency,
  status: getStatusFromPercentage(percentage),
  unit: '/100',
  icon: Building
};

// Population Engagement Ring (Stand)
const populationRing: ActivityRing = {
  id: 'population',
  label: 'Population Engagement',
  color: 'red',
  current: country.populationWellbeing,
  target: 100,
  percentage: country.populationWellbeing,
  status: getStatusFromPercentage(percentage),
  unit: '/100',
  icon: Users
};
```

### Visual Representation

```typescript
// SVG Ring Component
interface RingProps {
  radius: number;
  strokeWidth: number;
  progress: number; // 0-100
  color: string;
  innerRing?: boolean;
}

const circumference = 2 * Math.PI * radius;
const offset = circumference - (progress / 100) * circumference;

<circle
  cx="50%"
  cy="50%"
  r={radius}
  stroke={color}
  strokeWidth={strokeWidth}
  strokeDasharray={circumference}
  strokeDashoffset={offset}
  fill="none"
  strokeLinecap="round"
  transform="rotate(-90 50 50)"
  className="transition-all duration-1000 ease-out"
/>
```

### Ring Targets

**Economic Activity Target:**

```typescript
function calculateEconomicTarget(country: Country): number {
  const baseTarget = country.currentTotalGdp * 1.03; // 3% growth
  const tierMultiplier = {
    'developed': 1.02,
    'emerging': 1.05,
    'developing': 1.08
  }[country.economicTier] || 1.03;

  return baseTarget * tierMultiplier;
}
```

**Government Effectiveness Target:**

```typescript
// Fixed target of 100 (perfect efficiency)
const target = 100;
```

**Population Engagement Target:**

```typescript
// Fixed target of 100 (perfect wellbeing)
const target = 100;
```

### Ring Animations

```typescript
// Staggered reveal animation
const ringVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: {
        delay: i * 0.2,
        duration: 1.5,
        ease: "easeInOut"
      },
      opacity: {
        delay: i * 0.2,
        duration: 0.5
      }
    }
  })
};
```

---

## Data Transformers

### Live Data Transformation

The system transforms raw API data to intelligence formats:

```typescript
// src/app/mycountry/utils/liveDataTransformers.ts

interface ApiCountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  realGDPGrowthRate: number;
  populationGrowthRate: number;
  economicTier: string;
  populationTier: string;
  economicVitality: number;      // From API
  populationWellbeing: number;   // From API
  diplomaticStanding: number;    // From API
  governmentalEfficiency: number; // From API
  lastCalculated: number;
  // ... other fields
}

export function transformApiDataToVitalityIntelligence(
  country: ApiCountryData,
  previousCountry?: ApiCountryData
): VitalityIntelligence[] {
  return [
    {
      area: 'economic',
      score: country.economicVitality, // Real score from API
      trend: calculateTrend(country.economicVitality, previousCountry?.economicVitality),
      change: {
        value: previousCountry ?
          country.economicVitality - previousCountry.economicVitality : 0,
        period: 'vs previous calculation',
        reason: 'Economic performance evaluation'
      },
      status: getVitalityStatus(country.economicVitality),
      keyMetrics: [
        // Transform raw data to metrics
      ],
      // ... other fields
    },
    // ... other vitality areas
  ];
}
```

### Intelligence Generation

```typescript
export function transformApiDataToExecutiveIntelligence(
  country: ApiCountryData,
  intelligenceItems: ApiIntelligenceItem[] = [],
  previousCountry?: ApiCountryData
): ExecutiveIntelligence {
  const vitalityIntelligence = transformApiDataToVitalityIntelligence(
    country,
    previousCountry
  );

  const criticalAlerts = transformApiIntelligenceToAlerts(intelligenceItems);
  const trendingInsights = transformApiIntelligenceToInsights(intelligenceItems);
  const urgentActions = transformApiIntelligenceToRecommendations(intelligenceItems);

  // Calculate overall status
  const averageVitality = vitalityIntelligence.reduce(
    (sum, v) => sum + v.score, 0
  ) / vitalityIntelligence.length;

  const overallStatus =
    averageVitality >= 85 ? 'excellent' :
    averageVitality >= 70 ? 'good' :
    averageVitality >= 50 ? 'concerning' : 'critical';

  return {
    countryId: country.id,
    generatedAt: Date.now(),
    nextUpdate: Date.now() + (30 * 60 * 1000), // 30 minutes
    criticalAlerts,
    urgentActions,
    vitalityIntelligence,
    trendingInsights,
    forwardIntelligence: generateForwardIntelligence(country, vitalityIntelligence),
    overallStatus,
    confidenceLevel: calculateConfidence(intelligenceItems),
    lastMajorChange: {
      date: country.lastCalculated,
      description: 'Economic vitality recalculated',
      impact: 'Economic metrics updated based on latest data'
    },
    viewMode: 'executive',
    priorityThreshold: 'high'
  };
}
```

### Helper Functions

```typescript
function calculateTrend(current?: number, previous?: number): TrendDirection {
  if (!current || !previous) return 'stable';
  const change = current - previous;
  if (Math.abs(change) < 0.01) return 'stable';
  return change > 0 ? 'up' : 'down';
}

function getVitalityStatus(score: number): VitalityStatus {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'concerning';
  return 'critical';
}

function formatLargeNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
}
```

---

## Component Catalog

### Executive Components

```
ExecutiveCommandCenter
├── CriticalAlertsPanel
│   ├── AlertCard (severity-based styling)
│   └── AlertActions (dismiss, escalate, resolve)
├── UrgentActionsPanel
│   ├── RecommendationCard
│   └── ActionButtons (implement, defer, dismiss)
├── VitalityOverview
│   ├── VitalityRing (circular progress)
│   └── ScoreBreakdown
└── QuickMetrics
    ├── MetricCard (GDP, Population, Growth)
    └── TrendIndicator
```

### Intelligence Components

```
RealTimeIntelligenceDashboard
├── VitalityIntelligencePanel
│   ├── EconomicVitality
│   ├── PopulationWellbeing
│   ├── DiplomaticStanding
│   └── GovernmentalEfficiency
├── TrendingInsightsPanel
│   ├── InsightCard
│   └── InsightMetrics
├── ForwardLookingIntelligence
│   ├── PredictionsSection
│   ├── OpportunitiesSection
│   └── RisksSection
└── CompetitiveIntelligence
    ├── PeerComparison
    └── RegionalAnalysis
```

### Overview Components

```
HolographicNationCard
├── CountryHeader (flag, name, leader)
├── VitalityRings (3 concentric rings)
├── KeyMetricsGrid
│   ├── GDPMetric
│   ├── PopulationMetric
│   ├── GrowthMetric
│   └── TierBadge
└── QuickActions (Edit, Analytics, Share)
```

### Activity Components

```
ActivityRings
├── RingSVG (animated circular progress)
│   ├── OuterRing (Economic)
│   ├── MiddleRing (Government)
│   └── InnerRing (Population)
├── RingLegend
│   ├── RingLabel
│   └── ProgressText
└── GoalProgress
    ├── CurrentValue
    └── TargetValue
```

### Shared Primitives

```
/components/mycountry/primitives/
├── VitalityRings.tsx              // Apple Watch-style rings
├── CountryMetricsGrid.tsx         // Metric card grid
├── CountryHeader.tsx              // Header with flag/name
├── CountryDataProvider.tsx        // Context provider
└── AuthenticationGuard.tsx        // Auth wrapper
```

---

## State Management

### Data Sync Hook

```typescript
// src/app/mycountry/hooks/useDataSync.ts

export function useDataSync(countryId: string) {
  const [data, setData] = useState<CountryData | null>(null);
  const [intelligence, setIntelligence] = useState<ExecutiveIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch country data
  const { data: countryData, refetch } = api.countries.getById.useQuery(
    { id: countryId },
    { enabled: !!countryId, refetchInterval: 30000 } // 30s
  );

  // Fetch intelligence data
  const { data: intelligenceData } = api.intelligence.getForCountry.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 60000 } // 60s
  );

  useEffect(() => {
    if (countryData && intelligenceData) {
      const vitality = transformApiDataToVitalityIntelligence(countryData);
      const executive = transformApiDataToExecutiveIntelligence(
        countryData,
        intelligenceData
      );

      setData(countryData);
      setIntelligence(executive);
      setIsLoading(false);
    }
  }, [countryData, intelligenceData]);

  return {
    data,
    intelligence,
    isLoading,
    error,
    refetch
  };
}
```

### Real-time Updates

```typescript
// WebSocket integration
export function useRealTimeIntelligence(countryId: string) {
  const [updates, setUpdates] = useState<IntelligenceUpdate[]>([]);

  useEffect(() => {
    const socket = io(WS_URL);

    socket.emit('subscribe:intelligence', countryId);

    socket.on('intelligence:update', (update: IntelligenceUpdate) => {
      setUpdates(prev => [...prev, update]);
    });

    return () => {
      socket.emit('unsubscribe:intelligence', countryId);
      socket.close();
    };
  }, [countryId]);

  return updates;
}
```

---

## tRPC Integration

### Key Endpoints

```typescript
// Countries router
countries.getById                    // Get country by ID
countries.getMyCountry               // Get current user's country
countries.updateCountry              // Update country data
countries.getComparisons             // Get peer comparisons

// Intelligence router
intelligence.getForCountry           // Get intelligence report
intelligence.getAlerts               // Get active alerts
intelligence.getPredictions          // Get forecasts
intelligence.getRecommendations      // Get action items

// Economics router
economics.getEconomicData            // Get economic metrics
economics.getHistoricalData          // Get time series
economics.calculateVitality          // Recalculate vitality

// Government router
government.getStructure              // Get government structure
government.getEfficiency             // Get efficiency metrics
government.getBudget                 // Get budget allocation
```

### Usage Example

```typescript
// In component
const { data: country, isLoading } = api.countries.getMyCountry.useQuery();

const { data: intelligence } = api.intelligence.getForCountry.useQuery(
  { countryId: country?.id },
  { enabled: !!country?.id }
);

const { mutate: updateCountry } = api.countries.updateCountry.useMutation({
  onSuccess: () => {
    toast.success('Country updated successfully');
    refetch();
  }
});
```

---

## Development Guide

### Local Development

1. **Start development server**

```bash
npm run dev
```

2. **Access MyCountry dashboard**

```
http://localhost:3000/mycountry
```

3. **Enable debug mode**

```typescript
localStorage.setItem('debug_intelligence', 'true');
```

### Creating New Tab

```typescript
// 1. Add tab configuration
const newTab: TabConfig = {
  id: 'newtab',
  label: 'New Tab',
  icon: Star,
  color: 'from-purple-500 to-pink-600',
  component: NewTabComponent,
  description: 'Description of new tab'
};

// 2. Create component
export function NewTabComponent() {
  const { data, isLoading } = useDataSync(countryId);

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <h2>New Tab Content</h2>
      {/* Your content here */}
    </div>
  );
}

// 3. Add to tab list
const tabs = [...existingTabs, newTab];
```

### Adding Intelligence Feature

```typescript
// 1. Define interface
interface NewIntelligenceFeature {
  id: string;
  type: string;
  data: any;
  confidence: number;
}

// 2. Add transformer
export function transformToNewFeature(
  apiData: ApiData
): NewIntelligenceFeature {
  return {
    id: generateId(),
    type: 'feature',
    data: processData(apiData),
    confidence: calculateConfidence(apiData)
  };
}

// 3. Integrate into executive intelligence
const feature = transformToNewFeature(apiData);
executiveIntelligence.newFeature = feature;
```

### Testing Intelligence

```typescript
// Mock country data
const mockCountry: ApiCountryData = {
  id: 'test_country',
  name: 'Test Nation',
  economicVitality: 75,
  populationWellbeing: 82,
  diplomaticStanding: 68,
  governmentalEfficiency: 79,
  // ... other fields
};

// Generate intelligence
const intelligence = transformApiDataToExecutiveIntelligence(mockCountry);

// Verify alerts
expect(intelligence.criticalAlerts.length).toBeGreaterThan(0);
expect(intelligence.overallStatus).toBe('good');
```

---

## Conclusion

The MyCountry system provides a comprehensive executive dashboard with real-time intelligence, vitality monitoring, and predictive analytics. The 8-tab interface covers all aspects of national management, while the intelligence engine delivers actionable insights based on advanced statistical analysis.

For additional support, consult:
- **Intelligence Engine**: `/src/lib/intelligence-engine.ts`
- **Data Transformers**: `/src/app/mycountry/utils/liveDataTransformers.ts`
- **Component Library**: `/src/app/mycountry/components/`
- **Type Definitions**: `/src/app/mycountry/types/intelligence.ts`

**Version**: 1.1.0
**Last Updated**: October 2025
**Status**: Production-Ready (95% Feature Complete)
